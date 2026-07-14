from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # 🚀 MODE OFFLINE (session 12/07) : enregistre le signal post_delete qui alimente
        # ProduitSupprimeLog (voir core/signals.py) -- import différé ICI (pas en haut du
        # fichier) car c'est le pattern Django standard pour éviter les imports circulaires
        # au chargement de l'app (models.py n'est pas encore garanti prêt plus tôt).
        import core.signals  # noqa: F401
