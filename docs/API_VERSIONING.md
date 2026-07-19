# Versioning de l'API — Pharmacie Plus

## Stratégie retenue : versioning par préfixe d'URL

`https://<tenant>.exemple.com/api/v1/catalogue/`

Pas de versioning par en-tête HTTP ni par paramètre de requête : le préfixe d'URL est
explicite, visible dans les logs serveur, trivial à tester avec `curl`, et ne demande
aucune configuration côté client (juste changer une base URL).

## État actuel (depuis ce changement)

- **`/api/v1/...`** : préfixe **canonique**, à utiliser pour tout nouveau code (nouvelles
  pages frontend, appli mobile future, intégrations tierces, scripts).
- **`/api/...`** (sans version) : reste monté, **strictement identique** à `/api/v1/...`
  (même urlconf `core.urls`, mêmes vues). Conservé uniquement parce que le frontend
  Next.js actuel appelle encore ce préfixe historique partout (`apiClient.ts` +
  des dizaines d'appels `apiClient.get('/api/...')` dans `app/`). Aucune date de
  suppression n'est fixée : `/api/` restera disponible tant que la migration du
  frontend vers `/api/v1/` n'est pas terminée.

Autrement dit : **rien ne casse aujourd'hui**. Ce changement ajoute un chemin, il n'en
retire aucun.

## Règle pour la suite : comment introduire un changement cassant

Quand un endpoint doit changer de comportement de façon incompatible (renommer un champ,
changer un format de réponse, changer une méthode HTTP...) :

1. **Ne JAMAIS modifier la vue existante utilisée par `v1`.** `v1` doit rester stable
   pour tout client qui s'y fie déjà (frontend legacy, appli mobile déjà publiée...).
2. Créer la nouvelle version de la vue dans `core/api.py` (ou un futur `core/api_v2.py`
   si le volume justifie un fichier séparé), avec son propre nom de fonction
   (ex: `api_catalogue_v2`).
3. Créer `core/urls_v2.py` (copie de `core/urls.py` réutilisant les vues inchangées +
   les nouvelles vues `_v2`), et le monter dans `config/urls.py` :
   ```python
   path("api/v2/", include("core.urls_v2")),
   ```
4. Documenter le changement dans ce fichier (section "Historique des versions" ci-dessous).
5. Migrer le frontend vers `/api/v2/` pour CET endpoint précis (pas besoin de tout migrer
   d'un coup — chaque appel `apiClient` peut pointer vers une version différente si besoin,
   le temps de la transition).
6. Une fois plus aucun client n'appelle `v1` pour cette route (vérifiable via les logs /
   Sentry), elle peut être dépréciée puis retirée dans une release ultérieure, annoncée à
   l'avance.

## Ce qui NE justifie PAS une nouvelle version

- Ajouter un champ optionnel à une réponse existante (les clients qui l'ignorent ne sont
  pas affectés).
- Ajouter un nouvel endpoint.
- Corriger un bug qui rendait une réponse incorrecte au regard de sa propre documentation
  (ex: le correctif `payee=True` de `/api/archives/` — ce n'est pas un changement d'API,
  c'est la réparation d'un comportement qui n'aurait jamais dû exister).

Ces cas restent dans `v1` directement.

## Historique des versions

- **v1** (en place depuis toujours, formalisée sous ce préfixe le 16/07/2026) : première
  version stable de l'API, couvre catalogue, panier, commandes, ventes guichet,
  authentification (staff + CompteClient), administration, prédiction de stock.
