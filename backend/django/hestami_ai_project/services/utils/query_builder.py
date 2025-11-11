"""
Flexible query builder for ServiceProvider searches.

Supports composable queries combining:
- Geospatial filters (distance from location)
- JSONB filters (nested field queries on merged_data)
- Semantic search (vector similarity)
- Traditional filters (category, rating, etc.)
"""
from typing import Optional, List, Dict, Any, Tuple
from django.db.models import Q, QuerySet, F
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from pgvector.django import CosineDistance

from services.models import ServiceProvider
from services.workflows.enrichment_utils import generate_embedding


class ServiceProviderQueryBuilder:
    """
    Composable query builder for advanced ServiceProvider searches.
    
    Example usage:
        builder = ServiceProviderQueryBuilder()
        results = (builder
            .near_location(latitude=38.8951, longitude=-77.4311, radius_miles=10)
            .with_min_rating(4.0)
            .with_jsonb_filter('business_info__years_in_business__gte', 5)
            .semantic_search("HVAC repair specialist", limit=20)
            .execute()
        )
    """
    
    def __init__(self):
        self.queryset = ServiceProvider.objects.all()
        self.filters = Q()
        self.annotations = {}
        self.order_by_fields = []
        self.semantic_query = None
        self.semantic_limit = None
        self.similarity_threshold = 0.65  # Default threshold (stricter = lower value, 0.65 = moderate)
    
    def near_location(
        self,
        latitude: float,
        longitude: float,
        radius_miles: Optional[float] = None,
        radius_km: Optional[float] = None
    ) -> 'ServiceProviderQueryBuilder':
        """
        Filter providers within a radius of a location.
        
        Args:
            latitude: Latitude in decimal degrees
            longitude: Longitude in decimal degrees
            radius_miles: Radius in miles (optional)
            radius_km: Radius in kilometers (optional)
            
        Returns:
            Self for chaining
        """
        location = Point(longitude, latitude, srid=4326)
        
        # Annotate with distance
        self.annotations['distance'] = Distance('business_location', location)
        
        # Filter by radius if specified
        if radius_miles:
            self.filters &= Q(business_location__distance_lte=(location, D(mi=radius_miles)))
        elif radius_km:
            self.filters &= Q(business_location__distance_lte=(location, D(km=radius_km)))
        
        # Order by distance (closest first)
        self.order_by_fields.insert(0, 'distance')
        
        return self
    
    def with_min_rating(self, min_rating: float) -> 'ServiceProviderQueryBuilder':
        """
        Filter providers with minimum rating.
        
        Args:
            min_rating: Minimum rating (0.0 to 5.0)
            
        Returns:
            Self for chaining
        """
        self.filters &= Q(rating__gte=min_rating)
        return self
    
    def with_min_reviews(self, min_reviews: int) -> 'ServiceProviderQueryBuilder':
        """
        Filter providers with minimum number of reviews.
        
        Args:
            min_reviews: Minimum review count
            
        Returns:
            Self for chaining
        """
        self.filters &= Q(total_reviews__gte=min_reviews)
        return self
    
    def with_service_area(self, county: Optional[str] = None, state: Optional[str] = None) -> 'ServiceProviderQueryBuilder':
        """
        Filter providers by service area.
        
        Args:
            county: County name (e.g., "Fairfax County")
            state: State name (e.g., "Virginia")
            
        Returns:
            Self for chaining
        """
        if county:
            self.filters &= Q(service_area__normalized__counties__contains=[county])
        if state:
            self.filters &= Q(service_area__normalized__states__contains=[state])
        return self
    
    def with_jsonb_filter(self, path: str, value: Any) -> 'ServiceProviderQueryBuilder':
        """
        Filter by nested JSONB field in merged_data.
        
        Uses Django's JSONField lookup syntax with double underscores.
        
        Args:
            path: JSONField path (e.g., 'business_info__years_in_business__gte')
            value: Value to filter by
            
        Returns:
            Self for chaining
            
        Examples:
            .with_jsonb_filter('business_info__years_in_business__gte', 10)
            .with_jsonb_filter('services__offered__contains', ['HVAC'])
            .with_jsonb_filter('contact_info__email__isnull', False)
        """
        filter_key = f'merged_data__{path}'
        self.filters &= Q(**{filter_key: value})
        return self
    
    def with_license(self, has_license: bool = True) -> 'ServiceProviderQueryBuilder':
        """
        Filter providers by license status.
        
        Args:
            has_license: True to require license, False to exclude licensed
            
        Returns:
            Self for chaining
        """
        if has_license:
            self.filters &= Q(business_license__isnull=False) & ~Q(business_license='')
        else:
            self.filters &= Q(business_license__isnull=True) | Q(business_license='')
        return self
    
    def available_only(self) -> 'ServiceProviderQueryBuilder':
        """
        Filter to only available providers.
        
        Returns:
            Self for chaining
        """
        self.filters &= Q(is_available=True)
        return self
    
    def semantic_search(
        self, 
        query: str, 
        limit: int = 10,
        similarity_threshold: float = 0.65
    ) -> 'ServiceProviderQueryBuilder':
        """
        Perform semantic similarity search using vector embeddings.
        
        This will order results by cosine similarity to the query.
        
        Args:
            query: Natural language search query
            limit: Maximum number of results
            similarity_threshold: Maximum cosine distance (0-1, lower = more similar)
                                 Default 0.65 for moderate filtering
                                 Lower (e.g., 0.3) = stricter (only very similar results)
                                 Higher (e.g., 0.8) = looser (allows somewhat related results)
            
        Returns:
            Self for chaining
        """
        self.semantic_query = query
        self.semantic_limit = limit
        self.similarity_threshold = similarity_threshold
        return self
    
    def order_by(self, *fields: str) -> 'ServiceProviderQueryBuilder':
        """
        Add custom ordering fields.
        
        Args:
            fields: Field names to order by (prefix with '-' for descending)
            
        Returns:
            Self for chaining
        """
        self.order_by_fields.extend(fields)
        return self
    
    def execute(self) -> QuerySet:
        """
        Execute the query and return results.
        
        Returns:
            QuerySet of ServiceProvider objects
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Apply filters
        queryset = self.queryset.filter(self.filters)
        logger.debug(f"[QUERY BUILDER] Base queryset count: {queryset.count()}")
        
        # Apply annotations
        if self.annotations:
            queryset = queryset.annotate(**self.annotations)
            logger.debug(f"[QUERY BUILDER] Applied {len(self.annotations)} annotations")
        
        # Handle semantic search with hybrid scoring
        if self.semantic_query:
            logger.info(f"[QUERY BUILDER] Executing hybrid search for: '{self.semantic_query}'")
            
            # Generate embedding for query
            query_embedding = generate_embedding(self.semantic_query)
            
            if query_embedding:
                logger.info(f"[QUERY BUILDER] Generated embedding with {len(query_embedding)} dimensions")
                
                # Filter to providers with embeddings
                providers_with_embeddings = queryset.exclude(description_embedding__isnull=True).count()
                logger.info(f"[QUERY BUILDER] Providers with embeddings: {providers_with_embeddings}")
                queryset = queryset.exclude(description_embedding__isnull=True)
                
                # Create full-text search vector and query
                from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
                from django.db.models import F, Value, FloatField
                from django.db.models.functions import Coalesce
                
                search_query = SearchQuery(self.semantic_query, config='english')
                logger.debug(f"[QUERY BUILDER] FTS search query: '{self.semantic_query}'")
                
                # Annotate with both FTS and semantic scores in a single query
                queryset = queryset.annotate(
                    # Full-text search score (keyword matching)
                    # Search across business_name, description, and services offered in merged_data
                    search_vector=SearchVector(
                        'business_name',
                        'description',
                        'merged_data__business_info__name',  # Full business name (e.g., "Milcon Roofing, Design & Build")
                        'merged_data__services__offered',    # Services array (e.g., ["roof", "siding"])
                        'merged_data__business_info__description',
                        config='english'
                    ),
                    fts_rank=Coalesce(
                        SearchRank(F('search_vector'), search_query),
                        Value(0.0),
                        output_field=FloatField()
                    ),
                    
                    # Semantic similarity score (0 to 1, higher is better)
                    semantic_distance=CosineDistance('description_embedding', query_embedding),
                    semantic_score=Value(1.0) - F('semantic_distance'),
                    
                    # Hybrid score: weighted combination
                    # 30% keyword matching + 70% semantic similarity
                    hybrid_score=(
                        F('fts_rank') * Value(0.3) +
                        F('semantic_score') * Value(0.7)
                    )
                )
                
                logger.info(f"[QUERY BUILDER] Added hybrid scoring (FTS + semantic)")
                
                # Filter by hybrid score threshold
                # Convert similarity_threshold (distance) to score threshold
                # If distance threshold is 0.45, that means we want similarity > 0.55
                # With 70% weight, minimum semantic contribution is 0.55 * 0.7 = 0.385
                min_hybrid_score = (1.0 - self.similarity_threshold) * 0.7
                
                # Also apply a minimum quality threshold to avoid irrelevant results
                # A hybrid score of 0.35 means at least moderate relevance
                quality_threshold = max(min_hybrid_score, 0.35)
                
                queryset = queryset.filter(hybrid_score__gt=quality_threshold)
                logger.info(f"[QUERY BUILDER] Filtering by hybrid_score > {quality_threshold:.3f}")
                
                # Order by hybrid score (higher is better)
                queryset = queryset.order_by('-hybrid_score')
                
                # Limit results
                if self.semantic_limit:
                    queryset = queryset[:self.semantic_limit]
                    logger.info(f"[QUERY BUILDER] Limited to {self.semantic_limit} results")
                
                # Log top results
                results = list(queryset)
                if results:
                    top = results[0]
                    logger.info(
                        f"[QUERY BUILDER] Top result: {top.business_name} "
                        f"(hybrid: {top.hybrid_score:.3f}, "
                        f"fts: {top.fts_rank:.3f}, "
                        f"semantic: {top.semantic_score:.3f})"
                    )
                    # Log all results for debugging
                    for i, result in enumerate(results[:5]):  # Show top 5
                        logger.debug(
                            f"[QUERY BUILDER] Result {i+1}: {result.business_name} "
                            f"(hybrid: {result.hybrid_score:.3f}, fts: {result.fts_rank:.3f}, semantic: {result.semantic_score:.3f})"
                        )
                else:
                    logger.warning(f"[QUERY BUILDER] No results found for semantic search")
                    
                return results
            else:
                logger.error(f"[QUERY BUILDER] Failed to generate embedding for query: '{self.semantic_query}'")
        
        # Apply ordering
        if self.order_by_fields and not self.semantic_query:
            queryset = queryset.order_by(*self.order_by_fields)
            logger.debug(f"[QUERY BUILDER] Applied ordering: {self.order_by_fields}")
        
        return queryset
    
    def count(self) -> int:
        """
        Count results without executing full query.
        
        Returns:
            Number of matching providers
        """
        return self.queryset.filter(self.filters).count()
    
    def exists(self) -> bool:
        """
        Check if any results exist.
        
        Returns:
            True if any providers match
        """
        return self.queryset.filter(self.filters).exists()


class ServiceProviderSearchPresets:
    """
    Pre-configured search patterns for common use cases.
    """
    
    @staticmethod
    def nearby_highly_rated(
        latitude: float,
        longitude: float,
        radius_miles: float = 25,
        min_rating: float = 4.0,
        min_reviews: int = 5
    ) -> QuerySet:
        """
        Find highly-rated providers near a location.
        
        Args:
            latitude: Latitude
            longitude: Longitude
            radius_miles: Search radius in miles
            min_rating: Minimum rating
            min_reviews: Minimum review count
            
        Returns:
            QuerySet ordered by distance
        """
        return (ServiceProviderQueryBuilder()
            .near_location(latitude, longitude, radius_miles=radius_miles)
            .with_min_rating(min_rating)
            .with_min_reviews(min_reviews)
            .available_only()
            .execute()
        )
    
    @staticmethod
    def semantic_nearby(
        query: str,
        latitude: float,
        longitude: float,
        radius_miles: float = 50,
        limit: int = 10
    ) -> QuerySet:
        """
        Semantic search within a geographic area.
        
        Combines natural language search with location filtering.
        
        Args:
            query: Natural language query
            latitude: Latitude
            longitude: Longitude
            radius_miles: Search radius in miles
            limit: Maximum results
            
        Returns:
            QuerySet ordered by semantic similarity
        """
        return (ServiceProviderQueryBuilder()
            .near_location(latitude, longitude, radius_miles=radius_miles)
            .available_only()
            .semantic_search(query, limit=limit)
            .execute()
        )
    
    @staticmethod
    def experienced_providers(
        min_years: int = 10,
        min_rating: float = 4.0,
        county: Optional[str] = None,
        state: Optional[str] = None
    ) -> QuerySet:
        """
        Find experienced providers in a service area.
        
        Args:
            min_years: Minimum years in business
            min_rating: Minimum rating
            county: County name (optional)
            state: State name (optional)
            
        Returns:
            QuerySet ordered by rating
        """
        builder = (ServiceProviderQueryBuilder()
            .with_jsonb_filter('business_info__years_in_business__gte', min_years)
            .with_min_rating(min_rating)
            .available_only()
            .order_by('-rating', '-total_reviews')
        )
        
        if county or state:
            builder = builder.with_service_area(county=county, state=state)
        
        return builder.execute()
