from django.core.management.base import BaseCommand
from django.conf import settings
from subscriptions.services import SquareService
import json

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

class Command(BaseCommand):
    help = 'Test Square API connection and list available locations'

    def handle(self, *args, **options):
        self.stdout.write('Testing Square API connection...')
        self.stdout.write(f'Environment: {settings.SQUARE_ENVIRONMENT}')
        self.stdout.write(f'Access Token: {settings.SQUARE_ACCESS_TOKEN[:4]}...' if settings.SQUARE_ACCESS_TOKEN else 'No access token found')
        
        try:
            square_service = SquareService()
            
            # Test basic connection
            try:
                is_healthy = square_service.health_check()
                if not is_healthy:
                    self.stdout.write(self.style.ERROR('❌ Square API connection failed'))
                    return
                
                self.stdout.write(self.style.SUCCESS('✅ Square API connection successful'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Square API connection failed with error: {str(e)}'))
                return
            
            # Get locations
            self.stdout.write('\nFetching Square locations...')
            result = square_service.client.locations.list_locations()
            
            if result.is_success():
                locations = result.body.get('locations', [])
                self.stdout.write(self.style.SUCCESS(
                    f'Found {len(locations)} location(s):'
                ))
                for location in locations:
                    self.stdout.write(json.dumps({
                        'id': location.get('id'),
                        'name': location.get('name'),
                        'status': location.get('status'),
                        'currency': location.get('currency'),
                    }, indent=2))
            else:
                self.stdout.write(self.style.WARNING(
                    f'Failed to fetch locations. Errors:\n{json.dumps(result.errors, indent=2)}'
                ))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error connecting to Square API: {str(e)}'
            ))
