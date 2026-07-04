import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from tenants.models import Pharmacie, Domain
from django_tenants.utils import schema_context
from django.contrib.auth.models import User, Group
from core.models import PharmacieConfig, Produit

# --- TENANT DUPONT ---
dupont, _ = Pharmacie.objects.get_or_create(schema_name="dupont", defaults={"nom": "Pharmacie Dupont", "proprietaire_email": "signingdongmom@gmail.com"})
Domain.objects.get_or_create(domain="dupont.localhost", defaults={"tenant": dupont, "is_primary": True})
print("Tenant dupont OK")

with schema_context("dupont"):
    ag, _ = Group.objects.get_or_create(name="administrateur")
    cg, _ = Group.objects.get_or_create(name="caissiere")
    if not User.objects.filter(username="admin_dupont").exists():
        u = User.objects.create_user("admin_dupont", password="Admin123!", is_staff=True, is_superuser=True)
        u.groups.add(ag)
        print("✓ admin_dupont créé (mdp: Admin123!)")
    if not User.objects.filter(username="caisse_dupont").exists():
        u = User.objects.create_user("caisse_dupont", password="Caisse123!", is_staff=True, is_superuser=False)
        u.groups.add(cg)
        print("✓ caisse_dupont créé (mdp: Caisse123!)")
    PharmacieConfig.objects.get_or_create(id=1, defaults={"nom": "Pharmacie Dupont", "adresse": "Avenue Kennedy, Yaounde", "telephone": "+237 640 41 55 18", "email_contact": "signingdongmom@gmail.com", "devise_preferee": "FCFA", "numero_orange_money": "640415518", "numero_mtn_momo": "683242487"})
    print("Config dupont OK")
    produits = [
        {"identifiant": "DUP-001", "nom": "Paracetamol 500mg", "categorie": "antalgique", "laboratoire": "SIPOA", "quantite": 150, "prix": 500, "description": "Antalgique et antipyretique", "ordonnance_obligatoire": False},
        {"identifiant": "DUP-002", "nom": "Amoxicilline 500mg", "categorie": "antibiotique", "laboratoire": "LABOREX", "quantite": 80, "prix": 2500, "description": "Antibiotique a large spectre", "ordonnance_obligatoire": True},
        {"identifiant": "DUP-003", "nom": "Coartem 20mg", "categorie": "antipaludeen", "laboratoire": "Novartis", "quantite": 60, "prix": 3500, "description": "Traitement antipaludeen", "ordonnance_obligatoire": True},
        {"identifiant": "DUP-004", "nom": "Vitamine C 500mg", "categorie": "vitamine", "laboratoire": "BIOPHARMA", "quantite": 200, "prix": 800, "description": "Complement vitaminique", "ordonnance_obligatoire": False},
        {"identifiant": "DUP-005", "nom": "Ibuprofene 400mg", "categorie": "antalgique", "laboratoire": "SIPOA", "quantite": 120, "prix": 1200, "description": "Anti-inflammatoire", "ordonnance_obligatoire": False},
        {"identifiant": "DUP-006", "nom": "Metronidazole 250mg", "categorie": "antibiotique", "laboratoire": "LABOREX", "quantite": 90, "prix": 1800, "description": "Antibiotique antiprotozoaire", "ordonnance_obligatoire": True},
        {"identifiant": "DUP-007", "nom": "Omeprazole 20mg", "categorie": "autre", "laboratoire": "BIOPHARMA", "quantite": 70, "prix": 2200, "description": "Inhibiteur pompe a protons", "ordonnance_obligatoire": False},
        {"identifiant": "DUP-008", "nom": "Zinc 20mg", "categorie": "vitamine", "laboratoire": "SIPOA", "quantite": 180, "prix": 600, "description": "Complement en zinc", "ordonnance_obligatoire": False},
        {"identifiant": "DUP-009", "nom": "Cotrimoxazole 480mg", "categorie": "antibiotique", "laboratoire": "LABOREX", "quantite": 100, "prix": 1500, "description": "Antibiotique sulfamide", "ordonnance_obligatoire": True},
        {"identifiant": "DUP-010", "nom": "Doliprane 1000mg", "categorie": "antalgique", "laboratoire": "Sanofi", "quantite": 5, "prix": 1800, "description": "Stock faible - test alerte", "ordonnance_obligatoire": False},
    ]
    n = 0
    for p in produits:
        if not Produit.objects.filter(identifiant=p["identifiant"]).exists():
            Produit.objects.create(**p); n += 1
    print(f"{n} produits crees pour dupont")

