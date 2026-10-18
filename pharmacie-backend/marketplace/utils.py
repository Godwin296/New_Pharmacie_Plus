"""
Utilitaires de la marketplace : position GPS, distance, statut "ouvert maintenant",
prochain changement d'ouverture et résumé des horaires.

Pas de PostGIS ici (pas installé, pas nécessaire à l'échelle du projet -- centaines de
pharmacies, pas des millions) : une simple formule de Haversine en Python suffit très
largement pour trier une liste de résultats par proximité.

⚡ PERFORMANCE : toutes les fonctions horaires lisent `pharmacie.horaires.all()` et non
`.filter(...)`. Les vues préchargent ces horaires avec prefetch_related('horaires') ; `.all()`
réutilise ce préchargement (zéro requête SQL par pharmacie), alors que `.filter()` ignorerait
le cache et relancerait une requête par carte affichée (problème N+1).
"""
import math

from django.utils import timezone

RAYON_MAX_KM = 500


class ParametreInvalide(ValueError):
    """Paramètre de requête invalide -- le message est renvoyé tel quel au client (HTTP 400)."""


def lire_position(params):
    """
    Lit ?lat=&lng= dans les query params. Retourne (lat, lng), ou (None, None) si aucun des
    deux n'est fourni. Lève ParametreInvalide si une seule valeur est fournie, si une valeur
    n'est pas numérique, ou si elle sort des bornes terrestres.

    float() accepte "nan" et "inf" sans broncher : sans le contrôle isfinite, une position
    "nan" passerait la validation et fausserait silencieusement tout le tri par distance.
    """
    lat_brut = (params.get('lat') or '').strip()
    lng_brut = (params.get('lng') or '').strip()
    if not lat_brut and not lng_brut:
        return None, None
    if not lat_brut or not lng_brut:
        raise ParametreInvalide("lat et lng doivent être fournis ensemble.")
    try:
        lat, lng = float(lat_brut), float(lng_brut)
    except ValueError:
        raise ParametreInvalide("lat/lng invalides -- attendu deux nombres décimaux.")
    if not (math.isfinite(lat) and math.isfinite(lng)) or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ParametreInvalide("lat/lng hors limites (lat entre -90 et 90, lng entre -180 et 180).")
    return lat, lng


def lire_rayon(params, position_fournie):
    """
    Lit ?rayon_km= (recherche "autour de moi"). Retourne un float, ou None si absent.
    Exige une position : un rayon n'a aucun sens sans point central.
    """
    brut = (params.get('rayon_km') or '').strip()
    if not brut:
        return None
    if not position_fournie:
        raise ParametreInvalide("rayon_km nécessite lat et lng.")
    try:
        rayon = float(brut)
    except ValueError:
        raise ParametreInvalide("rayon_km invalide -- attendu un nombre positif.")
    if not math.isfinite(rayon) or rayon <= 0 or rayon > RAYON_MAX_KM:
        raise ParametreInvalide(f"rayon_km doit être supérieur à 0 et inférieur ou égal à {RAYON_MAX_KM}.")
    return rayon


def valider_coordonnee(valeur, nom, limite):
    """
    Valide une latitude (limite=90) ou longitude (limite=180) envoyée par le pharmacien.
    Retourne un float, ou None pour effacer la coordonnée (valeur absente ou chaîne vide).
    Sans ce contrôle, une valeur comme "abc" partait jusqu'à la base et produisait une 500.
    """
    if valeur is None or (isinstance(valeur, str) and not valeur.strip()):
        return None
    try:
        nombre = float(valeur)
    except (TypeError, ValueError):
        raise ParametreInvalide(f"{nom} invalide -- attendu un nombre décimal.")
    if not math.isfinite(nombre) or not -limite <= nombre <= limite:
        raise ParametreInvalide(f"{nom} hors limites (entre -{limite} et {limite}).")
    return nombre


def valider_services(valeur):
    """
    Valide la liste de services envoyée par le pharmacien : une liste de codes appartenant au
    vocabulaire de tenants.models.SERVICES_MARKETPLACE. Retourne la liste sans doublons, dans
    l'ordre fourni. Un code inconnu est REFUSÉ (400) plutôt qu'ignoré : l'accepter en silence
    laisserait le pharmacien croire qu'un service est affiché alors qu'il ne l'est pas.
    """
    from tenants.models import CODES_SERVICES_MARKETPLACE

    if valeur is None:
        return []
    if not isinstance(valeur, (list, tuple)):
        raise ParametreInvalide("services doit être une liste de codes.")
    codes = []
    for code in valeur:
        if code not in CODES_SERVICES_MARKETPLACE:
            raise ParametreInvalide(
                f"Service inconnu : {code!r}. Codes valides : {', '.join(CODES_SERVICES_MARKETPLACE)}."
            )
        if code not in codes:
            codes.append(code)
    return codes


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance à vol d'oiseau entre deux points GPS, en kilomètres (formule de Haversine)."""
    rayon_terre_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return rayon_terre_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _horaires_par_jour(pharmacie):
    """{jour_semaine: HoraireOuverture} -- lit le préchargement, voir l'en-tête du module."""
    return {h.jour_semaine: h for h in pharmacie.horaires.all()}


