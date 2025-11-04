"""
Service Category Views
Handles listing and management of service categories.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
import logging

from services.models.base_models import ServiceCategory

logger = logging.getLogger('security')


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_service_categories(request):
    """List all service categories"""
    try:
        categories = [
            {
                'id': category[0],
                'name': category[1],
            }
            for category in ServiceCategory.choices
        ]
        logger.info(f"Returning {len(categories)} service categories")
        return Response(categories)
    except Exception as e:
        logger.error(f"Error listing service categories: {str(e)}")
        return Response(
            {"error": "Failed to retrieve service categories"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
