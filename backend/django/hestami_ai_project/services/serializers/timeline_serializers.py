from rest_framework import serializers
from django.contrib.auth import get_user_model
from ..models.timeline_models import TimelineEntry, TimelineComment, TimelineReadReceipt, TimelineEntryType, CommentType, VisibilityType
from ..models.base_models import ServiceRequest

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    """Simplified user serializer for timeline entries"""
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'user_role']


class TimelineEntrySerializer(serializers.ModelSerializer):
    """Base serializer for timeline entries"""
    created_by = UserBriefSerializer(read_only=True)
    updated_by = UserBriefSerializer(read_only=True)
    read_status = serializers.SerializerMethodField()
    
    class Meta:
        model = TimelineEntry
        fields = [
            'id', 'service_request', 'entry_type', 'content', 'metadata',
            'created_by', 'created_at', 'updated_by', 'updated_at',
            'is_deleted', 'read_status'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'read_status']
    
    def get_read_status(self, obj):
        """Get read status for the current user"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
            
        read_receipt = obj.read_receipts.filter(user=request.user).first()
        return {
            'is_read': read_receipt is not None,
            'read_at': read_receipt.read_at if read_receipt else None
        }
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            validated_data['updated_by'] = request.user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)


class TimelineCommentSerializer(TimelineEntrySerializer):
    """Serializer for comment-type timeline entries"""
    
    class Meta(TimelineEntrySerializer.Meta):
        model = TimelineComment
        fields = TimelineEntrySerializer.Meta.fields + [
            'comment_type', 'visibility', 'is_edited', 'edit_history', 'mentions'
        ]
        read_only_fields = TimelineEntrySerializer.Meta.read_only_fields + [
            'is_edited', 'edit_history'
        ]
    
    def create(self, validated_data):
        # Always set entry_type to COMMENT for TimelineComment instances
        validated_data['entry_type'] = TimelineEntryType.COMMENT
        return super().create(validated_data)


class TimelineReadReceiptSerializer(serializers.ModelSerializer):
    """Serializer for timeline entry read receipts"""
    
    class Meta:
        model = TimelineReadReceipt
        fields = ['id', 'timeline_entry', 'user', 'read_at']
        read_only_fields = ['id', 'read_at', 'user']
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        return super().create(validated_data)


class TimelineEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating timeline entries"""
    
    class Meta:
        model = TimelineEntry
        fields = ['service_request', 'entry_type', 'content', 'metadata']
    
    def validate_service_request(self, value):
        """Validate that the service request exists and user has permission"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required")
            
        # Check if user has permission to add entries to this service request
        user = request.user
        if user.user_role == 'PROPERTY_OWNER':
            # Property owners can only add entries to their own requests
            if value.property.owner != user:
                raise serializers.ValidationError("You don't have permission to add entries to this service request")
        elif user.user_role == 'SERVICE_PROVIDER':
            # Service providers can only add entries to requests assigned to them
            if value.provider and value.provider.user != user:
                raise serializers.ValidationError("You don't have permission to add entries to this service request")
        elif not user.is_staff:
            raise serializers.ValidationError("You don't have permission to add entries to this service request")
            
        return value


class TimelineCommentCreateSerializer(TimelineEntryCreateSerializer):
    """Serializer for creating comment-type timeline entries"""
    comment_type = serializers.ChoiceField(choices=CommentType.choices, default=CommentType.GENERAL)
    visibility = serializers.ChoiceField(choices=VisibilityType.choices, default=VisibilityType.ALL)
    mentions = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    
    class Meta(TimelineEntryCreateSerializer.Meta):
        fields = TimelineEntryCreateSerializer.Meta.fields + ['comment_type', 'visibility', 'mentions']
    
    def create(self, validated_data):
        # Extract comment-specific fields
        comment_type = validated_data.pop('comment_type', CommentType.GENERAL)
        visibility = validated_data.pop('visibility', VisibilityType.ALL)
        mentions = validated_data.pop('mentions', [])
        
        # Always set entry_type to COMMENT
        validated_data['entry_type'] = TimelineEntryType.COMMENT
        
        # Create the TimelineComment instance
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            validated_data['updated_by'] = request.user
            
        comment = TimelineComment.objects.create(
            **validated_data,
            comment_type=comment_type,
            visibility=visibility,
            mentions=mentions
        )
        
        return comment


class UnreadCountSerializer(serializers.Serializer):
    """Serializer for unread entries count"""
    service_request = serializers.UUIDField()
    unread_count = serializers.IntegerField(read_only=True)
