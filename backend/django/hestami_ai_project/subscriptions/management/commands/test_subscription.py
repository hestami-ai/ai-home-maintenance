from django.core.management.base import BaseCommand
from django.conf import settings
from subscriptions.services import SquareService
import json
from datetime import datetime

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

# python manage.py test_subscription --customer-id="88BYM1JJGTVV724AXG7RVAMNFG" --plan-id="2AEV2P2PE3E3SFD5TUHSY74B"


# The Plan ID is part of the URL when viewing it in the dashboard:
# https://app.squareupsandbox.com/dashboard/plans/2AEV2P2PE3E3SFD5TUHSY74B
#
# or try the curl command below - which did not work for me as is
#
# curl https://connect.squareupsandbox.com/v2/catalog/list \
#  -H 'Square-Version: 2025-01-23' \
#  -H 'Authorization: Bearer YOUR_SANDBOX_ACCESS_TOKEN' \
#  -H 'Content-Type: application/json' \
#   -d '{
#     "types": "SUBSCRIPTION_PLAN"
#   }'




class Command(BaseCommand):
    help = 'Test Square subscription creation'

    def add_arguments(self, parser):
        parser.add_argument('--customer-id', type=str, help='Square customer ID')
        parser.add_argument('--plan-id', type=str, help='Square catalog plan ID')
        parser.add_argument('--card-id', type=str, help='Square card ID', required=False)

    def handle(self, *args, **options):
        customer_id = options['customer_id']
        plan_id = options['plan_id']
        card_id = options.get('card_id')

        self.stdout.write('Testing Square subscription creation...')
        self.stdout.write(f'Customer ID: {customer_id}')
        self.stdout.write(f'Plan ID: {plan_id}')
        if card_id:
            self.stdout.write(f'Card ID: {card_id}')

        try:
            square_service = SquareService()
            
            # Create subscription
            subscription = square_service.create_subscription(
                customer_id=customer_id,
                plan_id=plan_id,
                card_id=card_id,
                start_date=datetime.now()
            )

            if subscription:
                self.stdout.write(self.style.SUCCESS('✅ Subscription created successfully'))
                self.stdout.write(json.dumps({
                    'id': subscription.get('id'),
                    'status': subscription.get('status'),
                    'start_date': subscription.get('start_date'),
                    'plan_id': subscription.get('plan_id'),
                    'customer_id': subscription.get('customer_id'),
                }, indent=2))
            else:
                self.stdout.write(self.style.ERROR('❌ Failed to create subscription'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error creating subscription: {str(e)}'
            ))
