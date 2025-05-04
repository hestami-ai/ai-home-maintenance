from django.apps import AppConfig


class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'services'
    
    def ready(self):
        """
        App initialization code when Django starts.
        """
        # No signal imports needed as we're using a background processor instead
        pass
