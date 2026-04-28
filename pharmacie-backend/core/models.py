import uuid
import calendar # AJOUTÉ
from datetime import date # AJOUTÉ
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.utils.html import format_html
from django.db.models import Sum, F
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password # 👈 Pour la sécurité


class Client(models.Model):
    # Identifiant unique de connexion (ex: Jean23)
    username = models.CharField(max_length=50, unique=True, verbose_name="Nom de connexion 👤")
    # Mot de passe sécurisé (hashé)
    password = models.CharField(max_length=255, verbose_name="Mot de passe 🔐")
    
    nom = models.CharField(max_length=100, verbose_name="Nom Complet")
    identifiant = models.CharField(max_length=23, blank=True, unique=True, verbose_name="ID Client 🆔")
    email = models.EmailField(blank=True, null=True)
    telephone = models.CharField(max_length=20, unique=True, verbose_name="Téléphone 📞")

    def save(self, *args, **kwargs):
        # Génération de l'ID unique si absent
        if not self.identifiant:
            self.identifiant = f"CLI-{str(uuid.uuid4())[:6].upper()}"
        
        # Hachage du mot de passe s'il vient d'être créé/modifié (Sécurité !)
        if self.password and not self.password.startswith('pbkdf2_sha256$'):
            self.password = make_password(self.password)
            
        super().save(*args, **kwargs)

    def check_my_password(self, raw_password):
        """Vérifie si le mot de passe saisi est le bon"""
        return check_password(raw_password, self.password)

    def total_depense(self):
        total = self.commandes.filter(payee=True).aggregate(
            total_vente=Sum(F('items__quantite') * F('items__produit__prix'))
        )['total_vente']
        return total or 0

    def __str__(self):
        return f"{self.nom} ({self.identifiant})"

class Produit(models.Model):
    CATEGORIES = [
        ('antalgique', 'Antalgiques 💊'), ('anti_inflam', 'Anti-inflammatoires 🔥'),
        ('antipyrétique', 'Antipyrétiques 🤒'), ('anti_acide', 'Anti-acides 🥛'),
        ('antispasmodique', 'Antispasmodiques 🌀'), ('antidiarrhéique', 'Antidiarrhéiques 🛑'),
        ('laxatif', 'Laxatifs 🚽'), ('antidiabétique', 'Antidiabétiques 🩸'),
        ('antihypertenseur', 'Antihypertenseurs ❤️'), ('anticoagulant', 'Anticoagulants 💉'),
        ('antiagrégant', 'Antiagrégants plaquettaires 🛡️'), ('hypolipémiant', 'Hypolipémiants 📉'),
        ('antibiotique', 'Antibiotiques 🧬'), ('antiviral', 'Antiviraux 👾'),
        ('antifongique', 'Antifongiques 🍄'), ('antihistaminique', 'Antihistaminiques 🤧'),
        ('bronchodilatateur', 'Bronchodilatateurs 🫁'), ('antitussif', 'Antitussifs 🗣️'),
        ('expectorant', 'Expectorants 💧'), ('anxiolytique', 'Anxiolytiques 🧘'),
        ('hypnotique', 'Hypnotiques 😴'), ('antidépresseur', 'Antidépresseurs ☀️'),
        ('neuroleptique', 'Neuroleptiques 🧠'), ('dermo_corticoide', 'Dermo-corticoïdes 🧴'),
        ('antiseptique', 'Antiseptiques 🧼'), ('contraceptif', 'Contraceptifs 🛡️'),
        ('vitamine', 'Vitamines ✨'), ('complement', 'Compléments alimentaires 🥦'),
        ('homeopathie', 'Homéopathie 🌿'), ('phytotherapie', 'Phytothérapie 🍃'),
    ]
    
    identifiant = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Code Produit 🏷️")
    image = models.ImageField(upload_to='produits/', null=True, blank=True) 
    nom = models.CharField(max_length=100)
    categorie = models.CharField(max_length=50, choices=CATEGORIES, default='antalgique') 
    laboratoire = models.CharField(max_length=100, blank=True, null=True, verbose_name="Laboratoire de fabrication") # AJOUTÉ
    description = models.TextField(blank=True, null=True)
    quantite = models.PositiveIntegerField(default=0)
    prix = models.DecimalField(max_digits=12, decimal_places=2)
    date_ajout = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True) # CHANGÉ : DateField pour calculs
    lot = models.CharField(max_length=100, blank=True, null=True)
    seuil_alerte = models.IntegerField(default=10)
    
    # --- LOGIQUE D'EXPIRATION AJUSTÉE ---
    @property
    def jours_restants(self):
        if self.date_expiration:
            delta = self.date_expiration - date.today()
            return max(delta.days, 0)
        return 999

    def save(self, *args, **kwargs):
        if not self.identifiant:
            self.identifiant = f"PRD-{str(uuid.uuid4())[:8].upper()}"
        # Force le dernier jour du mois pour l'expiration
        if self.date_expiration:
            last_day = calendar.monthrange(self.date_expiration.year, self.date_expiration.month)[1]
            self.date_expiration = self.date_expiration.replace(day=last_day)
        super().save(*args, **kwargs)
    # -----------------------------------

    def stock_faible(self):
        return self.quantite <= self.seuil_alerte
        
    def __str__(self):
        return f"{self.nom} ({self.quantite} en stock)"

    def statut_stock(self):
        if self.quantite <= 0:
            return format_html('<span class="px-2 py-1 rounded bg-red-100 text-red-700 font-bold text-xs">RUPTURE</span>')
        elif self.quantite <= self.seuil_alerte:
            return format_html('<span class="px-2 py-1 rounded bg-orange-100 text-orange-700 font-bold text-xs">RÉAPPRO</span>')
        return format_html('<span class="px-2 py-1 rounded bg-green-100 text-green-700 font-bold text-xs">OK</span>')
    statut_stock.short_description = "État du Stock"


    def statut_peremption(self):
        from datetime import date
        if not self.date_expiration:
            return "Sans date"
    
        # On calcule l'écart avec aujourd'hui
        delta = self.date_expiration - date.today()
        jours_restants = delta.days
    
        if jours_restants <= 0:
            return format_html('<span style="color: #be185d; font-weight: 900;">DÉJÀ PÉRIMÉ 💀</span>')
        elif jours_restants <= 60:  # 🎯 Alerte à 2 mois (60 jours)
            return format_html('<span style="color: #ea580c; font-weight: bold;">ALERTE ({} j) ⏳</span>', jours_restants)
    
        return format_html('<span style="color: #16a34a;">VALIDE ✅</span>')

    statut_peremption.short_description = "État Péremption"

    
    
