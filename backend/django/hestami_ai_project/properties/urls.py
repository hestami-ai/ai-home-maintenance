from django.urls import path
from . import views

app_name = 'properties'

urlpatterns = [
    path('', views.list_properties, name='list_properties'),
    path('create/', views.create_property, name='create_property'),
    path('<uuid:property_id>/', views.property_detail, name='property_detail'),
    path('<uuid:property_id>/update/', views.update_property, name='update_property'),
    path('<uuid:property_id>/delete/', views.delete_property, name='delete_property'),
    path('<uuid:property_id>/permit-status/', views.update_property_permit_status, name='update_property_permit_status'),
    path('<uuid:property_id>/access/', views.grant_property_access, name='grant_property_access'),
    path('<uuid:property_id>/access/<uuid:access_id>/', views.update_property_access, name='update_property_access'),
    path('<uuid:property_id>/scraped-data/create', views.create_property_scraped_data, name='create_property_scraped_data'),
    path('<uuid:property_id>/scraped-data/', views.list_property_scraped_data, name='list_property_scraped_data'),
    path('<uuid:property_id>/scraped-data/<uuid:scraped_data_id>/', views.update_property_scraped_data, name='update_property_scraped_data'),
    path('<uuid:property_id>/scraped-data/<uuid:scraped_data_id>/delete/', views.delete_property_scraped_data, name='delete_property_scraped_data'),
    
    # Permit History URLs
    path('permits/', views.list_permit_history, name='list_all_permit_history'),
    path('<uuid:property_id>/permits/', views.list_permit_history, name='list_permit_history'),
    path('<uuid:property_id>/permits/create/', views.create_permit_history, name='create_permit_history'),
    path('permits/<uuid:permit_id>/', views.permit_history_detail, name='permit_history_detail'),
    path('permits/<uuid:permit_id>/update/', views.update_permit_history, name='update_permit_history'),
    path('permits/<uuid:permit_id>/delete/', views.delete_permit_history, name='delete_permit_history'),
    
    # Permit Attachment URLs
    path('permits/<uuid:permit_id>/attachments/', views.list_permit_attachments, name='list_permit_attachments'),
    path('permits/<uuid:permit_id>/attachments/create/', views.create_permit_attachment, name='create_permit_attachment'),
    path('permits/attachments/<uuid:attachment_id>/', views.permit_attachment_detail, name='permit_attachment_detail'),
    path('permits/attachments/<uuid:attachment_id>/download/', views.download_permit_attachment, name='download_permit_attachment'),
    path('permits/attachments/<uuid:attachment_id>/update/', views.update_permit_attachment, name='update_permit_attachment'),
    path('permits/attachments/<uuid:attachment_id>/delete/', views.delete_permit_attachment, name='delete_permit_attachment'),
]
