//
//  ReadinessChecker.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import simd
import os

class ReadinessChecker {
    private let logger = Logger.make(category: LogCategory.readinessChecker)
    
    // MARK: - Room Mode Readiness
    
    func checkRoomReadiness(metrics: CoverageMetrics, planes: [Plane], corners: [Corner]) -> (isReady: Bool, reasons: [String]) {
        logger.debug("Checking room readiness")
        logger.debug("Coverage: \(String(format: "%.2f", metrics.coverageScore)), Readiness: \(String(format: "%.2f", metrics.readinessScore)), Depth: \(String(format: "%.2f", metrics.depthQuality)), Tracking: \(String(format: "%.2f", metrics.trackingQuality))")
        
        var reasons: [String] = []
        var isReady = true
        
        // Check coverage score
        if metrics.coverageScore < 0.65 {
            isReady = false
            reasons.append("Coverage too low (\(Int(metrics.coverageScore * 100))% < 65%)")
            logger.debug("Coverage too low")
        } else {
            logger.debug("Coverage OK")
        }
        
        // Check readiness score
        if metrics.readinessScore < 0.70 {
            isReady = false
            reasons.append("Overall readiness too low (\(Int(metrics.readinessScore * 100))% < 70%)")
            logger.debug("Readiness too low")
        } else {
            logger.debug("Readiness OK")
        }
        
        // Check floor plane
        let floorPlane = planes.first { $0.isHorizontal }
        if floorPlane == nil {
            isReady = false
            reasons.append("Floor plane not detected")
            logger.debug("Floor plane not detected")
        } else {
            logger.debug("Floor plane detected")
        }
        
        // Check vertical planes (walls)
        let verticalPlanes = planes.filter { $0.isVertical }
        if verticalPlanes.count < 3 {
            isReady = false
            reasons.append("Need at least 3 walls (found \(verticalPlanes.count))")
            logger.debug("Not enough walls (found \(verticalPlanes.count))")
        } else {
            logger.debug("Enough walls (\(verticalPlanes.count))")
        }
        
        // Check corners
        if corners.count < 2 {
            isReady = false
            reasons.append("Need at least 2 corners (found \(corners.count))")
            logger.debug("Not enough corners (found \(corners.count))")
        } else {
            logger.debug("Enough corners (\(corners.count))")
        }
        
        // Check depth quality
        if metrics.depthQuality < 0.6 {
            isReady = false
            reasons.append("Depth quality too low (\(Int(metrics.depthQuality * 100))% < 60%)")
            logger.debug("Depth quality too low")
        } else {
            logger.debug("Depth quality OK")
        }
        
        // Check tracking quality
        if metrics.trackingQuality < 0.7 {
            isReady = false
            reasons.append("Tracking quality too low")
            logger.debug("Tracking quality too low")
        } else {
            logger.debug("Tracking quality OK")
        }
        
        logger.debug("Room readiness result: \(isReady)")
        
        return (isReady, reasons)
    }
    
    // MARK: - Element Mode Readiness
    
    func checkElementReadiness(metrics: CoverageMetrics, wallPlane: Plane?, boundaryCoverage: Float) -> (isReady: Bool, reasons: [String]) {
        logger.debug("Checking element readiness")
        logger.debug("Readiness: \(String(format: "%.2f", metrics.readinessScore)), Depth: \(String(format: "%.2f", metrics.depthQuality)), Tracking: \(String(format: "%.2f", metrics.trackingQuality)), BoundaryCoverage: \(String(format: "%.2f", boundaryCoverage))")
        
        var reasons: [String] = []
        var isReady = true
        
        // Check readiness score
        if metrics.readinessScore < 0.75 {
            isReady = false
            reasons.append("Overall readiness too low (\(Int(metrics.readinessScore * 100))% < 75%)")
            logger.debug("Readiness too low")
        } else {
            logger.debug("Readiness OK")
        }
        
        // Check wall plane
        if wallPlane == nil {
            isReady = false
            reasons.append("Wall plane not detected")
            logger.debug("Wall plane not detected")
        } else {
            logger.debug("Wall plane detected")
        }
        
        // Check boundary coverage (very low threshold - current algorithm is not accurate for frame edges)
        // TODO: Redesign to detect actual window frame boundaries, not just bounding box edges
        if boundaryCoverage < 0.05 {
            isReady = false
            reasons.append("Boundary coverage too low (\(Int(boundaryCoverage * 100))% < 5%)")
            logger.debug("Boundary coverage too low")
        } else {
            logger.debug("Boundary coverage OK (\(Int(boundaryCoverage * 100))%)")
        }
        
        // Check depth quality
        if metrics.depthQuality < 0.65 {
            isReady = false
            reasons.append("Depth quality too low (\(Int(metrics.depthQuality * 100))% < 65%)")
            logger.debug("Depth quality too low")
        } else {
            logger.debug("Depth quality OK")
        }
        
        // Check tracking quality
        if metrics.trackingQuality < 0.7 {
            isReady = false
            reasons.append("Tracking quality too low")
            logger.debug("Tracking quality too low")
        } else {
            logger.debug("Tracking quality OK")
        }
        
        logger.debug("Element readiness result: \(isReady)")
        
        return (isReady, reasons)
    }
    