class Mouvement_stock(models.Model):
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    quantite = models.IntegerField()
    type = models.CharField(max_length=10, choices=[("entree", "Entree"), ("sortie", "Sortie")])
    date = models.DateTimeField(auto_now_add=True)

class Commande(models.Model):
    TYPES_VENTE = [('en_ligne', 'En ligne'), ('guichet', 'Guichet')]
    STATUTS = [
        ("en_cours", "En cours"),
        ("attente_validation", "Attente Ordonnance"),
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
    motif_refus = models.TextField(blank=True, null=True, verbose_name="Motif du refus d'ordonnance ❌")
    date_limite = models.DateTimeField(null=True, blank=True, verbose_name="Expire le ⏳") 
    
    
    def save(self, *args, **kwargs):
        # 🕒 Initialisation auto du délai de 48h à la création
        if not self.id and not self.date_limite:
            self.date_limite = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)

    @property
    def est_perimee(self):
        """Vérifie si les 48h sont passées"""
        if self.statut != "payee" and self.date_limite:
            return timezone.now() > self.date_limite
        return False

    def annuler_commande(self):
        """❌ Annulation propre avec remise en stock immédiate"""
        with transaction.atomic():
            for item in self.items.all():
                p = item.produit
                p.quantite += item.quantite # On rend les produits au stock
                p.save()
                Mouvement_stock.objects.create(produit=p, quantite=item.quantite, type="entree")
            self.statut = "annulee"
            self.save()
    
    
    def total(self):
        return sum(item.total() for item in self.items.all())
    
    def valider(self):
        if self.payee:
            raise ValidationError("Cette commande est déjà payée.")
        with transaction.atomic():
            for item in self.items.all():
                if item.quantite > item.produit.quantite:
                    raise ValidationError(f"Stock insuffisant pour {item.produit.nom}")
                p = item.produit
                p.quantite -= item.quantite
                p.save()
                Mouvement_stock.objects.create(produit=p, quantite=item.quantite, type="sortie")
            self.payee = True
            self.statut = "payee"
            self.save()

class ItemCommande(models.Model):
    commande = models.ForeignKey(Commande, related_name="items", on_delete=models.CASCADE)
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    quantite = models.PositiveIntegerField(default=1)
    def total(self): return self.quantite * self.produit.prix 

class Fournisseur(models.Model):
    nom = models.CharField(max_length=150)
    manager = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    adresse = models.TextField(blank=True)
    date_partenariat = models.DateField(auto_now_add=True)
    def __str__(self): return self.nom

class PharmacieConfig(models.Model):
    nom = models.CharField(max_length=100, default="Pharmacie +")
    adresse = models.TextField(blank=True)
    telephone = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(upload_to='config/', null=True, blank=True)
    message_remerciement = models.TextField(default="Merci de votre confiance !")
    email_contact = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Email de la Pharmacie 📧")

    
    LANGUES = [('fr', 'Français 🇫🇷'), ('en', 'English 🇺🇸')]
    DEVISES = [('FCFA', 'Franc CFA (XAF)'), ('EUR', 'Euro (€)'), ('USD', 'Dollar ($)')]
    
    langue_preferee = models.CharField(max_length=5, choices=LANGUES, default='fr')
    devise_preferee = models.CharField(max_length=10, choices=DEVISES, default='FCFA')

    def __str__(self): return f"Config {self.nom}"
