"""
LibreChat User Synchronization Service

Handles user provisioning and synchronization between Django and LibreChat.
Provides methods for creating LibreChat users and authenticating with the LibreChat API.
"""
import httpx
import jwt
from django.conf import settings
import logging
from typing import Dict, Optional

# Use celery logger so LibreChat sync logs go to celery.log when triggered by Celery
logger = logging.getLogger('celery')

# Configure httpx logger to also use celery handlers when in Celery context
httpx_logger = logging.getLogger('httpx')
celery_logger = logging.getLogger('celery')
if celery_logger.handlers:
    # Copy celery handlers to httpx logger so HTTP logs go to celery.log
    for handler in celery_logger.handlers:
        if handler not in httpx_logger.handlers:
            httpx_logger.addHandler(handler)
    httpx_logger.setLevel(logging.INFO)
    httpx_logger.propagate = False


class LibreChatSyncService:
    """Service for syncing users with LibreChat"""
    
    def __init__(self):
        self.base_url = settings.LIBRECHAT_API_URL
        self.timeout = 30.0
    
    async def create_user(
        self, 
        email: str, 
        password: str, 
        first_name: str, 
        last_name: str
    ) -> Dict[str, any]:
        """
        Create user in LibreChat.
        
        Args:
            email: User's email address
            password: Generated password for LibreChat
            first_name: User's first name
            last_name: User's last name
        
        Returns:
            {
                'success': bool,
                'user_id': str (if successful),
                'data': dict (full response data),
                'error': str (if failed)
            }
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"Creating LibreChat user for {email}")
                
                response = await client.post(
                    f"{self.base_url}/api/auth/register",
                    json={
                        "name": f"{first_name} {last_name}",
                        "email": email,
                        "password": password,
                        "confirm_password": password,  # LibreChat requires password confirmation
                        "username": email.split('@')[0]  # Use email prefix as username
                    }
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    
                    # Log the full response to debug the structure
                    logger.info(f"LibreChat registration response for {email}: {data}")
                    
                    # LibreChat registration doesn't return user object directly
                    # We need to authenticate to get the user ID from the JWT token
                    user_id = await self.authenticate(email, password)
                    
                    if user_id:
                        logger.info(f"Successfully created LibreChat user {user_id} for {email}")
                        return {
                            'success': True,
                            'user_id': user_id,
                            'data': data
                        }
                    
                    logger.warning(f"Created LibreChat user but failed to get user ID for {email}")
                    return {
                        'success': True,
                        'user_id': None,
                        'data': data
                    }
                else:
                    error_msg = f"Status {response.status_code}: {response.text}"
                    logger.error(f"LibreChat user creation failed for {email}: {error_msg}")
                    
                    return {
                        'success': False,
                        'error': error_msg
                    }
            
            except httpx.TimeoutException as e:
                error_msg = f"Timeout connecting to LibreChat: {str(e)}"
                logger.error(f"LibreChat sync error for {email}: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
            
            except Exception as e:
                error_msg = f"Unexpected error: {str(e)}"
                logger.error(f"LibreChat sync error for {email}: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
    
    async def authenticate(self, email: str, password: str) -> Optional[str]:
        """
        Authenticate with LibreChat and return user ID from JWT token.
        
        Args:
            email: User's email address
            password: LibreChat password
        
        Returns:
            LibreChat user ID extracted from JWT token, or None if failed
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"Authenticating with LibreChat for {email}")
                
                response = await client.post(
                    f"{self.base_url}/api/auth/login",
                    json={
                        "email": email,
                        "password": password
                    }
                )
                
                if response.status_code == 200:
                    # Extract all cookies from response
                    cookies = response.cookies
                    
                    # Log all cookies for debugging
                    logger.info(f"LibreChat login cookies: {dict(cookies)}")
                    
                    # LibreChat uses JWT tokens, not session cookies
                    # Get the refreshToken which contains the user ID
                    refresh_token = cookies.get('refreshToken')
                    if refresh_token:
                        try:
                            # Decode JWT without verification to get user ID
                            decoded = jwt.decode(refresh_token, options={"verify_signature": False})
                            user_id = decoded.get('id')
                            logger.info(f"Successfully authenticated with LibreChat for {email}, user ID: {user_id}")
                            # Return the user ID directly instead of session cookie
                            return user_id
                        except Exception as e:
                            logger.error(f"Failed to decode JWT token for {email}: {str(e)}")
                            return None
                    
                    logger.error(f"No refreshToken cookie in LibreChat response for {email}")
                    return None
                else:
                    logger.error(f"LibreChat auth failed for {email}: Status {response.status_code}")
                    return None
            
            except Exception as e:
                logger.error(f"LibreChat auth error for {email}: {str(e)}")
                return None
    
    async def get_user_details(self, session_cookie: str) -> Optional[dict]:
        """
        Fetch user details from LibreChat using session cookie.
        
        Args:
            session_cookie: Session cookie string (e.g., "connect.sid=...")
        
        Returns:
            User details dict or None if failed
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info("Fetching user details from LibreChat")
                
                response = await client.get(
                    f"{self.base_url}/api/user",
                    headers={
                        "Cookie": session_cookie
                    }
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    logger.info(f"Successfully fetched user details: {user_data.get('email')}")
                    return user_data
                else:
                    logger.error(f"Failed to fetch user details: Status {response.status_code}")
                    return None
            
            except Exception as e:
                logger.error(f"Error fetching user details: {str(e)}")
                return None
