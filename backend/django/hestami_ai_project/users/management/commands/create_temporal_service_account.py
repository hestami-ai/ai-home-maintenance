import uuid
from django.core.management.base import BaseCommand
from django.conf import settings
from users.models import User


# $ python manage.py create_temporal_service_account
# Successfully created Temporal service account
# ID: 1a095056-2d05-40b9-ab3d-44a42a6b6383
# Email: temporal@service.hestami-ai.com
# Token: REDACTED_TOKEN

# Add this token to your .env file as:
# TEMPORAL_SERVICE_ACCOUNT_TOKEN=REDACTED_TOKEN

class Command(BaseCommand):
    help = 'Creates a service account for Temporal workflow integration'

    def handle(self, *args, **kwargs):
        try:
            service_name = 'temporal'
            service_email = f"{service_name}@service.hestami-ai.com"
            
            # Check if service account already exists
            service_account = User.objects.filter(email=service_email).first()
            
            if service_account:
                self.stdout.write(
                    self.style.WARNING(
                        f'Service account already exists with ID: {service_account.id}\n'
                        f'Token: {service_account.service_token}'
                    )
                )
                return
            
            # Generate service token
            service_token = uuid.uuid4().hex
            
            # Create service account
            service_account = User.objects.create_service_account(
                service_name=service_name,
                service_token=service_token
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created Temporal service account\n'
                    f'ID: {service_account.id}\n'
                    f'Email: {service_account.email}\n'
                    f'Token: {service_token}\n\n'
                    f'Add this token to your .env file as:\n'
                    f'TEMPORAL_SERVICE_ACCOUNT_TOKEN={service_token}'
                )
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to create service account: {str(e)}')
            )
