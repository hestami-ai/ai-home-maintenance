"""
API views for managing scrape groups and provider research sessions.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from services.models import ScrapeGroup, ServiceProviderScrapedData, ServiceProvider
from services.tasks import process_pending_service_provider_scraped_data
import logging

logger = logging.getLogger('django')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_scrape_group(request):
    """
    Create a new scrape group for researching a provider.
    
    POST /api/services/scrape-groups/
    {
        "search_query": "Milcon HVAC Waterford VA",
        "notes": "Optional notes about this research"
    }
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can create scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    search_query = request.data.get('search_query', '').strip()
    if not search_query:
        return Response(
            {'error': 'search_query is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    scrape_group = ScrapeGroup.objects.create(
        search_query=search_query,
        created_by=request.user,
        notes=request.data.get('notes', '')
    )
    
    logger.info(f"Created scrape group {scrape_group.id} for '{search_query}' by {request.user.email}")
    
    return Response({
        'id': str(scrape_group.id),
        'search_query': scrape_group.search_query,
        'notes': scrape_group.notes,
        'created_by': request.user.email,
        'created_at': scrape_group.created_at.isoformat(),
        'scrape_count': 0
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_scrape_group(request, scrape_group_id):
    """
    Get details of a scrape group including all sources.
    
    GET /api/services/scrape-groups/{id}/
    """
    scrape_group = get_object_or_404(ScrapeGroup, id=scrape_group_id)
    
    # Check permission
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can view scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    scrapes = ServiceProviderScrapedData.objects.filter(
        scrape_group=scrape_group
    ).order_by('created_at')
    
    # Check if provider was created
    provider_scrape = scrapes.filter(service_provider__isnull=False).first()
    
    return Response({
        'id': str(scrape_group.id),
        'search_query': scrape_group.search_query,
        'notes': scrape_group.notes,
        'created_by': scrape_group.created_by.email,
        'created_at': scrape_group.created_at.isoformat(),
        'updated_at': scrape_group.updated_at.isoformat(),
        'scrape_count': scrapes.count(),
        'scrapes': [
            {
                'id': str(s.id),
                'source_name': s.source_name,
                'source_url': s.source_url,
                'scrape_status': s.scrape_status,
                'created_at': s.created_at.isoformat(),
                'error_message': s.error_message
            } for s in scrapes
        ],
        'provider_id': str(provider_scrape.service_provider.id) if provider_scrape else None,
        'provider_name': provider_scrape.service_provider.business_name if provider_scrape else None
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_source_to_group(request, scrape_group_id):
    """
    Add a scraped source to a scrape group.
    
    POST /api/services/scrape-groups/{id}/sources/
    {
        "source_url": "https://thumbtack.com/...",
        "raw_html": "<html>...</html>",
        "raw_text": "Plain text content..."
    }
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can add sources'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    scrape_group = get_object_or_404(ScrapeGroup, id=scrape_group_id)
    
    # Verify ownership
    if scrape_group.created_by != request.user:
        return Response(
            {'error': 'You can only add sources to your own scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    source_url = request.data.get('source_url', '').strip()
    if not source_url:
        return Response(
            {'error': 'source_url is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if this URL was already added to this group
    existing = ServiceProviderScrapedData.objects.filter(
        scrape_group=scrape_group,
        source_url=source_url
    ).first()
    
    if existing:
        return Response(
            {'error': 'This source URL has already been added to this group'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Create scraped data with placeholder source_name (workflow will detect it)
    scraped_data = ServiceProviderScrapedData.objects.create(
        scrape_group=scrape_group,
        source_name='Pending Detection',  # Will be auto-detected by workflow
        source_url=source_url,
        raw_html=request.data.get('raw_html', ''),
        raw_text=request.data.get('raw_text', ''),
        scrape_status='pending'
    )
    
    logger.info(
        f"Added source {scraped_data.id} to scrape group {scrape_group_id}: {source_url}"
    )
    
    return Response({
        'id': str(scraped_data.id),
        'scrape_group_id': str(scrape_group.id),
        'source_url': scraped_data.source_url,
        'source_name': scraped_data.source_name,
        'scrape_status': scraped_data.scrape_status,
        'created_at': scraped_data.created_at.isoformat()
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_source_from_group(request, scrape_group_id, scraped_data_id):
    """
    Remove a source from a scrape group (only if not yet processed).
    
    DELETE /api/services/scrape-groups/{group_id}/sources/{scraped_data_id}/
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can remove sources'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    scrape_group = get_object_or_404(ScrapeGroup, id=scrape_group_id)
    scraped_data = get_object_or_404(
        ServiceProviderScrapedData,
        id=scraped_data_id,
        scrape_group=scrape_group
    )
    
    # Verify ownership
    if scrape_group.created_by != request.user:
        return Response(
            {'error': 'You can only remove sources from your own scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Don't allow deletion if already processed
    if scraped_data.scrape_status not in ['pending', 'failed']:
        return Response(
            {'error': 'Cannot remove source that has already been processed'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    scraped_data.delete()
    logger.info(f"Removed source {scraped_data_id} from scrape group {scrape_group_id}")
    
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_scrape_group(request, scrape_group_id):
    """
    Process all pending scrapes in a group.
    
    POST /api/services/scrape-groups/{id}/process/
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can process scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    scrape_group = get_object_or_404(ScrapeGroup, id=scrape_group_id)
    
    # Verify ownership
    if scrape_group.created_by != request.user:
        return Response(
            {'error': 'You can only process your own scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get all pending scrapes in group
    scrapes = ServiceProviderScrapedData.objects.filter(
        scrape_group=scrape_group,
        scrape_status='pending'
    )
    
    if not scrapes.exists():
        return Response(
            {'error': 'No pending scrapes in this group'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    scrape_count = scrapes.count()
    
    # Trigger the batch processor - it will pick up all pending scrapes
    task = process_pending_service_provider_scraped_data.delay()
    
    logger.info(
        f"Triggered batch processor for scrape group {scrape_group_id} "
        f"with {scrape_count} pending sources, task: {task.id}"
    )
    
    return Response({
        'scrape_group_id': str(scrape_group_id),
        'scrapes_pending': scrape_count,
        'task_id': str(task.id),
        'message': f'Triggered processing for {scrape_count} sources in {scrape_group.search_query}'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_scrape_groups(request):
    """
    List scrape groups for current user.
    
    GET /api/services/scrape-groups/?limit=10&offset=0
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can view scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Filter by current user
    scrape_groups = ScrapeGroup.objects.filter(
        created_by=request.user
    ).order_by('-created_at')
    
    # Pagination
    limit = int(request.GET.get('limit', 20))
    offset = int(request.GET.get('offset', 0))
    
    total = scrape_groups.count()
    scrape_groups = scrape_groups[offset:offset + limit]
    
    results = []
    for group in scrape_groups:
        scrapes = ServiceProviderScrapedData.objects.filter(scrape_group=group)
        provider_scrape = scrapes.filter(service_provider__isnull=False).first()
        
        results.append({
            'id': str(group.id),
            'search_query': group.search_query,
            'scrape_count': scrapes.count(),
            'provider_created': bool(provider_scrape),
            'provider_id': str(provider_scrape.service_provider.id) if provider_scrape else None,
            'provider_name': provider_scrape.service_provider.business_name if provider_scrape else None,
            'created_at': group.created_at.isoformat(),
            'updated_at': group.updated_at.isoformat()
        })
    
    return Response({
        'count': total,
        'next': offset + limit if offset + limit < total else None,
        'previous': offset - limit if offset > 0 else None,
        'results': results
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_scrape_group(request, scrape_group_id):
    """
    Delete a scrape group (only if no scrapes exist or all are pending).
    
    DELETE /api/services/scrape-groups/{id}/
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only staff members can delete scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    scrape_group = get_object_or_404(ScrapeGroup, id=scrape_group_id)
    
    # Verify ownership
    if scrape_group.created_by != request.user:
        return Response(
            {'error': 'You can only delete your own scrape groups'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if any scrapes are processed
    scrapes = ServiceProviderScrapedData.objects.filter(scrape_group=scrape_group)
    
    if scrapes.filter(scrape_status__in=['completed', 'in_progress']).exists():
        return Response(
            {'error': 'Cannot delete scrape group with processed scrapes. Use archive instead.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Delete all pending/failed scrapes first
    scrapes.delete()
    
    # Now delete the group
    scrape_group.delete()
    logger.info(f"Deleted scrape group {scrape_group_id}")
    
    return Response(status=status.HTTP_204_NO_CONTENT)
