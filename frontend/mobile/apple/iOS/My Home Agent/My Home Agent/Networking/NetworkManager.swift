import Foundation

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
    
    // API server configuration
    public let baseURL = "https://dev-homeservices.hestami-ai.com"
    
    // Static media server configuration
    private var staticMediaHost = "dev-static.hestami-ai.com" // Default value, should be configured at app startup
    private var staticMediaPort = "443" // Default value, should be configured at app startup
    private let localhostMediaPattern = "http://localhost:8090/media-secure"
    
    private let session: URLSession
    private let jsonDecoder = JSONDecoder()
    private let cacheManager = CacheManager.shared
    
    // Manual cookie storage for HttpOnly cookies
    private var cookieStorage: [String: String] = [:]
    
    // Configuration options
    var shouldUseCache = true  // Enable smart caching
    var shouldCacheResponses = true
    
    // Media server configuration methods
    public func configureStaticMediaServer(host: String, port: String) {
        print("🌐 NetworkManager: Configuring static media server: \(host):\(port)")
        if !host.isEmpty {
            self.staticMediaHost = host
        }
        if !port.isEmpty {
            self.staticMediaPort = port
        }
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
        
        print("🌐 NetworkManager: Rewrote URL:\n  From: \(urlString)\n  To: \(rewrittenURL)")
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
        print("🍪 NetworkManager: Cleared manual cookie storage")
    }
    
    // Check if we have a session cookie
    public func hasSessionCookie() -> Bool {
        let hasSession = getSessionCookieValue() != nil
        print("🍪 NetworkManager: hasSessionCookie = \(hasSession)")
        if hasSession {
            print("🍪 NetworkManager: Session cookie value: \(getSessionCookieValue() ?? "none")")
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
    
    // Debug function to print all cookies in storage
    public func debugCookies() {
        print("🍪 NetworkManager: === COOKIE DEBUG ===")
        
        // Print system cookies
        if let url = URL(string: baseURL) {
            let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
            print("🍪 NetworkManager: Found \(cookies.count) cookies in system storage for \(baseURL):")
            
            for cookie in cookies {
                print("🍪 - \(cookie.name): \(cookie.value)")
                print("    Domain: \(cookie.domain), Path: \(cookie.path)")
                print("    Expires: \(cookie.expiresDate?.description ?? "N/A")")
                print("    Secure: \(cookie.isSecure), HTTPOnly: \(cookie.isHTTPOnly)")
                // Note: SameSite policy isn't directly accessible in HTTPCookie
            }
        } else {
            print("🍪 NetworkManager: Invalid URL for cookie debugging")
        }
        
        // Print manually stored cookies
        print("🍪 NetworkManager: Found \(cookieStorage.count) cookies in manual storage:")
        for (name, value) in cookieStorage {
            print("🍪 - \(name): \(value) (manually stored)")
        }
        
        print("🍪 NetworkManager: === END COOKIE DEBUG ===")
    }
    
    public func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        parameters: [String: Any]? = nil,
        headers: [String: String]? = nil,
        useCache: Bool? = nil,
        cacheResponse: Bool? = nil
    ) async throws -> T {
        print("🌐 NetworkManager: Request to \(baseURL)\(endpoint) with method \(method.rawValue)")
        
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
        
        // User-ID header removed
        
        // Manually add cookies from our storage if available
        if !self.cookieStorage.isEmpty {
            // Format cookies as name=value; name2=value2
            let cookieString = self.cookieStorage.map { key, value in "\(key)=\(value)" }.joined(separator: "; ")
            request.addValue(cookieString, forHTTPHeaderField: "Cookie")
            print("🍪 NetworkManager: Adding cookie header: \(cookieString)")
        }
        
        // Debug cookies before request
        debugCookies()
        print("🔎 NetworkManager: Request headers for \(endpoint):")
        if let allHeaders = request.allHTTPHeaderFields, !allHeaders.isEmpty {
            for (key, value) in allHeaders {
                print("🔎 - \(key): \(value)")
            }
        } else {
            print("🔎 NetworkManager: No headers found for request")
        }
        
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
                    print("✅ NetworkManager: Using cached response for \(endpoint)")
                    return cachedResponse
                } catch {
                    // If decoding fails, continue with network request
                    print("⚠️ NetworkManager: Failed to decode cached response: \(error)")
                }
            }
        }
        
        // Declare variables outside the do-catch blocks to maintain scope
        var responseData: Data!
        var urlResponse: URLResponse!
        
        do {
            print("🌐 NetworkManager: Executing request to \(request.url?.absoluteString ?? "unknown")")
            // Make the request
            let (data, response) = try await session.data(for: request)
            responseData = data
            urlResponse = response
        } catch let urlError as URLError {
            // Handle specific URLError cases
            print("❌ NetworkManager: URLError occurred: \(urlError.localizedDescription), code: \(urlError.code.rawValue)")
            
            switch urlError.code {
            case .timedOut:
                print("❌ NetworkManager: Request timed out")
                throw NetworkError.timeoutError
            case .notConnectedToInternet:
                print("❌ NetworkManager: Not connected to internet")
                throw NetworkError.connectionError
            case .cannotConnectToHost:
                print("❌ NetworkManager: Cannot connect to host")
                throw NetworkError.connectionError
            default:
                print("❌ NetworkManager: Other URL error: \(urlError)")
                throw NetworkError.unknownError(urlError)
            }
        } catch {
            print("❌ NetworkManager: Unexpected error: \(error)")
            throw NetworkError.unknownError(error)
        }
        
        // Check for HTTP response
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            print("❌ NetworkManager: Invalid response type received")
            throw NetworkError.invalidResponse
        }
        
        // Debug: Print all response headers
        print("🔍 NetworkManager: Response headers from \(httpResponse.url?.absoluteString ?? "unknown"):")
        if let allHeaders = httpResponse.allHeaderFields as? [String: Any], !allHeaders.isEmpty {
            for (key, value) in allHeaders {
                print("🔍 - \(key): \(value)")
            }
        } else {
            print("🔍 NetworkManager: No response headers found")
        }
        
        // Process cookies from response manually
        if let headerFields = httpResponse.allHeaderFields as? [String: String] {
            // Check for Set-Cookie headers (could be multiple)
            let setCookieHeaders = headerFields.filter { $0.key.lowercased() == "set-cookie" }
            
            if !setCookieHeaders.isEmpty {
                print("🍪 NetworkManager: Received \(setCookieHeaders.count) Set-Cookie headers")
                
                for (_, cookieHeader) in setCookieHeaders {
                    print("🍪 NetworkManager: Processing cookie header: \(cookieHeader)")
                    
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
                            print("🍪 NetworkManager: Stored cookie: \(name)=\(value)")
                            
                            // Check if this is an HttpOnly cookie (look for HttpOnly flag)
                            let isHttpOnly = parts.contains { $0.lowercased() == "httponly" }
                            print("🍪 NetworkManager: Cookie \(name) is\(isHttpOnly ? "" : " not") HttpOnly")
                        }
                    }
                }
            }
        }
        
        // Debug cookies after response
        debugCookies()
        
        print("🌐 NetworkManager: Received response with status code: \(httpResponse.statusCode)")
        if let responseString = String(data: responseData, encoding: .utf8) {
            print("🌐 NetworkManager: Response data: \(responseString)")
        }
        
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
                    print("💾 NetworkManager: Cached response for \(endpoint) with TTL: \(cachePolicy.ttl ?? 0)s")
                }
                
                // Invalidate related caches on mutations (POST, PUT, PATCH, DELETE)
                if [.post, .put, .patch, .delete].contains(method) {
                    invalidateRelatedCaches(for: endpoint)
                }
                
                return decodedResponse
            } catch {
                print("❌ NetworkManager: Decoding error: \(error)")
                print("❌ NetworkManager: Failed to decode type: \(T.self)")
                if let responseString = String(data: responseData, encoding: .utf8) {
                    print("❌ NetworkManager: Raw response data: \(responseString)")
                }
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
                print("❌ NetworkManager: Authentication error (\(httpResponse.statusCode)). Session may have expired.")
                print("❌ NetworkManager: Current session cookie: \(getSessionCookieValue() ?? "none")")
            }
            
            throw NetworkError.serverError(errorMessage)
        case 500...599:
            // Server error
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, data: responseData)
        default:
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, data: responseData)
        }
    }
    
    // MARK: - Cache Invalidation
    
    /// Invalidate caches related to a mutated endpoint
    private func invalidateRelatedCaches(for endpoint: String) {
        // Properties endpoints
        if endpoint.contains("/api/properties") {
            cacheManager.invalidateCache(matching: "/api/properties")
            print("🗑️ NetworkManager: Invalidated property caches")
        }
        
        // User profile endpoints
        if endpoint.contains("/api/users/profile") {
            cacheManager.invalidateCache(matching: "/api/users/profile")
            print("🗑️ NetworkManager: Invalidated user profile cache")
        }
        
        // Service requests endpoints
        if endpoint.contains("/api/service-requests") {
            cacheManager.invalidateCache(matching: "/api/service-requests")
            print("🗑️ NetworkManager: Invalidated service request caches")
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
        print("🗑️ NetworkManager: Cleared all caches")
    }
}
