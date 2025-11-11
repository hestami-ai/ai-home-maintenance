"""
Identity resolution utilities using weighted fuzzy matching.
"""
import logging
from typing import Dict, List, Optional, Tuple
from rapidfuzz import fuzz
from django.db.models import Q

logger = logging.getLogger('celery')

# Configurable weights for fuzzy matching
# NOTE: These weights are designed to be Splink-compatible
# When migrating to Splink, these same weights can be used as priors
DEFAULT_WEIGHTS = {
    'business_name': 0.40,
    'phone': 0.30,
    'website': 0.20,
    'license': 0.10,
}

# Configurable thresholds
# Lowered name threshold since we now consider multiple signals
THRESHOLD_AUTO_LINK = 80.0  # >= 80%: Auto-link to existing provider (was 85)
THRESHOLD_INTERVENTION = 65.0  # 65-79%: Pause for intervention (was 70)
# < 65%: Auto-create new provider

# Bonus for exact matches on high-confidence fields
EXACT_MATCH_BONUS = 15.0  # Add 15% when phone OR website matches exactly


def normalize_phone(phone: Optional[str | list]) -> Optional[str]:
    """Normalize phone number to digits only. Handles both string and list inputs."""
    if not phone:
        return None
    
    # If it's a list, take the first non-empty value
    if isinstance(phone, list):
        phone = next((p for p in phone if p), None)
        if not phone:
            return None
    
    # Ensure it's a string at this point
    if not isinstance(phone, str):
        return None
    
    return ''.join(filter(str.isdigit, phone))


def normalize_website(website: Optional[str | list]) -> Optional[str]:
    """Normalize website URL. Handles both string and list inputs."""
    if not website:
        return None
    
    # If it's a list, take the first non-empty value
    if isinstance(website, list):
        website = next((w for w in website if w), None)
        if not website:
            return None
    
    # Ensure it's a string at this point
    if not isinstance(website, str):
        return None
    
    website = website.lower().strip()
    # Remove protocol and www
    for prefix in ['https://', 'http://', 'www.']:
        if website.startswith(prefix):
            website = website[len(prefix):]
    # Remove trailing slash
    return website.rstrip('/')


