"""
📈 ANALYTICS AVANCÉ DU DASHBOARD ADMIN

Logique de calcul isolée de la couche HTTP (core/api.py::api_boss_analytics) pour pouvoir
être testée directement. Toutes les fonctions travaillent sur le schéma tenant COURANT
(django-tenants positionne le search_path avant l'appel).

Conventions :
- Une "vente" = commande avec payee=True (même définition que api_boss_dashboard).
- Chiffre d'affaires d'une ligne = quantite * prix_facture (prix figé à la vente), avec
  repli sur Produit.prix si prix_facture est NULL (anciennes lignes).
- Coût d'une ligne = prix_achat_facture (figé à la vente), avec repli sur
  Produit.prix_achat ACTUEL pour les lignes antérieures à ce champ. Si les deux sont NULL,
  le coût est INCONNU : la ligne est exclue du calcul de marge (jamais comptée "coût = 0",
  ce qui gonflerait artificiellement le profit). `couverture_marge_pct` indique la part du
  CA pour laquelle la marge est réellement calculable -- à afficher à côté de la marge.
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import (
    Count, DecimalField, ExpressionWrapper, F, Q, Sum,
)
from django.db.models.functions import Coalesce, ExtractHour
from django.utils import timezone

from .models import Commande, ItemCommande, Produit

DECIMAL_OUT = DecimalField(max_digits=16, decimal_places=2)

# Libellés lisibles des moyens d'encaissement. Un encaissement au guichet n'a pas de
# `moyen_paiement` (champ réservé au paiement mobile en ligne) : c'est du cash comptoir.
LIBELLES_PAIEMENT = {
    'cash_guichet': 'Cash (guichet)',
    'orange_money': 'Orange Money',
    'mtn_momo': 'MTN MoMo',
    'inconnu': 'Non renseigné',
}

DUREE_MAX_JOURS = 366


def bornes_datetime(debut, fin):
    """(date, date) inclusives -> (datetime début inclus, datetime fin EXCLUE), fuseau courant."""
    tz = timezone.get_current_timezone()
    d0 = timezone.make_aware(datetime.combine(debut, time.min), tz)
    d1 = timezone.make_aware(datetime.combine(fin + timedelta(days=1), time.min), tz)
    return d0, d1


def periode_precedente(debut, fin):
    """Période de même durée, immédiatement avant `debut`."""
    nb_jours = (fin - debut).days + 1
    prec_fin = debut - timedelta(days=1)
    prec_debut = prec_fin - timedelta(days=nb_jours - 1)
    return prec_debut, prec_fin


def _ca_expr():
    prix = Coalesce(F('prix_facture'), F('produit__prix'), output_field=DECIMAL_OUT)
    return ExpressionWrapper(F('quantite') * prix, output_field=DECIMAL_OUT)


def _items_vendus(debut, fin):
    d0, d1 = bornes_datetime(debut, fin)
    return ItemCommande.objects.filter(
        commande__payee=True, commande__date__gte=d0, commande__date__lt=d1,
    )


def _variation_pct(courant, precedent):
    """None si la période précédente vaut 0 (variation non définie, pas "+infini %")."""
    precedent = Decimal(precedent or 0)
    if precedent == 0:
        return None
    return round(float((Decimal(courant or 0) - precedent) / precedent * 100), 1)


def indicateurs_periode(debut, fin):
    """CA, nb commandes, panier moyen, marge et couverture pour une période."""
    items = _items_vendus(debut, fin)
    cout_unitaire = Coalesce(
        F('prix_achat_facture'), F('produit__prix_achat'), output_field=DECIMAL_OUT,
    )
    lignes = items.annotate(
        ca_ligne=_ca_expr(),
        cout_unit=cout_unitaire,
    ).annotate(
        # NULL propagé volontairement : coût inconnu -> marge de la ligne inconnue.
        marge_ligne=ExpressionWrapper(
            F('ca_ligne') - F('quantite') * F('cout_unit'), output_field=DECIMAL_OUT,
        ),
    )
    agg = lignes.aggregate(
        ca=Sum('ca_ligne'),
        marge=Sum('marge_ligne'),  # SUM ignore les NULL
        ca_avec_cout=Sum('ca_ligne', filter=Q(cout_unit__isnull=False)),
    )
    ca = agg['ca'] or Decimal('0')
    marge = agg['marge'] or Decimal('0')
    ca_avec_cout = agg['ca_avec_cout'] or Decimal('0')

    d0, d1 = bornes_datetime(debut, fin)
    nb_commandes = Commande.objects.filter(payee=True, date__gte=d0, date__lt=d1).count()

    return {
        'ca': ca,
        'nb_commandes': nb_commandes,
        'panier_moyen': (ca / nb_commandes) if nb_commandes else Decimal('0'),
        'marge': marge,
        # Taux calculé sur le seul CA dont le coût est connu, sinon une marge partielle
        # serait diluée par du CA sans coût et paraîtrait artificiellement basse.
        'taux_marge_pct': float(marge / ca_avec_cout * 100) if ca_avec_cout else None,
        'couverture_marge_pct': float(ca_avec_cout / ca * 100) if ca else None,
    }


def kpis_avec_comparaison(debut, fin):
    cur = indicateurs_periode(debut, fin)
    p_debut, p_fin = periode_precedente(debut, fin)
    prec = indicateurs_periode(p_debut, p_fin)

    def bloc(cle):
        return {
            'valeur': cur[cle],
            'precedent': prec[cle],
            'variation_pct': _variation_pct(cur[cle], prec[cle]),
        }

    return {
        'periode': {'debut': debut, 'fin': fin},
        'periode_precedente': {'debut': p_debut, 'fin': p_fin},
        'ca': bloc('ca'),
        'nb_commandes': bloc('nb_commandes'),
        'panier_moyen': bloc('panier_moyen'),
        'marge': bloc('marge'),
        'taux_marge_pct': cur['taux_marge_pct'],
        'couverture_marge_pct': cur['couverture_marge_pct'],
    }


def repartition_paiement(debut, fin):
    """CA et nombre de commandes par moyen d'encaissement."""
    lignes = _items_vendus(debut, fin).annotate(ca_ligne=_ca_expr()).values(
        'commande__type_vente', 'commande__moyen_paiement',
    ).annotate(
        ca=Sum('ca_ligne'),
        nb=Count('commande', distinct=True),
    )
    cumul = {}
    for l in lignes:
        if l['commande__moyen_paiement']:
            cle = l['commande__moyen_paiement']
        elif l['commande__type_vente'] == 'guichet':
            cle = 'cash_guichet'
        else:
            cle = 'inconnu'
        c = cumul.setdefault(cle, {'ca': Decimal('0'), 'nb_commandes': 0})
        c['ca'] += l['ca'] or Decimal('0')
        c['nb_commandes'] += l['nb']
    total = sum((c['ca'] for c in cumul.values()), Decimal('0'))
    return sorted(
        [{
            'moyen': cle,
            'libelle': LIBELLES_PAIEMENT.get(cle, cle),
            'ca': c['ca'],
            'nb_commandes': c['nb_commandes'],
            'part_pct': round(float(c['ca'] / total * 100), 1) if total else 0.0,
        } for cle, c in cumul.items()],
        key=lambda x: x['ca'], reverse=True,
    )


