"""
🔬 MOTEUR DE DÉTECTION D'INTERACTIONS -- fonctions PURES (aucun accès DB), même principe
que core/prediction.py : testable en quelques millisecondes avec des données fabriquées,
sans Postgres. Le pont avec la base de données (récupération des règles + des produits
réels) vit dans `verifier_interactions_produits()` en bas de ce fichier.
"""
import unicodedata


def normaliser_texte(texte):
    """
    Normalise un texte pour un rapprochement robuste : minuscules, accents retirés, espaces
    superflus réduits. "Acide Acétylsalicylique", "acide acetylsalicylique" et
    "ACIDE  ACÉTYLSALICYLIQUE " donnent tous "acide acetylsalicylique".

    Nécessaire car `Produit.principe_actif` est un champ TEXTE LIBRE saisi par différents
    pharmaciens dans différentes pharmacies -- on ne peut pas compter sur une orthographe
    parfaitement uniforme.
    """
    if not texte:
        return ""
    sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode("ascii")
    return " ".join(sans_accents.lower().split())


def detecter_interactions(produits, regles):
    """
    Cœur pur de la détection, sans aucun accès base de données.

    `produits` : liste de dicts {"id": ..., "nom": ..., "principe_actif": ...} (le texte
    libre tel que saisi, pas encore normalisé -- c'est cette fonction qui s'en charge).

    `regles` : liste de dicts {"noms_a": {set de noms normalisés}, "noms_b": {set de noms
    normalisés}, "gravite": ..., "description": ..., "conduite_a_tenir": ...} -- déjà
    préparée par verifier_interactions_produits() à partir de PrincipeActif.noms_normalises().

    Retourne la liste des alertes détectées, chacune indiquant PRÉCISÉMENT quels produits
    du panier sont concernés (utile à l'affichage : "Doliprane" et "Aspirine 500", pas
    juste "paracétamol + acide acétylsalicylique" que le personnel devrait retraduire).

    Complexité O(nb_produits² × nb_regles) -- largement suffisant : un panier de pharmacie
    contient rarement plus de 10-20 lignes, et le nombre de règles reste de l'ordre de la
    centaine même pour une base bien enrichie.
    """
    # Ne garde que les produits ayant un principe actif renseigné -- lacune connue et
    # assumée (voir docstring du module models.py) : un produit sans cette donnée ne peut
    # tout simplement pas être confronté aux règles, aucune magie de déduction ici.
    produits_avec_pa = [
        {**p, "_normalise": normaliser_texte(p.get("principe_actif"))}
        for p in produits
        if normaliser_texte(p.get("principe_actif"))
    ]

    alertes = []
    for i, produit_x in enumerate(produits_avec_pa):
        for produit_y in produits_avec_pa[i + 1:]:
            if produit_x["id"] == produit_y["id"]:
                continue  # même produit deux fois dans le panier : pas une "interaction"
            for regle in regles:
                x_est_a = produit_x["_normalise"] in regle["noms_a"]
                x_est_b = produit_x["_normalise"] in regle["noms_b"]
                y_est_a = produit_y["_normalise"] in regle["noms_a"]
                y_est_b = produit_y["_normalise"] in regle["noms_b"]

                # La règle s'applique dans un sens OU dans l'autre (A+B == B+A) -- voir
                # commentaire dans InteractionMedicamenteuse.Meta sur l'absence de
                # contrainte d'ordre.
                if (x_est_a and y_est_b) or (x_est_b and y_est_a):
                    alertes.append({
                        "produit_a": {"id": produit_x["id"], "nom": produit_x["nom"]},
                        "produit_b": {"id": produit_y["id"], "nom": produit_y["nom"]},
                        "gravite": regle["gravite"],
                        "description": regle["description"],
                        "conduite_a_tenir": regle.get("conduite_a_tenir", ""),
                    })

    # Alertes les plus graves en premier (ordre officiel ANSM : contre-indication avant
    # tout le reste), pour que le personnel voie l'essentiel sans avoir à tout parcourir.
    ordre_gravite = {
        "contre_indication": 0,
        "association_deconseillee": 1,
        "precaution_emploi": 2,
        "a_prendre_en_compte": 3,
    }
    alertes.sort(key=lambda a: ordre_gravite.get(a["gravite"], 99))
    return alertes


def verifier_interactions_produits(produits_queryset):
    """
    Pont avec la base de données : charge les règles depuis le schéma public (modèles
    `pharmacovigilance`, accessibles même pendant une requête tenant-scopée -- c'est tout
    l'intérêt d'une app SHARED_APPS, voir docstring de models.py) et les produits fournis,
    puis délègue tout le calcul à `detecter_interactions()` ci-dessus.

    `produits_queryset` : un queryset ou une liste d'instances `core.models.Produit`
    (typiquement les produits d'un panier/commande en cours de validation).
    """
    from .models import InteractionMedicamenteuse  # import local : évite un cycle app SHARED / TENANT

    produits = [
        {"id": p.id, "nom": p.nom, "principe_actif": getattr(p, "principe_actif", None)}
        for p in produits_queryset
    ]

    regles = []
    for regle in InteractionMedicamenteuse.objects.select_related("principe_actif_a", "principe_actif_b").all():
        regles.append({
            "noms_a": regle.principe_actif_a.noms_normalises(),
            "noms_b": regle.principe_actif_b.noms_normalises(),
            "gravite": regle.gravite,
            "description": regle.description,
            "conduite_a_tenir": regle.conduite_a_tenir,
        })

    return detecter_interactions(produits, regles)
