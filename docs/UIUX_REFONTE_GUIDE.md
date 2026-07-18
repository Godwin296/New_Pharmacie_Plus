# Guide de refonte UI/UX — Pharmacie+

> Document de référence à suivre tout au long de la refonte visuelle. Contrairement à
> une maquette (orientation visuelle), ce document répond à la question **fonctionnelle** :
> quelles pages doivent exister, et que doit-on pouvoir y faire, pour chacun des 4 profils
> (client, caisse, admin d'une pharmacie, administrateur de la plateforme Pharmacie+).
>
> Basé sur un audit réel du code (pas une supposition) mené le 18/07/2026, qui approfondit
> une première analyse. Direction visuelle (couleurs, style de cartes...) : voir
> [PROMPT_REPRISE.md](../PROMPT_REPRISE.md#-direction-stylistique-maquettes-reçues-pour-la-refonte-uiux).

---

## 0. Résumé exécutif

| Profil | Pages existantes | État de la navigation | Verdict |
|---|---|---|---|
| Client | 5 | Menu générique très limité, aucune page profil | 🔴 Chantier fonctionnel avant même le visuel |
| Caisse | 4 | Sidebar dédiée, couvre l'essentiel | 🟡 Bon socle, gaps opérationnels réels identifiés ci-dessous |
| Admin (par pharmacie) | 12 | Sidebar dédiée, complète en surface | 🟡 Complète en *nombre de pages*, mais dashboard analytique réellement basique |
| Admin plateforme (Pharmacie+) | **0** | **N'existe pas du tout** (seulement le Django admin brut) | 🔴 Angle mort total, à concevoir de zéro |

**Nombre de pages à redessiner visuellement :** les 23 pages existantes + au minimum 1 page
client (`/profil`) + un chantier séparé complet pour l'admin plateforme (nombre de pages à
définir en phase 2, voir section 4).

---

## 1. Inventaire des pages (rappel de l'audit précédent, confirmé)

| Rôle | Pages |
|---|---|
| Public/partagé | `/` (accueil), `/login`, `/register`, `/offline` |
| Client (5) | `/catalogue`, `/panier`, `/commandes`, `/facture`, `/ordonnance/upload` |
| Caisse (4) | `/caisse/pos`, `/caisse/paiements`, `/caisse/ordonnances`, `/caisse/archives` |
| Admin pharmacie (12) | `/admin/dashboard`, `/admin/stocks` (+`/alertes`, `/print`), `/admin/reapprovisionnement`, `/admin/predictions`, `/admin/historique`, `/admin/clients`, `/admin/fournisseurs`, `/admin/rapports` (+`/print`), `/admin/settings` |

Le site marketing (`pharmacie-marketing/`) est un projet Next.js séparé, non concerné par
cette refonte (page vitrine publique, pas une page de l'application elle-même).

---

## 2. Côté client — confirmé : il manque une vraie zone personnelle

Rien à ajouter à l'analyse précédente sur ce point, elle est correcte : `CompteClient`
(compte global, un par personne, valable chez plusieurs pharmacies — cf.
`clients_publics/models.py`) a tous les champs nécessaires (`nom`, `email`, `telephone`)
mais **aucune page ne les expose**. Le menu hamburger générique (`app/layout.tsx`) ne
propose que Catalogue / Panier / Mes Commandes.

**Pages/sections à créer :**
- `/profil` (ou `/compte`) : affichage + modification nom/téléphone, changement de mot de
  passe (utiliser le même mécanisme que `/admin/clients` déjà en place côté admin, mais
  self-service ici).
- Lien visible vers `/ordonnance/upload` et l'historique de facture (`/facture?id=`)
  depuis le menu — aujourd'hui accessibles uniquement en navigation profonde depuis une
  commande, jamais depuis le menu principal.
- Pas de gestion d'assurance/tiers-payant à prévoir (non pertinent dans le contexte
  camerounais/CEMAC, confirmé par la recherche).

---

## 3. Côté caisse — réponse à ta question : bon socle, mais pas complet

### Ce qui existe et fonctionne réellement (vérifié dans le code, pas supposé)

`app/caisse/pos/page.tsx` a bien un écouteur de scanner douchette :
```
window.addEventListener('keydown', handleGlobalKeyDown)
```
Il détecte une rafale de frappes suivie d'un `Enter` (signature typique d'une douchette,
qui "tape" le code puis simule un Entrée) et cherche le produit correspondant, en local
d'abord, puis côté serveur si besoin.

### ⚠️ Un gap important que ta question a fait remonter

Le champ scanné est `Produit.identifiant` — un **code interne généré automatiquement**
par l'application (`PRD-xxxxxxxx`), pas le vrai code-barres EAN/UPC imprimé sur l'emballage
d'origine du fabricant. Concrètement : ta douchette fonctionne aujourd'hui **seulement
si tu imprimes et colles toi-même des étiquettes avec ce code interne** sur chaque
produit. Elle ne peut pas encore scanner directement le code-barres d'origine de la boîte
telle qu'elle arrive du fournisseur.

