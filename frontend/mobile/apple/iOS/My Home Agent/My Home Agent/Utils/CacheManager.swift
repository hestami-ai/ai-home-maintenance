import Foundation

public class CacheManager {
    public static let shared = CacheManager()
    
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let expirationInterval: TimeInterval = 3600 * 24 // 24 hours
    
    private init() {
        // Get the cache directory
        let urls = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)
        cacheDirectory = urls[0].appendingPathComponent("NetworkCache", isDirectory: true)
        
        // Create cache directory if it doesn't exist
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            do {
                try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
            } catch {
                print("Error creating cache directory: \(error)")
            }
        }
    }
    
    // MARK: - Cache Operations
    
    public func cacheData(_ data: Data, for key: String) {
        let cacheMetadata = CacheMetadata(timestamp: Date())
        let cacheItem = CacheItem(metadata: cacheMetadata, data: data)
        
        do {
            let fileURL = cacheFileURL(for: key)
            let encodedData = try JSONEncoder().encode(cacheItem)
            try encodedData.write(to: fileURL)
        } catch {
            print("Error caching data: \(error)")
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
            
            // Check if cache is expired
            if Date().timeIntervalSince(cacheItem.metadata.timestamp) > expirationInterval {
                // Cache expired, delete it
                try? fileManager.removeItem(at: fileURL)
                return nil
            }
            
            return cacheItem.data
        } catch {
            print("Error retrieving cached data: \(error)")
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
            print("Error clearing cache: \(error)")
        }
    }
    
    public func clearExpiredCache() {
        do {
            let contents = try fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for fileURL in contents {
                if let data = try? Data(contentsOf: fileURL),
                   let cacheItem = try? JSONDecoder().decode(CacheItem.self, from: data) {
                    
                    if Date().timeIntervalSince(cacheItem.metadata.timestamp) > expirationInterval {
                        try fileManager.removeItem(at: fileURL)
                    }
                }
            }
        } catch {
            print("Error clearing expired cache: \(error)")
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
}

// MARK: - Cache Models

public struct CacheMetadata: Codable {
    public let timestamp: Date
}

public struct CacheItem: Codable {
    public let metadata: CacheMetadata
    public let data: Data
}
