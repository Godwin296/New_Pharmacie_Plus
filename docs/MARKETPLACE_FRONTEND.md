# Marketplace : contrat backend ↔ frontend

Page « Choisir votre pharmacie » (recherche, « Utiliser ma position », carte, cartes pharmacie,
« Choisir cette pharmacie »). Ce document liste **exactement** ce que le backend sert et comment
brancher chaque bouton. Backend livré et testé (`manage.py test marketplace`, 55 tests).

---

## 1. Où créer la page

| Élément | Emplacement |
|---|---|
| Page | `pharmacie-frontend/app/marketplace/page.tsx` (nouvelle route `/marketplace`) |
| Composants dédiés | `pharmacie-frontend/app/marketplace/_components/` (carte pharmacie, bandeau carte, barre de recherche) |
| Hook géoloc | `pharmacie-frontend/lib/hooks/useGeolocalisation.ts` |
| Accueil de la plateforme | `app/page.tsx` : au montage, appeler `/api/v1/contexte/` ; si `plateforme` → `router.replace('/marketplace')` ; si `pharmacie` → catalogue actuel |
| `app/layout.tsx` | ajouter `pathname.startsWith('/marketplace')` à `isSpecialRoute` (la page a son propre bandeau et sa propre navigation basse) |
| `ConfigPharmacieProvider` | ne charger `/api/v1/infos-pharmacie/` **que** si le contexte est `pharmacie` (cette route n'existe pas sur le domaine plateforme → 404) |

Tout appel marketplace est **public** (aucun JWT, aucun `Authorization`).

---

## 2. Routes servies

Base : `/api/v1/`. Les routes marketplace et contexte sont montées **sur le domaine plateforme
ET sur les sous-domaines** (mêmes vues).

### 2.1 Nouvelles routes (marketplace, publiques)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/v1/contexte/` | Où suis-je : plateforme ou pharmacie ? |
| GET | `/api/v1/marketplace/pharmacies/` | Liste paginée (cartes) |
| GET | `/api/v1/marketplace/pharmacies/carte/` | Marqueurs pour la carte (sans pagination) |
| GET | `/api/v1/marketplace/pharmacies/<id>/` | Fiche complète + horaires jour par jour |

Paramètres communs à la liste et à la carte (le détail accepte seulement `lat`/`lng`) :

| Param | Exemple | Effet |
|---|---|---|
| `q` | `q=dupont` | Recherche par nom / adresse (insensible à la casse) |
| `lat`, `lng` | `lat=4.05&lng=9.70` | Active `distance_km` et le tri du plus proche au plus loin. **Les deux ensemble**, sinon 400 |
| `rayon_km` | `rayon_km=10` | Filtre « autour de moi » (exige `lat`+`lng`, ]0 ; 500]) |
| `page`, `page_size` | `page=2` | Liste uniquement (20 par page, 100 max) |

Erreurs : `400 {"error": "message lisible"}` pour toute position/rayon invalide (nan, hors bornes,
une seule coordonnée, rayon sans position).

### 2.2 `GET /api/v1/contexte/`

```json
{ "contexte": "plateforme" }
{ "contexte": "pharmacie", "pharmacie": { "id": 3, "nom": "Pharmacie Dupont" } }
```

### 2.3 `GET /api/v1/marketplace/pharmacies/` (une carte)

```json
{
  "count": 12, "next": null, "previous": null,
  "results": [{
    "id": 3,
    "nom": "Pharmacie Dupont",
    "adresse": "12 Rue de la Paix, Douala",
    "telephone": "+237...",
    "latitude": 4.05, "longitude": 9.70,
    "services": ["vaccins", "conseils", "parapharmacie"],
    "ouvert_24h": false,
    "ouvert_maintenant": true,
    "prochain_changement": { "type": "fermeture", "heure": "20:00", "jour_semaine": 2, "aujourdhui": true },
    "horaires_resume": [{ "jour_debut": 0, "jour_fin": 5, "ouverture": "08:30", "fermeture": "20:00" }],
    "distance_km": 1.2,
    "sous_domaine": "dupont.localhost"
  }]
}
```

Règles d'affichage :

| Champ | Maquette |
|---|---|
| `ouvert_maintenant: true` + `prochain_changement.type == "fermeture"` | « Ouvert jusqu'à 20:00 » |
| `ouvert_maintenant: false` | « Fermé » (+ « Ouvre à 08:30 » depuis `prochain_changement`, `aujourdhui:false` → nom du jour via `jour_semaine`, 0 = lundi) |
| `ouvert_maintenant: null` | « Horaires non communiqués » |
| `ouvert_24h: true` | « Ouvert 24h/24 » (`prochain_changement` = null) |
| `horaires_resume` | « Lun-Sam : 8h30 - 20h00 » (le frontend formate jours et heures) |
| `distance_km: null` | masquer la distance (pas de position ou pharmacie sans coordonnées) |

### 2.4 `GET /api/v1/marketplace/pharmacies/carte/`

