# PostGIS & pgvector Implementation Plan
**Status**: Database Upgraded ✅ | Django Configuration In Progress  
**Date**: November 6, 2025

---

## ✅ Completed: Database Migration

- [x] PostgreSQL 18 + PostGIS 3.6 + pgvector 0.8.1 installed
- [x] Extensions enabled (postgis, vector, pg_trgm, btree_gin, unaccent)
- [x] Data migrated from PostgreSQL 17
- [x] Database running on port 5432
- [x] Django settings updated (`django.contrib.gis` added, PostGIS engine configured)

---

## 🔄 Phase 2: Update Dependencies & Docker

### **2.1 Update Python Requirements**

**File**: `backend/django/requirements.txt`

Add:
```txt
# PostGIS support
GDAL>=3.7.0,<4.0.0

# pgvector for semantic search
pgvector>=0.2.4

# OpenAI for embeddings
openai>=1.0.0
```

### **2.2 Update Django Dockerfile**

**File**: `docker/backend/django/Dockerfile`

Add GDAL installation (required for PostGIS):
```dockerfile
FROM python:3.11-slim

# Install GDAL for PostGIS support
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL library path
ENV GDAL_LIBRARY_PATH=/usr/lib/libgdal.so

# ... rest of Dockerfile
```

### **2.3 Rebuild Django Container**

```powershell
# Rebuild with new dependencies
docker compose -f compose.dev.yaml build api

# Restart
docker compose -f compose.dev.yaml up -d api
```

---

## 🔄 Phase 3: Update ServiceProvider Model

### **3.1 Add New Fields**

**File**: `backend/django/hestami_ai_project/services/models/base_models.py`

```python
from django.contrib.gis.db import models as gis_models
from pgvector.django import VectorField

class ServiceProvider(models.Model):
    # ... existing fields ...
    
    # NEW: Geospatial fields
    business_location = gis_models.PointField(
        geography=True,
        srid=4326,  # WGS84 coordinate system
        null=True,
        blank=True,
        help_text="Geographic location of business (latitude, longitude)"
    )
    
    address = models.TextField(
        blank=True,
        null=True,
        help_text="Full business address"
    )
    
    plus_code = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Google Plus Code for location"
    )
    
    # NEW: Service area polygon (optional - for future use)
    # service_area_polygon = gis_models.MultiPolygonField(
    #     geography=True,
    #     srid=4326,
    #     null=True,
    #     blank=True,
    #     help_text="Geographic service area coverage"
    # )
    
    # NEW: Rich merged data from all scraped sources
    merged_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Consolidated data from all scraped sources (JSONB with GIN index)"
    )
    
    # NEW: Vector embeddings for semantic search
    description_embedding = VectorField(
        dimensions=1536,  # OpenAI text-embedding-3-small
        null=True,
        blank=True,
        help_text="Vector embedding of business description for semantic search"
    )
    
    class Meta:
        indexes = [
            # Existing indexes...
            
            # NEW: Spatial index for location queries
            gis_models.Index(fields=['business_location']),
            
            # NEW: GIN index for JSONB queries
            models.Index(fields=['merged_data'], name='merged_data_gin', opclasses=['jsonb_path_ops']),
            
            # NEW: HNSW index for vector similarity (created via migration)
            # VectorField automatically creates index, but we'll add explicit migration
        ]
```

### **3.2 Create Django Migration**

```powershell
# Generate migration
docker compose -f compose.dev.yaml exec api python manage.py makemigrations services

# Review migration file
# Should create:
# - business_location (PointField)
# - address (TextField)
# - plus_code (CharField)
# - merged_data (JSONField)
# - description_embedding (VectorField)
# - Indexes for location, JSONB, and vector
```

### **3.3 Create Custom Migration for HNSW Index**

**File**: `backend/django/hestami_ai_project/services/migrations/XXXX_add_vector_index.py`

```python
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('services', 'XXXX_add_postgis_fields'),  # Previous migration
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS services_serviceprovider_embedding_idx 
            ON services_serviceprovider 
            USING hnsw (description_embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            """,
            reverse_sql="DROP INDEX IF EXISTS services_serviceprovider_embedding_idx;"
        ),
    ]
```

