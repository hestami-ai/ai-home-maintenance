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
    """
    keyword = 'Token'

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        logger.info(f"Auth header: {auth}")

        if not auth or auth[0].lower() != self.keyword.lower().encode():
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
            logger.info(f"Attempting to authenticate with token: {token[:8]}...")
        except UnicodeError:
            msg = 'Invalid token header. Token string should not contain invalid characters.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)

        return self.authenticate_credentials(token)

    def authenticate_credentials(self, key):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            user = User.objects.get(service_token=key, is_active=True)
            logger.info(f"Found user: {user.email}, is_service_account: {user.is_service_account}")
            
            if not user.is_service_account:
                msg = 'User is not a service account'
                logger.warning(msg)
                raise AuthenticationFailed(msg)
                
            return (user, None)
        except User.DoesNotExist:
            msg = 'Invalid token or user not found.'
            logger.warning(msg)
            raise AuthenticationFailed(msg)
