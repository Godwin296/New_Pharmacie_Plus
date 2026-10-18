# Admin plateforme Pharmacie+ — Conception et feuille de route

> **Statut : document de conception à remplacer.**  
> Ce document définit le périmètre réel du panneau d’administration de la plateforme Pharmacie+, les règles de sécurité, les données autorisées, les écrans prioritaires et un plan de réalisation progressif.
>
> **Principe central :** l’admin plateforme n’est pas un « dashboard analytics ». C’est d’abord une **console d’exploitation SaaS** : savoir qui utilise la plateforme, dans quel état, comment l’aider, la suspendre, la réactiver et protéger l’ensemble du système.
>
> **Règle MVP :** on ne construit pas tout en même temps. La version minimale utile est : comptes plateforme sécurisés, liste des pharmacies, fiche pharmacie, suspension/réactivation, maintenance globale et journal d’audit.

---

## 0. Résumé exécutif

1. L’admin plateforme est un outil **interne**, réservé à l’équipe Pharmacie+.
2. Il ne remplace pas l’admin d’une pharmacie. Il gère la plateforme et les tenants, pas les opérations quotidiennes d’une officine.
3. Ses données de gestion vivent dans le schéma `public`.
4. Les données métier des pharmacies restent dans leur schéma respectif.
5. L’admin plateforme n’accède pas, par défaut, aux ventes détaillées, aux ordonnances, aux patients ou aux données personnelles des clients finaux.
6. Les métriques transverses proviennent d’un **instantané quotidien agrégé**, pas de requêtes cross-schéma en temps réel.
7. Toute action sensible est journalisée dans un audit immuable.
8. Deux failles ou lacunes actuelles doivent être corrigées avant toute ouverture du module : liaison des jetons du personnel au schéma, et application réelle de la suspension.
9. La suppression définitive d’une pharmacie ne doit pas être une action courante. On privilégie : suspension, résiliation, archivage.
10. Le développement se fait par phases : sécurité, fondations, gestion des tenants, maintenance, métriques, support, onboarding, puis facturation.

---

## 1. Positionnement du module

### 1.1 Ce que c’est

L’admin plateforme est une console permettant à l’équipe Pharmacie+ de :

- Connaître l’état global de la plateforme.
- Lister, rechercher et inspecter les pharmacies clientes.
- Créer, activer, suspendre, réactiver, résilier ou archiver un tenant.
- Appliquer une maintenance globale ou ciblée.
- Suivre l’activité agrégée des pharmacies.
- Diagnostiquer les erreurs et les pharmacies inactives.
- Gérer les comptes de l’équipe interne.
- Tracer toutes les actions administratives.

### 1.2 Ce que ce n’est pas

Ce module **n’est pas** :

- Le back-office d’une pharmacie.
- Un outil pour consulter les ventes détaillées d’une pharmacie.
- Un outil pour modifier les produits, prix, stocks ou commandes d’une pharmacie.
- Un outil pour lire les ordonnances ou les données des patients.
- Un tableau de bord financier des pharmacies.
- Un système d’impersonation permettant de se connecter comme un pharmacien.

### 1.3 Les trois niveaux d’administration

| Niveau | Utilisateur | Périmètre | Exemples d’actions |
|---|---|---|---|
| Plateforme | Équipe Pharmacie+ | Tous les tenants | Créer une pharmacie, suspendre un tenant, maintenance globale |
| Tenant | Admin de pharmacie | Une seule pharmacie | Gérer produits, personnel, stock, horaires, configuration |
| Opérationnel | Personnel de pharmacie | Tâches quotidiennes | Vente, caisse, stock, commandes |

---

## 2. Principes directeurs

### 2.1 Minimisation des données

L’admin plateforme ne collecte que les données nécessaires à l’exploitation du SaaS.

Autorisé :

