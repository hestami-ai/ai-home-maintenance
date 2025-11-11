"""
DBOS workflow for service provider scraped data ingestion and processing.
"""
import logging
import os
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime
from django.db import transaction
from django.utils import timezone
from dbos import DBOS, DBOSConfiguredInstance

from services.models import (
    ServiceProvider,
    ServiceProviderScrapedData,
    ProviderCategory,
    ServiceCategory
)
from .geo_utils import normalize_service_area
from .identity_resolution import resolve_identity, DEFAULT_WEIGHTS
from .enrichment_utils import (
    geocode_address,
    create_point_from_coords,
    merge_scraped_data,
    generate_embedding,
    prepare_embedding_text
)

logger = logging.getLogger('celery')

# Configuration
HTML_CHUNKER_URL = os.environ.get('HTML_CHUNKER_URL', 'http://html-chunker:8000')
HTML_CHUNKER_LLM = os.environ.get('HTML_CHUNKER_LLM', 'ollama')
HTML_CHUNKER_MODEL = os.environ.get('HTML_CHUNKER_MODEL', 'qwen3:4b-q4_K_M')
HTML_CHUNKER_MAX_TOKENS = int(os.environ.get('HTML_CHUNKER_MAX_TOKENS', '24048'))
HTML_CHUNKER_OVERLAP = float(os.environ.get('HTML_CHUNKER_OVERLAP', '0.1'))
HTML_CHUNKER_LOG_LEVEL = os.environ.get('HTML_CHUNKER_LOG_LEVEL', 'INFO')


