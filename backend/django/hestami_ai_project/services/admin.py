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
    ServiceProviderScrapedData
)

admin.site.register(ServiceProvider)
admin.site.register(ProviderCategory)
admin.site.register(ServiceRequest)
admin.site.register(ServiceReport)
admin.site.register(ServiceReview)
admin.site.register(ServiceBid)
admin.site.register(ServiceRequestClarification)
admin.site.register(ServiceRequestView)
admin.site.register(ServiceRequestInterest)
admin.site.register(ServiceResearch)
admin.site.register(ServiceProviderScrapedData)