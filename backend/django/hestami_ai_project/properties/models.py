from django.db import models
from django.conf import settings
import uuid

class PropertyStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    PENDING = 'PENDING', 'Pending'
    INACTIVE = 'INACTIVE', 'Inactive'
    ARCHIVED = 'ARCHIVED', 'Archived'

class Property(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_properties'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=PropertyStatus.choices,
        default=PropertyStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    descriptives = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name_plural = 'Properties'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['city', 'state']),
        ]
        permissions = [
            ('view_property_details', 'Can view property details'),
            ('manage_property_media', 'Can manage property media'),
            ('assign_property_services', 'Can assign property services'),
        ]

    def __str__(self):
        return f"{self.title} - {self.city}, {self.state}"

    def soft_delete(self):
        from django.utils import timezone
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.status = PropertyStatus.ARCHIVED
        self.save()

class PropertyScrapedData(models.Model):
    """
    Model to store raw and processed data from web scraping for properties.
    Multiple websites can be scraped for a single property.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='scraped_data'
    )
    source_name = models.CharField(
        max_length=255,
        help_text="Name of the source website (e.g., 'Yelp', 'Angi', 'HomeAdvisor')"
    )
    source_url = models.URLField(
        help_text="URL of the scraped page"
    )
    raw_html = models.TextField(
        help_text="Raw HTML content from web scraping"
    )
    processed_data = models.JSONField(
        default=dict,
        help_text="Processed structured data extracted from raw HTML"
    )
    scrape_status = models.CharField(
        max_length=50,
        choices=[
            ('pending', 'Pending'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending',
        help_text="Status of the scraping process"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Error message if scraping failed"
    )
    last_scraped_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp of when the data was last scraped"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-last_scraped_at']
        indexes = [
            models.Index(fields=['property', '-last_scraped_at']),
            models.Index(fields=['source_name']),
            models.Index(fields=['scrape_status']),
        ]
        unique_together = ['property', 'source_url']
    
    def __str__(self):
        return f"{self.source_name} data for {self.property.title}"

class PropertyAccess(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='access_permissions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='property_access'
    )
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    can_manage_media = models.BooleanField(default=False)
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='granted_access'
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Property Access Permissions'
        unique_together = ['property', 'user']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['property', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.property.title} Access"
