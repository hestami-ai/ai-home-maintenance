//
//  AppLogger.swift
//  Hestami Home Measurements
//
//  Centralized logging configuration using os.Logger
//

import Foundation
import os

// MARK: - Log Configuration
class LogConfig {
    /// Enable verbose debug logging for detailed troubleshooting
    /// Set via UserDefaults: UserDefaults.standard.set(true, forKey: "verboseDebug")
    /// Can be toggled in Settings or via Console.app
    static var verboseDebug: Bool {
        return UserDefaults.standard.bool(forKey: "verboseDebug")
    }
    
    /// Enable minimal logging (errors and warnings only)
    static var minimalLogging: Bool {
        return UserDefaults.standard.bool(forKey: "minimalLogging")
    }
}

// MARK: - Logger Factory
extension Logger {
    /// Creates a configured logger instance with the specified category
    /// - Parameter category: The logging category (e.g., "coverage", "scanview", "capture")
    /// - Returns: A configured Logger instance
    static func make(category: String) -> Logger {
        return Logger(subsystem: "com.hestami.scanner", category: category)
    }
    
    /// Verbose logging - only logs when verboseDebug is enabled
    /// Use for detailed troubleshooting of specific features (e.g., voxel rendering)
    func verbose(_ message: String) {
        if LogConfig.verboseDebug {
            self.debug("\(message)")
        }
    }
    
    /// Debug logging that can be disabled with minimalLogging mode
    func debugUnlessMinimal(_ message: String) {
        if !LogConfig.minimalLogging {
            self.debug("\(message)")
        }
    }
}

// MARK: - Logging Categories
enum LogCategory {
    static let app = "app"
    static let scanview = "scanview"
    static let scanDetailView = "scanDetail"
    static let scanListView = "scanList"
    static let captureService = "capture"
    static let coverageService = "coverage"
    static let readinessChecker = "readiness"
    static let planeDetection = "planes"
    static let voxelMap = "voxelmap"
    static let storageService = "storage"
    static let storageManagement = "storageMgmt"
    static let rawPhotoCapture = "photo"
    static let wideAngleCapture = "wideAngle"
    static let cloudService = "cloud"
    static let measurementService = "measurement"
    static let settings = "settings"
}