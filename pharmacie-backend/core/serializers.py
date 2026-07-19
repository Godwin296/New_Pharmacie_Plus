from rest_framework import serializers
from .models import Produit, Mouvement_stock, Commande, ItemCommande, Fournisseur, PharmacieConfig, LotProduit
from .utils import generate_qr_base64

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
            num_facture = f"FAC-{obj.id}"
            nom_client = self.get_client_nom(obj)
            date_info = obj.date.strftime('%d/%m/%Y %H:%M') if obj.date else "N/A"
        
            liste_produits = ""
            for item in obj.items.all():
                nom_p = item.produit.nom[:12] 
                liste_produits += f"{item.quantite}x {nom_p}\n"

            total_prix = f"{obj.total()} CFA"

            contenu_qr = (
                f"FACTURE: {num_facture}\n"
                f"CLIENT: {nom_client}\n"
                f"DATE: {date_info}\n"
                f"ARTICLES:\n{liste_produits}"
                f"TOTAL: {total_prix}"
            )
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


class ProduitSerializer(serializers.ModelSerializer):
    statut_stock_label = serializers.SerializerMethodField()
    jours_restants = serializers.ReadOnlyField()
    image = serializers.SerializerMethodField()

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

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = ['id', 'nom', 'telephone', 'email', 'adresse', 'manager']
