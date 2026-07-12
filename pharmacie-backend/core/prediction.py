"""
📊 MOTEUR DE PRÉDICTION DE STOCK — STATISTIQUES CLASSIQUES UNIQUEMENT

Décision d'architecture ferme (voir PROMPT_REPRISE.md) : la prédiction de stock repose
sur des méthodes statistiques classiques (moyenne mobile, régression linéaire, lissage
exponentiel de Holt), JAMAIS sur un LLM ou un modèle de machine learning entraîné.

Ce module est volontairement 100% PUR PYTHON (aucun import Django, aucun accès base
de données) : il ne fait que des calculs sur des séries numériques déjà construites.
Cela permet de le tester unitairement en quelques millisecondes, sans Postgres, Redis,
ni aucune dépendance externe (numpy/pandas/scipy) — juste la stdlib.

Le pont avec la base de données (récupération des `Mouvement_stock` réels) vit dans
`core/services_prediction.py`, qui appelle les fonctions ci-dessous.

Méthodes utilisées et pourquoi :
- Moyenne mobile (7j / 30j) : donne un rythme de consommation récent, lisible et
  robuste aux variations ponctuelles d'un seul jour.
- Régression linéaire (moindres carrés) : détecte une tendance de fond (hausse ou
  baisse progressive de la demande) que la moyenne mobile seule ne révèle pas.
- Lissage exponentiel double (méthode de Holt) : combine niveau + tendance pour
  produire une prévision jour par jour sur l'horizon demandé — c'est la référence
  académique standard en prévision de série temporelle courte, sans saisonnalité
  complexe à modéliser (adapté à une pharmacie qui n'a pas des années d'historique).
- Stock de sécurité par z-score : approche statistique classique de gestion de stock
  (formule du point de commande), qui traduit la VARIABILITÉ de la demande (écart-type)
  en un coussin de sécurité proportionné au niveau de service souhaité.
"""

import math
import statistics
from datetime import date, timedelta


# 🔧 Paramètres par défaut, ajustables sans casser la logique
LOOKBACK_JOURS_DEFAUT = 90          # Fenêtre d'historique analysée
LEAD_TIME_JOURS_DEFAUT = 7          # Délai de réapprovisionnement fournisseur supposé
ALPHA_HOLT_DEFAUT = 0.3             # Poids du niveau (réactivité aux données récentes)
BETA_HOLT_DEFAUT = 0.15             # Poids de la tendance
PHI_AMORTISSEMENT_DEFAUT = 0.90     # Facteur d'amortissement de la tendance (méthode de Holt amortie)
Z_SERVICE_95 = 1.65                 # Niveau de service ~95% (loi normale, table classique)
MIN_JOURS_HISTORIQUE = 14           # En dessous, la prédiction est jugée peu fiable


def construire_serie_journaliere(mouvements_sortie, date_debut, date_fin):
    """
    Transforme une liste de mouvements de sortie [(date, quantite), ...] en une série
    journalière COMPLÈTE (un point par jour, 0 inclus pour les jours sans vente).

    Remplir les jours sans vente à 0 est essentiel : un produit vendu 5 unités un
    seul jour sur 90 n'a pas du tout le même rythme de consommation qu'un produit
    vendu 5 unités chaque jour — et une simple moyenne sur les seuls jours "actifs"
    confondrait les deux.

    Retourne une liste ordonnée par date croissante de floats (quantités/jour).
    """
    totaux_par_jour = {}
    for jour, quantite in mouvements_sortie:
        totaux_par_jour[jour] = totaux_par_jour.get(jour, 0) + quantite

    serie = []
    jour_courant = date_debut
    while jour_courant <= date_fin:
        serie.append(float(totaux_par_jour.get(jour_courant, 0)))
        jour_courant += timedelta(days=1)
    return serie


def moyenne_mobile(serie, fenetre):
    """Moyenne des `fenetre` dernières valeurs de la série. None si pas assez de données."""
    if len(serie) < 1:
        return None
    fenetre_reelle = min(fenetre, len(serie))
    return statistics.fmean(serie[-fenetre_reelle:])


