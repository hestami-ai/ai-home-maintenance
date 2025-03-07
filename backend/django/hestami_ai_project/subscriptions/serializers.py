from rest_framework import serializers
from .models import SquareCustomer, SquareSubscription, SubscriptionPlan, CustomerSubscription

class SquareCustomerSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = SquareCustomer
        fields = ['id', 'square_id', 'email', 'created_at']
        read_only_fields = ['square_id', 'created_at']

class SquareSubscriptionSerializer(serializers.ModelSerializer):
    customer_email = serializers.EmailField(source='customer.user.email', read_only=True)
    
    class Meta:
        model = SquareSubscription
        fields = [
            'id', 'square_id', 'customer_email', 'plan_variation_id',
            'status', 'start_date', 'charged_through_date',
            'canceled_date', 'created_at'
        ]
        read_only_fields = ['square_id', 'status', 'charged_through_date', 'created_at']

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'price', 'billing_frequency', 'is_active']

class CreateSubscriptionSerializer(serializers.Serializer):
    user_id = serializers.CharField(required=True)
    plan_variation_id = serializers.CharField(required=True)
    card_nonce = serializers.CharField(required=False)  # Optional for service account flow
    start_date = serializers.DateTimeField(required=False)

class CancelSubscriptionSerializer(serializers.Serializer):
    subscription_id = serializers.CharField(required=True)

class CustomerSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    
    class Meta:
        model = CustomerSubscription
        fields = [
            'id', 'user', 'plan', 'status', 'current_period_start',
            'current_period_end', 'cancel_at_period_end', 'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'square_subscription_id']
