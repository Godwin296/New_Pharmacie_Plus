"""
🧪 Tests unitaires du moteur de prédiction (core/prediction.py).

Volontairement écrits en `unittest` pur (pas TestCase Django) : ce module ne touche
à AUCUNE base de données, donc ces tests tournent instantanément, même sans
Postgres/Redis. Exécution directe :

    venv_test/bin/python -m unittest core.tests_prediction -v

Ils sont aussi collectés automatiquement par `manage.py test core` (Django sait
lancer du unittest classique en plus de ses propres TestCase).
"""

import unittest
import statistics
from datetime import date, timedelta

from core.prediction import (
    construire_serie_journaliere,
    construire_serie_hebdomadaire,
    moyenne_mobile,
    regression_lineaire,
    lissage_holt,
    predire_consommation_future,
    calculer_ecart_type,
    evaluer_fiabilite,
    calculer_prediction_produit,
)


class TestConstruireSerieJournaliere(unittest.TestCase):
    def test_remplit_les_jours_sans_vente_a_zero(self):
        d0 = date(2026, 1, 1)
        mouvements = [(d0, 5), (d0 + timedelta(days=2), 3)]
        serie = construire_serie_journaliere(mouvements, d0, d0 + timedelta(days=2))
        self.assertEqual(serie, [5.0, 0.0, 3.0])

    def test_cumule_plusieurs_mouvements_le_meme_jour(self):
        d0 = date(2026, 1, 1)
        mouvements = [(d0, 2), (d0, 3)]
        serie = construire_serie_journaliere(mouvements, d0, d0)
        self.assertEqual(serie, [5.0])

    def test_serie_vide_si_aucun_mouvement_sur_la_periode(self):
        d0 = date(2026, 1, 1)
        serie = construire_serie_journaliere([], d0, d0 + timedelta(days=4))
        self.assertEqual(serie, [0.0] * 5)


class TestMoyenneMobile(unittest.TestCase):
    def test_moyenne_simple(self):
        self.assertEqual(moyenne_mobile([1, 2, 3, 4, 5], 5), 3.0)

    def test_fenetre_plus_grande_que_la_serie_utilise_toute_la_serie(self):
        self.assertEqual(moyenne_mobile([2, 4], 30), 3.0)

    def test_ne_garde_que_les_dernieres_valeurs(self):
        # Fenêtre de 2 sur [1, 1, 1, 9, 9] -> moyenne des deux dernières seulement
        self.assertEqual(moyenne_mobile([1, 1, 1, 9, 9], 2), 9.0)

    def test_serie_vide_retourne_none(self):
        self.assertIsNone(moyenne_mobile([], 7))


class TestRegressionLineaire(unittest.TestCase):
    def test_tendance_haussiere_parfaite(self):
        # y = 2x + 1 exactement -> pente attendue 2.0
        y = [1, 3, 5, 7, 9]
        pente, ordonnee = regression_lineaire(y)
        self.assertAlmostEqual(pente, 2.0)
        self.assertAlmostEqual(ordonnee, 1.0)

    def test_serie_constante_pente_nulle(self):
        pente, ordonnee = regression_lineaire([4, 4, 4, 4])
        self.assertAlmostEqual(pente, 0.0)
        self.assertAlmostEqual(ordonnee, 4.0)

    def test_moins_de_deux_points(self):
        self.assertEqual(regression_lineaire([]), (0.0, 0.0))
        self.assertEqual(regression_lineaire([7]), (0.0, 7))

    def test_tendance_baissiere(self):
        pente, _ = regression_lineaire([10, 8, 6, 4, 2])
        self.assertLess(pente, 0)


class TestLissageHolt(unittest.TestCase):
    def test_serie_vide(self):
        self.assertEqual(lissage_holt([]), (0.0, 0.0))

    def test_un_seul_point(self):
        self.assertEqual(lissage_holt([5]), (5, 0.0))

    def test_serie_constante_tendance_convergente_vers_zero(self):
        niveau, tendance = lissage_holt([10] * 40)
        self.assertAlmostEqual(niveau, 10, delta=0.5)
        self.assertAlmostEqual(tendance, 0.0, delta=0.1)

    def test_detecte_une_tendance_haussiere(self):
        serie = [float(i) for i in range(1, 31)]  # 1, 2, ..., 30
        niveau, tendance = lissage_holt(serie)
        self.assertGreater(tendance, 0)
        self.assertGreater(niveau, 20)  # doit suivre la hausse, pas rester bloqué au début

    def test_robuste_a_un_pic_isole_de_bruit_en_debut_de_serie(self):
        # Un unique pic au tout premier jour ne doit pas fausser durablement la tendance
        # (contrairement à une initialisation naïve basée sur le seul premier écart).
        serie = [50.0] + [5.0] * 40
        niveau, tendance = lissage_holt(serie)
        self.assertAlmostEqual(niveau, 5.0, delta=1.5)


