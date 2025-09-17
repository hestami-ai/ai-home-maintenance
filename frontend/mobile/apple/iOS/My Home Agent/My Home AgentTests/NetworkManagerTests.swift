import XCTest
@testable import My_Home_Agent

final class NetworkManagerTests: XCTestCase {
    
    var networkManager: NetworkManager!
    var mockURLSession: MockURLSession!
    
    override func setUp() {
        super.setUp()
        mockURLSession = MockURLSession()
        networkManager = NetworkManager.shared
        // Clear cache before each test
        CacheManager.shared.clearCache()
    }
    
    override func tearDown() {
        networkManager = nil
        mockURLSession = nil
        super.tearDown()
    }
    
    func testSuccessfulRequest() async {
        // Given
        let mockData = """
        {
            "id": "123",
            "name": "Test Service",
            "description": "Test Description"
        }
        """.data(using: .utf8)!
        
        mockURLSession.mockResponse = (mockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        
        // When/Then
        do {
            let response: MockResponse = try await networkManager.request(endpoint: "/test")
            XCTAssertEqual(response.id, "123")
            XCTAssertEqual(response.name, "Test Service")
            XCTAssertEqual(response.description, "Test Description")
        } catch {
            XCTFail("Request should not fail: \(error)")
        }
    }
    
    func testUnauthorizedRequest() async {
        // Given
        let mockData = """
        {
            "error": "Unauthorized"
        }
        """.data(using: .utf8)!
        
        mockURLSession.mockResponse = (mockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 401, httpVersion: nil, headerFields: nil)!)
        
        // When/Then
        do {
            let _: MockResponse = try await networkManager.request(endpoint: "/test")
            XCTFail("Request should fail with unauthorized error")
        } catch let error as NetworkError {
            XCTAssertTrue(error.isAuthError)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testServerError() async {
        // Given
        let mockData = """
        {
            "error": "Internal Server Error"
        }
        """.data(using: .utf8)!
        
        mockURLSession.mockResponse = (mockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 500, httpVersion: nil, headerFields: nil)!)
        
        // When/Then
        do {
            let _: MockResponse = try await networkManager.request(endpoint: "/test")
            XCTFail("Request should fail with server error")
        } catch let error as NetworkError {
            if case .httpError(let statusCode, _) = error {
                XCTAssertEqual(statusCode, 500)
            } else {
                XCTFail("Expected httpError but got \(error)")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
    
    func testCacheResponse() async {
        // Given
        let mockData = """
        {
            "id": "123",
            "name": "Test Service",
            "description": "Test Description"
        }
        """.data(using: .utf8)!
        
        mockURLSession.mockResponse = (mockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        
        // When - First request should hit the network
        do {
            let response1: MockResponse = try await networkManager.request(endpoint: "/test", method: .get, useCache: true, cacheResponse: true)
            XCTAssertEqual(response1.id, "123")
            
            // Change the mock response to simulate different server data
            let updatedMockData = """
            {
                "id": "456",
                "name": "Updated Service",
                "description": "Updated Description"
            }
            """.data(using: .utf8)!
            mockURLSession.mockResponse = (updatedMockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
            
            // Second request should use cache
            let response2: MockResponse = try await networkManager.request(endpoint: "/test", method: .get, useCache: true, cacheResponse: true)
            
            // Should still get the original response from cache
            XCTAssertEqual(response2.id, "123")
            
        } catch {
            XCTFail("Request should not fail: \(error)")
        }
    }
    
    func testOfflineMode() async {
        // Given
        let mockData = """
        {
            "id": "123",
            "name": "Test Service",
            "description": "Test Description"
        }
        """.data(using: .utf8)!
        
        mockURLSession.mockResponse = (mockData, HTTPURLResponse(url: URL(string: "https://api.hestami.ai/test")!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        
        // When - First request should hit the network and cache
        do {
            let response1: MockResponse = try await networkManager.request(endpoint: "/test", method: .get, useCache: true, cacheResponse: true)
            XCTAssertEqual(response1.id, "123")
            
            // Now simulate offline mode with a network error
            mockURLSession.shouldThrowNetworkError = true
            
            // Second request should use cache even though network is down
            let response2: MockResponse = try await networkManager.request(endpoint: "/test", method: .get, useCache: true, cacheResponse: true)
            
            // Should get the cached response
            XCTAssertEqual(response2.id, "123")
            
        } catch {
            XCTFail("Request should not fail when offline with cache available: \(error)")
        }
    }
}

// MARK: - Mock Classes

class MockURLSession: URLSession {
    var mockResponse: (Data, URLResponse) = (Data(), URLResponse())
    var shouldThrowNetworkError = false
    
    override func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        if shouldThrowNetworkError {
            throw URLError(.notConnectedToInternet)
        }
        return mockResponse
    }
}

struct MockResponse: Codable {
    let id: String
    let name: String
    let description: String
}
