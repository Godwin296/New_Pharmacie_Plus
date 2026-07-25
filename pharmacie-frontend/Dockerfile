# syntax=docker/dockerfile:1

# Next.js 16 exige Node.js >= 20.9 -- 22 (LTS) choisi ici par marge de sécurité.
FROM node:22-slim

WORKDIR /app

# Couche dépendances séparée du code applicatif, même principe que le Dockerfile backend :
# le cache Docker ne réinstalle tout que si package.json/package-lock.json changent.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# ⚠️ PIÈGE NEXT.JS CLASSIQUE : les variables NEXT_PUBLIC_* sont figées EN DUR dans le
# bundle JavaScript au moment du `next build`, PAS lues dynamiquement à l'exécution du
# conteneur. Les passer comme ARG de build (pas juste comme env_file dans
# docker-compose.yml, qui n'agirait qu'au runtime, trop tard) est donc nécessaire SI on
# veut les figer à une valeur particulière.
#
# Ceci dit, CE PROJET n'en a normalement pas besoin en usage standard (voir
# lib/apiClient.ts::resolveApiUrl()) : en l'absence de NEXT_PUBLIC_API_URL, l'URL du
# backend est déduite DYNAMIQUEMENT à l'exécution depuis window.location -- pratique
# justement pensée pour le multi-tenant par sous-domaine (dupont.localhost,
# martin.localhost...) partageant un seul backend. Les ARG ci-dessous restent
# disponibles pour les cas où une URL backend FIXE est nécessaire (prod avec domaines
# distincts, tunnel...), sans forcer leur usage par défaut.
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_API_PORT=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_API_PORT=${NEXT_PUBLIC_API_PORT}

# 🔧 PAS de `output: "standalone"` dans next.config.ts (volontairement non modifié ici --
# fichier partagé, plusieurs chantiers en cours sur ce dépôt en parallèle, cf.
# PROMPT_REPRISE.md). L'image embarque donc node_modules complet au lieu d'un bundle
# minimal filtré -- plus lourde, mais zéro risque de casser un réglage utilisé ailleurs.
# À revisiter avec `output: "standalone"` + une variante multi-stage si la taille de
# l'image devient un vrai problème mesuré.
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
