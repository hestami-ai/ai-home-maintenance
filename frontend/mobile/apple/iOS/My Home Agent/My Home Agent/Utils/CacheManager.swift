import Foundation
import OSLog

public class CacheManager {
    public static let shared = CacheManager()
    
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    
    // Different TTLs for different resource types
    private let defaultExpirationInterval: TimeInterval = 3600 * 24 // 24 hours for media
    private let apiDataExpirationInterval: TimeInterval = 300 // 5 minutes for API data
    
    private init() {
        // Get the cache directory
        let urls = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)
        cacheDirectory = urls[0].appendingPathComponent("NetworkCache", isDirectory: true)
        
        // Create cache directory if it doesn't exist
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            do {
                try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
            } catch {
                AppLogger.error("Error creating cache directory", error: error, category: AppLogger.app)
            }
        }
    }
    
    // MARK: - Cache Operations
    
    public func cacheData(_ data: Data, for key: String, ttl: TimeInterval? = nil) {
        let cacheMetadata = CacheMetadata(timestamp: Date(), ttl: ttl)
        let cacheItem = CacheItem(metadata: cacheMetadata, data: data)
        
        do {
            let fileURL = cacheFileURL(for: key)
            let encodedData = try JSONEncoder().encode(cacheItem)
            try encodedData.write(to: fileURL)
        } catch {
            AppLogger.error("Error caching data", error: error, category: AppLogger.app)
        }
    }
    
    public func getCachedData(for key: String) -> Data? {
        let fileURL = cacheFileURL(for: key)
        
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: fileURL)
            let cacheItem = try JSONDecoder().decode(CacheItem.self, from: data)
            
            // Check if cache is expired using the stored TTL or default
            let ttl = cacheItem.metadata.ttl ?? defaultExpirationInterval
            if Date().timeIntervalSince(cacheItem.metadata.timestamp) > ttl {
                // Cache expired, delete it
                try? fileManager.removeItem(at: fileURL)
                return nil
            }
            
            return cacheItem.data
        } catch {
            AppLogger.error("Error retrieving cached data", error: error, category: AppLogger.app)
            return nil
        }
    }
    
    public func clearCache() {
        do {
            let contents = try fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for fileURL in contents {
                try fileManager.removeItem(at: fileURL)
            }
        } catch {
            AppLogger.error("Error clearing cache", error: error, category: AppLogger.app)
        }
    }
    
    public func clearExpiredCache() {
        do {
            let contents = try fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for fileURL in contents {
                if let data = try? Data(contentsOf: fileURL),
                   let cacheItem = try? JSONDecoder().decode(CacheItem.self, from: data) {
                    
                    let ttl = cacheItem.metadata.ttl ?? defaultExpirationInterval
                    if Date().timeIntervalSince(cacheItem.metadata.timestamp) > ttl {
                        try fileManager.removeItem(at: fileURL)
                    }
                }
            }
        } catch {
            AppLogger.error("Error clearing expired cache", error: error, category: AppLogger.app)
        }
    }
    
    // MARK: - Helper Methods
    
    private func cacheFileURL(for key: String) -> URL {
        let filename = key.replacingOccurrences(of: "/", with: "_")
                         .replacingOccurrences(of: ":", with: "_")
                         .replacingOccurrences(of: "?", with: "_")
                         .replacingOccurrences(of: "&", with: "_")
                         .replacingOccurrences(of: "=", with: "_")
        return cacheDirectory.appendingPathComponent(filename)
    }
    
    // Generate a cache key from a URL request
    public func cacheKey(for request: URLRequest) -> String {
        var key = request.url?.absoluteString ?? ""
        
        if let httpMethod = request.httpMethod {
            key += "_\(httpMethod)"
        }
        
        if let httpBody = request.httpBody, let bodyString = String(data: httpBody, encoding: .utf8) {
            key += "_\(bodyString.hashValue)"
        }
        
        return key
    }
    
    // MARK: - Selective Cache Invalidation
    
    /// Invalidate cache entries matching a URL pattern
    public func invalidateCache(matching pattern: String) {
        do {
            let contents = try fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for fileURL in contents {
                let filename = fileURL.lastPathComponent
                // Convert back from sanitized filename to check if it matches pattern
                let urlPattern = pattern.replacingOccurrences(of: "/", with: "_")
                                       .replacingOccurrences(of: ":", with: "_")
                if filename.contains(urlPattern) {
                    try? fileManager.removeItem(at: fileURL)
                    AppLogger.app.debug("Invalidated cache for: \(filename, privacy: .public)")
                }
            }
        } catch {
            AppLogger.error("Error invalidating cache", error: error, category: AppLogger.app)
        }
    }
    
    /// Check if a resource should be cached based on its URL
    public func shouldCacheResource(url: String) -> (shouldCache: Bool, ttl: TimeInterval?) {
        // Media files - cache with long TTL
        if url.contains("/media-secure/") || url.contains("/media/") {
            return (true, defaultExpirationInterval) // 24 hours
        }
        
        // API endpoints - don't cache by default (too risky)
        if url.contains("/api/") {
            return (false, nil)
        }
        
        // Everything else - no cache
        return (false, nil)
    }
}

// MARK: - Cache Models

public struct CacheMetadata: Codable {
    public let timestamp: Date
    public let ttl: TimeInterval? // Custom TTL per cache item
}

public struct CacheItem: Codable {
    public let metadata: CacheMetadata
    public let data: Data
}
