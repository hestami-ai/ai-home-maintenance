from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Import views from refactored modules
from services.views import (
    # Categories
    list_service_categories,
    # STAFF Queue (Phase 1)
    staff_queue_dashboard,
    update_service_request_status,
    # Research (Phase 1)
    add_research_data,
    list_research_entries,
    # Provider Outreach (Phase 2)
    list_create_outreach,
    retrieve_update_delete_outreach,
    # Bidding Management (Phase 2)
    reopen_research,
    # Legacy base_views
    provider_profile,
    list_providers,
    list_service_requests,
    create_service_request,
    service_request_detail,
    start_service,
    complete_service,
    create_review,
    list_bids,
    submit_bid,
    select_bid,
    submit_clarification,
    respond_to_clarification,
    set_interest,
    track_view
)

# Import timeline views
from services.views.timeline_views import TimelineEntryViewSet, TimelineCommentViewSet

# Import provider ingestion views
from services.views.provider_ingestion import (
    add_provider_to_roster,
    get_scraped_data_status,
    resolve_intervention,
    list_pending_interventions
)

# Import provider search views
from services.views.provider_search import ProviderSearchViewSet

# Import scrape group views
from services.views.scrape_groups import (
    create_scrape_group,
    get_scrape_group,
    add_source_to_group,
    remove_source_from_group,
    process_scrape_group,
    list_scrape_groups,
    delete_scrape_group
)

app_name = 'services'

urlpatterns = [
    # STAFF Queue Management
    path('requests/queue/', staff_queue_dashboard, name='staff-queue-dashboard'),
    path('requests/<uuid:request_id>/status/', update_service_request_status, name='update-service-request-status'),
    
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
    
    # Service request research (Phase 1)
    path('requests/<uuid:request_id>/research/', list_research_entries, name='list-research-entries'),
    path('requests/<uuid:request_id>/research/add/', add_research_data, name='add-research-data'),
    
    # Provider outreach (Phase 2)
    path('requests/<uuid:request_id>/outreach/', list_create_outreach, name='list-create-outreach'),
    path('requests/<uuid:request_id>/outreach/<uuid:outreach_id>/', retrieve_update_delete_outreach, name='retrieve-update-delete-outreach'),
    
    # Bidding management (Phase 2)
    path('requests/<uuid:request_id>/reopen-research/', reopen_research, name='reopen-research'),
    
    # Provider ingestion endpoints
    path('providers/add-to-roster/', add_provider_to_roster, name='add-provider-to-roster'),
    path('providers/scraped/<uuid:scraped_data_id>/status/', get_scraped_data_status, name='get-scraped-data-status'),
    path('providers/scraped/<uuid:scraped_data_id>/resolve/', resolve_intervention, name='resolve-intervention'),
    path('providers/interventions/', list_pending_interventions, name='list-pending-interventions'),
    
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
    
    # Provider search endpoints (STAFF only)
    path('staff/providers/search/', 
         ProviderSearchViewSet.as_view({'get': 'search', 'post': 'search'}), 
         name='provider-search'),
    path('staff/providers/nearby/', 
         ProviderSearchViewSet.as_view({'get': 'nearby'}), 
         name='provider-nearby'),
    path('staff/providers/semantic/', 
         ProviderSearchViewSet.as_view({'get': 'semantic', 'post': 'semantic'}), 
         name='provider-semantic'),
    path('staff/providers/experienced/', 
         ProviderSearchViewSet.as_view({'get': 'experienced'}), 
         name='provider-experienced'),
    
    # Scrape group endpoints (STAFF only)
    path('scrape-groups/', list_scrape_groups, name='list-scrape-groups'),
    path('scrape-groups/create/', create_scrape_group, name='create-scrape-group'),
    path('scrape-groups/<uuid:scrape_group_id>/', get_scrape_group, name='get-scrape-group'),
    path('scrape-groups/<uuid:scrape_group_id>/sources/', add_source_to_group, name='add-source-to-group'),
    path('scrape-groups/<uuid:scrape_group_id>/sources/<uuid:scraped_data_id>/', remove_source_from_group, name='remove-source-from-group'),
    path('scrape-groups/<uuid:scrape_group_id>/process/', process_scrape_group, name='process-scrape-group'),
    path('scrape-groups/<uuid:scrape_group_id>/delete/', delete_scrape_group, name='delete-scrape-group'),
]
