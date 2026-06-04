<h1 align="center">💊 Pharmacie+</h1>

<p align="center">
  <strong>Une plateforme complète de gestion de pharmacie de ville conçue pour les pharmaciens modernes.</strong>
</p>

<p align="center">
  <a href="https://demo.pharmacieplus.com" target="_blank">🌐 Voir la Démo en Ligne</a> | 
  <a href="https://docs.pharmacieplus.com" target="_blank">📖 Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/stars-0-blue" alt="Stars">
  <img src="https://img.shields.io/badge/forks-0-green" alt="Forks">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/Python-3.10+-green" alt="Python">
</p>

<hr>

<h2>✨ Pourquoi Pharmacie+ ?</h2>

<table width="100%">
  <thead>
    <tr>
      <th width="50%" align="left" bgcolor="#fee2e2">❌ Avant</th>
      <th width="50%" align="left" bgcolor="#dcfce7">✅ Après</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Fiches papier, calculs manuels, risques élevés d'erreurs et de pertes de temps.</td>
      <td>Automatisation complète, rapports financiers en 1 clic, gestion des stocks en temps réel.</td>
    </tr>
  </tbody>
</table>

<br>
<hr>

<h2>🎯 Fonctionnalités</h2>

<ul>
  <li>📦 <strong>Gestion Multi-Stocks</strong> : Suivi en temps réel avec système d'alertes automatiques d'expiration.</li>
  <li>🧾 <strong>POS Rapide</strong> : Module de vente au comptoir optimisé pour encaisser en moins de 30 secondes.</li>
  <li>📄 <strong>Traitement des Ordonnances</strong> : Téléchargement et validation automatique des prescriptions médicales.</li>
  <li>💰 <strong>Rapports Financiers</strong> : Génération instantanée et exportation des bilans comptables au format PDF.</li>
  <li>📊 <strong>Analytics Avancés</strong> : Tableaux de bord décisionnels pour voir les produits phares et les performances financières.</li>
  <li>🔐 <strong>Rôles d'Accès (RBAC)</strong> : Environnement hautement sécurisé pour les profils Admin, Pharmacien, Caissier et Client.</li>
  <li>📱 <strong>Interface Mobile-Ready</strong> : Expérience utilisateur fluide et responsive sur téléphones et tablettes.</li>
</ul>

<br>
<hr>

<h2>🛠️ Tech Stack (Technologies utilisées)</h2>

<table width="100%">
  <thead>
    <tr>
      <th align="left" width="30%">Partie</th>
      <th align="left" width="70%">Technologie</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Backend</strong></td>
      <td>Django 4.2 + Django REST Framework (API REST)</td>
    </tr>
    <tr>
      <td><strong>Frontend</strong></td>
      <td>Next.js 16 + React 19 + Tailwind CSS</td>
    </tr>
    <tr>
      <td><strong>Base de données</strong></td>
      <td>PostgreSQL</td>
    </tr>
    <tr>
      <td><strong>Déploiement</strong></td>
      <td>Docker + architecture prête pour Kubernetes</td>
    </tr>
    <tr>
      <td><strong>Sécurité</strong></td>
      <td>Authentification JWT + protocoles SSL/HTTPS</td>
    </tr>
  </tbody>
</table>

<br>
<hr>

<h2>🚀 Installation Rapide</h2>

<h3>Option 1: Docker (Recommandé)</h3>
<pre><code>git clone https://github.com/Godwin296/Pharmacie-Plus.git
cd Pharmacie-Plus
docker-compose up -d
# Accédez à l'application via http://localhost:3000</code></pre>

<h3>Option 2: Installation Manuelle</h3>

<h4>Configuration du Backend :</h4>
<pre><code>cd pharmacie-backend
python -m venv venv
source venv/bin/activate  # Ou venv\Scripts\activate sur Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver</code></pre>

<h4>Configuration du Frontend :</h4>
<pre><code>cd ../pharmacie-frontend
npm install
npm run dev
# Ouvrez http://localhost:3000 dans votre navigateur</code></pre>

<br>
<hr>

<h2>📸 Captures d'Écran & Interfaces</h2>

