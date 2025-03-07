# subscriptions/models.py

from django.db import models
from django.conf import settings
from djmoney.models.fields import MoneyField
from django.utils import timezone

class SquareCustomer(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    square_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.square_id}"

class SubscriptionPlan(models.Model):
    BILLING_FREQUENCIES = [
        ('MONTHLY', 'Monthly'),
        ('YEARLY', 'Yearly'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    price = MoneyField(max_digits=14, decimal_places=2, default_currency='USD')
    billing_frequency = models.CharField(max_length=10, choices=BILLING_FREQUENCIES)
    square_catalog_id = models.CharField(max_length=255, unique=True)
    features = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_plans'

class SquareSubscription(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACTIVE', 'Active'),
        ('CANCELED', 'Canceled'),
        ('DEACTIVATED', 'Deactivated'),
        ('FAILED', 'Failed'),
    ]

    customer = models.ForeignKey(SquareCustomer, on_delete=models.CASCADE)
    square_id = models.CharField(max_length=255, unique=True)
    plan_variation_id = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    start_date = models.DateTimeField()
    charged_through_date = models.DateTimeField(null=True, blank=True)
    canceled_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.user.email} - {self.square_id} ({self.status})"

    def cancel(self):
        """
        Mark the subscription as canceled and record the cancellation date
        """
        self.status = 'CANCELED'
        self.canceled_date = timezone.now()
        self.save()

class CustomerSubscription(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('CANCELED', 'Canceled'),
        ('PAST_DUE', 'Past Due'),
        ('PENDING', 'Pending'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    square_subscription_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_subscriptions'