"""
📚 Jeu de règles INITIAL, sourcé et volontairement restreint (voir docstring complète dans
pharmacovigilance/models.py sur la portée et les limites de ce module).

Sources principales :
- Thésaurus des interactions médicamenteuses, ANSM (Agence Nationale de Sécurité du
  Médicament) -- référentiel officiel français, mis à jour régulièrement.
- pharmacomedicale.org (Faculté de Médecine Sorbonne Université) pour les mécanismes.

Chaque règle indique sa source précise dans le champ `source` -- permet de retrouver et
réévaluer la règle si le référentiel évolue, plutôt que d'avoir une affirmation médicale
"suspendue dans le vide" sans traçabilité.
"""
from django.db import migrations


PRINCIPES_ACTIFS = {
    "paracetamol": {
        "nom": "Paracétamol",
        "alias": "doliprane, dafalgan, efferalgan, panadol",
    },
    "avk": {
        "nom": "Antivitamines K (AVK)",
        "alias": "warfarine, acenocoumarol, sintrom, coumadine, fluindione, previscan, coumadin",
    },
    "aspirine": {
        "nom": "Acide acétylsalicylique",
        "alias": "aspirine, aspegic, kardegic, asa",
    },
    "ains": {
        "nom": "Anti-inflammatoires non stéroïdiens (AINS)",
        "alias": "ibuprofene, diclofenac, ketoprofene, naproxene, nurofen, advil, voltarene",
    },
    "iec": {
        "nom": "Inhibiteurs de l'enzyme de conversion (IEC)",
        "alias": "enalapril, perindopril, captopril, lisinopril, ramipril, fosinopril",
    },
    "diuretique_epargneur_k": {
        "nom": "Diurétiques épargneurs de potassium",
        "alias": "spironolactone, amiloride, triamterene, aldactone",
    },
    "antiagregant": {
        "nom": "Antiagrégants plaquettaires (hors aspirine)",
        "alias": "clopidogrel, plavix, prasugrel, ticagrelor, ticlopidine",
    },
    "statine": {
        "nom": "Statines",
        "alias": "simvastatine, atorvastatine, rosuvastatine, pravastatine, lipitor, crestor, tahor",
    },
    "macrolide": {
        "nom": "Macrolides (antibiotiques)",
        "alias": "erythromycine, clarithromycine, azithromycine, zithromax",
    },
    "levothyroxine": {
        "nom": "Lévothyroxine",
        "alias": "levothyrox, l-thyroxine, euthyrox",
    },
    "sels_calcium_fer": {
        "nom": "Sels de calcium et de fer (compléments)",
        "alias": "calcium, carbonate de calcium, sulfate ferreux, fumarate ferreux, fer",
    },
}