### **3.4 Run Migrations**

```powershell
# Apply migrations
docker compose -f compose.dev.yaml exec api python manage.py migrate

# Verify
docker compose -f compose.dev.yaml exec db psql -U hestami_user -d hestami_db -c "\d services_serviceprovider"
```

---

## 🔄 Phase 4: Update DBOS Workflow

### **4.1 Add Geocoding Step**

**File**: `backend/django/hestami_ai_project/services/workflows/provider_ingestion.py`

```python
from django.contrib.gis.geos import Point
import requests

@DBOS.step()
def geocode_provider(self, provider_id: int, processed_data: dict) -> dict:
    """
    Geocode provider address to get coordinates.
    Uses Nominatim (OpenStreetMap) for geocoding.
    """
    # Extract address from processed_data
    contact_info = processed_data.get('contact_information', {})
    address = contact_info.get('address')
    plus_code = contact_info.get('plus_code')
    
    coordinates = None
    
    # Try Plus Code first (more accurate)
    if plus_code:
        try:
            # Decode Plus Code to coordinates
            # You'll need to implement or use a library
            coordinates = decode_plus_code(plus_code)
        except Exception as e:
            logger.warning(f"Failed to decode Plus Code {plus_code}: {e}")
    
    # Fallback to address geocoding
    if not coordinates and address:
        try:
            # Use Nominatim for geocoding
            response = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={
                    'q': address,
                    'format': 'json',
                    'limit': 1
                },
                headers={'User-Agent': 'Hestami-AI/1.0'}
            )
            results = response.json()
            if results:
                coordinates = (float(results[0]['lon']), float(results[0]['lat']))
        except Exception as e:
            logger.warning(f"Failed to geocode address {address}: {e}")
    
    return {
        'provider_id': provider_id,
        'coordinates': coordinates,
        'address': address,
        'plus_code': plus_code
    }

@DBOS.step()
def generate_embeddings(self, provider_id: int, merged_data: dict) -> dict:
    """
    Generate vector embeddings for semantic search.
    Uses OpenAI text-embedding-3-small (1536 dimensions).
    """
    from openai import OpenAI
    import os
    
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Create description from merged data
    description_parts = []
    
    if merged_data.get('business_info', {}).get('business_name'):
        description_parts.append(merged_data['business_info']['business_name'])
    
    if merged_data.get('business_info', {}).get('description'):
        description_parts.append(merged_data['business_info']['description'])
    
    if merged_data.get('services', {}).get('offered'):
        services = ', '.join(merged_data['services']['offered'])
        description_parts.append(f"Services: {services}")
    
    if merged_data.get('services', {}).get('specialties'):
        specialties = ', '.join(merged_data['services']['specialties'])
        description_parts.append(f"Specialties: {specialties}")
    
    description = '. '.join(description_parts)
    
    if not description:
        return {'provider_id': provider_id, 'embedding': None}
    
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=description
        )
        embedding = response.data[0].embedding
        
        return {
            'provider_id': provider_id,
            'embedding': embedding
        }
    except Exception as e:
        logger.error(f"Failed to generate embedding for provider {provider_id}: {e}")
        return {'provider_id': provider_id, 'embedding': None}

@DBOS.step()
def merge_scraped_data(self, provider_id: int, scraped_data_list: list) -> dict:
    """
    Intelligently merge processed_data from multiple scraped sources.
    Prioritizes more complete/recent data.
    """
    merged = {}
    
    for scraped_data in scraped_data_list:
        processed = scraped_data.get('processed_data', {})
        
        # Deep merge logic
        for key, value in processed.items():
            if key not in merged:
                merged[key] = value
            elif isinstance(value, dict) and isinstance(merged[key], dict):
                # Merge dictionaries
                merged[key] = {**merged[key], **value}
            elif isinstance(value, list) and isinstance(merged[key], list):
                # Merge lists (deduplicate)
                merged[key] = list(set(merged[key] + value))
            elif value and not merged[key]:
                # Replace empty with non-empty
                merged[key] = value
    
    return {
        'provider_id': provider_id,
        'merged_data': merged
    }
```