- Identité de la pharmacie.
- Domaine et schéma technique.
- Contact du titulaire.
- Statut du compte.
- Plan et échéances.
- Compteurs agrégés d’activité.
- Date de dernière activité.
- Statut technique et erreurs.
- Notes internes.

Interdit par défaut :

- Contenu des commandes.
- Détail des ventes.
- Prix, marges et chiffre d’affaires d’une pharmacie.
- Ordonnances.
- Identité et coordonnées des clients finaux.
- Contenu des messages, fichiers ou documents médicaux.

### 2.2 Isolation multi-tenant

Aucune requête API de l’admin plateforme ne doit recevoir un nom de schéma depuis le client.

Le schéma est toujours déduit côté serveur à partir de l’identifiant de la pharmacie.

### 2.3 Sécurité par défaut

- Comptes plateforme distincts des comptes pharmacie.
- Authentification dédiée.
- 2FA obligatoire.
- Jetons courts.
- Rôles minimaux.
- Journal d’audit obligatoire.
- Aucune inscription publique.
- Aucune réinitialisation de mot de passe en libre-service au départ.

### 2.4 Actions réversibles

Les actions destructrices doivent être rares et protégées.

Ordre recommandé :

1. **Suspendre** : accès bloqué ou limité, données conservées.
2. **Résilier** : fin de relation commerciale, données conservées.
3. **Archiver** : tenant masqué des listes actives, données conservées.
4. **Supprimer définitivement** : action exceptionnelle, manuelle, journalisée, avec confirmation renforcée.

---

## 3. Architecture technique

### 3.1 Application Django

Créer une nouvelle application Django :

```text
plateforme/
```

Cette application est ajoutée uniquement à `SHARED_APPS`.

Elle ne doit jamais être ajoutée à `TENANT_APPS`.

### 3.2 Schéma PostgreSQL

| Donnée | Schéma | Statut |
|---|---|---|
| `Pharmacie` | `public` | Existant |
| `Domain` | `public` | Existant |
| `ComptePlateforme` | `public` | À créer |
| `JournalAudit` | `public` | À créer |
| `MetriqueTenantJour` | `public` | À créer |
| `UsageClientPharmacie` | `public` | À créer, plus tard |
| `NoteTenant` | `public` | À créer |
| Produits, commandes, stock, utilisateurs pharmacie | Schéma du tenant | Existant, non modifié |

### 3.3 URLs

Les routes API sont exposées uniquement depuis le schéma public :

```text
/api/v1/plateforme/
```

Exemple :

```text
/api/v1/plateforme/auth/connexion/
/api/v1/plateforme/pharmacies/
/api/v1/plateforme/pharmacies/12/
/api/v1/plateforme/systeme/maintenance/
```

Ces routes ne doivent pas être accessibles depuis un sous-domaine de pharmacie.

### 3.4 Frontend

Le frontend peut vivre dans le même projet Next.js :

```text
pharmacie-frontend/app/plateforme/
```

Il doit avoir :

- Sa propre mise en page.
- Son propre client API.
- Son propre contexte d’authentification.
- Ses propres règles de redirection.
- Aucune dépendance au contexte de pharmacie courant.

---

## 4. Sécurité préalable — Phase 0

Cette phase est obligatoire avant toute fonctionnalité visible.

### 4.1 Problème 1 : jetons du personnel non liés au schéma

Actuellement, un jeton de personnel ne semble pas contenir le schéma d’origine.

Risque :

- Un jeton émis pour la pharmacie A pourrait être résolu comme un utilisateur de la pharmacie B.
- Un jeton de pharmacie pourrait être interprété dans le schéma public.

Correctif :

1. Ajouter une claim `schema` lors de l’émission des jetons du personnel.
2. Vérifier dans `StaffJWTAuthentication` que la claim correspond à `connection.schema_name`.
3. Rejeter tout jeton dont le schéma ne correspond pas.
4. Ajouter des tests automatisés avant le correctif.

### 4.2 Problème 2 : suspension non appliquée

