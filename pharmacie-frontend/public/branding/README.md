# Branding Pharmacie+

Ce dossier contient les assets de la marque **Pharmacie+** (le SaaS lui-même — à ne pas confondre
avec `PharmacieConfig.logo`, qui est le logo propre à chaque pharmacie-tenant, uploadé depuis
`/admin/settings`).

## Fichiers de production (détourés, transparence corrigée)

| Fichier | Description | Usage prévu |
|---|---|---|
| `icon-mark.png` | Marque seule (P + croix + feuille), fond transparent | Source pour favicon, icônes PWA |
| `logo-full.png` | Logo officiel complet : carte dégradé bleu→vert + texte "PHARMACIE PLUS", coins transparents | Logo par défaut, en-tête email, écran de connexion |
| `logo-card-green.png` | Variante carte verte pleine, texte blanc | Réseaux sociaux, listing app store |
| `logo-mono.png` | Version monochrome noire, verticale, sans texte | Tampons, impressions N&B |
| `logo-horizontal-mono.png` | Version monochrome noire, horizontale, avec slogan | En-tête de facture/rapport PDF, papier à en-tête |

## Dossier `raw/`

Les 15 images originales générées (non modifiées), conservées pour référence si un nouveau
détourage ou un nouveau format est nécessaire plus tard. Le fichier `00-...` est la planche de
présentation complète de la charte graphique (palette, typo, déclinaisons).

## Fichiers dérivés ailleurs dans `public/`

- `public/favicon.ico` — régénéré depuis `icon-mark.png`
- `public/icons/*.png` — icônes PWA (192/512/maskable/apple-touch-icon), régénérées depuis `icon-mark.png`
- `public/static/logo.png` — logo par défaut affiché dans `/admin/settings` avant que le tenant
  n'upload son propre logo de pharmacie

## Note technique

Les fichiers `raw/11-LOGO-OFFICIEL-...` et `raw/12-logo-carte-verte-...` avaient un défaut
d'export : les coins arrondis étaient en noir plein (`#000000`) au lieu d'être transparents. Ce
défaut a été corrigé dans les versions de production ci-dessus (détourage par clé de couleur).
