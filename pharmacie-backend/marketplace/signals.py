"""
Synchronise tenants.Pharmacie (miroir marketplace, schéma public) à chaque sauvegarde de
core.PharmacieConfig (schéma tenant) -- voir le commentaire sur ces champs dans
tenants/models.py pour le POURQUOI (pas de jointure cross-schéma possible côté marketplace).

Le pharmacien ne touche jamais ce miroir directement : il édite sa config comme avant sur
/admin/settings, ce signal recopie juste nom/logo/adresse/telephone vers le schéma public.
"""
import logging

from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="core.PharmacieConfig")
def synchroniser_miroir_marketplace(sender, instance, **kwargs):
    schema = getattr(connection, "schema_name", "public")
    if schema == "public":
        # Ne devrait jamais arriver (PharmacieConfig est un TENANT_APP, toujours sauvegardé
        # dans le schéma d'une pharmacie précise) -- filet de sécurité pour un script one-off.
        return

    from tenants.models import Pharmacie

    try:
        pharmacie = Pharmacie.objects.get(schema_name=schema)
    except Pharmacie.DoesNotExist:
        logger.warning("Signal marketplace : aucune Pharmacie pour le schéma %r", schema)
        return

    pharmacie.nom_public = instance.nom
    pharmacie.adresse_public = instance.adresse
    pharmacie.telephone_public = instance.telephone
    # ⚠️ Le logo est un FieldFile attaché au champ `logo` de PharmacieConfig (stocké physiquement
    # dans MEDIA_ROOT, chemin relatif). On recopie juste le NOM du fichier -- assigner un FieldFile
    # d'un modèle à un autre fonctionne (même storage backend), pas besoin de relire les octets.
    pharmacie.logo_public = instance.logo
    pharmacie.save(update_fields=["nom_public", "adresse_public", "telephone_public", "logo_public"])