**Pour scanner le code d'origine**, il faudrait :
1. Ajouter un champ `code_barre_fabricant` (EAN-13 le plus souvent) sur `Produit`.
2. Un flux de "première réception" : au premier arrivage d'un produit, scanner son code
   d'origine une fois pour l'enregistrer (associé au produit), puis il est reconnu à
   chaque scan suivant. Sans base de données EAN externe payante, ce lien doit être fait
   manuellement une fois par référence produit (pas par unité).

C'est un vrai chantier (nouveau champ + nouveau flux), pas une case à cocher — je le liste
mais je ne l'implémente pas sans ton feu vert, ça touche la logique de réception de stock.

### Autres gaps opérationnels identifiés (recherche + audit du code)

Standards du secteur absents aujourd'hui, à trancher selon tes priorités :

- **Retours / remboursements** : aucune page ni logique ne permet d'annuler une vente déjà
  encaissée (recréditer le stock + tracer le remboursement). Actuellement, une fois
  `payee=True`, une commande ne peut plus être annulée (garde-fou volontaire pour l'audit
  financier, cf. `Commande.annuler_commande()`) — ce qui est correct pour éviter la fraude,
  mais ça veut dire qu'il n'existe **aucun** mécanisme légitime de retour produit non plus.
  Un vrai flux de retour a besoin de sa propre logique (pas juste "annuler"), avec motif et
  traçabilité.
- **Clôture de caisse / rapprochement de fin de journée** : pas de "Z-report" (total encaissé
  vs total attendu en fin de service par caissière). Étant donné que le cash guichet est
  déjà distingué de l'en-ligne dans le dashboard admin (`ca_ventilation`), la donnée existe
  déjà — il manque juste une vue "par caissière, par journée" pour le rapprochement.
- **Paiement fractionné/multi-moyens** : une vente est actuellement liée à un seul
  `moyen_paiement` (Orange Money OU MTN MoMo). Pas de "moitié cash, moitié mobile money"
  sur une même vente — à évaluer si c'est un besoin réel dans tes pharmacies clientes avant
  de le construire.
- **Réimpression de facture depuis le POS** : la recherche par référence existe déjà côté
  `/caisse/archives`, mais pas directement depuis l'écran de vente (le caissier doit changer
  de page). Petit gain UX, faible effort.

**Verdict pour la refonte visuelle du POS** : dessine l'écran de vente en prévoyant l'espace
pour ces futures actions (bouton "Retour produit", accès rapide à la clôture), même si la
logique n'est pas encore construite — coûte rien maintenant, évite de re-designer plus tard.

---

## 4. Côté admin (par pharmacie) — réponse à ta question : dashboard réellement basique, tu as raison

### Ce qui existe aujourd'hui (`/api/boss-dashboard/`, vérifié dans `core/api.py`)

- CA total (revenu), avec ventilation cash guichet vs en ligne
- Graphique des ventes sur 7 jours glissants
- Top 5 des produits les plus vendus (en quantité)
- Compteur produits en stock critique + produits expirant sous 60 jours
- 5 dernières ventes

