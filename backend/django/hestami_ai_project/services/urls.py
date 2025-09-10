from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Import core views from the new location
from services.views.base_views import (
    list_service_categories, provider_profile, list_providers,
    list_service_requests, create_service_request, service_request_detail,
    start_service, complete_service, create_review, list_bids,
    submit_bid, select_bid, submit_clarification, respond_to_clarification,
    set_interest, track_view, add_research_data
)

# Import timeline views
from services.views.timeline_views import TimelineEntryViewSet, TimelineCommentViewSet

app_name = 'services'

urlpatterns = [
    # Existing endpoints
    path('categories/', list_service_categories, name='service-categories'),
    path('providers/profile/', provider_profile, name='provider-profile'),
    path('providers/', list_providers, name='list-providers'),
    path('requests/', list_service_requests, name='service-requests'),
    path('requests/create/', create_service_request, name='create-service-request'),
    path('requests/<uuid:request_id>/', service_request_detail, name='service-request-detail'),
    path('requests/<uuid:request_id>/start/', start_service, name='start-service'),
    path('requests/<uuid:request_id>/complete/', complete_service, name='complete-service'),
    path('requests/<uuid:request_id>/review/', create_review, name='create-review'),
    
    # New bidding system endpoints
    path('requests/<uuid:request_id>/bids/', list_bids, name='list-bids'),
    path('requests/<uuid:request_id>/bids/submit/', submit_bid, name='submit-bid'),
    path('requests/<uuid:request_id>/bids/<uuid:bid_id>/select/', select_bid, name='select-bid'),
    
    # Clarification endpoints
    path('requests/<uuid:request_id>/clarifications/', submit_clarification, name='submit-clarification'),
    path('requests/<uuid:request_id>/clarifications/<uuid:clarification_id>/respond/', 
         respond_to_clarification, name='respond-to-clarification'),
    
    # Interest and view tracking endpoints
    path('requests/<uuid:request_id>/interest/', set_interest, name='set-interest'),
    path('requests/<uuid:request_id>/view/', track_view, name='track-view'),
    
    # Service request research
    path('requests/<uuid:request_id>/research/', add_research_data, name='add_research_data'),
    
    # Timeline endpoints
    path('requests/<uuid:service_request_id>/timeline/', 
         TimelineEntryViewSet.as_view({
             'get': 'list',
             'post': 'create'
         }), 
         name='timeline-list'),
    path('requests/<uuid:service_request_id>/timeline/<uuid:pk>/', 
         TimelineEntryViewSet.as_view({
             'get': 'retrieve',
             'patch': 'partial_update',
             'delete': 'destroy'
         }), 
         name='timeline-detail'),
    path('requests/<uuid:service_request_id>/timeline/<uuid:pk>/read/', 
         TimelineEntryViewSet.as_view({
             'post': 'read'
         }), 
         name='timeline-read'),
    path('requests/<uuid:service_request_id>/timeline/unread/', 
         TimelineEntryViewSet.as_view({
             'get': 'unread'
         }), 
         name='timeline-unread'),
    path('requests/<uuid:service_request_id>/timeline/comment/', 
         TimelineCommentViewSet.as_view({
             'post': 'create'
         }), 
         name='timeline-comment-create'),
]
