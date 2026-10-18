from rest_framework import serializers

from tenants.models import Pharmacie
from .models import HoraireOuverture
from .utils import distance_km, est_ouvert_maintenant, prochain_changement, resume_horaires


class HoraireOuvertureSerializer(serializers.ModelSerializer):
    jour_label = serializers.ReadOnlyField(source='get_jour_semaine_display')

    class Meta:
        model = HoraireOuverture
        fields = ['jour_semaine', 'jour_label', 'ferme', 'heure_ouverture', 'heure_fermeture']


class PharmacieMarketplaceSerializer(serializers.ModelSerializer):
    """
    Carte pharmacie de la page de découverte (maquette) : nom, adresse, distance (si position
    du client fournie), statut ouvert/fermé + prochain changement, horaires résumés, services,
    sous-domaine pour la redirection au clic sur "Choisir cette pharmacie".

    🎨 RÈGLE DE MARQUE : AUCUN logo de pharmacie n'est exposé ici. La marketplace est un espace
    PLATEFORME : elle n'affiche que la marque Pharmacie+. Le logo d'une pharmacie n'est visible
    que sur son propre sous-domaine (via /api/v1/infos-pharmacie/, qui n'existe que dans le
    contexte de cette pharmacie). Le miroir `Pharmacie.logo_public` reste synchronisé mais n'est
    volontairement servi par aucune route publique.

    ⚡ Les vues préchargent `domains` et `horaires` : tout ce qui est calculé ici lit ces
    caches (`.all()`), jamais de requête SQL par carte.
    """
    nom = serializers.SerializerMethodField()
    adresse = serializers.ReadOnlyField(source='adresse_public')
    telephone = serializers.ReadOnlyField(source='telephone_public')
    ouvert_maintenant = serializers.SerializerMethodField()
    prochain_changement = serializers.SerializerMethodField()
    horaires_resume = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    sous_domaine = serializers.SerializerMethodField()

    class Meta:
        model = Pharmacie
        fields = [
            'id', 'nom', 'adresse', 'telephone',
            'latitude', 'longitude', 'services',
            'ouvert_24h', 'ouvert_maintenant', 'prochain_changement', 'horaires_resume',
            'distance_km', 'sous_domaine',
        ]

    def get_nom(self, obj):
        # nom_public est rempli par le signal à la première sauvegarde de PharmacieConfig ;
        # une pharmacie fraîchement créée n'en a pas encore -> repli sur le nom du tenant
        # plutôt qu'une carte au titre vide.
        return obj.nom_public or obj.nom

    def get_ouvert_maintenant(self, obj):
        return est_ouvert_maintenant(obj)

    def get_prochain_changement(self, obj):
        return prochain_changement(obj)

    def get_horaires_resume(self, obj):
        return resume_horaires(obj)

    def get_distance_km(self, obj):
        # Position du client transmise dans le context par la vue (query params ?lat=&lng=)
        lat_client = self.context.get('lat_client')
        lng_client = self.context.get('lng_client')
        if lat_client is None or lng_client is None or obj.latitude is None or obj.longitude is None:
            return None
        return round(distance_km(lat_client, lng_client, obj.latitude, obj.longitude), 1)

    def get_sous_domaine(self, obj):
        # 🌐 Domaine PRIMAIRE de ce tenant (django_tenants.DomainMixin) -- c'est vers cette
        # adresse que le frontend redirige au clic sur "Choisir cette pharmacie". Lu dans le
        # préchargement (`.all()`), pas via .filter() qui relancerait une requête par carte.
        return next((d.domain for d in obj.domains.all() if d.is_primary), None)


class PharmacieCarteSerializer(PharmacieMarketplaceSerializer):
    """Version allégée pour les marqueurs de la carte : juste de quoi placer et ouvrir un pin."""

    class Meta(PharmacieMarketplaceSerializer.Meta):
        fields = [
            'id', 'nom', 'latitude', 'longitude',
            'ouvert_maintenant', 'distance_km', 'sous_domaine',
        ]


class PharmacieMarketplaceDetailSerializer(PharmacieMarketplaceSerializer):
    horaires = HoraireOuvertureSerializer(many=True, read_only=True)

    class Meta(PharmacieMarketplaceSerializer.Meta):
        fields = PharmacieMarketplaceSerializer.Meta.fields + ['horaires']
