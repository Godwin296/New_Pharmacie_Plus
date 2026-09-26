from django.urls import path
from . import api

app_name = 'marketplace'

urlpatterns = [
    path("pharmacies/", api.api_liste_pharmacies, name="api_liste_pharmacies"),
    path("pharmacies/<int:pharmacie_id>/", api.api_detail_pharmacie, name="api_detail_pharmacie"),
]
