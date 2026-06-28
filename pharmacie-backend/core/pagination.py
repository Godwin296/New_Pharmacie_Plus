from rest_framework.pagination import PageNumberPagination


class CataloguePagination(PageNumberPagination):
    """
    Pagination du catalogue produits.

    Avant cette classe, api_catalogue renvoyait TOUS les produits du tenant en une
    seule réponse JSON (Produit.objects.all() sans aucune limite). Sur une connexion
    3G/4G et avec un catalogue qui grossit (centaines de médicaments par pharmacie),
    ça représentait un payload de plus en plus lourd et un rendu de plus en plus lent
    côté client à chaque ouverture du catalogue.

    page_size=20 : valeur de départ raisonnable pour un affichage mobile (3-4 lignes
    de grille visibles avant scroll). Ajustable facilement ici si besoin plus tard.

    page_size_query_param permet au frontend de demander explicitement une autre
    taille de page via ?page_size=XX si un écran différent (desktop, export) en a
    besoin un jour, sans devoir créer une deuxième classe de pagination.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
