import uuid
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.utils.html import format_html
from django.db.models import Sum, F

class Client(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="client_profile", null=True)
    identifiant = models.CharField(max_length=23, blank=True, unique=True)
    nom = models.CharField(max_length=100)
    email = models.EmailField(blank=True, null=True)
    telephone = models.CharField(max_length=20, blank=True, unique=True, null=True)
    
    def total_depense(self):
        total = self.commandes.filter(payee=True).aggregate(
            total_vente=Sum(F('items__quantite') * F('items__produit__prix'))
        )['total_vente']
        return total or 0
        
    def save(self, *args, **kwargs):
        if not self.identifiant:
            self.identifiant = f"CLI-{str(uuid.uuid4())[:6].upper()}"
        super().save(*args, **kwargs)
        
    def __str__(self):
        return f"{self.nom} ({self.identifiant})"

class Produit(models.Model):
    CATEGORIES = [
        ('generique', 'Générique'),
        ('antibiotique', 'Antibiotique'),
        ('antidouleur', 'Anti-douleur'),
        ('vitamine', 'Vitamines & Compléments'),
        ('materiel', 'Matériel médical'),
    ]
    nom = models.CharField(max_length=100)
    categorie = models.CharField(max_length=50, choices=CATEGORIES, default='generique') 
    description = models.TextField(blank=True, null=True)
    quantite = models.PositiveIntegerField(default=0)
    prix = models.DecimalField(max_digits=12, decimal_places=2)
    date_ajout = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True)
    lot = models.CharField(max_length=100, blank=True, null=True)
    seuil_alerte = models.IntegerField(default=10)
    
    def stock_faible(self):
        return self.quantite <= self.seuil_alerte
        
    def __str__(self):
        return f"{self.nom} ({self.quantite} en stock)"

    def statut_stock(self):
        if self.quantite <= 0:
            return format_html('<span style="color: red; font-weight: bold;">RUPTURE</span>')
        elif self.quantite <= self.seuil_alerte:
            return format_html('<span style="color: orange; font-weight: bold;">À RÉAPPROVISIONNER</span>')
        return format_html('<span style="color: green;">OK</span>')
    statut_stock.short_description = "État du Stock"
    
class Mouvement_stock(models.Model):
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    quantite = models.IntegerField()
    type = models.CharField(max_length=10, choices=[("entree", "Entree"), ("sortie", "Sortie")])
    date = models.DateTimeField(auto_now_add=True)


class Commande(models.Model):
    TYPES_VENTE = [
        ('en_ligne', 'Commande en ligne'),
        ('guichet', 'Vente au guichet (Main propre)'),
    ]
    STATUTS = [
        ("en_cours", "En cours"),
        ("attente_validation", "Attente Validation Ordonnance"),
        ("payee", "Payée"),
        ("annulee", "Annulée"),
    ] 
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, related_name="commandes")
    date = models.DateTimeField(auto_now_add=True)
    payee = models.BooleanField(default=False)
    type_vente = models.CharField(max_length=20, choices=TYPES_VENTE, default='en_ligne')
    agent_validateur = models.CharField(max_length=100, blank=True, null=True)
    statut = models.CharField(max_length=50, choices=STATUTS, default="en_cours")
    ordonnance = models.FileField(upload_to='ordonnances/%Y/%m/', null=True, blank=True)
    ordonnance_valide = models.BooleanField(default=False)
    
    def total(self):
        return sum(item.total() for item in self.items.all())
    
    def __str__(self):
        return f"Commande {self.id} - {self.client.nom if self.client else 'Anonyme'}"
    
    def valider(self):
        if self.payee:
            raise ValidationError("Cette commande est déjà validée.")
        with transaction.atomic():
            for item in self.items.all():
                if item.quantite > item.produit.quantite:
                    raise ValidationError(f"Quantité insuffisante pour {item.produit.nom}")
                produit = item.produit
                produit.quantite -= item.quantite
                produit.save()
                Mouvement_stock.objects.create(
                    produit=produit, 
                    quantite=item.quantite, 
                    type="sortie"
                )
            self.payee = True
            self.statut = "payee"
            self.save()

class ItemCommande(models.Model):
    commande = models.ForeignKey(Commande, related_name="items", on_delete=models.CASCADE)
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    quantite = models.PositiveIntegerField(default=1)
    
    def total(self):
        return self.quantite * self.produit.prix 

