from django.apps import AppConfig


class MarketplaceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marketplace'
    verbose_name = "Marketplace (découverte multi-pharmacies)"

    def ready(self):
        import marketplace.signals  # noqa: F401 -- enregistre le récepteur post_save
