from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
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
    """
    email = models.EmailField(unique=True, verbose_name="Adresse email")
    nom = models.CharField(max_length=150, verbose_name="Nom complet")
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

    def __str__(self):
        return f"{self.nom} <{self.email}>"