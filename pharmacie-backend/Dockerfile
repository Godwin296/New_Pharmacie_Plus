# syntax=docker/dockerfile:1
FROM python:3.12-slim

# 📦 DÉPENDANCES SYSTÈME
#
# - libmagic1 : requis par `python-magic` (détection du type réel des fichiers uploadés
#   par leur contenu binaire, voir core/validators.py) -- sans ce paquet SYSTÈME (le
#   paquet Python seul ne suffit pas), l'appli démarre normalement mais plante au premier
#   upload d'ordonnance/photo produit avec une erreur peu explicite.
#
# - Le reste (pango/harfbuzz/openjp2/jpeg/ffi) : requis par WeasyPrint pour le rendu
#   HTML -> PDF (facture, rapports admin). ⚠️ Liste À JOUR pour WeasyPrint >= 53, qui a
#   abandonné sa dépendance à Cairo/GdkPixbuf (voir requirements.txt : weasyprint==68.1) --
#   la plupart des tutoriels/réponses trouvées en ligne listent encore libcairo2 et
#   libgdk-pixbuf2.0-0, qui NE SONT PLUS NÉCESSAIRES pour cette version et alourdiraient
#   l'image pour rien. Référence : https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
RUN apt-get update && apt-get install -y --no-install-recommends \
        libmagic1 \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz-subset0 \
        libjpeg62-turbo \
        libopenjp2-7 \
        libffi8 \
        shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Couche dépendances Python séparée du code applicatif : le cache Docker ne réinstalle
# tout que si requirements.txt change, pas à chaque modification de code -- accélère
# nettement les rebuilds pendant le développement.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 🔧 VOLONTAIREMENT PAS FAIT ICI (au build de l'image), à faire au lancement du conteneur :
#
# - `collectstatic` : nécessite SECRET_KEY et les autres variables de config, qui ne sont
#   disponibles qu'au démarrage du conteneur (.env injecté), jamais pendant le build.
#     docker compose exec backend python manage.py collectstatic --noinput
#
# - `migrate_schemas` : risque réel en prod multi-instance si exécuté automatiquement au
#   démarrage -- plusieurs conteneurs backend qui redémarrent en même temps (déploiement,
#   crash-restart) lanceraient la migration en parallèle. À lancer manuellement, une seule
#   fois par déploiement :
#     docker compose exec backend python manage.py migrate_schemas

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
