#!/usr/bin/env python
"""
Quick diagnostic script to test semantic search setup.
Run with: python manage.py shell < test_semantic_search.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hestami_ai.settings')
django.setup()

from services.models import ServiceProvider
from services.workflows.enrichment_utils import generate_embedding
import requests

print("=" * 80)
print("SEMANTIC SEARCH DIAGNOSTIC")
print("=" * 80)

# 1. Check Ollama connectivity
print("\n1. Testing Ollama connectivity...")
ollama_url = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
print(f"   Ollama URL: {ollama_url}")

try:
    response = requests.get(f"{ollama_url}/api/tags", timeout=5)
    if response.ok:
        models = response.json().get('models', [])
        print(f"   ✓ Ollama is accessible")
        print(f"   Available models: {len(models)}")
        
        # Check for embedding model
        embedding_model = "qwen3-embedding:8b-q4_K_M"
        has_model = any(m.get('name') == embedding_model for m in models)
        if has_model:
            print(f"   ✓ Embedding model '{embedding_model}' is available")
        else:
            print(f"   ✗ Embedding model '{embedding_model}' NOT FOUND")
            print(f"   Available models: {[m.get('name') for m in models]}")
    else:
        print(f"   ✗ Ollama returned status {response.status_code}")
except Exception as e:
    print(f"   ✗ Cannot connect to Ollama: {e}")

# 2. Check database for providers with embeddings
print("\n2. Checking database for providers with embeddings...")
total_providers = ServiceProvider.objects.count()
providers_with_embeddings = ServiceProvider.objects.exclude(description_embedding__isnull=True).count()
available_providers = ServiceProvider.objects.filter(is_available=True).count()
available_with_embeddings = ServiceProvider.objects.filter(
    is_available=True
).exclude(description_embedding__isnull=True).count()

print(f"   Total providers: {total_providers}")
print(f"   Providers with embeddings: {providers_with_embeddings}")
print(f"   Available providers: {available_providers}")
print(f"   Available with embeddings: {available_with_embeddings}")

if providers_with_embeddings == 0:
    print(f"   ✗ NO PROVIDERS HAVE EMBEDDINGS!")
    print(f"   You need to run provider ingestion to generate embeddings.")
else:
    print(f"   ✓ {providers_with_embeddings} providers have embeddings")

# 3. Test embedding generation
print("\n3. Testing embedding generation...")
test_text = "emergency HVAC repair specialist with 24/7 service"
print(f"   Test query: '{test_text}'")

try:
    embedding = generate_embedding(test_text)
    if embedding:
        print(f"   ✓ Generated embedding with {len(embedding)} dimensions")
        print(f"   Sample values: {embedding[:5]}")
    else:
        print(f"   ✗ generate_embedding returned None")
except Exception as e:
    print(f"   ✗ Error generating embedding: {e}")

# 4. Sample provider descriptions
if providers_with_embeddings > 0:
    print("\n4. Sample provider descriptions (first 3 with embeddings)...")
    sample_providers = ServiceProvider.objects.exclude(
        description_embedding__isnull=True
    )[:3]
    
    for i, provider in enumerate(sample_providers, 1):
        print(f"\n   Provider {i}: {provider.business_name}")
        if provider.description:
            desc = provider.description[:200]
            print(f"   Description: {desc}...")
        else:
            print(f"   Description: (empty)")
        print(f"   Has embedding: Yes ({len(provider.description_embedding) if provider.description_embedding else 0} dims)")

# 5. Test a simple semantic search query
if available_with_embeddings > 0:
    print("\n5. Testing semantic search query...")
    from services.utils.query_builder import ServiceProviderQueryBuilder
    
    try:
        results = (ServiceProviderQueryBuilder()
            .available_only()
            .semantic_search("HVAC repair", limit=3)
            .execute()
        )
        
        print(f"   Query: 'HVAC repair'")
        print(f"   Results: {len(results)}")
        
        for i, provider in enumerate(results, 1):
            similarity = getattr(provider, 'similarity', None)
            print(f"   {i}. {provider.business_name} (similarity: {similarity:.4f if similarity else 'N/A'})")
            
    except Exception as e:
        print(f"   ✗ Error executing search: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
