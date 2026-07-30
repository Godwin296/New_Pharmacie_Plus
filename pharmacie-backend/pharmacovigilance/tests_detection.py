"""
🧪 Tests unitaires du moteur de détection (pharmacovigilance/detection.py).

Écrits en `unittest` pur (pas TestCase Django) : ce module ne touche à AUCUNE base de
données, donc ces tests tournent instantanément, même sans Postgres. Exécution directe :

    python3 -m unittest pharmacovigilance.tests_detection -v
"""
import unittest

from pharmacovigilance.detection import normaliser_texte, detecter_interactions


class TestNormaliserTexte(unittest.TestCase):
    def test_supprime_les_accents(self):
        self.assertEqual(normaliser_texte("Acétylsalicylique"), "acetylsalicylique")

    def test_minuscules(self):
        self.assertEqual(normaliser_texte("PARACETAMOL"), "paracetamol")

    def test_espaces_superflus_reduits(self):
        self.assertEqual(normaliser_texte("  Acide   Acétylsalicylique "), "acide acetylsalicylique")

    def test_texte_vide_ou_none(self):
        self.assertEqual(normaliser_texte(""), "")
        self.assertEqual(normaliser_texte(None), "")

    def test_variantes_orthographiques_convergent(self):
        # Le vrai scénario visé : plusieurs pharmaciens saisissent différemment le même
        # principe actif, mais la normalisation doit les faire correspondre.
        variantes = ["Paracétamol", "paracetamol", "PARACÉTAMOL", " Paracetamol "]
        normalisees = {normaliser_texte(v) for v in variantes}
        self.assertEqual(len(normalisees), 1)


def _regle(noms_a, noms_b, gravite="association_deconseillee", description="test", conduite=""):
    return {
        "noms_a": {normaliser_texte(n) for n in noms_a},
        "noms_b": {normaliser_texte(n) for n in noms_b},
        "gravite": gravite,
        "description": description,
        "conduite_a_tenir": conduite,
    }


class TestDetecterInteractions(unittest.TestCase):
    def test_detecte_une_interaction_simple(self):
        produits = [
            {"id": 1, "nom": "Doliprane 1000mg", "principe_actif": "Paracétamol"},
            {"id": 2, "nom": "Aspirine 500", "principe_actif": "Acide acétylsalicylique"},
        ]
        regles = [_regle(["Paracétamol"], ["Acide acétylsalicylique", "aspirine"])]
        alertes = detecter_interactions(produits, regles)
        self.assertEqual(len(alertes), 1)
        self.assertEqual(alertes[0]["produit_a"]["nom"], "Doliprane 1000mg")
        self.assertEqual(alertes[0]["produit_b"]["nom"], "Aspirine 500")

    def test_fonctionne_dans_les_deux_sens_a_b_et_b_a(self):
        # La règle est enregistrée (Paracétamol, Aspirine) mais les produits du panier
        # sont dans l'ordre inverse -- doit quand même détecter.
        produits = [
            {"id": 1, "nom": "Aspirine 500", "principe_actif": "Aspirine"},
            {"id": 2, "nom": "Doliprane 1000mg", "principe_actif": "Paracétamol"},
        ]
        regles = [_regle(["Paracétamol"], ["Aspirine"])]
        alertes = detecter_interactions(produits, regles)
        self.assertEqual(len(alertes), 1)

    def test_aucune_alerte_si_pas_de_regle_correspondante(self):
        produits = [
            {"id": 1, "nom": "Vitamine C", "principe_actif": "Acide ascorbique"},
            {"id": 2, "nom": "Doliprane", "principe_actif": "Paracétamol"},
        ]
        regles = [_regle(["Paracétamol"], ["Aspirine"])]
        self.assertEqual(detecter_interactions(produits, regles), [])

    def test_produit_sans_principe_actif_est_ignore_sans_planter(self):
        produits = [
            {"id": 1, "nom": "Produit non renseigné", "principe_actif": None},
            {"id": 2, "nom": "Doliprane", "principe_actif": "Paracétamol"},
            {"id": 3, "nom": "Aspirine 500", "principe_actif": "Aspirine"},
        ]
        regles = [_regle(["Paracétamol"], ["Aspirine"])]
        alertes = detecter_interactions(produits, regles)
        self.assertEqual(len(alertes), 1)  # la paire 2-3 est bien détectée malgré le produit 1

    def test_meme_produit_deux_fois_nest_pas_une_interaction_avec_lui_meme(self):
        # Cas limite : un produit apparaissant dans le lot avec le même id (ne devrait pas
        # arriver en pratique côté appelant, mais le moteur doit rester robuste).
        produits = [
            {"id": 1, "nom": "Doliprane", "principe_actif": "Paracétamol"},
            {"id": 1, "nom": "Doliprane", "principe_actif": "Paracétamol"},
        ]
        regles = [_regle(["Paracétamol"], ["Paracétamol"])]  # règle absurde exprès pour le test
        self.assertEqual(detecter_interactions(produits, regles), [])

    def test_variantes_orthographiques_du_meme_principe_actif_sont_reconnues(self):
        # Le pharmacien A a saisi "Aspirine", le pharmacien B "acide acétylsalicylique" --
        # la règle doit couvrir les deux via ses synonymes (noms_b contient les deux).
        produits = [
            {"id": 1, "nom": "Doliprane", "principe_actif": "paracetamol"},  # sans accent
            {"id": 2, "nom": "Aspégic", "principe_actif": "  Acide Acétylsalicylique  "},
        ]
        regles = [_regle(["Paracétamol"], ["aspirine", "Acide acétylsalicylique", "ASA"])]
        alertes = detecter_interactions(produits, regles)
        self.assertEqual(len(alertes), 1)

    def test_alertes_triees_par_gravite_contre_indication_dabord(self):
        produits = [
            {"id": 1, "nom": "A", "principe_actif": "SubstanceA"},
            {"id": 2, "nom": "B", "principe_actif": "SubstanceB"},
            {"id": 3, "nom": "C", "principe_actif": "SubstanceC"},
        ]
        regles = [
            _regle(["SubstanceA"], ["SubstanceB"], gravite="a_prendre_en_compte"),
            _regle(["SubstanceA"], ["SubstanceC"], gravite="contre_indication"),
        ]
        alertes = detecter_interactions(produits, regles)
        self.assertEqual(len(alertes), 2)
        self.assertEqual(alertes[0]["gravite"], "contre_indication")
        self.assertEqual(alertes[1]["gravite"], "a_prendre_en_compte")

    def test_panier_vide_ou_un_seul_produit_ne_plante_pas(self):
        self.assertEqual(detecter_interactions([], []), [])
        self.assertEqual(
            detecter_interactions([{"id": 1, "nom": "Solo", "principe_actif": "X"}], []),
            [],
        )


if __name__ == "__main__":
    unittest.main()