<table width="100%">
  <thead>
    <tr>
      <th width="50%" align="left">🖥️ INTERFACE CLIENT (Achat en ligne)</th>
      <th width="50%" align="left">🧮 INTERFACE PHARMACIEN (POS)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <ul>
          <li>Catalogue complet des médicaments</li>
          <li>Panier d'achat persistant</li>
          <li>Téléversement d'ordonnance sécurisé</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Recherche intuitive et instantanée</li>
          <li>Génération de factures en un clic</li>
          <li>Gestion des stocks et rapports de ventes</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td colspan="2" align="center" style="color: #666; font-style: italic; padding: 10px;">
        [Ajoutez vos images ou captures d'écran ici pour illustrer l'application]
      </td>
    </tr>
  </tbody>
</table>

<br>
<hr>

<h2>📊 Comparaison avec la Concurrence</h2>

<table width="100%">
  <thead>
    <tr>
      <th align="left">Fonctionnalité</th>
      <th align="center">Pharmacie+</th>
      <th align="center">Medivault</th>
      <th align="center">MediSure-360</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>POS Rapide</strong></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td><strong>Gestion Ordonnances</strong></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td><strong>Analytics Avancée</strong></td>
      <td align="center">✅</td>
      <td align="center">⚠️ *Limité*</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td><strong>Stack Moderne</strong></td>
      <td align="center">✅ Django + Next</td>
      <td align="center">⚠️ Laravel</td>
      <td align="center">✅ React + Node</td>
    </tr>
    <tr>
      <td><strong>Mobile Native</strong></td>
      <td align="center">🔄 *En cours*</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td><strong>Open Source</strong></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td><strong>Support Professionnel</strong></td>
      <td align="center">Roadmap</td>
      <td align="center">⚠️</td>
      <td align="center">⚠️</td>
    </tr>
  </tbody>
</table>

<br>
<hr>

<h2>🗺️ Feuille de Route (Roadmap 2024-2025)</h2>

<ul>
  <li>✅ Point de Vente (POS) de base fonctionnel</li>
  <li>✅ Gestion complète des stocks et alertes</li>
  <li>✅ Module de traitement des ordonnances</li>
  <li>⬜ Développement de l'Application Mobile Native (React Native)</li>
  <li>⬜ Intégrations des passerelles de paiement (Stripe et opérateurs locaux)</li>
  <li>⬜ Notifications automatisées par SMS / Email</li>
  <li>⬜ Gestion multi-succursales (plusieurs officines interconnectées)</li>
  <li>⬜ Intégration et conformité avec les bases de données gouvernementales</li>
  <li>⬜ Intelligence Artificielle dédiée à la prédiction des seuils de rupture de stocks</li>
</ul>

<br>
<hr>

<h2>🤝 Comment Contribuer ?</h2>

<p>Nous accueillons avec grand plaisir toutes les contributions de la communauté !</p>

<pre><code>git clone https://github.com/Godwin296/Pharmacie-Plus.git
git checkout -b feature/ma-fonctionnalite
# ... effectuez vos modifications de code
git push origin feature/ma-fonctionnalite
# Ouvrez une Pull Request sur le dépôt principal</code></pre>

<p><em>Veuillez lire le fichier <code>CONTRIBUTING.md</code> pour prendre connaissance des conventions de code détaillées.</em></p>

<br>
<hr>

<h2>📜 Licence</h2>

<p>Ce projet est distribué sous la licence <strong>MIT</strong>. Vous êtes entièrement libre de l'utiliser à des fins commerciales et personnelles. Veuillez consulter le fichier <code>LICENSE</code> pour plus de détails.</p>

<br>
<hr>

<h2>💬 Support & Contact</h2>

<ul>
  <li><strong>Email professionnel :</strong> <a href="mailto:godwin@pharmacieplus.com">godwin@pharmacieplus.com</a></li>
  <li><strong>Bugs & Anomalies :</strong> <a href="https://github.com/Godwin296/Pharmacie-Plus/issues" target="_blank">Ouvrir un ticket GitHub Issues</a></li>
  <li><strong>Discussions & Questions :</strong> Rejoindre l'espace de discussion de la communauté.</li>
</ul>

<br>
<hr>

<p align="center">
  Fait avec ❤️ par <strong>Godwin296</strong>
</p>