### **4.2 Update persist_provider Step**

```python
@DBOS.step()
def persist_provider(self, provider_data: dict, geocode_result: dict, embedding_result: dict, merged_result: dict) -> int:
    """
    Save or update ServiceProvider with all new fields.
    """
    provider, created = ServiceProvider.objects.get_or_create(
        business_name=provider_data['business_name'],
        defaults={
            'description': provider_data.get('description', ''),
            'phone': provider_data.get('phone', ''),
            'website': provider_data.get('website', ''),
            'rating': provider_data.get('rating', 0.0),
            'total_reviews': provider_data.get('total_reviews', 0),
        }
    )
    
    # Update geospatial fields
    if geocode_result['coordinates']:
        lon, lat = geocode_result['coordinates']
        provider.business_location = Point(lon, lat, srid=4326)
    
    provider.address = geocode_result.get('address')
    provider.plus_code = geocode_result.get('plus_code')
    
    # Update merged data
    provider.merged_data = merged_result['merged_data']
    
    # Update embeddings
    if embedding_result['embedding']:
        provider.description_embedding = embedding_result['embedding']
    
    # Update rating (existing logic)
    if not created and provider_data.get('total_reviews', 0) > 0:
        total_reviews = provider.total_reviews + provider_data['total_reviews']
        current_rating = float(provider.rating) if provider.rating else 0.0
        new_rating = float(provider_data['rating'])
        
        total_rating = (
            current_rating * provider.total_reviews +
            new_rating * provider_data['total_reviews']
        )
        provider.rating = total_rating / total_reviews if total_reviews > 0 else 0.0
        provider.total_reviews = total_reviews
    
    provider.save()
    return provider.id
```

### **4.3 Update Workflow Orchestration**

```python
@DBOS.workflow()
def ingest_service_provider_workflow(self, url: str, category_id: int) -> dict:
    """
    Complete workflow with geocoding, merging, and embeddings.
    """
    # Existing steps...
    scraped_data = self.scrape_provider_data(url)
    processed_data = self.extract_structured_data(scraped_data)
    
    # NEW: Get all scraped data for this provider
    scraped_data_list = self.get_all_scraped_data(processed_data['business_name'])
    
    # NEW: Merge all scraped data
    merged_result = self.merge_scraped_data(provider_id, scraped_data_list)
    
    # NEW: Geocode address
    geocode_result = self.geocode_provider(provider_id, processed_data)
    
    # NEW: Generate embeddings
    embedding_result = self.generate_embeddings(provider_id, merged_result['merged_data'])
    
    # Persist with all new data
    provider_id = self.persist_provider(
        processed_data,
        geocode_result,
        embedding_result,
        merged_result
    )
    
    return {'provider_id': provider_id, 'status': 'success'}
```

---

## 🔄 Phase 5: Create ServiceProviderQueryBuilder

### **5.1 Create Query Builder Class**

**File**: `backend/django/hestami_ai_project/services/utils/query_builder.py`

