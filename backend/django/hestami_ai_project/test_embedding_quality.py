#!/usr/bin/env python
"""
Test embedding quality and similarity calculations.
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hestami_ai.settings')
django.setup()

from services.models import ServiceProvider
from services.workflows.enrichment_utils import generate_embedding
from pgvector.django import CosineDistance

print("=" * 80)
print("EMBEDDING QUALITY DIAGNOSTIC")
print("=" * 80)

# Get all providers with embeddings
providers = ServiceProvider.objects.exclude(description_embedding__isnull=True)
print(f"\nFound {providers.count()} providers with embeddings\n")

# Test queries
test_queries = [
    "HVAC repair",
    "roofing services",
    "plumbing emergency",
    "landscaping",
]

for query in test_queries:
    print("\n" + "=" * 80)
    print(f"Query: '{query}'")
    print("=" * 80)
    
    # Generate embedding for query
    query_embedding = generate_embedding(query)
    
    if not query_embedding:
        print("ERROR: Could not generate embedding for query")
        continue
    
    # Calculate similarity for all providers
    results = (ServiceProvider.objects
        .exclude(description_embedding__isnull=True)
        .annotate(similarity=CosineDistance('description_embedding', query_embedding))
        .order_by('similarity')
    )
    
    print(f"\nTop 5 results (sorted by similarity):\n")
    for i, provider in enumerate(results[:5], 1):
        print(f"{i}. {provider.business_name}")
        print(f"   Similarity: {provider.similarity:.4f}")
        
        # Show first 150 chars of description
        desc = provider.description[:150] if provider.description else "(no description)"
        print(f"   Description: {desc}...")
        
        # Check if description contains query keywords
        query_words = query.lower().split()
        desc_lower = provider.description.lower() if provider.description else ""
        matches = [word for word in query_words if word in desc_lower]
        
        if matches:
            print(f"   ✓ Contains keywords: {matches}")
        else:
            print(f"   ✗ No keyword matches")
        print()

print("\n" + "=" * 80)
print("PROVIDER DESCRIPTIONS")
print("=" * 80)

# Show all provider descriptions
for provider in providers:
    print(f"\n{provider.business_name}:")
    print(f"Description length: {len(provider.description) if provider.description else 0} chars")
    print(f"Description: {provider.description[:300] if provider.description else '(empty)'}...")
    print()

print("\n" + "=" * 80)
print("EMBEDDING COMPARISON TEST")
print("=" * 80)

# Test if embeddings are actually different
print("\nChecking if embeddings are diverse...\n")

embedding_samples = []
for provider in providers[:3]:
    if provider.description_embedding:
        sample = provider.description_embedding[:5]
        embedding_samples.append({
            'name': provider.business_name,
            'sample': sample
        })
        print(f"{provider.business_name}: {sample}")

# Check if they're all the same (would indicate a problem)
if len(embedding_samples) > 1:
    first = embedding_samples[0]['sample']
    all_same = all(s['sample'] == first for s in embedding_samples)
    
    if all_same:
        print("\n⚠ WARNING: All embeddings appear identical! This is a problem.")
    else:
        print("\n✓ Embeddings are different (good)")

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