def repartition_categories(debut, fin, limite=10):
    libelles = dict(Produit.CATEGORIES)
    lignes = _items_vendus(debut, fin).annotate(ca_ligne=_ca_expr()).values(
        'produit__categorie',
    ).annotate(ca=Sum('ca_ligne'), quantite=Sum('quantite')).order_by('-ca')[:limite]
    total = _items_vendus(debut, fin).annotate(ca_ligne=_ca_expr()).aggregate(t=Sum('ca_ligne'))['t'] or Decimal('0')
    return [{
        'categorie': l['produit__categorie'],
        'libelle': libelles.get(l['produit__categorie'], l['produit__categorie']).strip(),
        'ca': l['ca'] or Decimal('0'),
        'quantite': l['quantite'] or 0,
        'part_pct': round(float((l['ca'] or 0) / total * 100), 1) if total else 0.0,
    } for l in lignes]


def heures_de_pointe(debut, fin):
    """Activité par heure locale (0-23). Les 24 heures sont toujours présentes (zéros inclus)."""
    d0, d1 = bornes_datetime(debut, fin)
    # ExtractHour convertit dans le fuseau courant (USE_TZ=True) -> heure locale, pas UTC.
    par_heure = {h: {'heure': h, 'nb_commandes': 0, 'ca': Decimal('0')} for h in range(24)}
    lignes = _items_vendus(debut, fin).annotate(
        heure=ExtractHour('commande__date'), ca_ligne=_ca_expr(),
    ).values('heure').annotate(ca=Sum('ca_ligne'), nb=Count('commande', distinct=True))
    for l in lignes:
        par_heure[l['heure']]['nb_commandes'] = l['nb']
        par_heure[l['heure']]['ca'] = l['ca'] or Decimal('0')
    liste = [par_heure[h] for h in range(24)]
    pic = max(liste, key=lambda x: (x['nb_commandes'], x['ca']))
    return {
        'par_heure': liste,
        'heure_de_pointe': pic['heure'] if pic['nb_commandes'] else None,
    }


def produits_dormants(debut, fin, limite=10):
    """
    Rotation de stock : produits EN STOCK sans aucune vente sur la période, classés par
    valeur immobilisée (coût d'achat si connu, sinon prix de vente).
    """
    vendus = _items_vendus(debut, fin).values_list('produit_id', flat=True).distinct()
    valeur = ExpressionWrapper(
        F('quantite') * Coalesce(F('prix_achat'), F('prix'), output_field=DECIMAL_OUT),
        output_field=DECIMAL_OUT,
    )
    qs = Produit.objects.filter(quantite__gt=0).exclude(id__in=vendus).annotate(
        valeur_stock=valeur,
    ).order_by('-valeur_stock')[:limite]
    return [{
        'id': p.id, 'nom': p.nom, 'quantite': p.quantite,
        'valeur_stock': p.valeur_stock,
        'cout_connu': p.prix_achat is not None,
    } for p in qs]


def analytics_complets(debut, fin):
    return {
        **kpis_avec_comparaison(debut, fin),
        'repartition_paiement': repartition_paiement(debut, fin),
        'repartition_categories': repartition_categories(debut, fin),
        'heures': heures_de_pointe(debut, fin),
        'produits_dormants': produits_dormants(debut, fin),
    }
