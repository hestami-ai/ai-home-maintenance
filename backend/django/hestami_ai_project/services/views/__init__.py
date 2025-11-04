"""
Services Views Module
Exports all view functions for backward compatibility and cleaner imports.
"""

# Category views
from .categories import list_service_categories

# STAFF queue and management views (Phase 1)
from .staff_queue import (
    staff_queue_dashboard,
    update_service_request_status
)

# Research data views (Phase 1)
from .research import (
    add_research_data,
    list_research_entries
)

# Provider outreach views (Phase 2)
from .outreach import (
    list_create_outreach,
    retrieve_update_delete_outreach
)

# Bidding management views (Phase 2)
from .bidding import (
    reopen_research
)

# Legacy base_views imports (for backward compatibility)
from .base_views import (
    provider_profile,
    list_providers,
    create_service_request,
    list_service_requests,
    service_request_detail,
    start_service,
    complete_service,
    create_review,
    submit_bid,
    list_bids,
    select_bid,
    submit_clarification,
    respond_to_clarification,
    set_interest,
    track_view,
    has_request_access
)

__all__ = [
    # Categories
    'list_service_categories',
    
    # STAFF Queue (Phase 1)
    'staff_queue_dashboard',
    'update_service_request_status',
    
    # Research (Phase 1)
    'add_research_data',
    'list_research_entries',
    
    # Provider Outreach (Phase 2)
    'list_create_outreach',
    'retrieve_update_delete_outreach',
    
    # Bidding Management (Phase 2)
    'reopen_research',
    
    # Legacy base_views
    'provider_profile',
    'list_providers',
    'create_service_request',
    'list_service_requests',
    'service_request_detail',
    'start_service',
    'complete_service',
    'create_review',
    'submit_bid',
    'list_bids',
    'select_bid',
    'submit_clarification',
    'respond_to_clarification',
    'set_interest',
    'track_view',
    'has_request_access',
]
