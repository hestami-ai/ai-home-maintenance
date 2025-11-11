"""
API views for service provider ingestion workflow.
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from users.authentication import ServiceTokenAuthentication
from django.utils import timezone

from services.models.base_models import ServiceProviderScrapedData
from services.permissions import IsHestamaiStaff

logger = logging.getLogger(__name__)


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def add_provider_to_roster(request):
    """
    Add a service provider to the roster by creating a ServiceProviderScrapedData record.
    This triggers the DBOS ingestion workflow.
    
    Expected payload:
    {
        "source_name": "Yelp",  // Optional, auto-detected from URL if not provided
        "source_url": "https://www.yelp.com/biz/acme-hvac",
        "raw_html": "<html>...</html>",  // Optional, can be fetched later
        "raw_text": "Plain text content",  // Optional
        "notes": "Found via manual search"  // Optional
    }
    """
    try:
        # Validate required fields
        source_url = request.data.get('source_url')
        
        if not source_url:
            return Response(
                {"error": "source_url is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Auto-detect source_name from URL if not provided
        source_name = request.data.get('source_name')
        if not source_name:
            from urllib.parse import urlparse
            parsed_url = urlparse(source_url)
            domain = parsed_url.netloc.replace('www.', '')
            # Extract main domain name (e.g., 'yelp.com' -> 'Yelp')
            source_name = domain.split('.')[0].capitalize()
            logger.info(f"Auto-detected source_name '{source_name}' from URL {source_url}")
        
        # Create scraped data record
        scraped_data = ServiceProviderScrapedData.objects.create(
            source_name=source_name,
            source_url=source_url,
            raw_html=request.data.get('raw_html', ''),
            raw_text=request.data.get('raw_text', ''),
            notes=request.data.get('notes', ''),
            scrape_status='pending',
            last_scraped_at=timezone.now()
        )
        
        logger.info(
            f"Created ServiceProviderScrapedData {scraped_data.id} for {source_name} "
            f"by user {request.user.email}"
        )
        
        return Response(
            {
                "id": str(scraped_data.id),
                "source_name": scraped_data.source_name,
                "source_url": scraped_data.source_url,
                "scrape_status": scraped_data.scrape_status,
                "message": "Provider added to ingestion queue. Processing will begin shortly."
            },
            status=status.HTTP_201_CREATED
        )
    
    except Exception as e:
        logger.error(f"Error adding provider to roster: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to add provider to roster"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def get_scraped_data_status(request, scraped_data_id):
    """
    Get the status of a ServiceProviderScrapedData record.
    """
    try:
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        
        response_data = {
            "id": str(scraped_data.id),
            "source_name": scraped_data.source_name,
            "source_url": scraped_data.source_url,
            "scrape_status": scraped_data.scrape_status,
            "workflow_id": scraped_data.workflow_id,
            "last_scraped_at": scraped_data.last_scraped_at,
            "processed_at": scraped_data.processed_at,
            "error_message": scraped_data.error_message,
            "service_provider_id": str(scraped_data.service_provider_id) if scraped_data.service_provider_id else None,
        }
        
        # Include intervention data if paused
        if scraped_data.scrape_status == 'paused_intervention':
            response_data['intervention_data'] = {
                'reason': scraped_data.intervention_reason,
                'candidate_providers': scraped_data.candidate_providers,
                'match_scores': scraped_data.match_scores,
            }
        
        return Response(response_data)
    
    except ServiceProviderScrapedData.DoesNotExist:
        return Response(
            {"error": "Scraped data not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error getting scraped data status: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to get status"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def resolve_intervention(request, scraped_data_id):
    """
    Resolve an intervention for a paused ServiceProviderScrapedData record.
    
    Expected payload:
    {
        "action": "link",  // or "create"
        "provider_id": "uuid"  // Required if action is "link"
    }
    """
    try:
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        
        if scraped_data.scrape_status != 'paused_intervention':
            return Response(
                {"error": "This record is not paused for intervention"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get('action')
        if action not in ['link', 'create']:
            return Response(
                {"error": "action must be 'link' or 'create'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if action == 'link':
            provider_id = request.data.get('provider_id')
            if not provider_id:
                return Response(
                    {"error": "provider_id is required when action is 'link'"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify provider exists
            from services.models import ServiceProvider
            try:
                provider = ServiceProvider.objects.get(id=provider_id)
            except ServiceProvider.DoesNotExist:
                return Response(
                    {"error": "Provider not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Link to provider
            scraped_data.service_provider = provider
            scraped_data.scrape_status = 'completed'
            scraped_data.processed_at = timezone.now()
            scraped_data.intervention_reason = None
            scraped_data.save()
            
            logger.info(
                f"Intervention resolved: Linked scraped data {scraped_data_id} to provider {provider_id} "
                f"by user {request.user.email}"
            )
            
            return Response({
                "message": "Successfully linked to existing provider",
                "provider_id": str(provider_id)
            })
        
        else:  # action == 'create'
            # Resume workflow to create new provider
            scraped_data.scrape_status = 'pending'
            scraped_data.intervention_reason = None
            scraped_data.save()
            
            logger.info(
                f"Intervention resolved: Resuming workflow to create new provider for {scraped_data_id} "
                f"by user {request.user.email}"
            )
            
            return Response({
                "message": "Workflow resumed to create new provider"
            })
    
    except ServiceProviderScrapedData.DoesNotExist:
        return Response(
            {"error": "Scraped data not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error resolving intervention: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to resolve intervention"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([JWTAuthentication, ServiceTokenAuthentication])
@permission_classes([IsAuthenticated, IsHestamaiStaff])
def list_pending_interventions(request):
    """
    List all ServiceProviderScrapedData records that are paused for intervention.
    """
    try:
        pending = ServiceProviderScrapedData.objects.filter(
            scrape_status='paused_intervention'
        ).order_by('-last_scraped_at')
        
        results = []
        for scraped_data in pending:
            # Fetch full provider details for candidates
            candidate_providers = []
            if scraped_data.candidate_providers:
                from services.models.base_models import ServiceProvider
                provider_ids = scraped_data.candidate_providers
                providers = ServiceProvider.objects.filter(id__in=provider_ids)
                
                for provider in providers:
                    candidate_providers.append({
                        "id": str(provider.id),
                        "business_name": provider.business_name,
                        "phone": provider.phone,
                        "website": provider.website,
                    })
            
            # Extract scraped business info for comparison
            scraped_business_info = {}
            if scraped_data.processed_data:
                business_info = scraped_data.processed_data.get('business_info', {})
                contact_info = business_info.get('contact_information', {})
                if not isinstance(contact_info, dict):
                    contact_info = {}
                
                scraped_business_info = {
                    "name": business_info.get('name', ''),
                    "phone": business_info.get('phone', ''),
                    "website": contact_info.get('website', ''),
                    "description": business_info.get('description', ''),
                }
            
            results.append({
                "id": str(scraped_data.id),
                "source_name": scraped_data.source_name,
                "source_url": scraped_data.source_url,
                "last_scraped_at": scraped_data.last_scraped_at,
                "intervention_reason": scraped_data.intervention_reason,
                "scraped_business_info": scraped_business_info,
                "candidate_providers": candidate_providers,
                "match_scores": scraped_data.match_scores,
            })
        
        return Response({
            "count": len(results),
            "results": results
        })
    
    except Exception as e:
        logger.error(f"Error listing pending interventions: {str(e)}", exc_info=True)
        return Response(
            {"error": "Failed to list pending interventions"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
