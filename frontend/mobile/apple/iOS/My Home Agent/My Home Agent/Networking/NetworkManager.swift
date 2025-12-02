import Foundation
import OSLog
import Compression

public enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

public enum NetworkError: Error, Equatable, LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, data: Data?)
    case decodingError(Error)
    case serverError(String)
    case noData
    case unauthorized
    case connectionError
    case timeoutError
    case unknownError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL. Please check the address and try again."
        case .invalidResponse:
            return "Invalid response from server. Please try again later."
        case .httpError(let statusCode, _):
            return "Server error (HTTP \(statusCode)). Please try again later."
        case .decodingError:
            return "Error processing server response. Please try again later."
        case .serverError(let message):
            return "Server error: \(message)"
        case .noData:
            return "No data received from server. Please check your connection and try again."
        case .unauthorized:
            return "Authentication failed. Please log in again."
        case .connectionError:
            return "Cannot connect to server. Please check your internet connection or try again later."
        case .timeoutError:
            return "Connection timed out. Please check your internet connection and try again."
        case .unknownError(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }
    
    public static func == (lhs: NetworkError, rhs: NetworkError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidURL, .invalidURL),
             (.invalidResponse, .invalidResponse),
             (.noData, .noData),
             (.unauthorized, .unauthorized),
             (.connectionError, .connectionError),
             (.timeoutError, .timeoutError):
            return true
            
        case (.httpError(let lhsCode, _), .httpError(let rhsCode, _)):
            return lhsCode == rhsCode
            
        case (.serverError(let lhsMessage), .serverError(let rhsMessage)):
            return lhsMessage == rhsMessage
            
        case (.decodingError, .decodingError),
             (.unknownError, .unknownError):
            // Can't compare errors directly, so we just check if they're the same type
            return true
            
        default:
            return false
        }
    }
    
    public var localizedDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode, _):
            return "HTTP Error: \(statusCode)"
        case .decodingError:
            return "Failed to decode response"
        case .serverError(let message):
            return "Server error: \(message)"
        case .noData:
            return "No data received"
        case .unauthorized:
            return "Unauthorized access. Please log in again."
        case .connectionError:
            return "Connection error. Please check your internet connection."
        case .timeoutError:
            return "Request timed out. Please try again."
        case .unknownError(let error):
            return "Unknown error: \(error.localizedDescription)"
        }
    }
    
    var isAuthError: Bool {
        if case .httpError(let statusCode, _) = self {
            return statusCode == 401
        }
        return self == .unauthorized
    }
}

public class NetworkManager {
    public static let shared = NetworkManager()
    
    // API server configuration - now uses AppConfiguration
    public var baseURL: String {
        return AppConfiguration.apiBaseURL
    }
    
    // Static media server configuration
    private var staticMediaHost: String {
        return AppConfiguration.staticMediaHost
    }
    private var staticMediaPort: String {
        return AppConfiguration.staticMediaPort
    }
    private let localhostMediaPattern = "http://localhost:8090/media-secure"
    
    private let session: URLSession
    private let jsonDecoder = JSONDecoder()
    private let cacheManager = CacheManager.shared
    
    // Manual cookie storage for HttpOnly cookies
    private var cookieStorage: [String: String] = [:]
    
    // CSRF token storage
    private var csrfToken: String?
    
    // Configuration options - now uses AppConfiguration
    var shouldUseCache: Bool {
        return AppConfiguration.enableCaching
    }
    var shouldCacheResponses: Bool {
        return AppConfiguration.enableCaching
    }
    
    // Media server configuration methods
    // NOTE: Configuration is now managed by AppConfiguration based on build environment
    // This method is deprecated but kept for backward compatibility
    @available(*, deprecated, message: "Use AppConfiguration instead")
    public func configureStaticMediaServer(host: String, port: String) {
        AppLogger.notice("Deprecated configureStaticMediaServer called - using AppConfiguration instead", category: AppLogger.network)
    }
    
