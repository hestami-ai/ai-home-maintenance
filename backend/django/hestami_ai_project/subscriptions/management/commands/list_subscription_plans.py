from django.core.management.base import BaseCommand
from django.conf import settings
from square.client import Client
import json

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

class Command(BaseCommand):
    help = 'List available Square subscription plans'

    def handle(self, *args, **options):
        self.stdout.write('Fetching Square subscription plans...')
        
        try:
            client = Client(
                access_token=settings.SQUARE_ACCESS_TOKEN,
                environment=settings.SQUARE_ENVIRONMENT
            )
            
            # Search all catalog objects
            result = client.catalog.search_catalog_objects(
                body={
                    "object_types": [
                        "SUBSCRIPTION_PLAN",
                        "ITEM",
                        "ITEM_VARIATION",
                        "CATEGORY"
                    ],
                    "include_related_objects": True
                }
            )

            if result.is_success():
                objects = result.body.get("objects", [])
                related_objects = result.body.get("related_objects", [])
                
                if objects:
                    self.stdout.write(self.style.SUCCESS(f'Found {len(objects)} catalog objects:'))
                    for obj in objects:
                        obj_type = obj.get('type')
                        obj_id = obj.get('id')
                        
                        if obj_type == 'SUBSCRIPTION_PLAN':
                            plan_data = obj.get('subscription_plan_data', {})
                            self.stdout.write(json.dumps({
                                'type': 'SUBSCRIPTION_PLAN',
                                'id': obj_id,
                                'name': plan_data.get('name'),
                                'phases': plan_data.get('phases', [])
                            }, indent=2))
                        elif obj_type == 'ITEM':
                            item_data = obj.get('item_data', {})
                            self.stdout.write(json.dumps({
                                'type': 'ITEM',
                                'id': obj_id,
                                'name': item_data.get('name'),
                                'variations': item_data.get('variations', [])
                            }, indent=2))
                        elif obj_type == 'ITEM_VARIATION':
                            var_data = obj.get('item_variation_data', {})
                            self.stdout.write(json.dumps({
                                'type': 'ITEM_VARIATION',
                                'id': obj_id,
                                'name': var_data.get('name'),
                                'pricing_type': var_data.get('pricing_type'),
                                'price_money': var_data.get('price_money')
                            }, indent=2))
                    
                    if related_objects:
                        self.stdout.write(self.style.SUCCESS(f'\nFound {len(related_objects)} related objects:'))
                        for obj in related_objects:
                            self.stdout.write(json.dumps({
                                'type': obj.get('type'),
                                'id': obj.get('id'),
                                'data': obj
                            }, indent=2))
                else:
                    self.stdout.write(self.style.WARNING('No catalog objects found'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to fetch catalog objects: {result.errors}'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error fetching catalog objects: {str(e)}'
            ))
