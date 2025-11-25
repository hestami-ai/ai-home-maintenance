//
//  AppLogger.swift
//  My Home Agent
//
//  Created for App Store Production Readiness
//

import Foundation
import OSLog

/// Centralized logging system using OSLog for production-ready logging
/// Provides category-based loggers with automatic privacy handling and performance optimization
struct AppLogger {
    
    // MARK: - Subsystem
    
    /// App's bundle identifier used as the subsystem for all loggers
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.hestami.app"
    
    // MARK: - Category Loggers
    
    /// Logger for networking operations (API calls, HTTP requests, responses)
    static let network = Logger(subsystem: subsystem, category: "networking")
    
    /// Logger for authentication and authorization operations
    static let auth = Logger(subsystem: subsystem, category: "authentication")
    
    /// Logger for media operations (upload, download, processing)
    static let media = Logger(subsystem: subsystem, category: "media")
    
    /// Logger for room scanning and RoomPlan operations
    static let roomScan = Logger(subsystem: subsystem, category: "roomscan")
    
    /// Logger for chat and messaging features
    static let chat = Logger(subsystem: subsystem, category: "chat")
    
    /// Logger for property management operations
    static let property = Logger(subsystem: subsystem, category: "property")
    
    /// Logger for service request operations
    static let service = Logger(subsystem: subsystem, category: "service")
    
    /// Logger for UI-related events and interactions
    static let ui = Logger(subsystem: subsystem, category: "ui")
    
    /// Logger for data persistence and caching
    static let storage = Logger(subsystem: subsystem, category: "storage")
    
    /// Logger for general app lifecycle events
    static let app = Logger(subsystem: subsystem, category: "app")
    
    /// Logger for error tracking and debugging
    static let error = Logger(subsystem: subsystem, category: "error")
    
    // MARK: - Convenience Methods
    
    /// Log a debug message (only appears in debug builds, stripped in release)
    /// - Parameters:
    ///   - message: The message to log
    ///   - category: The logger category to use (default: .app)
    static func debug(_ message: String, category: Logger = app) {
        #if DEBUG
        category.debug("\(message, privacy: .public)")
        #endif
    }
    
    /// Log an informational message
    /// - Parameters:
    ///   - message: The message to log
    ///   - category: The logger category to use (default: .app)
    static func info(_ message: String, category: Logger = app) {
        category.info("\(message, privacy: .public)")
    }
    
    /// Log a notice (significant but not error condition)
    /// - Parameters:
    ///   - message: The message to log
    ///   - category: The logger category to use (default: .app)
    static func notice(_ message: String, category: Logger = app) {
        category.notice("\(message, privacy: .public)")
    }
    
    /// Log a warning message
    /// - Parameters:
    ///   - message: The message to log
    ///   - category: The logger category to use (default: .app)
    static func warning(_ message: String, category: Logger = app) {
        category.warning("\(message, privacy: .public)")
    }
    
    /// Log an error message
    /// - Parameters:
    ///   - message: The message to log
    ///   - error: Optional error object to include
    ///   - category: The logger category to use (default: .error)
    static func error(_ message: String, error: Error? = nil, category: Logger = AppLogger.error) {
        if let error = error {
            category.error("\(message, privacy: .public): \(error.localizedDescription, privacy: .public)")
        } else {
            category.error("\(message, privacy: .public)")
        }
    }
    
    /// Log a critical/fault message (highest severity)
    /// - Parameters:
    ///   - message: The message to log
    ///   - error: Optional error object to include
    ///   - category: The logger category to use (default: .error)
    static func critical(_ message: String, error: Error? = nil, category: Logger = AppLogger.error) {
        if let error = error {
            category.critical("\(message, privacy: .public): \(error.localizedDescription, privacy: .public)")
        } else {
            category.critical("\(message, privacy: .public)")
        }
    }
    
    // MARK: - Privacy-Aware Logging
    
    /// Log sensitive data with automatic privacy redaction in production
    /// - Parameters:
    ///   - message: The message prefix
    ///   - sensitiveData: The sensitive data to log (will be redacted in production)
    ///   - category: The logger category to use
    static func debugSensitive(_ message: String, sensitiveData: String, category: Logger = app) {
        #if DEBUG
        category.debug("\(message, privacy: .public): \(sensitiveData, privacy: .public)")
        #else
        category.debug("\(message, privacy: .public): \(sensitiveData, privacy: .private)")
        #endif
    }
    
    // MARK: - Network Logging Helpers
    
    /// Log an HTTP request
    /// - Parameters:
    ///   - method: HTTP method
    ///   - endpoint: API endpoint
    ///   - parameters: Optional request parameters (will be redacted in production)
    static func logRequest(method: String, endpoint: String, parameters: [String: Any]? = nil) {
        #if DEBUG
        if let params = parameters {
            network.debug("🌐 \(method, privacy: .public) \(endpoint, privacy: .public) - Params: \(String(describing: params), privacy: .public)")
        } else {
            network.debug("🌐 \(method, privacy: .public) \(endpoint, privacy: .public)")
        }
        #else
        network.debug("Request: \(method, privacy: .public) \(endpoint, privacy: .public)")
        #endif
    }
    
    /// Log an HTTP response
    /// - Parameters:
    ///   - statusCode: HTTP status code
    ///   - endpoint: API endpoint
    ///   - duration: Optional request duration
    static func logResponse(statusCode: Int, endpoint: String, duration: TimeInterval? = nil) {
        #if DEBUG
        if let duration = duration {
            network.debug("✅ \(statusCode, privacy: .public) \(endpoint, privacy: .public) - \(duration, privacy: .public)s")
        } else {
            network.debug("✅ \(statusCode, privacy: .public) \(endpoint, privacy: .public)")
        }
        #else
        network.info("Response: \(statusCode, privacy: .public) from \(endpoint, privacy: .public)")
        #endif
    }
    
    /// Log a network error
    /// - Parameters:
    ///   - endpoint: API endpoint
    ///   - error: The error that occurred
    static func logNetworkError(endpoint: String, error: Error) {
        network.error("❌ Request failed for \(endpoint, privacy: .public): \(error.localizedDescription, privacy: .public)")
    }
}

// MARK: - Migration Helper Extension

#if DEBUG
/// Extension to help migrate from print() statements during development
/// This will be removed once migration is complete
extension AppLogger {
    /// Temporary helper to mark areas that still need migration from print()
    static func migrationNeeded(file: String = #file, line: Int = #line) {
        app.warning("⚠️ Migration needed at \(file, privacy: .public):\(line, privacy: .public)")
    }
}
#endif