# --- TENANT MARTIN ---
martin, _ = Pharmacie.objects.get_or_create(schema_name="martin", defaults={"nom": "Pharmacie Martin", "proprietaire_email": "marcgodwinsigningdongmo@gmail.com"})
Domain.objects.get_or_create(domain="martin.localhost", defaults={"tenant": martin, "is_primary": True})
print("Tenant martin OK")

with schema_context("martin"):
    ag, _ = Group.objects.get_or_create(name="administrateur")
    cg, _ = Group.objects.get_or_create(name="caissiere")
    if not User.objects.filter(username="admin_martin").exists():
        u = User.objects.create_user("admin_martin", password="Admin123!", is_staff=True, is_superuser=True)
        u.groups.add(ag)
        print("✓ admin_martin créé (mdp: Admin123!)")
    if not User.objects.filter(username="caisse_martin").exists():
        u = User.objects.create_user("caisse_martin", password="Caisse123!", is_staff=True, is_superuser=False)
        u.groups.add(cg)
        print("✓ caisse_martin créé (mdp: Caisse123!)")
    PharmacieConfig.objects.get_or_create(id=1, defaults={"nom": "Pharmacie Martin", "adresse": "Rue de la Joie, Douala", "telephone": "+237 683 24 24 87", "email_contact": "marcgodwinsigningdongmo@gmail.com", "devise_preferee": "FCFA", "numero_orange_money": "640415518", "numero_mtn_momo": "683242487"})
    print("Config martin OK")
    produits = [
        {"identifiant": "MAR-001", "nom": "Artemether 80mg", "categorie": "antipaludeen", "laboratoire": "Novartis", "quantite": 45, "prix": 4200, "description": "Antipaludeen injectable", "ordonnance_obligatoire": True},
        {"identifiant": "MAR-002", "nom": "Paracetamol 1000mg", "categorie": "antalgique", "laboratoire": "Sanofi", "quantite": 200, "prix": 1800, "description": "Antalgique adulte", "ordonnance_obligatoire": False},
        {"identifiant": "MAR-003", "nom": "Ciprofloxacine 500mg", "categorie": "antibiotique", "laboratoire": "LABOREX", "quantite": 60, "prix": 3200, "description": "Antibiotique fluoroquinolone", "ordonnance_obligatoire": True},
        {"identifiant": "MAR-004", "nom": "Fer + Acide folique", "categorie": "vitamine", "laboratoire": "BIOPHARMA", "quantite": 150, "prix": 900, "description": "Complement grossesse", "ordonnance_obligatoire": False},
        {"identifiant": "MAR-005", "nom": "Tramadol 50mg", "categorie": "antalgique", "laboratoire": "SIPOA", "quantite": 3, "prix": 5500, "description": "Stock faible - test alerte", "ordonnance_obligatoire": True},
        {"identifiant": "MAR-006", "nom": "Diclofenac 50mg", "categorie": "antalgique", "laboratoire": "LABOREX", "quantite": 110, "prix": 1400, "description": "Anti-inflammatoire", "ordonnance_obligatoire": False},
        {"identifiant": "MAR-007", "nom": "Metformine 500mg", "categorie": "autre", "laboratoire": "BIOPHARMA", "quantite": 80, "prix": 2800, "description": "Antidiabetique oral", "ordonnance_obligatoire": True},
        {"identifiant": "MAR-008", "nom": "Vitamine D3 1000UI", "categorie": "vitamine", "laboratoire": "SIPOA", "quantite": 160, "prix": 1100, "description": "Complement vitamine D", "ordonnance_obligatoire": False},
        {"identifiant": "MAR-009", "nom": "Amoxicilline 250mg sirop", "categorie": "antibiotique", "laboratoire": "LABOREX", "quantite": 40, "prix": 2100, "description": "Antibiotique pediatrique", "ordonnance_obligatoire": True},
        {"identifiant": "MAR-010", "nom": "Spasfon 80mg", "categorie": "autre", "laboratoire": "SIPOA", "quantite": 130, "prix": 1600, "description": "Antispasmodique", "ordonnance_obligatoire": False},
    ]
    n = 0
    for p in produits:
        if not Produit.objects.filter(identifiant=p["identifiant"]).exists():
            Produit.objects.create(**p); n += 1
    print(f"{n} produits crees pour martin")

print("\n=== TERMINE ===")
print("dupont.localhost → admin_dupont / Admin123!")
print("martin.localhost → admin_martin / Admin123!")