def regression_lineaire(y):
    """
    Régression linéaire simple (moindres carrés) sur y = pente*x + ordonnee, avec
    x = 0, 1, 2, ... (indices des jours). Retourne (pente, ordonnee_origine).

    Implémentation manuelle (formules fermées) pour ne dépendre d'aucune librairie
    scientifique externe :
        pente = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)
        ordonnee = (Σy - pente·Σx) / n
    """
    n = len(y)
    if n < 2:
        return 0.0, (y[0] if y else 0.0)

    x = list(range(n))
    somme_x = sum(x)
    somme_y = sum(y)
    somme_xy = sum(xi * yi for xi, yi in zip(x, y))
    somme_x2 = sum(xi * xi for xi in x)

    denominateur = (n * somme_x2) - (somme_x ** 2)
    if denominateur == 0:
        return 0.0, (somme_y / n)

    pente = ((n * somme_xy) - (somme_x * somme_y)) / denominateur
    ordonnee = (somme_y - pente * somme_x) / n
    return pente, ordonnee


def lissage_holt(serie, alpha=ALPHA_HOLT_DEFAUT, beta=BETA_HOLT_DEFAUT):
    """
    Lissage exponentiel double (méthode de Holt) : calcule un niveau et une tendance
    lissés à partir d'une série journalière, en donnant plus de poids aux observations
    récentes (contrôlé par alpha/beta) qu'à l'historique lointain.

    Retourne (niveau, tendance) au dernier point observé.

    🔧 Initialisation ROBUSTE (importante) : des ventes de pharmacie sont des comptages
    entiers souvent faibles (1, 2, 3 unités/jour) avec beaucoup de variation d'un jour
    à l'autre. Initialiser le niveau sur le seul premier jour, et la tendance sur le
    seul premier écart (valeur[1]-valeur[0]), amplifierait ce bruit dès le départ.
    On initialise donc :
    - le niveau sur la MOYENNE des tout premiers jours disponibles,
    - la tendance sur la PENTE DE RÉGRESSION de ces mêmes premiers jours,
    ce qui donne un point de départ nettement plus stable avant que les mises à jour
    exponentielles ne prennent le relais.

    Référence : Holt (1957), méthode standard de lissage exponentiel avec tendance,
    largement utilisée en prévision de demande — aucune IA générative impliquée.
    """
    if not serie:
        return 0.0, 0.0
    if len(serie) == 1:
        return serie[0], 0.0

    taille_amorce = min(7, len(serie))
    amorce = serie[:taille_amorce]
    niveau = statistics.fmean(amorce)
    tendance = regression_lineaire(amorce)[0] if taille_amorce >= 2 else 0.0

    for valeur in serie[1:]:
        niveau_precedent = niveau
        niveau = alpha * valeur + (1 - alpha) * (niveau_precedent + tendance)
        tendance = beta * (niveau - niveau_precedent) + (1 - beta) * tendance

    return niveau, tendance


def construire_serie_hebdomadaire(serie_journaliere):
    """
    Agrège une série journalière en série HEBDOMADAIRE (somme sur des blocs de 7 jours),
    alignée sur la FIN de la série pour que les semaines les plus récentes soient toujours
    complètes (le reliquat de jours en trop, s'il y en a, est écarté en DÉBUT de série).

    Pourquoi : une pharmacie vend des quantités souvent faibles et irrégulières au jour
    le jour (0 unité un jour, 8 le lendemain, pour le même produit) -- un lissage
    journalier brut réagit fortement à un simple jour sans vente ou à un pic isolé.
    Le rythme HEBDOMADAIRE, lui, est beaucoup plus stable et représentatif du vrai rythme
    de consommation, tout en restant assez fin pour capter une tendance qui évolue sur
    plusieurs semaines. C'est une pratique standard en prévision de demande "grumeleuse"
    (lumpy/intermittent demand) à faible volume.
    """
    n = len(serie_journaliere)
    if n == 0:
        return []
    reste = n % 7
    serie_alignee = serie_journaliere[reste:] if reste else serie_journaliere
    return [
        sum(serie_alignee[i:i + 7])
        for i in range(0, len(serie_alignee), 7)
    ]