Les champs `actif` et `plan == "suspendu"` existent, mais ils ne semblent pas utilisés pour bloquer l’accès.

Correctif :

1. Créer un middleware exécuté après `TenantMainMiddleware`.
2. Pour tout schéma différent de `public` :
   - Si la pharmacie est inactive ou suspendue, renvoyer une erreur claire.
3. Laisser passer uniquement :
   - `/healthz/`
   - Les routes nécessaires à l’affichage du message.
   - Les routes d’authentification si nécessaire.
4. Appliquer la même règle aux WebSockets.

### 4.3 Durée des jetons

Réduire la durée de vie des jetons sensibles.

Recommandation :

| Type de jeton | Durée cible |
|---|---|
| Access token admin plateforme | 15 minutes |
| Refresh token admin plateforme | 8 heures |
| Access token personnel pharmacie | À réduire progressivement |
| Refresh token personnel pharmacie | À définir séparément |

### 4.4 Authentification plateforme

Créer une authentification dédiée :

```text
PlateformeJWTAuthentication
```

Règles :

- Accepte uniquement les jetons de type `plateforme`.
- Rejette les jetons `staff`, `client` ou tout autre type.
- Vérifie que le compte est actif.
- Vérifie le rôle en base à chaque requête.
- Vérifie que la session n’a pas été révoquée.

Les autres classes d’authentification doivent rejeter explicitement les jetons de type `plateforme`.

---

## 5. Comptes de l’équipe plateforme

### 5.1 Modèle `ComptePlateforme`

Ne pas réutiliser directement `auth.User` du schéma public.

Créer un modèle dédié :

```text
ComptePlateforme
```

Champs recommandés :

- `email`
- `nom`
- `role`
- `is_active`
- `mot_de_passe`
- `totp_secret`
- `totp_active`
- `codes_secours`
- `tentatives_echec`
- `verrouille_jusqua`
- `derniere_connexion`
- `derniere_ip`
- `date_creation`
- `cree_par`

### 5.2 Rôles initiaux

| Rôle | Accès | Actions autorisées |
|---|---|---|
| `proprietaire` | Tout | Gérer l’équipe, créer/désactiver des comptes, actions critiques |
| `admin` | Presque tout | Créer un tenant, changer un plan, suspendre, réactiver, notes |
| `support` | Lecture + support | Voir les tenants, ajouter des notes, relancer certains emails |
| `finance` | Facturation | Gérer abonnements et factures, plus tard |
| `lecture` | Lecture seule | Aucune écriture |

### 5.3 2FA

La double authentification doit être obligatoire.

Flux :

1. `POST /auth/connexion/`
2. Réponse : étape `2fa` avec jeton temporaire.
3. `POST /auth/2fa/`
4. Émission des jetons définitifs.

Prévoir :

- Codes de secours hachés.
- Verrouillage après échecs répétés.
- Throttling sur la route de connexion.
- Réinitialisation du 2FA réservée au `proprietaire`.

### 5.4 Création des comptes

Au départ, les comptes plateforme sont créés uniquement via une commande :

```bash
python manage.py creer_compte_plateforme
```

Aucune inscription publique.

---

## 6. Journal d’audit

### 6.1 Pourquoi

Chaque action sensible doit pouvoir répondre à :

- Qui a fait l’action ?
- Quand ?
- Sur quelle pharmacie ou quel compte ?
- Quelles étaient les valeurs avant et après ?
- Depuis quelle IP ?

### 6.2 Modèle `JournalAudit`

Champs :

- `id`
- `acteur`
- `acteur_email`
- `action`
- `cible_type`
- `cible_id`
- `avant`
- `apres`
- `ip`
- `user_agent`
- `date`

### 6.3 Règles

- Écriture dans la même transaction que l’action.
- Table append-only.
- Pas de modification ni suppression depuis l’application.
- Journalisation des connexions réussies et échouées.
- Journalisation des exports sensibles.
- Codes d’action stables, par exemple :

