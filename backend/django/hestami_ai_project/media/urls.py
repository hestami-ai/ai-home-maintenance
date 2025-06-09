from django.urls import path
from . import views

app_name = 'media'

urlpatterns = [
    # Property media endpoints
    path('properties/<uuid:property_id>/upload/', views.upload_media, name='upload_media'),
    path('properties/<uuid:property_id>/', views.list_property_media, name='list_property_media'),
    path('properties/<uuid:property_id>/stats/', views.media_stats, name='media_stats'),
    
    # Service request and report media endpoints
    path('services/requests/<uuid:request_id>/upload/', views.upload_service_request_media, name='upload_service_request_media'),
    path('services/requests/<uuid:request_id>/', views.list_service_request_media, name='list_service_request_media'),
    path('services/reports/<uuid:report_id>/upload/', views.upload_service_report_media, name='upload_service_report_media'),
    path('services/reports/<uuid:report_id>/', views.list_service_report_media, name='list_service_report_media'),
    
    # Common media endpoints
    path('<uuid:media_id>/', views.delete_media, name='delete_media'),
    path('<uuid:media_id>/status/', views.media_processing_status, name='media_processing_status'),
    path('types/', views.get_media_types, name='media_types'),
    path('locations/', views.get_location_types, name='location_types'),
]
