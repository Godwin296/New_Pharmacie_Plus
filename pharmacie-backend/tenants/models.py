from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Pharmacie(TenantMixin):
    """
    🏥 Le TENANT du SaaS : chaque pharmacie cliente est une instance de ce modèle.
    Chaque Pharmacie possède son propre schéma PostgreSQL isolé, créé et géré
    automatiquement par django-tenants (auto_create_schema = True).

    Toutes les données métier (Produit, Commande, Client, etc. — l'app "core")
    vivent à l'intérieur du schéma de CHAQUE pharmacie : il est donc structurellement
    impossible pour la Pharmacie A de lire les données de la Pharmacie B, même en cas
    d'oubli de filtre dans une vue (contrairement à une isolation par simple colonne
    pharmacie_id, où une requête non filtrée peut fuiter entre clients).
    """

    nom = models.CharField(max_length=150, verbose_name="Nom de la pharmacie")
    proprietaire_email = models.EmailField(verbose_name="Email du titulaire / contact principal")
    proprietaire_telephone = models.CharField(max_length=20, blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)

    PLANS = [
        ('essai', 'Essai gratuit ⏳'),
        ('standard', 'Standard 💼'),
        ('pro', 'Pro 🚀'),
        ('suspendu', 'Suspendu ⛔'),
    ]
    plan = models.CharField(max_length=20, choices=PLANS, default='essai')
    actif = models.BooleanField(default=True, verbose_name="Compte actif")

    # 🔐 Création automatique du schéma PostgreSQL dès la sauvegarde de l'objet
    auto_create_schema = True
    auto_drop_schema = False  # Sécurité : on ne supprime jamais un schéma automatiquement (perte de données)

    def __str__(self):
        return f"{self.nom} ({self.schema_name})"


class Domain(DomainMixin):
    """
    🌐 Fait correspondre un (sous-)domaine HTTP à une Pharmacie.
    Exemple : pharmacie-dupont.tonapp.com -> Pharmacie(schema_name="pharmacie_dupont")
    Une Pharmacie peut avoir plusieurs domaines (ex: domaine custom + sous-domaine par défaut).
    """
    pass
