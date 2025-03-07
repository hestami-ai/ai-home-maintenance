from django.urls import path
from . import views

app_name = 'media'

urlpatterns = [
    # Existing endpoints
    path('categories/', views.list_service_categories, name='service-categories'),
    path('providers/profile/', views.provider_profile, name='provider-profile'),
    path('providers/', views.list_providers, name='list-providers'),
    path('requests/', views.list_service_requests, name='service-requests'),
    path('requests/create/', views.create_service_request, name='create-service-request'),
    path('requests/<uuid:request_id>/', views.service_request_detail, name='service-request-detail'),
    path('requests/<uuid:request_id>/start/', views.start_service, name='start-service'),
    path('requests/<uuid:request_id>/complete/', views.complete_service, name='complete-service'),
    path('requests/<uuid:request_id>/review/', views.create_review, name='create-review'),
    
    # New bidding system endpoints
    path('requests/<uuid:request_id>/bids/', views.list_bids, name='list-bids'),
    path('requests/<uuid:request_id>/bids/submit/', views.submit_bid, name='submit-bid'),
    path('requests/<uuid:request_id>/bids/<uuid:bid_id>/select/', views.select_bid, name='select-bid'),
    
    # Clarification endpoints
    path('requests/<uuid:request_id>/clarifications/', views.submit_clarification, name='submit-clarification'),
    path('requests/<uuid:request_id>/clarifications/<uuid:clarification_id>/respond/', 
         views.respond_to_clarification, name='respond-to-clarification'),
    
    # Interest and view tracking endpoints
    path('requests/<uuid:request_id>/interest/', views.set_interest, name='set-interest'),
    path('requests/<uuid:request_id>/view/', views.track_view, name='track-view'),
    
    # Service request research
    path('requests/<uuid:request_id>/research/', views.add_research_data, name='add_research_data'),
]
