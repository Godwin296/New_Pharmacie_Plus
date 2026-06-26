from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/ordonnances/$", consumers.OrdonnanceCaisseConsumer.as_asgi()),
    re_path(r"ws/commandes/(?P<commande_id>\d+)/$", consumers.SuiviCommandeConsumer.as_asgi()),
]