    // MARK: - General Readiness
    
    func getReadinessStatus(metrics: CoverageMetrics, mode: ScanMode, planes: [Plane], corners: [Corner], wallPlane: Plane?, boundaryCoverage: Float) -> ReadinessStatus {
        switch mode {
        case .room:
            let (isReady, _) = checkRoomReadiness(metrics: metrics, planes: planes, corners: corners)
            if isReady {
                return .ready
            } else if metrics.readinessScore >= 0.50 {
                return .lowConfidence
            } else {
                return .notReady
            }
            
        case .element:
            let (isReady, _) = checkElementReadiness(metrics: metrics, wallPlane: wallPlane, boundaryCoverage: boundaryCoverage)
            if isReady {
                return .ready
            } else if metrics.readinessScore >= 0.50 {
                return .lowConfidence
            } else {
                return .notReady
            }
        }
    }
    
    // MARK: - Failure Reasons
    
    func getFailureReasons(metrics: CoverageMetrics, mode: ScanMode, planes: [Plane], corners: [Corner], wallPlane: Plane?, boundaryCoverage: Float) -> [String] {
        switch mode {
        case .room:
            let (_, reasons) = checkRoomReadiness(metrics: metrics, planes: planes, corners: corners)
            return reasons
            
        case .element:
            let (_, reasons) = checkElementReadiness(metrics: metrics, wallPlane: wallPlane, boundaryCoverage: boundaryCoverage)
            return reasons
        }
    }
    
    // MARK: - Element Opening Detection (Simplified)
    
