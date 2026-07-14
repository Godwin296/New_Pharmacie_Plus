from django.db import migrations


class Migration(migrations.Migration):
    """
    🚀 SESSION OFFLINE (12/07) -- Active l'extension PostgreSQL "pg_trgm", nécessaire aux
    index GIN trigram utilisés par core/models.py (recherche __icontains rapide sur
    catalogue/clients/commandes -- voir core/migrations/0006).

    ⚠️ POURQUOI ICI ET PAS DANS 'core' (là où les index sont réellement définis) :
    'tenants' est une SHARED_APP -> cette migration ne s'exécute QU'UNE SEULE FOIS, contre
    le schéma "public". 'core' est une TENANT_APP -> si on y avait mis TrigramExtension(),
    l'extension aurait été créée dans le schéma du PREMIER tenant migré (ex: "dupont") plutôt
    que dans "public" (une extension PostgreSQL ne peut être installée qu'UNE FOIS par base,
    peu importe le schéma) -- résultat concret observé en test : le 2e tenant ("martin")
    échouait avec "operator class gin_trgm_ops does not exist" car ses index cherchaient
    l'opclass dans un schéma ("dupont") absent de son search_path.

    En l'installant explicitement dans "public" (qui fait partie du search_path de CHAQUE
    tenant), l'extension devient utilisable par tous les schémas, présents et futurs, sans
    action supplémentaire à la création d'une nouvelle pharmacie cliente.
    """

    dependencies = [
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;",
            reverse_sql="DROP EXTENSION IF EXISTS pg_trgm;",
        ),
    ]
