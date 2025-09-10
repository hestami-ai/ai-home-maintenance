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
    county = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100)
    geocode_address = models.JSONField(
        default=dict, 
        blank=True, 
        help_text="Structured address data from geocoding service"
    )
    geocode_address_source = models.CharField(
        max_length=50, 
        blank=True, 
        null=True,
        help_text="Source service used for geocoding (e.g., 'AZURE_MAPS')"
    )
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

    # Permit retrieval status tracking
    permit_retrieval_status = models.CharField(
        max_length=20,
        choices=[
            ('NEVER_ATTEMPTED', 'Never Attempted'),
            ('IN_PROGRESS', 'In Progress'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed'),
            ('SCHEDULED', 'Scheduled'),
        ],
        default='NEVER_ATTEMPTED',
        help_text="Status of permit history retrieval process"
    )
    
    permit_last_retrieved_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Timestamp of last successful permit retrieval"
    )
    permit_retrieval_error = models.TextField(
        blank=True, 
        null=True,
        help_text="Error message from last failed permit retrieval attempt"
    )
    permit_next_retrieval_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Scheduled timestamp for next permit retrieval attempt"
    )
    permit_retrieval_workflow_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Temporal workflow ID for permit retrieval process"
    )

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

    # Soft delete instead of hard delete
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
    source_url = models.TextField(
        help_text="URL of the scraped page - stored as TextField to handle longer URLs"
    )
    tracking_id = models.CharField(
        max_length=255,  # Enough for two UUID strings plus separator
        blank=True,
        null=True,
        help_text="Tracking ID for linking related scrapes, can contain two UUID-length values",
        db_index=True  # Add index for faster lookups
    )
    raw_html = models.TextField(
        help_text="Raw HTML content from web scraping"
    )
    processed_data = models.JSONField(
        default=dict,
        help_text="Processed structured data extracted from raw HTML"
    )
    scrape_type = models.CharField(
        max_length=50,
        choices=[
            ('PERMIT_HISTORY', 'Permit History'),
            ('PROPERTY_DETAILS', 'Property Details'),
            ('SERVICE_REVIEWS', 'Service Reviews'),
            ('RAW_CONTENT', 'Raw Web Content'),
            ('OTHER', 'Other'),
        ],
        default='RAW_CONTENT',
        help_text="Type of data scraped, indicating how it should be processed."
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
    processed_status = models.CharField(
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


class PermitHistoryStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    DENIED = 'DENIED', 'Denied'
    EXPIRED = 'EXPIRED', 'Expired'
    CANCELLED = 'CANCELLED', 'Cancelled'
    ACTIVE = 'ACTIVE', 'Active'
    COMPLETED = 'COMPLETED', 'Completed'
    UNKNOWN = 'UNKNOWN', 'Unknown'
    FAILED_RETRIEVAL = 'FAILED_RETRIEVAL', 'Failed Retrieval'


class PermitHistory(models.Model):
    """
    Model to store property permit history data including raw data, 
    extracted fields, and attachments from web scraping workflows.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='permit_history'
    )
    
    # Raw permit data from scraping
    raw_permit_data = models.JSONField(
        default=dict,
        help_text="Raw permit data from web scraping source"
    )
    
    # Extracted/structured permit fields
    permit_number = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Official permit number"
    )
    permit_type = models.CharField(
        max_length=255,
        blank=True,
        null=True, 
        help_text="Type of permit (e.g., Building, Electrical, Plumbing, etc.)"
    )
    permit_description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the permit work"
    )
    permit_status = models.CharField(
        max_length=20,
        choices=PermitHistoryStatus.choices,
        default=PermitHistoryStatus.UNKNOWN,
        help_text="Current status of the permit"
    )
    application_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date the permit application was submitted"
    )
    issued_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date the permit was issued"
    )
    expiration_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date the permit expires"
    )
    completion_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date the permit work was completed"
    )
    contractor_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of the contractor for the permit"
    )
    contractor_license = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="License number of the contractor"
    )
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Estimated cost of the permit work"
    )
    
    # Data source information
    source_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of the data source (e.g., county website, permit portal)"
    )
    source_url = models.URLField(
        blank=True,
        null=True,
        help_text="URL where the permit data was scraped from"
    )
    
    # Additional structured data
    extracted_fields = models.JSONField(
        default=dict,
        help_text="Additional extracted fields that don't fit standard schema"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    scraped_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When this permit data was originally scraped"
    )

    class Meta:
        verbose_name_plural = 'Permit History'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['property', '-created_at']),
            models.Index(fields=['permit_number']),
            models.Index(fields=['permit_type']),
            models.Index(fields=['permit_status']),
            models.Index(fields=['source_name']),
            models.Index(fields=['application_date']),
            models.Index(fields=['issued_date']),
        ]
        permissions = [
            ('view_permit_history', 'Can view permit history'),
            ('manage_permit_history', 'Can manage permit history'),
        ]

    def __str__(self):
        permit_display = self.permit_number or f"{self.permit_type or 'Unknown'} permit"
        return f"{permit_display} - {self.property.title}"


class PermitAttachment(models.Model):
    """
    Model to store binary attachments (PDFs, images, etc.) 
    associated with permit history records.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    permit_history = models.ForeignKey(
        PermitHistory,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    
    # File information
    filename = models.CharField(
        max_length=255,
        help_text="Original filename of the attachment"
    )
    file_type = models.CharField(
        max_length=50,
        help_text="MIME type of the file (e.g., application/pdf, image/jpeg)"
    )
    file_size = models.BigIntegerField(
        help_text="Size of the file in bytes"
    )
    
    # Binary storage
    file_data = models.BinaryField(
        help_text="Binary data of the attachment file"
    )
    
    # Metadata
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the attachment"
    )
    attachment_type = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Type of attachment (e.g., permit_document, inspection_report, plans)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Permit Attachments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['permit_history', '-created_at']),
            models.Index(fields=['file_type']),
            models.Index(fields=['attachment_type']),
        ]

    def __str__(self):
        return f"{self.filename} - {self.permit_history}"
