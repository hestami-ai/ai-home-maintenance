//
//  AppConfiguration.swift
//  My Home Agent
//
//  Build configuration management for development and production environments
//

import Foundation
import OSLog

/// Build environment types
enum BuildEnvironment: String {
    case development
    case staging
    case production
    
    /// Current build environment based on compiler flags
    static var current: BuildEnvironment {
        #if DEBUG
        return .development
        #elseif STAGING
        return .staging
        #else
        return .production
        #endif
    }
}

/// Centralized app configuration based on build environment
struct AppConfiguration {
    
    // MARK: - Environment
    
    /// Current build environment
    static let environment = BuildEnvironment.current
    
    // MARK: - API Configuration
    
    /// Base URL for API server
    static var apiBaseURL: String {
        switch environment {
        case .development:
            return "https://dev-homeservices.hestami-ai.com"
        case .staging:
            return "https://staging-homeservices.hestami-ai.com"
        case .production:
            return "https://homeservices.hestami-ai.com"
        }
    }
    
    /// Static media server host
    static var staticMediaHost: String {
        switch environment {
        case .development:
            return "dev-static.hestami-ai.com"
        case .staging:
            return "staging-static.hestami-ai.com"
        case .production:
            return "static.hestami-ai.com"
        }
    }
    
    /// Static media server port
    static var staticMediaPort: String {
        return "443" // HTTPS port for all environments
    }
    
    // MARK: - Feature Flags
    
    /// Enable verbose logging (debug builds only)
    static var enableVerboseLogging: Bool {
        return environment == .development
    }
    
    /// Enable network request/response logging
    static var enableNetworkLogging: Bool {
        return environment == .development
    }
    
    /// Enable crash reporting
    static var enableCrashReporting: Bool {
        return environment == .production || environment == .staging
    }
    
    /// Enable analytics
    static var enableAnalytics: Bool {
        return environment == .production || environment == .staging
    }
    
    /// Allow localhost connections (development only)
    static var allowLocalhostConnections: Bool {
        return environment == .development
    }
    
    // MARK: - Cache Configuration
    
    /// Cache duration in seconds
    static var cacheDuration: TimeInterval {
        switch environment {
        case .development:
            return 300 // 5 minutes for development
        case .staging:
            return 600 // 10 minutes for staging
        case .production:
            return 3600 // 1 hour for production
        }
    }
    
    /// Enable response caching
    static var enableCaching: Bool {
        return true // Enabled for all environments
    }
    
    // MARK: - Network Configuration
    
    /// Request timeout interval in seconds
    static var requestTimeout: TimeInterval {
        switch environment {
        case .development:
            return 30
        case .staging:
            return 30
        case .production:
            return 20
        }
    }
    
    /// Maximum number of retry attempts for failed requests
    static var maxRetryAttempts: Int {
        switch environment {
        case .development:
            return 2
        case .staging:
            return 3
        case .production:
            return 3
        }
    }
    
    // MARK: - App Information
    
    /// App version string
    static var appVersion: String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    /// Build number
    static var buildNumber: String {
        return Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
    
    /// Bundle identifier
    static var bundleIdentifier: String {
        return Bundle.main.bundleIdentifier ?? "com.hestami.app"
    }
    
    /// Full version string (version + build)
    static var fullVersion: String {
        return "\(appVersion) (\(buildNumber))"
    }
    
    // MARK: - Debug Helpers
    
    /// Print current configuration (debug builds only)
    static func printConfiguration() {
        #if DEBUG
        AppLogger.app.debug("=== App Configuration ===")
        AppLogger.app.debug("Environment: \(environment.rawValue, privacy: .public)")
        AppLogger.app.debug("API Base URL: \(apiBaseURL, privacy: .public)")
        AppLogger.app.debug("Static Media Host: \(staticMediaHost, privacy: .public)")
        AppLogger.app.debug("App Version: \(fullVersion, privacy: .public)")
        AppLogger.app.debug("Verbose Logging: \(enableVerboseLogging, privacy: .public)")
        AppLogger.app.debug("Network Logging: \(enableNetworkLogging, privacy: .public)")
        AppLogger.app.debug("Cache Duration: \(cacheDuration, privacy: .public)s")
        AppLogger.app.debug("Request Timeout: \(requestTimeout, privacy: .public)s")
        AppLogger.app.debug("========================")
        #endif
    }
}

// MARK: - Configuration Validation

extension AppConfiguration {
    /// Validate configuration on app launch
    static func validate() {
        // Ensure URLs are valid
        guard URL(string: apiBaseURL) != nil else {
            AppLogger.critical("Invalid API base URL: \(apiBaseURL)")
            return
        }
        
        // Log configuration in debug builds
        #if DEBUG
        AppLogger.info("App configured for \(environment.rawValue) environment", category: AppLogger.app)
        printConfiguration()
        #endif
    }
}
