from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
from ...services import SquareService
from ...models import SquareCustomer, SquareSubscription
import logging
import time

logger = logging.getLogger(__name__)
User = get_user_model()

class Command(BaseCommand):
    help = 'Test the complete subscription flow'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='User email')
        parser.add_argument('--plan-id', type=str, required=True, help='Square plan variation ID')
        parser.add_argument('--card-nonce', type=str, required=True, help='Card nonce from Square')

    def handle(self, *args, **options):
        email = options['email']
        plan_id = options['plan_id']
        card_nonce = options['card_nonce']

        try:
            # Get or create test user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'first_name': 'Test',
                    'last_name': 'User'
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created test user: {email}'))
            else:
                self.stdout.write(f'Using existing user: {email}')

            square_service = SquareService()

            # Step 1: Create Square customer
            self.stdout.write('Creating Square customer...')
            customer = square_service.create_customer(user)
            self.stdout.write(self.style.SUCCESS(f'Created Square customer: {customer.square_id}'))

            # Step 2: Create card
            self.stdout.write('Creating card...')
            card = square_service.create_card(customer, card_nonce)
            self.stdout.write(self.style.SUCCESS(f'Created card: {card["id"]}'))

            # Step 3: Create subscription
            self.stdout.write('Creating subscription...')
            subscription = square_service.create_subscription(
                customer=customer,
                plan_variation_id=plan_id,
                card_id=card['id']
            )
            self.stdout.write(self.style.SUCCESS(
                f'Created subscription: {subscription.square_id} (Status: {subscription.status})'
            ))

            # Step 4: Check subscription status
            self.stdout.write('Waiting 5 seconds before checking status...')
            time.sleep(5)
            
            subscription_data = square_service.get_subscription(subscription.square_id)
            self.stdout.write(self.style.SUCCESS(
                f'Subscription status: {subscription_data["status"]}'
            ))

            # Step 5: Cancel subscription
            self.stdout.write('Canceling subscription...')
            canceled_subscription = square_service.cancel_subscription(subscription)
            self.stdout.write(self.style.SUCCESS(
                f'Canceled subscription: {canceled_subscription.status}'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error in subscription flow: {str(e)}'))
