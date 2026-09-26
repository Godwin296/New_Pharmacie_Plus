"""
Utilitaires de la marketplace : distance entre deux points GPS et statut "ouvert maintenant".

Pas de PostGIS ici (pas installé, pas nécessaire à l'échelle du projet -- centaines de
pharmacies, pas des millions) : une simple formule de Haversine en Python suffit très
largement pour trier une liste de résultats par proximité.
"""
import math
from datetime import time

from django.utils import timezone


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


def est_ouvert_maintenant(pharmacie) -> bool | None:
    """
    True/False si on peut déterminer le statut, None si aucune donnée d'horaire n'existe
    encore (ni ouvert_24h, ni HoraireOuverture renseigné pour ce jour) -- le frontend peut
    alors afficher "horaires non communiqués" plutôt qu'un "Fermé" trompeur.

    ⚠️ LIMITE CONNUE : utilise l'heure serveur (TIME_ZONE = 'Africa/Douala', settings.py),
    pas le fuseau horaire réel de la pharmacie. Correct pour la zone CEMAC (marché actuel),
    imprécis de 0-2h pour une pharmacie en Europe selon la saison (DST). Pas de correctif
    construit maintenant -- à revoir si/quand des pharmacies européennes sont réellement
    onboardées, pas avant (pas de fuseau par pharmacie stocké aujourd'hui).
    """
    if pharmacie.ouvert_24h:
        return True

    maintenant = timezone.localtime()
    jour_semaine = maintenant.weekday()  # 0 = lundi ... 6 = dimanche, même convention que HoraireOuverture.JOURS

    horaire = pharmacie.horaires.filter(jour_semaine=jour_semaine).first()
    if horaire is None:
        return None
    if horaire.ferme or not horaire.heure_ouverture or not horaire.heure_fermeture:
        return False

    heure_actuelle = maintenant.time()
    return horaire.heure_ouverture <= heure_actuelle <= horaire.heure_fermeture
