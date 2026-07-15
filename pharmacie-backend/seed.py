"""
🌱 SCRIPT DE SEED UNIQUE (session offline, 12/07) -- fusionne l'ancien `seed.py`
(création des tenants/comptes/config) et l'ancien `mise_a_jour.py` (correction des flags
is_staff/is_superuser pour que le "role" envoyé par le frontend au login matche bien
check_role() dans core/api.py). Un seul fichier à lancer, un seul endroit à maintenir.

    python seed.py

RE-JOUABLE SANS RISQUE :
- Tenants/domaines/comptes/config : get_or_create, donc jamais dupliqués.
- Produits : le catalogue de chaque tenant est entièrement RECRÉÉ à chaque exécution
  (les anciens produits générés par ce script -- identifiant préfixé DUP-/MAR- -- sont
  supprimés puis regénérés) pour permettre de rejouer facilement le seed avec un jeu de
  données propre et prévisible, notamment pour tester la pagination du catalogue
  (page_size=20, cf. core/pagination.py) et le curseur de synchro offline
  (has_more/next_since, cf. api_catalogue_sync dans core/api.py).
  ⚠️ Ça ne touche PAS aux produits saisis manuellement par un vrai utilisateur avec un
  identifiant hors de ce préfixe -- uniquement les données de seed elles-mêmes.

⚠️ Ne DROP JAMAIS le schéma PostgreSQL d'un tenant : conformément à la décision de sécurité
prise dans tenants/models.py (`auto_drop_schema = False`, "on ne supprime jamais un schéma
automatiquement"), un reset complet d'un tenant (schéma PostgreSQL) reste une action MANUELLE
volontaire -- voir les commandes dans PROMPT_REPRISE.md / la doc de session -- jamais quelque
chose que ce script fait tout seul.
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import random
from datetime import date, timedelta

from tenants.models import Pharmacie, Domain
from django_tenants.utils import schema_context
from django.contrib.auth.models import User, Group
from core.models import PharmacieConfig, Produit, LotProduit

random.seed(42)  # reproductible : deux exécutions du script donnent le même catalogue

LABOS = ["SIPOA", "LABOREX", "Novartis", "BIOPHARMA", "Sanofi", "GSK", "Pfizer", "Cinqpharm", "Sophartex", "Zenufa"]

# (nom de base, catégorie -- code EXACT de Produit.CATEGORIES, ordonnance obligatoire)
# 🔐 CORRECTIF au passage : l'ancien seed.py utilisait des codes catégorie ("antipaludeen",
# "autre") qui n'existent PAS dans Produit.CATEGORIES -- ça s'enregistrait quand même (Django
# ne valide les `choices` qu'au full_clean(), pas au .save()), mais aucun filtre catalogue par
# catégorie ne les retrouvait jamais côté frontend. Tous les codes ci-dessous sont vérifiés
# contre la liste réelle dans core/models.py.
CATALOGUE_BASE = [
    ("Paracetamol", "antalgique", False),
    ("Ibuprofene", "anti_inflam", False),
    ("Diclofenac", "anti_inflam", True),
    ("Aspirine", "antalgique", False),
    ("Tramadol", "antalgique", True),
    ("Amoxicilline", "antibiotique", True),
    ("Metronidazole", "antibiotique", True),
    ("Ciprofloxacine", "antibiotique", True),
    ("Cotrimoxazole", "antibiotique", True),
    ("Azithromycine", "antibiotique", True),
    ("Vitamine C", "vitamine", False),
    ("Vitamine D3", "vitamine", False),
    ("Zinc", "complement", False),
    ("Fer + Acide folique", "complement", False),
    ("Omeprazole", "anti_acide", False),
    ("Spasfon (Phloroglucinol)", "antispasmodique", False),
    ("Lopéramide", "antidiarrhéique", False),
    ("Duphalac (Lactulose)", "laxatif", False),
    ("Metformine", "antidiabétique", True),
    ("Glibenclamide", "antidiabétique", True),
    ("Amlodipine", "antihypertenseur", True),
    ("Losartan", "antihypertenseur", True),
    ("Atorvastatine", "hypolipémiant", True),
    ("Salbutamol", "bronchodilatateur", False),
    ("Ambroxol", "expectorant", False),
    ("Cetirizine", "antihistaminique", False),
    ("Betamethasone crème", "dermo_corticoide", True),
    ("Chlorhexidine", "antiseptique", False),
]
DOSAGES = ["50mg", "100mg", "250mg", "500mg", "1000mg", "5mg/ml sirop", "1% crème", "20mg"]


def generer_produits(prefix, n=100):
    """Génère `n` produits uniques et variés pour un tenant : mix volontaire de stock plein,
    stock faible (< seuil_alerte, pour tester les alertes réappro), rupture (0), et de dates
    d'expiration passées/proches/lointaines (pour tester les alertes péremption)."""
    produits, used_noms = [], set()
    i = 1
    while len(produits) < n:
        nom_base, categorie, ordo = random.choice(CATALOGUE_BASE)
        nom = f"{nom_base} {random.choice(DOSAGES)}"
        if nom in used_noms:
            continue
        used_noms.add(nom)
        jours_expiration = random.choice([-15, -3, 7, 20, 45, 90, 180, 365, 540, 730])
        produits.append({
            "identifiant": f"{prefix}-{i:03d}",
            "nom": nom,
            "categorie": categorie,
            "laboratoire": random.choice(LABOS),
            "quantite": random.choice([0, 0, 2, 4, 8, 15, 30, 60, 120, 250]),
            "prix": random.choice([300, 500, 800, 1200, 1500, 1800, 2200, 2800, 3500, 4200, 5500]),
            "description": f"{nom_base} -- produit de seed pour tests (pagination catalogue, curseur offline)",
            "ordonnance_obligatoire": ordo,
            "seuil_alerte": 10,
            "date_expiration": date.today() + timedelta(days=jours_expiration),
        })
        i += 1
    return produits


