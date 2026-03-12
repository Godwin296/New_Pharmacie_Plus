💊 Pharmacie + (Online Pharmacy & Management)

Plate-forme
Une solution Django moderne et complète pour la duplication numérique d'une pharmacie physique, permettant la vente en ligne et la gestion back-office.

🎯 Aperçu
Pharmacie + transforme la gestion complexe d'une officine en une interface web intuitive. Développée avec Django, cette application offre une expérience fluide tant pour le patient que pour le personnel de santé, automatisant le flux de travail depuis l'ordonnance jusqu'à la facture finale.

Qu'est-ce que Pharmacie + ?
C'est un ERP pharmaceutique léger qui combine une boutique en ligne pour les patients et un terminal de gestion pour les pharmaciens (POS & Stocks).

Qu'apporte Pharmacie + ?

.📦 Gestion Multi-Stocks : Suivi des quantités, alertes de péremption et réapprovisionnement.
.📄 Traitement des Ordonnances : Système d'analyse et de validation des prescriptions uploadées.
.💰 Point de Vente (POS) : Interface caisse optimisée pour des ventes rapides au comptoir.
.📊 Rapports Financiers : Génération de bilans de ventes et exports PDF automatisés.
.🔐 Contrôle d'Accès : Rôles distincts pour l'Administrateur, le Caissier et le Client.

🚀 Démarrage rapide

Prérequis
.Python 3.10+
.Django 4.2+
.Pillow (pour la gestion des images produits/ordonnances)

Installation
  Cloner le dépôt :
git clone https://github.com

  Installer les dépendances :
pip install -r requirements.txt

  Appliquer les migrations :
python manage.py migrate

  Lancer l'application :
python manage.py runserver

✨ Fonctionnalités clés

🎨 Interface Client
.Catalogue dynamique avec filtres par catégories/laboratoires.
.Panier d'achat persistant et historique des commandes.
.Portail sécurisé pour l'envoi de documents médicaux (PDF/Images).

📱 Module Caisse (POS)
.Recherche instantanée de médicaments.
.Validation en un clic des commandes passées en ligne.
.Génération de factures formatées.

🛡️ Gestion Administrative
.Tableau de bord : Visualisation des performances quotidiennes.
.Stocks : Gestion des fournisseurs et seuils de sécurité pour les produits critiques.
.Rapports : Exportation de données pour la comptabilité.

🔄 Workflow de Commande
.Le client dépose son ordonnance ou choisit ses produits.
.La caisse valide la conformité depuis son interface.
.La commande est marquée "Payee" et le stock est décrémenté automatiquement.

📖 Documentation
.Dépannage : Solutions pour les erreurs de migrations ou de stockage média.
.Feuille de Route : Intégration prochaine du paiement mobile et notifications SMS.





  