C'est un dashboard **opérationnel** correct (utile au quotidien), mais effectivement pas
un dashboard **analytique avancé** — ton instinct était juste. Ce manque était déjà
identifié dans `PROMPT_REPRISE.md` ("Dashboard analytics avancé — comparaison
période/période, marge réelle") ; voici le détail complet de ce qu'il manque, avec la
raison technique pour chaque point :

| Fonctionnalité manquante | Faisable aujourd'hui ? | Pourquoi |
|---|---|---|
| Comparaison période/période (ce mois vs mois dernier, % de croissance) | ✅ Oui, données déjà en base | Juste une nouvelle requête agrégée + UI |
| **Marge réelle / rentabilité** | ❌ **Non — bloqué par le modèle de données** | `Produit` n'a **aucun champ `prix_achat`** (prix d'achat/coût). Le CA actuel montre du chiffre d'affaires, jamais du profit. Nécessite une migration de base de données + ressaisie du prix d'achat par produit (ou import) avant que ce calcul ait le moindre sens |
| Répartition par catégorie de produit | ✅ Oui | `Produit.categorie` existe déjà, juste pas agrégé dans le dashboard |
| Répartition par moyen de paiement (Orange Money vs MTN MoMo) | ✅ Oui, déjà tracké | `Commande.moyen_paiement` existe, juste pas exposé dans les stats |
| Panier moyen (valeur moyenne par vente) | ✅ Oui | Calcul simple sur les données existantes |
| Rotation de stock / produits dormants (jamais vendus) | ✅ Oui | Croiser `Produit` avec `ItemCommande` — utile pour arrêter de réapprovisionner ce qui ne se vend pas |
| Heures de pointe (pic d'affluence dans la journée) | ✅ Oui | `Commande.date` a l'heure, juste jamais agrégée par tranche horaire |
| Prédictions de stock intégrées au dashboard principal | ✅ Oui, moteur déjà prêt | `core/services_prediction.py` + `/admin/predictions` existent déjà **en page séparée** (branché le 12/07) — juste pas résumé sur le dashboard principal |

**Recommandation pour la refonte** : prévoir dans la maquette du nouveau dashboard un
espace pour "comparaison de période" + un widget résumé des prédictions de stock (les 2
réalisables immédiatement, sans changement de modèle de données). La marge réelle est un
chantier à part (migration `prix_achat`), à traiter séparément — je ne le lance pas sans
ton accord, ça implique de ressaisir des données existantes.

---

## 5. Admin plateforme "Pharmacie Plus" — confirmé : ça n'existe pas du tout

C'est le point le plus important que ta question a fait remonter. Aujourd'hui, **la
seule interface pour gérer les pharmacies clientes (les tenants) est le Django admin
brut** (`/admin/` sur le domaine racine, `tenants/admin.py`) — une interface générique
de base de données, pas une interface pensée pour piloter un SaaS.

### Ce qui existe déjà en base (bonne nouvelle : la donnée est là, l'interface non)

Le modèle `Pharmacie` (dans `tenants/models.py`, schéma public) a déjà :
- `plan` : essai / standard / pro / suspendu — **le suivi d'abonnement existe déjà comme
  champ**, juste jamais affiché nulle part de façon utilisable.
- `actif` : compte activé/désactivé
- `proprietaire_email`, `proprietaire_telephone`
- `date_creation`

Et architecturalement important à savoir pour la suite : **les comptes qui géreraient
cette interface (toi, ton équipe) vivraient dans une table `auth_user` complètement
SÉPARÉE** de celle de chaque pharmacie cliente (`django.contrib.auth` est à la fois dans
`SHARED_APPS` ET `TENANT_APPS` — deux tables distinctes, une par schéma). Un compte admin
"Pharmacie Plus" n'a donc rien à voir avec un compte admin d'une pharmacie précise, et
aura besoin de son propre système de connexion (nouvel endpoint de login, pas
`api_login` qui suppose un contexte tenant).

### Ce qu'il faudrait construire (recherche : ce qu'un panneau SaaS B2B propose typiquement)

| Page proposée | Contenu |
|---|---|
| `/plateforme/login` | Connexion séparée, réservée aux comptes staff de Pharmacie+ (superuser du schéma public) |
| `/plateforme/tenants` | Liste des pharmacies clientes : nom, plan, statut actif/suspendu, date d'inscription, recherche/filtre par plan |
| `/plateforme/tenants/[id]` | Détail d'une pharmacie : coordonnées du titulaire, historique du plan, bouton suspendre/réactiver le compte |
| `/plateforme/clients` | Vue d'ensemble des `CompteClient` (comptes clients globaux) — combien de pharmacies différentes chaque client a utilisées, utile pour comprendre l'usage de la marketplace |
| `/plateforme/sante` | Vue agrégée de santé technique : reprendre le principe de `/healthz/` mais par tenant (quelle pharmacie a une activité normale vs anormale) |
| `/plateforme/facturation` *(futur)* | Si un jour la facturation SaaS elle-même est automatisée (actuellement le champ `plan` existe mais rien ne facture automatiquement) |

**Ce chantier est fonctionnellement indépendant du reste** (nouvelle authentification,
nouvelles vues API réservées au schéma public, nouveau dossier frontend) — je recommande
de le traiter comme une **phase 2 séparée** de la refonte visuelle des 23 pages
existantes, plutôt que de tout mélanger. Dis-moi si tu veux qu'on le démarre maintenant ou
qu'on le garde pour après la refonte client/caisse/admin-pharmacie.

---

## 6. Ce qui reste à trancher avant de commencer le visuel

1. **Priorité entre les 4 chantiers** : refonte visuelle des 23 pages existantes, page
   profil client, dashboard analytique avancé, admin plateforme — dans quel ordre ?
2. **Marge réelle (`prix_achat`)** : je lance la migration + le champ maintenant, ou on
   attend que tu aies confirmé que c'est une donnée que tes pharmacies clientes veulent
   saisir (ressaisir un prix d'achat pour chaque produit existant, c'est du travail pour
   elles) ?
3. **Retours/remboursements + clôture de caisse** : nouveau chantier logique à part
   entière, à cadrer précisément (motifs de retour acceptés, qui peut valider un retour...)
   avant même de penser à l'écran.
4. **Admin plateforme** : phase 2 séparée, comme proposé ci-dessus — confirmes-tu ?