```json
{ "count": 9, "results": [
  { "id": 3, "nom": "Pharmacie Dupont", "latitude": 4.05, "longitude": 9.70,
    "ouvert_maintenant": true, "distance_km": 1.2, "sous_domaine": "dupont.localhost" } ] }
```
Uniquement les pharmacies avec coordonnées, plafonnées (les plus proches d'abord avec position).

### 2.5 `GET /api/v1/marketplace/pharmacies/<id>/`

Mêmes champs que la carte + `horaires: [{jour_semaine, jour_label, ferme, heure_ouverture, heure_fermeture}]`. 404 si inactive / sans domaine.

---

## 3. Bouton par bouton

| Élément de la maquette | Action frontend | Appel |
|---|---|---|
| Champ « Rechercher une pharmacie » | Debounce 300 ms | `GET /marketplace/pharmacies/?q=…` (+ `lat/lng` si déjà obtenues) |
| **Utiliser ma position** | `navigator.geolocation.getCurrentPosition` (HTTPS ou localhost requis) → mémoriser `{lat,lng}` en state → relancer liste **et** carte | `GET /marketplace/pharmacies/?lat=…&lng=…[&rayon_km=10]` + `/carte/` avec les mêmes params |
| Refus de géoloc / erreur | Message + la liste reste utilisable sans tri | aucun appel |
| Bandeau carte / onglet **Carte** | Afficher les pins ; clic pin → ouvre la fiche | `GET /marketplace/pharmacies/carte/` ; détail `GET /marketplace/pharmacies/<id>/` |
| Carte pharmacie (clic) | Fiche / bottom sheet | `GET /marketplace/pharmacies/<id>/` (ou réutiliser les données de la liste) |
| **Choisir cette pharmacie** | `window.location.href = `${protocole}//${sous_domaine}${port}/`` : redirection vers le sous-domaine (garder le port de dev `:3000`) | aucun appel ; pas de requête, c'est une navigation |
| Onglet Accueil | `/marketplace` | — |
| Onglet Carte | vue carte plein écran | `/carte/` |
| Onglet **Profil / Commandes / cloche** | Voir §6 : ces routes sont **par pharmacie** (sous-domaine) | — |
| Pagination / « voir plus » | `?page=N` ou suivre `next` | liste |

Position : à conserver côté client (state, éventuellement `sessionStorage`). Le backend ne
stocke jamais la position du client.

---

## 4. Règle de marque (logo)

- **Domaine plateforme / marketplace** : toujours le logo **Pharmacie+** (P blanc + feuille bleue). Le backend n'expose **aucun** logo de pharmacie sur les routes marketplace (ni `logo`, ni `logo_public`).
- **Sous-domaine d'une pharmacie** : logo de la pharmacie, via `GET /api/v1/infos-pharmacie/` (route existante, sous-domaine uniquement).
- Décision côté frontend : `contexte == "plateforme"` → asset Pharmacie+ ; `contexte == "pharmacie"` → logo de `infos-pharmacie`. À appliquer dans `components/PharmacyIcon.tsx` (aujourd'hui il lit le logo tenant puis `/branding/icon-mark.png`).
- ⚠️ Asset exact « P blanc avec feuille bleue » à confirmer (candidats dans `public/icons/icon-512x512.png`, `public/branding/`). Prévoir un fichier unique `public/branding/pharmacie-plus-logo.png`.

---

## 5. Services (vocabulaire contrôlé)

Codes renvoyés dans `services` et acceptés par l'admin : `vaccins`, `conseils`, `parapharmacie`,
`garde`, `livraison`, `depistage`, `orthopedie`, `materiel_medical`.
Libellés à afficher côté frontend (i18n) ; la liste officielle avec libellés FR est aussi
renvoyée par `GET /api/v1/infos-marketplace/` (`services_disponibles`).

### Côté pharmacien (sous-domaine, **admin requis**, JWT)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/v1/infos-marketplace/` | Lit lat/lng, `ouvert_24h`, `services`, `services_disponibles` |
| POST | `/api/v1/infos-marketplace/` | Met à jour. 400 si lat/lng hors bornes ou code de service inconnu |

---

## 6. Routes existantes (sous-domaine pharmacie) à brancher sur les autres onglets

Toutes sous `/api/v1/` **sur le sous-domaine de la pharmacie choisie**. JWT dans `localStorage` (par origine).

| Besoin | Route |
|---|---|
| Config + logo de la pharmacie | `GET infos-pharmacie/` |
| Inscription / connexion client | `POST client/register/`, `POST client/login/`, `GET client/me/`, `POST client/changer-mot-de-passe/` |
| Catalogue / produit | `GET catalogue/`, `GET produits/…` |
| Favoris | `GET favoris/`, `POST favoris/<produit_id>/` |
| Panier | `GET panier/`, `…/panier/item/<id>/` |
| Commandes (onglet Commandes) | `GET commandes/`, `commandes/<id>/soumettre-paiement/`, `…/marquer-retiree/` |
| Utilisateur courant | `GET current-user/` |

---

## 7. Points d'attention

1. **Authentification inter-origines** : le JWT est stocké par origine ; une connexion sur le domaine plateforme n'est pas partagée avec `dupont.localhost`. Le flux prévu : choisir la pharmacie (marketplace, sans compte) → redirection → connexion sur le sous-domaine. Login/inscription client n'existent **que** sur sous-domaine pour l'instant.
2. **CORS / ALLOWED_HOSTS** : l'origine du domaine plateforme doit figurer dans `ALLOWED_HOSTS` et `CORS_ALLOWED_ORIGINS` du `.env` backend.
3. **apiClient** déduit l'hôte API depuis `window.location.hostname` + port 8000 : sur le domaine plateforme, il appellera donc le backend plateforme (schéma public), c'est voulu.
4. **Fuseau** : « ouvert maintenant » est calculé à l'heure serveur (`Africa/Douala`). Plages passant minuit non gérées → utiliser `ouvert_24h`.
5. **Visibilité** : n'apparaissent que les pharmacies actives avec un domaine primaire ; la ligne `public` n'est jamais listée.
6. **Données source** : nom/adresse/téléphone/coordonnées sont synchronisés depuis la config de chaque pharmacie ; une pharmacie sans coordonnées apparaît dans la liste mais pas sur la carte.
