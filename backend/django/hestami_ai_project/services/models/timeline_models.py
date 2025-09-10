from django.db import models
from django.conf import settings
import uuid
from .base_models import ServiceRequest


class TimelineEntryType(models.TextChoices):
    STATUS_CHANGE = 'STATUS_CHANGE', 'Status Change'
    COMMENT = 'COMMENT', 'Comment'
    DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD', 'Document Upload'
    ESTIMATE_SUBMISSION = 'ESTIMATE_SUBMISSION', 'Estimate Submission'
    PAYMENT = 'PAYMENT', 'Payment'
    SCHEDULING = 'SCHEDULING', 'Scheduling'
    SYSTEM = 'SYSTEM', 'System'


class TimelineEntry(models.Model):
    """
    Base model for all timeline entries related to service requests.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='timeline_entries'
    )
    entry_type = models.CharField(
        max_length=50,
        choices=TimelineEntryType.choices,
        db_index=True
    )
    content = models.TextField(
        max_length=5000,  # 5,000 character limit as specified
        blank=True
    )
    metadata = models.JSONField(
        default=dict,
        help_text="Additional metadata specific to the entry type"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='timeline_entries'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_timeline_entries'
    )
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(
        default=False,
        help_text="Soft deletion flag"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service_request', '-created_at']),
            models.Index(fields=['entry_type']),
            models.Index(fields=['created_by']),
            models.Index(fields=['is_deleted']),
        ]
        verbose_name_plural = "Timeline Entries"

    def __str__(self):
        return f"{self.get_entry_type_display()} for {self.service_request.title}"


class CommentType(models.TextChoices):
    QUESTION = 'QUESTION', 'Question'
    UPDATE = 'UPDATE', 'Update'
    ISSUE = 'ISSUE', 'Issue'
    GENERAL = 'GENERAL', 'General'


class VisibilityType(models.TextChoices):
    ALL = 'ALL', 'All'
    PROPERTY_OWNER_ONLY = 'PROPERTY_OWNER_ONLY', 'Property Owner Only'
    PROVIDER_ONLY = 'PROVIDER_ONLY', 'Service Provider Only'
    STAFF_ONLY = 'STAFF_ONLY', 'Staff Only'


class TimelineComment(TimelineEntry):
    """
    Extended model for comment-type timeline entries with additional fields.
    """
    comment_type = models.CharField(
        max_length=50,
        choices=CommentType.choices,
        default=CommentType.GENERAL
    )
    visibility = models.CharField(
        max_length=50,
        choices=VisibilityType.choices,
        default=VisibilityType.ALL
    )
    is_edited = models.BooleanField(default=False)
    edit_history = models.JSONField(
        default=list,
        help_text="History of edits to this comment"
    )
    mentions = models.JSONField(
        default=list,
        help_text="Array of user IDs mentioned in this comment"
    )

    def save(self, *args, **kwargs):
        # Always set entry_type to COMMENT for TimelineComment instances
        self.entry_type = TimelineEntryType.COMMENT
        
        # If this is an update to an existing comment
        if self.pk and not self.is_edited:
            # Mark as edited
            self.is_edited = True
            
            # Get the original comment before changes
            original = TimelineComment.objects.get(pk=self.pk)
            
            # Add to edit history
            edit_record = {
                'content': original.content,
                'edited_at': original.updated_at.isoformat(),
                'edited_by': str(original.updated_by.id) if original.updated_by else None
            }
            self.edit_history.append(edit_record)
            
        super().save(*args, **kwargs)


class TimelineReadReceipt(models.Model):
    """
    Model to track when users have read timeline entries.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timeline_entry = models.ForeignKey(
        TimelineEntry,
        on_delete=models.CASCADE,
        related_name='read_receipts'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='timeline_read_receipts'
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['timeline_entry', 'user']
        indexes = [
            models.Index(fields=['timeline_entry', 'user']),
            models.Index(fields=['user', 'read_at']),
        ]

    def __str__(self):
        return f"{self.user.email} read {self.timeline_entry} at {self.read_at}"
