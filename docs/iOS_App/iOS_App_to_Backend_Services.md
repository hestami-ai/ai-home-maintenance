# iOS App to Backend Services Integration Roadmap

## 1. API Client Architecture

For your iOS app to communicate with the Hestami AI backend, we'll implement a structured API client architecture that reflects the actual implementation:

```
iOS App
  ↓
NetworkManager (Core networking layer)
  ↓
API Services (Service-specific APIs)
  ↓
SvelteKit API Routes (Proxy Layer)
  ↓
Django REST Framework Backend
```

**Implementation Details:**

* **NetworkManager**: A singleton class handling all HTTP requests with URLSession, including JWT token management
* **API Services**: Separate service classes for different domains (Properties, Services, Requests, Users, Media)
* **Request/Response Models**: Swift structs conforming to Codable that match the actual backend models
* **Dependency Injection**: For testability and flexibility
* **Error Handling**: Standardized error handling for API responses

## 2. Authentication Implementation

Authentication is critical for secure communication with your backend. Based on the actual implementation:

* **Token-based Authentication**: JWT (JSON Web Tokens) with access and refresh tokens
* **Secure Storage**: Use Keychain for storing both access and refresh tokens
* **Auto-refresh**: Implement token refresh mechanism using the dedicated refresh endpoint
* **Login Flow**: 
  - Email/password authentication (primary method)
  - Biometric authentication for local security

**Implementation Example:**
```swift
class AuthManager {
    static let shared = AuthManager()
    private let keychainService = "com.hestami.app"
    
    var accessToken: String? {
        get { /* Retrieve from Keychain */ }
        set { /* Store in Keychain */ }
    }
    
    var refreshToken: String? {
        get { /* Retrieve from Keychain */ }
        set { /* Store in Keychain */ }
    }
    
    func login(email: String, password: String) async throws -> User {
        // API call to authenticate and store tokens
        let response = try await NetworkManager.shared.request(
            endpoint: "api/users/login/",
            method: .post,
            parameters: ["email": email, "password": password]
        )
        
        // Store tokens in keychain
        self.accessToken = response.access
        self.refreshToken = response.refresh
        
        return response.user
    }
    
    func refreshAccessToken() async throws {
        // Use refresh token to get new access token
        let response = try await NetworkManager.shared.request(
            endpoint: "api/users/token/refresh/",
            method: .post,
            parameters: ["refresh": refreshToken ?? ""]
        )
        
        self.accessToken = response.access
    }
    
    var isAuthenticated: Bool {
        return accessToken != nil
    }
    
    func logout() {
        // Clear tokens and user data
        accessToken = nil
        refreshToken = nil
    }
}
```

## 3. Data Models for API Responses

Based on the actual backend implementation, here are the key data models needed for API integration:

