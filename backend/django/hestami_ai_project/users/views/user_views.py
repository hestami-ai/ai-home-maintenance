from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
import logging
from django.utils import timezone
from datetime import datetime
from django.db.models import Q

from users.models import User

logger = logging.getLogger('security')

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_users(request):
    """
    Get a list of all users.
    Only available to staff users.
    """
    try:
        # Check if user is staff
        if not request.user.is_staff or request.user.user_role != 'STAFF':
            return Response(
                {"error": "Only staff users can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all users
        users = User.objects.filter(
            user_role__in=['PROPERTY_OWNER', 'SERVICE_PROVIDER', 'STAFF']
        ).exclude(id=request.user.id)  # Exclude current user
        
        logger.info(f"Found {users.count()} users in database query")
        
        # Format user data
        user_data = []
        for user in users:
            # Format last login time
            last_login = user.last_login.isoformat() if user.last_login else None
            
            # Format user data to match frontend interface
            user_data.append({
                "id": str(user.id),
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "role": user.user_role,
                "status": "active" if user.is_active else "inactive",
                "lastLogin": last_login
            })
        
        logger.info(f"Returning {len(user_data)} formatted user records")
        
        return Response(user_data)
    
    except Exception as e:
        logger.error(f"Error retrieving users list: {str(e)}")
        return Response(
            {"error": "Failed to retrieve users list"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    Search for users by username, first name, or last name.
    Used for @mention functionality in comments.
    """
    try:
        # Get search query from request
        query = request.GET.get('q', '')
        
        if not query:
            return Response([], status=status.HTTP_200_OK)
        
        # Search for users matching the query
        users = User.objects.filter(
            Q(username__icontains=query) | 
            Q(first_name__icontains=query) | 
            Q(last_name__icontains=query) |
            Q(email__icontains=query)
        ).exclude(id=request.user.id)  # Exclude current user
        
        # Limit results for performance
        users = users[:10]
        
        # Format user data for mention
        user_data = []
        for user in users:
            user_data.append({
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name
            })
        
        return Response(user_data)
    
    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        return Response(
            {"error": "Failed to search users"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
