"""
Research Data Management Views
Handles STAFF research data capture and management for service requests.
Phase 1: MVP Manual Research Enablement
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from django.shortcuts import get_object_or_404
import logging

from services.models.base_models import ServiceRequest
from services.serializers.base_serializers import ServiceResearchSerializer
from services.permissions import IsHestamaiStaff

logger = logging.getLogger('security')


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def add_research_data(request, request_id):
    """
    Add research data to a service request.
    
    STAFF can capture provider research, availability, pricing, and other
    relevant information during the manual research phase.
    
    Body Parameters:
    - research_data: Structured research data (dict)
    - research_content: HTML/rich-text research content
    - research_content_raw_text: Plain text version
    - data_sources: List of data sources/URLs
    - notes: Additional notes
    - update_status: Boolean to update request status to IN_RESEARCH
    
    Returns:
    - Created research entry data
    """
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Create a new research entry
        research_data = {
            'service_request': service_request.id,
            'research_data': request.data.get('research_data', {}),
            'research_content': request.data.get('research_content', ''),
            'research_content_raw_text': request.data.get('research_content_raw_text', ''),
            'data_sources': request.data.get('data_sources', []),
            'notes': request.data.get('notes', '')
        }
        
        serializer = ServiceResearchSerializer(
            data=research_data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            logger.error(f"Invalid research data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Save the research entry with the current user as researched_by
        research_entry = serializer.save(researched_by=request.user)
        
        # Update the service request status if specified
        update_status = request.data.get('update_status', False)
        if update_status:
            service_request.status = ServiceRequest.Status.IN_RESEARCH
            service_request.save()
        
        # Log that we have research content and the status is IN_RESEARCH
        has_research_content = bool(research_entry.research_content)
        is_in_research = service_request.status == ServiceRequest.Status.IN_RESEARCH
        
        if has_research_content and is_in_research:
            logger.info(f"Research entry {research_entry.id} created with content. It will be automatically processed by the background task.")
            # No need to trigger a specific task as our background processor will pick it up
        
        logger.info(f"Added research data for service request: {service_request.id} by {request.user.email}")
        return Response(
            ServiceResearchSerializer(research_entry).data,
            status=status.HTTP_201_CREATED
        )
    except Exception as e:
        logger.error(f"Error adding research data: {str(e)}")
        return Response(
            {"error": "Failed to add research data"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def list_research_entries(request, request_id):
    """
    List all research entries for a service request.
    
    Returns all research data captured by STAFF for the specified service request.
    """
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Get all research entries for this request
        research_entries = service_request.research_entries.all().order_by('-created_at')
        
        serializer = ServiceResearchSerializer(
            research_entries,
            many=True,
            context={'request': request}
        )
        
        logger.info(f"Retrieved {len(research_entries)} research entries for request {request_id}")
        return Response({
            'count': len(research_entries),
            'results': serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error listing research entries: {str(e)}")
        return Response(
            {"error": "Failed to retrieve research entries"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