```swift
// User model
struct User: Codable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let userRole: String
    let phoneNumber: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case firstName = "first_name"
        case lastName = "last_name"
        case userRole = "user_role"
        case phoneNumber = "phone_number"
    }
}

// Property model
struct Property: Codable {
    let id: String
    let title: String
    let address: String
    let propertyType: String
    let thumbnail: String?
    let owner: User
    let serviceRequests: [ServiceRequest]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case address
        case propertyType = "property_type"
        case thumbnail
        case owner
        case serviceRequests = "service_requests"
    }
}

// Service Category enum
enum ServiceCategory: String, Codable {
    case plumbing = "PLUMBING"
    case electrical = "ELECTRICAL"
    case hvac = "HVAC"
    case generalMaintenance = "GENERAL_MAINTENANCE"
    case landscaping = "LANDSCAPING"
    case cleaning = "CLEANING"
    case security = "SECURITY"
    case pestControl = "PEST_CONTROL"
    case roofing = "ROOFING"
    case remodeling = "REMODELING"
    case other = "OTHER"
}

// Service Request Status enum
enum ServiceRequestStatus: String, Codable {
    case pending = "PENDING"
    case inResearch = "IN_RESEARCH"
    case bidding = "BIDDING"
    case reopenedBidding = "REOPENED_BIDDING"
    case accepted = "ACCEPTED"
    case scheduled = "SCHEDULED"
    case inProgress = "IN_PROGRESS"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"
    case declined = "DECLINED"
}

// Priority enum
enum Priority: String, Codable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"
    case urgent = "URGENT"
}

// Service Request model
struct ServiceRequest: Codable {
    let id: String
    let title: String
    let description: String
    let property: String // Property ID
    let category: ServiceCategory
    let status: ServiceRequestStatus
    let priority: Priority
    let createdAt: Date
    let scheduledStart: Date?
    let scheduledEnd: Date?
    let estimatedCost: Decimal?
    let provider: ServiceProvider?
    let mediaUrls: [String]?
    let timeline: [TimelineEntry]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case property
        case category
        case status
        case priority
        case createdAt = "created_at"
        case scheduledStart = "scheduled_start"
        case scheduledEnd = "scheduled_end"
        case estimatedCost = "estimated_cost"
        case provider
        case mediaUrls = "media_urls"
        case timeline
    }
}

// Service Provider model
struct ServiceProvider: Codable {
    let id: String
    let companyName: String
    let description: String?
    let rating: Decimal
    let totalReviews: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case companyName = "company_name"
        case description
        case rating
        case totalReviews = "total_reviews"
    }
}

// Timeline Entry model
struct TimelineEntry: Codable {
    let id: String
    let serviceRequest: String
    let entryType: String
    let title: String
    let content: String
    let createdAt: Date
    let createdBy: User?
    let visibility: String
    let isRead: Bool
    
    enum CodingKeys: String, CodingKey {
        case id
        case serviceRequest = "service_request"
        case entryType = "entry_type"
        case title
        case content
        case createdAt = "created_at"
        case createdBy = "created_by"
        case visibility
        case isRead = "is_read"
    }
}
```

## 4. Media Upload Functionality

For handling photo and video uploads from your property management app:

* **Chunked Uploads**: For large video files, implement chunked uploads
* **Background Uploads**: Use URLSession background tasks for reliability
* **Compression**: Compress media before upload to save bandwidth
* **Progress Tracking**: Provide upload progress to users

**Implementation Approach:**
```swift
class MediaUploadService {
    func uploadMedia(data: Data, type: MediaType, propertyId: String) async throws -> MediaUploadResponse {
        // Configure multipart form data
        // Handle background upload session
        // Track and report progress
    }
    
    func uploadLargeVideo(url: URL, propertyId: String) async throws -> MediaUploadResponse {
        // Implement chunked upload for large videos
    }
}
```

## 5. Error Handling Strategy

A robust error handling strategy is essential for a reliable app experience:

* **Typed Errors**: Define specific error types for different failure scenarios
* **User-friendly Messages**: Translate technical errors into user-friendly messages
* **Retry Mechanism**: Implement automatic retry for transient network issues
* **Logging**: Log errors for debugging and analytics

```swift
enum APIError: Error {
    case networkError(Error)
    case serverError(Int, String)
    case authenticationError
    case decodingError(Error)
    case uploadError(Error)
    case unknownError
    
    var userMessage: String {
        // Return user-friendly message based on error type
    }
}

// Usage in NetworkManager
func handleError(_ error: Error) -> APIError {
    // Convert and standardize errors
}
```

## 6. Caching and Offline Functionality

For a seamless user experience even with intermittent connectivity:

* **Local Storage**: Use Core Data for structured data persistence
* **Image Caching**: Implement SDWebImage or similar for efficient image caching
* **Offline Queue**: Queue requests when offline for later submission
* **Sync Strategy**: Implement conflict resolution for offline changes

