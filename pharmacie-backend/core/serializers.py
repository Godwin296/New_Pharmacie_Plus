from rest_framework import serializers
from .models import Produit, Mouvement_stock, Commande, ItemCommande, Fournisseur, PharmacieConfig, LotProduit
from .utils import generate_qr_base64, construire_contenu_qr_facture

class PharmacieConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacieConfig
        fields = '__all__'


class LotProduitSerializer(serializers.ModelSerializer):
    # 🔐 TRAÇABILITÉ : nom lisible plutôt que l'ID brut de l'utilisateur Django
    auteur_nom = serializers.ReadOnlyField(source='auteur.username')

    class Meta:
        model = LotProduit
        fields = [
            'id', 'produit', 'numero_lot', 'quantite_initiale', 'quantite_restante',
            'date_peremption', 'date_reception', 'auteur_nom', 'note',
        ]
        read_only_fields = ['id', 'quantite_restante', 'date_reception', 'auteur_nom']


class ItemCommandeSerializer(serializers.ModelSerializer):
    produit_nom = serializers.ReadOnlyField(source='produit.nom')
    # 🔐 COMPTABILITÉ : On lit le prix enregistré lors de la transaction, pas le prix catalogue actuel
    ordonnance_requise = serializers.ReadOnlyField(source='produit.ordonnance_obligatoire') # Ajustez 'ordonnance_obligatoire' selon le nom exact du champ BooleanField de votre modèle Produit
    
    prix_unitaire = serializers.ReadOnlyField(source='prix_facture')
    total_item = serializers.ReadOnlyField(source='total')

    class Meta:
        model = ItemCommande
        fields = ['id', 'produit', 'produit_nom', 'quantite', 'prix_unitaire', 'total_item', 'ordonnance_requise']


class CommandeSerializer(serializers.ModelSerializer):
    """
    🔐 Serializer COMPLET, réservé au personnel (caisse/admin).
    Expose agent_validateur_nom à des fins d'audit interne (traçabilité : quel agent a traité
    quelle commande). NE JAMAIS utiliser ce serializer pour répondre à une requête initiée
    par un client final -> utiliser CommandeClientSerializer à la place.
    """
    qr_code = serializers.SerializerMethodField()
    items = ItemCommandeSerializer(many=True, read_only=True)
    total_general = serializers.SerializerMethodField() 
    est_perimee = serializers.ReadOnlyField()
    statut = serializers.CharField(read_only=True)
    agent_validateur_nom = serializers.ReadOnlyField(source='agent_validateur.username', default="N/A")

    # 🔐 CHIFFREMENT AU REPOS (core/chiffrement.py) : le fichier sur disque est désormais
    # chiffré, donc illisible tel quel par un navigateur -- on n'expose plus l'URL DIRECTE du
    # FileField (comportement par défaut de DRF pour ordonnance = models.FileField), mais
    # l'URL du point de déchiffrement dédié (views.py::api_voir_ordonnance), qui déchiffre à
    # la volée avant de streamer la réponse.
    ordonnance = serializers.SerializerMethodField()

    def get_ordonnance(self, obj):
        if not obj.ordonnance:
            return None
        request = self.context.get('request')
        chemin = f"/api/v1/ordonnance/{obj.id}/voir/"
        return request.build_absolute_uri(chemin) if request else chemin

    # 🌟 EXTRACTION DYNAMIQUE DES COORDONNÉES POUR NEXT.JS
    client_nom = serializers.SerializerMethodField()
    client_telephone = serializers.SerializerMethodField()
    client_email = serializers.SerializerMethodField()
    client_region = serializers.SerializerMethodField()
    client_ville = serializers.SerializerMethodField()
    client_quartier = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = [
            'id', 'compte_client', 'client_guichet', 'client_nom', 'client_telephone', 'client_email',
            'client_region', 'client_ville', 'client_quartier', 'date', 'payee', 'type_vente', 
            'agent_validateur_nom', 'statut', 'ordonnance', 'ordonnance_valide', 
            'motif_refus', 'date_limite', 'items', 'total_general', 'qr_code', 'est_perimee'
        ]

    def get_total_general(self, obj):
        return obj.total()

    # 🧠 Logique intelligente : guichet (ClientGuichet) > compte client global (CompteClient)
    def get_client_nom(self, obj):
        if obj.client_guichet: return obj.client_guichet.nom
        return obj.compte_client.nom if obj.compte_client else "Client Anonyme"

    def get_client_telephone(self, obj):
        if obj.client_guichet: return obj.client_guichet.telephone
        return obj.compte_client.telephone if obj.compte_client else ""

    def get_client_email(self, obj):
        if obj.client_guichet: return obj.client_guichet.email
        return obj.compte_client.email if obj.compte_client else ""

    def get_client_region(self, obj):
        if obj.client_guichet: return obj.client_guichet.region
        return ""

    def get_client_ville(self, obj):
        if obj.client_guichet: return obj.client_guichet.ville
        return ""

    def get_client_quartier(self, obj):
        if obj.client_guichet: return obj.client_guichet.quartier
        return ""


    def get_qr_code(self, obj):
        try:
            nom_client = self.get_client_nom(obj)
            # 🐛 CORRECTIF (duplication) : cette méthode reconstruisait le contenu du QR
            # code à la main -- logique désormais centralisée dans
            # construire_contenu_qr_facture() (core/utils.py), partagée avec
            # export_facture_pdf() (core/views.py), pour garantir un QR rigoureusement
            # identique entre l'aperçu React et le PDF téléchargé.
            contenu_qr = construire_contenu_qr_facture(obj, nom_client)
            return generate_qr_base64(contenu_qr)

        except Exception as e:
            print(f"❌ Erreur QR détaillé pour commande {obj.id}: {e}")
            return None


