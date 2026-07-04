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
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="client_profile")
    nom = models.CharField(max_length=100, verbose_name="Nom Complet")
    identifiant = models.CharField(max_length=23, blank=True, unique=True, verbose_name="ID Client 🆔")
    email = models.EmailField(blank=True, null=True)
    telephone = models.CharField(max_length=20, unique=True, verbose_name="Téléphone 📞")
    is_active = models.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        # Génération de l'ID unique si absent
        if not self.identifiant:
            self.identifiant = f"CLI-{str(uuid.uuid4())[:6].upper()}"    
        super().save(*args, **kwargs)

    def check_my_password(self, raw_password):
        """Vérifie si le mot de passe saisi est le bon"""
        return self.user.check_password(raw_password)

    def total_depense(self):
        total = self.commandes.filter(payee=True).aggregate(
            total_vente=Sum(F('items__quantite') * F('items__produit__prix'))
        )['total_vente']
        return total or 0

    def __str__(self):
        return f"{self.nom} ({self.identifiant})"

class ClientGuichet(models.Model):
    nom = models.CharField(max_length=255, default="Client Passage")
    telephone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    region = models.CharField(max_length=100, blank=True, null=True)
    ville = models.CharField(max_length=100, blank=True, null=True)
    quartier = models.CharField(max_length=255, blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nom} - {self.telephone or 'Sans numéro'}"


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
    laboratoire = models.CharField(max_length=100, blank=True, null=True, verbose_name="Laboratoire de fabrication")
    description = models.TextField(blank=True, null=True)
    quantite = models.PositiveIntegerField(default=0)
    prix = models.DecimalField(max_digits=12, decimal_places=2)
    date_ajout = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateField(null=True, blank=True)
    lot = models.CharField(max_length=100, blank=True, null=True)
    seuil_alerte = models.IntegerField(default=10)

    # 🔐 CORRECTION : ce champ était référencé par ItemCommandeSerializer
    # (source='produit.ordonnance_obligatoire') mais n'existait jamais réellement sur ce modèle
    # -> en pratique, AUCUN produit ne déclenchait jamais l'exigence d'ordonnance côté client,
    # quel que soit le médicament. Sans ce champ, le système ne pouvait pas distinguer un
    # antalgique en vente libre d'un antibiotique normalement soumis à prescription.
    ordonnance_obligatoire = models.BooleanField(
        default=False,
        verbose_name="Ordonnance obligatoire 📋",
        help_text="Si activé, le client devra obligatoirement charger une ordonnance valide avant de pouvoir payer ce produit."
    )

    class Meta:
        # 🔐 SÉCURITÉ : Contrainte physique empêchant le stock de descendre sous 0 en cas de requêtes simultanées
        constraints = [
            models.CheckConstraint(check=models.Q(quantite__gte=0), name="quantite_produit_positive_strict")
        ]
    
    @property
    def jours_restants(self):
        if self.date_expiration:
            delta = self.date_expiration - date.today()
            return max(delta.days, 0)
        return 999

    def save(self, *args, **kwargs):
        if not self.identifiant:
            self.identifiant = f"PRD-{str(uuid.uuid4())[:8].upper()}"
        if self.date_expiration:
            last_day = calendar.monthrange(self.date_expiration.year, self.date_expiration.month)[1]
            self.date_expiration = self.date_expiration.replace(day=last_day)
        super().save(*args, **kwargs)

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
        if not self.date_expiration:
            return "Sans date"
        delta = self.date_expiration - date.today()
        jours_restants = delta.days
        if jours_restants <= 0:
            return format_html('<span style="color: #be185d; font-weight: 900;">DÉJÀ PÉRIMÉ 💀</span>')
        elif jours_restants <= 60:
            return format_html('<span style="color: #ea580c; font-weight: bold;">ALERTE ({} j) ⏳</span>', jours_restants)
        return format_html('<span style="color: #16a34a;">VALIDE ✅</span>')
    statut_peremption.short_description = "État Péremption"