```swift
class CacheManager {
    // Cache API responses with TTL (Time To Live)
    func cacheResponse<T: Codable>(_ response: T, for key: String, ttl: TimeInterval)
    
    // Retrieve cached response if available and not expired
    func getCachedResponse<T: Codable>(for key: String) -> T?
    
    // Clear expired cache entries
    func clearExpiredCache()
}

class OfflineQueueManager {
    // Queue operations for later execution
    func queueOperation(endpoint: String, method: HTTPMethod, parameters: [String: Any])
    
    // Process queue when connectivity is restored
    func processQueue() async
}
```

## 7. API Endpoints and Integration Points

Based on the actual implementation, here are the correct API endpoints for integration:

### Authentication Endpoints
- `POST /api/users/login/` - User login
- `POST /api/users/token/refresh/` - Refresh authentication token
- `POST /api/users/token/verify/` - Verify token validity
- `POST /api/users/register/` - User registration
- `POST /api/users/logout/` - User logout
- `GET /api/users/profile/` - Get user profile

### Property Endpoints
- `GET /api/properties/` - List user properties
- `POST /api/properties/create/` - Create new property
- `GET /api/properties/{id}/` - Get property details
- `PUT /api/properties/{id}/` - Update property
- `DELETE /api/properties/{id}/` - Delete property

### Service Endpoints
- `GET /api/services/categories/` - List service categories
- `GET /api/services/providers/` - List service providers
- `GET /api/services/providers/profile/` - Get provider profile

### Service Request Endpoints
- `GET /api/services/requests/` - List service requests
- `POST /api/services/requests/create/` - Create new service request
- `GET /api/services/requests/{request_id}/` - Get request details
- `POST /api/services/requests/{request_id}/start/` - Start service
- `POST /api/services/requests/{request_id}/complete/` - Complete service
- `POST /api/services/requests/{request_id}/review/` - Create review

### Bidding System Endpoints
- `GET /api/services/requests/{request_id}/bids/` - List bids
- `POST /api/services/requests/{request_id}/bids/submit/` - Submit bid
- `POST /api/services/requests/{request_id}/bids/{bid_id}/select/` - Select bid

### Timeline Endpoints
- `GET /api/services/requests/{service_request_id}/timeline/` - Get timeline entries
- `POST /api/services/requests/{service_request_id}/timeline/` - Create timeline entry
- `GET /api/services/requests/{service_request_id}/timeline/{pk}/` - Get timeline entry details
- `POST /api/services/requests/{service_request_id}/timeline/comment/` - Add comment to timeline
- `GET /api/services/requests/{service_request_id}/timeline/unread/` - Get unread timeline entries

### Media Upload Endpoints
- `POST /api/media/upload/` - Upload media file
- `POST /api/media/chunk/` - Upload media chunk (for large files)
- `GET /api/media/{id}/` - Get media details

# Implementation Recommendations

1. **Start with Core Networking Layer**:
   - Implement `NetworkManager` with JWT authentication handling
   - Create service-specific API clients that match the actual backend structure
   - Implement proper error handling for API responses

2. **Implement Authentication First**:
   - Build login/registration screens using the correct endpoints
   - Set up secure token storage for both access and refresh tokens
   - Implement token refresh mechanism using the `/api/users/token/refresh/` endpoint

3. **Implement Data Models**:
   - Create Swift models that match the actual backend data structures
   - Use proper CodingKeys to handle snake_case to camelCase conversion
   - Implement enums for status, category, and priority fields to match backend choices

4. **Implement Service Request Flow**:
   - Build the service request creation and management screens
   - Implement timeline functionality for tracking request progress
   - Add support for bidding system integration

5. **Add Media Upload Functionality**:
   - Implement the media capture and upload flow
   - Add progress indicators and background upload support
   - Handle image compression and optimization

6. **Implement Offline Support**:
   - Add caching for critical data
   - Implement offline queue for service requests
   - Develop sync strategy for handling conflicts

7. **Testing Strategy**:
   - Unit tests for API client and models
   - Mock server for integration testing
   - UI tests for critical flows