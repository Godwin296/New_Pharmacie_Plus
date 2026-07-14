from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Produit, ProduitSupprimeLog


@receiver(post_delete, sender=Produit)
def tracer_suppression_produit(sender, instance, **kwargs):
    """
    🚀 MODE OFFLINE (session 12/07) : chaque suppression d'un Produit (admin Django ou future
    API) laisse une trace dans ProduitSupprimeLog, consommée par /api/catalogue/sync/ pour que
    les clients ayant mis le catalogue en cache (IndexedDB) sachent retirer ce produit de leur
    copie locale, même hors-ligne au moment de la suppression réelle côté serveur.
    """
    ProduitSupprimeLog.objects.create(produit_id=instance.id)
