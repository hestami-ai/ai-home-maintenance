from rest_framework import serializers
from .models import Notification, Message

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'notification_type',
            'content', 'is_read', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'conversation_id', 'sender', 'recipient',
            'content', 'message_type', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate_conversation_id(self, value):
        """Ensure conversation_id is a valid UUID."""
        try:
            str(value)
            return value
        except ValueError:
            raise serializers.ValidationError("Invalid conversation ID format")
