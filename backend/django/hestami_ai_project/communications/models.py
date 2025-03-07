from django.db import models
from django.conf import settings
import uuid

# Create your models here.

class NotificationType(models.TextChoices):
    SERVICE_REQUEST = 'SERVICE_REQUEST', 'Service Request'
    AGENT_UPDATE = 'AGENT_UPDATE', 'Agent Update'
    SYSTEM = 'SYSTEM', 'System'

class MessageType(models.TextChoices):
    AGENT_MESSAGE = 'AGENT_MESSAGE', 'Agent Message'
    USER_MESSAGE = 'USER_MESSAGE', 'User Message'
    SYSTEM_MESSAGE = 'SYSTEM_MESSAGE', 'System Message'

class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_notifications'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_notifications'
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['notification_type']),
        ]

    def __str__(self):
        return f"{self.notification_type} for {self.recipient} at {self.created_at}"

class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation_id = models.UUIDField(db_index=True)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages'
    )
    content = models.TextField()
    message_type = models.CharField(
        max_length=50,
        choices=MessageType.choices,
        default=MessageType.USER_MESSAGE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation_id', 'created_at']),
            models.Index(fields=['sender', 'recipient']),
            models.Index(fields=['message_type']),
        ]

    def __str__(self):
        return f"Message from {self.sender} to {self.recipient} at {self.created_at}"
