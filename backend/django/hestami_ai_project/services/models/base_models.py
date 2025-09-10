from django.db import models
from django.conf import settings
import uuid
from django.utils import timezone
from properties.models import Property

class ServiceCategory(models.TextChoices):
    PLUMBING = 'PLUMBING', 'Plumbing'
    ELECTRICAL = 'ELECTRICAL', 'Electrical'
    HVAC = 'HVAC', 'HVAC'
    GENERAL_MAINTENANCE = 'GENERAL_MAINTENANCE', 'General Maintenance'
    LANDSCAPING = 'LANDSCAPING', 'Landscaping'
    CLEANING = 'CLEANING', 'Cleaning'
    SECURITY = 'SECURITY', 'Security'
    PEST_CONTROL = 'PEST_CONTROL', 'Pest Control'
    ROOFING = 'ROOFING', 'Roofing'
    REMODELING = 'REMODELING', 'Remodeling'
    OTHER = 'OTHER', 'Other'

class ServiceResearchSources(models.TextChoices):
    ANGI_LIST = 'ANGI_LIST', 'Angi\'s List'
    THUMBTACK = 'THUMBTACK', 'Thumbtack'
    BING_SEARCH = 'BING_SEARCH', 'Bing Search'
    YELP = 'YELP', 'Yelp'
    OTHER = 'OTHER', 'Other'

class ServiceProvider(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    service_area = models.JSONField(default=dict)  # Store service area as GeoJSON
    is_available = models.BooleanField(default=True)
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00
    )
    total_reviews = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name}"

    @property
    def average_rating(self):
        if self.total_reviews > 0:
            return self.rating / self.total_reviews
        return 0.0


