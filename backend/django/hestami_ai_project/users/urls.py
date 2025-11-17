from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views.auth_views import (
    UserRegistrationView,
    UserLoginView,
    PasswordChangeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserProfileView,
    UserLogoutView,
    CustomTokenRefreshView,
    CustomTokenVerifyView
)
from .views.dashboard_views import staff_dashboard_stats
from .views.user_views import list_users, search_users
from .views.librechat_views import LibreChatPasswordView

app_name = 'users'

urlpatterns = [
    # Authentication endpoints
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('logout/', UserLogoutView.as_view(), name='logout'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', CustomTokenVerifyView.as_view(), name='token_verify'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    
    # Password management
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    
    # Dashboard endpoints
    path('dashboard/stats/', staff_dashboard_stats, name='staff_dashboard_stats'),
    
    # User management endpoints
    path('list/', list_users, name='list_users'),  # This becomes /api/users/list/
    path('search/', search_users, name='search_users'),  # This becomes /api/users/search/
    
    # LibreChat integration
    path('librechat-password/', LibreChatPasswordView.as_view(), name='librechat_password'),
]
