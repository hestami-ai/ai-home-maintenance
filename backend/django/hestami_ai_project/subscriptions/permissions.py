from rest_framework import permissions
import logging

logger = logging.getLogger('subscriptions.permissions')  # Use full path for logger

class IsServiceAccount(permissions.BasePermission):
    """
    Custom permission to only allow service accounts to access the view.
    """
    def has_permission(self, request, view):
        # Log authentication info
        logger.info(f"Checking service account permission for user: {request.user}")
        logger.info(f"Is authenticated: {request.user.is_authenticated}")
        logger.info(f"Is service account: {getattr(request.user, 'is_service_account', False)}")
        logger.info(f"Has service token: {bool(getattr(request.user, 'service_token', None))}")
        
        # Check if user is authenticated and is a service account
        has_permission = bool(
            request.user and 
            request.user.is_authenticated and
            request.user.is_service_account and
            request.user.service_token
        )
        
        logger.info(f"Permission granted: {has_permission}")
        return has_permission