```python
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Q, F
from pgvector.django import CosineDistance
from services.models import ServiceProvider

class ServiceProviderQueryBuilder:
    """
    Flexible, composable query builder for ServiceProvider searches.
    Supports geospatial, JSONB, semantic, and traditional filters.
    """
    
    def __init__(self):
        self.queryset = ServiceProvider.objects.all()
        self.order_by_fields = []
    
    # Category filters
    def filter_by_category(self, category_id):
        """Filter by service category."""
        self.queryset = self.queryset.filter(category_id=category_id)
        return self
    
    # Geospatial filters
    def near_point(self, longitude, latitude, radius_miles=None):
        """
        Find providers near a geographic point.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            radius_miles: Optional radius in miles (default: no limit)
        """
        point = Point(longitude, latitude, srid=4326)
        self.queryset = self.queryset.filter(business_location__isnull=False)
        self.queryset = self.queryset.annotate(
            distance=Distance('business_location', point)
        )
        
        if radius_miles:
            self.queryset = self.queryset.filter(
                business_location__dwithin=(point, D(mi=radius_miles))
            )
        
        return self
    
    def near_address(self, address, radius_miles=None):
        """Find providers near an address (geocodes first)."""
        # Geocode address to coordinates
        coordinates = self._geocode_address(address)
        if coordinates:
            return self.near_point(coordinates[0], coordinates[1], radius_miles)
        return self
    
    def near_property(self, property_id, radius_miles=None):
        """Find providers near a property."""
        from properties.models import Property
        property_obj = Property.objects.get(id=property_id)
        if property_obj.location:
            return self.near_point(
                property_obj.location.x,
                property_obj.location.y,
                radius_miles
            )
        return self
    
    # JSONB filters
    def has_payment_method(self, method):
        """Filter by payment method (e.g., 'credit_card', 'cash')."""
        self.queryset = self.queryset.filter(
            merged_data__business_info__payment_methods__contains=[method]
        )
        return self
    
    def has_specialty(self, specialty):
        """Filter by specialty."""
        self.queryset = self.queryset.filter(
            merged_data__services__specialties__contains=[specialty]
        )
        return self
    
    def has_license(self):
        """Filter providers with business license."""
        self.queryset = self.queryset.filter(
            merged_data__business_info__license__isnull=False
        )
        return self
    
    def has_background_check(self):
        """Filter providers with background check."""
        self.queryset = self.queryset.filter(
            merged_data__business_info__background_check=True
        )
        return self
    
    def min_years_in_business(self, years):
        """Filter by minimum years in business."""
        self.queryset = self.queryset.filter(
            merged_data__business_info__years_in_business__gte=years
        )
        return self
    
    def min_employees(self, count):
        """Filter by minimum employee count."""
        self.queryset = self.queryset.filter(
            merged_data__business_info__employees__gte=count
        )
        return self
    
    def open_now(self):
        """Filter providers currently open."""
        from datetime import datetime
        now = datetime.now()
        day = now.strftime('%A').lower()
        time = now.strftime('%H:%M')
        
        # This is complex - requires parsing business_hours JSONB
        # Simplified version:
        self.queryset = self.queryset.filter(
            merged_data__business_info__business_hours__isnull=False
        )
        return self
    
    def open_weekends(self):
        """Filter providers open on weekends."""
        self.queryset = self.queryset.filter(
            Q(merged_data__business_info__business_hours__saturday__isnull=False) |
            Q(merged_data__business_info__business_hours__sunday__isnull=False)
        )
        return self
    
    # Contact info filters
    def has_website(self):
        """Filter providers with website."""
        self.queryset = self.queryset.exclude(website='')
        return self
    
    def has_phone(self):
        """Filter providers with phone."""
        self.queryset = self.queryset.exclude(phone='')
        return self
    
    def has_address(self):
        """Filter providers with address."""
        self.queryset = self.queryset.exclude(address='')
        return self
    
    # Rating filters
    def min_rating(self, rating):
        """Filter by minimum rating."""
        self.queryset = self.queryset.filter(rating__gte=rating)
        return self
    
    def min_reviews(self, count):
        """Filter by minimum review count."""
        self.queryset = self.queryset.filter(total_reviews__gte=count)
        return self
    
    # Keyword search
    def search_keywords(self, query):
        """Full-text search across name, description, and merged_data."""
        self.queryset = self.queryset.filter(
            Q(business_name__icontains=query) |
            Q(description__icontains=query) |
            Q(merged_data__business_info__description__icontains=query)
        )
        return self
    
    # Semantic search
    def semantic_search(self, query, limit=None):
        """
        Semantic similarity search using vector embeddings.
        
        Args:
            query: Search query text
            limit: Optional limit on results
        """
        from openai import OpenAI
        import os
        
        # Generate embedding for query
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=query
        )
        query_embedding = response.data[0].embedding
        
        # Find similar providers
        self.queryset = self.queryset.filter(description_embedding__isnull=False)
        self.queryset = self.queryset.annotate(
            similarity=CosineDistance('description_embedding', query_embedding)
        )
        
        if limit:
            self.queryset = self.queryset[:limit]
        
        return self
    
    # Sorting
    def sort_by_distance(self):
        """Sort by distance (requires near_* filter first)."""
        self.order_by_fields.append('distance')
        return self
    
    def sort_by_rating(self, descending=True):
        """Sort by rating."""
        field = '-rating' if descending else 'rating'
        self.order_by_fields.append(field)
        return self
    
    def sort_by_reviews(self, descending=True):
        """Sort by review count."""
        field = '-total_reviews' if descending else 'total_reviews'
        self.order_by_fields.append(field)
        return self
    
    def sort_by_name(self):
        """Sort alphabetically by name."""
        self.order_by_fields.append('business_name')
        return self
    
    def sort_by_similarity(self):
        """Sort by semantic similarity (requires semantic_search first)."""
        self.order_by_fields.append('similarity')
        return self
    
    # Execute
    def execute(self):
        """Execute the query and return results."""
        if self.order_by_fields:
            self.queryset = self.queryset.order_by(*self.order_by_fields)
        return self.queryset
    
    def count(self):
        """Get count of matching providers."""
        return self.queryset.count()
    
    # Helper methods
    def _geocode_address(self, address):
        """Geocode an address to coordinates."""
        import requests
        try:
            response = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': address, 'format': 'json', 'limit': 1},
                headers={'User-Agent': 'Hestami-AI/1.0'}
            )
            results = response.json()
            if results:
                return (float(results[0]['lon']), float(results[0]['lat']))
        except Exception:
            pass
        return None
```

