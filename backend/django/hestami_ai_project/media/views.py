from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum
from django.utils import timezone
from django.db import transaction
from .models import Media, MediaType, MediaSubType, LocationType, LocationSubType
from properties.models import Property, PropertyAccess
from services.models.base_models import ServiceRequest, ServiceReport
from .serializers import MediaSerializer, MediaMetadataUpdateSerializer
import logging
import os
from django.conf import settings
from django.core.cache import cache
from .utils import scan_file as scan_file_util

logger = logging.getLogger('security')

# Allowed file extensions for chat uploads (same as Media model)
ALLOWED_CHAT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'md', 'pdf', 'docx', 'txt', 'doc', 'usdz']

def has_property_access(user, property_id, permission):
    """
    Check if a user has access to manage media for a property.
    Returns True if:
    1. User is the property owner
    2. User has explicit media management permission through PropertyAccess
    3. User has the manage_property_media permission
    """
    try:
        # Get the property
        property_obj = Property.objects.get(id=property_id)
        
        # Check if user is the property owner
        if property_obj.owner == user:
            return True
            
        # Check if user has explicit access through PropertyAccess
        property_access = PropertyAccess.objects.filter(
            property=property_obj,
            user=user,
            is_active=True,
            can_manage_media=True
        ).exists()
        
        if property_access:
            return True
            
        # Check if user has the manage_property_media permission
        if user.has_perm('properties.manage_property_media'):
            return True
            
        return False
        
    except Property.DoesNotExist:
        return False
    except Exception as e:
        logger.error(f"Error checking property access: {str(e)}")
        return False


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def scan_media(request):
    """
    Scan a media file for viruses/malware without persisting to database.
    Used by SvelteKit proxy before forwarding files to LibreChat.
    
    Returns:
        - is_clean: boolean indicating if file passed virus scan
        - message: scan result message
        - filename: original filename (for reference)
        - content_type: MIME type of the file
    """
    try:
        logger.info(f"Received media scan request from user {request.user.id}")
        
        # Validate file exists
        if 'file' not in request.FILES:
            logger.error("No file found in scan request")
            return Response({
                'error': 'No file was submitted'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_file = request.FILES['file']
        filename = uploaded_file.name
        content_type = uploaded_file.content_type
        file_size = uploaded_file.size
        
        logger.info(f"Scanning file: {filename}, type: {content_type}, size: {file_size}")
        
        # Validate file extension
        ext = os.path.splitext(filename)[1].lower().lstrip('.')
        if ext not in ALLOWED_CHAT_EXTENSIONS:
            logger.warning(f"File extension not allowed: {ext}")
            return Response({
                'is_clean': False,
                'message': f'File type .{ext} is not allowed. Allowed types: {", ".join(ALLOWED_CHAT_EXTENSIONS)}',
                'filename': filename,
                'content_type': content_type
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (use Django settings)
        max_size = getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 104857600)  # 100MB default
        if file_size > max_size:
            logger.warning(f"File too large: {file_size} > {max_size}")
            return Response({
                'is_clean': False,
                'message': f'File size ({file_size} bytes) exceeds maximum allowed ({max_size} bytes)',
                'filename': filename,
                'content_type': content_type
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Reset file pointer to beginning before virus scan
        uploaded_file.seek(0)
        
        # Scan file for viruses
        from .virus_scan import scan_file
        
        logger.info(f"Starting virus scan for {filename}...")
        is_clean, scan_message = scan_file(uploaded_file)
        
        if not is_clean:
            logger.error(f"Virus detected in file {filename}: {scan_message}")
            return Response({
                'is_clean': False,
                'message': scan_message,
                'filename': filename,
                'content_type': content_type
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"File {filename} passed virus scan")
        
        return Response({
            'is_clean': True,
            'message': 'File passed virus scan',
            'filename': filename,
            'content_type': content_type,
            'file_size': file_size
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Error scanning media: {str(e)}")
        return Response({
            'error': 'Failed to scan media',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_media(request, property_id):
    """
    Upload media files for a specific property.
    Requires authentication and property ownership verification.
    """
    try:
        # Log incoming request data
        logger.info(f"Received media upload request for property {property_id}")
        logger.info(f"Request data: {request.data}")
        logger.info(f"Request FILES: {request.FILES}")

        # Add property and uploader to request data
        data = request.data.copy()
        data['property_ref'] = property_id
        data['uploader'] = request.user.id  # Changed from request.user to request.user.id
        
        # Check property access
        if not has_property_access(request.user, property_id, 'manage_media'):
            logger.warning(f"User {request.user.id} denied access to upload media for property {property_id}")
            return Response(
                {"error": "You don't have permission to manage media for this property"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate file exists
        if 'file' not in request.FILES:
            logger.error("No file found in request")
            return Response({
                'error': 'No file was submitted'
            }, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES['file']
        
        # Reset file pointer to beginning before virus scan
        uploaded_file.seek(0)
        
        # Scan file for viruses BEFORE saving to disk
        from .virus_scan import scan_file
        
        logger.info(f"Scanning file {uploaded_file.name} for viruses...")
        is_clean, scan_message = scan_file(uploaded_file)
        
        if not is_clean:
            logger.error(f"Virus detected in file {uploaded_file.name}: {scan_message}")
            return Response({
                'error': 'File failed virus scan',
                'details': {
                    'virus_name': scan_message,
                    'message': 'The uploaded file contains malicious content and has been rejected.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"File {uploaded_file.name} passed virus scan")
        
        # Reset file pointer after virus scan
        uploaded_file.seek(0)

        # Create media directories if they don't exist
        os.makedirs(os.path.join(settings.MEDIA_ROOT, 'properties', str(property_id)), exist_ok=True)
        
        # Create serializer and validate
        serializer = MediaSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            logger.error(f"Serializer validation failed: {serializer.errors}")
            return Response({
                'error': 'Invalid data provided',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        media = serializer.save()
        
        # Queue media processing task after transaction commits to ensure file is on disk
        def queue_processing():
            from .tasks import process_media_task
            task = process_media_task.delay(media.id)
            
            # Store initial task status in cache
            cache_key = f'media_processing_{media.id}'
            cache.set(cache_key, {
                'status': 'queued',
                'task_id': task.id
            }, timeout=3600)
        
        transaction.on_commit(queue_processing)
        
        logger.info(f"Media uploaded successfully by user {request.user.id} for property {property_id}")
        return Response({
            **serializer.data,
            'processing_status': 'queued'
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        logger.error(f"Error uploading media: {str(e)}")
        logger.error(f"Request data: {request.data}")
        logger.error(f"Request FILES: {request.FILES}")
        return Response({
            "error": "Failed to upload media",
            "details": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_property_media(request, property_id):
    """
    List all media files for a specific property.
    Requires authentication and property access verification.
    """
    try:
        media_files = Media.objects.filter(property_ref_id=property_id, is_deleted=False)
        serializer = MediaSerializer(media_files, many=True)
        return Response(serializer.data)
    
    except Exception as e:
        logger.error(f"Error listing media: {str(e)}")
        return Response({"error": "Failed to list media"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_media(request, media_id):
    """
    Soft delete a media file.
    Requires authentication and ownership verification.
    """
    try:
        media = get_object_or_404(Media, id=media_id)
        
        # Verify ownership
        if media.uploader != request.user:
            logger.warning(f"Unauthorized delete attempt for media {media_id} by user {request.user.id}")
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        # Soft delete
        media.is_deleted = True
        media.deleted_at = timezone.now()
        media.save()
        
        logger.info(f"Media {media_id} soft deleted by user {request.user.id}")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    except Exception as e:
        logger.error(f"Error deleting media: {str(e)}")
        return Response({"error": "Failed to delete media"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_media_metadata(request, media_id):
    """
    Update media metadata (title, description, media_type, location, etc.).
    Requires authentication and permission to manage media for the property.
    Does not allow updating file, uploader, or parent relationships.
    """
    try:
        media = get_object_or_404(Media, id=media_id, is_deleted=False)
        
        # Check access permission based on parent type
        if media.property_ref:
            # For property media, check property access
            if not has_property_access(request.user, media.property_ref.id, 'manage_media'):
                logger.warning(f"User {request.user.id} denied access to update media {media_id}")
                return Response(
                    {"error": "You don't have permission to update this media"},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif media.service_request:
            # For service request media, check if user is the requester or service provider
            if media.service_request.requester != request.user and media.uploader != request.user:
                logger.warning(f"User {request.user.id} denied access to update service request media {media_id}")
                return Response(
                    {"error": "You don't have permission to update this media"},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif media.service_report:
            # For service report media, check if user is the service provider
            if media.uploader != request.user:
                logger.warning(f"User {request.user.id} denied access to update service report media {media_id}")
                return Response(
                    {"error": "You don't have permission to update this media"},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # No parent relationship - only uploader can update
            if media.uploader != request.user:
                logger.warning(f"User {request.user.id} denied access to update orphaned media {media_id}")
                return Response(
                    {"error": "You don't have permission to update this media"},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Update metadata using serializer
        serializer = MediaMetadataUpdateSerializer(media, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Media {media_id} metadata updated by user {request.user.id}")
            
            # Return full media object with all fields
            full_serializer = MediaSerializer(media)
            return Response(full_serializer.data, status=status.HTTP_200_OK)
        
        logger.warning(f"Invalid data for media update {media_id}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error updating media metadata: {str(e)}")
        return Response(
            {"error": "Failed to update media metadata", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def media_stats(request, property_id):
    """
    Get media statistics for a specific property.
    Includes total count, total size, and counts by media type.
    """
    try:
        stats = Media.objects.filter(property_id=property_id, is_deleted=False).aggregate(
            total_count=Count('id'),
            total_size=Sum('file_size'),
            image_count=Count('id', filter={'file_type__startswith': 'image/'}),
            video_count=Count('id', filter={'file_type__startswith': 'video/'})
        )
        return Response(stats)
    
    except Exception as e:
        logger.error(f"Error getting media stats: {str(e)}")
        return Response({"error": "Failed to get media statistics"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def media_processing_status(request, media_id):
    """
    Check the processing status of a media file
    """
    try:
        media = get_object_or_404(Media, id=media_id)
        
        # Check access permission
        property = media.property
        if not has_property_access(request.user, property.id, 'view'):
            return Response(
                {"error": "You don't have permission to view this media"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get status from cache
        cache_key = f'media_processing_{media_id}'
        processing_info = cache.get(cache_key, {})
        
        if not processing_info:
            # If no cache entry exists, check if media has thumbnails
            if media.metadata.get('thumbnails'):
                processing_info = {
                    'status': 'completed',
                    'thumbnails': media.metadata.get('thumbnails', {}),
                    'video_info': media.metadata.get('video_info', {}) if media.is_video else None,
                    'exif': media.metadata.get('exif', {}) if media.is_image else None
                }
            else:
                processing_info = {'status': 'unknown'}
        
        # If task is still processing, get additional info from Celery
        if processing_info.get('status') in ['queued', 'processing'] and 'task_id' in processing_info:
            from celery.result import AsyncResult
            task_result = AsyncResult(processing_info['task_id'])
            
            # Update status based on Celery task state
            if task_result.state == 'FAILURE':
                processing_info['status'] = 'failed'
                processing_info['error'] = str(task_result.result)
            elif task_result.state in ['PENDING', 'STARTED']:
                processing_info['status'] = task_result.state.lower()
        
        return Response(processing_info)
    
    except Exception as e:
        logger.error(f"Error checking media processing status: {str(e)}")
        return Response(
            {"error": "Failed to check processing status"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_media_types(request):
    """
    Get all available media types and their subtypes.
    """
    try:
        # Format the response to include types and subtypes
        types = []
        subtypes = {}
        
        for media_type in MediaType.choices:
            type_value, type_label = media_type
            types.append({
                'value': type_value,
                'label': type_label
            })
            
            # For each media type, get its valid subtypes
            subtypes[type_value] = [
                {'value': subtype_value, 'label': subtype_label}
                for subtype_value, subtype_label in MediaSubType.choices
            ]
        
        return Response({
            'types': types,
            'subTypes': subtypes
        })
    except Exception as e:
        logger.error(f"Error fetching media types: {str(e)}")
        return Response(
            {'error': 'Failed to fetch media types'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_location_types(request):
    """
    Get all available location types and their subtypes.
    """
    try:
        # Format the response to include types and subtypes
        types = []
        subtypes = {}
        
        for location_type in LocationType.choices:
            type_value, type_label = location_type
            types.append({
                'value': type_value,
                'label': type_label
            })
            
            # For each location type, get its valid subtypes using the get_subtypes method
            location_subtypes = LocationType.get_subtypes(type_value)
            subtypes[type_value] = [
                {'value': subtype.value, 'label': subtype.label}
                for subtype in location_subtypes
            ]
        
        return Response({
            'types': types,
            'subTypes': subtypes
        })
    except Exception as e:
        logger.error(f"Error fetching location types: {str(e)}")
        return Response(
            {'error': 'Failed to fetch location types'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_service_request_media(request, request_id):
    """
    Upload media files for a specific service request.
    Requires authentication and service request access verification.
    """
    try:
        # Get the service request
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if user has access to the service request
        if not (service_request.property.owner == request.user or 
                service_request.provider == request.user or 
                request.user.has_perm('services.manage_service_requests')):
            return Response(
                {"error": "You don't have permission to upload media for this service request"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Process the uploaded file
        if 'file' not in request.FILES:
            return Response(
                {"error": "No file was uploaded"},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES['file']
        
        # Reset file pointer to beginning before virus scan
        uploaded_file.seek(0)
        
        # Scan file for viruses BEFORE saving to disk
        from .virus_scan import scan_file
        
        logger.info(f"Scanning file {uploaded_file.name} for viruses...")
        is_clean, scan_message = scan_file(uploaded_file)
        
        if not is_clean:
            logger.error(f"Virus detected in file {uploaded_file.name}: {scan_message}")
            return Response({
                'error': 'File failed virus scan',
                'details': {
                    'virus_name': scan_message,
                    'message': 'The uploaded file contains malicious content and has been rejected.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"File {uploaded_file.name} passed virus scan")
        
        # Reset file pointer after virus scan
        uploaded_file.seek(0)
        
        # Get file information
        file_type = uploaded_file.content_type.split('/')[0].upper()
        if file_type not in [MediaType.IMAGE, MediaType.VIDEO]:
            file_type = MediaType.FILE

        # Create media object for service request (no property_ref)
        media = Media.objects.create(
            file=uploaded_file,
            title=request.POST.get('title', uploaded_file.name),
            description=request.POST.get('description', ''),
            uploader=request.user,
            service_request=service_request,
            # Note: property_ref is NOT set - media belongs to service_request only
            file_type=file_type,
            file_size=uploaded_file.size,
            original_filename=uploaded_file.name,
            mime_type=uploaded_file.content_type,
            media_type=file_type
        )

        # Queue media processing (includes virus scan + thumbnails)
        def queue_processing():
            from .tasks import process_media_task
            process_media_task.delay(media.id)
        
        transaction.on_commit(queue_processing)

        return Response(
            MediaSerializer(media).data,
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        logger.error(f"Error uploading service request media: {str(e)}")
        return Response(
            {"error": "Failed to upload media"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_service_request_media(request, request_id):
    """
    List all media files for a specific service request.
    Requires authentication and service request access verification.
    """
    try:
        # Get the service request
        service_request = get_object_or_404(ServiceRequest, id=request_id)
        
        # Check if user has access to the service request
        if not (service_request.property.owner == request.user or 
                service_request.provider == request.user or 
                request.user.is_staff or
                request.user.has_perm('services.view_servicerequest')):
            logger.warning(f"User {request.user.id} denied access to view media for service request {request_id}")
            return Response(
                {"error": "You don't have permission to view media for this service request"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all non-deleted media files for this service request
        media_files = Media.objects.filter(service_request_id=request_id, is_deleted=False)
        serializer = MediaSerializer(media_files, many=True)
        return Response(serializer.data)
    
    except ServiceRequest.DoesNotExist:
        return Response({"error": "Service request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error listing service request media: {str(e)}")
        return Response({"error": "Failed to list media"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_service_report_media(request, report_id):
    """
    List all media files for a specific service report.
    Requires authentication and service report access verification.
    """
    try:
        # Get the service report
        service_report = get_object_or_404(ServiceReport, id=report_id)
        
        # Check if user has access to the service report
        if not (service_report.service_request.property.owner == request.user or 
                service_report.service_request.provider == request.user or 
                request.user.is_staff or
                request.user.has_perm('services.view_servicereport')):
            logger.warning(f"User {request.user.id} denied access to view media for service report {report_id}")
            return Response(
                {"error": "You don't have permission to view media for this service report"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all non-deleted media files for this service report
        media_files = Media.objects.filter(service_report_id=report_id, is_deleted=False)
        serializer = MediaSerializer(media_files, many=True)
        return Response(serializer.data)
    
    except ServiceReport.DoesNotExist:
        return Response({"error": "Service report not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error listing service report media: {str(e)}")
        return Response({"error": "Failed to list media"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_service_report_media(request, report_id):
    """
    Upload media files for a specific service report.
    Requires authentication and service report access verification.
    """
    try:
        # Get the service report
        service_report = get_object_or_404(ServiceReport, id=report_id)
        
        # Check if user has access to the service report
        if not (service_report.service_request.property.owner == request.user or 
                service_report.service_request.provider == request.user or 
                request.user.has_perm('services.manage_service_reports')):
            return Response(
                {"error": "You don't have permission to upload media for this service report"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Process the uploaded file
        if 'file' not in request.FILES:
            return Response(
                {"error": "No file was uploaded"},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES['file']
        
        # Reset file pointer to beginning before virus scan
        uploaded_file.seek(0)
        
        # Scan file for viruses BEFORE saving to disk
        from .virus_scan import scan_file
        
        logger.info(f"Scanning file {uploaded_file.name} for viruses...")
        is_clean, scan_message = scan_file(uploaded_file)
        
        if not is_clean:
            logger.error(f"Virus detected in file {uploaded_file.name}: {scan_message}")
            return Response({
                'error': 'File failed virus scan',
                'details': {
                    'virus_name': scan_message,
                    'message': 'The uploaded file contains malicious content and has been rejected.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"File {uploaded_file.name} passed virus scan")
        
        # Reset file pointer after virus scan
        uploaded_file.seek(0)
        
        # Get file information
        file_type = uploaded_file.content_type.split('/')[0].upper()
        if file_type not in [MediaType.IMAGE, MediaType.VIDEO]:
            file_type = MediaType.FILE

        # Create media object with property reference
        media = Media.objects.create(
            file=uploaded_file,
            title=request.POST.get('title', uploaded_file.name),
            description=request.POST.get('description', ''),
            uploader=request.user,
            service_report=service_report,
            property_ref=service_report.service_request.property,
            file_type=file_type,
            file_size=uploaded_file.size,
            original_filename=uploaded_file.name,
            mime_type=uploaded_file.content_type,
            media_type=file_type
        )

        # Queue media processing (includes virus scan + thumbnails)
        def queue_processing():
            from .tasks import process_media_task
            process_media_task.delay(media.id)
        
        transaction.on_commit(queue_processing)

        return Response(
            MediaSerializer(media).data,
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        logger.error(f"Error uploading service report media: {str(e)}")
        return Response(
            {"error": "Failed to upload media"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