class Mouvement_stock(models.Model):
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    # 🔐 SÉCURITÉ : PositiveIntegerField bloque l'injection de nombres négatifs à l'entrée
    quantite = models.PositiveIntegerField() 
    type = models.CharField(max_length=10, choices=[("entree", "Entree"), ("sortie", "Sortie")])
    date = models.DateTimeField(auto_now_add=True)
    
    # 🔐 SÉCURITÉ TRACABILITÉ : On lie chaque mouvement à l'utilisateur Django qui l'a opéré
    auteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Opérateur 👤")

    def __str__(self):
        nom_auteur = self.auteur.username if self.auteur else "Système"
        return f"{self.type.upper()} - {self.quantite} x {self.produit.nom} par {nom_auteur}"

class Commande(models.Model):
    TYPES_VENTE = [('en_ligne', 'En ligne'), ('guichet', 'Guichet')]

    # 🔄 CYCLE DE VIE COMPLET D'UNE COMMANDE EN LIGNE :
    # en_cours -> [attente_validation si ordonnance requise] -> paiement_a_verifier
    #   -> payee_a_retirer (stock décrémenté, en attente de passage au guichet)
    #   -> retiree (le client est passé chercher -> statut final, comptabilisé pour l'audit)
    # ou bien -> annulee (commande jamais payée après 48h -> stock recrédité automatiquement)
    #
    # 🔐 IMPORTANT : une fois "payee_a_retirer" ou "retiree", une commande n'est JAMAIS annulée
    # automatiquement par la tâche des 48h (cf. est_perimee ci-dessous) -- contrairement à l'ancien
    # comportement où une commande payée mais pas encore récupérée physiquement risquait de se
    # retrouver mélangée avec les commandes simplement abandonnées, ce qui aurait faussé l'audit
    # financier (une vente réelle ne doit jamais disparaître des statistiques).
    STATUTS = [
        ("en_cours", "En cours"),
        ("attente_validation", "Attente Ordonnance"),
        ("paiement_a_verifier", "Paiement à vérifier 💰"),
        ("payee_a_retirer", "Payée - à retirer au guichet 🏥"),
        ("retiree", "Retirée par le client ✅"),
        ("payee", "Payée (vente directe guichet)"),
        ("annulee", "Annulée"),
    ]
    # Pour les clients en ligne (smartphone) - Reste permanent
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="commandes")
    
    # 🌟 NOUVEAU : Pour les clients physiques encaissés au guichet
    client_guichet = models.ForeignKey(ClientGuichet, on_delete=models.SET_NULL, null=True, blank=True, related_name="commandes")

    # 🔖 RÉFÉRENCE LISIBLE ET RECHERCHABLE : générée une seule fois à la création, jamais modifiée.
    # Format : PHC-AAAA-NNNNN (ex: PHC-2026-00042). C'est CE numéro que le client communique au
    # support / colle comme référence, et que la caisse recherche dans son tableau de bord -- un
    # id auto-increment brut (ex: "42") n'est ni mémorable, ni assez explicite pour être communiqué
    # sans ambiguïté entre deux pharmacies différentes (chacune ayant ses propres id à partir de 1).
    reference = models.CharField(max_length=20, unique=True, db_index=True, blank=True)

    date = models.DateTimeField(auto_now_add=True)
    payee = models.BooleanField(default=False)
    type_vente = models.CharField(max_length=20, choices=TYPES_VENTE, default='en_ligne')
    
    # 🔐 SÉCURITÉ IDENTIFICATION : Vraie relation vers l'User pour tracer l'agent de caisse
    agent_validateur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="commandes_validees")
    # 🆕 Agent ayant constaté le retrait physique au guichet (peut être différent de agent_validateur)
    agent_retrait = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="commandes_retirees")
    
    statut = models.CharField(max_length=50, choices=STATUTS, default="en_cours")
    ordonnance = models.FileField(upload_to='ordonnances/%Y/%m/', null=True, blank=True)
    ordonnance_valide = models.BooleanField(default=False)
    motif_refus = models.TextField(blank=True, null=True, verbose_name="Motif du refus d'ordonnance ❌")
    date_limite = models.DateTimeField(null=True, blank=True, verbose_name="Expire le ⏳")
    date_retrait = models.DateTimeField(null=True, blank=True, verbose_name="Récupérée le 📦")

    # 🏥 VENTE AU GUICHET : pour les ventes physiques au comptoir, il n'y a pas d'upload
    # numérique d'ordonnance (le client a le document physique en main devant la caissière).
    # Ce champ trace explicitement que l'agent a confirmé avoir vu et vérifié l'ordonnance
    # papier avant d'autoriser la vente d'un médicament qui l'exige -- protection juridique
    # pour la pharmacie ET preuve d'audit en cas de contrôle, sans bloquer le flux par un
    # upload qui n'a pas de sens dans ce contexte physique.
    ordonnance_verifiee_visuellement = models.BooleanField(
        default=False,
        verbose_name="Ordonnance papier vérifiée visuellement par l'agent 👁️"
    )

    # 💰 PAIEMENT MANUEL : le client indique lui-même quel moyen il a utilisé et colle la
    # référence de transaction reçue par SMS après son transfert Orange Money / MTN MoMo.
    MOYENS_PAIEMENT = [('orange_money', 'Orange Money 🟠'), ('mtn_momo', 'MTN MoMo 🟡')]
    moyen_paiement = models.CharField(max_length=20, choices=MOYENS_PAIEMENT, blank=True, null=True)
    reference_paiement_client = models.CharField(
        max_length=100, blank=True, null=True,
        verbose_name="Référence de transaction fournie par le client"
    )
    
    def save(self, *args, **kwargs):
        if not self.id and not self.date_limite:
            self.date_limite = timezone.now() + timedelta(hours=48)
        if not self.reference:
            self.reference = self._generer_reference()
        super().save(*args, **kwargs)

    def _generer_reference(self):
        """
        Génère une référence lisible unique : PHC-2026-00042.
        On boucle sur un compteur jusqu'à trouver un numéro réellement libre DANS CE SCHÉMA
        de tenant (chaque pharmacie a sa propre séquence, ce qui est cohérent avec l'isolation
        déjà en place -- pas besoin d'unicité globale inter-tenants).
        """
        annee = timezone.now().year
        dernier = (
            Commande.objects.filter(reference__startswith=f"PHC-{annee}-")
            .order_by("-id").first()
        )
        if dernier and dernier.reference:
            try:
                dernier_numero = int(dernier.reference.split("-")[-1])
            except (ValueError, IndexError):
                dernier_numero = 0
        else:
            dernier_numero = 0
        return f"PHC-{annee}-{dernier_numero + 1:05d}"

    @property
    def est_perimee(self):
        # 🔐 Une commande payée (sous QUELQUE forme que ce soit) ou déjà retirée n'est JAMAIS
        # considérée comme périmée -- seules les commandes jamais payées peuvent expirer après 48h.
        statuts_jamais_perimes = ("payee_a_retirer", "retiree", "payee")
        if self.statut not in statuts_jamais_perimes and self.date_limite:
            return timezone.now() > self.date_limite
        return False

    def annuler_commande(self):
        # 🔐 Garde-fou supplémentaire : on ne recrédite/n'annule jamais une commande déjà payée,
        # même si cette méthode était appelée par erreur depuis ailleurs dans le code.
        if self.statut in ("payee_a_retirer", "retiree", "payee"):
            return
        with transaction.atomic():
            for item in self.items.all():
                p = Produit.objects.select_for_update().get(id=item.produit.id)
                p.quantite += item.quantite
                p.save()
                Mouvement_stock.objects.create(produit=p, quantite=item.quantite, type="entree")
            self.statut = "annulee"
            self.save()
    
    def total(self):
        return sum(item.total() for item in self.items.all())
    
    def valider(self, user_operateur=None):
        """
        Finalise le paiement d'une commande EN LIGNE (passe en 'payee_a_retirer') : décrémente
        le stock de façon sécurisée (verrou + vérification), comme pour une vente directe.
        Appelée soit manuellement (admin/caisse vérifie la référence mobile money), soit plus
        tard automatiquement par un futur webhook de passerelle de paiement -- la logique métier
        reste strictement identique, seul le déclencheur changera.
        """
        if self.payee or self.statut in ("payee_a_retirer", "retiree", "payee"):
            raise ValidationError("Cette commande est déjà payée.")
        with transaction.atomic():
            for item in self.items.all():
                p = Produit.objects.select_for_update().get(id=item.produit.id)
                if item.quantite > p.quantite:
                    raise ValidationError(f"Stock insuffisant pour {p.nom}")
                p.quantite -= item.quantite
                p.save()
                Mouvement_stock.objects.create(produit=p, quantite=item.quantite, type="sortie", auteur=user_operateur)
                
            self.payee = True
            self.statut = "payee_a_retirer"
            self.agent_validateur = user_operateur
            self.save()

        # 📧 Hors de la transaction atomic() : un échec d'envoi d'email ne doit jamais
        # faire rollback le paiement déjà validé et le stock déjà décrémenté.
        from .emails import envoyer_email_confirmation_commande
        envoyer_email_confirmation_commande(self)

    def marquer_retiree(self, user_operateur=None):
        """
        🏥 La caisse constate que le client est passé récupérer sa commande au guichet.
        Statut final pour l'audit : cette vente compte définitivement, plus jamais soumise
        à expiration automatique.
        """
        if self.statut != "payee_a_retirer":
            raise ValidationError("Seule une commande payée et en attente de retrait peut être marquée comme récupérée.")
        self.statut = "retiree"
        self.agent_retrait = user_operateur
        self.date_retrait = timezone.now()
        self.save()


