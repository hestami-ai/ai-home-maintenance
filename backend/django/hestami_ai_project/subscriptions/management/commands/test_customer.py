from django.core.management.base import BaseCommand
from django.conf import settings
from subscriptions.services import SquareService
import json

settings.SQUARE_ENVIRONMENT = 'sandbox'
settings.SQUARE_ACCESS_TOKEN = ''

# (venv) E:\Projects\hestami-ai\backend\django\hestami_ai_project>python manage.py test_customer --email="test@example.com" --first-name="John" --last-name="Doe"
# Testing Square customer creation...
# Email: test@example.com
# Name: John Doe
# INFO 2025-02-08 12:59:56,600 services 30056 20968 Initializing Square client with environment: sandbox
# ✅ Customer created successfully
# {
#   "id": "88BYM1JJGTVV724AXG7RVAMNFG",
#   "email": "test@example.com",
#   "given_name": "John",
#   "family_name": "Doe"
# }

class Command(BaseCommand):
    help = 'Test Square customer creation'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='Customer email')
        parser.add_argument('--first-name', type=str, required=True, help='Customer first name')
        parser.add_argument('--last-name', type=str, required=True, help='Customer last name')

    def handle(self, *args, **options):
        email = options['email']
        first_name = options['first_name']
        last_name = options['last_name']

        self.stdout.write('Testing Square customer creation...')
        self.stdout.write(f'Email: {email}')
        self.stdout.write(f'Name: {first_name} {last_name}')

        try:
            # Create a mock user object
            class MockUser:
                def __init__(self, email, first_name, last_name):
                    self.id = 1  # Mock ID
                    self.email = email
                    self.first_name = first_name
                    self.last_name = last_name

            user = MockUser(email, first_name, last_name)
            square_service = SquareService()
            
            # Create customer
            customer = square_service.create_customer(user)

            if customer:
                self.stdout.write(self.style.SUCCESS('✅ Customer created successfully'))
                self.stdout.write(json.dumps({
                    'id': customer.get('id'),
                    'email': customer.get('email_address'),
                    'given_name': customer.get('given_name'),
                    'family_name': customer.get('family_name'),
                }, indent=2))
            else:
                self.stdout.write(self.style.ERROR('❌ Failed to create customer'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'Error creating customer: {str(e)}'
            ))