```text
tenant.cree
tenant.suspendu
tenant.reactiver
tenant.plan_change
compte.cree
compte.desactive
systeme.maintenance_activee
```

---

## 7. Gestion des pharmacies

### 7.1 Données de base

Chaque pharmacie doit exposer à l’admin plateforme :

- Nom.
- Nom public.
- Identifiant technique.
- Domaine principal.
- Statut.
- Plan.
- Date de création.
- Contact titulaire.
- Ville et pays.
- Adresse.
- Téléphone public.
- Logo.
- Services.
- Horaires.

### 7.2 Champs à ajouter

Ajouter progressivement à `Pharmacie` :

- `statut`
- `fin_essai`
- `date_debut_abonnement`
- `prochaine_echeance`
- `date_suspension`
- `motif_suspension`
- `ville`
- `pays`
- `numero_agrement`
- `source_acquisition`
- `commercial_responsable`

### 7.3 Séparer plan et statut

Ne pas mélanger offre commerciale et état du compte.

| Champ | Valeurs |
|---|---|
| `plan` | `essai`, `standard`, `pro` |
| `statut` | `essai`, `actif`, `suspendu`, `resilie`, `archive` |

Cela permet de savoir qu’une pharmacie suspendue était, par exemple, sur le plan `pro`.

### 7.4 Cycle de vie

```text
Création
   ↓
Essai
   ↓
Actif
   ↓
Suspendu / Résilié
   ↓
Archivé
```

Actions disponibles :

| Action | Effet |
|---|---|
| Créer | Création du tenant, du domaine et du premier admin |
| Activer | Rend la pharmacie utilisable |
| Suspendre | Bloque ou limite l’accès |
| Réactiver | Restaure l’accès |
| Résilier | Met fin à la relation commerciale |
| Archiver | Masque le tenant des listes actives |
| Supprimer | Action exceptionnelle, hors interface standard |

---

## 8. Maintenance

### 8.1 Trois niveaux

Ne pas créer un seul bouton « shutdown ».

Prévoir trois niveaux :

| Niveau | Portée | Usage |
|---|---|---|
| Maintenance globale | Toute la plateforme | Incident majeur, migration critique |
| Maintenance tenant | Une pharmacie | Problème isolé, impayé, demande client |
| Mode dégradé | Plateforme ou tenant | Lecture possible, écritures bloquées |

### 8.2 Maintenance globale

Quand activée :

- Toutes les routes métier renvoient une page ou une erreur de maintenance.
- Les administrateurs plateforme conservent l’accès à la console.
- Les super admins peuvent éventuellement accéder aux routes techniques.
- L’état est visible dans la console.
- L’activation et la désactivation sont journalisées.

### 8.3 Maintenance tenant

Quand activée pour une pharmacie :

- Seule cette pharmacie est concernée.
- Les autres pharmacies continuent de fonctionner.
- Le message affiché doit être clair.
- La durée et le motif sont enregistrés.

### 8.4 Mode dégradé

Utile si la base ou un service externe pose problème.

Exemples :

- Consultation autorisée.
- Création de commandes désactivée.
- Paiements désactivés.
- Synchronisation suspendue.

---

## 9. Métriques et instantané quotidien

### 9.1 Principe

Ne pas faire des requêtes en direct dans tous les schémas à chaque affichage.

Créer une commande :

```bash
python manage.py collecter_metriques_tenants
```

Elle tourne une fois par jour, idéalement la nuit.

### 9.2 Données collectées

Pour chaque pharmacie :

- Dernière commande.
- Nombre de commandes sur 7 et 30 jours.
- Commandes en ligne et au guichet.
- Dernière connexion du personnel.
- Nombre de membres actifs.
- Nombre de clients ayant commandé.
- Nombre de produits.
- Nombre de lots.
- Produits proches de la péremption.
- Paiements à vérifier.
- Taille approximative du schéma.
- Statut de la collecte.

