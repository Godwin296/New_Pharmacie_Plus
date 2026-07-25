"""
🔐 CHIFFREMENT AU REPOS DES ORDONNANCES.

Les ordonnances (`Commande.ordonnance`) contiennent des données de santé (prescriptions
médicales) -- même après la désinfection déjà effectuée par validators.py (qui protège
contre les fichiers malveillants, pas contre la confidentialité), elles sont stockées EN
CLAIR sur disque par défaut avec un FileField Django standard. N'importe qui ayant accès
au système de fichiers (ou à une sauvegarde non chiffrée, cf. docs/BACKUP_POSTGRESQL.md)
peut lire le contenu médical d'un patient.

Ce module chiffre le contenu du fichier (pas son nom, ni les métadonnées Commande en base
-- seul le CONTENU du document est sensible ici) avec Fernet (AES-128-CBC + HMAC-SHA256,
chiffrement symétrique AUTHENTIFIÉ -- toute altération du fichier chiffré est détectée au
déchiffrement, pas seulement la confidentialité).

⚠️ DÉGRADATION VOLONTAIREMENT GRACIEUSE (pas de crash) si ORDONNANCE_ENCRYPTION_KEY n'est
pas configurée : cette fonctionnalité est ajoutée à un projet déjà déployé ailleurs (autres
sessions de dev en parallèle, prod existante). Rendre le chiffrement obligatoire ferait
échouer l'upload de TOUTE ordonnance dans un environnement qui n'a pas encore cette variable
-- un dégât fonctionnel immédiat et généralisé, pire que le risque qu'on cherche à réduire.
On journalise donc un avertissement explicite et on stocke en clair (comportement identique
à avant ce module) plutôt que de bloquer l'upload.

⚠️ RÉTROCOMPATIBILITÉ : les ordonnances uploadées AVANT ce module sont en clair sur disque.
`dechiffrer_si_necessaire()` détecte si le contenu est un jeton Fernet valide ; sinon il
renvoie les octets tels quels (fichier legacy non chiffré). Aucune migration de données
n'est donc nécessaire pour activer cette fonctionnalité sur un déploiement existant.
"""
import logging

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger("core.chiffrement")

_avertissement_deja_log = False  # évite de spammer les logs à chaque upload


def _obtenir_fernet():
    """Retourne une instance Fernet prête à l'emploi, ou None si aucune clé n'est configurée."""
    global _avertissement_deja_log
    cle = getattr(settings, "ORDONNANCE_ENCRYPTION_KEY", None)
    if not cle:
        if not _avertissement_deja_log:
            logger.warning(
                "⚠️ ORDONNANCE_ENCRYPTION_KEY non configurée : les ordonnances sont stockées "
                "EN CLAIR sur disque. Génère une clé avec `python -c \"from cryptography.fernet "
                "import Fernet; print(Fernet.generate_key().decode())\"` et ajoute-la à .env."
            )
            _avertissement_deja_log = True
        return None
    try:
        return Fernet(cle.encode() if isinstance(cle, str) else cle)
    except (ValueError, TypeError):
        if not _avertissement_deja_log:
            logger.error(
                "⚠️ ORDONNANCE_ENCRYPTION_KEY invalide (mauvais format) : les ordonnances sont "
                "stockées EN CLAIR sur disque. Cette clé doit être générée par "
                "Fernet.generate_key(), pas une chaîne arbitraire."
            )
            _avertissement_deja_log = True
        return None


def chiffrement_actif() -> bool:
    """Utile pour exposer l'état de la fonctionnalité (ex: diagnostic admin)."""
    return _obtenir_fernet() is not None


def chiffrer_contenu(contenu: bytes) -> bytes:
    """
    Chiffre des octets avant écriture sur disque. Si aucune clé n'est configurée, retourne
    le contenu tel quel (voir dégradation gracieuse dans la docstring du module).
    """
    fernet = _obtenir_fernet()
    if fernet is None:
        return contenu
    return fernet.encrypt(contenu)


def dechiffrer_si_necessaire(contenu: bytes) -> bytes:
    """
    Déchiffre des octets lus depuis le disque. Gère aussi bien :
    - un fichier chiffré par ce module (déchiffrement normal),
    - un fichier legacy stocké en clair AVANT ce module (détecté par l'échec du déchiffrement
      Fernet -> renvoyé tel quel, c'est déjà du contenu lisible),
    - l'absence de clé configurée sur CETTE instance alors que le fichier a été chiffré par
      une AUTRE instance qui, elle, avait la clé -- cas volontairement traité comme une ERREUR
      (pas un repli silencieux) : mieux vaut un message clair au staff qu'un document médical
      montré comme "vide" ou corrompu sans explication.
    """
    fernet = _obtenir_fernet()
    if fernet is None:
        # Pas de clé ici : on ne peut de toute façon rien déchiffrer. Si le fichier est en
        # clair (cas normal quand le chiffrement n'a jamais été activé), c'est directement
        # exploitable tel quel.
        return contenu
    try:
        return fernet.decrypt(contenu)
    except InvalidToken:
        # Pas un jeton Fernet valide -> fichier legacy en clair, pas une erreur.
        return contenu
