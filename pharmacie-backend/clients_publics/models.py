import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import F, Sum
from django.utils import timezone


class CompteClientManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire pour un CompteClient")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        return self.create_user(email, password, **extra_fields)


class CompteClient(AbstractBaseUser):
    """
    🌍 Compte client GLOBAL -- vit UNIQUEMENT dans le schéma public (jamais par-tenant).
    Un même client peut se connecter et commander chez plusieurs pharmacies différentes
    avec CE SEUL compte : c'est la fondation de la marketplace.

    ⚠️ NE JAMAIS ajouter l'app "clients_publics" à TENANT_APPS -- sinon on retombe
    dans le piège du bug token_blacklist (FK ambiguë entre tables du même nom).

    Pas de PermissionsMixin volontairement : un client n'a besoin d'aucune permission
    admin Django, et ce mixin provoque une collision de related_name avec auth.User.

    🕰️ Remplace l'ancien modèle `core.Client` (par-tenant, lié en OneToOne à auth.User) :
    reprend tous ses champs utiles (identifiant lisible, recherche trigram) avec deux
    améliorations volontaires : `email` (pas `username`) sert d'identifiant de connexion
    -- plus naturel côté client final -- et `check_password()` vient nativement
    d'AbstractBaseUser au lieu de rebondir sur un auth.User séparé via un OneToOne.
    """
    email = models.EmailField(unique=True, verbose_name="Adresse email")
    nom = models.CharField(max_length=150, verbose_name="Nom complet")
    identifiant = models.CharField(max_length=23, blank=True, unique=True, verbose_name="ID Client 🆔")
    telephone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_creation = models.DateTimeField(default=timezone.now)

    objects = CompteClientManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom"]

    class Meta:
        verbose_name = "Compte client (marketplace)"
        verbose_name_plural = "Comptes clients (marketplace)"
        # 🔍 Même besoin que l'ancien Client : recherche __icontains par nom/téléphone
        # (ex: api_commandes_a_retirer côté caisse) -- un index B-Tree classique ne sert à
        # rien pour ce type de recherche par sous-chaîne, d'où le trigram (nécessite
        # l'extension PostgreSQL "pg_trgm", déjà activée par tenants.0002_enable_pg_trgm).
        indexes = [
            GinIndex(fields=["nom"], name="compteclient_nom_trgm_idx", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["telephone"], name="compteclient_tel_trgm_idx", opclasses=["gin_trgm_ops"]),
        ]

    def save(self, *args, **kwargs):
        if not self.identifiant:
            self.identifiant = f"CLI-{str(uuid.uuid4())[:6].upper()}"
        super().save(*args, **kwargs)

    def total_depense(self):
        """
        💰 Total dépensé (commandes payées) par ce client CHEZ LA PHARMACIE COURANTE
        uniquement -- PAS un total agrégé toutes pharmacies confondues.

        ⚠️ Piège à connaître : CompteClient est global (schéma public), mais Commande vit
        par-tenant. `self.commandes` (related_name défini sur Commande.compte_client) ne
        peut donc voir QUE les commandes du schéma tenant actif au moment de l'appel --
        cette méthode doit être appelée depuis l'intérieur d'un `schema_context(...)`
        (ou d'une requête déjà routée vers un tenant, ce qui est le cas de toutes les vues
        core/api.py). Un total "toutes pharmacies" nécessiterait d'itérer chaque schéma
        tenant explicitement -- pas ce que fait cette méthode.
        """
        total = self.commandes.filter(payee=True).aggregate(
            total_vente=Sum(F("items__quantite") * F("items__produit__prix"))
        )["total_vente"]
        return total or 0

    def __str__(self):
        return f"{self.nom} ({self.identifiant})"