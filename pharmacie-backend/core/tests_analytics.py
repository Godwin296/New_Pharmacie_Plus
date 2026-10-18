"""
🧪 Tests du dashboard analytics avancé (core/analytics.py + GET /api/v1/boss/analytics/).

Jeu de données volontairement petit : chaque valeur attendue est calculable à la main
(voir le tableau ci-dessous), pour qu'un échec pointe une vraie erreur de calcul et pas
une erreur dans le test.

    Période courante  : 2026-10-01 -> 2026-10-10 (10 jours)
    Période précédente: 2026-09-21 -> 2026-09-30

    Produit A : prix 1000, achat 600, catégorie antalgique
    Produit B : prix  500, achat INCONNU, catégorie vitamine
    Produit C : prix  200, achat 100, stock 10, jamais vendu  -> "dormant"

    Courante :
      cmd1 guichet            02/10 09:30  A x2 -> CA 2000, marge 800
      cmd2 en ligne OrangeM.  03/10 14:10  B x2 -> CA 1000, marge inconnue
      cmd3 en ligne MTN MoMo  05/10 09:45  A x1 -> CA 1000, marge 400
      cmd4 NON PAYÉE          04/10        A x5 -> ignorée
    Précédente :
      cmd5 guichet            25/09 11:00  A x1 -> CA 1000

    => CA 4000 | 3 commandes | panier moyen 1333.33 | marge 1200
       CA avec coût connu 3000 -> couverture 75 % | taux de marge 40 %
       CA précédent 1000 -> +300 % ; commandes 1 -> 3 : +200 %
       pic à 9h (2 commandes, 3000)
"""
from datetime import date, datetime
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

from core import analytics
from core.models import Commande, ItemCommande, Produit

DEBUT = date(2026, 10, 1)
FIN = date(2026, 10, 10)


def _dt(jour, heure, minute=0, mois=10):
    return timezone.make_aware(datetime(2026, mois, jour, heure, minute))


class JeuDeDonnees(TenantTestCase):
    def setUp(self):
        self.A = Produit.objects.create(nom="A", prix=1000, prix_achat=600, quantite=100, categorie='antalgique')
        self.B = Produit.objects.create(nom="B", prix=500, prix_achat=None, quantite=100, categorie='vitamine')
        self.C = Produit.objects.create(nom="C", prix=200, prix_achat=100, quantite=10, categorie='antalgique')

        self.cmd1 = self._vente(self.A, 2, _dt(2, 9, 30), type_vente='guichet')
        self.cmd2 = self._vente(self.B, 2, _dt(3, 14, 10), moyen='orange_money')
        self.cmd3 = self._vente(self.A, 1, _dt(5, 9, 45), moyen='mtn_momo')
        self._vente(self.A, 5, _dt(4, 10), payee=False, statut='en_cours')
        self._vente(self.A, 1, _dt(25, 11, mois=9), type_vente='guichet')

    def _vente(self, produit, qte, quand, type_vente='en_ligne', moyen=None, payee=True, statut='payee'):
        cmd = Commande.objects.create(
            statut=statut, payee=payee, type_vente=type_vente, moyen_paiement=moyen,
        )
        ItemCommande.objects.create(commande=cmd, produit=produit, quantite=qte)
        # `date` est auto_now_add : seul update() permet de la fixer.
        Commande.objects.filter(pk=cmd.pk).update(date=quand)
        return cmd


class TestIndicateurs(JeuDeDonnees):

    def test_ca_nb_commandes_panier_moyen(self):
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['ca']['valeur'], Decimal('4000'))
        self.assertEqual(k['nb_commandes']['valeur'], 3)  # la commande non payée est exclue
        self.assertAlmostEqual(float(k['panier_moyen']['valeur']), 1333.33, places=2)

    def test_marge_exclut_les_lignes_sans_cout(self):
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        # 800 + 400 ; la ligne B (coût inconnu) n'est PAS comptée comme 100 % de marge.
        self.assertEqual(k['marge']['valeur'], Decimal('1200'))
        self.assertEqual(k['couverture_marge_pct'], 75.0)
        self.assertEqual(k['taux_marge_pct'], 40.0)

    def test_comparaison_avec_periode_precedente(self):
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['periode_precedente']['debut'], date(2026, 9, 21))
        self.assertEqual(k['periode_precedente']['fin'], date(2026, 9, 30))
        self.assertEqual(k['ca']['precedent'], Decimal('1000'))
        self.assertEqual(k['ca']['variation_pct'], 300.0)
        self.assertEqual(k['nb_commandes']['variation_pct'], 200.0)

    def test_variation_indefinie_si_periode_precedente_vide(self):
        # 2026-10-11 -> 2026-10-20 : précédente = 10/01-10/10 (non vide) ; on décale plus loin.
        k = analytics.kpis_avec_comparaison(date(2026, 1, 11), date(2026, 1, 20))
        self.assertIsNone(k['ca']['variation_pct'])
        self.assertEqual(k['ca']['valeur'], Decimal('0'))
        self.assertIsNone(k['taux_marge_pct'])
        self.assertIsNone(k['couverture_marge_pct'])
        self.assertEqual(k['panier_moyen']['valeur'], Decimal('0'))  # pas de division par zéro

    def test_cout_fige_au_moment_de_la_vente(self):
        """Changer le prix d'achat APRÈS coup ne doit pas réécrire la marge historique."""
        self.A.prix_achat = Decimal('900')
        self.A.save()
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['marge']['valeur'], Decimal('1200'))
        # ... mais une NOUVELLE vente utilise le nouveau coût (1000 - 900 = 100).
        self._vente(self.A, 1, _dt(6, 10), type_vente='guichet')
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['marge']['valeur'], Decimal('1300'))

    def test_ligne_ancienne_sans_cout_fige_retombe_sur_le_cout_actuel(self):
        ItemCommande.objects.filter(commande=self.cmd1).update(prix_achat_facture=None)
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['marge']['valeur'], Decimal('1200'))  # repli sur A.prix_achat = 600

    def test_bornes_de_periode_inclusives(self):
        """Une vente le dernier jour (23:59) est comptée, celle du lendemain 00:00 non."""
        self._vente(self.A, 1, _dt(10, 23, 59), type_vente='guichet')
        self._vente(self.A, 1, _dt(11, 0, 0), type_vente='guichet')
        k = analytics.kpis_avec_comparaison(DEBUT, FIN)
        self.assertEqual(k['nb_commandes']['valeur'], 4)