### **5.2 Usage Examples**

```python
# Example 1: Find HVAC providers near a property within 10 miles, sorted by rating
providers = (ServiceProviderQueryBuilder()
    .filter_by_category(hvac_category_id)
    .near_property(property_id, radius_miles=10)
    .min_rating(4.0)
    .has_license()
    .sort_by_distance()
    .sort_by_rating()
    .execute())

# Example 2: Semantic search for "emergency plumbing"
providers = (ServiceProviderQueryBuilder()
    .semantic_search("emergency plumbing repair", limit=20)
    .near_address("123 Main St, City, State", radius_miles=25)
    .has_background_check()
    .open_now()
    .sort_by_similarity()
    .execute())

# Example 3: Find licensed electricians with 5+ years experience
providers = (ServiceProviderQueryBuilder()
    .filter_by_category(electrical_category_id)
    .has_license()
    .min_years_in_business(5)
    .has_website()
    .min_rating(4.5)
    .min_reviews(10)
    .sort_by_rating()
    .execute())
```

---

## 🔄 Phase 6: Create API Endpoints

### **6.1 Create ViewSet**

**File**: `backend/django/hestami_ai_project/services/views/provider_search.py`

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from services.utils.query_builder import ServiceProviderQueryBuilder
from services.serializers import ServiceProviderSerializer

