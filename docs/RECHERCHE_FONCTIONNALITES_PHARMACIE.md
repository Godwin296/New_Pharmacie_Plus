# Recherche approfondie — fonctionnalités indispensables pour Pharmacie+ (contexte Cameroun/CEMAC)

> Contrairement à un simple audit du code existant, ce document synthétise une recherche
> externe (sources professionnelles pharmacie 2026, réglementation camerounaise réelle,
> pratiques SaaS multi-tenant, UX mobile-first) filtrée pour ne garder QUE ce qui est
> pertinent pour une pharmacie indépendante en zone CEMAC — pas une liste générique
> américaine pleine de fonctionnalités inutiles ici (assurance santé privée, HIPAA, DEA...).

---

## 🔴 1. Trouvaille réglementaire majeure — à traiter en priorité

**Depuis le 1er juillet 2024, la réglementation camerounaise a changé** : une ordonnance
médicale est désormais **obligatoire pour TOUS les médicaments, sans exception** — y
compris ceux auparavant considérés comme en vente libre. La mesure émane d'une
concertation entre l'Ordre National des Médecins du Cameroun (ONMC) et le ministère de la
Santé publique. Pour être valide, une ordonnance doit comporter : <cite index="17-1">l'identification complète du médecin prescripteur (nom, prénom, spécialité et adresse), la date de délivrance, la désignation précise du médicament prescrit (nom, dosage et quantité), et la signature et le cachet du médecin prescripteur.</cite>

**Pourquoi ça te concerne directement :** ton modèle `Produit` a un champ
`ordonnance_obligatoire` **par produit** — ce qui sous-entend que certains produits
peuvent légalement être vendus sans ordonnance dans ton application. Si cette nouvelle
règle est appliquée strictement, ce ne devrait plus être le cas pour aucun produit.

⚠️ Je ne suis pas juriste, et l'application réelle de cette mesure sur le terrain fait
débat (les articles trouvés montrent des pharmaciens sceptiques sur la faisabilité
immédiate, et pas de liste officielle exhaustive des produits concernés au moment de la
rédaction). Ce point ne se résout pas en une case à cocher, il faudrait probablement
consulter un professionnel pour la position exacte de tes pharmacies clientes vis-à-vis de
cette loi. Ce que je peux affirmer avec certitude : **le sujet est réel et documenté**, et
ça rejoint directement l'item déjà dans ta roadmap
(*"Toggle vérification ordonnance par tenant — champ booléen sur `PharmacieConfig`"*) —
un simple toggle global par pharmacie serait plus proche de l'esprit de cette loi qu'un
champ produit par produit qui suppose que certains médicaments en sont exemptés.

**Conséquence UX pour la refonte** : le flux d'upload d'ordonnance (`/ordonnance/upload`)
gagnerait à afficher explicitement les 4 champs obligatoires listés ci-dessus, comme aide
visuelle pour le client au moment de la photo (rappelle-toi : OCR = aide visuelle
uniquement, jamais de validation automatisée, décision déjà actée dans le projet) — ça
réduit le taux de rejet par la caisse pour ordonnance incomplète.

---

## 2. Spécificités confirmées pour le marché ouest-africain

Recherche croisée sur plusieurs éditeurs de logiciels pharmacie actifs en Afrique de
l'Ouest (Nigeria, Ghana) : <cite index="13-1">les solutions leaders sont conçues spécifiquement pour le fonctionnement hors-ligne, avec synchronisation dès que la connectivité est disponible, et une intégration mobile money native pour tous les principaux opérateurs, fonctionnant même avec une connectivité limitée.</cite>

Ce que tu as déjà construit va exactement dans ce sens : mode offline (3/4 briques faites),
Orange Money + MTN MoMo natifs. **Confirmation que ce ne sont pas des options "nice to
have" mais bien le standard attendu dans ce contexte** — à ne pas sacrifier pendant la
refonte visuelle (ex: ne pas ajouter d'animations/assets lourds qui dégraderaient les
performances sur connexion faible).

Un exemple concret cité dans les témoignages d'un éditeur nigérian : une pharmacie ayant
adopté un suivi de péremption/lot rigoureux a réduit ses pertes sur stock périmé de 75%
en 4 mois — ça confirme la priorité déjà donnée dans ta roadmap au chantier
"Gestion des lots (`LotProduit`) + FEFO", même si classé "effort élevé".

---

## 3. Réponse complète : fonctionnalités indispensables par rôle (filtré pour ton contexte)

### Client — déjà traité en détail dans `UIUX_REFONTE_GUIDE.md` §2
Rien de nouveau à ajouter par rapport à la recherche : profil, historique, statut
d'ordonnance. Pas de gestion d'assurance (non pertinent au Cameroun dans ce contexte
grand public).

### Caisse (POS) — déjà traité en détail dans `UIUX_REFONTE_GUIDE.md` §3
La recherche confirme les manques déjà identifiés (retours, clôture de caisse) comme des
standards du secteur, pas des "extras" — mais confirme aussi que les fonctionnalités
propres au marché américain (copays, FSA/HSA, intégration assurance NCPDP) n'ont **aucune
pertinence** pour ton contexte et ne doivent pas être ajoutées à ta roadmap.

### Admin (par pharmacie) — déjà traité en détail dans `UIUX_REFONTE_GUIDE.md` §4
Confirmé par la recherche : suivi de péremption par lot (FEFO), alertes de rupture,
rapports de vente — déjà couverts ou en roadmap. Rien à ajouter que tu n'aies déjà.

### Admin plateforme "Pharmacie Plus" — approfondissement par rapport au guide précédent