    // Public method to rewrite any media URL string
    public func rewriteMediaURL(_ urlString: String) -> String {
        // Only attempt to rewrite if we have valid host and port and it matches our pattern
        guard !staticMediaHost.isEmpty, !staticMediaPort.isEmpty, urlString.contains(localhostMediaPattern) else {
            return urlString
        }
        
        // Create the replacement URL pattern
        //let replacementPattern = "https://\(staticMediaHost):\(staticMediaPort)/media-secure"
        let replacementPattern = "https://\(staticMediaHost)/media-secure"
        
        // Replace the localhost pattern with our configured host/port
        let rewrittenURL = urlString.replacingOccurrences(
            of: localhostMediaPattern,
            with: replacementPattern
        )
        
        AppLogger.network.debug("Rewrote URL: \(urlString, privacy: .public) -> \(rewrittenURL, privacy: .public)")
        return rewrittenURL
    }
    
    // Helper method to rewrite media URLs in response data
    private func rewriteMediaURLs(in data: Data) -> Data {
        // Only attempt to rewrite if we have valid host and port
        guard !staticMediaHost.isEmpty, !staticMediaPort.isEmpty else {
            return data
        }
        
        // Convert data to string for search and replace
        guard var responseString = String(data: data, encoding: .utf8) else {
            return data
        }
        
        // Replace all occurrences of localhost media URLs
        if responseString.contains(localhostMediaPattern) {
            responseString = rewriteMediaURL(responseString)
            
            // Convert back to data
            if let modifiedData = responseString.data(using: .utf8) {
                return modifiedData
            }
        }
        
        return data
    }
    
    public init() {
        // Create a default session with cookie handling
        let configuration = URLSessionConfiguration.default
        
        // Set timeout values
        configuration.timeoutIntervalForRequest = 15.0    // 15 seconds for request timeout
        configuration.timeoutIntervalForResource = 30.0   // 30 seconds for resource timeout
        
        // Explicitly enable cookie handling
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = HTTPCookie.AcceptPolicy.always
        configuration.httpCookieStorage = HTTPCookieStorage.shared
        
        session = URLSession(configuration: configuration)
        
        // Configure custom date decoding strategy to handle microseconds
        let formatter1 = DateFormatter()
        formatter1.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'"
        formatter1.timeZone = TimeZone(abbreviation: "UTC")
        
        let formatter2 = DateFormatter()
        formatter2.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        formatter2.timeZone = TimeZone(abbreviation: "UTC")
        
        let formatter3 = ISO8601DateFormatter()
        
        jsonDecoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            
            // Try formatter with microseconds first
            if let date = formatter1.date(from: dateString) {
                return date
            }
            
            // Try formatter without microseconds
            if let date = formatter2.date(from: dateString) {
                return date
            }
            
            // Try standard ISO8601 formatter
            if let date = formatter3.date(from: dateString) {
                return date
            }
            
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected date string to be ISO8601-formatted."))
        }
        jsonDecoder.keyDecodingStrategy = .convertFromSnakeCase
        
