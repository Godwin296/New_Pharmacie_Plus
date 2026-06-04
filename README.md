# 💊 Pharmacie+ 

Une **plateforme complète de gestion de pharmacie de ville** conçue pour les pharmaciens modernes.

**[🌐 Voir la Démo en Ligne](https://demo.pharmacieplus.com)** | **[📖 Documentation](https://docs.pharmacieplus.com)**

---

## ✨ Pourquoi Pharmacie+ ?

❌ **Avant:** Fiches papier, calculs manuels, risque d'erreurs  
✅ **Après:** Automatisation complète, rapports en 1 clic, gestion en temps réel

---

## 🎯 Fonctionnalités

- 📦 **Gestion Multi-Stocks** - Suivi en temps réel + alertes expiration
- 🧾 **POS Rapide** - Vente au comptoir en 30 secondes
- 📄 **Traitement Ordonnances** - Upload/validation automatique
- 💰 **Rapports Financiers** - Bilans PDF exportables
- 📊 **Analytics** - Voir ce qui se vend, qui gagne le plus
- 🔐 **Rôles d'Accès** - Admin, Caissier, Client (sécurisé)
- 📱 **Interface Mobile-Ready** - Fonctionne sur téléphone/tablette

---

## 🛠️ Tech Stack

| Partie | Technologie |
|--------|-----------|
| **Backend** | Django 4.2 + DRF (API REST) |
| **Frontend** | Next.js 16 + React 19 + Tailwind |
| **Base de données** | PostgreSQL |
| **Déploiement** | Docker + Kubernetes ready |
| **Sécurité** | JWT + SSL/HTTPS |

---

## 🚀 Installation Rapide

### Option 1: Docker (Recommandé)
```bash
git clone https://github.com/Godwin296/Pharmacie-Plus.git
cd Pharmacie-Plus
docker-compose up -d
# Accède à http://localhost:3000

Option 2: Installation Manuelle
Backend:

cd pharmacie-backend
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

Frontend:

cd pharmacie-frontend
npm install
npm run dev
# Ouvre http://localhost:3000


📸 Screenshots
[Ajoute des images ici]
┌─────────────────────────────────────────┐
│  INTERFACE CLIENT (Achat en ligne)     │
│  - Catalogue médicaments               │
│  - Panier persistant                   │
│  - Upload ordonnance                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  INTERFACE PHARMACIEN (POS)            │
│  - Recherche rapide                    │
│  - Facture instantanée                 │
│  - Gestion stock                       │
│  - Rapports ventes                     │
└─────────────────────────────────────────┘

📊 Comparaison avec la Concurrence
Fonctionnalité	     Pharmacie+	         Medivault	      MediSure-360
POS Rapide	            ✅	                 ✅	              ✅
Ordonnances	            ✅	                 ✅	              ✅
Analytics Avancée	      ✅	                 ⚠️	               ✅
Stack Moderne	          ✅ Django+Next	     ⚠️ Laravel	       ✅ React+Node
Mobile Native	          🔄 En cours	        ❌	               ❌
Open Source	            ✅	                 ✅	              ✅
Support Professionnel	  Roadmap	             ⚠️	              ⚠️


🗺️ Roadmap 2024-2025
 ✅POS de base
 ✅Gestion stocks
 ✅Traitement ordonnances
    App Mobile Native (React Native)
    Paiement Intégré (Stripe, systèmes locaux)
    SMS/Email Notifications
    Multi-succursales
    Intégration Données Gouvernementales
    IA pour Prédiction Stocks


🤝 Comment Contribuer
Nous accueillons les contributions!

bash
git clone https://github.com/Godwin296/Pharmacie-Plus.git
git checkout -b feature/ma-fonctionnalite
# ... fais tes changements
git push origin feature/ma-fonctionnalite
# Crée une Pull Request
Lire CONTRIBUTING.md pour les détails.


📜 License
MIT License - Libre d'usage commercial et personnel. Voir LICENSE


💬 Support & Contact
Email: godwin@pharmacieplus.com
GitHub Issues: Signale un bug
Discussions: Pose une question


📈 Statistiques
![Stars](https://img.shields.io/badge/stars-0-blue) ![Forks](https://img.shields.io/badge/forks-0-green) ![License](https://img.shields.io/badge/license-MIT-bleu) ![Python](https://img.shields.io/badge/Python-3.10+-green)

Fait avec ❤️ par Godwin296