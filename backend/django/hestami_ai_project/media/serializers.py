from rest_framework import serializers
from .models import Media, MediaType, MediaSubType, LocationType, LocationSubType
from .utils import generate_secure_url
import magic
import os

class MediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    thumbnail_small_url = serializers.SerializerMethodField()
    thumbnail_medium_url = serializers.SerializerMethodField()
    thumbnail_large_url = serializers.SerializerMethodField()
    location_display = serializers.SerializerMethodField()
    media_type = serializers.ChoiceField(choices=MediaType.choices)
    media_sub_type = serializers.ChoiceField(choices=MediaSubType.choices)
    location_type = serializers.ChoiceField(choices=LocationType.choices, required=False, allow_blank=True)
    location_sub_type = serializers.ChoiceField(choices=LocationSubType.choices, required=False, allow_blank=True)
    parent_type = serializers.SerializerMethodField()
    processing_status = serializers.SerializerMethodField()
    is_ready = serializers.SerializerMethodField()
    
    class Meta:
        model = Media
        fields = [
            'id', 'property_ref', 'service_request', 'service_report',
            'report_photo_type', 'uploader', 'file', 'file_type',
            'file_size', 'title', 'description', 'upload_date',
            'file_url', 'thumbnail_small_url', 'thumbnail_medium_url', 
            'thumbnail_large_url', 'is_image', 'is_video', 'media_type',
            'media_sub_type', 'location_type', 'location_sub_type', 
            'location_display', 'parent_type', 'original_filename', 'mime_type',
            'processing_status', 'is_ready'
        ]
        read_only_fields = ['id', 'upload_date', 'file_url', 'thumbnail_small_url', 
                           'thumbnail_medium_url', 'thumbnail_large_url', 
                           'is_image', 'is_video', 'location_display',
                           'parent_type', 'processing_status', 'is_ready']

    def get_parent_type(self, obj):
        if obj.property_ref:
            return 'PROPERTY'
        elif obj.service_request:
            return 'SERVICE_REQUEST'
        elif obj.service_report:
            return 'SERVICE_REPORT'
        return None

    def get_file_url(self, obj):
        if obj.file:
            # Get relative path from the full file path
            relative_path = str(obj.file).replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        return None

    def get_thumbnail_small_url(self, obj):
        if obj.file and (obj.is_image):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_small_{name}{ext}")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)

        elif obj.file and (obj.is_video):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_small_{name}.jpg")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        return None

    def get_thumbnail_medium_url(self, obj):
        if obj.file and (obj.is_image):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_medium_{name}{ext}")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        
        elif obj.file and (obj.is_video):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_medium_{name}.jpg")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        return None

    def get_thumbnail_large_url(self, obj):
        if obj.file and (obj.is_image):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_large_{name}{ext}")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        
        elif obj.file and (obj.is_video):
            file_path = str(obj.file)
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
            name, ext = os.path.splitext(filename)
            thumbnail_path = os.path.join(directory, f"thumbnail_large_{name}.jpg")
            relative_path = thumbnail_path.replace('uploads/', '')
            return generate_secure_url(relative_path, 3600)
        return None
    
    def get_location_display(self, obj):
        """Return the human-readable location name."""
        if obj.location_sub_type:
            return LocationSubType(obj.location_sub_type).label
        return None
        
    def get_processing_status(self, obj):
        """Return the processing status of the media."""
        if not obj.metadata:
            return 'PENDING'
            
        # Check for scan status
        scan_status = obj.metadata.get('scan_status')
        if scan_status == 'SCANNING':
            return 'SCANNING'
        elif scan_status == 'FAILED':
            return 'FAILED'
            
        # If scan is complete but not safe, return REJECTED
        if scan_status == 'COMPLETED' and not obj.metadata.get('is_safe', True):
            return 'REJECTED'
            
        # Check for processing status
        processing_key = f'media_processing_{obj.id}'
        processing_status = obj.metadata.get('processing_status')
        
        if processing_status == 'processing':
            return 'PROCESSING'
        elif processing_status == 'failed':
            return 'PROCESSING_FAILED'
        elif processing_status == 'completed':
            return 'READY'
            
        # If we have thumbnails, it's probably ready
        if obj.metadata.get('thumbnails') or obj.metadata.get('video_info'):
            return 'READY'
            
        # Default status if we can't determine
        return 'PENDING'
    
    def get_is_ready(self, obj):
        """Return whether the media is ready for display."""
        # Media is ready if it's not deleted and processing status is READY
        if obj.is_deleted:
            return False
            
        status = self.get_processing_status(obj)
        return status == 'READY'

    def validate_file(self, value):
        # Get file size
        file_size = value.size
        
        # Check file size (e.g., 100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB in bytes
        if file_size > max_size:
            raise serializers.ValidationError(
                f"File too large. Size should not exceed {max_size/(1024*1024)}MB."
            )
        
        # Read file mime type
        file_mime = magic.from_buffer(value.read(1024), mime=True)
        value.seek(0)  # Reset file pointer
        
        # Validate file type
        allowed_types = {
            'image/jpeg', 'image/png', 'image/gif',
            'video/mp4', 'video/quicktime'
        }
        if file_mime not in allowed_types:
            raise serializers.ValidationError(
                f"Unsupported file type. Allowed types: {', '.join(allowed_types)}"
            )
        
        return value
    
    def validate(self, data):
        # Ensure only one parent is set
        parents = [
            'property_ref' in data,
            'service_request' in data,
            'service_report' in data
        ]
        if sum(parents) != 1:
            raise serializers.ValidationError(
                "Media must belong to exactly one parent (Property, ServiceRequest, or ServiceReport)"
            )

        # Validate report_photo_type
        if 'service_report' in data and not data.get('report_photo_type'):
            raise serializers.ValidationError(
                "report_photo_type must be set for service report media"
            )
        if data.get('report_photo_type') and 'service_report' not in data:
            raise serializers.ValidationError(
                "report_photo_type can only be set for service report media"
            )

        # Validate that location_sub_type matches location_type
        location_type = data.get('location_type')
        location_sub_type = data.get('location_sub_type')
        
        if location_type and location_sub_type:
            if not LocationSubType.validate_for_type(location_type, location_sub_type):
                raise serializers.ValidationError({
                    'location_sub_type': f'Invalid sub-type "{location_sub_type}" for location type "{location_type}"'
                })
        
        return data

    def create(self, validated_data):
        # Get file type using python-magic
        file = validated_data['file']
        file_mime = magic.from_buffer(file.read(1024), mime=True)
        file.seek(0)  # Reset file pointer
        
        # Set additional fields
        validated_data['file_type'] = file_mime
        validated_data['file_size'] = file.size
        validated_data['original_filename'] = file.name
        validated_data['mime_type'] = file_mime
        
        # Create the media object
        return super().create(validated_data)