### 9.3 Modèle `MetriqueTenantJour`

Champs principaux :

- `pharmacie`
- `jour`
- `statut_collecte`
- `erreur`
- `derniere_commande`
- `commandes_7j`
- `commandes_30j`
- `commandes_en_ligne_30j`
- `derniere_connexion_personnel`
- `personnel_actif`
- `clients_actifs_30j`
- `produits_catalogue`
- `produits_en_stock`
- `produits_proches_peremption`
- `paiements_a_verifier`
- `taille_mo`

Contrainte :

```text
unique(pharmacie, jour)
```

### 9.4 Règles de collecte

- Lecture seule dans le schéma du tenant.
- Agrégats SQL uniquement.
- Aucune donnée personnelle copiée.
- Une erreur sur une pharmacie ne bloque pas les autres.
- La commande est idempotente.
- Les données anciennes sont purgées après une période définie, par exemple 24 mois.

### 9.5 Indicateurs dérivés

| Indicateur | Règle simple |
|---|---|
| Nouvelle | Pharmacie créée depuis moins de 14 jours |
| Active | Au moins une commande dans les 14 derniers jours |
| Dormante | Aucune commande entre 14 et 30 jours |
| À risque | Aucune commande depuis plus de 30 jours, ou essai bientôt expiré |
| Suspendue | Statut technique ou commercial suspendu |

---

## 10. Écrans prioritaires

### 10.1 MVP — Écrans indispensables

| Écran | Objectif |
|---|---|
| Connexion + 2FA | Accès sécurisé |
| Tableau de bord minimal | État global |
| Liste des pharmacies | Trouver et filtrer les tenants |
| Fiche pharmacie | Voir les informations essentielles |
| Actions tenant | Suspendre, réactiver, changer le plan |
| Maintenance globale | Couper ou restaurer la plateforme |
| Journal d’audit | Tracer les actions |

### 10.2 Version intermédiaire

| Écran | Objectif |
|---|---|
| Santé plateforme | Erreurs, collectes, sauvegardes |
| Notes internes | Suivi support |
| Recherche avancée | Retrouver une pharmacie rapidement |
| Export CSV | Analyse hors ligne |
| Création de pharmacie | Onboarding assisté |
| Gestion de l’équipe | Comptes et rôles |

### 10.3 Version avancée

| Écran | Objectif |
|---|---|
| Clients globaux | Comprendre l’usage transversal |
| Facturation SaaS | Abonnements, factures, paiements |
| Annonces | Communiquer avec les pharmacies |
| Alertes automatiques | Tenants à risque, erreurs répétées |
| Rapports d’activité | Tendances et cohortes |
| Support avancé | Historique d’intervention structuré |

---

## 11. API minimale

### 11.1 Authentification

```text
POST /api/v1/plateforme/auth/connexion/
POST /api/v1/plateforme/auth/2fa/
POST /api/v1/plateforme/auth/rafraichir/
POST /api/v1/plateforme/auth/deconnexion/
GET  /api/v1/plateforme/auth/moi/
```

### 11.2 Pharmacies

```text
GET    /api/v1/plateforme/pharmacies/
GET    /api/v1/plateforme/pharmacies/<id>/
PATCH  /api/v1/plateforme/pharmacies/<id>/
POST   /api/v1/plateforme/pharmacies/<id>/suspendre/
POST   /api/v1/plateforme/pharmacies/<id>/reactiver/
POST   /api/v1/plateforme/pharmacies/<id>/resilier/
POST   /api/v1/plateforme/pharmacies/<id>/archiver/
```

### 11.3 Maintenance

```text
GET  /api/v1/plateforme/systeme/maintenance/
POST /api/v1/plateforme/systeme/maintenance/globale/
POST /api/v1/plateforme/pharmacies/<id>/maintenance/
```

### 11.4 Audit et santé

