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
]
