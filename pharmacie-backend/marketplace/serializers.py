from rest_framework import serializers

from tenants.models import Pharmacie
from .models import HoraireOuverture
from .utils import distance_km, est_ouvert_maintenant


class HoraireOuvertureSerializer(serializers.ModelSerializer):
    jour_label = serializers.ReadOnlyField(source='get_jour_semaine_display')

    class Meta:
        model = HoraireOuverture
        fields = ['jour_semaine', 'jour_label', 'ferme', 'heure_ouverture', 'heure_fermeture']


class PharmacieMarketplaceSerializer(serializers.ModelSerializer):
    """
    Carte pharmacie de la page de découverte -- voir la maquette (22/09) : nom, adresse,
    distance (si position du client fournie), statut ouvert/fermé, sous-domaine pour la
    redirection au clic sur "Choisir cette pharmacie".
    """
    nom = serializers.ReadOnlyField(source='nom_public')
    adresse = serializers.ReadOnlyField(source='adresse_public')
    telephone = serializers.ReadOnlyField(source='telephone_public')
    logo = serializers.SerializerMethodField()
    ouvert_maintenant = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    sous_domaine = serializers.SerializerMethodField()

    class Meta:
        model = Pharmacie
        fields = [
            'id', 'nom', 'logo', 'adresse', 'telephone',
            'latitude', 'longitude', 'ouvert_24h', 'ouvert_maintenant',
            'distance_km', 'sous_domaine',
        ]

    def get_logo(self, obj):
        if not obj.logo_public:
            return None
        request = self.context.get('request')
        url = obj.logo_public.url
        return request.build_absolute_uri(url) if request else url

    def get_ouvert_maintenant(self, obj):
        return est_ouvert_maintenant(obj)

    def get_distance_km(self, obj):
        # Position du client transmise dans le context par la vue (query params ?lat=&lng=)
        lat_client = self.context.get('lat_client')
        lng_client = self.context.get('lng_client')
        if lat_client is None or lng_client is None or obj.latitude is None or obj.longitude is None:
            return None
        return round(distance_km(lat_client, lng_client, obj.latitude, obj.longitude), 1)

    def get_sous_domaine(self, obj):
        # 🌐 Domaine PRIMAIRE de ce tenant (django_tenants.DomainMixin) -- c'est vers cette
        # adresse que le frontend redirige au clic sur "Choisir cette pharmacie".
        domaine = obj.domains.filter(is_primary=True).first()
        return domaine.domain if domaine else None


class PharmacieMarketplaceDetailSerializer(PharmacieMarketplaceSerializer):
    horaires = HoraireOuvertureSerializer(many=True, read_only=True)

    class Meta(PharmacieMarketplaceSerializer.Meta):
        fields = PharmacieMarketplaceSerializer.Meta.fields + ['horaires']
