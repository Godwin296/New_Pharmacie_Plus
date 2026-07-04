import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_tenants.utils import schema_context
from django.contrib.auth.models import User

for schema in ["dupont", "martin"]:
    with schema_context(schema):
        User.objects.filter(username__startswith="admin_").update(is_staff=True, is_superuser=True)
        User.objects.filter(username__startswith="caisse_").update(is_staff=True, is_superuser=False)
        print(schema, "mis à jour")