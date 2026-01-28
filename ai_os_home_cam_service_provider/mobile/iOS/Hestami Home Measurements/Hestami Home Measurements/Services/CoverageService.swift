//
//  CoverageService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import os
import simd
import Combine
import ARKit

@MainActor
class CoverageService: ObservableObject {
    private let logger = Logger.make(category: LogCategory.coverageService)
    // MARK: - Published Properties
    
    @Published var metrics = CoverageMetrics()
    @Published var scanMode: ScanMode = .room
    @Published var isReady = false
    @Published var failureReasons: [String] = []
    
    // MARK: - Private Properties
    
    private var voxelMap: VoxelMap?
    private var planeDetection = PlaneDetection()
    private var readinessChecker = ReadinessChecker()
    private var lastPlaneUpdateTime: Date?
    private var lastPlaneDetectionTime: Date?

    // Cached plane detection results
    private var cachedPlanes: [Plane] = []
    private var cachedCorners: [Corner] = []
    private var cachedWallPlane: Plane?
    
    // MARK: - Public Properties
    
    var voxelMapForVisualization: VoxelMap? {
        return voxelMap
    }
    
    // MARK: - Initialization
    
    init() {
        logger.debug("CoverageService initialized")
    }
    
    // MARK: - Public Methods
    
    func startScan(mode: ScanMode) {
        logger.info("Starting scan in \(mode.displayName) mode")
        self.scanMode = mode
        self.voxelMap = VoxelMap(voxelSize: mode.voxelSize, maxRange: mode.maxRange)
        self.metrics = CoverageMetrics()
        self.isReady = false
        self.failureReasons = []
        self.lastPlaneUpdateTime = nil
        self.lastPlaneDetectionTime = nil
        self.cachedPlanes = []
        self.cachedCorners = []
        self.cachedWallPlane = nil
    }
    
    func stopScan() {
        logger.info("Stopping scan")
        self.voxelMap = nil
    }
    
    func updateWithDepthData(
        depthMap: CVPixelBuffer,
        confidenceMap: CVPixelBuffer,
        pose: simd_float4x4,
        intrinsics: simd_float3x3,
        trackingQuality: ARCamera.TrackingState,
        depthConfidence: Double
    ) {
        guard let voxelMap = voxelMap else {
            logger.warning("Voxel map not initialized")
            return
        }

        // Throttle updates to 10 Hz
        let now = Date()
        if let lastUpdate = lastPlaneUpdateTime, now.timeIntervalSince(lastUpdate) < 0.1 {
            return
        }
        lastPlaneUpdateTime = now

        logger.debugUnlessMinimal("Processing frame - Tracking: \(trackingQuality), DepthConf: \(String(format: "%.2f", depthConfidence))")
        
        // Sample depth points (subsample for performance)
        // FIX: Increased stride from 4 to 8 to reduce memory pressure (50% fewer points)
        let sampleStride = 8 // Sample every 8th pixel
        var points: [(position: simd_float3, confidence: Float, viewDir: simd_float3, range: Float, time: Double)] = []
        var validPoints = 0
        var skippedLowConfidence = 0
        var skippedOutOfRange = 0

        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        CVPixelBufferLockBaseAddress(confidenceMap, .readOnly)

        defer {
            CVPixelBufferUnlockBaseAddress(depthMap, .readOnly)
            CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly)
        }