def predire_consommation_future(serie, horizon_jours, alpha=ALPHA_HOLT_DEFAUT, beta=BETA_HOLT_DEFAUT,
                                 phi=PHI_AMORTISSEMENT_DEFAUT):
    """
    Projette la consommation journalière prévue sur `horizon_jours` à venir.

    Méthode (dans l'ordre de préférence) :
    1. Si au moins 2 semaines complètes sont disponibles : Holt est appliqué sur la
       série HEBDOMADAIRE (voir `construire_serie_hebdomadaire`), avec TENDANCE AMORTIE
       (damped trend, Gardner & McKenzie 1985) : prevision_semaine(s) = niveau +
       (phi + phi² + ... + phiˢ) * tendance. Chaque semaine prévue est ensuite répartie
       uniformément sur ses 7 jours pour produire la série journalière retournée.
    2. Sinon (historique trop court pour une semaine complète, ex: nouveau produit) :
       repli sur un lissage journalier direct, dégradé mais toujours disponible.

    Pourquoi amortir la tendance : sur un historique court, une tendance linéaire pure
    (h * tendance) extrapole l'écart à l'infini et peut faire diverger la prévision de
    façon irréaliste sur un horizon de 30 jours. Le facteur phi<1 fait converger l'effet
    de la tendance vers zéro à mesure que l'horizon s'éloigne : la prévision tend alors
    vers le niveau lissé plutôt que de s'effondrer ou s'envoler indéfiniment.

    Bornée à 0 (une pharmacie ne "consomme" jamais en négatif).
    """
    semaines = construire_serie_hebdomadaire(serie)

    if len(semaines) >= 2:
        niveau, tendance = lissage_holt(semaines, alpha=alpha, beta=beta)
        nb_semaines_necessaires = math.ceil(horizon_jours / 7)
        previsions = []
        facteur_cumule = 0.0
        puissance_phi = phi
        for _s in range(nb_semaines_necessaires):
            facteur_cumule += puissance_phi
            puissance_phi *= phi
            valeur_semaine = max(0.0, niveau + facteur_cumule * tendance)
            previsions.extend([valeur_semaine / 7.0] * 7)
        return previsions[:horizon_jours]

    # Repli : historique trop court pour dégager ne serait-ce que 2 semaines complètes
    niveau, tendance = lissage_holt(serie, alpha=alpha, beta=beta)
    previsions = []
    facteur_cumule = 0.0
    puissance_phi = phi
    for _h in range(horizon_jours):
        facteur_cumule += puissance_phi
        puissance_phi *= phi
        previsions.append(max(0.0, niveau + facteur_cumule * tendance))
    return previsions


def calculer_ecart_type(serie):
    """Écart-type de la série (variabilité de la demande). 0 si moins de 2 points."""
    if len(serie) < 2:
        return 0.0
    return statistics.pstdev(serie)


def evaluer_fiabilite(nb_jours_historique, ecart_type_demande, moyenne_demande):
    """
    Traduit la qualité statistique de la prédiction en un indicateur lisible pour
    l'utilisateur métier (pas juste un chiffre brut) : "insuffisante", "faible",
    "moyenne" ou "haute", basé sur (1) la quantité de données disponibles et
    (2) le coefficient de variation (écart-type / moyenne) de la demande.
    """
    if nb_jours_historique < MIN_JOURS_HISTORIQUE:
        return "insuffisante"

    if moyenne_demande <= 0:
        return "insuffisante"

    coefficient_variation = ecart_type_demande / moyenne_demande

    if nb_jours_historique >= 60 and coefficient_variation < 0.5:
        return "haute"
    if nb_jours_historique >= 30 and coefficient_variation < 1.0:
        return "moyenne"
    return "faible"


