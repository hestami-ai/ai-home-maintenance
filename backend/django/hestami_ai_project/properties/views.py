from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
import logging

from .models import Property, PropertyAccess, PropertyStatus, PropertyScrapedData
from .serializers import PropertySerializer, PropertyAccessSerializer, PropertyAccessUpdateSerializer, PropertyScrapedDataSerializer

logger = logging.getLogger('security')

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_properties(request):
    """
    List properties based on user's role and access permissions.
    Property owners see their properties, service providers see properties they have access to.
    """
    try:
        # For property owners
        if request.user.user_role == 'PROPERTY_OWNER':
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
@authentication_classes([JWTAuthentication])
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
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_property(request, property_id):
    """
    Update property details. User must be owner or have edit permission.
    Supports both PUT and PATCH methods for full and partial updates.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check permissions
        if not has_property_access(request.user, property, 'edit'):
            return Response(
                {"error": "You don't have permission to edit this property"},
                status=status.HTTP_403_FORBIDDEN
            )
        
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
    Soft delete a property. Only available to property owner.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Only owner can delete
        if property.owner != request.user:
            return Response(
                {"error": "Only the property owner can delete this property"},
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
    Only property owner can grant access.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        
        # Check if user is property owner
        if property.owner != request.user:
            return Response(
                {"error": "Only the property owner can grant access"},
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
    Only property owner can update access permissions.
    """
    try:
        property = get_object_or_404(Property, id=property_id, is_deleted=False)
        access = get_object_or_404(PropertyAccess, id=access_id, property=property)
        
        # Check if user is property owner
        if property.owner != request.user:
            return Response(
                {"error": "Only the property owner can update access permissions"},
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
    """
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