def _plage(horaire):
    """(ouverture, fermeture) d'un jour, ou None si fermé / heures incomplètes."""
    if horaire is None or horaire.ferme or not horaire.heure_ouverture or not horaire.heure_fermeture:
        return None
    return horaire.heure_ouverture, horaire.heure_fermeture


def est_ouvert_maintenant(pharmacie, maintenant=None) -> bool | None:
    """
    True/False si on peut déterminer le statut, None UNIQUEMENT si la pharmacie n'a renseigné
    aucun horaire (ni ouvert_24h, ni aucune ligne HoraireOuverture) -- le frontend peut alors
    afficher "horaires non communiqués" plutôt qu'un "Fermé" trompeur.

    Un jour sans ligne alors que d'AUTRES jours sont renseignés compte comme FERMÉ : une
    pharmacie qui saisit Lun-Sam veut dire fermé le dimanche, pas "horaires inconnus le dimanche".

    ⚠️ LIMITES CONNUES :
    - Utilise l'heure serveur (TIME_ZONE = 'Africa/Douala', settings.py), pas le fuseau réel
      de la pharmacie. Correct pour la zone CEMAC (marché actuel) ; à revoir si des
      pharmacies d'un autre fuseau sont onboardées (pas de fuseau par pharmacie stocké).
    - Une plage qui passe minuit (ex. 22:00 -> 06:00) n'est pas gérée : utiliser `ouvert_24h`.
    """
    if pharmacie.ouvert_24h:
        return True

    par_jour = _horaires_par_jour(pharmacie)
    if not par_jour:
        return None

    maintenant = maintenant or timezone.localtime()
    plage = _plage(par_jour.get(maintenant.weekday()))
    if plage is None:
        return False
    return plage[0] <= maintenant.time() <= plage[1]


def prochain_changement(pharmacie, maintenant=None) -> dict | None:
    """
    Prochain changement de statut, pour afficher "Ouvert jusqu'à 20:00" ou "Ouvre à 08:30" :

        {"type": "fermeture" | "ouverture", "heure": "20:00",
         "jour_semaine": 0..6 (0 = lundi), "aujourdhui": True | False}

    None si le statut ne change jamais (H24) ou s'il est inconnu (aucun horaire renseigné).
    Le frontend formate lui-même le texte (traduction, "demain", nom du jour).
    """
    if pharmacie.ouvert_24h:
        return None
    par_jour = _horaires_par_jour(pharmacie)
    if not par_jour:
        return None

    maintenant = maintenant or timezone.localtime()
    aujourdhui = maintenant.weekday()
    heure = maintenant.time()

    plage = _plage(par_jour.get(aujourdhui))
    if plage:
        ouverture, fermeture = plage
        if ouverture <= heure <= fermeture:
            return {"type": "fermeture", "heure": fermeture.strftime("%H:%M"),
                    "jour_semaine": aujourdhui, "aujourdhui": True}
        if heure < ouverture:
            return {"type": "ouverture", "heure": ouverture.strftime("%H:%M"),
                    "jour_semaine": aujourdhui, "aujourdhui": True}

    # Fermé pour aujourd'hui : prochain jour ouvert. decalage=7 retombe sur le même jour de
    # la semaine suivante (cas d'une pharmacie ouverte un seul jour par semaine).
    for decalage in range(1, 8):
        jour = (aujourdhui + decalage) % 7
        plage = _plage(par_jour.get(jour))
        if plage:
            return {"type": "ouverture", "heure": plage[0].strftime("%H:%M"),
                    "jour_semaine": jour, "aujourdhui": False}
    return None


def resume_horaires(pharmacie) -> list[dict]:
    """
    Horaires regroupés par jours consécutifs identiques, pour la ligne "Lun-Sam : 8h30 - 20h00" :

        [{"jour_debut": 0, "jour_fin": 5, "ouverture": "08:30", "fermeture": "20:00"}, ...]

    Les jours fermés ou sans horaire sont omis. Liste vide pour une pharmacie H24 (le frontend
    se base alors sur `ouvert_24h`). Le frontend formate les noms de jours et les heures.
    """
    if pharmacie.ouvert_24h:
        return []
    par_jour = _horaires_par_jour(pharmacie)
    groupes = []
    for jour in range(7):
        plage = _plage(par_jour.get(jour))
        if plage is None:
            continue
        ouverture, fermeture = plage[0].strftime("%H:%M"), plage[1].strftime("%H:%M")
        dernier = groupes[-1] if groupes else None
        if (dernier and dernier["jour_fin"] == jour - 1
                and dernier["ouverture"] == ouverture and dernier["fermeture"] == fermeture):
            dernier["jour_fin"] = jour
        else:
            groupes.append({"jour_debut": jour, "jour_fin": jour,
                            "ouverture": ouverture, "fermeture": fermeture})
    return groupes
