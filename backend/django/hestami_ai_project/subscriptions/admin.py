from django.contrib import admin
from .models import SubscriptionPlan, SquareCustomer, SquareSubscription

# Register your models here.

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'billing_frequency', 'is_active')
    list_filter = ('is_active', 'billing_frequency')
    search_fields = ('name',)

@admin.register(SquareCustomer)
class SquareCustomerAdmin(admin.ModelAdmin):
    list_display = ('user', 'square_id', 'created_at', 'updated_at')
    search_fields = ('user__email', 'square_id')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(SquareSubscription)
class SquareSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('customer', 'square_id', 'status', 'start_date', 'charged_through_date')
    list_filter = ('status',)
    search_fields = ('customer__user__email', 'square_id')
    readonly_fields = ('created_at', 'updated_at')
