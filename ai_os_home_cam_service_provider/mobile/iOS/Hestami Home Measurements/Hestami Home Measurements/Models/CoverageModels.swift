//
//  CoverageModels.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import simd

// MARK: - Scan Mode

enum ScanMode: String, CaseIterable, Codable {
    case room = "ROOM"
    case element = "ELEMENT"
    
    var displayName: String {
        switch self {
        case .room: return "Room Scan"
        case .element: return "Element Scan"
        }
    }
    
    var voxelSize: Float {
        switch self {
        case .room: return 0.075 // 7.5 cm
        case .element: return 0.04 // 4 cm
        }
    }
    
    var maxRange: Float {
        switch self {
        case .room: return 8.0 // 8 meters
        case .element: return 4.0 // 4 meters
        }
    }
    
    var minObservations: Int {
        switch self {
        case .room: return 3
        case .element: return 5
        }
    }
    
    var minConfidence: Float {
        switch self {
        case .room: return 0.6
        case .element: return 0.65
        }
    }
    
    var minAngularDiversity: Float {
        switch self {
        case .room: return 0.08
        case .element: return 0.12
        }
    }
}

// MARK: - Readiness Status

enum ReadinessStatus: String, Codable {
    case notReady = "NOT_READY"
    case ready = "READY"
    case lowConfidence = "LOW_CONFIDENCE"
    
    var displayName: String {
        switch self {
        case .notReady: return "Not Ready"
        case .ready: return "Ready"
        case .lowConfidence: return "Low Confidence"
        }
    }
    
    var color: String {
        switch self {
        case .notReady: return "red"
        case .ready: return "green"
        case .lowConfidence: return "orange"
        }
    }
}

// MARK: - Voxel Key

struct VoxelKey: Hashable, Codable {
    let x: Int
    let y: Int
    let z: Int
    
    init(x: Int, y: Int, z: Int) {
        self.x = x
        self.y = y
        self.z = z
    }
    
    init(point: simd_float3, voxelSize: Float) {
        self.x = Int(floor(point.x / voxelSize))
        self.y = Int(floor(point.y / voxelSize))
        self.z = Int(floor(point.z / voxelSize))
    }
}

// MARK: - Voxel Stats

struct VoxelStats: Codable {
    var obsCount: UInt16
    var confSum: Float
    var firstSeenTime: Double
    var lastSeenTime: Double
    var positionSum: simd_float3
    var viewDirMean: simd_float3
    var viewDirM2: Float
    var rangeMin: Float
    var rangeMax: Float
    var normalMean: simd_float3
    var qualityFlags: UInt8

    init() {
        self.obsCount = 0
        self.confSum = 0.0
        self.firstSeenTime = 0.0
        self.lastSeenTime = 0.0
        self.positionSum = simd_float3(0, 0, 0)
        self.viewDirMean = simd_float3(0, 0, 0)
        self.viewDirM2 = 0.0
        self.rangeMin = Float.infinity
        self.rangeMax = 0.0
        self.normalMean = simd_float3(0, 0, 0)
        self.qualityFlags = 0
    }
    
    var confAvg: Float {
        guard obsCount > 0 else { return 0.0 }
        return confSum / Float(obsCount)
    }
    
    var angularDiversity: Float {
        guard obsCount > 0 else { return 0.0 }
        return viewDirM2 / Float(obsCount)
    }
    
    var rangeSpan: Float {
        return rangeMax - rangeMin
    }
    
    var centroid: simd_float3? {
        guard obsCount > 0 else { return nil }
        return positionSum / Float(obsCount)
    }
    
    mutating func update(confidence: Float, viewDir: simd_float3, range: Float, time: Double) {
        obsCount += 1
        confSum += confidence

        if firstSeenTime == 0.0 {
            firstSeenTime = time
        }
        lastSeenTime = time

        rangeMin = min(rangeMin, range)
        rangeMax = max(rangeMax, range)

        // Update position sum (we can't get the position from args here, need to pass it or assume caller handles it)
        // NOTE: This method signature needs update or we handle it in VoxelMap

        // Update view direction mean
        if obsCount == 1 {
            viewDirMean = viewDir
        } else {
            let alpha: Float = 1.0 / Float(obsCount)
            viewDirMean = normalize(lerp(viewDirMean, viewDir, alpha))
        }

        // Track angular diversity
        let deviation = 1.0 - dot(viewDirMean, viewDir)
        viewDirM2 += deviation
    }
    
    mutating func update(position: simd_float3, confidence: Float, viewDir: simd_float3, range: Float, time: Double) {
        positionSum += position
        update(confidence: confidence, viewDir: viewDir, range: range, time: time)
    }
    
    private func lerp(_ a: simd_float3, _ b: simd_float3, _ t: Float) -> simd_float3 {
        return a + (b - a) * t
    }
}

// MARK: - Coverage Metrics

struct CoverageMetrics: Codable {
    var trackingQuality: Float // 0-1
    var depthQuality: Float // 0-1
    var coverageScore: Float // 0-1
    var observabilityScore: Float // 0-1
    var readinessScore: Float // 0-1
    
    // Room-specific
    var wallsDetected: Int
    var floorDetected: Bool
    var cornersDetected: Int
    
    // Element-specific
    var wallPlaneLocked: Bool
    var openingLikely: Bool
    var boundaryCoverage: Float
    
    // General
    var voxelCount: Int
    var goodVoxelCount: Int
    
    init() {
        self.trackingQuality = 0.0
        self.depthQuality = 0.0
        self.coverageScore = 0.0
        self.observabilityScore = 0.0
        self.readinessScore = 0.0
        self.wallsDetected = 0
        self.floorDetected = false
        self.cornersDetected = 0
        self.wallPlaneLocked = false
        self.openingLikely = false
        self.boundaryCoverage = 0.0
        self.voxelCount = 0
        self.goodVoxelCount = 0
    }
    
    var readinessStatus: ReadinessStatus {
        if readinessScore >= 0.70 {
            return .ready
        } else if readinessScore >= 0.50 {
            return .lowConfidence
        } else {
            return .notReady
        }
    }
    
    var trackingStatus: String {
        if trackingQuality >= 0.8 {
            return "Good"
        } else if trackingQuality >= 0.5 {
            return "Fair"
        } else {
            return "Poor"
        }
    }
}

// MARK: - Plane

struct Plane: Codable {
    var normal: simd_float3
    var distance: Float
    var pointCount: Int
    
    init(normal: simd_float3, distance: Float, pointCount: Int) {
        self.normal = normalize(normal)
        self.distance = distance
        self.pointCount = pointCount
    }
    
    var isHorizontal: Bool {
        // Floor/ceiling: normal.y close to ±1 (within ~31 degrees of horizontal)
        return abs(normal.y) > 0.85
    }

    var isVertical: Bool {
        // Walls: normal.y close to 0 (within ~72 degrees of vertical)
        return abs(normal.y) < 0.3
    }
}

// MARK: - Corner

struct Corner: Codable {
    var position: simd_float3
    var confidence: Float
    
    init(position: simd_float3, confidence: Float) {
        self.position = position
        self.confidence = confidence
    }
}