```text
GET /api/v1/plateforme/audit/
GET /api/v1/plateforme/sante/
GET /api/v1/plateforme/tableau-de-bord/
```

---

## 12. Tests obligatoires

### 12.1 Sécurité

- Un jeton pharmacie est refusé sur `/api/v1/plateforme/`.
- Un jeton plateforme est refusé sur les routes pharmacie et client.
- Un jeton de la pharmacie A est refusé sur la pharmacie B.
- Les routes plateforme renvoient 404 sur un sous-domaine de pharmacie.
- Un compte désactivé ne peut plus se connecter.
- Le 2FA est obligatoire.
- Le verrouillage fonctionne après échecs répétés.

### 12.2 Suspension

- Une pharmacie suspendue reçoit une erreur explicite.
- La réactivation restaure l’accès.
- Les WebSockets respectent la suspension.
- La maintenance globale bloque les routes métier.
- La maintenance d’un tenant n’affecte pas les autres.

### 12.3 Audit

- Chaque écriture génère une entrée d’audit.
- L’audit ne peut pas être modifié ou supprimé.
- Les connexions échouées sont journalisées.
- Les actions sensibles sont tracées avec avant/après.

### 12.4 Métriques

- La collecte produit des valeurs exactes.
- Elle est idempotente.
- Une erreur sur un tenant n’arrête pas les autres.
- Aucune donnée personnelle n’est stockée dans `MetriqueTenantJour`.
- La liste des pharmacies reste rapide même avec plusieurs centaines de tenants.

---

## 13. Plan de réalisation

### Phase 0 — Sécurité préalable

Objectif : ne construire aucune interface avant de sécuriser la base.

- Test démontrant la faille de jeton inter-schéma.
- Ajout de la claim `schema`.
- Vérification dans `StaffJWTAuthentication`.
- Middleware de suspension.
- Blocage des WebSockets pour les tenants suspendus.
- Réduction de la durée des jetons sensibles.
- Tests automatisés.

Livrable :

- Un jeton pharmacie ne peut pas être utilisé sur une autre pharmacie.
- Une pharmacie suspendue est réellement bloquée.

### Phase 1 — Fondations de l’admin plateforme

Objectif : pouvoir se connecter en tant qu’équipe Pharmacie+.

- App Django `plateforme`.
- Modèle `ComptePlateforme`.
- Authentification dédiée.
- 2FA obligatoire.
- Rôles initiaux.
- Commande de création de compte.
- Throttling.
- Journal d’audit.
- Routes d’authentification.

Livrable :

- Un membre de l’équipe peut se connecter avec email, mot de passe et 2FA.
- Les rôles sont appliqués côté API.

### Phase 2 — Registre des pharmacies

Objectif : voir et comprendre les tenants.

- Extension du modèle `Pharmacie`.
- Séparation `plan` / `statut`.
- Liste des pharmacies.
- Recherche et filtres.
- Fiche pharmacie.
- Tableau de bord minimal.
- Statistiques de base.

Livrable :

- L’équipe peut voir toutes les pharmacies, leur statut et leurs informations essentielles.

### Phase 3 — Cycle de vie et maintenance

Objectif : piloter réellement les tenants.

- Suspension.
- Réactivation.
- Résiliation.
- Archivage.
- Changement de plan.
- Maintenance globale.
- Maintenance par tenant.
- Motifs et dates.
- Journalisation complète.

Livrable :

- L’équipe peut suspendre, réactiver et mettre en maintenance une pharmacie ou toute la plateforme.

### Phase 4 — Métriques agrégées

Objectif : suivre l’activité sans violer l’isolation.

- Modèle `MetriqueTenantJour`.
- Commande de collecte.
- Planification nocturne.
- Indicateurs d’engagement.
- Historique sur 30, 90 jours.
- Bouton d’actualisation ciblée.

Livrable :

- L’équipe voit l’activité récente et les pharmacies dormantes ou à risque.

