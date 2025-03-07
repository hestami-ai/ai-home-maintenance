from django.shortcuts import render
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import SubscriptionPlan, CustomerSubscription, SquareCustomer, SquareSubscription
from .serializers import (
    SubscriptionPlanSerializer,
    CustomerSubscriptionSerializer,
    SquareCustomerSerializer,
    SquareSubscriptionSerializer,
    CreateSubscriptionSerializer,
    CancelSubscriptionSerializer
)
from .services import SquareService
from .permissions import IsServiceAccount
from django.utils import timezone
from django.db import transaction
import logging
from django.contrib.auth import get_user_model
from users.authentication import ServiceTokenAuthentication
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing subscription plans.
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'])
    def features(self, request, pk=None):
        """Get detailed features for a plan"""
        plan = self.get_object()
        return Response({
            'features': plan.features,
            'price': str(plan.price),
            'billing_frequency': plan.billing_frequency
        })

class SquareCustomerViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Square customers.
    Used by both the Temporal workflow and frontend.
    """
    serializer_class = SquareCustomerSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [IsServiceAccount()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return SquareCustomer.objects.all()
        return SquareCustomer.objects.filter(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Create a Square customer (used by Temporal workflow)"""
        try:
            with transaction.atomic():
                user_id = request.data.get('user_id')
                square_id = request.data.get('square_id')
                
                customer = SquareCustomer.objects.create(
                    user_id=user_id,
                    square_id=square_id
                )
                
                serializer = self.get_serializer(customer)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            logger.error(f"Failed to create Square customer: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

@method_decorator(csrf_exempt, name='dispatch')
class SquareSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Square subscriptions.
    This is a service-to-service API and should only be accessed by service accounts.
    """
    authentication_classes = [ServiceTokenAuthentication]
    permission_classes = [IsServiceAccount]
    serializer_class = SquareSubscriptionSerializer
    
    def get_permissions(self):
        """Get permissions for this viewset"""
        return [IsServiceAccount()]

    def get_queryset(self):
        """Filter subscriptions by user unless staff"""
        if self.request.user.is_staff:
            return SquareSubscription.objects.all()
        return SquareSubscription.objects.filter(
            customer__user=self.request.user
        ).select_related('customer__user')

    def get_square_service(self):
        return SquareService()

    @action(detail=False, methods=['post'])
    def create_subscription(self, request):
        """Create a Square subscription"""
        serializer = CreateSubscriptionSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Invalid serializer data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                # Get user
                user_id = serializer.validated_data['user_id']
                logger.info(f"Creating subscription for user: {user_id}")
                
                user = get_user_model().objects.get(id=user_id)
                logger.info(f"Found user: {user.email}")
                
                # Create Square customer first
                square_service = self.get_square_service()
                square_customer = square_service.create_customer(user)
                logger.info(f"Created Square customer: {square_customer.square_id}")
                
                # Check if this is a service account request
                is_service_flow = bool(
                    request.user and 
                    request.user.is_authenticated and 
                    request.user.is_service_account
                )
                logger.info(f"Request is service flow: {is_service_flow}")
                
                # Create subscription in Square
                subscription = square_service.create_subscription(
                    customer=square_customer,
                    plan_variation_id=serializer.validated_data['plan_variation_id'],
                    card_nonce=serializer.validated_data.get('card_nonce'),
                    is_service_flow=is_service_flow
                )
                logger.info(f"Created subscription: {subscription.id}")
                
                return Response(
                    SquareSubscriptionSerializer(subscription).data,
                    status=status.HTTP_201_CREATED
                )
                
        except Exception as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a subscription"""
        subscription = self.get_object()
        square_service = self.get_square_service()
        
        try:
            # Cancel in Square
            square_service.cancel_subscription(subscription.square_id)
            
            # Update local record
            subscription.cancel()
            
            return Response(
                SquareSubscriptionSerializer(subscription).data
            )
            
        except Exception as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def upgrade(self, request, pk=None):
        """Upgrade to a new plan"""
        subscription = self.get_object()
        new_plan_id = request.data.get('plan_variation_id')
        
        if not new_plan_id:
            return Response(
                {'error': 'plan_variation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        square_service = self.get_square_service()
        try:
            # Upgrade in Square
            upgraded_data = square_service.upgrade_subscription(
                subscription.square_id,
                new_plan_id
            )
            
            # Update local record
            subscription.plan_variation_id = new_plan_id
            subscription.save()
            
            return Response(
                SquareSubscriptionSerializer(subscription).data
            )
            
        except Exception as e:
            logger.error(f"Failed to upgrade subscription: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get user's current active subscription"""
        try:
            subscription = SquareSubscription.objects.filter(
                customer__user=request.user,
                status='ACTIVE'
            ).latest('created_at')
            
            return Response(
                SquareSubscriptionSerializer(subscription).data
            )
            
        except SquareSubscription.DoesNotExist:
            return Response(
                {'message': 'No active subscription found'},
                status=status.HTTP_404_NOT_FOUND
            )

class SquareWebhookView(viewsets.ViewSet):
    """
    Handle Square webhooks for subscription updates
    """
    permission_classes = []  # Will verify Square signature
    
    def create(self, request):
        """Handle incoming webhook"""
        # Verify Square signature
        signature = request.headers.get('X-Square-Signature')
        if not signature:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            event_type = request.data.get('type')
            event_data = request.data.get('data', {})
            
            if event_type == 'subscription.updated':
                subscription_id = event_data['id']
                subscription = SquareSubscription.objects.get(square_id=subscription_id)
                
                # Update subscription status
                subscription.status = event_data['status']
                if event_data.get('canceled_date'):
                    subscription.canceled_date = event_data['canceled_date']
                subscription.save()
                
                logger.info(f"Updated subscription {subscription_id} status to {event_data['status']}")
                
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)
