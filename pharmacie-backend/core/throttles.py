"""
🔐 Classes de rate limiting (throttling) dédiées à des endpoints précis et sensibles.

ScopedRateThrottle de DRF ne fonctionne nativement qu'avec des vues basées sur des classes
(attribut throttle_scope sur la classe). Pour des vues basées sur des fonctions (@api_view),
le pattern recommandé par la documentation officielle de DRF est de sous-classer directement
AnonRateThrottle/UserRateThrottle avec un `scope` fixe -- c'est ce que fait ce fichier.

Chaque scope ci-dessous doit avoir une entrée correspondante dans
config/settings.py -> REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    🔐 Limite stricte sur la tentative de connexion (api_login), basée sur l'IP -- la requête
    de login arrive forcément avant toute authentification, donc on ne peut throttler que par IP,
    pas par utilisateur. Limite volontairement basse : un humain qui se trompe deux ou trois fois
    de mot de passe ne l'atteindra jamais, mais un script de force brute sera bloqué très vite.
    """
    scope = 'login'


class SoumettrePaiementRateThrottle(UserRateThrottle):
    """
    🔐 Limite la fréquence à laquelle un client peut soumettre une référence de transaction
    mobile money pour vérification -- évite qu'un client (ou un bot) inonde la file d'attente
    de la caisse avec des dizaines de fausses références en quelques secondes.
    """
    scope = 'soumettre_paiement'
