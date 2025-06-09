from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.models import Count, Q
import logging

from users.models import User
from properties.models import Property
from services.models import ServiceRequest, ServiceProvider

logger = logging.getLogger('security')

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def staff_dashboard_stats(request):
    """
    Get dashboard statistics for staff users.
    Only available to staff users.
    """
    try:
        # Check if user is staff
        if not request.user.is_staff or request.user.user_role != 'STAFF':
            return Response(
                {"error": "Only staff users can access this endpoint"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get total users count
        total_users = User.objects.filter(
            is_active=True,
            user_role__in=['PROPERTY_OWNER', 'SERVICE_PROVIDER']
        ).count()
        
        # Get active service providers count - only count providers that have an associated user with SERVICE_PROVIDER role
        # A service provider is only considered "active" if:
        # 1. The service provider record has is_available=True
        # 2. The service provider is associated with a user
        # 3. The associated user has user_role='SERVICE_PROVIDER'
        # 4. The associated user is active (is_active=True)
        
        # First, get all service providers that are available
        all_available_providers = ServiceProvider.objects.filter(is_available=True)
        logger.info(f"Found {all_available_providers.count()} service providers with is_available=True")
        
        # Then, filter to only include those with an associated active user with SERVICE_PROVIDER role
        active_providers_query = User.objects.filter(
            is_active=True,
            user_role='SERVICE_PROVIDER',
            service_provider__isnull=False,
            service_provider__is_available=True
        )
        
        # Debug logging
        logger.info(f"Found {active_providers_query.count()} truly active service providers (with associated users)")
        
        # List all active providers for debugging
        for idx, user in enumerate(active_providers_query):
            logger.info(f"Active provider #{idx+1}: User ID={user.id}, Email={user.email}, Provider ID={user.service_provider.id if user.service_provider else 'N/A'}")
            
        active_providers = active_providers_query.count()
        
        # Get pending requests count - only count requests with status 'PENDING'
        all_pending_like_requests = ServiceRequest.objects.filter(
            status__in=['PENDING', 'IN_RESEARCH', 'BIDDING']
        ).count()
        
        # Log the count of all pending-like requests for debugging
        logger.info(f"Found {all_pending_like_requests} requests with status in ['PENDING', 'IN_RESEARCH', 'BIDDING']")
        
        # Only count requests with status 'PENDING' for the dashboard metric
        pending_requests_query = ServiceRequest.objects.filter(status='PENDING')
        
        # Debug logging
        logger.info(f"Found {pending_requests_query.count()} truly pending requests (status='PENDING')")
        
        # List all pending requests for debugging
        for idx, request in enumerate(pending_requests_query[:5]):  # Limit to first 5 for brevity
            logger.info(f"Pending request #{idx+1}: ID={request.id}, Status={request.status}")
            
        pending_requests = pending_requests_query.count()
        
        # Return stats
        return Response({
            "total_users": total_users,
            "active_providers": active_providers,
            "pending_requests": pending_requests
        })
    
    except Exception as e:
        logger.error(f"Error retrieving staff dashboard stats: {str(e)}")
        return Response(
            {"error": "Failed to retrieve dashboard statistics"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
