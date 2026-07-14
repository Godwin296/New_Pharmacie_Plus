"""
🔌 PONT ENTRE LA BASE DE DONNÉES ET LE MOTEUR DE PRÉDICTION (core/prediction.py).

Ce module contient toute la logique Django (requêtes ORM sur `Mouvement_stock`) et
délègue 100% des calculs statistiques au module pur `core.prediction`. Séparé
volontairement pour que `core.prediction` reste testable sans base de données
(cf. `core/tests_prediction.py`).
"""

from django.utils import timezone
from django.db.models import Sum
from django.db.models.functions import TruncDate

from .models import Produit, Mouvement_stock
from .prediction import (
    construire_serie_journaliere,
    calculer_prediction_produit,
    LOOKBACK_JOURS_DEFAUT,
    LEAD_TIME_JOURS_DEFAUT,
)


def _serie_journaliere_produit(produit, date_debut, date_fin):
    """
    Récupère les sorties de stock réelles (`Mouvement_stock` type='sortie') du produit
    sur la période, agrégées par jour, et les transforme en série journalière complète
    (jours sans vente = 0) via le moteur pur.
    """
    mouvements = (
        Mouvement_stock.objects
        .filter(produit=produit, type="sortie", date__date__gte=date_debut, date__date__lte=date_fin)
        .annotate(jour=TruncDate("date"))
        .values("jour")
        .annotate(total_jour=Sum("quantite"))
        .order_by("jour")
    )
    paires = [(m["jour"], m["total_jour"]) for m in mouvements]
    return construire_serie_journaliere(paires, date_debut, date_fin)


def predire_pour_produit(produit, lookback_jours=LOOKBACK_JOURS_DEFAUT, lead_time_jours=LEAD_TIME_JOURS_DEFAUT):
    """
    Calcule la prédiction complète d'UN produit à partir de son historique réel de
    mouvements de stock. Retourne le dictionnaire de `calculer_prediction_produit`,
    enrichi des informations d'identification du produit pour l'affichage frontend.
    """
    date_fin = timezone.now().date()
    date_debut = date_fin - timezone.timedelta(days=lookback_jours - 1)

    serie = _serie_journaliere_produit(produit, date_debut, date_fin)

    resultat = calculer_prediction_produit(
        serie_journaliere=serie,
        quantite_stock_actuelle=produit.quantite,
        seuil_alerte=produit.seuil_alerte,
        lead_time_jours=lead_time_jours,
    )
    resultat.update({
        "produit_id": produit.id,
        "produit_identifiant": produit.identifiant,
        "produit_nom": produit.nom,
    })
    return resultat


def predire_pour_tous_produits(lookback_jours=LOOKBACK_JOURS_DEFAUT, lead_time_jours=LEAD_TIME_JOURS_DEFAUT, alerte_uniquement=False):
    """
    Calcule la prédiction pour tous les produits du tenant courant. `alerte_uniquement=True`
    ne garde que les produits qui méritent réellement l'attention de l'admin : rupture
    prévue dans le délai de livraison, ou quantité à commander non nulle -- évite de noyer
    un catalogue de centaines de produits sous des lignes "rien à signaler".

    Résultat trié par urgence : rupture la plus proche en premier, produits sans risque
    en dernier.
    """
    predictions = [
        predire_pour_produit(produit, lookback_jours=lookback_jours, lead_time_jours=lead_time_jours)
        for produit in Produit.objects.all()
    ]

    if alerte_uniquement:
        predictions = [
            p for p in predictions
            if p["quantite_a_commander"] > 0
            or (p["jours_avant_rupture"] is not None and p["jours_avant_rupture"] <= p["lead_time_jours"])
        ]

    def cle_urgence(p):
        # None (pas de rupture prévue) doit passer APRÈS toute rupture chiffrée
        return (p["jours_avant_rupture"] is None, p["jours_avant_rupture"] or 0)

    predictions.sort(key=cle_urgence)
    return predictions
