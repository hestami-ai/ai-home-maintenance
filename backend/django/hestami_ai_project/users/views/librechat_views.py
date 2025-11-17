"""
LibreChat Integration Views

Provides API endpoints for LibreChat integration, including password retrieval
for transparent authentication.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
import logging

logger = logging.getLogger(__name__)


class LibreChatPasswordView(APIView):
    """
    Return encrypted LibreChat password for authenticated user.
    
    This endpoint allows SvelteKit to retrieve the user's LibreChat password
    for transparent authentication during login. Only accessible by the user
    themselves via valid JWT token.
    
    GET /api/users/librechat-password/
    Authorization: Bearer <django_jwt>
    
    Response:
        200: { "librechat_password": "<decrypted_password>" }
        404: { "error": "LibreChat password not set" }
        401: { "error": "Authentication required" }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get LibreChat password for authenticated user
            password = request.user.get_librechat_password()
            
            logger.info(f"LibreChat password retrieved for user {request.user.email}")
            
            return Response({
                'librechat_password': password
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            logger.warning(f"LibreChat password not found for user {request.user.email}: {str(e)}")
            return Response(
                {'error': 'LibreChat password not set'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error retrieving LibreChat password for user {request.user.email}: {str(e)}")
            return Response(
                {'error': 'Failed to retrieve LibreChat password'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
