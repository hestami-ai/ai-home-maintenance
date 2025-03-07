from rest_framework import serializers
from .models import Property, PropertyAccess
from users.serializers import UserSerializer

class PropertySerializer(serializers.ModelSerializer):
    owner_details = UserSerializer(source='owner', read_only=True)
    media_count = serializers.SerializerMethodField()
    service_requests = serializers.SerializerMethodField()
    
    class Meta:
        model = Property
        fields = [
            'id', 'title', 'description', 'address', 'city',
            'state', 'zip_code', 'country', 'status',
            'created_at', 'updated_at', 'owner', 'owner_details',
            'media_count', 'descriptives', 'service_requests'
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