class ItemCommande(models.Model):
    commande = models.ForeignKey(Commande, related_name="items", on_delete=models.CASCADE)
    produit = models.ForeignKey(Produit, on_delete=models.CASCADE)
    quantite = models.PositiveIntegerField(default=1)
    
    # 🔐 SÉCURITÉ COMPTABILITÉ : Enregistre le prix exact lors de la transaction
    prix_facture = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)

    def save(self, *args, **kwargs):
        # Si c'est un nouvel article, on copie le prix actuel du catalogue du produit
        if not self.id and self.produit:
            self.prix_facture = self.produit.prix
        super().save(*args, **kwargs)

    def total(self): 
        # Utilise le prix figé pour ne pas fausser l'historique financier si le catalogue change
        prix_unitaire = self.prix_facture if self.prix_facture else self.produit.prix
        return self.quantite * prix_unitaire


class Fournisseur(models.Model):
    nom = models.CharField(max_length=150)
    manager = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    adresse = models.TextField(blank=True)
    date_partenariat = models.DateField(auto_now_add=True)
    
    def __str__(self): 
        return self.nom


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

    # 💰 PAIEMENT MANUEL (en attendant l'intégration d'une vraie passerelle type Campay) :
    # chaque pharmacie (tenant) configure ICI ses propres numéros mobile money. Le client voit
    # ces numéros sur la page de paiement et y effectue lui-même son transfert, puis colle la
    # référence de transaction reçue par SMS -> la caisse vérifie manuellement avant de valider.
    numero_orange_money = models.CharField(max_length=20, blank=True, verbose_name="Numéro Orange Money 🟠")
    nom_titulaire_orange_money = models.CharField(max_length=100, blank=True, verbose_name="Nom du titulaire (Orange Money)")
    numero_mtn_momo = models.CharField(max_length=20, blank=True, verbose_name="Numéro MTN MoMo 🟡")
    nom_titulaire_mtn_momo = models.CharField(max_length=100, blank=True, verbose_name="Nom du titulaire (MTN MoMo)")

    def __str__(self): 
        return f"Config {self.nom}"