class TestRepartitions(JeuDeDonnees):

    def test_repartition_par_moyen_de_paiement(self):
        rep = {r['moyen']: r for r in analytics.repartition_paiement(DEBUT, FIN)}
        self.assertEqual(rep['cash_guichet']['ca'], Decimal('2000'))
        self.assertEqual(rep['cash_guichet']['part_pct'], 50.0)
        self.assertEqual(rep['orange_money']['ca'], Decimal('1000'))
        self.assertEqual(rep['mtn_momo']['nb_commandes'], 1)
        self.assertEqual(sum(r['part_pct'] for r in rep.values()), 100.0)
        self.assertEqual(analytics.repartition_paiement(DEBUT, FIN)[0]['moyen'], 'cash_guichet')

    def test_repartition_par_categorie(self):
        rep = {r['categorie']: r for r in analytics.repartition_categories(DEBUT, FIN)}
        self.assertEqual(rep['antalgique']['ca'], Decimal('3000'))
        self.assertEqual(rep['antalgique']['quantite'], 3)
        self.assertEqual(rep['antalgique']['libelle'], 'Antalgiques')
        self.assertEqual(rep['vitamine']['part_pct'], 25.0)

    def test_heures_de_pointe_en_heure_locale(self):
        h = analytics.heures_de_pointe(DEBUT, FIN)
        self.assertEqual(len(h['par_heure']), 24)  # zéros inclus
        self.assertEqual(h['heure_de_pointe'], 9)
        self.assertEqual(h['par_heure'][9]['nb_commandes'], 2)
        self.assertEqual(h['par_heure'][9]['ca'], Decimal('3000'))
        self.assertEqual(h['par_heure'][14]['nb_commandes'], 1)
        self.assertEqual(h['par_heure'][3]['nb_commandes'], 0)

    def test_heure_de_pointe_absente_sans_vente(self):
        h = analytics.heures_de_pointe(date(2026, 1, 1), date(2026, 1, 2))
        self.assertIsNone(h['heure_de_pointe'])

    def test_produits_dormants(self):
        d = analytics.produits_dormants(DEBUT, FIN)
        self.assertEqual([p['nom'] for p in d], ['C'])  # A et B ont été vendus
        self.assertEqual(d[0]['valeur_stock'], Decimal('1000'))  # 10 x coût 100
        self.assertTrue(d[0]['cout_connu'])


class TestEndpoint(JeuDeDonnees):

    def setUp(self):
        super().setUp()
        self.http = TenantClient(self.tenant)
        self.admin = User.objects.create_superuser('boss', 'b@t.local', 'pw')
        self.token = str(RefreshToken.for_user(self.admin).access_token)

    def _get(self, qs='', token='auto', **extra):
        tok = self.token if token == 'auto' else token
        headers = {'HTTP_AUTHORIZATION': f'Bearer {tok}'} if tok else {}
        return self.http.get(f'/api/v1/boss/analytics/{qs}', **headers, **extra)

    def test_reponse_complete(self):
        r = self._get('?debut=2026-10-01&fin=2026-10-10')
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d['ca']['valeur'], 4000.0)
        self.assertEqual(d['ca']['variation_pct'], 300.0)
        self.assertEqual(d['periode']['debut'], '2026-10-01')
        self.assertEqual(d['heures']['heure_de_pointe'], 9)
        self.assertEqual(len(d['repartition_paiement']), 3)

    def test_periode_par_defaut_30_jours(self):
        r = self._get()
        self.assertEqual(r.status_code, 200)
        d = r.json()
        debut = date.fromisoformat(d['periode']['debut'])
        fin = date.fromisoformat(d['periode']['fin'])
        self.assertEqual((fin - debut).days + 1, 30)
        self.assertEqual(fin, timezone.localdate())

    def test_dates_invalides(self):
        for qs in ('?debut=pas-une-date', '?debut=2026-02-30&fin=2026-03-01'):
            self.assertEqual(self._get(qs).status_code, 400, qs)

    def test_debut_apres_fin(self):
        self.assertEqual(self._get('?debut=2026-10-10&fin=2026-10-01').status_code, 400)

    def test_periode_trop_longue(self):
        self.assertEqual(self._get('?debut=2024-01-01&fin=2026-01-01').status_code, 400)

    def test_message_erreur_traduit(self):
        r = self._get('?debut=x', HTTP_ACCEPT_LANGUAGE='en')
        self.assertEqual(r.json()['error'], 'Invalid dates (expected format: YYYY-MM-DD)')

    def test_refuse_sans_authentification(self):
        self.assertIn(self._get(token=None).status_code, (401, 403))

    def test_refuse_un_staff_non_admin(self):
        caissier = User.objects.create_user('caissier', 'c@t.local', 'pw', is_staff=True)
        tok = str(RefreshToken.for_user(caissier).access_token)
        self.assertEqual(self._get(token=tok).status_code, 403)
