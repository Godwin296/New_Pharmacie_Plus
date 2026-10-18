"""
🧪 Tests de la marketplace.

Trois niveaux :
  1. Logique pure (utils.py) : validation de position, statut ouvert, prochain changement,
     résumé d'horaires -- sans base de données, avec de faux objets.
  2. API sur le domaine PLATEFORME (schéma public) : requêtes sur un hôte inconnu, que
     django-tenants route vers config.urls_public (SHOW_PUBLIC_IF_NO_TENANT_FOUND).
  3. API depuis un SOUS-DOMAINE de pharmacie (TenantTestCase) : contexte, accès à la
     marketplace, et réglages pharmacien (infos-marketplace).

Lancer :
    service postgresql start && service redis-server start
    venv/bin/python manage.py test marketplace -v 2
"""
from datetime import datetime, time
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import Client, SimpleTestCase, TestCase
from django.test.utils import CaptureQueriesContext
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from marketplace.models import HoraireOuverture
from marketplace.utils import (
    ParametreInvalide, est_ouvert_maintenant, lire_position, lire_rayon,
    prochain_changement, resume_horaires, valider_coordonnee, valider_services,
)
from tenants.models import Domain, Pharmacie

URL_LISTE = "/api/v1/marketplace/pharmacies/"
URL_CARTE = "/api/v1/marketplace/pharmacies/carte/"
URL_CONTEXTE = "/api/v1/contexte/"


# ──────────────────────────── 1. Logique pure ────────────────────────────

def faux_horaire(jour, ouverture=None, fermeture=None, ferme=False):
    return SimpleNamespace(
        jour_semaine=jour, ferme=ferme, heure_ouverture=ouverture, heure_fermeture=fermeture,
    )


def faux_pharmacie(horaires=(), ouvert_24h=False):
    return SimpleNamespace(
        ouvert_24h=ouvert_24h,
        horaires=SimpleNamespace(all=lambda: list(horaires)),
    )


def lundi(heure, minute=0):
    return datetime(2026, 10, 12, heure, minute)  # le 12/10/2026 est un lundi


def jour_precis(jour_du_mois, heure, minute=0):
    return datetime(2026, 10, jour_du_mois, heure, minute)  # 12 = lundi ... 18 = dimanche


SEMAINE_8H30_20H = [faux_horaire(j, time(8, 30), time(20, 0)) for j in range(6)] + [
    faux_horaire(6, ferme=True),
]


class TestLirePosition(SimpleTestCase):
    def test_absente(self):
        self.assertEqual(lire_position({}), (None, None))
        self.assertEqual(lire_position({'lat': '', 'lng': ''}), (None, None))

    def test_valide(self):
        self.assertEqual(lire_position({'lat': '4.05', 'lng': '9.70'}), (4.05, 9.70))

    def test_une_seule_valeur_refusee(self):
        with self.assertRaises(ParametreInvalide):
            lire_position({'lat': '4.05'})
        with self.assertRaises(ParametreInvalide):
            lire_position({'lng': '9.70'})

    def test_valeurs_refusees(self):
        for lat, lng in [('abc', '9'), ('nan', '9'), ('4', 'inf'), ('91', '9'), ('4', '181'), ('-91', '0')]:
            with self.subTest(lat=lat, lng=lng), self.assertRaises(ParametreInvalide):
                lire_position({'lat': lat, 'lng': lng})

    def test_bornes_incluses(self):
        self.assertEqual(lire_position({'lat': '90', 'lng': '-180'}), (90.0, -180.0))


class TestLireRayon(SimpleTestCase):
    def test_absent(self):
        self.assertIsNone(lire_rayon({}, True))

    def test_valide(self):
        self.assertEqual(lire_rayon({'rayon_km': '5'}, True), 5.0)

    def test_sans_position_refuse(self):
        with self.assertRaises(ParametreInvalide):
            lire_rayon({'rayon_km': '5'}, False)

    def test_valeurs_refusees(self):
        for brut in ['abc', '0', '-3', '501', 'nan', 'inf']:
            with self.subTest(brut=brut), self.assertRaises(ParametreInvalide):
                lire_rayon({'rayon_km': brut}, True)


