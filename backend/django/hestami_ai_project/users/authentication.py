import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, TokenAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
import logging

logger = logging.getLogger(__name__)

class ServiceTokenAuthentication(TokenAuthentication):
    """
    Custom authentication for service accounts using service tokens.
    This is used for service-to-service API endpoints only.
    Accepts both 'Token' and 'Bearer' prefixes for compatibility.
    """
    keyword = 'Token'
    allowed_keywords = ['Token', 'Bearer']

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        logger.error(f"Auth header: {auth}")
        
        if not auth:
            logger.warning("No auth header provided")
            return None
            
        try:
            auth_type = auth[0].lower().decode()
            logger.error(f"Auth type: {auth_type}")
            
            if auth_type not in [k.lower() for k in self.allowed_keywords]:
                logger.warning(f"Auth type '{auth_type}' not in allowed keywords: {self.allowed_keywords}")
                return None
        except Exception as e:
            logger.error(f"Error processing auth header: {str(e)}")
            return None

        if len(auth) == 1:
            msg = 'Invalid token header. No credentials provided.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = 'Invalid token header. Token string should not contain spaces.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)

        try:
            token = auth[1].decode()
        except UnicodeError:
            msg = 'Invalid token header. Token string should not contain invalid characters.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)

        return self.authenticate_credentials(token)

    def authenticate_credentials(self, key):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            # First try to find any user with this token
            try:
                any_user = User.objects.filter(service_token=key).first()
                if any_user:
                    logger.error(f"Found user with matching token: {any_user.email}, active: {any_user.is_active}, service_account: {any_user.is_service_account}")
                else:
                    logger.warning(f"No user found with token starting with {key[:8]}...")
            except Exception as e:
                logger.error(f"Error checking for any user: {str(e)}")
            
            # Now try the actual authentication
            user = User.objects.get(service_token=key, is_active=True)
            
            if not user.is_service_account:
                msg = 'User is not a service account'
                logger.warning(msg)
                raise AuthenticationFailed(msg)
                
            return (user, None)
        except User.DoesNotExist:
            msg = 'Invalid token or user not found.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)
