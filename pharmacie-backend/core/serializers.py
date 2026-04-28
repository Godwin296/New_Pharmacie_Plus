from rest_framework import serializers
from .models import Client, Produit, Mouvement_stock, Commande, ItemCommande, Fournisseur, PharmacieConfig
from .utils import generate_qr_base64

class PharmacieConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacieConfig
        fields = '__all__'

class ItemCommandeSerializer(serializers.ModelSerializer):
    produit_nom = serializers.ReadOnlyField(source='produit.nom')
    prix_unitaire = serializers.ReadOnlyField(source='produit.prix')
    total_item = serializers.ReadOnlyField(source='total')

    class Meta:
        model = ItemCommande
        fields = ['id', 'produit', 'produit_nom', 'quantite', 'prix_unitaire', 'total_item']


class CommandeSerializer(serializers.ModelSerializer):
    qr_code = serializers.SerializerMethodField()
    items = ItemCommandeSerializer(many=True, read_only=True)
    client_nom = serializers.ReadOnlyField(source='client.nom', default="Client au Guichet")
    total_general = serializers.SerializerMethodField() 
    est_perimee = serializers.ReadOnlyField()

    class Meta:
        model = Commande
        fields = '__all__'

    def get_total_general(self, obj):
        # Utilise la méthode total() définie dans ton models.py
        return obj.total()

    def get_qr_code(self, obj):
        try:
            # 1. Infos de base
            num_facture = f"FAC-{obj.id}"
            
            # Correction ici : On n'appelle pas client_nom sur obj, mais sur le client lié
            nom_client = obj.client.nom if obj.client else "Client au Guichet"
            
            date_info = obj.date.strftime('%d/%m/%Y %H:%M') if obj.date else "N/A"
        
            # 2. Liste des produits (optimisée pour la place)
            liste_produits = ""
            # On boucle sur les items via le related_name='items' de ton modèle
            for item in obj.items.all():
                nom_p = item.produit.nom[:12] # On tronque un peu plus pour les 50 produits
                liste_produits += f"{item.quantite}x {nom_p}\n"

            # 3. Calcul du total
            total_prix = f"{obj.total()} CFA"

            # 4. Construction finale
            contenu_qr = (
                f"FACTURE: {num_facture}\n"
                f"CLIENT: {nom_client}\n"
                f"DATE: {date_info}\n"
                f"ARTICLES:\n{liste_produits}"
                f"TOTAL: {total_prix}"
            )

            # On s'assure que l'import est bien là
            from .utils import generate_qr_base64
            return generate_qr_base64(contenu_qr)

        except Exception as e:
            # Affichera l'erreur exacte dans le terminal Django
            print(f"❌ Erreur QR détaillé pour commande {obj.id}: {e}")
            return None
        
        
class ProduitSerializer(serializers.ModelSerializer):
    statut_stock_label = serializers.SerializerMethodField()
    jours_restants = serializers.ReadOnlyField()

    class Meta:
        model = Produit
        fields = '__all__'

    def get_statut_stock_label(self, obj):
        # On extrait juste le texte du format_html pour Next.js
        if obj.quantite <= 0: return "RUPTURE"
        if obj.quantite <= obj.seuil_alerte: return "REAPPRO"
        return "OK"

class ClientSerializer(serializers.ModelSerializer):
    total_depense = serializers.ReadOnlyField()
    class Meta:
        model = Client
        fields = ['id', 'nom', 'telephone', 'email', 'total_depense'] 

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = ['id', 'nom', 'telephone', 'email', 'adresse', 'manager']