class TestValidationReglages(SimpleTestCase):
    def test_coordonnee(self):
        self.assertEqual(valider_coordonnee("4.5", "latitude", 90), 4.5)
        self.assertEqual(valider_coordonnee(0, "latitude", 90), 0.0)  # 0 est une vraie valeur, pas "vide"
        self.assertIsNone(valider_coordonnee(None, "latitude", 90))
        self.assertIsNone(valider_coordonnee("  ", "latitude", 90))
        for mauvaise in ["abc", "nan", 95, [1]]:
            with self.subTest(mauvaise=mauvaise), self.assertRaises(ParametreInvalide):
                valider_coordonnee(mauvaise, "latitude", 90)

    def test_services(self):
        self.assertEqual(valider_services(["vaccins", "conseils", "vaccins"]), ["vaccins", "conseils"])
        self.assertEqual(valider_services(None), [])
        self.assertEqual(valider_services([]), [])
        with self.assertRaises(ParametreInvalide):
            valider_services(["vaccins", "inconnu"])
        with self.assertRaises(ParametreInvalide):
            valider_services("vaccins")


class TestHoraires(SimpleTestCase):
    def test_ouvert_pendant_la_plage(self):
        p = faux_pharmacie(SEMAINE_8H30_20H)
        self.assertTrue(est_ouvert_maintenant(p, lundi(10)))
        self.assertTrue(est_ouvert_maintenant(p, lundi(8, 30)))   # bornes incluses
        self.assertTrue(est_ouvert_maintenant(p, lundi(20, 0)))

    def test_ferme_hors_plage(self):
        p = faux_pharmacie(SEMAINE_8H30_20H)
        self.assertFalse(est_ouvert_maintenant(p, lundi(8, 29)))
        self.assertFalse(est_ouvert_maintenant(p, lundi(20, 1)))

    def test_jour_ferme_explicite(self):
        self.assertFalse(est_ouvert_maintenant(faux_pharmacie(SEMAINE_8H30_20H), jour_precis(18, 12)))

    def test_jour_sans_ligne_compte_comme_ferme(self):
        # Seul le lundi est renseigné : le mardi n'est pas "inconnu", il est fermé.
        p = faux_pharmacie([faux_horaire(0, time(8), time(20))])
        self.assertFalse(est_ouvert_maintenant(p, jour_precis(13, 12)))

    def test_aucun_horaire_renseigne_donne_none(self):
        self.assertIsNone(est_ouvert_maintenant(faux_pharmacie([]), lundi(10)))

    def test_24h(self):
        self.assertTrue(est_ouvert_maintenant(faux_pharmacie([], ouvert_24h=True), lundi(3)))

    def test_prochain_changement_ouvert_donne_la_fermeture(self):
        r = prochain_changement(faux_pharmacie(SEMAINE_8H30_20H), lundi(10))
        self.assertEqual(r, {"type": "fermeture", "heure": "20:00", "jour_semaine": 0, "aujourdhui": True})

    def test_prochain_changement_avant_ouverture(self):
        r = prochain_changement(faux_pharmacie(SEMAINE_8H30_20H), lundi(7))
        self.assertEqual(r, {"type": "ouverture", "heure": "08:30", "jour_semaine": 0, "aujourdhui": True})

    def test_prochain_changement_apres_fermeture_donne_demain(self):
        r = prochain_changement(faux_pharmacie(SEMAINE_8H30_20H), lundi(21))
        self.assertEqual(r, {"type": "ouverture", "heure": "08:30", "jour_semaine": 1, "aujourdhui": False})

    def test_prochain_changement_dimanche_ferme_donne_lundi(self):
        r = prochain_changement(faux_pharmacie(SEMAINE_8H30_20H), jour_precis(18, 12))
        self.assertEqual(r, {"type": "ouverture", "heure": "08:30", "jour_semaine": 0, "aujourdhui": False})

    def test_prochain_changement_inconnu_ou_h24(self):
        self.assertIsNone(prochain_changement(faux_pharmacie([]), lundi(10)))
        self.assertIsNone(prochain_changement(faux_pharmacie([], ouvert_24h=True), lundi(10)))

    def test_prochain_changement_un_seul_jour_par_semaine(self):
        p = faux_pharmacie([faux_horaire(0, time(8), time(12))])
        r = prochain_changement(p, lundi(15))  # lundi après la fermeture -> lundi prochain
        self.assertEqual(r, {"type": "ouverture", "heure": "08:00", "jour_semaine": 0, "aujourdhui": False})

    def test_resume_regroupe_les_jours_consecutifs(self):
        self.assertEqual(
            resume_horaires(faux_pharmacie(SEMAINE_8H30_20H)),
            [{"jour_debut": 0, "jour_fin": 5, "ouverture": "08:30", "fermeture": "20:00"}],
        )

    def test_resume_separe_les_horaires_differents(self):
        p = faux_pharmacie(
            [faux_horaire(j, time(9), time(19)) for j in range(5)] + [faux_horaire(5, time(9), time(13))]
        )
        self.assertEqual(resume_horaires(p), [
            {"jour_debut": 0, "jour_fin": 4, "ouverture": "09:00", "fermeture": "19:00"},
            {"jour_debut": 5, "jour_fin": 5, "ouverture": "09:00", "fermeture": "13:00"},
        ])

    def test_resume_ne_fusionne_pas_des_jours_non_consecutifs(self):
        p = faux_pharmacie([faux_horaire(0, time(9), time(17)), faux_horaire(2, time(9), time(17))])
        self.assertEqual(len(resume_horaires(p)), 2)

    def test_resume_vide_pour_h24_et_sans_horaire(self):
        self.assertEqual(resume_horaires(faux_pharmacie([], ouvert_24h=True)), [])
        self.assertEqual(resume_horaires(faux_pharmacie([])), [])