class ServiceProviderScrapedData(models.Model):
    """
    Model to store raw and processed data from web scraping for service providers.
    Multiple websites can be scraped for a single service provider.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_provider = models.ForeignKey(
        ServiceProvider,
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
            models.Index(fields=['service_provider', '-last_scraped_at']),
            models.Index(fields=['source_name']),
            models.Index(fields=['scrape_status']),
        ]
        unique_together = ['service_provider', 'source_url']
    
    def __str__(self):
        return f"{self.source_name} data for {self.service_provider.company_name}"

class ProviderCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(ServiceProvider, on_delete=models.CASCADE)
    category = models.CharField(
        max_length=50,
        choices=ServiceCategory.choices,
        db_index=True
    )
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    experience_years = models.PositiveIntegerField(default=0)
    certifications = models.JSONField(default=list)

    class Meta:
        unique_together = ['provider', 'category']
        verbose_name_plural = 'Provider Categories'

    def __str__(self):
        return f"{self.provider.company_name} - {self.get_category_display()}"

class ServiceRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_RESEARCH = 'IN_RESEARCH', 'In Research'
        BIDDING = 'BIDDING', 'Open for Bidding'
        REOPENED_BIDDING = 'REOPENED_BIDDING', 'Reopened for Bidding'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        DECLINED = 'DECLINED', 'Declined'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name='service_requests'
    )
    category = models.CharField(
        max_length=50,
        choices=ServiceCategory.choices,
        db_index=True
    )
    provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.SET_NULL,
        null=True,
        related_name='requests'
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM
    )
    preferred_schedule = models.JSONField(default=dict)  # Store schedule preferences
    estimated_duration = models.DurationField(null=True, blank=True)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    estimated_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    final_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    budget_minimum = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum budget for this service request"
    )
    budget_maximum = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum budget for this service request"
    )
    bid_submission_deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline for service providers to submit bids"
    )
    selected_provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.SET_NULL,
        null=True,
        related_name='selected_requests',
        help_text="The service provider selected for this request"
    )
    runner_up_provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.SET_NULL,
        null=True,
        related_name='runner_up_requests',
        help_text="The runner-up service provider for this request"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_requests'
    )
    is_diy = models.BooleanField(
        default=False,
        help_text="Whether this is a DIY (Do It Yourself) project"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['provider', 'status']),
            models.Index(fields=['property', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.property.title}"

    def start_service(self):
        if self.status != self.Status.SCHEDULED:
            raise ValueError("Service must be scheduled before starting")
        self.status = self.Status.IN_PROGRESS
        self.actual_start = timezone.now()
        self.save()

    def complete_service(self):
        if self.status != self.Status.IN_PROGRESS:
            raise ValueError("Service must be in progress before completing")
        self.status = self.Status.COMPLETED
        self.actual_end = timezone.now()
        self.save()

class ServiceReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.OneToOneField(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='report'
    )
    summary = models.TextField()
    details = models.JSONField(default=dict)
    materials_used = models.JSONField(default=list)
    additional_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_reports'
    )

    def __str__(self):
        return f"Report for {self.service_request}"

class ServiceReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.OneToOneField(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='review'
    )
    rating = models.PositiveSmallIntegerField()  # 1-5 rating
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_reviews'
    )

    def save(self, *args, **kwargs):
        # Update provider's rating
        provider = self.service_request.provider
        if provider:
            provider.rating = (provider.rating * provider.total_reviews + self.rating) / (provider.total_reviews + 1)
            provider.total_reviews += 1
            provider.save()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Review for {self.service_request.title}"

class ServiceBid(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UPDATED = 'UPDATED', 'Updated'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='bids'
    )
    provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.CASCADE,
        related_name='submitted_bids'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Bid amount for the service"
    )
    description = models.TextField(
        help_text="Detailed description of the service proposal"
    )
    estimated_duration = models.DurationField(
        help_text="Estimated time to complete the service"
    )
    proposed_start_date = models.DateTimeField(
        help_text="Proposed date to start the service"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    history = models.JSONField(
        default=list,
        help_text="History of bid changes"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['service_request', 'provider']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service_request', 'status']),
            models.Index(fields=['provider', '-created_at']),
        ]

    def __str__(self):
        return f"Bid on {self.service_request.title} by {self.provider.company_name}"

    def save(self, *args, **kwargs):
        if self.pk:  # If this is an update
            # Get the current state before update
            old_instance = ServiceBid.objects.get(pk=self.pk)
            # Prepare history entry
            history_entry = {
                'timestamp': timezone.now().isoformat(),
                'amount': str(old_instance.amount),
                'description': old_instance.description,
                'estimated_duration': str(old_instance.estimated_duration),
                'proposed_start_date': old_instance.proposed_start_date.isoformat(),
                'status': old_instance.status
            }
            # Add to history
            self.history = self.history + [history_entry]
        super().save(*args, **kwargs)

class ServiceRequestClarification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='clarifications'
    )
    question_by = models.ForeignKey(
        ServiceProvider,
        on_delete=models.CASCADE,
        related_name='asked_clarifications'
    )
    question = models.TextField(
        help_text="Question or clarification request"
    )
    response = models.TextField(
        blank=True,
        null=True,
        help_text="Property owner's response"
    )
    response_at = models.DateTimeField(
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service_request', '-created_at']),
        ]

    def __str__(self):
        return f"Clarification for {self.service_request.title}"

class ServiceRequestView(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='views'
    )
    provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.CASCADE,
        related_name='viewed_requests'
    )
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-viewed_at']
        indexes = [
            models.Index(fields=['service_request', '-viewed_at']),
            models.Index(fields=['provider', '-viewed_at']),
        ]

    def __str__(self):
        return f"{self.provider.company_name} viewed {self.service_request.title}"

class ServiceRequestInterest(models.Model):
    class Interest(models.TextChoices):
        INTERESTED = 'INTERESTED', 'Interested'
        NOT_INTERESTED = 'NOT_INTERESTED', 'Not Interested'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='interests'
    )
    provider = models.ForeignKey(
        ServiceProvider,
        on_delete=models.CASCADE,
        related_name='request_interests'
    )
    interest_status = models.CharField(
        max_length=20,
        choices=Interest.choices
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes about interest or lack thereof"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['service_request', 'provider']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service_request', 'interest_status']),
            models.Index(fields=['provider', '-created_at']),
        ]

    def __str__(self):
        return f"{self.provider.company_name} is {self.interest_status} in {self.service_request.title}"

class ServiceResearch(models.Model):
    """
    Model to track research activities related to service requests.
    Stores rich text content with base64-encoded embedded images.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name='research_entries'
    )
    research_data = models.JSONField(
        default=dict,
        help_text="Structured research data including candidate service providers"
    )
    research_content = models.TextField(
        blank=True,
        help_text="Rich text content with base64-encoded embedded images"
    )
    research_content_raw_text = models.TextField(
        blank=True,
        help_text="Raw text content extracted from HTML (basically just copy-paste from browser)"
    )
    data_sources = models.JSONField(
        default=list,
        help_text="List of data sources used for the research (e.g., 'Angi's List', 'Thumbtack', 'Bing Search', 'Yelp')"
    )
    notes = models.TextField(
        blank=True,
        help_text="Additional notes about the research"
    )
    researched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='conducted_research'
    )
    service_provider_created = models.BooleanField(
        default=False,
        help_text="Indicates if a service provider was created from this research"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service_request', '-created_at']),
            models.Index(fields=['researched_by', '-created_at']),
        ]

    def __str__(self):
        return f"Research for {self.service_request.title} by {self.researched_by.email if self.researched_by else 'Unknown'}"


# Import timeline models
from .timeline_models import TimelineEntry, TimelineComment, TimelineReadReceipt, TimelineEntryType, CommentType, VisibilityType
