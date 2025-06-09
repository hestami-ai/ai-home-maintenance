from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from django.http import HttpResponse
import logging

from .models import Property, PropertyAccess, PropertyStatus, PropertyScrapedData, PermitHistory, PermitAttachment
from .serializers import (
    PropertySerializer, PropertyAccessSerializer, PropertyAccessUpdateSerializer, 
    PropertyScrapedDataSerializer, PermitHistorySerializer, PermitHistoryListSerializer,
    PermitHistoryCreateUpdateSerializer, PermitAttachmentSerializer, PermitAttachmentListSerializer
)

logger = logging.getLogger('security')

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_properties(request):
    """
    List properties based on user's role and access permissions.
    Property owners see their properties, service providers see properties they have access to.
    Staff users see all properties.
    """
    try:
        # For staff users - see all properties
        if request.user.is_staff and request.user.user_role == 'STAFF':
            properties = Property.objects.filter(is_deleted=False)
        # For property owners
        elif request.user.user_role == 'PROPERTY_OWNER':
            properties = Property.objects.filter(
                owner=request.user,
                is_deleted=False
            )
        # For service providers
        else:
            current_time = timezone.now()
            properties = Property.objects.filter(
                Q(access_permissions__user=request.user) &
                Q(access_permissions__is_active=True) &
                (
                    Q(access_permissions__expires_at__isnull=True) |
                    Q(access_permissions__expires_at__gt=current_time)
                ) &
                Q(is_deleted=False)
            ).distinct()
        
        serializer = PropertySerializer(properties, many=True, context={'request': request})
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error listing properties: {str(e)}")
        return Response(
            {"error": "Failed to retrieve properties"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def create_property(request):
    """
    Create a new property. Only available to property owners.
    """
    try:
        if request.user.user_role != 'PROPERTY_OWNER':
            return Response(
                {"error": "Only property owners can create properties"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PropertySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            property = serializer.save()
            logger.info(f"Property created: {property.id} by user {request.user.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error creating property: {str(e)}")
        return Response(
            {"error": "Failed to create property"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def property_detail(request, property_id):
    """
    Retrieve property details. User must be owner or have access permission.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check permissions
        if not has_property_access(request.user, property, 'view'):
            return Response(
                {"error": "You don't have permission to view this property"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PropertySerializer(property, context={'request': request})
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error retrieving property details: {str(e)}")
        return Response(
            {"error": "Failed to retrieve property details"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT', 'PATCH'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def update_property(request, property_id):
    """
    Update property details. User must be owner or have edit permission.
    Supports both PUT and PATCH methods for full and partial updates.
    Special fields like 'county' can only be updated by property owner, Hestami staff, or service accounts.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check basic edit permissions
        if not has_property_access(request.user, property, 'edit'):
            return Response(
                {"error": "You don't have permission to edit this property"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Use request.data directly
        serializer = PropertySerializer(
            property,
            data=request.data,
            partial=True,  # Always allow partial updates
            context={'request': request}
        )
        if serializer.is_valid():
            property = serializer.save()
            logger.info(f"Property updated: {property.id} by user {request.user.id}")
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error updating property: {str(e)}")
        return Response(
            {"error": "Failed to update property"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_property(request, property_id):
    """
    Soft delete a property. Only available to property owner or staff.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Only owner or staff can delete
        if property.owner != request.user and not (request.user.is_staff and request.user.user_role == 'STAFF'):
            return Response(
                {"error": "Only the property owner or staff can delete this property"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        property.soft_delete()
        logger.info(f"Property deleted: {property.id} by user {request.user.id}")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    except Exception as e:
        logger.error(f"Error deleting property: {str(e)}")
        return Response(
            {"error": "Failed to delete property"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def grant_property_access(request, property_id):
    """
    Grant access to a property for a service provider.
    Only property owner or staff can grant access.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check if user is property owner or staff
        if property.owner != request.user and not (request.user.is_staff and request.user.user_role == 'STAFF'):
            return Response(
                {"error": "Only the property owner or staff can grant access"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PropertyAccessSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            access = serializer.save(property=property)
            logger.info(
                f"Property access granted: {property.id} to user {access.user.id} "
                f"by user {request.user.id}"
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error granting property access: {str(e)}")
        return Response(
            {"error": "Failed to grant property access"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_property_access(request, property_id, access_id):
    """
    Update property access permissions.
    Only property owner or staff can update access permissions.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        access = get_object_or_404(PropertyAccess, id=access_id, property=property)
        
        # Check if user is property owner or staff
        if property.owner != request.user and not (request.user.is_staff and request.user.user_role == 'STAFF'):
            return Response(
                {"error": "Only the property owner or staff can update access permissions"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PropertyAccessUpdateSerializer(
            access,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            access = serializer.save()
            logger.info(
                f"Property access updated: {property.id} for user {access.user.id} "
                f"by user {request.user.id}"
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error updating property access: {str(e)}")
        return Response(
            {"error": "Failed to update property access"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def has_property_access(user, property, access_type='view'):
    """
    Check if user has specific access to a property.
    access_type can be 'view', 'edit', or 'manage_media'
    
    Special cases with full access:
    - Service accounts (user_role = SERVICE_ACCOUNT)
    - Staff users (is_staff = True and user_role = STAFF)
    - Property owners (property.owner = user)
    """
    # Service accounts have full access to all properties
    if hasattr(user, 'is_service_account') and user.is_service_account:
        logger.debug(f"Service account {user.email} granted {access_type} access to property {property.id}")
        return True
        
    # Staff users have access to all properties
    if user.is_staff and user.user_role == 'STAFF':
        return True
    
    # Property owner has all access
    if property.owner == user:
        return True
    
    # Check property access permissions
    current_time = timezone.now()
    access = PropertyAccess.objects.filter(
        property=property,
        user=user,
        is_active=True
    ).filter(
        Q(expires_at__isnull=True) |
        Q(expires_at__gt=current_time)
    ).first()
    
    if not access:
        return False
    
    if access_type == 'view':
        return access.can_view
    elif access_type == 'edit':
        return access.can_edit
    elif access_type == 'manage_media':
        return access.can_manage_media
    
    return False


@api_view(['POST'])
@authentication_classes([ServiceTokenAuthentication])
def create_property_scraped_data(request, property_id):
    """
    Create a new property scraped data entry.
    This endpoint allows remote services to post scraped data for properties.
    
    Authentication: Requires a service token in the Authorization header.
    Format: Authorization: Token <service_token>
    
    Required fields:
    - source_name: Name of the source website
    - source_url: URL of the scraped page
    - raw_html: Raw HTML content from web scraping
    
    Optional fields:
    - processed_data: JSON data extracted from the raw HTML
    - scrape_status: Status of the scraping process (default: 'completed')
    - error_message: Error message if scraping failed
    """
    try:
        # Verify this is a service account
        if not request.user.is_service_account:
            logger.warning(f"Non-service account {request.user.email} attempted to access service-only endpoint")
            return Response(
                {"error": "This endpoint is only available to service accounts"},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Set scrape_status to 'completed' by default if not provided
        if 'scrape_status' not in request.data:
            request.data['scrape_status'] = 'completed'
        
        # Get the property from the URL path parameter
        property_obj = get_object_or_404(Property, id=property_id)
        
        # Check for required fields
        required_fields = ['source_name', 'source_url', 'raw_html']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {"error": f"{field} is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        # Initialize processed_data if not provided
        if 'processed_data' not in request.data:
            request.data['processed_data'] = {}
        
        # Create or update the scraped data
        try:
            # Check if entry already exists for this property and source_url
            existing_data = PropertyScrapedData.objects.filter(
                property=property_obj,
                source_url=request.data['source_url']
            ).first()
            
            if existing_data:
                # Update existing entry
                serializer = PropertyScrapedDataSerializer(
                    existing_data,
                    data=request.data,
                    partial=True
                )
                status_code = status.HTTP_200_OK
                log_message = f"Updated scraped data for property {property_id} from {request.data['source_name']}"
            else:
                # Create new entry
                # Add property to the data
                request.data['property'] = property_id
                serializer = PropertyScrapedDataSerializer(data=request.data)
                status_code = status.HTTP_201_CREATED
                log_message = f"Created new scraped data for property {property_id} from {request.data['source_name']}"
            
            if serializer.is_valid():
                scraped_data = serializer.save()
                logger.info(log_message)
                return Response(serializer.data, status=status_code)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error processing scraped data: {str(e)}")
            return Response(
                {"error": f"Failed to process scraped data: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    except Exception as e:
        logger.error(f"Error creating property scraped data: {str(e)}")
        return Response(
            {"error": "Failed to create property scraped data"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# PERMIT HISTORY VIEWS
# ============================================================================

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_permit_history(request, property_id=None):
    """
    List permit history records.
    If property_id is provided, filter by property.
    Uses same access patterns as properties.
    """
    try:
        # If property_id is provided, filter by property and check access
        if property_id:
            property_obj = get_object_or_404(Property, id=property_id, is_deleted=False)
            
            # Check permissions
            if not has_property_access(request.user, property_obj, 'view'):
                return Response(
                    {"error": "You don't have permission to view permit history for this property"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            permits = PermitHistory.objects.filter(property=property_obj)
        else:
            # List permits for all properties user has access to
            # For staff users - see all permits
            if request.user.is_staff and request.user.user_role == 'STAFF':
                permits = PermitHistory.objects.all()
            # For property owners
            elif request.user.user_role == 'PROPERTY_OWNER':
                permits = PermitHistory.objects.filter(
                    property__owner=request.user,
                    property__is_deleted=False
                )
            # For service providers
            else:
                current_time = timezone.now()
                permits = PermitHistory.objects.filter(
                    Q(property__access_permissions__user=request.user) &
                    Q(property__access_permissions__is_active=True) &
                    (
                        Q(property__access_permissions__expires_at__isnull=True) |
                        Q(property__access_permissions__expires_at__gt=current_time)
                    ) &
                    Q(property__is_deleted=False)
                ).distinct()
        
        # Order by most recent first
        permits = permits.order_by('-created_at')
        
        # Use lightweight serializer for listing
        serializer = PermitHistoryListSerializer(permits, many=True)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error listing permit history: {str(e)}")
        return Response(
            {"error": "Failed to retrieve permit history"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_permit_history(request, property_id):
    """
    Create a new permit history record for a property.
    Service accounts and users with edit access can create permits.
    """
    try:
        property_obj = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check permissions - need edit access or be service account
        if not (request.user.is_service_account or 
                has_property_access(request.user, property_obj, 'edit') or
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to create permit history for this property"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Add property to the data
        data = request.data.copy()
        data['property'] = property_id
        
        serializer = PermitHistoryCreateUpdateSerializer(data=data)
        if serializer.is_valid():
            permit = serializer.save()
            logger.info(f"Permit history created: {permit.id} for property {property_id} by user {request.user.id}")
            
            # Return full details
            response_serializer = PermitHistorySerializer(permit)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error creating permit history: {str(e)}")
        return Response(
            {"error": "Failed to create permit history"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def permit_history_detail(request, permit_id):
    """
    Retrieve permit history details.
    User must have access to the associated property.
    """
    try:
        permit = get_object_or_404(PermitHistory, id=permit_id)
        
        # Check permissions
        if not has_property_access(request.user, permit.property, 'view'):
            return Response(
                {"error": "You don't have permission to view this permit history"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PermitHistorySerializer(permit)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error retrieving permit history: {str(e)}")
        return Response(
            {"error": "Failed to retrieve permit history"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT', 'PATCH'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def update_permit_history(request, permit_id):
    """
    Update permit history record.
    User must have edit access to the associated property.
    """
    try:
        permit = get_object_or_404(PermitHistory, id=permit_id)
        
        # Check permissions - need edit access or be service account
        if not (request.user.is_service_account or 
                has_property_access(request.user, permit.property, 'edit') or
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to update this permit history"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        partial = request.method == 'PATCH'
        serializer = PermitHistoryCreateUpdateSerializer(permit, data=request.data, partial=partial)
        
        if serializer.is_valid():
            permit = serializer.save()
            logger.info(f"Permit history updated: {permit.id} by user {request.user.id}")
            
            # Return full details
            response_serializer = PermitHistorySerializer(permit)
            return Response(response_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error updating permit history: {str(e)}")
        return Response(
            {"error": "Failed to update permit history"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_permit_history(request, permit_id):
    """
    Delete permit history record.
    Only staff or service accounts can delete permits.
    """
    try:
        permit = get_object_or_404(PermitHistory, id=permit_id)
        
        # Check permissions - only staff or service accounts can delete
        if not (request.user.is_service_account or 
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to delete permit history"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        permit_id_str = str(permit.id)
        property_id_str = str(permit.property.id)
        permit.delete()
        
        logger.info(f"Permit history deleted: {permit_id_str} from property {property_id_str} by user {request.user.id}")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    except Exception as e:
        logger.error(f"Error deleting permit history: {str(e)}")
        return Response(
            {"error": "Failed to delete permit history"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================================
# PERMIT ATTACHMENT VIEWS
# ============================================================================

@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_permit_attachments(request, permit_id):
    """
    List attachments for a permit history record.
    User must have access to the associated property.
    """
    try:
        permit = get_object_or_404(PermitHistory, id=permit_id)
        
        # Check permissions
        if not has_property_access(request.user, permit.property, 'view'):
            return Response(
                {"error": "You don't have permission to view attachments for this permit"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        attachments = permit.attachments.all().order_by('-created_at')
        serializer = PermitAttachmentListSerializer(attachments, many=True)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error listing permit attachments: {str(e)}")
        return Response(
            {"error": "Failed to retrieve permit attachments"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_permit_attachment(request, permit_id):
    """
    Create a new attachment for a permit history record.
    User must have edit access to the associated property.
    """
    try:
        permit = get_object_or_404(PermitHistory, id=permit_id)
        
        # Check permissions - need edit access or be service account
        if not (request.user.is_service_account or 
                has_property_access(request.user, permit.property, 'edit') or
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to add attachments to this permit"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Add permit_history to the data
        data = request.data.copy()
        data['permit_history'] = permit_id
        
        serializer = PermitAttachmentSerializer(data=data)
        if serializer.is_valid():
            attachment = serializer.save()
            logger.info(f"Permit attachment created: {attachment.id} for permit {permit_id} by user {request.user.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error creating permit attachment: {str(e)}")
        return Response(
            {"error": "Failed to create permit attachment"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def permit_attachment_detail(request, attachment_id):
    """
    Retrieve permit attachment details.
    User must have access to the associated property.
    """
    try:
        attachment = get_object_or_404(PermitAttachment, id=attachment_id)
        
        # Check permissions
        if not has_property_access(request.user, attachment.permit_history.property, 'view'):
            return Response(
                {"error": "You don't have permission to view this attachment"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PermitAttachmentSerializer(attachment)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error retrieving permit attachment: {str(e)}")
        return Response(
            {"error": "Failed to retrieve permit attachment"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def download_permit_attachment(request, attachment_id):
    """
    Download the binary file data for a permit attachment.
    User must have access to the associated property.
    """
    try:
        attachment = get_object_or_404(PermitAttachment, id=attachment_id)
        
        # Check permissions
        if not has_property_access(request.user, attachment.permit_history.property, 'view'):
            return Response(
                {"error": "You don't have permission to download this attachment"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create HTTP response with binary data
        response = HttpResponse(
            attachment.file_data,
            content_type=attachment.file_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
        response['Content-Length'] = str(attachment.file_size)
        
        logger.info(f"Permit attachment downloaded: {attachment.id} by user {request.user.id}")
        return response
    
    except Exception as e:
        logger.error(f"Error downloading permit attachment: {str(e)}")
        return Response(
            {"error": "Failed to download permit attachment"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT', 'PATCH'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def update_permit_attachment(request, attachment_id):
    """
    Update permit attachment metadata or file.
    User must have edit access to the associated property.
    """
    try:
        attachment = get_object_or_404(PermitAttachment, id=attachment_id)
        
        # Check permissions - need edit access or be service account
        if not (request.user.is_service_account or 
                has_property_access(request.user, attachment.permit_history.property, 'edit') or
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to update this attachment"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        partial = request.method == 'PATCH'
        serializer = PermitAttachmentSerializer(attachment, data=request.data, partial=partial)
        
        if serializer.is_valid():
            attachment = serializer.save()
            logger.info(f"Permit attachment updated: {attachment.id} by user {request.user.id}")
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error updating permit attachment: {str(e)}")
        return Response(
            {"error": "Failed to update permit attachment"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_permit_attachment(request, attachment_id):
    """
    Delete permit attachment.
    Only staff or service accounts can delete attachments.
    """
    try:
        attachment = get_object_or_404(PermitAttachment, id=attachment_id)
        
        # Check permissions - only staff or service accounts can delete
        if not (request.user.is_service_account or 
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to delete permit attachments"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        attachment_id_str = str(attachment.id)
        permit_id_str = str(attachment.permit_history.id)
        attachment.delete()
        
        logger.info(f"Permit attachment deleted: {attachment_id_str} from permit {permit_id_str} by user {request.user.id}")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    except Exception as e:
        logger.error(f"Error deleting permit attachment: {str(e)}")
        return Response(
            {"error": "Failed to delete permit attachment"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated])
def update_property_permit_status(request, property_id):
    """
    Update property permit retrieval status and related fields.
    This endpoint is used by Temporal workflows to track permit retrieval progress.
    
    Authentication: Requires service token or staff access.
    
    Request body should contain:
    - permit_retrieval_status: Status (NEVER_ATTEMPTED, IN_PROGRESS, COMPLETED, FAILED, SCHEDULED)
    - permit_last_retrieved_at: (optional) ISO datetime string for successful retrieval
    - permit_retrieval_error: (optional) Error message for failed attempts
    - permit_next_retrieval_at: (optional) ISO datetime string for next retry
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check permissions - service accounts or staff can update permit status
        if not (request.user.is_service_account or 
                (request.user.is_staff and request.user.user_role == 'STAFF')):
            return Response(
                {"error": "You don't have permission to update permit status"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Extract permit status fields from request
        permit_data = {}
        
        if 'permit_retrieval_status' in request.data:
            permit_data['permit_retrieval_status'] = request.data['permit_retrieval_status']
        
        if 'permit_last_retrieved_at' in request.data:
            # If it's a string, try to parse it as ISO format
            if isinstance(request.data['permit_last_retrieved_at'], str):
                from dateutil import parser
                permit_data['permit_last_retrieved_at'] = parser.isoparse(request.data['permit_last_retrieved_at'])
            else:
                permit_data['permit_last_retrieved_at'] = request.data['permit_last_retrieved_at']
        
        if 'permit_retrieval_error' in request.data:
            permit_data['permit_retrieval_error'] = request.data['permit_retrieval_error']
        
        if 'permit_next_retrieval_at' in request.data:
            # If it's a string, try to parse it as ISO format
            if isinstance(request.data['permit_next_retrieval_at'], str):
                from dateutil import parser
                permit_data['permit_next_retrieval_at'] = parser.isoparse(request.data['permit_next_retrieval_at'])
            else:
                permit_data['permit_next_retrieval_at'] = request.data['permit_next_retrieval_at']
        
        # Update the property
        for field, value in permit_data.items():
            setattr(property, field, value)
        
        property.save()
        
        logger.info(f"Property permit status updated: {property.id} by user {request.user.id}")
        
        # Return the updated permit status fields
        response_data = {
            'id': property.id,
            'permit_retrieval_status': property.permit_retrieval_status,
            'permit_last_retrieved_at': property.permit_last_retrieved_at,
            'permit_retrieval_error': property.permit_retrieval_error,
            'permit_next_retrieval_at': property.permit_next_retrieval_at,
            'permit_retrieval_workflow_id': property.permit_retrieval_workflow_id,
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error updating property permit status: {str(e)}")
        return Response(
            {"error": "Failed to update property permit status"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
