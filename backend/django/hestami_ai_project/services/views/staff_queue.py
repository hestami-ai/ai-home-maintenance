"""
STAFF Queue Management Views
Handles STAFF-specific service request queue, dashboard, and status management.
Phase 1: MVP Manual Research Enablement
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
import logging

from services.models.base_models import ServiceRequest
from services.models.timeline_models import TimelineEntry
from services.serializers.base_serializers import ServiceRequestSerializer
from services.permissions import IsHestamaiStaff

logger = logging.getLogger('security')


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def staff_queue_dashboard(request):
    """
    STAFF queue dashboard with aggregated counts and filtered requests.
    
    Query Parameters:
    - assigned_to: Filter by assignment ('me', user_id, or omit for all)
    - status: Filter by status
    - priority: Filter by priority
    - search: Search by title, property, customer name, or address
    - page: Page number for pagination
    
    Returns:
    - queue_counts: Status-based counts
    - priority_counts: Priority distribution
    - sla_indicators: Overdue and approaching deadline counts
    - requests: Filtered service requests
    """
    try:
        # Base queryset for STAFF users
        requests = ServiceRequest.objects.all()
        
        # Apply STAFF-specific filters
        assigned_to = request.query_params.get('assigned_to')
        if assigned_to:
            if assigned_to == 'me':
                requests = requests.filter(assigned_to=request.user)
            elif assigned_to == 'unassigned':
                requests = requests.filter(assigned_to__isnull=True)
            else:
                requests = requests.filter(assigned_to__id=assigned_to)
        
        # Status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            requests = requests.filter(status=status_filter)
            
        # Priority filter
        priority_filter = request.query_params.get('priority')
        if priority_filter:
            requests = requests.filter(priority=priority_filter)
            
        # Search by property/customer
        search = request.query_params.get('search')
        if search:
            requests = requests.filter(
                Q(title__icontains=search) |
                Q(property__title__icontains=search) |
                Q(property__owner__first_name__icontains=search) |
                Q(property__owner__last_name__icontains=search) |
                Q(property__address__icontains=search)
            )
        
        # Calculate aggregated counts
        queue_counts = {
            'total': ServiceRequest.objects.count(),
            'pending': ServiceRequest.objects.filter(status='PENDING').count(),
            'in_research': ServiceRequest.objects.filter(status='IN_RESEARCH').count(),
            'bidding': ServiceRequest.objects.filter(status='BIDDING').count(),
            'accepted': ServiceRequest.objects.filter(status='ACCEPTED').count(),
            'scheduled': ServiceRequest.objects.filter(status='SCHEDULED').count(),
            'my_queue': ServiceRequest.objects.filter(assigned_to=request.user).count(),
            'unassigned': ServiceRequest.objects.filter(assigned_to__isnull=True).count(),
        }
        
        # Priority distribution
        priority_counts = {
            'urgent': ServiceRequest.objects.filter(priority='URGENT').count(),
            'high': ServiceRequest.objects.filter(priority='HIGH').count(),
            'medium': ServiceRequest.objects.filter(priority='MEDIUM').count(),
            'low': ServiceRequest.objects.filter(priority='LOW').count(),
        }
        
        # SLA indicators (requests approaching deadlines)
        three_days_from_now = timezone.now() + timedelta(days=3)
        overdue_requests = ServiceRequest.objects.filter(
            bid_submission_deadline__lt=timezone.now(),
            status__in=['PENDING', 'IN_RESEARCH', 'BIDDING']
        ).count()
        
        approaching_deadline = ServiceRequest.objects.filter(
            bid_submission_deadline__lte=three_days_from_now,
            bid_submission_deadline__gt=timezone.now(),
            status__in=['PENDING', 'IN_RESEARCH', 'BIDDING']
        ).count()
        
        # Serialize filtered requests
        serializer = ServiceRequestSerializer(
            requests.select_related('property', 'assigned_to', 'created_by').order_by('-created_at'),
            many=True,
            context={'request': request}
        )
        
        response_data = {
            'queue_counts': queue_counts,
            'priority_counts': priority_counts,
            'sla_indicators': {
                'overdue': overdue_requests,
                'approaching_deadline': approaching_deadline,
            },
            'requests': serializer.data
        }
        
        logger.info(f"STAFF user {request.user.email} accessed queue dashboard")
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error retrieving STAFF queue dashboard: {str(e)}")
        return Response(
            {"error": "Failed to retrieve queue dashboard"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def update_service_request_status(request, request_id):
    """
    Update service request status (STAFF only).
    
    Allows STAFF to manually transition service request status with optional reason.
    Automatically creates a timeline entry for the status change.
    
    Body Parameters:
    - status: New status value (required)
    - reason: Optional reason for the status change
    
    Returns:
    - message: Success message
    - old_status: Previous status
    - new_status: Updated status
    - service_request: Updated service request data
    """
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Get new status and optional reason
        new_status = request.data.get('status')
        reason = request.data.get('reason', '')
        
        if not new_status:
            return Response(
                {"error": "Status is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store old status for logging
        old_status = service_request.status
        
        # Update status
        service_request.status = new_status
        service_request.save()
        
        # Create timeline entry
        timeline_content = f"Status changed from {old_status} to {new_status}"
        if reason:
            timeline_content += f"\nReason: {reason}"
        
        TimelineEntry.objects.create(
            service_request=service_request,
            entry_type='STATUS_CHANGE',
            content=timeline_content,
            created_by=request.user
        )
        
        logger.info(f"STAFF user {request.user.email} updated request {service_request.id} status from {old_status} to {new_status}")
        
        return Response({
            'message': 'Status updated successfully',
            'old_status': old_status,
            'new_status': new_status,
            'service_request': ServiceRequestSerializer(service_request, context={'request': request}).data
        })
        
    except Exception as e:
        logger.error(f"Error updating service request status: {str(e)}")
        return Response(
            {"error": "Failed to update status"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