        let width = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)

        guard let depthData = CVPixelBufferGetBaseAddress(depthMap) else { return }
        guard let confidenceData = CVPixelBufferGetBaseAddress(confidenceMap) else { return }

        let depthBuffer = depthData.bindMemory(to: Float32.self, capacity: width * height)
        let confidenceBuffer = confidenceData.bindMemory(to: UInt8.self, capacity: width * height)

        let cameraPosition = simd_float3(pose.columns.3.x, pose.columns.3.y, pose.columns.3.z)
        let time = now.timeIntervalSince1970
        
        for y in stride(from: 0, to: height, by: sampleStride) {
            for x in stride(from: 0, to: width, by: sampleStride) {
                let idx = y * width + x
                let depth = depthBuffer[idx]
                let confidence = Float(confidenceBuffer[idx]) / 2.0 // Normalize 0-2 to 0-1
                
                // Skip invalid depth
                guard depth > 0.1 && depth < scanMode.maxRange else { 
                    skippedOutOfRange += 1
                    continue 
                }
                guard confidence >= 0.5 else { 
                    skippedLowConfidence += 1
                    continue 
                }
                
                // Backproject to 3D
                let u = Float(x)
                let v = Float(y)
                let fx = intrinsics.columns.0.x
                let fy = intrinsics.columns.1.y
                let cx = intrinsics.columns.2.x
                let cy = intrinsics.columns.2.y
                
                let x_c = (u - cx) * depth / fx
                let y_c = (v - cy) * depth / fy
                let z_c = depth
                
                let point_c = simd_float3(x_c, y_c, z_c)
                let point_w = pose * simd_float4(point_c, 1.0)
                let position = simd_float3(point_w.x, point_w.y, point_w.z)
                
                // Calculate view direction (from point to camera)
                let viewDir = normalize(cameraPosition - position)
                
                points.append((position, confidence, viewDir, depth, time))
                validPoints += 1
            }
        }
        
        logger.verbose("Sampled \(validPoints) valid points (skipped \(skippedLowConfidence) low conf, \(skippedOutOfRange) out of range)")
        
        // Update voxel map
        voxelMap.update(with: points)
        
        logger.verbose("Voxel map updated - Total voxels: \(voxelMap.getVoxelCount())")
        
        // Update metrics
        updateMetrics(trackingQuality: trackingQuality, depthConfidence: depthConfidence)
    }
    
    // MARK: - Private Methods
    
    private func updateMetrics(trackingQuality: ARCamera.TrackingState, depthConfidence: Double) {
        guard let voxelMap = voxelMap else { return }
        
        // Update tracking quality
        switch trackingQuality {
        case .normal:
            metrics.trackingQuality = 1.0
        case .notAvailable:
            metrics.trackingQuality = 0.0
        case .limited:
            metrics.trackingQuality = 0.5
        @unknown default:
            metrics.trackingQuality = 0.5
        }
        
        // Update depth quality
        metrics.depthQuality = Float(depthConfidence)
        
        // Update coverage and observability scores
        metrics.coverageScore = voxelMap.getCoverageScore(mode: scanMode)
        metrics.observabilityScore = voxelMap.getObservabilityScore(mode: scanMode)
        
        // Update voxel counts
        metrics.voxelCount = voxelMap.getVoxelCount()
        metrics.goodVoxelCount = voxelMap.getGoodVoxels(mode: scanMode).count
        
        logger.debugUnlessMinimal("Metrics updated - Coverage: \(String(format: "%.2f", metrics.coverageScore)), Observability: \(String(format: "%.2f", metrics.observabilityScore)), Depth: \(String(format: "%.2f", metrics.depthQuality)), Tracking: \(String(format: "%.2f", metrics.trackingQuality))")
        logger.verbose("Voxel stats - Total: \(metrics.voxelCount), Good: \(metrics.goodVoxelCount)")

        // Run plane detection periodically (slower to reduce memory pressure)
        // FIX: Increased interval from 0.5/1.0 to 1.5/2.0 seconds
        let detectionInterval = metrics.wallPlaneLocked ? 2.0 : 1.5
        let now = Date()
        if lastPlaneDetectionTime == nil || now.timeIntervalSince(lastPlaneDetectionTime!) > detectionInterval {
            logger.debugUnlessMinimal("Running plane detection...")
            lastPlaneDetectionTime = now
            runPlaneDetection()
        }
        
        // Calculate overall readiness score
        metrics.readinessScore = 0.45 * metrics.coverageScore +
                                 0.25 * metrics.observabilityScore +
                                 0.20 * metrics.depthQuality +
                                 0.10 * metrics.trackingQuality
        
        logger.verbose("Readiness score: \(String(format: "%.2f", metrics.readinessScore)) (Cov: 0.45*\(String(format: "%.2f", metrics.coverageScore))) + Obs: 0.25*\(String(format: "%.2f", metrics.observabilityScore))) + Dpt: 0.20*\(String(format: "%.2f", metrics.depthQuality))) + Trk: 0.10*\(String(format: "%.2f", metrics.trackingQuality))))")
        
        // Check readiness
        checkReadiness()
    }
    
    private func runPlaneDetection() {
        guard let voxelMap = voxelMap else { return }

        // Get points from voxel map
        let allPoints = voxelMap.getPoints()

        // Sample points to avoid blocking (max 1000 points for performance)
        // FIX: Reduced from 2000 to 1000 to reduce memory pressure
        let maxPoints = 1000
        let sampledPoints: [simd_float3]
        if allPoints.count > maxPoints {
            // Randomly sample to reduce computation
            sampledPoints = allPoints.shuffled().prefix(maxPoints).map { $0 }
        } else {
            sampledPoints = allPoints
        }

        logger.debugUnlessMinimal("Plane detection - Using \(sampledPoints.count)/\(allPoints.count) points")

        // Detect planes with fewer iterations to reduce blocking
        // FIX: Reduced from 100 to 50 iterations to reduce CPU/memory pressure
        cachedPlanes = planeDetection.detectPlanes(points: sampledPoints, maxPlanes: 10, iterations: 50, threshold: 0.05)
        logger.debugUnlessMinimal("Detected \(cachedPlanes.count) planes total")

        // Update metrics
        metrics.wallsDetected = cachedPlanes.filter { $0.isVertical }.count
        metrics.floorDetected = cachedPlanes.contains { $0.isHorizontal }

        logger.debugUnlessMinimal("Walls: \(metrics.wallsDetected), Floor: \(metrics.floorDetected)")

        // Detect corners
        cachedCorners = planeDetection.detectCorners(planes: cachedPlanes)
        metrics.cornersDetected = cachedCorners.count
        logger.debugUnlessMinimal("Corners: \(metrics.cornersDetected)")

        // For element mode, detect wall plane and opening
        if scanMode == .element {
            // Log all planes to see why wall isn't picked
            for (i, plane) in cachedPlanes.enumerated() {
                logger.verbose("Plane \(i) - Normal: (\(String(format: "%.2f", plane.normal.x)), \(String(format: "%.2f", plane.normal.y)), \(String(format: "%.2f", plane.normal.z))), IsVertical: \(plane.isVertical), IsHorizontal: \(plane.isHorizontal)")
            }
            
            // Optimization: Reuse the planes we just detected instead of running RANSAC again
            // Find the vertical plane with the most points
            cachedWallPlane = cachedPlanes.filter { $0.isVertical }.max(by: { $0.pointCount < $1.pointCount })
            metrics.wallPlaneLocked = cachedWallPlane != nil
            logger.debugUnlessMinimal("Element mode - Wall plane locked: \(metrics.wallPlaneLocked)")

            if let wallPlane = cachedWallPlane {
                // Calculate boundary coverage (fast)
                metrics.boundaryCoverage = readinessChecker.calculateBoundaryCoverage(points: sampledPoints, wallPlane: wallPlane)

                // Skip expensive opening detection for now - it's optional and causes ARFrame retention
                // TODO: Run opening detection asynchronously or optimize the flood-fill algorithm
                metrics.openingLikely = false

                logger.debugUnlessMinimal("Boundary coverage: \(String(format: "%.2f", metrics.boundaryCoverage))")
            }
        }
    }
    
    private func checkReadiness() {
        // Use cached plane detection results instead of re-running expensive detection
        let planes = cachedPlanes
        let corners = cachedCorners
        let wallPlane = cachedWallPlane
        
        // Check readiness based on mode
        let status = readinessChecker.getReadinessStatus(
            metrics: metrics,
            mode: scanMode,
            planes: planes,
            corners: corners,
            wallPlane: wallPlane,
            boundaryCoverage: metrics.boundaryCoverage
        )
        
        isReady = (status == .ready)
        
        logger.verbose("Readiness check - Status: \(status), IsReady: \(isReady)")
        
        // Get failure reasons if not ready
        if !isReady {
            failureReasons = readinessChecker.getFailureReasons(
                metrics: metrics,
                mode: scanMode,
                planes: planes,
                corners: corners,
                wallPlane: wallPlane,
                boundaryCoverage: metrics.boundaryCoverage
            )
            logger.debugUnlessMinimal("Failure reasons: \(failureReasons)")
        } else {
            failureReasons = []
            logger.debugUnlessMinimal("All requirements met!")
        }
    }
}
