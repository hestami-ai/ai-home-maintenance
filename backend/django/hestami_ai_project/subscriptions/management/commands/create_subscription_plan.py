from django.core.management.base import BaseCommand
from django.conf import settings
from square.client import Client
import json
from datetime import datetime
import uuid

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

class Command(BaseCommand):
    help = 'Create a Square subscription plan'

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, required=True, help='Plan name')
        parser.add_argument('--price', type=float, required=True, help='Monthly price in USD')

    def handle(self, *args, **options):
        name = options['name']
        price = options['price']
        price_cents = int(price * 100)  # Convert to cents

        self.stdout.write(f'Creating subscription plan: {name} at ${price}/month')
        
        try:
            client = Client(
                access_token=settings.SQUARE_ACCESS_TOKEN,
                environment=settings.SQUARE_ENVIRONMENT
            )
            
            # Step 1: Create a catalog item for the subscription
            item_id = f"SUBSCRIPTION_ITEM_{str(uuid.uuid4()).replace('-', '_')}"
            variation_id = f"VARIATION_{str(uuid.uuid4()).replace('-', '_')}"
            
            result = client.catalog.upsert_catalog_object(
                body={
                    "idempotency_key": str(uuid.uuid4()),
                    "object": {
                        "type": "ITEM",
                        "id": f"#{item_id}",
                        "item_data": {
                            "name": name,
                            "description": f"Subscription plan: {name}",
                            "variations": [
                                {
                                    "type": "ITEM_VARIATION",
                                    "id": f"#{variation_id}",
                                    "item_variation_data": {
                                        "item_id": f"#{item_id}",
                                        "name": "Monthly",
                                        "pricing_type": "FIXED_PRICING",
                                        "price_money": {
                                            "amount": price_cents,
                                            "currency": "USD"
                                        }
                                    }
                                }
                            ],
                            "subscription_plan_data": {
                                "name": name,
                                "phases": [
                                    {
                                        "cadence": "MONTHLY",
                                        "recurring_price_money": {
                                            "amount": price_cents,
                                            "currency": "USD"
                                        },
                                        "ordinal": 0
                                    }
                                ]
                            }
                        }
                    }
                }
            )

            if not result.is_success():
                self.stdout.write(self.style.ERROR(f'Failed to create catalog item: {result.errors}'))
                return

            created_item = result.body["catalog_object"]
            item_id = created_item["id"]
            variation_id = created_item["item_data"]["variations"][0]["id"]
            
            self.stdout.write(self.style.SUCCESS(f'Created catalog item with ID: {item_id}'))
            self.stdout.write(f'Variation ID: {variation_id}')

            # Get the created subscription plan data
            result = client.catalog.retrieve_catalog_object(
                object_id=item_id,
                include_related_objects=True
            )

            if result.is_success():
                obj = result.body.get("object")
                plan_data = obj.get("item_data", {}).get("subscription_plan_data", {})
                phase = plan_data.get("phases", [])[0] if plan_data.get("phases") else None
                
                if phase:
                    self.stdout.write(self.style.SUCCESS(f'Successfully created subscription plan'))
                    self.stdout.write(json.dumps({
                        'item_id': item_id,
                        'variation_id': variation_id,
                        'name': name,
                        'monthly_price': f'${price}',
                        'phase': phase
                    }, indent=2))
                else:
                    self.stdout.write(self.style.ERROR('No phase data found in the created plan'))
            else:
                self.stdout.write(self.style.ERROR(f'Failed to retrieve created plan: {result.errors}'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error creating subscription plan: {str(e)}'
            ))
