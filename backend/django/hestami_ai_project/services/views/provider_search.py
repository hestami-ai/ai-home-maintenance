"""
API endpoints for staff to search and discover service providers.

Provides advanced search capabilities using PostGIS and pgvector.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes

from services.models import ServiceProvider
from services.serializers import ServiceProviderSerializer
from services.utils.query_builder import ServiceProviderQueryBuilder, ServiceProviderSearchPresets


class IsStaff(BasePermission):
    """
    Permission check for staff users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class ProviderSearchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Advanced search API for service providers.
    
    Staff-only endpoints for discovering providers using:
    - Geospatial queries (location-based)
    - JSONB queries (rich data filtering)
    - Semantic search (natural language)
    - Combined queries
    """
    queryset = ServiceProvider.objects.all()
    serializer_class = ServiceProviderSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    
    @extend_schema(
        summary="Advanced provider search",
        description="""
        Search providers using flexible filters:
        - **Geospatial**: Find providers near a location
        - **Rating**: Filter by minimum rating and review count
        - **Service Area**: Filter by county or state
        - **JSONB**: Query nested fields in merged_data
        - **Semantic**: Natural language similarity search
        
        All filters can be combined.
        """,
        parameters=[
            OpenApiParameter(
                name='latitude',
                type=OpenApiTypes.FLOAT,
                description='Latitude for location-based search'
            ),
            OpenApiParameter(
                name='longitude',
                type=OpenApiTypes.FLOAT,
                description='Longitude for location-based search'
            ),
            OpenApiParameter(
                name='radius_miles',
                type=OpenApiTypes.FLOAT,
                description='Search radius in miles (requires latitude/longitude)'
            ),
            OpenApiParameter(
                name='min_rating',
                type=OpenApiTypes.FLOAT,
                description='Minimum rating (0.0 to 5.0)'
            ),
            OpenApiParameter(
                name='min_reviews',
                type=OpenApiTypes.INT,
                description='Minimum number of reviews'
            ),
            OpenApiParameter(
                name='county',
                type=OpenApiTypes.STR,
                description='Filter by county name'
            ),
            OpenApiParameter(
                name='state',
                type=OpenApiTypes.STR,
                description='Filter by state name'
            ),
            OpenApiParameter(
                name='has_license',
                type=OpenApiTypes.BOOL,
                description='Filter by license status'
            ),
            OpenApiParameter(
                name='available_only',
                type=OpenApiTypes.BOOL,
                description='Show only available providers',
                default=True
            ),
            OpenApiParameter(
                name='semantic_query',
                type=OpenApiTypes.STR,
                description='Natural language search query (e.g., "HVAC repair specialist")'
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                description='Maximum results for semantic search',
                default=20
            ),
        ],
        examples=[
            OpenApiExample(
                'Nearby HVAC specialists',
                value={
                    'latitude': 38.8951,
                    'longitude': -77.4311,
                    'radius_miles': 25,
                    'semantic_query': 'HVAC repair and maintenance',
                    'min_rating': 4.0
                }
            ),
            OpenApiExample(
                'Experienced plumbers in Fairfax',
                value={
                    'county': 'Fairfax County',
                    'state': 'Virginia',
                    'min_rating': 4.5,
                    'min_reviews': 10
                }
            ),
        ]
    )
    @action(detail=False, methods=['get', 'post'])
    def search(self, request):
        """
        Advanced search with flexible filters.
        
        Supports both GET and POST for complex queries.
        """
        # Get parameters (support both GET and POST)
        params = request.query_params if request.method == 'GET' else request.data
        
        # Build query
        builder = ServiceProviderQueryBuilder()
        
        # Geospatial filter
        latitude = params.get('latitude')
        longitude = params.get('longitude')
        radius_miles = params.get('radius_miles')
        
        if latitude and longitude:
            try:
                lat = float(latitude)
                lon = float(longitude)
                radius = float(radius_miles) if radius_miles else None
                builder = builder.near_location(lat, lon, radius_miles=radius)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid latitude/longitude/radius values'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Rating filters
        min_rating = params.get('min_rating')
        if min_rating:
            try:
                builder = builder.with_min_rating(float(min_rating))
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid min_rating value'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        min_reviews = params.get('min_reviews')
        if min_reviews:
            try:
                builder = builder.with_min_reviews(int(min_reviews))
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid min_reviews value'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Service area filters
        county = params.get('county')
        state = params.get('state')
        if county or state:
            builder = builder.with_service_area(county=county, state=state)
        
        # License filter
        has_license = params.get('has_license')
        if has_license is not None:
            builder = builder.with_license(has_license in ['true', 'True', '1', True])
        
        # Available only (default True)
        available_only = params.get('available_only', 'true')
        if available_only in ['true', 'True', '1', True]:
            builder = builder.available_only()
        
        # Semantic search
        semantic_query = params.get('semantic_query')
        if semantic_query:
            limit = int(params.get('limit', 20))
            builder = builder.semantic_search(semantic_query, limit=limit)
        
        # Execute query
        results = builder.execute()
        
        # Serialize and return
        serializer = self.get_serializer(results, many=True)
        return Response({
            'count': len(results),
            'results': serializer.data
        })
    
    @extend_schema(
        summary="Find nearby providers",
        description="Find providers within a radius of a location, ordered by distance.",
        parameters=[
            OpenApiParameter(name='latitude', type=OpenApiTypes.FLOAT, required=True),
            OpenApiParameter(name='longitude', type=OpenApiTypes.FLOAT, required=True),
            OpenApiParameter(name='radius_miles', type=OpenApiTypes.FLOAT, default=25),
            OpenApiParameter(name='min_rating', type=OpenApiTypes.FLOAT, default=4.0),
            OpenApiParameter(name='min_reviews', type=OpenApiTypes.INT, default=5),
        ]
    )
    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """
        Preset: Find highly-rated providers near a location.
        """
        try:
            latitude = float(request.query_params.get('latitude'))
            longitude = float(request.query_params.get('longitude'))
            radius_miles = float(request.query_params.get('radius_miles', 25))
            min_rating = float(request.query_params.get('min_rating', 4.0))
            min_reviews = int(request.query_params.get('min_reviews', 5))
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid parameters'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = ServiceProviderSearchPresets.nearby_highly_rated(
            latitude=latitude,
            longitude=longitude,
            radius_miles=radius_miles,
            min_rating=min_rating,
            min_reviews=min_reviews
        )
        
        serializer = self.get_serializer(results, many=True)
        return Response({
            'count': len(results),
            'results': serializer.data
        })
    
    @extend_schema(
        summary="Semantic search",
        description="Natural language search using vector embeddings.",
        parameters=[
            OpenApiParameter(name='query', type=OpenApiTypes.STR, required=True, description='Natural language query'),
            OpenApiParameter(name='latitude', type=OpenApiTypes.FLOAT, description='Optional: Filter by location'),
            OpenApiParameter(name='longitude', type=OpenApiTypes.FLOAT, description='Optional: Filter by location'),
            OpenApiParameter(name='radius_miles', type=OpenApiTypes.FLOAT, default=50),
            OpenApiParameter(name='limit', type=OpenApiTypes.INT, default=10),
        ]
    )
    @action(detail=False, methods=['get', 'post'])
    def semantic(self, request):
        """
        Preset: Semantic search with optional location filtering.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        params = request.query_params if request.method == 'GET' else request.data
        
        query = params.get('query')
        logger.info(f"[SEMANTIC SEARCH] Received query: '{query}'")
        
        if not query:
            return Response(
                {'error': 'query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        latitude = params.get('latitude')
        longitude = params.get('longitude')
        
        try:
            limit = int(params.get('limit', 10))
            logger.info(f"[SEMANTIC SEARCH] Parameters - limit: {limit}, location: {latitude}, {longitude}")
            
            if latitude and longitude:
                # Semantic search with location filter
                lat = float(latitude)
                lon = float(longitude)
                radius_miles = float(params.get('radius_miles', 50))
                
                logger.info(f"[SEMANTIC SEARCH] Using location filter: ({lat}, {lon}) radius: {radius_miles} miles")
                results = ServiceProviderSearchPresets.semantic_nearby(
                    query=query,
                    latitude=lat,
                    longitude=lon,
                    radius_miles=radius_miles,
                    limit=limit
                )
            else:
                # Pure semantic search
                logger.info(f"[SEMANTIC SEARCH] Pure semantic search without location filter")
                results = (ServiceProviderQueryBuilder()
                    .available_only()
                    .semantic_search(query, limit=limit)
                    .execute()
                )
            
            logger.info(f"[SEMANTIC SEARCH] Found {len(results)} results")
            if results:
                logger.debug(f"[SEMANTIC SEARCH] First result: {results[0].business_name} (similarity: {getattr(results[0], 'similarity', 'N/A')})")
                
        except (ValueError, TypeError) as e:
            logger.error(f"[SEMANTIC SEARCH] Parameter error: {str(e)}")
            return Response(
                {'error': f'Invalid parameters: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[SEMANTIC SEARCH] Unexpected error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Search failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        serializer = self.get_serializer(results, many=True)
        return Response({
            'count': len(results),
            'query': query,
            'results': serializer.data
        })
    
    @extend_schema(
        summary="Find experienced providers",
        description="Find providers with significant experience in a service area.",
        parameters=[
            OpenApiParameter(name='min_years', type=OpenApiTypes.INT, default=10),
            OpenApiParameter(name='min_rating', type=OpenApiTypes.FLOAT, default=4.0),
            OpenApiParameter(name='county', type=OpenApiTypes.STR),
            OpenApiParameter(name='state', type=OpenApiTypes.STR),
        ]
    )
    @action(detail=False, methods=['get'])
    def experienced(self, request):
        """
        Preset: Find experienced providers in a service area.
        """
        try:
            min_years = int(request.query_params.get('min_years', 10))
            min_rating = float(request.query_params.get('min_rating', 4.0))
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid min_years or min_rating'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        county = request.query_params.get('county')
        state = request.query_params.get('state')
        
        results = ServiceProviderSearchPresets.experienced_providers(
            min_years=min_years,
            min_rating=min_rating,
            county=county,
            state=state
        )
        
        serializer = self.get_serializer(results, many=True)
        return Response({
            'count': len(results),
            'results': serializer.data
        })
