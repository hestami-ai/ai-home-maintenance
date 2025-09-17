import Foundation
import SwiftUI
import Combine

class DashboardViewModel: ObservableObject {
    // Published properties for UI
    @Published var properties: [Property] = []
    @Published var serviceRequests: [ServiceRequest] = []
    @Published var isLoadingProperties = false
    @Published var isLoadingRequests = false
    @Published var errorMessage: String?
    @Published var showError = false
    @Published var currentUser: User?
    
    private let networkManager = NetworkManager.shared
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Check if user is authenticated and validate session
        Task {
            if AuthManager.shared.isAuthenticated {
                // Validate the session is still active
                if await AuthManager.shared.validateSession() {
                    // Session is valid, load dashboard data
                    await MainActor.run {
                        fetchDashboardData()
                        loadCurrentUserInBackground()
                    }
                } else {
                    // Session is invalid, try to login with stored credentials
                    print("❌ DashboardViewModel: Session validation failed, attempting to login with stored credentials")
                    do {
                        if let email = AuthManager.shared.storedEmail, let password = AuthManager.shared.storedPassword {
                            _ = try await AuthManager.shared.login(email: email, password: password, rememberMe: AuthManager.shared.isRememberMeEnabled)
                            // Login successful, load dashboard data
                            await MainActor.run {
                                fetchDashboardData()
                                loadCurrentUserInBackground()
                            }
                        } else {
                            // No stored credentials, post logout notification
                            await MainActor.run {
                                NotificationCenter.default.post(name: NSNotification.Name("LogoutRequired"), object: nil)
                            }
                        }
                    } catch {
                        // Login failed, post logout notification
                        print("❌ DashboardViewModel: Login with stored credentials failed: \(error.localizedDescription)")
                        await MainActor.run {
                            NotificationCenter.default.post(name: NSNotification.Name("LogoutRequired"), object: nil)
                        }
                    }
                }
            } else {
                // Not authenticated, post logout notification
                await MainActor.run {
                    NotificationCenter.default.post(name: NSNotification.Name("LogoutRequired"), object: nil)
                }
            }
        }
    }
    
    // Optional background fetch of user profile - won't block main functionality
    func loadCurrentUserInBackground() {
        guard AuthManager.shared.isAuthenticated else {
            print("⚠️ DashboardViewModel: Not authenticated, skipping user profile fetch")
            return
        }
        
        Task {
            do {
                // Fetch current user profile
                let user: User = try await networkManager.request(
                    endpoint: "/api/users/profile/",
                    method: .get,
                    parameters: [:] // Empty parameters for POST request
                )
                
                await MainActor.run {
                    self.currentUser = user
                    print("✅ DashboardViewModel: User profile loaded successfully")
                }
            } catch let networkError as NetworkError {
                await MainActor.run {
                    // Handle specific network errors but don't disrupt app flow
                    switch networkError {
                    case .timeoutError:
                        print("ℹ️ DashboardViewModel: Connection timed out while loading user profile")
                    case .connectionError:
                        print("ℹ️ DashboardViewModel: Connection error while loading user profile")
                    case .unauthorized:
                        print("ℹ️ DashboardViewModel: Unauthorized access while loading user profile")
                        // Only post logout notification if this is an actual auth issue
                        NotificationCenter.default.post(name: Notification.Name("LogoutRequired"), object: nil)
                    default:
                        print("ℹ️ DashboardViewModel: Could not load user profile: \(networkError.localizedDescription)")
                    }
                }
            } catch {
                // Just log the error but don't disrupt the app flow
                print("ℹ️ DashboardViewModel: Could not load user profile: \(error.localizedDescription)")
            }
        }
    }
    
    func fetchDashboardData() {
        // Verify authentication setup first
        AuthManager.shared.verifyAuthenticationSetup()
        
        // Only fetch properties - service requests are included in properties response
        fetchProperties()
    }
    
    func fetchProperties() {
        isLoadingProperties = true
        errorMessage = nil
        
        Task {
            do {
                // Fetch properties from API (expecting a "properties" dictionary key)
                let propertyResponse: PropertyResponse = try await networkManager.request(
                    endpoint: "/api/properties/",
                    method: .get
                )
                let fetchedProperties = propertyResponse.properties

                // Update UI on main thread
                await MainActor.run {
                    self.properties = fetchedProperties
                    self.isLoadingProperties = false

                    // Extract service requests from properties for all users
                    let extractedRequests = fetchedProperties.flatMap { property in
                        property.serviceRequests ?? []
                    }
                    // Sort by creation date (newest first)
                    self.serviceRequests = extractedRequests.sorted(by: { $0.createdAt > $1.createdAt })
                    self.isLoadingRequests = false
                }
            } catch let networkError as NetworkError {
                await MainActor.run {
                    self.isLoadingProperties = false
                    
                    // Handle specific network errors
                    switch networkError {
                    case .timeoutError:
                        self.errorMessage = "Connection timed out. Please check your internet connection and try again."
                    case .connectionError:
                        self.errorMessage = "Cannot connect to server. Please check your internet connection."
                    case .unauthorized:
                        self.errorMessage = "Your session has expired. Please log in again."
                        NotificationCenter.default.post(name: Notification.Name("LogoutRequired"), object: nil)
                    default:
                        self.errorMessage = "Failed to load properties: \(networkError.localizedDescription)"
                    }
                    
                    self.showError = true
                    print("❌ DashboardViewModel: Error fetching properties: \(networkError)")
                }
            } catch {
                await MainActor.run {
                    self.isLoadingProperties = false
                    self.errorMessage = "Failed to load properties: \(error.localizedDescription)"
                    self.showError = true
                    print("❌ DashboardViewModel: Error fetching properties: \(error)")
                }
            }
        }
    }
    
    // Service requests are now extracted from properties
    // No need for a separate fetchServiceRequests method
    
    // Retry loading data if there was an error
    func retryLoading() {
        // Reset error state
        errorMessage = nil
        showError = false
        
        // If we don't have a user yet, try loading in background but proceed with data fetch
        if currentUser == nil {
            loadCurrentUserInBackground()
        }
        
        // Always fetch dashboard data
        fetchDashboardData()
    }
}