# ───────────────────── 2. API sur le domaine plateforme ─────────────────────

def creer_pharmacie(schema, nom, latitude=None, longitude=None, domaine=True, **extra):
    """
    Crée une Pharmacie SANS créer son schéma PostgreSQL (auto_create_schema désactivé sur
    l'instance) : ces tests ne lisent que la table publique, inutile de payer plusieurs
    secondes de migrations par pharmacie.
    """
    pharmacie = Pharmacie(
        schema_name=schema, nom=nom, nom_public=extra.pop('nom_public', nom),
        proprietaire_email=f"{schema}@test.local", latitude=latitude, longitude=longitude, **extra,
    )
    pharmacie.auto_create_schema = False
    pharmacie.save()
    if domaine:
        Domain.objects.create(domain=f"{schema}.test.local", tenant=pharmacie, is_primary=True)
    return pharmacie


class TestAPIPlateforme(TestCase):
    """Hôte 'testserver' = aucun Domain enregistré -> schéma public + config.urls_public."""

    def setUp(self):
        self.client = Client()

    def noms(self, reponse):
        return [p['nom'] for p in reponse.json()['results']]

    def test_liste_publique_sans_authentification(self):
        creer_pharmacie('alpha', 'Alpha')
        r = self.client.get(URL_LISTE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['count'], 1)

    def test_aucun_logo_de_pharmacie_expose(self):
        """Règle de marque : la marketplace n'affiche que Pharmacie+, jamais le logo d'un tenant."""
        creer_pharmacie('alpha', 'Alpha', latitude=4.05, longitude=9.7, logo_public='marketplace/logos/alpha.png')
        for url in (URL_LISTE, URL_CARTE):
            corps = self.client.get(url).json()['results'][0]
            self.assertNotIn('logo', corps)
            self.assertNotIn('logo_public', corps)
        pharmacie = Pharmacie.objects.get(schema_name='alpha')
        detail = self.client.get(f"{URL_LISTE}{pharmacie.id}/").json()
        self.assertNotIn('logo', detail)
        self.assertNotIn('logo_public', detail)

    def test_exclut_inactive_sans_domaine_et_tenant_public(self):
        creer_pharmacie('alpha', 'Alpha')
        creer_pharmacie('inactive', 'Inactive', actif=False)
        creer_pharmacie('orpheline', 'Orpheline', domaine=False)
        creer_pharmacie('public', 'Plateforme')  # la ligne que django-tenants impose pour le schéma public
        self.assertEqual(self.noms(self.client.get(URL_LISTE)), ['Alpha'])

    def test_tri_alphabetique_insensible_a_la_casse_sans_position(self):
        for schema, nom in [('c', 'zebre'), ('a', 'Alpha'), ('b', 'beta')]:
            creer_pharmacie(schema, nom)
        self.assertEqual(self.noms(self.client.get(URL_LISTE)), ['Alpha', 'beta', 'zebre'])

    def test_nom_replie_sur_le_nom_du_tenant(self):
        creer_pharmacie('neuve', 'Pharmacie Neuve', nom_public='')
        self.assertEqual(self.noms(self.client.get(URL_LISTE)), ['Pharmacie Neuve'])

    def test_tri_par_distance_et_champ_distance(self):
        creer_pharmacie('loin', 'Loin', 3.848, 11.5021)     # Yaoundé
        creer_pharmacie('proche', 'Proche', 4.0511, 9.7679)  # Douala
        creer_pharmacie('inconnue', 'Inconnue')               # sans coordonnées
        r = self.client.get(URL_LISTE, {'lat': '4.05', 'lng': '9.70'})
        self.assertEqual(self.noms(r), ['Proche', 'Loin', 'Inconnue'])
        distances = [p['distance_km'] for p in r.json()['results']]
        self.assertEqual(distances[0], 7.5)
        self.assertGreater(distances[1], 150)
        self.assertIsNone(distances[2])

    def test_distance_absente_sans_position(self):
        creer_pharmacie('alpha', 'Alpha', 4.0, 9.7)
        self.assertIsNone(self.client.get(URL_LISTE).json()['results'][0]['distance_km'])

    def test_rayon_filtre_et_exclut_les_pharmacies_sans_coordonnees(self):
        creer_pharmacie('proche', 'Proche', 4.0511, 9.7679)
        creer_pharmacie('loin', 'Loin', 3.848, 11.5021)
        creer_pharmacie('inconnue', 'Inconnue')
        r = self.client.get(URL_LISTE, {'lat': '4.05', 'lng': '9.70', 'rayon_km': '50'})
        self.assertEqual(self.noms(r), ['Proche'])

    def test_recherche_sur_nom_et_adresse_insensible_a_la_casse(self):
        creer_pharmacie('a', 'Pharmacie Centrale', adresse_public='12 Place de l\'Eglise')
        creer_pharmacie('b', 'Pharmacie des Lilas', adresse_public='45 Rue Saint-Lazare')
        self.assertEqual(self.noms(self.client.get(URL_LISTE, {'q': 'CENTRALE'})), ['Pharmacie Centrale'])
        self.assertEqual(self.noms(self.client.get(URL_LISTE, {'q': 'lazare'})), ['Pharmacie des Lilas'])
        self.assertEqual(self.client.get(URL_LISTE, {'q': 'introuvable'}).json()['count'], 0)

    def test_parametres_invalides_renvoient_400(self):
        creer_pharmacie('alpha', 'Alpha')
        cas = [
            {'lat': '4.05'},                                   # lng manquant
            {'lat': 'abc', 'lng': '9'},
            {'lat': 'nan', 'lng': '9'},
            {'lat': '95', 'lng': '9'},
            {'rayon_km': '10'},                                # rayon sans position
            {'lat': '4', 'lng': '9', 'rayon_km': '-1'},
            {'lat': '4', 'lng': '9', 'rayon_km': '501'},
        ]
        for url in (URL_LISTE, URL_CARTE):
            for params in cas:
                with self.subTest(url=url, params=params):
                    r = self.client.get(url, params)
                    self.assertEqual(r.status_code, 400)
                    self.assertIn('error', r.json())

    def test_services_exposes(self):
        creer_pharmacie('alpha', 'Alpha', services=['vaccins', 'conseils'])
        creer_pharmacie('beta', 'Beta')
        par_nom = {p['nom']: p for p in self.client.get(URL_LISTE).json()['results']}
        self.assertEqual(par_nom['Alpha']['services'], ['vaccins', 'conseils'])
        self.assertEqual(par_nom['Beta']['services'], [])

    def test_champs_de_la_carte_pharmacie(self):
        creer_pharmacie('alpha', 'Alpha', 4.0, 9.7)
        carte = self.client.get(URL_LISTE).json()['results'][0]
        self.assertEqual(set(carte), {
            'id', 'nom', 'adresse', 'telephone', 'latitude', 'longitude', 'services',
            'ouvert_24h', 'ouvert_maintenant', 'prochain_changement', 'horaires_resume',
            'distance_km', 'sous_domaine',
        })
        self.assertEqual(carte['sous_domaine'], 'alpha.test.local')

    def test_statut_et_horaires_dans_la_liste(self):
        p = creer_pharmacie('alpha', 'Alpha')
        for jour in range(6):
            HoraireOuverture.objects.create(
                pharmacie=p, jour_semaine=jour, heure_ouverture=time(8, 30), heure_fermeture=time(20, 0),
            )
        HoraireOuverture.objects.create(pharmacie=p, jour_semaine=6, ferme=True)
        with patch('marketplace.utils.timezone.localtime', return_value=lundi(10)):
            carte = self.client.get(URL_LISTE).json()['results'][0]
        self.assertTrue(carte['ouvert_maintenant'])
        self.assertEqual(carte['prochain_changement']['heure'], '20:00')
        self.assertEqual(carte['horaires_resume'],
                         [{"jour_debut": 0, "jour_fin": 5, "ouverture": "08:30", "fermeture": "20:00"}])

    def test_statut_inconnu_sans_horaires_et_vrai_en_24h(self):
        creer_pharmacie('sans', 'Sans horaires')
        creer_pharmacie('nuit', 'De nuit', ouvert_24h=True)
        par_nom = {p['nom']: p for p in self.client.get(URL_LISTE).json()['results']}
        self.assertIsNone(par_nom['Sans horaires']['ouvert_maintenant'])
        self.assertTrue(par_nom['De nuit']['ouvert_maintenant'])

    def test_carte_exclut_les_pharmacies_sans_coordonnees(self):
        creer_pharmacie('avec', 'Avec', 4.0, 9.7)
        creer_pharmacie('sans', 'Sans')
        r = self.client.get(URL_CARTE).json()
        self.assertEqual(r['count'], 1)
        self.assertEqual([p['nom'] for p in r['results']], ['Avec'])
        self.assertEqual(set(r['results'][0]), {
            'id', 'nom', 'latitude', 'longitude', 'ouvert_maintenant', 'distance_km', 'sous_domaine',
        })

    def test_carte_respecte_position_et_rayon(self):
        creer_pharmacie('proche', 'Proche', 4.0511, 9.7679)
        creer_pharmacie('loin', 'Loin', 3.848, 11.5021)
        r = self.client.get(URL_CARTE, {'lat': '4.05', 'lng': '9.70', 'rayon_km': '50'}).json()
        self.assertEqual([p['nom'] for p in r['results']], ['Proche'])
        self.assertEqual(r['results'][0]['distance_km'], 7.5)

    def test_detail_avec_horaires_jour_par_jour(self):
        p = creer_pharmacie('alpha', 'Alpha', 4.0511, 9.7679)
        HoraireOuverture.objects.create(
            pharmacie=p, jour_semaine=0, heure_ouverture=time(9), heure_fermeture=time(18),
        )
        r = self.client.get(f"{URL_LISTE}{p.id}/", {'lat': '4.05', 'lng': '9.70'})
        self.assertEqual(r.status_code, 200)
        corps = r.json()
        self.assertEqual(corps['nom'], 'Alpha')
        self.assertEqual(corps['distance_km'], 7.5)
        self.assertEqual(len(corps['horaires']), 1)
        self.assertEqual(corps['horaires'][0]['jour_label'], 'Lundi')

    def test_detail_404_pour_inactive_inconnue_et_orpheline(self):
        inactive = creer_pharmacie('inactive', 'Inactive', actif=False)
        orpheline = creer_pharmacie('orpheline', 'Orpheline', domaine=False)
        for identifiant in (inactive.id, orpheline.id, 99999):
            self.assertEqual(self.client.get(f"{URL_LISTE}{identifiant}/").status_code, 404)

    def test_detail_position_invalide_400(self):
        p = creer_pharmacie('alpha', 'Alpha')
        self.assertEqual(self.client.get(f"{URL_LISTE}{p.id}/", {'lat': 'abc', 'lng': '1'}).status_code, 400)

    def test_nombre_de_requetes_independant_du_nombre_de_pharmacies(self):
        """Garde-fou N+1 : horaires et domaines sont préchargés, pas relus carte par carte."""
        def creer_avec_horaires(schema):
            p = creer_pharmacie(schema, schema.title(), 4.0, 9.7)
            for jour in range(7):
                HoraireOuverture.objects.create(
                    pharmacie=p, jour_semaine=jour, heure_ouverture=time(8), heure_fermeture=time(20),
                )

        creer_avec_horaires('une')
        with CaptureQueriesContext(connection) as avec_une:
            self.client.get(URL_LISTE, {'lat': '4', 'lng': '9'})
        for i in range(8):
            creer_avec_horaires(f'p{i}')
        with CaptureQueriesContext(connection) as avec_neuf:
            self.client.get(URL_LISTE, {'lat': '4', 'lng': '9'})
        self.assertEqual(len(avec_une), len(avec_neuf))

    def test_contexte_plateforme(self):
        r = self.client.get(URL_CONTEXTE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"contexte": "plateforme"})