### Phase 5 — Support et santé

Objectif : exploiter la plateforme au quotidien.

- Notes internes.
- Écran santé.
- Erreurs de collecte.
- Liens vers Sentry.
- Dernière sauvegarde.
- Recherche support.
- Export CSV.

Livrable :

- L’équipe peut diagnostiquer un problème et garder une trace de ses interventions.

### Phase 6 — Onboarding

Objectif : créer une pharmacie depuis la console.

- Création du tenant.
- Création du domaine.
- Création du premier administrateur pharmacie.
- Email de bienvenue.
- Mot de passe provisoire.
- Suivi de l’état de création.

Livrable :

- Une pharmacie peut être créée de bout en bout depuis l’admin plateforme.

### Phase 7 — Clients globaux

Objectif : comprendre l’usage des comptes clients.

- Modèle `UsageClientPharmacie`.
- Statistiques globales.
- Nombre de pharmacies utilisées par client.
- Recherche exacte pour support.
- Journalisation des accès sensibles.

Livrable :

- L’équipe comprend l’usage transversal sans exposer les données personnelles inutilement.

### Phase 8 — Facturation SaaS

Objectif : monétiser proprement la plateforme.

- Abonnements.
- Échéances.
- Factures.
- Paiements Mobile Money.
- Relances.
- Historique de facturation.
- Rapports financiers internes.

Livrable :

- La plateforme peut suivre et encaisser les abonnements.

### Phase 9 — Fonctions avancées

À construire seulement lorsque les phases précédentes sont stables.

- Annonces groupées.
- Alertes automatiques.
- Rapports avancés.
- Cohortes.
- Support structuré.
- Intégrations externes.
- Prise en main temporaire d’un tenant, uniquement avec consentement et traçabilité.

---

## 14. Décisions à trancher

| # | Décision | Recommandation |
|---|---|---|
| 1 | Afficher le chiffre d’affaires des pharmacies ? | Non dans le MVP. Utiliser volume d’activité et part de commandes. |
| 2 | 2FA obligatoire ? | Oui, pour tous les comptes plateforme. |
| 3 | Domaine dédié ou chemin `/plateforme` ? | Domaine dédié en production, chemin en développement. |
| 4 | Jeton en cookie HttpOnly ou localStorage ? | Cookie HttpOnly pour l’admin plateforme. |
| 5 | Suspension : blocage total ou lecture seule ? | Blocage total au MVP, mode dégradé plus tard. |
| 6 | Ajouter ville, pays, agrément, commercial ? | Ville et pays dès la phase 2 ; agrément et CRM plus tard. |
| 7 | Impersonation ? | Non dans le MVP. |
| 8 | Combien de rôles au départ ? | `proprietaire`, `admin`, `support`, `lecture`. |
| 9 | Politique de conservation des données ? | À définir avant toute résiliation ou suppression. |
| 10 | Facturation ? | Hors MVP, après validation du modèle commercial. |

---

## 15. Hors périmètre immédiat

- Facturation automatique.
- Impersonation.
- Envoi de messages groupés.
- Tableau de bord financier des pharmacies.
- Lecture des ordonnances.
- Application mobile admin.
- Intelligence artificielle prédictive.
- Automatisations complexes.

---

## 16. Définition du MVP terminé

Le MVP de l’admin plateforme est terminé lorsque :

1. Les jetons sont correctement isolés par schéma.
2. La suspension fonctionne réellement.
3. Un membre de l’équipe peut se connecter avec 2FA.
4. Il peut voir la liste des pharmacies.
5. Il peut ouvrir la fiche d’une pharmacie.
6. Il peut suspendre et réactiver une pharmacie.
7. Il peut activer une maintenance globale.
8. Chaque action sensible est journalisée.
9. Les tests de sécurité passent.
10. Aucune donnée sensible de pharmacie n’est exposée inutilement.

Tout le reste est une amélioration, pas un prérequis.
