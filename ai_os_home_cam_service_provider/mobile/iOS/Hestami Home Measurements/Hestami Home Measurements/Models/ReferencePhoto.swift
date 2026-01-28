//
//  ReferencePhoto.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import Foundation
import SwiftData
import simd

/// Capture angle for reference photos in Stage 1
enum CaptureAngle: String, Codable, CaseIterable {
    case left = "LEFT"
    case center = "CENTER"
    case right = "RIGHT"
    case custom = "CUSTOM"

    var displayName: String {
        switch self {
        case .left: return "Left"
        case .center: return "Center"
        case .right: return "Right"
        case .custom: return "Custom"
        }
    }

    var iconName: String {
        switch self {
        case .left: return "arrow.left.circle"
        case .center: return "circle.circle"
        case .right: return "arrow.right.circle"
        case .custom: return "plus.circle"
        }
    }

    var guidanceText: String {
        switch self {
        case .left: return "Move to the left side of the object"
        case .center: return "Position yourself in front of the object"
        case .right: return "Move to the right side of the object"
        case .custom: return "Capture from any additional angle"
        }
    }

    /// Standard angles to capture (excludes custom)
    static var standardAngles: [CaptureAngle] {
        [.left, .center, .right]
    }
}

/// Workflow stage for two-stage capture
enum CaptureWorkflowStage: String, Codable {
    case referenceCapture = "reference_capture"  // Stage 1: ProRAW capture
    case arkitScan = "arkit_scan"                // Stage 2: ARKit + LiDAR
    case completed = "completed"                  // Both stages done

    var displayName: String {
        switch self {
        case .referenceCapture: return "Reference Photos"
        case .arkitScan: return "LiDAR Scan"
        case .completed: return "Completed"
        }
    }
}

/// Reference photo captured in Stage 1 (ProRAW/48MP without ARKit)
/// These are high-quality photos for texture projection, separate from ARKit keyframes.
@Model
final class ReferencePhoto {
    var id: UUID
    var timestamp: Date
    var index: Int

    /// The angle this photo was captured from
    var captureAngleRaw: String
    var captureAngle: CaptureAngle {
        get { CaptureAngle(rawValue: captureAngleRaw) ?? .custom }
        set { captureAngleRaw = newValue.rawValue }
    }

    /// Path to the ProRAW DNG file (full resolution, 20-75MB)
    var dngFilePath: String?

    /// Path to JPEG preview thumbnail for UI display
    var jpegPreviewPath: String?

    /// Camera intrinsics extracted from EXIF - stored as base64 string for JSON compatibility
    var intrinsicsData: String?

    /// EXIF metadata as JSON
    var exifMetadata: String?

    /// Focal length in mm
    var focalLength: Double?

    /// ISO sensitivity value
    var isoValue: Int?

    /// Exposure duration in seconds
    var exposureDuration: Double?

    /// Aperture f-number
    var aperture: Double?

    /// DNG file size in bytes
    var fileSize: Int64

    /// Whether this photo has been uploaded to cloud
    var isUploaded: Bool

    /// Whether ProRAW was used (vs fallback HEIC)
    var isProRAW: Bool

    /// Image dimensions
    var imageWidth: Int?
    var imageHeight: Int?

    /// Parent scan session
    var scanSession: ScanSession?

    init(index: Int, angle: CaptureAngle, timestamp: Date = Date()) {
        self.id = UUID()
        self.index = index
        self.timestamp = timestamp
        self.captureAngleRaw = angle.rawValue
        self.fileSize = 0
        self.isUploaded = false
        self.isProRAW = false
    }

    // MARK: - Intrinsics Helpers

    /// Store camera intrinsics matrix as base64 string
    func setIntrinsics(_ intrinsics: simd_float3x3) {
        var matrix = intrinsics
        let data = Data(bytes: &matrix, count: MemoryLayout<simd_float3x3>.size)
        self.intrinsicsData = data.base64EncodedString()
    }

    /// Retrieve camera intrinsics matrix
    func getIntrinsics() -> simd_float3x3? {
        guard let base64String = intrinsicsData,
              let data = Data(base64Encoded: base64String) else { return nil }
        return data.withUnsafeBytes { pointer in
            pointer.load(as: simd_float3x3.self)
        }
    }

    // MARK: - EXIF Helpers

    /// Store EXIF metadata as JSON
    func setEXIFMetadata(_ metadata: [String: Any]) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: metadata),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            self.exifMetadata = jsonString
        }
    }

    /// Retrieve EXIF metadata from JSON
    func getEXIFMetadata() -> [String: Any]? {
        guard let jsonString = exifMetadata,
              let jsonData = jsonString.data(using: .utf8),
              let metadata = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return nil
        }
        return metadata
    }

    // MARK: - Display Helpers

    /// Formatted file size string
    var formattedFileSize: String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: fileSize)
    }

    /// Formatted resolution string
    var formattedResolution: String? {
        guard let width = imageWidth, let height = imageHeight else { return nil }
        let megapixels = Double(width * height) / 1_000_000
        return String(format: "%.1f MP (%dx%d)", megapixels, width, height)
    }
}
