"""
Bidding Management Views (Phase 2)
Handles advanced bidding operations like reopening research.
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404

from services.models import ServiceRequest, TimelineEntry, TimelineEntryType
from services.serializers.base_serializers import ServiceRequestSerializer
from services.permissions import IsHestamaiStaff
from users.authentication import ServiceTokenAuthentication

logger = logging.getLogger('services')


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def reopen_research(request, request_id):
    """
    Reopen a service request for research (Phase 2).
    Transitions status back to IN_RESEARCH and logs the reason to timeline.
    STAFF-only endpoint.
    """
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Validate current status allows reopening
        allowed_statuses = [
            ServiceRequest.Status.BIDDING,
            ServiceRequest.Status.ACCEPTED,
            ServiceRequest.Status.SCHEDULED
        ]
        
        if service_request.status not in allowed_statuses:
            return Response(
                {
                    "error": f"Cannot reopen research from status {service_request.status}. "
                    f"Must be in BIDDING, ACCEPTED, or SCHEDULED status."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get reason from request
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {"error": "Reason for reopening research is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store previous status
        previous_status = service_request.status
        
        # Update service request status
        service_request.status = ServiceRequest.Status.IN_RESEARCH
        service_request.save()
        
        # Create timeline entry
        timeline_content = f"Research reopened by STAFF. Reason: {reason}"
        
        TimelineEntry.objects.create(
            service_request=service_request,
            entry_type=TimelineEntryType.STATUS_CHANGE,
            content=timeline_content,
            metadata={
                'previous_status': previous_status,
                'new_status': ServiceRequest.Status.IN_RESEARCH,
                'reason': reason,
                'action': 'research_reopened'
            },
            created_by=request.user
        )
        
        logger.info(
            f"STAFF user {request.user.email} reopened research for service request "
            f"{service_request.id}. Previous status: {previous_status}. Reason: {reason}"
        )
        
        serializer = ServiceRequestSerializer(service_request)
        return Response({
            'message': 'Research reopened successfully',
            'service_request': serializer.data
        })
    
    except Exception as e:
        logger.error(f"Error reopening research: {str(e)}")
        return Response(
            {"error": "Failed to reopen research"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
