# Workflow design — comment implémenter les maquettes de référence (pour toute session Claude qui lit ce dépôt)

> Contexte : le porteur du projet a rassemblé une direction visuelle (captures Pinterest,
> pas des maquettes Figma complètes à reproduire à l'identique — voir
> [PROMPT_REPRISE.md](../PROMPT_REPRISE.md#-direction-stylistique-maquettes-reçues-pour-la-refonte-uiux)).
> Ce document répond à la question : **quel outil/méthode utiliser pour transformer ces
> références visuelles en code réel dans ce projet Next.js**, et pourquoi.

---

## Recommandation : PAS d'outil Figma-to-code tiers payant

Une recherche a été faite sur les outils "Figma to code" du marché 2026 (Locofy, Anima,
Builder.io Visual Copilot, DhiWise, Codia, GenVibe...). **Aucun n'est recommandé comme
méthode principale pour ce projet**, pour des raisons concrètes, pas par principe :

1. **Le porteur du projet n'a pas de maquettes Figma complètes** — juste des captures
   d'écran/images de référence (Pinterest). Ces outils partent tous d'un fichier Figma
   structuré (avec auto-layout, composants nommés...) — inapplicable ici en l'état.
2. **Coût récurrent** pour un projet qui reste volontairement sobre en dépenses tant que
   la base de clients payants n'est pas établie (cf. [docs/INFRASTRUCTURE_ROADMAP.md](INFRASTRUCTURE_ROADMAP.md), même logique appliquée ici).
3. **Qualité de sortie inégale, documentée par les sources elles-mêmes** : plusieurs
   comparatifs 2026 notent que les designs Figma complexes "ont besoin d'un nettoyage
   manuel" après export, et que le code généré doit de toute façon être relu/retravaillé
   par un développeur avant d'être mis en production — ce qui revient à faire le travail
   deux fois plutôt qu'une.
4. **Claude peut déjà voir directement une image de référence** (screenshot, photo d'écran
   Pinterest, capture de maquette) collée dans la conversation, sans passer par aucun
   outil intermédiaire — c'est plus direct que d'exporter un fichier Figma vers un
   troisième outil qui génère du code à retravailler.

## Méthode recommandée à la place

**Étape 1 — Le porteur du projet upload directement l'image de référence dans le chat**
(pas de lien Pinterest à copier/coller : Claude ne peut pas ouvrir un lien Pinterest
externe pour "regarder" l'image — il faut l'image elle-même, en pièce jointe).

**Étape 2 — La session Claude regarde l'image comme un brief visuel, pas un gabarit à
copier au pixel près.** Le porteur du projet l'a dit explicitement : ce ne sont pas des
maquettes à appliquer bêtement, mais une direction. La compétence
`frontend-design` (voir `/mnt/skills/public/frontend-design/SKILL.md`, disponible dans
tout environnement Claude avec accès aux skills) est conçue exactement pour ça : partir
d'un brief (ici, l'image + le contexte métier pharmacie/CEMAC) et produire une direction
visuelle cohérente et distinctive, plutôt qu'un template générique.

**Étape 3 — Appliquer le principe mobile-first non-négociable** (voir
[docs/UIUX_REFONTE_GUIDE.md](UIUX_REFONTE_GUIDE.md#️-principe-directeur-non-négociable--mobile-first-pas-aussi-disponible-sur-mobile))
en construisant directement dans ce projet Tailwind CSS : classes sans préfixe = mobile,
`md:`/`lg:` ajoutent les ajustements desktop.

**Étape 4 — Construire directement dans le code du projet** (React/Next.js/Tailwind déjà
en place), pas dans un outil externe — la cohérence avec les composants et conventions
déjà existants (`rounded-2xl`/`3xl`, Framer Motion, dark mode — voir
`PROMPT_REPRISE.md`) compte plus que la fidélité pixel-perfect à l'image de référence.

## Si le porteur du projet veut quand même utiliser Figma lui-même

Rien n'empêche d'utiliser **Figma en solo, gratuitement** (le plan gratuit suffit
largement) pour organiser ses propres captures d'écran en un moodboard cohérent avant de
les partager — c'est utile pour LUI, pour clarifier sa propre direction avant de la
transmettre. Ce qui n'est pas recommandé, c'est de payer un plugin tiers pour convertir
ce Figma en code : la conversion se fait directement par la session Claude qui travaille
sur ce dépôt, via la méthode ci-dessus.

## Résumé pour toute session future

| Le porteur du projet fournit | Action à faire |
|---|---|
| Une image (screenshot, photo, export Figma en PNG) collée dans le chat | La regarder comme référence de direction, PAS de gabarit pixel-perfect, coder directement dans le projet en mobile-first |
| Un lien Pinterest (sans image jointe) | Demander l'image directement — un lien externe ne peut pas être "vu" |
| Une description texte seule ("vert émeraude, cartes arrondies...") | Suffisant en soi, déjà le cas dans `PROMPT_REPRISE.md` — pas besoin d'image pour ces éléments déjà écrits noir sur blanc |