        // Clear expired cache on init (async to avoid blocking app startup)
        Task.detached(priority: .utility) {
            self.cacheManager.clearExpiredCache()
        }
    }
    
    // Clear all cookies for the domain
    public func clearCookies() {
        // Clear system cookie storage
        if let url = URL(string: baseURL),
           let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            for cookie in cookies {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
        }
        
        // Clear our manual cookie storage
        self.cookieStorage.removeAll()
        self.csrfToken = nil
        AppLogger.network.debug("Cleared manual cookie storage and CSRF token")
    }
    
    // Check if we have a session cookie
    public func hasSessionCookie() -> Bool {
        let hasSession = getSessionCookieValue() != nil
        AppLogger.network.debug("hasSessionCookie = \(hasSession, privacy: .public)")
        if hasSession, let cookieValue = getSessionCookieValue() {
            AppLogger.debugSensitive("Session cookie value", sensitiveData: cookieValue, category: AppLogger.network)
        }
        return hasSession
    }
    
    // Get the session cookie value if available
    public func getSessionCookieValue() -> String? {
        // Check manual cookie storage first
        if let value = cookieStorage["hestami_session"] {
            return value
        }
        
        // Then check system cookie storage
        if let url = URL(string: baseURL),
           let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            for cookie in cookies {
                if cookie.name == "hestami_session" {
                    return cookie.value
                }
            }
        }
        
        return nil
    }
    
    // Get formatted cookie header string for manual requests
    public func getSessionCookieHeader() -> String? {
        guard let sessionValue = getSessionCookieValue() else {
            return nil
        }
        return "hestami_session=\(sessionValue)"
    }
    
    // Get the CSRF token value if available
    public func getCSRFToken() -> String? {
        // Check cached CSRF token first
        if let token = csrfToken {
            return token
        }
        
        // Then check system cookie storage
        if let url = URL(string: baseURL),
           let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            for cookie in cookies {
                if cookie.name == "csrftoken" {
                    csrfToken = cookie.value
                    return cookie.value
                }
            }
        }
        
        return nil
    }
    
    // Add CSRF token to a request if available
    public func addCSRFToken(to request: inout URLRequest) {
        if let token = getCSRFToken() {
            request.setValue(token, forHTTPHeaderField: "X-CSRFToken")
            AppLogger.network.debug("Added CSRF token to request")
        } else {
            AppLogger.network.warning("No CSRF token available")
        }
    }
    
    // Debug function to print all cookies in storage
    public func debugCookies() {
        #if DEBUG
        AppLogger.network.debug("=== COOKIE DEBUG ===")
        
        // Print system cookies
        if let url = URL(string: self.baseURL) {
            let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
            AppLogger.network.debug("Found \(cookies.count, privacy: .public) cookies in system storage for \(self.baseURL, privacy: .public)")
            
            for cookie in cookies {
                AppLogger.debugSensitive("Cookie \(cookie.name)", sensitiveData: cookie.value, category: AppLogger.network)
                AppLogger.network.debug("  Domain: \(cookie.domain, privacy: .public), Path: \(cookie.path, privacy: .public)")
                AppLogger.network.debug("  Expires: \(cookie.expiresDate?.description ?? "N/A", privacy: .public)")
                AppLogger.network.debug("  Secure: \(cookie.isSecure, privacy: .public), HTTPOnly: \(cookie.isHTTPOnly, privacy: .public)")
            }
        } else {
            AppLogger.network.warning("Invalid URL for cookie debugging")
        }
        
        // Print manually stored cookies
        AppLogger.network.debug("Found \(self.cookieStorage.count, privacy: .public) cookies in manual storage")
        for (name, value) in self.cookieStorage {
            AppLogger.debugSensitive("Cookie \(name) (manual)", sensitiveData: value, category: AppLogger.network)
        }
        
        AppLogger.network.debug("=== END COOKIE DEBUG ===")
        #endif
    }
    
    public func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        parameters: [String: Any]? = nil,
        headers: [String: String]? = nil,
        useCache: Bool? = nil,
        cacheResponse: Bool? = nil
    ) async throws -> T {
        AppLogger.logRequest(method: method.rawValue, endpoint: endpoint, parameters: parameters)
        
        // Construct URL
        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Add common headers
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("application/json", forHTTPHeaderField: "Accept")
        request.addValue("MyHomeAgent/1.0 iOS", forHTTPHeaderField: "User-Agent")
        // Do NOT set Accept-Encoding manually - let URLSession handle it automatically
        // URLSession will add its own Accept-Encoding and automatically decompress responses
        // Disable caching to ensure fresh responses
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        
        // User-ID header removed
        
        // Only manually add cookies if we have cookies in manual storage that aren't in system storage
        // URLSession will automatically add cookies from HTTPCookieStorage.shared when httpShouldSetCookies = true
        // We only need to manually add cookies that were stored in our manual storage (e.g., HttpOnly cookies parsed manually)
        if !self.cookieStorage.isEmpty {
            // Get system cookies to avoid duplicates
            var systemCookieNames: Set<String> = []
            if let requestUrl = request.url,
               let systemCookies = HTTPCookieStorage.shared.cookies(for: requestUrl) {
                systemCookieNames = Set(systemCookies.map { $0.name })
            }
            
            // Only add manual cookies that aren't already in system storage
            let manualOnlyCookies = self.cookieStorage.filter { !systemCookieNames.contains($0.key) }
            
            if !manualOnlyCookies.isEmpty {
                let cookieString = manualOnlyCookies.map { "\($0.key)=\($0.value)" }.joined(separator: "; ")
                request.addValue(cookieString, forHTTPHeaderField: "Cookie")
                AppLogger.debugSensitive("Adding manual-only cookie header", sensitiveData: cookieString, category: AppLogger.network)
            } else {
                AppLogger.network.debug("All cookies already in system storage, letting URLSession handle them")
            }
        } else {
            AppLogger.network.debug("No manual cookies, letting URLSession handle system cookies automatically")
        }
        
        // Debug cookies before request
        debugCookies()
        #if DEBUG
        AppLogger.network.debug("Request headers for \(endpoint, privacy: .public):")
        if let allHeaders = request.allHTTPHeaderFields, !allHeaders.isEmpty {
            for (key, value) in allHeaders {
                let isSensitive = key.lowercased().contains("cookie") || key.lowercased().contains("auth") || key.lowercased().contains("token")
                if isSensitive {
                    AppLogger.debugSensitive("Header \(key)", sensitiveData: value, category: AppLogger.network)
                } else {
                    AppLogger.network.debug("  \(key, privacy: .public): \(value, privacy: .public)")
                }
            }
        } else {
            AppLogger.network.debug("No headers found for request")
        }
        #endif
        
        // Add parameters
        if let parameters = parameters {
            if method == .get {
                // For GET requests, add parameters as query items
                var components = URLComponents(url: url, resolvingAgainstBaseURL: true)!
                components.queryItems = parameters.map { key, value in
                    URLQueryItem(name: key, value: "\(value)")
                }
                request.url = components.url
            } else {
                // For other methods, add parameters as JSON body
                do {
                    request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
                } catch {
                    throw NetworkError.unknownError(error)
                }
            }
        }
        
        // Determine if we should use cache for this request using smart caching
        let urlString = request.url?.absoluteString ?? ""
        let cachePolicy = cacheManager.shouldCacheResource(url: urlString)
        let shouldUseCache = useCache ?? (self.shouldUseCache && cachePolicy.shouldCache)
        let shouldCacheResponse = cacheResponse ?? (self.shouldCacheResponses && cachePolicy.shouldCache)
        
        // Only use cache for GET requests
        if method == .get && shouldUseCache {
            let cacheKey = cacheManager.cacheKey(for: request)
            
            // Try to get cached response
            if let cachedData = cacheManager.getCachedData(for: cacheKey) {
                do {
                    let cachedResponse = try jsonDecoder.decode(T.self, from: cachedData)
                    AppLogger.network.debug("Using cached response for \(endpoint, privacy: .public)")
                    return cachedResponse
                } catch {
                    // If decoding fails, continue with network request
                    AppLogger.network.warning("Failed to decode cached response: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
        
        // Declare variables outside the do-catch blocks to maintain scope
        var responseData: Data!
        var urlResponse: URLResponse!
        
        do {
            AppLogger.network.debug("Executing request to \(request.url?.absoluteString ?? "unknown", privacy: .public)")
            // Make the request
            let (data, response) = try await session.data(for: request)
            AppLogger.network.debug("Received data: \(data.count, privacy: .public) bytes immediately after request")
            responseData = data
            urlResponse = response
        } catch let urlError as URLError {
            // Handle specific URLError cases
            AppLogger.network.error("URLError occurred: \(urlError.localizedDescription, privacy: .public), code: \(urlError.code.rawValue, privacy: .public)")
            
            switch urlError.code {
            case .timedOut:
                AppLogger.network.error("Request timed out")
                throw NetworkError.timeoutError
            case .notConnectedToInternet:
                AppLogger.network.error("Not connected to internet")
                throw NetworkError.connectionError
            case .cannotConnectToHost:
                AppLogger.network.error("Cannot connect to host")
                throw NetworkError.connectionError
            default:
                AppLogger.network.error("Other URL error: \(urlError.localizedDescription, privacy: .public)")
                throw NetworkError.unknownError(urlError)
            }
        } catch {
            AppLogger.network.error("Unexpected error: \(error.localizedDescription, privacy: .public)")
            throw NetworkError.unknownError(error)
        }
        
        // Check for HTTP response
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            AppLogger.network.error("Invalid response type received")
            throw NetworkError.invalidResponse
        }
        
        // Debug: Print all response headers
        #if DEBUG
        AppLogger.network.debug("Response headers from \(httpResponse.url?.absoluteString ?? "unknown", privacy: .public):")
        if let allHeaders = httpResponse.allHeaderFields as? [String: Any], !allHeaders.isEmpty {
            for (key, value) in allHeaders {
                AppLogger.network.debug("  \(key, privacy: .public): \(String(describing: value), privacy: .public)")
            }
        } else {
            AppLogger.network.debug("No response headers found")
        }
        #endif
        
        // Process cookies from response manually
        if let headerFields = httpResponse.allHeaderFields as? [String: String] {
            // Check for Set-Cookie headers (could be multiple)
            let setCookieHeaders = headerFields.filter { $0.key.lowercased() == "set-cookie" }
            
            if !setCookieHeaders.isEmpty {
                AppLogger.network.debug("Received \(setCookieHeaders.count, privacy: .public) Set-Cookie headers")
                
                for (_, cookieHeader) in setCookieHeaders {
                    AppLogger.debugSensitive("Processing cookie header", sensitiveData: cookieHeader, category: AppLogger.network)
                    
                    // Parse the cookie string
                    let parts = cookieHeader.split(separator: ";").map { String($0).trimmingCharacters(in: .whitespaces) }
                    
                    // Extract the name-value pair from the first part
                    if let firstPart = parts.first, firstPart.contains("=") {
                        let nameValue = firstPart.split(separator: "=", maxSplits: 1).map { String($0) }
                        if nameValue.count == 2 {
                            let name = nameValue[0].trimmingCharacters(in: .whitespaces)
                            let value = nameValue[1].trimmingCharacters(in: .whitespaces)
                            
                            // Store in our manual cookie storage
                            self.cookieStorage[name] = value
                            AppLogger.debugSensitive("Stored cookie \(name)", sensitiveData: value, category: AppLogger.network)
                            
                            // Cache CSRF token separately for easy access
                            if name == "csrftoken" {
                                self.csrfToken = value
                                AppLogger.network.debug("Cached CSRF token")
                            }
                            
                            // Check if this is an HttpOnly cookie (look for HttpOnly flag)
                            let isHttpOnly = parts.contains { $0.lowercased() == "httponly" }
                            AppLogger.network.debug("Cookie \(name, privacy: .public) is\(isHttpOnly ? "" : " not", privacy: .public) HttpOnly")
                        }
                    }
                }
            }
        }
        
        // Debug cookies after response
        debugCookies()
        
        AppLogger.logResponse(statusCode: httpResponse.statusCode, endpoint: endpoint)
        #if DEBUG
        AppLogger.network.debug("Response data size: \(responseData.count, privacy: .public) bytes")
        if let responseString = String(data: responseData, encoding: .utf8) {
            // Truncate long responses for logging
            let truncated = responseString.count > 2000 ? String(responseString.prefix(2000)) + "... [truncated]" : responseString
            AppLogger.network.debug("Response data: \(truncated, privacy: .public)")
        } else {
            AppLogger.network.warning("Could not decode response data as UTF-8 string")
            // Try to log hex representation of first few bytes
            let hexString = responseData.prefix(100).map { String(format: "%02x", $0) }.joined(separator: " ")
            AppLogger.network.debug("Response data (hex): \(hexString, privacy: .public)")
        }
        #endif
        
        // Handle HTTP status codes
        switch httpResponse.statusCode {
        case 200...299:
            // Success
            do {
                // Rewrite any media URLs in the response before decoding
                let processedData = rewriteMediaURLs(in: responseData)
                
                let decodedResponse = try jsonDecoder.decode(T.self, from: processedData)
                
                // Cache the successful response if it's a GET request
                if method == .get && shouldCacheResponse {
                    let cacheKey = cacheManager.cacheKey(for: request)
                    cacheManager.cacheData(processedData, for: cacheKey, ttl: cachePolicy.ttl)
                    AppLogger.network.debug("Cached response for \(endpoint, privacy: .public) with TTL: \(cachePolicy.ttl ?? 0, privacy: .public)s")
                }
                
                // Invalidate related caches on mutations (POST, PUT, PATCH, DELETE)
                if [.post, .put, .patch, .delete].contains(method) {
                    invalidateRelatedCaches(for: endpoint)
                }
                
                return decodedResponse
            } catch {
                AppLogger.network.error("Decoding error: \(error.localizedDescription, privacy: .public)")
                AppLogger.network.error("Failed to decode type: \(String(describing: T.self), privacy: .public)")
                #if DEBUG
                if let responseString = String(data: responseData, encoding: .utf8) {
                    AppLogger.network.error("Raw response data: \(responseString, privacy: .public)")
                }
                #endif
                throw NetworkError.decodingError(error)
            }
        case 401:
            // Unauthorized - try to refresh token
            if endpoint != "/api/users/token/refresh/" && endpoint != "/api/users/profile/" && endpoint != "/api/users/login/" {
                do {
                    try await AuthManager.shared.refreshAccessToken()
                    // Retry the request with new token
                    return try await self.request(endpoint: endpoint, method: method, parameters: parameters, headers: headers)
                } catch {
                    AuthManager.shared.logout()
                    throw NetworkError.unauthorized
                }
            } else {
                throw NetworkError.unauthorized
            }
        case 400...499:
            // Client error
            var errorMessage = "Client error"
            if let errorData = try? JSONDecoder().decode([String: String].self, from: responseData),
               let message = errorData["message"] ?? errorData["error"] {
                errorMessage = message
            }
            
            // Check if this is a session expiration issue
            if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
                AppLogger.network.error("Authentication error (\(httpResponse.statusCode, privacy: .public)). Session may have expired.")
                if let sessionCookie = getSessionCookieValue() {
                    AppLogger.debugSensitive("Current session cookie", sensitiveData: sessionCookie, category: AppLogger.network)
                } else {
                    AppLogger.network.error("No session cookie found")
                }
            }
            
            throw NetworkError.serverError(errorMessage)
        case 500...599:
            // Server error
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, data: responseData)
        default:
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, data: responseData)
        }
    }
    
    // MARK: - Media Management
    
    /// Delete a media file
    func deleteMedia(mediaId: String) async throws {
        let endpoint = "/api/media/\(mediaId)/"
        let _: EmptyResponse = try await request(endpoint: endpoint, method: .delete)
        
        // Invalidate related caches
        invalidateRelatedCaches(for: endpoint)
    }
    
    /// Update media metadata
    func updateMediaMetadata(mediaId: String, metadata: [String: Any]) async throws -> Media {
        let endpoint = "/api/media/\(mediaId)/update/"
        let media: Media = try await request(endpoint: endpoint, method: .patch, parameters: metadata)
        
        // Invalidate related caches
        invalidateRelatedCaches(for: endpoint)
        
        return media
    }
    
    // MARK: - Cache Invalidation
    
    /// Invalidate caches related to a mutated endpoint
    private func invalidateRelatedCaches(for endpoint: String) {
        // Properties endpoints
        if endpoint.contains("/api/properties") {
            cacheManager.invalidateCache(matching: "/api/properties")
            AppLogger.storage.debug("Invalidated property caches")
        }
        
        // User profile endpoints
        if endpoint.contains("/api/users/profile") {
            cacheManager.invalidateCache(matching: "/api/users/profile")
            AppLogger.storage.debug("Invalidated user profile cache")
        }
        
        // Service requests endpoints
        if endpoint.contains("/api/service-requests") {
            cacheManager.invalidateCache(matching: "/api/service-requests")
            AppLogger.storage.debug("Invalidated service request caches")
        }
        
        // Add more endpoint patterns as needed
    }
    
    /// Public method to manually invalidate specific caches
    public func invalidateCache(for pattern: String) {
        cacheManager.invalidateCache(matching: pattern)
    }
    
    /// Public method to clear all caches
    public func clearAllCaches() {
        cacheManager.clearCache()
        AppLogger.storage.info("Cleared all caches")
    }
    
    // MARK: - Brotli Decompression
    
    /// Decompress Brotli-encoded data using the Compression framework
    /// - Parameter data: Brotli-compressed data
    /// - Returns: Decompressed data, or nil if decompression fails
    private func decompressBrotli(_ data: Data) -> Data? {
        // Estimate decompressed size (brotli typically achieves 20-26% compression)
        // Start with 4x the compressed size and grow if needed
        let destinationBufferSize = data.count * 4
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: destinationBufferSize)
        defer { destinationBuffer.deallocate() }
        
        let decompressedSize = data.withUnsafeBytes { sourceBuffer -> Int in
            guard let sourcePointer = sourceBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else {
                return 0
            }
            
            let result = compression_decode_buffer(
                destinationBuffer,
                destinationBufferSize,
                sourcePointer,
                data.count,
                nil,
                COMPRESSION_BROTLI
            )
            
            return result
        }
        
        guard decompressedSize > 0 else {
            AppLogger.network.error("Brotli decompression failed")
            return nil
        }
        
        AppLogger.network.debug("Brotli decompressed \(data.count) bytes to \(decompressedSize) bytes")
        return Data(bytes: destinationBuffer, count: decompressedSize)
    }
}
