-- 🔧 Activé automatiquement à la création du conteneur PostgreSQL (docker-entrypoint-initdb.d
-- exécute tout script .sql présent ici, une seule fois, au tout premier démarrage sur un
-- volume vide). Nécessaire pour les index GIN trigram utilisés par les migrations
-- core.0006 et clients_publics.0002 (recherche __icontains rapide sur les noms de
-- produits/clients) -- sans cette extension, `migrate_schemas` échoue avec :
--   django.db.utils.ProgrammingError: operator class "gin_trgm_ops" does not exist for
--   access method "gin"
-- Vécu concrètement plusieurs fois en testant ce projet sans Docker (PROMPT_REPRISE.md,
-- section migrations core.0006).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