def calculate_match_score(
    scraped_data: Dict,
    existing_provider: 'ServiceProvider',
    weights: Optional[Dict[str, float]] = None
) -> Tuple[float, Dict[str, float]]:
    """
    Calculate weighted fuzzy match score between scraped data and existing provider.
    
    Multi-signal approach: Considers ALL available evidence together.
    When phone or website match exactly, we're more lenient on name variations.
    This mimics Splink's probabilistic approach in a simpler form.
    
    Args:
        scraped_data: Processed data from ServiceProviderScrapedData
        existing_provider: Existing ServiceProvider instance
        weights: Optional custom weights (defaults to DEFAULT_WEIGHTS)
        
    Returns:
        Tuple of (total_score, component_scores)
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS
    
    component_scores = {}
    total_score = 0.0
    total_weight = 0.0
    has_exact_match = False  # Track if we have strong evidence
    
    # Extract data from scraped_data
    business_info = scraped_data.get('business_info', {})
    
    # Handle case where business_info might be a list (take first item)
    if isinstance(business_info, list):
        business_info = business_info[0] if business_info else {}
    
    # Ensure business_info is a dict
    if not isinstance(business_info, dict):
        business_info = {}
    
    scraped_name = business_info.get('name', '')
    
    # Extract contact information (should be an object per schema)
    contact_info = business_info.get('contact_information', {})
    if not isinstance(contact_info, dict):
        contact_info = {}
    
    scraped_phone = normalize_phone(contact_info.get('phone'))
    scraped_website = normalize_website(contact_info.get('website'))
    
    # Extract license (should be an object per schema)
    license_info = business_info.get('license', {})
    if not isinstance(license_info, dict):
        license_info = {}
    
    scraped_license = license_info.get('number')
    
    # Company name matching
    if scraped_name and existing_provider.business_name:
        name_score = fuzz.token_sort_ratio(
            scraped_name.lower(),
            existing_provider.business_name.lower()
        )
        component_scores['business_name'] = name_score
        total_score += name_score * weights['business_name']
        total_weight += weights['business_name']
    
    # Phone matching (exact match on normalized numbers)
    existing_phone = normalize_phone(existing_provider.phone or '')
    
    if scraped_phone and existing_phone:
        if scraped_phone == existing_phone:
            phone_score = 100.0
            has_exact_match = True  # Strong evidence!
        else:
            phone_score = 0.0
        component_scores['phone'] = phone_score
        total_score += phone_score * weights['phone']
        total_weight += weights['phone']
    else:
        component_scores['phone'] = 0.0
    
    # Website matching (domain comparison)
    scraped_website = normalize_website(contact_info.get('website'))
    existing_website = normalize_website(existing_provider.website or '')
    
    if scraped_website and existing_website:
        if scraped_website == existing_website:
            website_score = 100.0
            has_exact_match = True  # Strong evidence!
        else:
            # Partial match on domain
            website_score = fuzz.ratio(scraped_website, existing_website)
        component_scores['website'] = website_score
        total_score += website_score * weights['website']
        total_weight += weights['website']
    else:
        component_scores['website'] = 0.0
    
    # License matching (exact match)
    # scraped_license was already extracted above from license_info.get('number')
    scraped_license_normalized = (scraped_license or '').strip().upper() if scraped_license else ''
    existing_license = (existing_provider.business_license or '').strip().upper()
    
    if scraped_license_normalized and existing_license:
        if scraped_license_normalized == existing_license:
            license_score = 100.0
            has_exact_match = True  # Strong evidence!
        else:
            license_score = 0.0
        component_scores['license'] = license_score
        total_score += license_score * weights['license']
        total_weight += weights['license']
    else:
        component_scores['license'] = 0.0
    
    # Calculate final score (normalize by actual weights used)
    if total_weight > 0:
        final_score = total_score / total_weight
    else:
        final_score = 0.0
    
    # Apply exact match bonus if we have strong evidence
    # This helps with name variations like "Milcon Roofing, Design & Build" vs "Milcon Design & Build"
    if has_exact_match and final_score > 0:
        final_score = min(100.0, final_score + EXACT_MATCH_BONUS)
        logger.debug(
            f"Applied exact match bonus (+{EXACT_MATCH_BONUS}%) due to phone/website/license match"
        )
    
    logger.debug(
        f"Match score for '{scraped_name}' vs '{existing_provider.business_name}': "
        f"{final_score:.2f}% (components: {component_scores}, exact_match_bonus: {has_exact_match})"
    )
    
    return final_score, component_scores


def find_matching_providers(
    scraped_data: Dict,
    weights: Optional[Dict[str, float]] = None
) -> List[Tuple['ServiceProvider', float, Dict[str, float]]]:
    """
    Find potential matching providers for scraped data.
    
    Args:
        scraped_data: Processed data from ServiceProviderScrapedData
        weights: Optional custom weights
        
    Returns:
        List of tuples (provider, score, component_scores) sorted by score descending
    """
    from services.models import ServiceProvider
    
    business_info = scraped_data.get('business_info', {})
    
    # Handle case where business_info might be a list (take first item)
    if isinstance(business_info, list):
        business_info = business_info[0] if business_info else {}
    
    # Ensure business_info is a dict
    if not isinstance(business_info, dict):
        logger.error(f"business_info is not a dict: {type(business_info)}")
        return []
    
    scraped_name = business_info.get('name', '')
    
    if not scraped_name:
        logger.warning("No company name in scraped data, cannot perform identity resolution")
        return []
    
    # Query for providers with similar names (broad filter)
    # Extract first word of company name for initial filtering
    name_parts = scraped_name.split()
    if not name_parts:
        return []
    
    first_word = name_parts[0].lower()
    
    # Get all providers (in production, add more sophisticated filtering)
    # For now, get all providers and score them
    existing_providers = ServiceProvider.objects.all()
    
    matches = []
    for provider in existing_providers:
        score, components = calculate_match_score(scraped_data, provider, weights)
        if score >= THRESHOLD_INTERVENTION:  # Only include scores above intervention threshold
            matches.append((provider, score, components))
    
    # Sort by score descending
    matches.sort(key=lambda x: x[1], reverse=True)
    
    return matches


def resolve_identity(
    scraped_data: Dict,
    weights: Optional[Dict[str, float]] = None
) -> Tuple[Optional['ServiceProvider'], str, Optional[str], Optional[List[str]], Optional[Dict[str, float]]]:
    """
    Resolve identity for scraped provider data.
    
    Args:
        scraped_data: Processed data from ServiceProviderScrapedData
        weights: Optional custom weights
        
    Returns:
        Tuple of (matched_provider, action, intervention_reason, candidates, match_scores)
        - action: 'link' (auto-link), 'create' (auto-create), or 'intervene' (needs manual review)
        - intervention_reason: Explanation if action is 'intervene', else None
        - candidates: List of candidate provider IDs for intervention, else None
        - match_scores: Dict of provider_id -> score for intervention, else None
    """
    matches = find_matching_providers(scraped_data, weights)
    
    if not matches:
        # No matches found, auto-create new provider
        logger.info("No matching providers found, will create new provider")
        return None, 'create', None, None, None
    
    best_match, best_score, components = matches[0]
    
    if best_score >= THRESHOLD_AUTO_LINK:
        # High confidence match, auto-link
        logger.info(
            f"High confidence match ({best_score:.2f}%) with provider {best_match.id}, "
            f"will auto-link"
        )
        return best_match, 'link', None, None, None
    
    elif best_score >= THRESHOLD_INTERVENTION:
        # Ambiguous match, needs intervention
        intervention_reason = (
            f"Ambiguous identity match found. Top candidates:\n"
        )
        candidates = []
        match_scores = {}
        
        for i, (provider, score, comp) in enumerate(matches[:3], 1):  # Show top 3
            intervention_reason += (
                f"{i}. {provider.business_name} (ID: {provider.id}) - "
                f"Score: {score:.2f}% (name: {comp.get('business_name', 0):.1f}%)\n"
            )
            candidates.append(str(provider.id))
            match_scores[str(provider.id)] = score
        
        intervention_reason += (
            f"\nPlease manually link the scraped data to the correct provider or "
            f"create a new provider if none match."
        )
        
        logger.info(
            f"Ambiguous match ({best_score:.2f}%) with provider {best_match.id}, "
            f"needs intervention. Candidates: {candidates}"
        )
        return None, 'intervene', intervention_reason, candidates, match_scores
    
    else:
        # Below intervention threshold, auto-create
        logger.info(
            f"Low confidence match ({best_score:.2f}%) with provider {best_match.id}, "
            f"will create new provider"
        )
        return None, 'create', None, None, None