class TestConstruireSerieHebdomadaire(unittest.TestCase):
    def test_agrege_par_blocs_de_sept(self):
        serie = [1.0] * 14
        self.assertEqual(construire_serie_hebdomadaire(serie), [7.0, 7.0])

    def test_ecarte_le_reliquat_en_debut_pas_en_fin(self):
        # 17 jours -> 17 % 7 = 3 jours de reliquat écartés au DÉBUT, 2 semaines complètes gardées
        serie = [100.0, 100.0, 100.0] + [1.0] * 14
        self.assertEqual(construire_serie_hebdomadaire(serie), [7.0, 7.0])

    def test_serie_vide(self):
        self.assertEqual(construire_serie_hebdomadaire([]), [])

    def test_moins_dune_semaine_ne_produit_aucun_bloc(self):
        self.assertEqual(construire_serie_hebdomadaire([1, 2, 3]), [])


class TestPredireConsommationFutureAmortie(unittest.TestCase):
    def test_tendance_amortie_ne_seffondre_pas_sur_serie_globalement_stable_mais_bruitee(self):
        # Consommation globalement stable à ~5/jour, avec un bruit jour-à-jour réaliste
        # (nombres entiers). Sans amortissement, un lissage naïf peut faire dériver la
        # prévision vers 0 en fin d'horizon à cause du bruit. On vérifie ici qu'elle reste
        # proche du niveau moyen observé même en fin d'horizon (30j).
        serie = [5, 4, 6, 5, 5, 6, 4, 5, 6, 5, 4, 5, 6, 5] * 3  # 42 jours, moyenne ~5.07, stable
        previsions = predire_consommation_future(serie, horizon_jours=30)
        self.assertGreater(previsions[-1], 2.5)  # ne s'effondre pas vers 0 en fin d'horizon
        self.assertLess(previsions[-1], 8.0)     # ni ne s'envole

    def test_un_seul_jour_isole_a_zero_ne_fait_pas_seffondrer_la_prevision(self):
        # Cas réel rencontré en test avec Postgres : 89 jours à ~5/jour de moyenne, puis UN
        # SEUL jour à 0 (produit simplement pas vendu ce jour précis -- banal). L'agrégation
        # hebdomadaire doit absorber ce bruit ponctuel au lieu de le laisser dominer la fin
        # de la série journalière brute.
        serie = [5.0] * 89 + [0.0]
        previsions = predire_consommation_future(serie, horizon_jours=7)
        moyenne_prevue = statistics.fmean(previsions)
        self.assertGreater(moyenne_prevue, 3.5)  # reste proche du rythme réel (~5/j), pas écrasé par le 0 isolé

    def test_historique_court_utilise_le_repli_journalier(self):
        # Moins de 2 semaines complètes -> repli sur le lissage journalier direct.
        previsions = predire_consommation_future([5, 5, 5, 5, 5], horizon_jours=5)
        self.assertEqual(len(previsions), 5)
        self.assertTrue(all(v >= 0 for v in previsions))


class TestPredireConsommationFuture(unittest.TestCase):
    def test_previsions_jamais_negatives_meme_avec_tendance_baissiere_forte(self):
        serie = [50, 40, 30, 20, 10, 0, 0, 0]
        previsions = predire_consommation_future(serie, horizon_jours=10)
        self.assertEqual(len(previsions), 10)
        self.assertTrue(all(v >= 0 for v in previsions))

    def test_nombre_de_jours_respecte(self):
        previsions = predire_consommation_future([5, 5, 5, 5, 5], horizon_jours=14)
        self.assertEqual(len(previsions), 14)


class TestEcartType(unittest.TestCase):
    def test_serie_constante_ecart_type_nul(self):
        self.assertEqual(calculer_ecart_type([5, 5, 5, 5]), 0.0)

    def test_moins_de_deux_points(self):
        self.assertEqual(calculer_ecart_type([5]), 0.0)
        self.assertEqual(calculer_ecart_type([]), 0.0)

    def test_ecart_type_positif_si_variabilite(self):
        self.assertGreater(calculer_ecart_type([1, 10, 2, 9, 3, 8]), 0)