La recherche sur les panneaux d'administration SaaS multi-tenant confirme et enrichit ce
qui avait déjà été proposé. Éléments à retenir, adaptés à ton échelle (pas besoin de tout
prendre — voir la mise en garde ci-dessous) :

- **Répertoire des tenants avec vue unifiée** : <cite index="31-1">un panneau d'administration bien conçu améliore l'efficacité opérationnelle, réduit la charge de support, et donne à l'équipe interne la visibilité nécessaire pour faire grandir le produit</cite> — confirme la page `/plateforme/tenants` déjà proposée.
- **Contrôle d'accès par rôle (RBAC) même côté staff plateforme** : anticiper que "toi" aujourd'hui deviendra peut-être "toi + un support client + un commercial" demain — prévoir dès la conception que le compte staff plateforme puisse avoir des niveaux de droits différents (lecture seule vs suspension de compte), même si un seul rôle existe au début.
- **Isolation et permissions par tenant dans le code, pas juste dans l'UI** : <cite index="30-1">l'observabilité doit être consciente de chaque tenant, et la facturation doit suivre l'usage réel</cite> — cohérent avec ton choix déjà fait d'isolation par schéma PostgreSQL (plus robuste qu'une simple colonne `tenant_id`, la recherche le confirme d'ailleurs : <cite index="25-1">le schéma-par-tenant est l'un des trois patterns reconnus, l'autre risque étant une clause de filtre manquante qui exposerait les données d'un tenant à un autre</cite> — exactement le risque que ton architecture actuelle élimine structurellement).

**⚠️ Mise en garde sur cette recherche** : la plupart des résultats trouvés concernent des
SaaS B2B avec des centaines/milliers de tenants et des équipes de plusieurs personnes
(facturation Stripe automatisée, SSO d'entreprise, audit logs poussés). **À ton échelle
actuelle (une poignée de pharmacies clientes, toi comme unique opérateur), une bonne
partie de ça serait de la sur-ingénierie.** Les 6 pages déjà proposées dans
`UIUX_REFONTE_GUIDE.md` §5 restent le bon point de départ concret — cette section sert
juste à confirmer qu'elles sont bien alignées avec ce qui se fait ailleurs, pas à ajouter
de la complexité que tu n'as pas encore besoin de porter.

---

## 4. Méthodologie mobile-first — correction importante sur le guide précédent

Tu as raison de relever que le guide précédent avait un ton orienté desktop. Voici ce que
la recherche confirme sur ce que "mobile-first" veut dire concrètement, à appliquer
strictement pendant la refonte :

<cite index="35-1">Le mobile-first est une stratégie d'amélioration progressive : on commence par concevoir l'expérience pour l'écran le plus petit et le plus contraint — typiquement un smartphone entre 320 et 375px de large — puis on ajoute de la complexité, du contenu et des raffinements visuels à mesure que la fenêtre s'agrandit. C'est l'inverse de l'approche desktop-first, où l'on crée d'abord une mise en page complète pour desktop puis on retire des éléments pour le mobile.</cite> Le problème du desktop-first, c'est qu'il traite le mobile comme une version dégradée de la "vraie" expérience — l'objectif du mobile-first est l'inverse : le petit écran EST l'expérience principale, le desktop est l'amélioration.

**Ce que ça veut dire concrètement dans ton codebase Tailwind CSS** (already en place,
`rounded-2xl`/`3xl` etc.) : chaque classe Tailwind **sans préfixe** (`flex`, `p-4`,
`text-sm`...) doit décrire l'affichage MOBILE par défaut. Les préfixes `md:`/`lg:`
doivent uniquement **ajouter** des ajustements pour les écrans plus grands (ex:
`flex-col md:flex-row`, `p-4 lg:p-8`) — jamais l'inverse (jamais partir d'un layout
desktop en `flex-row` puis le casser en `flex-col` seulement en `sm:`). C'est exactement
le sens de ta remarque : le rendu téléphone doit être root la stylé/soigné, le rendu PC
n'est qu'un élargissement de cette base, pas une conception séparée qu'on réduit ensuite.

**Autre point concret confirmé par la recherche**, spécifique au tactile : <cite index="33-1">les actions clés (boutons de navigation, appels à l'action) doivent être positionnées dans la zone accessible au pouce — la moitié inférieure de l'écran — pour réduire la fatigue de l'utilisateur.</cite> Ça confirme le choix déjà noté dans `PROMPT_REPRISE.md` ("bottom nav mobile avec bouton central flottant") — à garder comme principe directeur pour toute nouvelle page, pas seulement la nav principale (ex: le bouton "Valider le panier" doit rester bas et accessible au pouce, pas remonté en haut de page comme le ferait un layout desktop classique).

---

## 5. Ce qui reste à trancher (complète la liste du guide précédent)

En plus des 4 points déjà posés dans `UIUX_REFONTE_GUIDE.md` §6 :

5. **Ordonnance obligatoire pour tous les produits (point réglementaire §1)** : passer
   `ordonnance_obligatoire` d'un champ par produit à une politique par pharmacie (toggle
   déjà en roadmap), ou garder la nuance par produit en assumant le risque réglementaire ?
   Décision métier/légale qui n'est pas la mienne à trancher.
6. **Admin plateforme — RBAC dès le départ ou plus tard ?** La recherche suggère de
   prévoir la structure (même avec un seul rôle "toi" au début) plutôt que de la rajouter
   après coup une fois que tu auras une équipe — confirmes-tu qu'on structure le code en
   ce sens dès la phase 2 (admin plateforme), même si un seul compte existera au lancement ?
