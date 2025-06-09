from rest_framework import serializers
from .models import Property, PropertyAccess, PropertyScrapedData, PermitHistory, PermitAttachment
from users.serializers import UserSerializer

class PropertySerializer(serializers.ModelSerializer):
    owner_details = UserSerializer(source='owner', read_only=True)
    media_count = serializers.SerializerMethodField()
    service_requests = serializers.SerializerMethodField()
    
    class Meta:
        model = Property
        fields = [
            'id', 'title', 'description', 'address', 'city',
            'state', 'zip_code', 'county', 'country', 'status',
            'created_at', 'updated_at', 'owner', 'owner_details',
            'media_count', 'descriptives', 'service_requests',
            'geocode_address', 'geocode_address_source',
            'permit_retrieval_status', 'permit_last_retrieved_at',
            'permit_retrieval_error', 'permit_next_retrieval_at',
            'permit_retrieval_workflow_id'
        ]
        read_only_fields = ['owner', 'created_at', 'updated_at']
    
    def get_media_count(self, obj):
        return obj.media.filter(is_deleted=False).count()

    def get_service_requests(self, obj):
        from services.serializers import ServiceRequestSerializer
        # Only serialize essential fields to avoid deep nesting
        return ServiceRequestSerializer(
            obj.service_requests.all(),
            many=True,
            context={'depth': 0}  # Add depth context to control nesting
        ).data
    
    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)

class PropertyAccessSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    property_details = PropertySerializer(source='property', read_only=True)
    
    class Meta:
        model = PropertyAccess
        fields = [
            'id', 'property', 'property_details', 'user', 'user_details',
            'can_view', 'can_edit', 'can_manage_media', 'granted_at',
            'granted_by', 'expires_at', 'is_active'
        ]
        read_only_fields = ['granted_at', 'granted_by']
    
    def create(self, validated_data):
        validated_data['granted_by'] = self.context['request'].user
        return super().create(validated_data)

class PropertyAccessUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyAccess
        fields = ['can_view', 'can_edit', 'can_manage_media', 'expires_at', 'is_active']

class PropertyScrapedDataSerializer(serializers.ModelSerializer):
    property_details = PropertySerializer(source='property', read_only=True)
    
    class Meta:
        model = PropertyScrapedData
        fields = [
            'id', 'property', 'property_details', 'source_name', 'source_url',
            'raw_html', 'processed_data', 'scrape_type', 'scrape_status', 'error_message',
            'last_scraped_at', 'created_at'
        ]
        read_only_fields = ['id', 'last_scraped_at', 'created_at']
    
    def validate(self, data):
        # Check if property exists
        if 'property' in data and not Property.objects.filter(id=data['property'].id).exists():
            raise serializers.ValidationError({'property': 'Property does not exist'})
        
        # Check for duplicate source_url for the same property
        if self.instance is None:  # Only for creation
            if PropertyScrapedData.objects.filter(
                property=data['property'],
                source_url=data['source_url']
            ).exists():
                raise serializers.ValidationError({
                    'source_url': 'Data for this URL has already been scraped for this property'
                })
        
        return data


class PermitAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for permit attachments with binary file data."""
    
    # Custom field to handle file upload and convert to binary
    file_upload = serializers.FileField(write_only=True, required=False)
    file_data_size = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PermitAttachment
        fields = [
            'id', 'permit_history', 'filename', 'file_type', 'file_size',
            'description', 'attachment_type', 'created_at', 'updated_at',
            'file_upload', 'file_data_size'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'file_size', 'file_data_size']
    
    def get_file_data_size(self, obj):
        """Return file size in a human-readable format."""
        if obj.file_size:
            if obj.file_size < 1024:
                return f"{obj.file_size} bytes"
            elif obj.file_size < 1024 * 1024:
                return f"{obj.file_size / 1024:.1f} KB"
            else:
                return f"{obj.file_size / (1024 * 1024):.1f} MB"
        return "Unknown"
    
    def create(self, validated_data):
        # Handle file upload if provided
        file_upload = validated_data.pop('file_upload', None)
        
        if file_upload:
            validated_data['filename'] = file_upload.name
            validated_data['file_type'] = file_upload.content_type or 'application/octet-stream'
            validated_data['file_size'] = file_upload.size
            validated_data['file_data'] = file_upload.read()
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Handle file upload if provided
        file_upload = validated_data.pop('file_upload', None)
        
        if file_upload:
            validated_data['filename'] = file_upload.name
            validated_data['file_type'] = file_upload.content_type or 'application/octet-stream'
            validated_data['file_size'] = file_upload.size
            validated_data['file_data'] = file_upload.read()
        
        return super().update(instance, validated_data)


class PermitAttachmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing attachments without binary data."""
    
    file_data_size = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PermitAttachment
        fields = [
            'id', 'filename', 'file_type', 'file_size', 'file_data_size',
            'description', 'attachment_type', 'created_at'
        ]
    
    def get_file_data_size(self, obj):
        """Return file size in a human-readable format."""
        if obj.file_size:
            if obj.file_size < 1024:
                return f"{obj.file_size} bytes"
            elif obj.file_size < 1024 * 1024:
                return f"{obj.file_size / 1024:.1f} KB"
            else:
                return f"{obj.file_size / (1024 * 1024):.1f} MB"
        return "Unknown"


class PermitHistorySerializer(serializers.ModelSerializer):
    """Serializer for permit history records."""
    
    property_details = serializers.SerializerMethodField(read_only=True)
    attachments = PermitAttachmentListSerializer(many=True, read_only=True)
    attachment_count = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PermitHistory
        fields = [
            'id', 'property', 'property_details', 'raw_permit_data',
            'permit_number', 'permit_type', 'permit_description', 'permit_status',
            'application_date', 'issued_date', 'expiration_date', 'completion_date',
            'contractor_name', 'contractor_license', 'estimated_cost',
            'source_name', 'source_url', 'extracted_fields',
            'created_at', 'updated_at', 'scraped_at',
            'attachments', 'attachment_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attachment_count']
    
    def get_property_details(self, obj):
        """Return lightweight property details to avoid deep nesting."""
        return {
            'id': obj.property.id,
            'title': obj.property.title,
            'address': obj.property.address,
            'city': obj.property.city,
            'state': obj.property.state
        }
    
    def get_attachment_count(self, obj):
        """Return count of attachments for this permit."""
        return obj.attachments.count()


class PermitHistoryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing permit history without heavy fields."""
    
    property_details = serializers.SerializerMethodField(read_only=True)
    attachment_count = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PermitHistory
        fields = [
            'id', 'property', 'property_details', 'permit_number', 'permit_type',
            'permit_description', 'permit_status', 'application_date', 'issued_date',
            'contractor_name', 'estimated_cost', 'source_name',
            'created_at', 'attachment_count'
        ]
    
    def get_property_details(self, obj):
        """Return lightweight property details."""
        return {
            'id': obj.property.id,
            'title': obj.property.title,
            'address': obj.property.address,
            'city': obj.property.city,
            'state': obj.property.state
        }
    
    def get_attachment_count(self, obj):
        """Return count of attachments for this permit."""
        return obj.attachments.count()


class PermitHistoryCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating permit history records."""
    
    class Meta:
        model = PermitHistory
        fields = [
            'property', 'raw_permit_data', 'permit_number', 'permit_type',
            'permit_description', 'permit_status', 'application_date', 'issued_date',
            'expiration_date', 'completion_date', 'contractor_name', 'contractor_license',
            'estimated_cost', 'source_name', 'source_url', 'extracted_fields', 'scraped_at'
        ]
    
    def validate(self, data):
        # Check if property exists
        if 'property' in data and not Property.objects.filter(id=data['property'].id).exists():
            raise serializers.ValidationError({'property': 'Property does not exist'})
        
        return data