# ──────────────────── 3. API depuis un sous-domaine de pharmacie ────────────────────

class TestAPISousDomaine(TenantTestCase):
    """TenantTestCase crée un vrai schéma + une pharmacie (self.tenant) avec son domaine."""

    def setUp(self):
        self.domaine = self.tenant.domains.first().domain
        self.client_http = Client(HTTP_HOST=self.domaine)

    def test_contexte_pharmacie(self):
        corps = self.client_http.get(URL_CONTEXTE).json()
        self.assertEqual(corps['contexte'], 'pharmacie')
        self.assertEqual(corps['pharmacie']['id'], self.tenant.id)
        self.assertNotIn('logo', corps['pharmacie'])

    def test_marketplace_aussi_accessible_depuis_un_sous_domaine(self):
        self.assertEqual(self.client_http.get(URL_LISTE).status_code, 200)

    def _api_admin(self):
        admin = User.objects.create_user('admin_mp', password='x', is_staff=True)
        api = APIClient(HTTP_HOST=self.domaine)
        api.force_authenticate(user=admin)
        return api

    def test_reglages_get_expose_services_et_vocabulaire(self):
        r = self._api_admin().get('/api/v1/infos-marketplace/')
        self.assertEqual(r.status_code, 200)
        corps = r.json()
        self.assertEqual(corps['services'], [])
        codes = [s['code'] for s in corps['services_disponibles']]
        self.assertIn('vaccins', codes)
        self.assertIn('libelle', corps['services_disponibles'][0])

    def test_reglages_enregistrent_position_et_services(self):
        api = self._api_admin()
        r = api.post('/api/v1/infos-marketplace/', {
            'latitude': 4.0511, 'longitude': 9.7679, 'services': ['vaccins', 'vaccins', 'conseils'],
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.tenant.refresh_from_db()
        self.assertEqual((self.tenant.latitude, self.tenant.longitude), (4.0511, 9.7679))
        self.assertEqual(self.tenant.services, ['vaccins', 'conseils'])

    def test_reglages_refusent_les_valeurs_invalides_sans_rien_ecrire(self):
        api = self._api_admin()
        for corps in [
            {'latitude': 'abc'}, {'latitude': 95}, {'longitude': 'nan'},
            {'services': ['inconnu']}, {'services': 'vaccins'},
            {'latitude': 4.0, 'services': ['inconnu']},   # une valeur valide + une invalide : rien n'est écrit
        ]:
            with self.subTest(corps=corps):
                r = api.post('/api/v1/infos-marketplace/', corps, format='json')
                self.assertEqual(r.status_code, 400)
                self.assertIn('error', r.json())
        self.tenant.refresh_from_db()
        self.assertIsNone(self.tenant.latitude)
        self.assertEqual(self.tenant.services, [])

    def test_reglages_permettent_d_effacer_une_coordonnee(self):
        api = self._api_admin()
        api.post('/api/v1/infos-marketplace/', {'latitude': 4.0, 'longitude': 9.0}, format='json')
        r = api.post('/api/v1/infos-marketplace/', {'latitude': None, 'longitude': ''}, format='json')
        self.assertEqual(r.status_code, 200)
        self.tenant.refresh_from_db()
        self.assertIsNone(self.tenant.latitude)
        self.assertIsNone(self.tenant.longitude)

    def test_reglages_reserves_aux_admins(self):
        anonyme = APIClient(HTTP_HOST=self.domaine)
        self.assertIn(anonyme.get('/api/v1/infos-marketplace/').status_code, (401, 403))
