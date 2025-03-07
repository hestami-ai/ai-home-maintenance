from django.urls import path
from .views import (
    SubscriptionPlanViewSet,
    SquareSubscriptionViewSet,
    SquareCustomerViewSet,
    SquareWebhookView
)

app_name = 'subscriptions'

urlpatterns = [
    # Subscription plans
    path('plans/', SubscriptionPlanViewSet.as_view({'get': 'list'}), name='plan-list'),
    path('plans/<str:pk>/', SubscriptionPlanViewSet.as_view({'get': 'retrieve'}), name='plan-detail'),
    path('plans/<str:pk>/features/', SubscriptionPlanViewSet.as_view({'get': 'features'}), name='plan-features'),
    
    # Square customers
    path('customers/', SquareCustomerViewSet.as_view({'get': 'list', 'post': 'create'}), name='customer-list'),
    path('customers/<str:pk>/', SquareCustomerViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='customer-detail'),
    
    # Square subscriptions
    path('', SquareSubscriptionViewSet.as_view({'get': 'list'}), name='subscription-list'),
    path('create_subscription/', SquareSubscriptionViewSet.as_view({'post': 'create_subscription'}), name='subscription-create'),
    path('<str:pk>/', SquareSubscriptionViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='subscription-detail'),
    path('<str:pk>/cancel/', SquareSubscriptionViewSet.as_view({'post': 'cancel'}), name='subscription-cancel'),
    path('<str:pk>/upgrade/', SquareSubscriptionViewSet.as_view({'post': 'upgrade'}), name='subscription-upgrade'),
    
    # Square webhooks
    path('webhooks/square/', SquareWebhookView.as_view({'post': 'create'}), name='webhook-square'),
]
