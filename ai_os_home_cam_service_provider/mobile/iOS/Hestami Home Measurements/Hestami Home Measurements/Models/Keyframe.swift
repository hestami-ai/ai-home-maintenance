//
//  Keyframe.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData
import ARKit

@Model
final class Keyframe {
    var id: UUID
    var timestamp: Date
    var index: Int
    var rgbImagePath: String?
    var depthImagePath: String?
    var confidenceImagePath: String?
    var rawDNGPath: String? // True raw DNG photo from AVFoundation (20-60MB, 12-48MP)
    var poseData: String? // Stored as base64 string for JSON compatibility
    var intrinsicsData: String? // Stored as base64 string for JSON compatibility
    var qualityScore: Double
    var motionBlurDetected: Bool
    var depthConfidence: Double
    var isUploaded: Bool

    var scanSession: ScanSession?
    
    init(index: Int, timestamp: Date = Date()) {
        self.id = UUID()
        self.index = index
        self.timestamp = timestamp
        self.qualityScore = 1.0
        self.motionBlurDetected = false
        self.depthConfidence = 1.0
        self.isUploaded = false
        self.rawDNGPath = nil
    }
    
    // Helper to store ARKit pose as base64 string
    func setPose(_ pose: simd_float4x4) {
        var matrix = pose
        let data = Data(bytes: &matrix, count: MemoryLayout<simd_float4x4>.size)
        self.poseData = data.base64EncodedString()
    }

    // Helper to retrieve ARKit pose
    func getPose() -> simd_float4x4? {
        guard let base64String = poseData,
              let data = Data(base64Encoded: base64String) else { return nil }
        return data.withUnsafeBytes { pointer in
            pointer.load(as: simd_float4x4.self)
        }
    }

    // Helper to store camera intrinsics as base64 string
    func setIntrinsics(_ intrinsics: simd_float3x3) {
        var matrix = intrinsics
        let data = Data(bytes: &matrix, count: MemoryLayout<simd_float3x3>.size)
        self.intrinsicsData = data.base64EncodedString()
    }

    // Helper to retrieve camera intrinsics
    func getIntrinsics() -> simd_float3x3? {
        guard let base64String = intrinsicsData,
              let data = Data(base64Encoded: base64String) else { return nil }
        return data.withUnsafeBytes { pointer in
            pointer.load(as: simd_float3x3.self)
        }
    }
}

// Quality metrics for keyframe selection
struct KeyframeQualityMetrics {
    var spatialCoverage: Double
    var rotationChange: Double
    var translationChange: Double
    var overlapWithPrevious: Double
    var overallScore: Double
    
    static func calculate(from previous: Keyframe?, current: Keyframe) -> KeyframeQualityMetrics {
        guard let previous = previous,
              let prevPose = previous.getPose(),
              let currPose = current.getPose() else {
            return KeyframeQualityMetrics(
                spatialCoverage: 1.0,
                rotationChange: 0.0,
                translationChange: 0.0,
                overlapWithPrevious: 0.0,
                overallScore: 1.0
            )
        }
        
        // Calculate translation distance
        let translation = Double(simd_distance(prevPose.columns.3, currPose.columns.3))
        
        // Calculate rotation angle (simplified)
        let rotationDiff = Double(abs(prevPose.columns.0.x - currPose.columns.0.x) +
                          abs(prevPose.columns.1.y - currPose.columns.1.y) +
                          abs(prevPose.columns.2.z - currPose.columns.2.z))
        
        // Calculate overlap (inverse of translation)
        let overlap = max(0.0, 1.0 - (translation / 2.0)) // Assume 2m is max useful distance
        
        // Overall score based on movement and quality
        let movementScore = min(1.0, (translation + rotationDiff) / 0.5) // Normalize to 0-1
        let qualityScore = current.qualityScore * current.depthConfidence
        
        return KeyframeQualityMetrics(
            spatialCoverage: movementScore,
            rotationChange: rotationDiff,
            translationChange: translation,
            overlapWithPrevious: overlap,
            overallScore: (movementScore * 0.6) + (qualityScore * 0.4)
        )
    }
}
