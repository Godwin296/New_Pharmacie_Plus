# Traductions (fr/en)

Ce dossier accueillera les fichiers `.po`/`.mo` générés par `django-admin makemessages` une
fois que les chaînes de caractères du code (messages d'erreur API, contenu des emails) seront
marquées avec `gettext`/`gettext_lazy`.

**État au 01/08 :** l'infrastructure (middleware, `LANGUAGES`, préférence de langue par
client) est en place -- voir `config/settings.py` et `core/authentication.py`. La traduction
du contenu applicatif lui-même est un chantier séparé, pas encore commencé. Voir
`PROMPT_REPRISE.md` pour le suivi.

## Workflow (une fois les chaînes marquées)

```bash
django-admin makemessages -l en
# ... traduire les fichiers .po générés ...
django-admin compilemessages
```
