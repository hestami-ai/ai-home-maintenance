from django.core.management.base import BaseCommand
from django.conf import settings
from square.client import Client
import json

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

class Command(BaseCommand):
    help = 'Check Square sandbox environment details'

    def handle(self, *args, **options):
        self.stdout.write('Checking Square sandbox environment...')
        
        try:
            client = Client(
                access_token=settings.SQUARE_ACCESS_TOKEN,
                environment=settings.SQUARE_ENVIRONMENT
            )
            
            # Get merchant details
            result = client.merchants.list_merchants()

            if result.is_success():
                merchants = result.body.get("merchants", [])
                if merchants:
                    for merchant in merchants:
                        self.stdout.write(self.style.SUCCESS('Merchant details:'))
                        self.stdout.write(json.dumps({
                            'id': merchant.get('id'),
                            'business_name': merchant.get('business_name'),
                            'country': merchant.get('country'),
                            'language_code': merchant.get('language_code'),
                            'currency': merchant.get('currency'),
                            'status': merchant.get('status')
                        }, indent=2))
                else:
                    self.stdout.write(self.style.WARNING('No merchant details found'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to get merchant details: {result.errors}'))

            # Get locations
            result = client.locations.list_locations()

            if result.is_success():
                locations = result.body.get("locations", [])
                if locations:
                    self.stdout.write(self.style.SUCCESS('\nLocations:'))
                    for location in locations:
                        self.stdout.write(json.dumps({
                            'id': location.get('id'),
                            'name': location.get('name'),
                            'status': location.get('status'),
                            'currency': location.get('currency')
                        }, indent=2))
                else:
                    self.stdout.write(self.style.WARNING('No locations found'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to get locations: {result.errors}'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error checking sandbox environment: {str(e)}'
            ))
