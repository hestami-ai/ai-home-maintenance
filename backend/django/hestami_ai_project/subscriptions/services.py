# subscriptions/services.py

from django.conf import settings
from square.client import Client
from datetime import datetime
import logging
from .models import SquareCustomer, SquareSubscription
from django.utils import timezone
import hmac
import hashlib
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

class SquareService:
    """Service for interacting with Square API"""
    
    def __init__(self):
        environment = settings.SQUARE_ENVIRONMENT
        access_token = settings.SQUARE_ACCESS_TOKEN
        
        logger.info(f"Initializing Square client with environment: {environment}")
        self.client = Client(
            access_token=access_token,
            environment=environment
        )
        self.location_id = settings.SQUARE_LOCATION_ID
        logger.info(f"Using Square location ID: {self.location_id}")

    def _generate_idempotency_key(self, prefix: str, unique_id: str) -> str:
        """Generate an idempotency key with timestamp for uniqueness"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"{prefix}_{unique_id}_{timestamp}"

    def create_customer(self, user):
        """Create a customer in Square"""
        try:
            # Create customer in Square
            result = self.client.customers.create_customer(
                body={
                    "idempotency_key": str(uuid.uuid4()),
                    "email_address": user.email,
                    "given_name": user.first_name,
                    "family_name": user.last_name,
                    "reference_id": str(user.id)  # Store Django user ID as reference
                }
            )
            
            if result.is_success():
                customer_data = result.body["customer"]
                # Create or update local customer record
                customer, created = SquareCustomer.objects.update_or_create(
                    user=user,
                    defaults={
                        'square_id': customer_data["id"]
                    }
                )
                return customer
            else:
                raise ValueError(f"Square API error: {result.errors}")
                
        except Exception as e:
            logger.error(f"Failed to create customer: {str(e)}")
            raise

    def delete_customer(self, customer_id: str) -> bool:
        """Delete a customer in Square (used for compensation)"""
        try:
            result = self.client.customers.delete_customer(
                customer_id=customer_id
            )

            if result.is_success():
                return True
            else:
                logger.error(f"Failed to delete Square customer: {result.errors}")
                raise Exception(f"Failed to delete Square customer: {result.errors}")

        except Exception as e:
            logger.error(f"Error deleting Square customer: {str(e)}")
            raise

    def update_customer(self, customer_id: str, updates: Dict) -> Dict:
        """Update customer details in Square"""
        try:
            result = self.client.customers.update_customer(
                customer_id=customer_id,
                body=updates
            )

            if result.is_success():
                return result.body["customer"]
            else:
                logger.error(f"Failed to update Square customer: {result.errors}")
                raise Exception(f"Failed to update Square customer: {result.errors}")

        except Exception as e:
            logger.error(f"Error updating Square customer: {str(e)}")
            raise

    def create_card(self, customer: SquareCustomer, nonce: str) -> Dict:
        """Create a payment card for the customer using a card nonce"""
        try:
            result = self.client.cards.create_card(
                body={
                    "idempotency_key": self._generate_idempotency_key("card", customer.square_id),
                    "source_id": nonce,
                    "card": {
                        "customer_id": customer.square_id,
                        "billing_address": {
                            "country": "US"  # Default to US, update as needed
                        }
                    }
                }
            )

            if result.is_success():
                return result.body["card"]
            else:
                logger.error(f"Failed to create card: {result.errors}")
                raise Exception(f"Failed to create card: {result.errors}")

        except Exception as e:
            logger.error(f"Error creating card: {str(e)}")
            raise

    def list_payment_methods(self, customer_id: str) -> List[Dict]:
        """List all payment methods for a customer"""
        try:
            result = self.client.cards.list_cards(
                customer_id=customer_id
            )

            if result.is_success():
                return result.body.get("cards", [])
            else:
                logger.error(f"Failed to list payment methods: {result.errors}")
                raise Exception(f"Failed to list payment methods: {result.errors}")

        except Exception as e:
            logger.error(f"Error listing payment methods: {str(e)}")
            raise

    def delete_payment_method(self, card_id: str) -> bool:
        """Delete a payment method"""
        try:
            result = self.client.cards.disable_card(
                card_id=card_id
            )

            if result.is_success():
                return True
            else:
                logger.error(f"Failed to delete payment method: {result.errors}")
                raise Exception(f"Failed to delete payment method: {result.errors}")

        except Exception as e:
            logger.error(f"Error deleting payment method: {str(e)}")
            raise

    def create_subscription(self, customer, plan_variation_id, card_nonce=None, is_service_flow=False):
        """Create a subscription in Square"""
        try:
            logger.info(f"Creating subscription for customer {customer.square_id}")
            logger.info(f"Plan variation ID: {plan_variation_id}")
            logger.info(f"Is service flow: {is_service_flow}")
            
            subscription_body = {
                "idempotency_key": str(uuid.uuid4()),
                "location_id": self.location_id,
                "plan_variation_id": plan_variation_id,
                "customer_id": customer.square_id,
                "start_date": datetime.now().strftime("%Y-%m-%d"),
                "timezone": "UTC"
            }
            
            logger.info(f"Initial subscription body: {subscription_body}")

            # Only require card for non-service flows
            if not is_service_flow:
                logger.info("Non-service flow - checking for card")
                # If no card_nonce, try to get existing card on file
                if not card_nonce:
                    logger.info("No card nonce provided, checking for existing cards")
                    # Get customer's cards
                    cards = self.list_payment_methods(customer.square_id)
                    if not cards:
                        raise ValueError("No card on file and no card_nonce provided")
                    card_id = cards[0].id  # Use first card
                    logger.info(f"Using existing card: {card_id}")
                else:
                    logger.info("Creating new card with provided nonce")
                    # Create card with nonce
                    card = self.create_card(customer, card_nonce)
                    card_id = card.id
                    logger.info(f"Created new card: {card_id}")
                
                subscription_body["card_id"] = card_id
            else:
                logger.info("Service flow - skipping card requirement")
            
            logger.info(f"Final subscription body: {subscription_body}")
            
            # Create subscription
            result = self.client.subscriptions.create_subscription(
                body=subscription_body
            )
            
            if result.is_success():
                subscription = result.body["subscription"]
                logger.info(f"Successfully created Square subscription: {subscription['id']}")
                
                # Save subscription to database
                sub = SquareSubscription.objects.create(
                    square_id=subscription["id"],
                    customer=customer,
                    plan_variation_id=plan_variation_id,
                    status=subscription["status"],
                    start_date=subscription["start_date"],
                    charged_through_date=subscription.get("charged_through_date")
                )
                logger.info(f"Created local subscription record: {sub.id}")
                return sub
            else:
                logger.error(f"Square API error: {result.errors}")
                raise ValueError(f"Square API error: {result.errors}")
                
        except Exception as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            raise

    def cancel_subscription(self, subscription: SquareSubscription) -> SquareSubscription:
        """Cancel a subscription"""
        try:
            result = self.client.subscriptions.cancel_subscription(
                subscription_id=subscription.square_id
            )

            if result.is_success():
                # Update local subscription record
                subscription.cancel()
                return subscription
            else:
                logger.error(f"Failed to cancel subscription: {result.errors}")
                raise Exception(f"Failed to cancel subscription: {result.errors}")

        except Exception as e:
            logger.error(f"Error canceling subscription: {str(e)}")
            raise

    def get_subscription(self, subscription_id: str) -> Dict:
        """Get subscription details from Square"""
        try:
            result = self.client.subscriptions.retrieve_subscription(
                subscription_id=subscription_id
            )

            if result.is_success():
                return result.body["subscription"]
            else:
                logger.error(f"Failed to get subscription: {result.errors}")
                raise Exception(f"Failed to get subscription: {result.errors}")

        except Exception as e:
            logger.error(f"Error getting subscription: {str(e)}")
            raise

    def upgrade_subscription(self, subscription_id: str, new_plan_id: str) -> Dict:
        """Upgrade a subscription to a new plan immediately"""
        try:
            result = self.client.subscriptions.update_subscription(
                subscription_id=subscription_id,
                body={
                    "subscription": {
                        "plan_variation_id": new_plan_id
                    }
                }
            )

            if result.is_success():
                return result.body["subscription"]
            else:
                logger.error(f"Failed to upgrade subscription: {result.errors}")
                raise Exception(f"Failed to upgrade subscription: {result.errors}")

        except Exception as e:
            logger.error(f"Error upgrading subscription: {str(e)}")
            raise

    def schedule_plan_change(self, subscription_id: str, new_plan_id: str, 
                           change_date: Optional[datetime] = None) -> Dict:
        """Schedule a plan change for the next billing cycle or specific date"""
        try:
            body = {
                "subscription": {
                    "plan_variation_id": new_plan_id
                }
            }

            if change_date:
                body["subscription"]["start_date"] = change_date.strftime("%Y-%m-%d")

            result = self.client.subscriptions.update_subscription(
                subscription_id=subscription_id,
                body=body
            )

            if result.is_success():
                return result.body["subscription"]
            else:
                logger.error(f"Failed to schedule plan change: {result.errors}")
                raise Exception(f"Failed to schedule plan change: {result.errors}")

        except Exception as e:
            logger.error(f"Error scheduling plan change: {str(e)}")
            raise

    def verify_webhook_signature(self, signature: str, payload: str) -> bool:
        """Verify Square webhook signature"""
        try:
            if not settings.SQUARE_WEBHOOK_SIGNATURE_KEY:
                logger.error("Square webhook signature key not configured")
                return False

            # Get the signature from the header
            if not signature:
                return False

            # Calculate expected signature
            expected_signature = hmac.new(
                settings.SQUARE_WEBHOOK_SIGNATURE_KEY.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            # Compare signatures
            return hmac.compare_digest(signature, expected_signature)

        except Exception as e:
            logger.error(f"Error verifying webhook signature: {str(e)}")
            return False