class ServiceProviderSearchViewSet(viewsets.ViewSet):
    """
    API endpoints for flexible service provider search.
    """
    
    @action(detail=False, methods=['post'])
    def search(self, request):
        """
        Flexible search endpoint.
        
        POST /api/services/providers/search/
        {
            "category_id": 1,
            "near": {
                "type": "point",  // or "address" or "property"
                "longitude": -77.4311,
                "latitude": 38.8951,
                "radius_miles": 10
            },
            "filters": {
                "min_rating": 4.0,
                "min_reviews": 5,
                "has_license": true,
                "has_background_check": true,
                "payment_methods": ["credit_card"],
                "specialties": ["emergency_service"],
                "min_years_in_business": 3,
                "open_now": true
            },
            "search": {
                "type": "semantic",  // or "keyword"
                "query": "emergency plumbing repair"
            },
            "sort": ["distance", "-rating"],
            "limit": 20
        }
        """
        builder = ServiceProviderQueryBuilder()
        
        # Category filter
        if 'category_id' in request.data:
            builder.filter_by_category(request.data['category_id'])
        
        # Geospatial filter
        if 'near' in request.data:
            near = request.data['near']
            if near['type'] == 'point':
                builder.near_point(
                    near['longitude'],
                    near['latitude'],
                    near.get('radius_miles')
                )
            elif near['type'] == 'address':
                builder.near_address(
                    near['address'],
                    near.get('radius_miles')
                )
            elif near['type'] == 'property':
                builder.near_property(
                    near['property_id'],
                    near.get('radius_miles')
                )
        
        # Apply filters
        filters = request.data.get('filters', {})
        if filters.get('min_rating'):
            builder.min_rating(filters['min_rating'])
        if filters.get('min_reviews'):
            builder.min_reviews(filters['min_reviews'])
        if filters.get('has_license'):
            builder.has_license()
        if filters.get('has_background_check'):
            builder.has_background_check()
        if filters.get('min_years_in_business'):
            builder.min_years_in_business(filters['min_years_in_business'])
        if filters.get('open_now'):
            builder.open_now()
        
        # Search
        if 'search' in request.data:
            search = request.data['search']
            if search['type'] == 'semantic':
                builder.semantic_search(search['query'], limit=request.data.get('limit'))
            elif search['type'] == 'keyword':
                builder.search_keywords(search['query'])
        
        # Sort
        sort_fields = request.data.get('sort', [])
        for field in sort_fields:
            if field == 'distance':
                builder.sort_by_distance()
            elif field == '-rating' or field == 'rating':
                builder.sort_by_rating(descending=(field == '-rating'))
            elif field == 'similarity':
                builder.sort_by_similarity()
        
        # Execute
        providers = builder.execute()
        
        # Apply limit
        if 'limit' in request.data:
            providers = providers[:request.data['limit']]
        
        serializer = ServiceProviderSerializer(providers, many=True)
        return Response({
            'count': builder.count(),
            'results': serializer.data
        })
```

---

## 📋 Implementation Checklist

### **Immediate Next Steps**

- [ ] **Step 1**: Update `requirements.txt` with GDAL, pgvector, openai
- [ ] **Step 2**: Update Django Dockerfile to install GDAL
- [ ] **Step 3**: Rebuild Django container
- [ ] **Step 4**: Update `ServiceProvider` model with new fields
- [ ] **Step 5**: Create and run Django migrations
- [ ] **Step 6**: Verify migrations in database
- [ ] **Step 7**: Update DBOS workflow with geocoding, merging, embeddings
- [ ] **Step 8**: Create `ServiceProviderQueryBuilder` class
- [ ] **Step 9**: Create API endpoints
- [ ] **Step 10**: Test end-to-end workflow

### **Testing Plan**

1. **Test Geocoding**: Run workflow, verify `business_location` populated
2. **Test Merging**: Check `merged_data` contains all scraped data
3. **Test Embeddings**: Verify `description_embedding` generated
4. **Test Geospatial Query**: Find providers within 10 miles
5. **Test JSONB Query**: Filter by payment methods, specialties
6. **Test Semantic Search**: Search for "emergency plumbing"
7. **Test Combined Query**: Geospatial + JSONB + semantic + sorting

---

## 🎯 Success Criteria

- ✅ All migrations run successfully
- ✅ Geocoding populates coordinates for 80%+ of providers
- ✅ Merged data includes all extracted fields
- ✅ Vector embeddings generated for all providers with descriptions
- ✅ Geospatial queries return results within specified radius
- ✅ JSONB queries filter correctly on nested fields
- ✅ Semantic search returns relevant results
- ✅ Query builder supports complex, composable queries
- ✅ API endpoints work with all filter combinations

---

## 📚 Resources

- **PostGIS Documentation**: https://postgis.net/docs/
- **pgvector Documentation**: https://github.com/pgvector/pgvector
- **Django GIS**: https://docs.djangoproject.com/en/5.1/ref/contrib/gis/
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **Nominatim Geocoding**: https://nominatim.org/release-docs/latest/api/Search/

---

**Next Action**: Update `requirements.txt` and rebuild Django container.
