# Caching Strategy

## Overview

The app implements a **smart, selective caching system** that balances performance with data freshness without requiring complex state management.

## Key Principles

1. **Cache only what's safe** - Media files are cached aggressively, API data is not cached by default
2. **Automatic invalidation** - Caches are invalidated when data is mutated
3. **TTL-based expiration** - Different resource types have different time-to-live values
4. **Startup cleanup** - Expired caches are cleared on app launch

## Cache Policies by Resource Type

### Media Files (Images, Videos, etc.)
- **Cached:** ✅ Yes
- **TTL:** 24 hours
- **Rationale:** Media files are immutable and bandwidth-intensive

### API Endpoints (Properties, Users, etc.)
- **Cached:** ❌ No (by default)
- **TTL:** N/A
- **Rationale:** Data can change frequently and staleness causes UX issues

## Cache Invalidation

### Automatic Invalidation on Mutations

When you perform a POST, PUT, PATCH, or DELETE request, related caches are automatically invalidated:

```swift
// Example: Updating a property
await networkManager.request(endpoint: "/api/properties/123", method: .put, ...)
// ↓ Automatically invalidates all /api/properties/* caches
```

### Manual Invalidation

You can manually invalidate caches if needed:

```swift
// Invalidate specific pattern
NetworkManager.shared.invalidateCache(for: "/api/properties")

// Clear all caches
NetworkManager.shared.clearAllCaches()
```

### Startup Cleanup

On app launch, expired caches are automatically cleared:

```swift
// In AppDelegate
CacheManager.shared.clearExpiredCache()
```

## Implementation Details

### CacheManager

- **Location:** `Utils/CacheManager.swift`
- **Storage:** File-based cache in app's cache directory
- **Metadata:** Each cache entry stores timestamp and TTL

### NetworkManager

- **Smart caching:** Uses `CacheManager.shouldCacheResource()` to determine if a URL should be cached
- **Automatic invalidation:** Calls `invalidateRelatedCaches()` after successful mutations
- **Cache-first strategy:** For cacheable resources, checks cache before making network request

## Configuration

### Enable/Disable Caching Globally

```swift
// In NetworkManager.swift
var shouldUseCache = true  // Enable/disable cache reads
var shouldCacheResponses = true  // Enable/disable cache writes
```

### Override Per-Request

```swift
// Force cache usage
await networkManager.request(..., useCache: true)

// Bypass cache
await networkManager.request(..., useCache: false)
```

## Adding New Cache Policies

To cache a new resource type, update `CacheManager.shouldCacheResource()`:

```swift
// In CacheManager.swift
public func shouldCacheResource(url: String) -> (shouldCache: Bool, ttl: TimeInterval?) {
    // Add your pattern
    if url.contains("/api/my-new-endpoint/") {
        return (true, 600) // Cache for 10 minutes
    }
    // ...
}
```

To invalidate caches for a new endpoint, update `NetworkManager.invalidateRelatedCaches()`:

```swift
// In NetworkManager.swift
private func invalidateRelatedCaches(for endpoint: String) {
    if endpoint.contains("/api/my-new-endpoint") {
        cacheManager.invalidateCache(matching: "/api/my-new-endpoint")
    }
    // ...
}
```

## Benefits

✅ **No complex state management** - Cache invalidation happens automatically  
✅ **Bandwidth savings** - Media files are cached for 24 hours  
✅ **Data freshness** - API data is always fresh (not cached)  
✅ **Automatic cleanup** - Expired caches are removed on app startup  
✅ **Flexible** - Easy to add new cache policies as needed  

## Trade-offs

⚠️ **API requests always hit the network** - This ensures freshness but uses more bandwidth  
⚠️ **Pattern-based invalidation** - Relies on URL patterns, which could miss edge cases  
⚠️ **No offline support** - Uncached API data requires network connectivity  

## Future Enhancements

If needed, you could add:

1. **ETag support** - Server sends ETag, client uses `If-None-Match` for conditional requests
2. **Offline mode** - Cache API data with longer TTLs when offline
3. **Selective API caching** - Cache read-only endpoints (e.g., `/api/property-types/`)
4. **Cache size limits** - Implement LRU eviction when cache exceeds size threshold