class TestEvaluerFiabilite(unittest.TestCase):
    def test_historique_insuffisant(self):
        self.assertEqual(evaluer_fiabilite(5, ecart_type_demande=1, moyenne_demande=10), "insuffisante")

    def test_moyenne_nulle_est_insuffisante(self):
        self.assertEqual(evaluer_fiabilite(90, ecart_type_demande=0, moyenne_demande=0), "insuffisante")

    def test_haute_fiabilite_beaucoup_de_donnees_faible_variabilite(self):
        self.assertEqual(evaluer_fiabilite(90, ecart_type_demande=1, moyenne_demande=10), "haute")

    def test_faible_fiabilite_forte_variabilite(self):
        self.assertEqual(evaluer_fiabilite(90, ecart_type_demande=20, moyenne_demande=10), "faible")


class TestCalculerPredictionProduit(unittest.TestCase):
    def test_produit_stable_donne_une_prediction_coherente(self):
        # 90 jours, consommation stable de 4 unités/jour
        serie = [4.0] * 90
        resultat = calculer_prediction_produit(
            serie_journaliere=serie,
            quantite_stock_actuelle=100,
            seuil_alerte=10,
            lead_time_jours=7,
        )
        self.assertAlmostEqual(resultat["consommation_moy_7j"], 4.0, delta=0.5)
        self.assertAlmostEqual(resultat["consommation_moy_30j"], 4.0, delta=0.5)
        self.assertAlmostEqual(resultat["tendance_jour"], 0.0, delta=0.05)
        self.assertEqual(resultat["fiabilite"], "haute")
        # 100 unités / ~4 par jour -> rupture simulée aux alentours du 25e jour (dans l'horizon 30j),
        # largement après le lead time de 7 jours -> pas une urgence immédiate.
        self.assertIsNotNone(resultat["jours_avant_rupture"])
        self.assertGreater(resultat["jours_avant_rupture"], resultat["lead_time_jours"])

    def test_stock_critique_predit_une_rupture_proche(self):
        serie = [10.0] * 60  # grosse consommation régulière
        resultat = calculer_prediction_produit(
            serie_journaliere=serie,
            quantite_stock_actuelle=15,  # à peine 1.5 jour de stock
            seuil_alerte=5,
            lead_time_jours=7,
        )
        self.assertIsNotNone(resultat["jours_avant_rupture"])
        self.assertLessEqual(resultat["jours_avant_rupture"], 3)
        self.assertGreater(resultat["quantite_a_commander"], 0)

    def test_produit_jamais_vendu_ne_declenche_pas_de_commande_absurde(self):
        serie = [0.0] * 90
        resultat = calculer_prediction_produit(
            serie_journaliere=serie,
            quantite_stock_actuelle=50,
            seuil_alerte=10,
            lead_time_jours=7,
        )
        self.assertEqual(resultat["consommation_moy_30j"], 0.0)
        self.assertIsNone(resultat["jours_avant_rupture"])
        # Sans consommation, la seule "commande" possible reste bornée au seuil de sécurité minimal
        self.assertLessEqual(resultat["quantite_a_commander"], 10)

    def test_historique_court_donne_fiabilite_insuffisante(self):
        serie = [3.0] * 5
        resultat = calculer_prediction_produit(
            serie_journaliere=serie,
            quantite_stock_actuelle=20,
            seuil_alerte=5,
        )
        self.assertEqual(resultat["fiabilite"], "insuffisante")

    def test_tendance_haussiere_augmente_la_quantite_recommandee(self):
        serie_stable = [5.0] * 60
        serie_haussiere = [float(i) for i in range(1, 61)]  # forte hausse progressive

        resultat_stable = calculer_prediction_produit(
            serie_journaliere=serie_stable, quantite_stock_actuelle=100, seuil_alerte=10,
        )
        resultat_hausse = calculer_prediction_produit(
            serie_journaliere=serie_haussiere, quantite_stock_actuelle=100, seuil_alerte=10,
        )
        self.assertGreater(
            resultat_hausse["quantite_a_commander"],
            resultat_stable["quantite_a_commander"],
        )


if __name__ == "__main__":
    unittest.main()
