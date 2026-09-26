"""
🧪 Tests d'intégration i18n : vraie requête HTTP, vrai schéma tenant PostgreSQL.

Contrairement à core/tests_i18n.py (pur, sans DB), ceux-ci ont besoin d'un tenant réel
-> TenantTestCase (django_tenants), qui crée un schéma PostgreSQL dédié pour la durée du
test puis le détruit. Nécessite TEST_RUNNER = 'django_tenants.test.runner.TenantTestRunner'
(voir config/settings.py) et Postgres démarré :

    service postgresql start && service redis-server start
    venv/bin/python manage.py test core.tests_i18n_integration -v 2

Couvre exactement le comportement vérifié manuellement en session (login, panier, emails) :
priorité préférence explicite du compte client > Accept-Language du navigateur > défaut fr.
"""
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from clients_publics.models import CompteClient
from core.models import Produit, Commande, ItemCommande
from core.emails import envoyer_email_confirmation_commande


class TestPrioriteLangueHTTP(TenantTestCase):
    """
    ⚠️ TenantTestCase crée déjà le schéma + exécute les migrations pour nous (self.tenant) ;
    pas besoin de rejouer seed.py ici, on crée uniquement les objets nécessaires à CE test.
    """

    def setUp(self):
        self.client_http = TenantClient(self.tenant)
        with schema_context(self.tenant.schema_name):
            self.compte = CompteClient.objects.create(
                email="i18n.integration@test.local",
                nom="Testeur Intégration",
            )
            self.compte.set_password("TestPass123!")
            self.compte.save()

    def _login(self):
        resp = self.client_http.post(
            "/api/v1/client/login/",
            data={"email": "i18n.integration@test.local", "password": "TestPass123!"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        return resp.json()["access"]

    def test_login_erreur_respecte_accept_language(self):
        """Avant authentification (login), seul Accept-Language peut déterminer la langue."""
        resp_en = self.client_http.post(
            "/api/v1/client/login/",
            data={"email": "i18n.integration@test.local", "password": "MAUVAIS"},
            content_type="application/json",
            HTTP_ACCEPT_LANGUAGE="en",
        )
        self.assertEqual(resp_en.json()["error"], "Invalid credentials")

        resp_fr = self.client_http.post(
            "/api/v1/client/login/",
            data={"email": "i18n.integration@test.local", "password": "MAUVAIS"},
            content_type="application/json",
            HTTP_ACCEPT_LANGUAGE="fr",
        )
        self.assertEqual(resp_fr.json()["error"], "Identifiants invalides")

    def test_preference_explicite_du_compte_gagne_sur_accept_language(self):
        """
        🎯 LE test qui verrouille le comportement voulu : une fois authentifié, la
        préférence ENREGISTRÉE du compte l'emporte sur l'Accept-Language envoyé par le
        navigateur -- pas l'inverse. C'est ce qui a été vérifié manuellement en session
        avec curl sur le tenant 'dupont' ; ce test fige ce même scénario durablement.
        """
        token = self._login()

        # Le compte a explicitement choisi l'anglais...
        resp = self.client_http.patch(
            "/api/v1/client/me/",
            data={"langue_preferee": "en"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(resp.status_code, 200)

        # ...mais son navigateur envoie Accept-Language: fr sur CETTE requête précise.
        with schema_context(self.tenant.schema_name):
            produit = Produit.objects.create(nom="Test i18n", prix=1000, quantite=10)

        resp = self.client_http.post(
            "/api/v1/panier/",
            data={"produit_id": produit.id, "quantite": "pas_un_nombre"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_ACCEPT_LANGUAGE="fr",
        )
        self.assertEqual(resp.status_code, 400)
        # La préférence explicite du compte (en) doit gagner : message en ANGLAIS malgré
        # Accept-Language: fr.
        self.assertEqual(resp.json()["error"], "Invalid quantity")

    def test_repli_sur_accept_language_sans_preference_explicite(self):
        """Contrôle négatif : sans préférence explicite (compte fraîchement créé), le
        comportement doit rester piloté par Accept-Language, pas rester bloqué en français."""
        token = self._login()

        with schema_context(self.tenant.schema_name):
            produit = Produit.objects.create(nom="Test i18n 2", prix=1000, quantite=10)

        resp = self.client_http.post(
            "/api/v1/panier/",
            data={"produit_id": produit.id, "quantite": "pas_un_nombre"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_ACCEPT_LANGUAGE="en",
        )
        self.assertEqual(resp.json()["error"], "Invalid quantity")


class TestEmailSuitLaLangueDuClientPasDuStaff(TenantTestCase):
    """
    Verrouille le correctif apporté en session : l'email transactionnel suit la langue du
    DESTINATAIRE (client), pas celle active au moment où le STAFF déclenche l'action.
    """

    def test_email_confirmation_en_anglais_meme_si_staff_en_francais(self):
        from django.utils import translation

        with schema_context(self.tenant.schema_name):
            client = CompteClient.objects.create(email="c@test.local", nom="Client EN")
            client.langue_preferee = "en"
            client.save()

            produit = Produit.objects.create(nom="Doliprane", prix=500, quantite=50)
            commande = Commande.objects.create(
                compte_client=client, statut="payee", type_vente="guichet", payee=True,
            )
            ItemCommande.objects.create(
                commande=commande, produit=produit, quantite=1, prix_facture=produit.prix,
            )

            # Simule le contexte réel : la requête HTTP de la caissière tourne en français.
            translation.activate("fr")

            captured = {}

            def fake_send_mail(subject, message, from_email, recipient_list, fail_silently):
                captured["subject"] = subject

            with patch("core.emails.send_mail", side_effect=fake_send_mail):
                envoyer_email_confirmation_commande(commande)

            self.assertIn("Receipt", captured["subject"])
            self.assertNotIn("Reçu", captured["subject"])
            # La langue active de la requête staff ne doit pas avoir été altérée durablement.
            self.assertEqual(translation.get_language(), "fr")