def calculer_prediction_produit(
    serie_journaliere,
    quantite_stock_actuelle,
    seuil_alerte,
    lead_time_jours=LEAD_TIME_JOURS_DEFAUT,
    service_level_z=Z_SERVICE_95,
    horizon_prevision_jours=30,
):
    """
    Point d'entrée principal : combine toutes les méthodes ci-dessus pour produire
    une prédiction complète et exploitable pour UN produit.

    `serie_journaliere` : liste de floats (une valeur par jour, jours sans vente = 0),
    déjà construite par `construire_serie_journaliere` (ou équivalent pour les tests).

    Retourne un dictionnaire avec :
    - consommation_moy_7j / consommation_moy_30j : rythme récent
    - tendance_jour : pente de la régression linéaire (unités/jour, + ou -)
    - previsions_journalieres : liste des consommations prédites sur l'horizon demandé
    - consommation_prevue_lead_time : total prévu pendant le délai de réappro
    - stock_securite : coussin statistique (z-score × écart-type × racine(lead_time))
    - point_de_commande : seuil à partir duquel il faut recommander
    - quantite_a_commander : quantité suggérée pour ne pas descendre sous le point de commande
    - jours_avant_rupture : nombre de jours avant que le stock actuel touche 0 (None = pas de risque au rythme actuel)
    - fiabilite : "insuffisante" / "faible" / "moyenne" / "haute"
    """
    nb_jours_historique = len(serie_journaliere)
    moyenne_30j = moyenne_mobile(serie_journaliere, 30)
    moyenne_7j = moyenne_mobile(serie_journaliere, 7)
    ecart_type_demande = calculer_ecart_type(serie_journaliere)

    pente, _ordonnee = regression_lineaire(serie_journaliere) if nb_jours_historique >= 2 else (0.0, 0.0)

    previsions = predire_consommation_future(serie_journaliere, horizon_prevision_jours)
    consommation_prevue_lead_time = sum(previsions[:lead_time_jours])

    # 🧮 Stock de sécurité classique : z * σ_journalier * √(délai de livraison).
    # La racine carrée du lead time vient de la propriété d'additivité des variances
    # pour des demandes journalières indépendantes (formule standard de gestion de stock).
    stock_securite = service_level_z * ecart_type_demande * math.sqrt(max(lead_time_jours, 0))
    stock_securite = max(stock_securite, seuil_alerte)  # jamais en dessous du seuil métier déjà fixé

    point_de_commande = consommation_prevue_lead_time + stock_securite
    quantite_a_commander = max(0, round(point_de_commande - quantite_stock_actuelle))

    # ⏳ Simulation jour par jour du stock actuel avec les prévisions, pour estimer
    # concrètement la date de rupture (plus parlant qu'un simple ratio stock/moyenne
    # quand il y a une tendance à la hausse ou à la baisse).
    stock_simule = float(quantite_stock_actuelle)
    jours_avant_rupture = None
    for jour_index, consommation_du_jour in enumerate(previsions, start=1):
        stock_simule -= consommation_du_jour
        if stock_simule <= 0:
            jours_avant_rupture = jour_index
            break

    fiabilite = evaluer_fiabilite(nb_jours_historique, ecart_type_demande, moyenne_30j or 0.0)

    return {
        "consommation_moy_7j": round(moyenne_7j, 2) if moyenne_7j is not None else 0.0,
        "consommation_moy_30j": round(moyenne_30j, 2) if moyenne_30j is not None else 0.0,
        "ecart_type_demande": round(ecart_type_demande, 2),
        "tendance_jour": round(pente, 3),
        "previsions_journalieres": [round(v, 2) for v in previsions],
        "consommation_prevue_lead_time": round(consommation_prevue_lead_time, 2),
        "lead_time_jours": lead_time_jours,
        "stock_securite": round(stock_securite, 2),
        "point_de_commande": round(point_de_commande, 2),
        "stock_actuel": quantite_stock_actuelle,
        "quantite_a_commander": quantite_a_commander,
        "jours_avant_rupture": jours_avant_rupture,
        "fiabilite": fiabilite,
        "nb_jours_historique": nb_jours_historique,
    }
