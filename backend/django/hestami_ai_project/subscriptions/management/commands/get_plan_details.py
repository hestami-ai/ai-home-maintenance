from django.core.management.base import BaseCommand
from django.conf import settings
from square.client import Client
import json

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

class Command(BaseCommand):
    help = 'Get details of a specific Square subscription plan'

    def add_arguments(self, parser):
        parser.add_argument('plan_id', type=str, help='Square plan ID')

    def handle(self, *args, **options):
        plan_id = options['plan_id']
        self.stdout.write(f'Fetching details for plan {plan_id}...')
        
        try:
            client = Client(
                access_token=settings.SQUARE_ACCESS_TOKEN,
                environment=settings.SQUARE_ENVIRONMENT
            )
            
            # Try to retrieve the catalog object
            result = client.catalog.retrieve_catalog_object(
                object_id=plan_id,
                include_related_objects=True
            )

            if result.is_success():
                obj = result.body.get("object")
                related = result.body.get("related_objects", [])
                
                if obj:
                    self.stdout.write(self.style.SUCCESS('Found plan:'))
                    self.stdout.write(json.dumps({
                        'id': obj.get('id'),
                        'type': obj.get('type'),
                        'data': obj,
                        'related_objects': related
                    }, indent=2))
                else:
                    self.stdout.write(self.style.WARNING('Plan not found'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to fetch plan: {result.errors}'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error fetching plan details: {str(e)}'
            ))