def creer_ou_reparer_comptes(prefix_user):
    """Fusion de l'ancien mise_a_jour.py : crée admin_<x>/caisse_<x> s'ils n'existent pas,
    ET republie systématiquement les bons flags is_staff/is_superuser sur les comptes
    existants -- check_role() dans core/api.py (voir son commentaire) se base UNIQUEMENT sur
    ces flags, plus sur des groupes Django, donc c'est la seule source de vérité à maintenir."""
    Group.objects.get_or_create(name="administrateur")
    Group.objects.get_or_create(name="caissiere")

    if not User.objects.filter(username=f"admin_{prefix_user}").exists():
        User.objects.create_user(f"admin_{prefix_user}", password="Admin123!")
        print(f"  ✓ admin_{prefix_user} créé (mdp: Admin123!)")
    if not User.objects.filter(username=f"caisse_{prefix_user}").exists():
        User.objects.create_user(f"caisse_{prefix_user}", password="Caisse123!")
        print(f"  ✓ caisse_{prefix_user} créé (mdp: Caisse123!)")

    # Réparation systématique (idempotente) des rôles, comptes neufs ET existants confondus.
    User.objects.filter(username__startswith="admin_").update(is_staff=True, is_superuser=True)
    User.objects.filter(username__startswith="caisse_").update(is_staff=True, is_superuser=False)
    print("  ✓ rôles admin_*/caisse_* vérifiés (is_staff/is_superuser)")


def seeder_tenant(schema_name, nom_pharmacie, email, adresse, telephone, prefix_produit):
    tenant, _ = Pharmacie.objects.get_or_create(
        schema_name=schema_name,
        defaults={"nom": nom_pharmacie, "proprietaire_email": email},
    )
    Domain.objects.get_or_create(
        domain=f"{schema_name}.localhost", defaults={"tenant": tenant, "is_primary": True}
    )
    print(f"Tenant {schema_name} OK")

    with schema_context(schema_name):
        creer_ou_reparer_comptes(schema_name)

        PharmacieConfig.objects.get_or_create(id=1, defaults={
            "nom": nom_pharmacie, "adresse": adresse, "telephone": telephone,
            "email_contact": email, "devise_preferee": "FCFA",
            "numero_orange_money": "640415518", "numero_mtn_momo": "683242487",
        })
        print(f"  Config {schema_name} OK")

        # 🔁 Recréation propre du catalogue de test (voir docstring du module) : supprime
        # uniquement les produits déjà générés par CE script (préfixe reconnu), jamais les
        # produits saisis manuellement par un utilisateur réel.
        supprimes, _ = Produit.objects.filter(identifiant__startswith=f"{prefix_produit}-").delete()
        if supprimes:
            print(f"  ({supprimes} anciens produits de seed supprimés avant régénération)")

        produits_crees = Produit.objects.bulk_create([Produit(**p) for p in generer_produits(prefix_produit, n=100)])
        # 🔧 CHANTIER LOTS/FEFO : Produit.quantite est désormais un CACHE dérivé des lots --
        # sans ce lot initial, les produits de seed auraient une quantite affichée non-nulle
        # mais 0 lot réel, et toute vente échouerait avec "stock insuffisant (0 disponibles)"
        # alors même que la fiche produit annonce du stock. Un lot par produit (même logique
        # que la migration 0010_migrer_stock_vers_lots pour des données déjà existantes).
        LotProduit.objects.bulk_create([
            LotProduit(
                produit=p, quantite_initiale=p.quantite, quantite_restante=p.quantite,
                date_peremption=p.date_expiration, note="Lot de seed (données de test)",
            )
            for p in produits_crees if p.quantite > 0
        ])
        print(f"  100 produits créés pour {schema_name} (catégories variées, stock/péremption variés)")


seeder_tenant(
    schema_name="dupont", nom_pharmacie="Pharmacie Dupont",
    email="signingdongmom@gmail.com", adresse="Avenue Kennedy, Yaounde",
    telephone="+237 640 41 55 18", prefix_produit="DUP",
)
seeder_tenant(
    schema_name="martin", nom_pharmacie="Pharmacie Martin",
    email="marcgodwinsigningdongmo@gmail.com", adresse="Rue de la Joie, Douala",
    telephone="+237 683 24 24 87", prefix_produit="MAR",
)

print("\n=== TERMINÉ ===")
print("dupont.localhost → admin_dupont / Admin123!  |  caisse_dupont / Caisse123!  (100 produits DUP-xxx)")
print("martin.localhost → admin_martin / Admin123!  |  caisse_martin / Caisse123!  (100 produits MAR-xxx)")
