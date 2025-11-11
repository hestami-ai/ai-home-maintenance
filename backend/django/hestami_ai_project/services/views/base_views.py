from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
import logging

from services.models.base_models import (
    ServiceProvider, ServiceRequest,
    ServiceBid, ServiceReport, ServiceReview,
    ServiceRequestClarification, ServiceRequestView,
    ServiceRequestInterest, ServiceCategory
)
from services.serializers.base_serializers import (
    ServiceProviderSerializer, ServiceRequestSerializer,
    ServiceBidSerializer, ServiceReportSerializer,
    ServiceReviewSerializer, ServiceRequestClarificationSerializer,
    ServiceRequestInterestSerializer, ServiceRequestCreateSerializer,
    ServiceResearchSerializer
)
from services.permissions import (
    IsServiceProvider, IsPropertyOwner,
    CanViewServiceRequest, CanBidOnServiceRequest,
    IsHestamaiStaff
)

logger = logging.getLogger('security')

# Service Provider Views
@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def provider_profile(request):
    """Get or update service provider profile"""
    try:
        # Get the service provider associated with the current user
        provider = get_object_or_404(ServiceProvider, id=request.user.service_provider.id)
        
        if request.method == 'GET':
            serializer = ServiceProviderSerializer(provider)
            return Response(serializer.data)
        
        elif request.method == 'PUT':
            serializer = ServiceProviderSerializer(
                provider,
                data=request.data,
                partial=True
            )
            if serializer.is_valid():
                provider = serializer.save()
                logger.info(f"Provider profile updated: {provider.id}")
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error handling provider profile: {str(e)}")
        return Response(
            {"error": "Failed to process provider profile"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_providers(request):
    """
    List service providers filtered by category and location.
    
    Query parameters:
    - service_request_id: Filter by service request (uses property location and category)
    - category: Filter by service category
    - location: Filter by location (not implemented)
    - radius_miles: Search radius in miles (default: 25, requires service_request_id)
    """
    try:
        service_request_id = request.query_params.get('service_request_id')
        category_id = request.query_params.get('category')
        radius_miles = float(request.query_params.get('radius_miles', 25))
        
        providers = ServiceProvider.objects.filter(is_available=True)
        
        # If service_request_id is provided, filter by location and category
        if service_request_id:
            service_request = get_object_or_404(ServiceRequest, id=service_request_id)
            
            # Get property geocode data
            property_obj = service_request.property
            geocode_data = property_obj.geocode_address
            
            # Extract latitude and longitude from geocode_address
            # Azure Maps stores it in results[0].position.{lat,lon}
            latitude = None
            longitude = None
            
            if geocode_data:
                # Try Azure Maps format first
                results = geocode_data.get('results', [])
                if results and len(results) > 0:
                    position = results[0].get('position', {})
                    latitude = position.get('lat')
                    longitude = position.get('lon')
                else:
                    # Fallback to direct lat/lon (if stored differently)
                    latitude = geocode_data.get('latitude')
                    longitude = geocode_data.get('longitude')
            
            if not latitude or not longitude:
                logger.warning(
                    f"Service request {service_request_id} property has no geocoded location. "
                    f"Address: {property_obj.address}, {property_obj.city}, {property_obj.state}. "
                    f"Geocode data: {geocode_data}"
                )
                return Response({
                    'count': 0,
                    'results': [],
                    'message': 'Property location not geocoded. Please update property address.'
                })
            
            # Filter by service category
            service_category = service_request.category
            providers = providers.filter(
                providercategory__category=service_category,
                providercategory__is_active=True
            ).distinct()
            
            # Filter by geographic proximity using PostGIS
            from django.contrib.gis.geos import Point
            from django.contrib.gis.measure import D
            from django.contrib.gis.db.models.functions import Distance
            
            # Create Point from property coordinates
            property_point = Point(float(longitude), float(latitude), srid=4326)
            
            # Find providers within radius
            providers = providers.filter(
                business_location__distance_lte=(property_point, D(mi=radius_miles))
            ).annotate(
                distance=Distance('business_location', property_point)
            ).order_by('distance')
            
            logger.info(
                f"Found {providers.count()} providers for service request {service_request_id} "
                f"(category: {service_category}, location: {latitude},{longitude}, radius: {radius_miles} mi)"
            )
        
        elif category_id:
            # Legacy category filtering
            providers = providers.filter(
                providercategory__category=category_id,
                providercategory__is_active=True
            ).distinct()
        
        serializer = ServiceProviderSerializer(providers, many=True)
        return Response({
            'count': len(serializer.data),
            'results': serializer.data
        })
    
    except Exception as e:
        logger.error(f"Error listing providers: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to retrieve providers"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Service Request Views
@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_service_request(request):
    """Create a new service request"""
    try:
        # Check if this is a DIY record (has report data and status is COMPLETED)
        is_diy = request.data.get('status') == 'COMPLETED' and 'report' in request.data
        
        # Create the service request
        serializer = ServiceRequestCreateSerializer(
            data=request.data,
            context={'request': request}  # Pass request in context
        )
        if not serializer.is_valid():
            logger.error(f"Invalid service request data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        service_request = serializer.save(created_by=request.user)
        
        # If this is a DIY record, create the service report
        if is_diy:
            report_data = request.data.get('report', {})
            report_data['service_request'] = service_request.id
            report_serializer = ServiceReportSerializer(
                data=report_data,
                context={'request': request}  # Pass request in context
            )
            if not report_serializer.is_valid():
                logger.error(f"Invalid service report data: {report_serializer.errors}")
                # Delete the service request if report creation fails
                service_request.delete()
                return Response(report_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            report_serializer.save(created_by=request.user)
        
        logger.info(f"Created service request: {service_request.id} (DIY: {is_diy})")
        return Response(ServiceRequestSerializer(service_request).data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error creating service request: {str(e)}")
        return Response(
            {"error": "Failed to create service request"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_service_requests(request):
    """List service requests based on user role"""
    try:
        # Staff users can see all service requests
        if request.user.is_staff and request.user.user_role == 'STAFF':
            requests = ServiceRequest.objects.all()
        # Property owners see their own requests
        elif request.user.user_role == 'PROPERTY_OWNER':
            requests = ServiceRequest.objects.filter(
                property__owner=request.user
            )
        # Service providers see requests assigned to them
        else:  # Service Provider
            provider = request.user.service_provider
            requests = ServiceRequest.objects.filter(provider=provider)
        
        # Apply filters
        # Status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            requests = requests.filter(status=status_filter)
            
        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            requests = requests.filter(created_at__gte=start_date)
        if end_date:
            requests = requests.filter(created_at__lte=end_date)
            
        # Location filter (city, state, zip)
        location = request.query_params.get('location')
        if location:
            requests = requests.filter(
                Q(property__city__icontains=location) |
                Q(property__state__icontains=location) |
                Q(property__zip_code__icontains=location)
            )
            
        # Category filter
        category = request.query_params.get('category')
        if category:
            requests = requests.filter(category=category)
        
        serializer = ServiceRequestSerializer(
            requests, 
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error listing service requests: {str(e)}")
        return Response(
            {"error": "Failed to retrieve service requests"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def service_request_detail(request, request_id):
    """Get or update service request details"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check permissions
        if not has_request_access(request.user, service_request):
            return Response(
                {"error": "You don't have permission to access this request"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.method == 'GET':
            serializer = ServiceRequestSerializer(
                service_request,
                context={'request': request}
            )
            return Response(serializer.data)
        
        elif request.method == 'PUT':
            logger.info(f"Service Request PUT data: {request.data}")
            serializer = ServiceRequestSerializer(
                service_request,
                data=request.data,
                partial=True,
                context={'request': request}
            )
            if serializer.is_valid():
                service_request = serializer.save()
                logger.info(f"Service request updated: {service_request.id}")
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error handling service request detail: {str(e)}")
        return Response(
            {"error": "Failed to process service request"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def start_service(request, request_id):
    """Start a scheduled service"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if user is the assigned provider
        if not is_assigned_provider(request.user, service_request):
            return Response(
                {"error": "Only the assigned provider can start the service"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        service_request.start_service()
        logger.info(f"Service started: {service_request.id}")
        return Response(ServiceRequestSerializer(service_request).data)
    
    except ValueError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error starting service: {str(e)}")
        return Response(
            {"error": "Failed to start service"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def complete_service(request, request_id):
    """Complete a service and create service report"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if user is the assigned provider
        if not is_assigned_provider(request.user, service_request):
            return Response(
                {"error": "Only the assigned provider can complete the service"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Complete the service
        service_request.complete_service()
        
        # Create service report
        report_data = request.data.get('report', {})
        report_data['service_request'] = service_request.id
        
        report_serializer = ServiceReportSerializer(
            data=report_data,
            context={'request': request}
        )
        if report_serializer.is_valid():
            report = report_serializer.save()
            logger.info(f"Service completed with report: {service_request.id}")
            return Response(
                ServiceRequestSerializer(service_request).data,
                status=status.HTTP_200_OK
            )
        return Response(report_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except ValueError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error completing service: {str(e)}")
        return Response(
            {"error": "Failed to complete service"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_review(request, request_id):
    """Create a review for a completed service"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if user is the property owner
        if service_request.property.owner != request.user:
            return Response(
                {"error": "Only the property owner can review the service"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if service is completed
        if service_request.status != ServiceRequest.Status.COMPLETED:
            return Response(
                {"error": "Can only review completed services"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if review already exists
        if hasattr(service_request, 'review'):
            return Response(
                {"error": "Service has already been reviewed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        review_data = request.data
        review_data['service_request'] = service_request.id
        
        serializer = ServiceReviewSerializer(
            data=review_data,
            context={'request': request}
        )
        if serializer.is_valid():
            review = serializer.save()
            logger.info(f"Review created for service: {service_request.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        return Response(
            {"error": "Failed to create review"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Bidding System Views
@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def submit_bid(request, request_id):
    """Submit or update a bid for a service request"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if provider has an existing bid
        existing_bid = ServiceBid.objects.filter(
            service_request=service_request,
            provider=request.user.service_provider
        ).first()
        
        # Prepare data for serializer
        data = {
            **request.data,
            'service_request': service_request.id,
            'provider': request.user.service_provider.id,
            'status': ServiceBid.Status.SUBMITTED
        }
        
        if existing_bid:
            serializer = ServiceBidSerializer(
                existing_bid,
                data=data,
                partial=True
            )
        else:
            serializer = ServiceBidSerializer(data=data)
        
        if serializer.is_valid():
            bid = serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error submitting bid: {str(e)}")
        return Response(
            {"error": "Failed to submit bid"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_bids(request, request_id):
    """
    List all bids for a service request with enhanced metadata for comparison.
    Phase 2: Enhanced with provider details and bid metadata for STAFF comparison table.
    """
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check access permissions
        if not has_request_access(request.user, service_request):
            return Response(
                {"error": "Not authorized to view bids"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Fetch bids with related data for efficiency
        bids = ServiceBid.objects.filter(
            service_request=service_request
        ).select_related('provider').order_by('-created_at')
        
        # Optional filtering by status
        status_filter = request.query_params.get('status')
        if status_filter:
            bids = bids.filter(status=status_filter)
        
        serializer = ServiceBidSerializer(bids, many=True)
        
        # Add summary metadata for STAFF users
        response_data = {
            'bids': serializer.data,
            'summary': {
                'total_bids': bids.count(),
                'submitted_bids': bids.filter(status=ServiceBid.Status.SUBMITTED).count(),
                'accepted_bids': bids.filter(status=ServiceBid.Status.ACCEPTED).count(),
                'has_selected_provider': service_request.selected_provider is not None,
                'selected_provider_id': str(service_request.selected_provider_id) if service_request.selected_provider else None
            }
        }
        
        logger.info(f"User {request.user.email} retrieved {bids.count()} bids for service request {service_request.id}")
        
        return Response(response_data)
    
    except Exception as e:
        logger.error(f"Error listing bids: {str(e)}")
        return Response(
            {"error": "Failed to retrieve bids"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def select_bid(request, request_id, bid_id):
    """
    Select a winning bid for a service request.
    Phase 2: Enhanced with status transition to ACCEPTED and timeline logging.
    """
    try:
        from services.models import TimelineEntry, TimelineEntryType
        
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        bid = get_object_or_404(ServiceBid, id=bid_id, service_request=service_request)
        
        # Check permissions: Property owner OR STAFF
        is_owner = request.user == service_request.property.owner
        is_staff = request.user.user_role == 'STAFF'
        
        if not (is_owner or is_staff):
            return Response(
                {"error": "Not authorized to select bid"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate bid is in correct status
        if bid.status not in [ServiceBid.Status.SUBMITTED, ServiceBid.Status.UPDATED]:
            return Response(
                {"error": f"Cannot select bid with status {bid.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store previous status for timeline
        previous_status = service_request.status
        
        # Optional: Select runner-up
        runner_up_id = request.data.get('runner_up_bid_id')
        if runner_up_id:
            runner_up_bid = get_object_or_404(ServiceBid, id=runner_up_id, service_request=service_request)
            service_request.runner_up_provider = runner_up_bid.provider
        
        # Update service request
        service_request.selected_provider = bid.provider
        service_request.status = ServiceRequest.Status.ACCEPTED
        service_request.save()
        
        # Update bid statuses
        ServiceBid.objects.filter(service_request=service_request).exclude(
            id=bid.id
        ).update(status=ServiceBid.Status.REJECTED)
        
        bid.status = ServiceBid.Status.ACCEPTED
        bid.save()
        
        # Create timeline entry for bid selection (Phase 2)
        timeline_content = (
            f"Bid accepted from {bid.provider.business_name}. "
            f"Amount: ${bid.amount}. "
            f"Proposed start: {bid.proposed_start_date.strftime('%Y-%m-%d') if bid.proposed_start_date else 'TBD'}."
        )
        
        TimelineEntry.objects.create(
            service_request=service_request,
            entry_type=TimelineEntryType.STATUS_CHANGE,
            content=timeline_content,
            metadata={
                'previous_status': previous_status,
                'new_status': ServiceRequest.Status.ACCEPTED,
                'bid_id': str(bid.id),
                'provider_id': str(bid.provider.id),
                'bid_amount': str(bid.amount),
                'action': 'bid_selected'
            },
            created_by=request.user
        )
        
        logger.info(
            f"User {request.user.email} selected bid {bid.id} from provider "
            f"{bid.provider.business_name} for service request {service_request.id}"
        )
        
        serializer = ServiceRequestSerializer(service_request)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error selecting bid: {str(e)}")
        return Response(
            {"error": "Failed to select bid"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def submit_clarification(request, request_id):
    """Submit a clarification question for a service request"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Prepare data for serializer
        data = {
            **request.data,
            'service_request': service_request.id,
            'question_by': request.user.service_provider.id
        }
        
        serializer = ServiceRequestClarificationSerializer(data=data)
        if serializer.is_valid():
            clarification = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error submitting clarification: {str(e)}")
        return Response(
            {"error": "Failed to submit clarification"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def respond_to_clarification(request, request_id, clarification_id):
    """Respond to a clarification question"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        clarification = get_object_or_404(
            ServiceRequestClarification,
            id=clarification_id
        )
        
        # Ensure user owns the property
        if not request.user == service_request.property.owner:
            return Response(
                {"error": "Not authorized to respond to clarification"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update clarification
        clarification.response = request.data.get('response')
        clarification.response_at = timezone.now()
        clarification.save()
        
        serializer = ServiceRequestClarificationSerializer(clarification)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error responding to clarification: {str(e)}")
        return Response(
            {"error": "Failed to respond to clarification"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def set_interest(request, request_id):
    """Set interest status for a service request"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Prepare data for serializer
        data = {
            **request.data,
            'service_request': service_request.id,
            'provider': request.user.service_provider_profile.id
        }
        
        # Check for existing interest
        interest = ServiceRequestInterest.objects.filter(
            service_request=service_request,
            provider__user=request.user
        ).first()
        
        if interest:
            serializer = ServiceRequestInterestSerializer(
                interest,
                data=data,
                partial=True
            )
        else:
            serializer = ServiceRequestInterestSerializer(data=data)
        
        if serializer.is_valid():
            interest = serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error setting interest: {str(e)}")
        return Response(
            {"error": "Failed to set interest"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def track_view(request, request_id):
    """Track when a provider views a service request"""
    try:
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Create view record
        ServiceRequestView.objects.create(
            service_request=service_request,
            provider=request.user.service_provider
        )
        
        return Response({"status": "view tracked"})
    
    except Exception as e:
        logger.error(f"Error tracking view: {str(e)}")
        return Response(
            {"error": "Failed to track view"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Helper Functions
def has_request_access(user, service_request):
    """Check if user has access to the service request"""
    # Service accounts have full access
    if hasattr(user, 'is_service_account') and user.is_service_account:
        return True
    # Staff users have access to all service requests
    if user.is_staff and user.user_role == 'STAFF':
        return True
    # Property owners have access to their own requests
    elif user.user_role == 'PROPERTY_OWNER':
        return service_request.property.owner == user
    else:  # Service Provider
        try:
            provider = user.service_provider
            return service_request.provider == provider
        except ServiceProvider.DoesNotExist:
            return False

def is_assigned_provider(user, service_request):
    """Check if user is the assigned provider for the service request"""
    try:
        return service_request.provider == user.service_provider
    except (ServiceProvider.DoesNotExist, AttributeError):
        return False