    func detectOpening(points: [simd_float3], wallPlane: Plane) -> (found: Bool, confidence: Float) {
        logger.debug("Detecting opening with \(points.count) points")
        
        // Project points to wall plane
        let projectedPoints = points.map { point in
            let distance = dot(wallPlane.normal, point) - wallPlane.distance
            return point - wallPlane.normal * distance
        }
        
        // Find bounding box
        guard !projectedPoints.isEmpty else { return (false, 0.0) }
        
        let minX = projectedPoints.map { $0.x }.min() ?? 0
        let maxX = projectedPoints.map { $0.x }.max() ?? 0
        let minY = projectedPoints.map { $0.y }.min() ?? 0
        let maxY = projectedPoints.map { $0.y }.max() ?? 0
        let _ = projectedPoints.map { $0.z }.min() ?? 0
        let _ = projectedPoints.map { $0.z }.max() ?? 0
        
        // Create 2D occupancy grid in plane coordinates
        let gridSize: Float = 0.02 // 2 cm bins
        let width = Int((maxX - minX) / gridSize) + 1
        let height = Int((maxY - minY) / gridSize) + 1
        
        var grid = [[Int]](repeating: [Int](repeating: 0, count: height), count: width)
        
        // Fill grid
        for point in projectedPoints {
            let x = Int((point.x - minX) / gridSize)
            let y = Int((point.y - minY) / gridSize)
            
            if x >= 0 && x < width && y >= 0 && y < height {
                grid[x][y] += 1
            }
        }
        
        // Find rectangular regions with low occupancy (potential openings)
        var openingFound = false
        var maxOpeningSize = 0
        
        // Simple heuristic: look for rectangular regions with low point count
        for x in 0..<width {
            for y in 0..<height {
                if grid[x][y] < 3 { // Low occupancy
                    // Check if this is part of a larger low-occupancy region
                    var regionSize = 0
                    var queue = [(x, y)]
                    var visited = Set<String>()
                    
                    while !queue.isEmpty {
                        let (cx, cy) = queue.removeFirst()
                        let key = "\(cx),\(cy)"
                        
                        if visited.contains(key) { continue }
                        visited.insert(key)
                        
                        if cx >= 0 && cx < width && cy >= 0 && cy < height && grid[cx][cy] < 3 {
                            regionSize += 1
                            queue.append((cx + 1, cy))
                            queue.append((cx - 1, cy))
                            queue.append((cx, cy + 1))
                            queue.append((cx, cy - 1))
                        }
                    }
                    
                    if regionSize > maxOpeningSize {
                        maxOpeningSize = regionSize
                    }
                }
            }
        }
        
        // Check if opening is large enough (at least 50 bins = ~1m²)
        openingFound = maxOpeningSize > 50
        
        // Calculate confidence based on opening size
        let confidence = min(Float(maxOpeningSize) / 100.0, 1.0)
        
        logger.debug("Opening detection - Found: \(openingFound), MaxSize: \(maxOpeningSize), Confidence: \(String(format: "%.2f", confidence))")
        
        return (openingFound, confidence)
    }
    
    // MARK: - Boundary Coverage Calculation
    
    func calculateBoundaryCoverage(points: [simd_float3], wallPlane: Plane) -> Float {
        logger.debug("Calculating boundary coverage with \(points.count) points")
        logger.debug("Wall plane normal: (\(String(format: "%.2f", wallPlane.normal.x)), \(String(format: "%.2f", wallPlane.normal.y)), \(String(format: "%.2f", wallPlane.normal.z))), distance: \(String(format: "%.2f", wallPlane.distance))")

        // Filter points to only include those close to the wall plane (inliers)
        // This prevents outliers (furniture, noise) from inflating the bounding box
        let threshold: Float = 0.1 // 10cm tolerance
        let inliers = points.filter { point in
            abs(dot(wallPlane.normal, point) - wallPlane.distance) < threshold
        }

        // Project inliers to wall plane
        let projectedPoints = inliers.map { point in
            let distance = dot(wallPlane.normal, point) - wallPlane.distance
            return point - wallPlane.normal * distance
        }

        guard !projectedPoints.isEmpty else {
            logger.debug("No projected points")
            return 0.0
        }

        // Find bounding box in world coordinates
        let minX = projectedPoints.map { $0.x }.min() ?? 0
        let maxX = projectedPoints.map { $0.x }.max() ?? 0
        let minY = projectedPoints.map { $0.y }.min() ?? 0
        let maxY = projectedPoints.map { $0.y }.max() ?? 0

        let boxWidth = maxX - minX
        let boxHeight = maxY - minY

        logger.debug("Bounding box - minX: \(String(format: "%.2f", minX)), maxX: \(String(format: "%.2f", maxX)), minY: \(String(format: "%.2f", minY)), maxY: \(String(format: "%.2f", maxY))")
        logger.debug("Box dimensions - width: \(String(format: "%.2f", boxWidth)), height: \(String(format: "%.2f", boxHeight))")

        // Define boundary bands (edges of the bounding box)
        let bandWidth: Float = 0.1 // 10 cm bands
        let totalBoundaryPoints = projectedPoints.filter { point in
            point.x < minX + bandWidth || point.x > maxX - bandWidth ||
            point.y < minY + bandWidth || point.y > maxY - bandWidth
        }.count

        // Calculate coverage as ratio of boundary points to total points
        let coverage = Float(totalBoundaryPoints) / Float(projectedPoints.count)

        logger.debug("Boundary coverage - BoundaryPoints: \(totalBoundaryPoints)/\(projectedPoints.count) = \(String(format: "%.2f", coverage))")

        return coverage
    }
}