# (clé_a, clé_b, gravité, description, conduite à tenir, source)
INTERACTIONS = [
    (
        "avk", "aspirine", "association_deconseillee",
        "Risque hémorragique majoré : l'acide acétylsalicylique ajoute son propre effet "
        "antiagrégant plaquettaire à l'effet anticoagulant de l'AVK, et augmente le risque "
        "de lésions gastro-duodénales (source de saignement supplémentaire).",
        "Éviter l'association sauf indication médicale expresse (ex. certaines cardiopathies). "
        "Si association jugée nécessaire par le prescripteur : surveillance clinique et de "
        "l'INR renforcée.",
        "Thésaurus des interactions médicamenteuses, ANSM",
    ),
    (
        "avk", "ains", "association_deconseillee",
        "Risque hémorragique digestif majoré : les AINS inhibent l'agrégation plaquettaire "
        "et sont eux-mêmes gastro-toxiques, en plus de déplacer l'AVK de sa fixation aux "
        "protéines plasmatiques (augmentation de sa fraction active).",
        "Éviter l'association. Si vraiment nécessaire : contrôle plus fréquent de l'INR et "
        "surveillance des signes de saignement.",
        "Thésaurus des interactions médicamenteuses, ANSM",
    ),
    (
        "iec", "diuretique_epargneur_k", "precaution_emploi",
        "Majoration du risque d'hyperkaliémie (potentiellement grave, surtout chez le sujet "
        "âgé ou insuffisant rénal) : les deux classes réduisent l'élimination du potassium "
        "par des mécanismes différents qui s'additionnent.",
        "Association possible sous surveillance biologique de la kaliémie, en particulier "
        "en début de traitement et chez les patients à risque (insuffisance rénale).",
        "Thésaurus des interactions médicamenteuses, ANSM",
    ),
    (
        "iec", "ains", "precaution_emploi",
        "Réduction de l'effet antihypertenseur de l'IEC (les AINS diminuent la synthèse des "
        "prostaglandines vasodilatatrices) et risque accru d'insuffisance rénale aiguë, "
        "surtout chez le patient déshydraté ou âgé.",
        "Hydratation correcte du patient, surveillance de la fonction rénale et de la "
        "pression artérielle en cas d'association prolongée.",
        "pharmacomedicale.org (Faculté de Médecine Sorbonne Université)",
    ),
    (
        "aspirine", "antiagregant", "precaution_emploi",
        "Majoration du risque hémorragique : deux mécanismes antiagrégants plaquettaires "
        "différents qui s'additionnent.",
        "Association parfois volontaire et surveillée en cardiologie (bithérapie "
        "antiplaquettaire) -- toujours sur prescription et suivi médical, jamais en "
        "automédication.",
        "Thésaurus des interactions médicamenteuses, ANSM",
    ),
    (
        "statine", "macrolide", "association_deconseillee",
        "Risque de toxicité musculaire (myalgies, jusqu'à la rhabdomyolyse dans les cas "
        "graves) : les macrolides inhibent le métabolisme hépatique de la statine (CYP3A4), "
        "augmentant fortement sa concentration sanguine.",
        "Éviter l'association si possible (antibiotique alternatif hors macrolide, ou arrêt "
        "temporaire de la statine le temps du traitement antibiotique, sur avis médical).",
        "Synthèse de la littérature pharmacologique (interaction bien documentée, "
        "mécanisme CYP3A4)",
    ),
    (
        "levothyroxine", "sels_calcium_fer", "precaution_emploi",
        "Réduction de l'absorption intestinale de la lévothyroxine (chélation), pouvant "
        "conduire à un sous-dosage fonctionnel non expliqué par ailleurs.",
        "Espacer les prises d'au moins 2 heures (lévothyroxine à jeun, calcium/fer à "
        "distance).",
        "Synthèse de la littérature pharmacologique (interaction bien documentée)",
    ),
]


def creer_principes_actifs_et_interactions(apps, schema_editor):
    PrincipeActif = apps.get_model("pharmacovigilance", "PrincipeActif")
    InteractionMedicamenteuse = apps.get_model("pharmacovigilance", "InteractionMedicamenteuse")

    objets = {}
    for cle, data in PRINCIPES_ACTIFS.items():
        objets[cle], _ = PrincipeActif.objects.get_or_create(
            nom=data["nom"], defaults={"alias": data["alias"]}
        )

    for cle_a, cle_b, gravite, description, conduite, source in INTERACTIONS:
        InteractionMedicamenteuse.objects.get_or_create(
            principe_actif_a=objets[cle_a],
            principe_actif_b=objets[cle_b],
            defaults={
                "gravite": gravite,
                "description": description,
                "conduite_a_tenir": conduite,
                "source": source,
            },
        )


def supprimer_principes_actifs_et_interactions(apps, schema_editor):
    # Reverse propre : supprime uniquement ce que cette migration a créé (par nom), pas
    # d'éventuelles règles ajoutées manuellement depuis via le Django admin.
    PrincipeActif = apps.get_model("pharmacovigilance", "PrincipeActif")
    noms = [data["nom"] for data in PRINCIPES_ACTIFS.values()]
    PrincipeActif.objects.filter(nom__in=noms).delete()  # cascade sur les interactions liées


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacovigilance", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(creer_principes_actifs_et_interactions, supprimer_principes_actifs_et_interactions),
    ]