@DBOS.dbos_class()
class ServiceProviderIngestionWorkflow:
    """
    DBOS workflow for processing service provider scraped data.
    
    Workflow stages:
    1. HTML Extraction - Call html-chunker API to extract structured data
    2. Load Context - Aggregate historical scraped data for same provider
    3. Geo Normalization - Normalize service areas to structured format
    4. Identity Resolution - Match against existing providers
    5. Field Consolidation - Merge data from multiple sources
    6. Persistence - Create/update ServiceProvider and related models
    7. Status Update - Update scrape_status and workflow metadata
    """
    
    def __init__(self, dbos_instance: DBOSConfiguredInstance):
        self.dbos = dbos_instance
        self.config_name = 'hestami-ai-services'  # Must match the name in dbos_init.py config
    
    @DBOS.workflow()
    def process_scraped_data(self, scraped_data_id: str) -> Dict[str, Any]:
        """
        Main workflow entry point.
        
        Args:
            scraped_data_id: UUID of ServiceProviderScrapedData record
            
        Returns:
            Dict with workflow outcome summary
        """
        logger.info(f"Starting workflow for scraped data {scraped_data_id}")
        
        try:
            # Stage 1: HTML Extraction
            processed_data = self.extract_html(scraped_data_id)
            
            # Stage 2: Load Context
            context = self.load_context(scraped_data_id, processed_data)
            
            # Stage 3: Geo Normalization
            normalized_geo = self.normalize_geography(processed_data)
            
            # Stage 4: Identity Resolution
            resolution_result = self.resolve_identity(scraped_data_id, processed_data, context)
            
            if resolution_result['action'] == 'intervene':
                # Pause for intervention
                self.update_status(
                    scraped_data_id,
                    'paused_intervention',
                    intervention_reason=resolution_result['intervention_reason'],
                    candidate_providers=resolution_result.get('candidates', []),
                    match_scores=resolution_result.get('match_scores', {})
                )
                return {
                    'status': 'paused_intervention',
                    'scraped_data_id': scraped_data_id,
                    'reason': resolution_result['intervention_reason']
                }
            
            # Stage 5: Field Consolidation
            consolidated_data = self.consolidate_fields(
                processed_data,
                context,
                normalized_geo,
                resolution_result
            )
            
            # Stage 6: Persistence
            provider_id = self.persist_provider(
                scraped_data_id,
                consolidated_data,
                resolution_result
            )
            
            # Stage 7: Status Update
            self.update_status(scraped_data_id, 'completed')
            
            logger.info(
                f"Workflow completed for scraped data {scraped_data_id}, "
                f"provider {provider_id}"
            )
            
            return {
                'status': 'completed',
                'scraped_data_id': scraped_data_id,
                'provider_id': str(provider_id),
                'action': resolution_result['action']
            }
            
        except Exception as e:
            logger.exception(f"Workflow failed for scraped data {scraped_data_id}: {e}")
            self.update_status(
                scraped_data_id,
                'failed',
                error_message=str(e)
            )
            return {
                'status': 'failed',
                'scraped_data_id': scraped_data_id,
                'error': str(e)
            }
    
    @DBOS.step()
    def extract_html(self, scraped_data_id: str) -> Dict:
        """
        Extract structured data from raw HTML using html-chunker API.
        Uses the /extract_from_string endpoint with source-aware extraction.
        """
        logger.info(f"Extracting HTML for scraped data {scraped_data_id}")
        
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        
        # If processed_data already exists and is not empty, skip extraction
        if scraped_data.processed_data and len(scraped_data.processed_data) > 0:
            logger.info(f"Processed data already exists for {scraped_data_id}, skipping extraction")
            return scraped_data.processed_data
        
        # Call html-chunker /extract_from_string endpoint with source-aware extraction
        try:
            # Prepare request payload with HTML, raw text, and source URL
            payload = {
                'html_content': scraped_data.raw_html,
                'text_content': scraped_data.raw_text if scraped_data.raw_text else None,
                'source_url': scraped_data.source_url,
                'llm': HTML_CHUNKER_LLM,
                'model': HTML_CHUNKER_MODEL,
                'max_tokens': HTML_CHUNKER_MAX_TOKENS,
                'overlap_percent': HTML_CHUNKER_OVERLAP,
                'log_level': HTML_CHUNKER_LOG_LEVEL,
            }
            
            logger.info(f"Calling html-chunker with source URL: {scraped_data.source_url}")
            
            response = requests.post(
                f"{HTML_CHUNKER_URL}/extract_from_string",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=300  # 5 minute timeout
            )
            
            response.raise_for_status()
            processed_data = response.json()
            
            # Log the structure for debugging
            logger.info(f"HTML chunker response keys: {list(processed_data.keys()) if isinstance(processed_data, dict) else type(processed_data)}")
            
            # Handle raw_content fallback from html-chunker
            # When the html-chunker fails to parse LLM response, it returns {"raw_content": "<json_string>"}
            if isinstance(processed_data, dict) and 'raw_content' in processed_data and 'business_info' not in processed_data:
                logger.warning(f"Detected raw_content fallback from html-chunker, attempting to parse JSON string")
                raw_content = processed_data.get('raw_content', '')
                
                if isinstance(raw_content, str):
                    try:
                        import json
                        parsed_content = json.loads(raw_content)
                        logger.info(f"Successfully parsed raw_content JSON string")
                        processed_data = parsed_content
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse raw_content as JSON: {e}")
                        raise Exception(f"HTML chunker returned unparseable raw_content: {e}")
            
            if isinstance(processed_data, dict) and 'business_info' in processed_data:
                logger.info(f"business_info type: {type(processed_data['business_info'])}")
            
            # Update the scraped_data record with processed data
            scraped_data.processed_data = processed_data
            scraped_data.save(update_fields=['processed_data'])
            
            logger.info(f"Successfully extracted HTML for scraped data {scraped_data_id}")
            return processed_data
            
        except requests.RequestException as e:
            logger.error(f"HTML chunker API error for {scraped_data_id}: {e}")
            raise Exception(f"HTML extraction failed: {e}")
    
    @DBOS.step()
    def load_context(self, scraped_data_id: str, processed_data: Dict) -> Dict:
        """
        Load historical context for the provider being processed.
        Also auto-detects source name from URL if not already set.
        """
        logger.info(f"Loading context for scraped data {scraped_data_id}")
        
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        
        # Auto-detect source_name if empty or generic
        if not scraped_data.source_name or scraped_data.source_name in ['Unknown', 'Pending Detection', '']:
            from .enrichment_utils import detect_source_name
            detected_source = detect_source_name(scraped_data.source_url)
            scraped_data.source_name = detected_source
            scraped_data.save(update_fields=['source_name'])
            logger.info(f"Auto-detected source: {detected_source} from {scraped_data.source_url}")
        
        context = {
            'current_scraped_data': scraped_data,
            'historical_scraped_data': [],
            'existing_provider': None
        }
        
        # If already linked to a provider, load that provider and its other scraped data
        if scraped_data.service_provider:
            context['existing_provider'] = scraped_data.service_provider
            context['historical_scraped_data'] = list(
                ServiceProviderScrapedData.objects.filter(
                    service_provider=scraped_data.service_provider
                ).exclude(id=scraped_data_id)
            )
        
        return context
    
    @DBOS.step()
    def normalize_geography(self, processed_data: Dict) -> Dict:
        """
        Normalize service area geography.
        """
        logger.info("Normalizing geography")
        
        business_info = processed_data.get('business_info', {})
        raw_service_areas = business_info.get('service_areas', [])
        
        if not raw_service_areas:
            logger.warning("No service areas found in processed data")
            return {
                "normalized": {
                    "counties": [],
                    "states": [],
                    "independent_cities": []
                },
                "raw_tags": []
            }
        
        normalized = normalize_service_area(raw_service_areas)
        logger.info(f"Normalized {len(raw_service_areas)} service areas")
        
        return normalized
    
    @DBOS.step()
    def resolve_identity(
        self,
        scraped_data_id: str,
        processed_data: Dict,
        context: Dict
    ) -> Dict:
        """
        Resolve provider identity using multi-step approach:
        1. Check if part of scrape group with existing provider
        2. Check if already linked to a provider
        3. Perform fuzzy matching with multi-signal scoring
        """
        logger.info(f"Resolving identity for scraped data {scraped_data_id}")
        
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        
        # Step 1: Check scrape group first (highest priority)
        if scraped_data.scrape_group:
            # Check if other scrapes in this group already created a provider
            existing_in_group = ServiceProviderScrapedData.objects.filter(
                scrape_group=scraped_data.scrape_group,
                service_provider__isnull=False
            ).exclude(id=scraped_data_id).first()
            
            if existing_in_group:
                logger.info(
                    f"Found existing provider {existing_in_group.service_provider.id} "
                    f"in scrape group {scraped_data.scrape_group.id}"
                )
                return {
                    'action': 'link',
                    'provider': existing_in_group.service_provider,
                    'intervention_reason': None,
                    'candidates': [],
                    'match_scores': {},
                    'link_reason': 'scrape_group'
                }
        
        # Step 2: Check if already linked to a provider
        if context.get('existing_provider'):
            logger.info(f"Already linked to provider {context['existing_provider'].id}")
            return {
                'action': 'link',
                'provider': context['existing_provider'],
                'intervention_reason': None,
                'candidates': [],
                'match_scores': {},
                'link_reason': 'already_linked'
            }
        
        # Step 3: Perform identity resolution with multi-signal scoring
        matched_provider, action, intervention_reason, candidates, match_scores = resolve_identity(
            processed_data,
            weights=DEFAULT_WEIGHTS
        )
        
        return {
            'action': action,
            'provider': matched_provider,
            'intervention_reason': intervention_reason,
            'candidates': candidates or [],
            'match_scores': match_scores or {},
            'link_reason': 'fuzzy_match' if action == 'link' else None
        }
    
    @DBOS.step()
    def consolidate_fields(
        self,
        processed_data: Dict,
        context: Dict,
        normalized_geo: Dict,
        resolution_result: Dict
    ) -> Dict:
        """
        Consolidate fields from multiple sources with provenance tracking.
        """
        logger.info("Consolidating fields")
        
        business_info = processed_data.get('business_info', {})
        
        # Handle case where business_info might be a list (take first item)
        if isinstance(business_info, list):
            logger.warning(f"business_info is a list, taking first item")
            business_info = business_info[0] if business_info else {}
        
        # Ensure business_info is a dict
        if not isinstance(business_info, dict):
            logger.error(f"business_info is not a dict: {type(business_info)}, using empty dict")
            business_info = {}
        
        # Extract license number from license object
        license_info = business_info.get('license', {})
        license_number = None
        if isinstance(license_info, dict):
            # Try to extract just the license number, not the full JSON
            license_number = license_info.get('number') or license_info.get('license_number')
            # If no specific number field, don't store the entire dict
            if not license_number and license_info:
                # Log that we have license info but no extractable number
                logger.info(f"License info present but no 'number' field found: {list(license_info.keys())}")
        elif isinstance(license_info, str):
            # If it's already a string, use it directly
            license_number = license_info
        
        # Extract contact information (phone, address, website)
        contact_info = business_info.get('contact_information', {})
        phone = contact_info.get('phone') or business_info.get('phone')
        website = contact_info.get('website') or business_info.get('website')
        address = contact_info.get('address')
        
        # Build consolidated data
        consolidated = {
            'business_name': business_info.get('name', ''),
            'description': business_info.get('description', ''),
            'phone': phone,
            'website': website,
            'address': address,
            'business_license': license_number,
            'service_area': normalized_geo,
            'rating': 0.0,
            'total_reviews': 0,
            'enriched_sources': [],
            'enrichment_metadata': {}
        }
        
        # Extract rating and reviews
        reviews_data = processed_data.get('reviews', {})
        if reviews_data:
            # overall_rating is a float in the schema (e.g., 5.0)
            overall_rating = reviews_data.get('overall_rating')
            if overall_rating is not None:
                try:
                    consolidated['rating'] = float(overall_rating)
                except (ValueError, TypeError):
                    pass
                
            # Parse total reviews
            total_reviews = reviews_data.get('total_reviews')
            if total_reviews is not None:
                try:
                    # Could be int or string
                    if isinstance(total_reviews, str):
                        total = int(total_reviews.replace(',', ''))
                    else:
                        total = int(total_reviews)
                    consolidated['total_reviews'] = total
                except (ValueError, TypeError):
                    pass
        
        # Track provenance
        scraped_data = context['current_scraped_data']
        consolidated['enriched_sources'].append({
            'source_name': scraped_data.source_name,
            'source_url': scraped_data.source_url,
            'scraped_at': scraped_data.last_scraped_at.isoformat()
        })
        
        # Add services for category creation
        services_data = processed_data.get('services', {})
        consolidated['services_offered'] = services_data.get('offered', [])
        
        return consolidated
    
    @DBOS.step()
    def persist_provider(
        self,
        scraped_data_id: str,
        consolidated_data: Dict,
        resolution_result: Dict
    ) -> str:
        """
        Create or update ServiceProvider and related models.
        """
        logger.info(f"Persisting provider for scraped data {scraped_data_id}")
        
        with transaction.atomic():
            scraped_data = ServiceProviderScrapedData.objects.select_for_update().get(
                id=scraped_data_id
            )
            
            if resolution_result['action'] == 'link':
                # Update existing provider
                provider = resolution_result['provider']
                
                # Merge data (prefer richer data)
                if consolidated_data['description'] and len(consolidated_data['description']) > len(provider.description):
                    provider.description = consolidated_data['description']
                
                # Update contact fields (prefer newer data if available)
                if consolidated_data.get('phone'):
                    provider.phone = consolidated_data['phone']
                if consolidated_data.get('website'):
                    provider.website = consolidated_data['website']
                if consolidated_data.get('business_license'):
                    provider.business_license = consolidated_data['business_license']
                if consolidated_data.get('address') and not provider.address:
                    provider.address = consolidated_data['address']
                
                # Merge service areas
                if consolidated_data['service_area']:
                    provider.service_area = consolidated_data['service_area']
                
                # Update rating (weighted average)
                if consolidated_data['total_reviews'] > 0:
                    total_reviews = provider.total_reviews + consolidated_data['total_reviews']
                    # Convert Decimal to float for calculation
                    current_rating = float(provider.rating) if provider.rating else 0.0
                    new_rating = float(consolidated_data['rating'])
                    
                    total_rating = (
                        current_rating * provider.total_reviews +
                        new_rating * consolidated_data['total_reviews']
                    )
                    provider.rating = total_rating / total_reviews if total_reviews > 0 else 0.0
                    provider.total_reviews = total_reviews
                
                # Merge scraped data into merged_data JSONB field
                provider.merged_data = merge_scraped_data(
                    scraped_data.processed_data,
                    provider.merged_data
                )
                
                # Geocode address if not already geocoded
                # Check if we need to geocode (either no location or no geocode data)
                needs_geocoding = (not provider.business_location or not provider.geocode_address_source)
                if needs_geocoding and consolidated_data.get('address'):
                    address = consolidated_data['address']
                    logger.info(f"Attempting to geocode address for provider {provider.id}: {address}")
                    geo_result = geocode_address(address)
                    if geo_result:
                        provider.business_location = create_point_from_coords(
                            geo_result['latitude'],
                            geo_result['longitude']
                        )
                        provider.address = address
                        provider.plus_code = geo_result.get('plus_code')
                        provider.geocode_address = geo_result.get('full_response', {})
                        provider.geocode_address_source = geo_result.get('source')
                        logger.info(f"Geocoded address for provider {provider.id} using {geo_result.get('source')}")
                    else:
                        logger.warning(f"Failed to geocode address for provider {provider.id}: {address}")
                
                # Generate embedding if description changed
                if consolidated_data['description']:
                    embedding_text = prepare_embedding_text(provider.merged_data)
                    embedding = generate_embedding(embedding_text)
                    if embedding:
                        provider.description_embedding = embedding
                        logger.info(f"Generated embedding for provider {provider.id}")
                
                # Append to enriched sources
                existing_sources = provider.enriched_sources if isinstance(provider.enriched_sources, list) else []
                existing_sources.extend(consolidated_data['enriched_sources'])
                provider.enriched_sources = existing_sources
                provider.enriched_at = timezone.now()
                
                provider.save()
                
            else:  # action == 'create'
                # Prepare enrichment data
                merged_data = scraped_data.processed_data
                
                # Geocode address
                business_location = None
                address = None
                plus_code = None
                geocode_address_data = {}
                geocode_address_source = None
                address_str = consolidated_data.get('address')
                if address_str:
                    geo_result = geocode_address(address_str)
                    if geo_result:
                        business_location = create_point_from_coords(
                            geo_result['latitude'],
                            geo_result['longitude']
                        )
                        address = address_str
                        plus_code = geo_result.get('plus_code')
                        geocode_address_data = geo_result.get('full_response', {})
                        geocode_address_source = geo_result.get('source')
                        logger.info(f"Geocoded address for new provider using {geocode_address_source}")
                
                # Generate embedding
                embedding_text = prepare_embedding_text(merged_data)
                description_embedding = generate_embedding(embedding_text)
                if description_embedding:
                    logger.info(f"Generated embedding for new provider")
                
                # Create new provider
                provider = ServiceProvider.objects.create(
                    business_name=consolidated_data['business_name'],
                    description=consolidated_data['description'],
                    phone=consolidated_data.get('phone'),
                    website=consolidated_data.get('website'),
                    business_license=consolidated_data.get('business_license'),
                    service_area=consolidated_data['service_area'],
                    rating=consolidated_data['rating'],
                    total_reviews=consolidated_data['total_reviews'],
                    business_location=business_location,
                    address=address,
                    plus_code=plus_code,
                    geocode_address=geocode_address_data,
                    geocode_address_source=geocode_address_source,
                    merged_data=merged_data,
                    description_embedding=description_embedding,
                    enriched_sources=consolidated_data['enriched_sources'],
                    enriched_at=timezone.now(),
                    enrichment_metadata=consolidated_data['enrichment_metadata']
                )
                logger.info(f"Created new provider {provider.id}")
            
            # Link scraped data to provider
            scraped_data.service_provider = provider
            scraped_data.save(update_fields=['service_provider'])
            
            # Create ProviderCategory links based on services
            self._create_provider_categories(provider, consolidated_data.get('services_offered', []))
            
            return str(provider.id)
    
    def _create_provider_categories(self, provider: ServiceProvider, services_offered: List[str]):
        """
        Create ProviderCategory links based on scraped services.
        """
        # Map service descriptions to ServiceCategory choices
        # This is a simple keyword-based mapping; could be enhanced with ML
        category_keywords = {
            ServiceCategory.PLUMBING: ['plumb', 'pipe', 'drain', 'faucet', 'toilet', 'water heater'],
            ServiceCategory.ELECTRICAL: ['electric', 'wiring', 'outlet', 'circuit', 'panel'],
            ServiceCategory.HVAC: ['hvac', 'heating', 'cooling', 'air condition', 'furnace', 'ac'],
            ServiceCategory.GENERAL_MAINTENANCE: ['maintenance', 'repair', 'handyman', 'fix'],
            ServiceCategory.LANDSCAPING: ['landscape', 'lawn', 'garden', 'tree', 'yard'],
            ServiceCategory.CLEANING: ['clean', 'janitorial', 'maid'],
            ServiceCategory.SECURITY: ['security', 'alarm', 'surveillance', 'camera'],
            ServiceCategory.PEST_CONTROL: ['pest', 'exterminator', 'termite', 'rodent'],
            ServiceCategory.ROOFING: ['roof', 'shingle', 'gutter'],
            ServiceCategory.REMODELING: ['remodel', 'renovation', 'construction', 'addition'],
        }
        
        matched_categories = set()
        for service in services_offered:
            service_lower = service.lower()
            for category, keywords in category_keywords.items():
                if any(keyword in service_lower for keyword in keywords):
                    matched_categories.add(category)
        
        # Create ProviderCategory entries (with default hourly rate)
        for category in matched_categories:
            ProviderCategory.objects.get_or_create(
                provider=provider,
                category=category,
                defaults={'hourly_rate': 0.0, 'is_active': True}
            )
        
        if matched_categories:
            logger.info(f"Created {len(matched_categories)} category links for provider {provider.id}")
    
    @DBOS.step()
    def update_status(
        self,
        scraped_data_id: str,
        status: str,
        error_message: Optional[str] = None,
        intervention_reason: Optional[str] = None,
        candidate_providers: Optional[List] = None,
        match_scores: Optional[Dict] = None
    ):
        """
        Update scrape_status and related fields.
        """
        logger.info(f"Updating status for scraped data {scraped_data_id} to {status}")
        
        scraped_data = ServiceProviderScrapedData.objects.get(id=scraped_data_id)
        scraped_data.scrape_status = status
        
        update_fields = ['scrape_status']
        
        if error_message:
            scraped_data.error_message = error_message
            update_fields.append('error_message')
        
        if intervention_reason:
            scraped_data.intervention_reason = intervention_reason
            update_fields.append('intervention_reason')
        
        if candidate_providers is not None:
            scraped_data.candidate_providers = candidate_providers
            update_fields.append('candidate_providers')
        
        if match_scores is not None:
            scraped_data.match_scores = match_scores
            update_fields.append('match_scores')
        
        scraped_data.save(update_fields=update_fields)