class CommandeClientSerializer(CommandeSerializer):
    """
    🔐 Serializer PUBLIC, destiné aux réponses envoyées au client final (mobile/web client).
    Hérite de CommandeSerializer pour réutiliser toute la logique (qr_code, total, items...)
    mais EXCLUT explicitement agent_validateur_nom : le client ne doit jamais savoir quel agent
    de la pharmacie a validé ou refusé son ordonnance — seul le motif de refus lui est montré.
    """
    class Meta(CommandeSerializer.Meta):
        fields = [f for f in CommandeSerializer.Meta.fields if f != 'agent_validateur_nom']


# 🆕 (30/07) Historique des mouvements de stock d'un produit -- le modèle Mouvement_stock
# existait déjà et est alimenté automatiquement (voir Produit.save()/LotProduit dans
# models.py, et core/services_prediction.py qui s'en sert déjà pour les prédictions),
# mais rien ne l'exposait encore au frontend. Réservé à l'admin (vue api_produit_historique),
# comme prix_achat -- ce ne sont pas des informations à montrer à un client.
class MouvementStockSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = Mouvement_stock
        fields = ['id', 'type', 'quantite', 'date', 'auteur_nom', 'note']

    def get_auteur_nom(self, obj):
        return obj.auteur.username if obj.auteur else "Système"


class ProduitSerializer(serializers.ModelSerializer):
    statut_stock_label = serializers.SerializerMethodField()
    jours_restants = serializers.ReadOnlyField()
    image = serializers.SerializerMethodField()
    # 🆕 (30/07) categorie_display : libellé humain ('Antibiotiques') plutôt que le code brut
    # stocké en base ('antibiotique') -- jusqu'ici seul /api/catalogue/ renvoyait la table de
    # correspondance séparément (categories: {code: libellé}), ce qui obligeait tout écran
    # consommant ProduitSerializer isolément (ex. page détail produit) à soit refaire un
    # fetch juste pour ça, soit afficher le code brut. get_categorie_display() est la méthode
    # native que Django génère automatiquement pour tout champ à choix (CATEGORIES).
    categorie_display = serializers.CharField(source='get_categorie_display', read_only=True)

    class Meta:
        model = Produit
        fields = '__all__'

    def get_statut_stock_label(self, obj):
        if obj.quantite <= 0: return "RUPTURE"
        if obj.quantite <= obj.seuil_alerte: return "REAPPRO"
        return "OK"

    def get_image(self, obj):
        # Génère automatiquement le lien complet http://127.0.0... pour Next.js
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None

    def to_representation(self, instance):
        """
        🔐 CONFIDENTIALITÉ PRIX D'ACHAT (18/07) : `prix_achat` (coût, pour calculer la marge
        réelle -- voir Produit.prix_achat) n'a AUCUNE raison d'être visible par un client
        (fuite de la structure de marge de la pharmacie vers l'extérieur) ni même par une
        caissière (elle vend, elle n'a pas besoin de connaître les coûts d'achat) -- SEUL
        l'administrateur du tenant (is_superuser=True) le voit. Retiré ici, dans le
        serializer, plutôt que dans chaque vue individuellement : un seul endroit à
        auditer, impossible à contourner en oubliant un `.pop()` dans une vue future.

        ⚠️ Ceci suppose que `context={'request': request}` est bien transmis par l'appelant.
        Si `request` est absent du contexte (oubli), le comportement est FAIL-SAFE : le champ
        est retiré par défaut (traité comme non-admin), jamais l'inverse.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        est_admin_tenant = bool(
            request and getattr(request, 'user', None) and request.user.is_authenticated
            and getattr(request.user, 'is_superuser', False)
        )
        if not est_admin_tenant:
            data.pop('prix_achat', None)
        return data

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = ['id', 'nom', 'telephone', 'email', 'adresse', 'manager']
