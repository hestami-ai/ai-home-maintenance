from django.contrib import admin
from .models.base_models import (
    ServiceProvider,
    ProviderCategory,
    ServiceRequest,
    ServiceReport,
    ServiceReview,
    ServiceBid,
    ServiceRequestClarification,
    ServiceRequestView,
    ServiceRequestInterest,
    ServiceResearch,
    ServiceProviderScrapedData,
    ProviderOutreach
)

@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'property', 'category', 'status', 'priority', 
        'assigned_to', 'created_by', 'created_at'
    ]
    list_filter = [
        'status', 'priority', 'category', 'assigned_to', 'created_at'
    ]
    search_fields = ['title', 'description', 'property__title']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('property', 'category', 'title', 'description', 'status', 'priority')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'created_by')
        }),
        ('Scheduling', {
            'fields': (
                'preferred_schedule', 'estimated_duration',
                'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end'
            )
        }),
        ('Financial', {
            'fields': (
                'estimated_cost', 'final_cost', 'budget_minimum', 
                'budget_maximum', 'bid_submission_deadline'
            )
        }),
        ('Provider Selection', {
            'fields': ('provider', 'selected_provider', 'runner_up_provider')
        }),
        ('Metadata', {
            'fields': ('is_diy', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

@admin.register(ProviderOutreach)
class ProviderOutreachAdmin(admin.ModelAdmin):
    list_display = [
        'service_request', 'provider', 'status', 'last_contact_date',
        'contacted_by', 'updated_at'
    ]
    list_filter = ['status', 'last_contact_date', 'contacted_by']
    search_fields = [
        'service_request__title', 'provider__business_name', 'notes'
    ]
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Outreach Information', {
            'fields': ('service_request', 'provider', 'status')
        }),
        ('Contact Details', {
            'fields': (
                'last_contact_date', 'expected_response_date',
                'contacted_by', 'notes'
            )
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

admin.site.register(ServiceProvider)
admin.site.register(ProviderCategory)
admin.site.register(ServiceReport)
admin.site.register(ServiceReview)
admin.site.register(ServiceBid)
admin.site.register(ServiceRequestClarification)
admin.site.register(ServiceRequestView)
admin.site.register(ServiceRequestInterest)
admin.site.register(ServiceResearch)
admin.site.register(ServiceProviderScrapedData)