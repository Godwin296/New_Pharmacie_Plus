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

    # 🛒 MARKETPLACE (page de découverte multi-pharmacies, schéma public).
    #
    # 🪞 MIROIR SYNCHRONISÉ (pas une deuxième saisie) : nom_public/logo_public/adresse_public/
    # telephone_public sont une COPIE en lecture seule de core.PharmacieConfig (nom, logo,
    # adresse, telephone), tenue à jour automatiquement par le signal post_save défini dans
    # marketplace/signals.py. Le pharmacien ne modifie JAMAIS ces champs ici : il continue
    # d'éditer sa fiche à un seul endroit (/admin/settings, comme aujourd'hui). Cette copie
    # existe UNIQUEMENT parce que PharmacieConfig vit par-tenant (schéma isolé) et qu'une
    # jointure cross-schéma est impossible avec django-tenants -- sans ce miroir, lister
    # des pharmacies de plusieurs schémas obligerait à ouvrir chaque schéma un par un.
    nom_public = models.CharField(max_length=150, blank=True)
    logo_public = models.ImageField(upload_to='marketplace/logos/', null=True, blank=True)
    adresse_public = models.TextField(blank=True)
    telephone_public = models.CharField(max_length=20, blank=True)

    # 📍 N'existe nulle part ailleurs (PharmacieConfig n'a pas de coordonnées) -- nécessaire
    # pour trier/filtrer par proximité géographique sur la page de découverte.
    # (Pas de champ "pays" : toutes les pharmacies sont au Cameroun aujourd'hui, un champ
    # non utilisé n'a pas sa place ici -- à ajouter le jour où ça devient réellement utile.)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # 🕐 HORAIRES : soit H24 (raccourci, pas besoin de remplir 7 lignes), soit périodique
    # -- dans ce cas le détail jour par jour vit dans marketplace.HoraireOuverture (FK vers
    # cette Pharmacie), pas ici (une ligne par jour, pas 7 champs plats).
    ouvert_24h = models.BooleanField(default=False, verbose_name="Ouvert 24h/24")

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
