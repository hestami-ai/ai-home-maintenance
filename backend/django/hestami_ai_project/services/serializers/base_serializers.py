from rest_framework import serializers
from services.models.base_models import (
    ServiceProvider, ProviderCategory,
    ServiceRequest, ServiceReport, ServiceReview,
    ServiceBid, ServiceRequestClarification, ServiceRequestInterest,
    ServiceResearch, ProviderOutreach
)
from users.serializers import UserSerializer
from media.serializers import MediaSerializer
from django.utils import timezone
from properties.models import Property

class ProviderCategorySerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = ProviderCategory
        fields = [
            'id', 'category', 'category_display', 'hourly_rate',
            'is_active', 'experience_years', 'certifications'
        ]

class ServiceProviderSerializer(serializers.ModelSerializer):
    users_details = UserSerializer(source='users', many=True, read_only=True)
    categories_info = ProviderCategorySerializer(
        source='providercategory_set',
        many=True,
        read_only=True
    )
    average_rating = serializers.DecimalField(
        max_digits=3,
        decimal_places=2,
        read_only=True
    )
    distance = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceProvider
        fields = [
            'id', 'users_details', 'business_name',
            'description', 'phone', 'website', 'address',
            'service_area', 'is_available',
            'rating', 'total_reviews', 'average_rating',
            'categories_info', 'distance', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at']
    
    def get_distance(self, obj):
        """Return distance in miles if it was annotated by the query."""
        distance = getattr(obj, 'distance', None)
        if distance is not None:
            # Convert Distance object to float (miles)
            return float(distance.mi)
        return None

class ServiceBidSerializer(serializers.ModelSerializer):
    provider_details = ServiceProviderSerializer(source='provider', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Additional metadata for bid comparison (Phase 2)
    estimated_duration_days = serializers.SerializerMethodField()
    days_until_start = serializers.SerializerMethodField()
    is_selected = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceBid
        fields = [
            'id', 'service_request', 'provider', 'provider_details',
            'amount', 'description', 'estimated_duration', 'estimated_duration_days',
            'proposed_start_date', 'days_until_start', 'status', 'status_display',
            'is_selected', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_estimated_duration_days(self, obj):
        """Convert duration to days for easier comparison"""
        if obj.estimated_duration:
            return obj.estimated_duration.days + (obj.estimated_duration.seconds / 86400)
        return None
    
    def get_days_until_start(self, obj):
        """Calculate days until proposed start date"""
        if obj.proposed_start_date:
            delta = obj.proposed_start_date - timezone.now()
            return delta.days
        return None
    
    def get_is_selected(self, obj):
        """Check if this bid's provider is the selected provider"""
        return obj.service_request.selected_provider_id == obj.provider_id
    
    def validate(self, data):
        if data.get('proposed_start_date') and data['proposed_start_date'] < timezone.now():
            raise serializers.ValidationError({
                'proposed_start_date': 'Proposed start date cannot be in the past.'
            })
        return data

class ServiceRequestClarificationSerializer(serializers.ModelSerializer):
    question_by_details = ServiceProviderSerializer(
        source='question_by',
        read_only=True
    )
    attachment_details = MediaSerializer(
        source='attachments',
        many=True,
        read_only=True
    )
    
    class Meta:
        model = ServiceRequestClarification
        fields = [
            'id', 'service_request', 'question_by',
            'question_by_details', 'question', 'response',
            'response_at', 'attachments', 'attachment_details',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'created_at'
        ]

class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    media = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        default=list
    )

    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'property', 'category', 'title', 'description',
            'priority', 'preferred_schedule', 'estimated_duration',
            'status', 'media', 'is_diy'
        ]
    
    def create(self, validated_data):
        # Get user from context
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None

        # Extract media from validated data
        media_items = validated_data.pop('media', [])
        
        # Create the service request without explicitly setting created_by
        service_request = ServiceRequest.objects.create(**validated_data)

        # Update media items to belong to this service request
        if media_items:
            Media.objects.filter(
                id__in=media_items,
                service_request__isnull=True,
                service_report__isnull=True,
                property_ref__isnull=True,
                is_deleted=False
            ).update(service_request=service_request)

        return service_request

class SimplePropertySerializer(serializers.ModelSerializer):
    """A simplified property serializer to avoid circular imports"""
    class Meta:
        model = Property
        fields = ['id', 'title', 'address', 'city', 'state', 'zip_code']

class ServiceRequestSerializer(serializers.ModelSerializer):
    property_details = SimplePropertySerializer(source='property', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    provider_details = serializers.SerializerMethodField()
    created_by_details = UserSerializer(source='created_by', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    bids = serializers.SerializerMethodField()
    clarifications = serializers.SerializerMethodField()
    selected_provider_details = serializers.SerializerMethodField()
    runner_up_provider_details = serializers.SerializerMethodField()
    media_details = serializers.SerializerMethodField()
    research_entries = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'property', 'property_details', 'category',
            'category_display', 'provider', 'provider_details',
            'title', 'description', 'status', 'priority',
            'preferred_schedule', 'estimated_duration',
            'scheduled_start', 'scheduled_end', 'actual_start',
            'actual_end', 'estimated_cost', 'final_cost',
            'created_at', 'updated_at', 'created_by',
            'created_by_details', 'assigned_to', 'assigned_to_details',
            'budget_minimum', 'budget_maximum',
            'bid_submission_deadline', 'selected_provider',
            'selected_provider_details', 'runner_up_provider',
            'runner_up_provider_details', 'bids',
            'clarifications', 'media_details', 'is_diy',
            'research_entries'
        ]
        read_only_fields = [
            'created_at', 'created_by', 
        ]

    def get_provider_details(self, obj):
        if obj.provider:
            return ServiceProviderSerializer(obj.provider).data
        return None

    def get_bids(self, obj):
        return ServiceBidSerializer(obj.bids.all(), many=True).data

    def get_clarifications(self, obj):
        return ServiceRequestClarificationSerializer(obj.clarifications.all(), many=True).data

    def get_selected_provider_details(self, obj):
        if obj.selected_provider:
            return ServiceProviderSerializer(obj.selected_provider).data
        return None

    def get_runner_up_provider_details(self, obj):
        if obj.runner_up_provider:
            return ServiceProviderSerializer(obj.runner_up_provider).data
        return None

    def get_media_details(self, obj):
        return MediaSerializer(obj.media.filter(is_deleted=False), many=True).data

    def get_research_entries(self, obj):
        # Only include research entries if the user is staff
        user = self.context.get('request').user if self.context.get('request') else None
        if user and user.is_staff and user.user_role == 'STAFF':
            return ServiceResearchSerializer(
                obj.research_entries.all(),
                many=True,
                context=self.context
            ).data
        return []

class ServiceReportSerializer(serializers.ModelSerializer):
    media_details = serializers.SerializerMethodField()
    created_by_details = UserSerializer(source='created_by', read_only=True)
    before_photos = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True, default=list)
    after_photos = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True, default=list)
    
    class Meta:
        model = ServiceReport
        fields = [
            'id', 'service_request', 'summary', 'details',
            'materials_used', 'additional_notes', 'before_photos',
            'after_photos', 'media_details', 'created_at',
            'updated_at', 'created_by', 'created_by_details'
        ]
        read_only_fields = ['created_at', 'created_by']

    def get_media_details(self, obj):
        before_photos = obj.media.filter(report_photo_type='BEFORE', is_deleted=False)
        after_photos = obj.media.filter(report_photo_type='AFTER', is_deleted=False)
        
        return {
            'before_photos': MediaSerializer(before_photos, many=True).data,
            'after_photos': MediaSerializer(after_photos, many=True).data
        }

    def create(self, validated_data):
        before_photos = validated_data.pop('before_photos', [])
        after_photos = validated_data.pop('after_photos', [])
        
        report = super().create(validated_data)
        
        # Update before photos
        if before_photos:
            Media.objects.filter(
                id__in=before_photos,
                service_report__isnull=True,
                is_deleted=False
            ).update(
                service_report=report,
                report_photo_type='BEFORE'
            )
        
        # Update after photos
        if after_photos:
            Media.objects.filter(
                id__in=after_photos,
                service_report__isnull=True,
                is_deleted=False
            ).update(
                service_report=report,
                report_photo_type='AFTER'
            )
        
        return report

class ServiceReviewSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    
    class Meta:
        model = ServiceReview
        fields = [
            'id', 'service_request', 'rating', 'comment',
            'created_at', 'updated_at', 'created_by',
            'created_by_details'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

class ServiceRequestInterestSerializer(serializers.ModelSerializer):
    provider_details = ServiceProviderSerializer(
        source='provider',
        read_only=True
    )
    
    class Meta:
        model = ServiceRequestInterest
        fields = [
            'id', 'service_request', 'provider',
            'provider_details', 'interest_status',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at']

class ServiceResearchSerializer(serializers.ModelSerializer):
    """
    Serializer for the ServiceResearch model.
    Includes details about the researcher.
    """
    researched_by_details = UserSerializer(source='researched_by', read_only=True)
    
    class Meta:
        model = ServiceResearch
        fields = [
            'id', 'service_request', 'research_data', 'research_content',
            'research_content_raw_text', 'data_sources', 'source_url', 'notes', 
            'researched_by', 'researched_by_details', 'service_provider_created', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class ProviderOutreachSerializer(serializers.ModelSerializer):
    """
    Serializer for ProviderOutreach model.
    Tracks STAFF outreach to providers during the bidding phase.
    """
    provider_details = ServiceProviderSerializer(source='provider', read_only=True)
    contacted_by_details = UserSerializer(source='contacted_by', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ProviderOutreach
        fields = [
            'id', 'service_request', 'provider', 'provider_details',
            'status', 'status_display', 'last_contact_date', 
            'expected_response_date', 'notes', 'contacted_by',
            'contacted_by_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        # Auto-set contacted_by to current user if not provided
        if 'contacted_by' not in validated_data:
            validated_data['contacted_by'] = self.context['request'].user
        return super().create(validated_data)


class ServiceRequestDetailSerializer(serializers.ModelSerializer):
    report = ServiceReportSerializer(read_only=True)
    review = ServiceReviewSerializer(read_only=True)
    
    class Meta(ServiceRequestSerializer.Meta):
        fields = ServiceRequestSerializer.Meta.fields + ['report', 'review']
