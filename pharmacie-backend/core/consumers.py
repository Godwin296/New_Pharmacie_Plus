"""
🔴 Consumer WebSocket : file d'attente des ordonnances en temps réel, par tenant.

Principe :
- Chaque pharmacie (tenant) a son propre "groupe" Channels, nommé d'après son schema_name.
  Ainsi, un message envoyé pour la Pharmacie Dupont n'atteint JAMAIS un écran connecté à la
  Pharmacie Martin -- même isolation logique que pour les données en base.
- Chaque caissier connecté à /ws/ordonnances/ rejoint le groupe de SA pharmacie.
- Quand un agent valide/rejette une ordonnance (core/api.py), le serveur diffuse un message à
  tout le groupe : tous les autres écrans caisse connectés retirent immédiatement l'ordonnance
  de leur liste, sans avoir besoin de recharger la page.
- Le client final (qui suit le statut de SA commande) rejoint un groupe différent, propre à sa
  commande précise (pas tout le tenant), pour ne recevoir QUE les mises à jour qui le concernent.
"""
import json
import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class OrdonnanceCaisseConsumer(AsyncJsonWebsocketConsumer):
    """
    Canal pour les écrans de caisse (personnel uniquement) : reçoit en temps réel les
    nouvelles ordonnances en attente, et les notifications de traitement par d'autres agents.
    """

    async def connect(self):
        tenant = self.scope.get("tenant")
        user = self.scope.get("user")

        # 🔐 Double vérification : un tenant valide a été résolu (domaine reconnu),
        # ET l'utilisateur authentifié est bien un membre du staff DE CE tenant précis
        # (vérifié dans jwt_ws_middleware.py, qui cherche déjà l'utilisateur dans le bon schéma).
        if tenant is None or user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4001)  # code custom : non authentifié
            return

        if not user.is_staff:
            await self.close(code=4003)  # code custom : authentifié mais pas autorisé (rôle)
            return

        self.group_name = f"caisse_{tenant.schema_name}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info("Caisse connectée au temps réel : tenant=%s, user=%s", tenant.schema_name, user.username)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # --- Handlers des messages envoyés par le serveur (depuis core/api.py via group_send) ---

    async def nouvelle_ordonnance(self, event):
        """Un client vient d'uploader une nouvelle ordonnance -> à afficher dans la file d'attente."""
        await self.send_json({"type": "nouvelle_ordonnance", "commande": event["commande"]})

    async def nouvelle_demande_paiement(self, event):
        """Un client a soumis sa référence de transaction mobile money -> à vérifier par la caisse."""
        await self.send_json({"type": "nouvelle_demande_paiement", "commande": event["commande"]})

    async def ordonnance_traitee(self, event):
        """
        Une autre caisse a validé ou rejeté une ordonnance -> à retirer immédiatement
        de la file d'attente affichée sur CET écran (sans devoir cliquer "rafraîchir").
        """
        await self.send_json({
            "type": "ordonnance_traitee",
            "commande_id": event["commande_id"],
            "action": event["action"],  # "approuver" ou "rejeter"
        })


class SuiviCommandeConsumer(AsyncJsonWebsocketConsumer):
    """
    Canal pour un client final qui suit le statut de SA commande précise (page /panier).
    Contrairement au canal caisse (un groupe par tenant), ici c'est un groupe par commande :
    le client ne doit recevoir AUCUNE information sur les commandes des autres clients.
    """

    async def connect(self):
        tenant = self.scope.get("tenant")
        user = self.scope.get("user")

        if tenant is None or user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4001)
            return

        commande_id = self.scope["url_route"]["kwargs"]["commande_id"]

        # 🔐 Vérification d'appartenance : ce client a-t-il bien le droit de suivre CETTE commande ?
        # (on ne fait confiance qu'à une vérification en base, jamais à l'id fourni dans l'URL seul)
        #
        # ⚠️ BUG CORRIGÉ : la résolution du tenant (TenantWebsocketMiddleware) bascule la connexion
        # sur le schéma "public" pour chercher le Domain correspondant, mais ne revient JAMAIS sur
        # le schéma du tenant après coup -- c'est au CONSUMER de le faire explicitement avant toute
        # requête sur ses propres modèles (Commande vit dans le schéma du tenant, pas dans public).
        # Sans schema_context() ici, la requête s'exécutait silencieusement contre le schéma public,
        # où la table core_commande n'existe pas -> ProgrammingError, et la connexion WebSocket
        # était fermée par un 500 avant même d'avoir pu être acceptée.
        from channels.db import database_sync_to_async
        from django_tenants.utils import schema_context
        from core.models import Commande

        @database_sync_to_async
        def _commande_appartient_au_client():
            with schema_context(tenant.schema_name):
                return Commande.objects.filter(id=commande_id, client__user=user).exists()

        if not await _commande_appartient_au_client():
            await self.close(code=4003)
            return

        self.group_name = f"commande_{commande_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def statut_mis_a_jour(self, event):
        """Le statut de la commande a changé (validée, rejetée...) -> notifie le client en direct."""
        await self.send_json({
            "type": "statut_mis_a_jour",
            "statut": event["statut"],
            "ordonnance_valide": event.get("ordonnance_valide"),
            "motif_refus": event.get("motif_refus"),
        })
