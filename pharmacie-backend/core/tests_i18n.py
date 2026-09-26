"""
🧪 Tests unitaires de la logique i18n (core/emails.py::_langue_destinataire).

Volontairement écrits en `unittest` pur (pas TestCase Django, pas de tenant) : on teste
ici uniquement la LOGIQUE de sélection de langue (destinataire vs langue active), avec un
objet factice au lieu d'un vrai CompteClient -- pas besoin de DB ni de schéma tenant pour ça.
Exécution directe :

    venv/bin/python -m unittest core.tests_i18n -v

Le comportement HTTP de bout en bout (priorité préférence explicite > Accept-Language >
défaut, sur un vrai tenant) est couvert séparément par core/tests_i18n_integration.py
(TenantTestCase, nécessite Postgres).
"""
import unittest
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import translation
from django.utils.translation import gettext as _

from core.emails import _langue_destinataire


class FauxDestinataire:
    """Objet minimal imitant CompteClient (a langue_preferee) ou ClientGuichet (ne l'a pas)."""
    def __init__(self, langue_preferee=None):
        self.langue_preferee = langue_preferee


class TestLangueDestinataire(unittest.TestCase):

    def test_bascule_sur_la_langue_du_destinataire_meme_si_autre_langue_active(self):
        """
        Cas réel : la caissière (langue active = fr) valide un paiement pour un client
        dont la préférence enregistrée est 'en' -- l'email doit partir en anglais.
        """
        translation.activate('fr')
        destinataire = FauxDestinataire(langue_preferee='en')

        with _langue_destinataire(destinataire):
            self.assertEqual(translation.get_language(), 'en')
            self.assertEqual(_("Identifiants invalides"), "Invalid credentials")

    def test_restaure_la_langue_precedente_apres_le_bloc(self):
        """La langue active avant l'envoi (celle du staff) ne doit pas 'fuiter' après."""
        translation.activate('fr')
        destinataire = FauxDestinataire(langue_preferee='en')

        with _langue_destinataire(destinataire):
            pass  # composition de l'email

        self.assertEqual(translation.get_language(), 'fr')

    def test_repli_sur_defaut_si_pas_de_langue_preferee(self):
        """
        ClientGuichet (vente au comptoir, pas de compte) n'a pas de langue_preferee ->
        getattr défensif doit retomber sur LANGUAGE_CODE (fr) sans lever d'exception.
        """
        translation.activate('en')
        destinataire = FauxDestinataire(langue_preferee=None)

        with _langue_destinataire(destinataire):
            self.assertEqual(translation.get_language(), 'fr')

    def test_repli_sur_defaut_si_attribut_absent(self):
        """Un objet qui n'a même pas l'attribut langue_preferee (pas seulement None)."""
        class SansAttribut:
            pass

        translation.activate('en')
        with _langue_destinataire(SansAttribut()):
            self.assertEqual(translation.get_language(), 'fr')


class TestPrioriteTraduction(unittest.TestCase):
    """Vérifie que les chaînes marquées gettext se traduisent bien dans les deux langues."""

    def test_traduction_fr(self):
        with translation.override('fr'):
            self.assertEqual(_("Stock insuffisant"), "Stock insuffisant")

    def test_traduction_en(self):
        with translation.override('en'):
            self.assertEqual(_("Stock insuffisant"), "Insufficient stock")

    def test_message_avec_interpolation(self):
        with translation.override('en'):
            msg = _("Erreur technique : %(detail)s") % {"detail": "boom"}
            self.assertEqual(msg, "Technical error: boom")


if __name__ == '__main__':
    unittest.main()
