//
//  PlaneDetection.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import os
import simd

class PlaneDetection {
    private let logger = Logger.make(category: LogCategory.planeDetection)
    
    // MARK: - Public Methods
    
    /// Detect dominant planes using RANSAC
    /// - Parameters:
    ///   - points: Array of 3D points
    ///   - maxPlanes: Maximum number of planes to detect
    ///   - iterations: Number of RANSAC iterations
    ///   - threshold: Distance threshold for inliers (meters)
    /// - Returns: Array of detected planes
    func detectPlanes(points: [simd_float3], maxPlanes: Int = 5, iterations: Int = 200, threshold: Float = 0.05) -> [Plane] {
        logger.debugUnlessMinimal("Starting plane detection with \(points.count) points, maxPlanes: \(maxPlanes)")
        guard points.count >= 3 else { 
            logger.debugUnlessMinimal("Not enough points (need at least 3)")
            return [] 
        }
        
        var detectedPlanes: [Plane] = []
        var remainingPoints = points
        
        for i in 0..<maxPlanes {
            guard remainingPoints.count >= 3 else { 
                logger.debug("Stopping at plane \(i) - not enough remaining points")
                break 
            }
            
            if let plane = ransacPlane(points: remainingPoints, iterations: iterations, threshold: threshold) {
                detectedPlanes.append(plane)
                logger.debugUnlessMinimal("Detected plane \(i+1) - Normal: (\(String(format: "%.2f", plane.normal.x)), \(String(format: "%.2f", plane.normal.y)), \(String(format: "%.2f", plane.normal.z))), Points: \(plane.pointCount), IsVertical: \(plane.isVertical), IsHorizontal: \(plane.isHorizontal)")
                
                // Remove inliers from remaining points
                remainingPoints = remainingPoints.filter { point in
                    let distance = pointToPlaneDistance(point: point, plane: plane)
                    return distance > threshold
                }
                logger.verbose("Remaining points after plane \(i+1): \(remainingPoints.count)")
            } else {
                logger.debugUnlessMinimal("Could not detect plane \(i+1)")
                break
            }
        }
        
        logger.debugUnlessMinimal("Detected \(detectedPlanes.count) planes total")
        return detectedPlanes
    }
    
    /// Detect floor plane (horizontal plane with most points)
    func detectFloorPlane(points: [simd_float3], iterations: Int = 200, threshold: Float = 0.05) -> Plane? {
        let planes = detectPlanes(points: points, maxPlanes: 10, iterations: iterations, threshold: threshold)
        
        // Find horizontal plane with most points
        let horizontalPlanes = planes.filter { $0.isHorizontal }
        
        guard !horizontalPlanes.isEmpty else { return nil }
        
        // Return the horizontal plane with the most points
        return horizontalPlanes.max { $0.pointCount < $1.pointCount }
    }
    
    /// Detect vertical planes (walls)
    func detectVerticalPlanes(points: [simd_float3], maxPlanes: Int = 4, iterations: Int = 200, threshold: Float = 0.05) -> [Plane] {
        let planes = detectPlanes(points: points, maxPlanes: maxPlanes * 2, iterations: iterations, threshold: threshold)
        
        // Filter for vertical planes
        let verticalPlanes = planes.filter { $0.isVertical }
        
        // Sort by point count (descending)
        return verticalPlanes.sorted { $0.pointCount > $1.pointCount }.prefix(maxPlanes).map { $0 }
    }
    
    /// Detect corners from plane intersections
    func detectCorners(planes: [Plane], threshold: Float = 0.1) -> [Corner] {
        logger.debugUnlessMinimal("Detecting corners from \(planes.count) planes")
        var corners: [Corner] = []
        
        // Find intersections between vertical planes
        let verticalPlanes = planes.filter { $0.isVertical }
        logger.verbose("Found \(verticalPlanes.count) vertical planes for corner detection")
        
        for i in 0..<verticalPlanes.count {
            for j in (i+1)..<verticalPlanes.count {
                let plane1 = verticalPlanes[i]
                let plane2 = verticalPlanes[j]
                
                // Check if planes are roughly orthogonal
                let dotProduct = abs(dot(plane1.normal, plane2.normal))
                guard dotProduct < 0.3 else { continue } // Not orthogonal
                
                // Calculate intersection line
                if let intersection = planeIntersection(plane1, plane2) {
                    // Add corner
                    let confidence = Float(min(plane1.pointCount, plane2.pointCount)) / Float(100)
                    corners.append(Corner(position: intersection, confidence: min(confidence, 1.0)))
                    logger.verbose("Corner detected at (\(String(format: "%.2f", intersection.x)), \(String(format: "%.2f", intersection.y)), \(String(format: "%.2f", intersection.z))), confidence: \(String(format: "%.2f", min(confidence, 1.0)))")
                }
            }
        }
        
        logger.debugUnlessMinimal("Detected \(corners.count) corners")
        return corners
    }
    
    // MARK: - Private Methods
    
    /// RANSAC plane fitting
    private func ransacPlane(points: [simd_float3], iterations: Int, threshold: Float) -> Plane? {
        guard points.count >= 3 else { return nil }
        
        var bestPlane: Plane?
        var maxInliers = 0
        
        for _ in 0..<iterations {
            // Sample 3 random points
            let indices = (0..<3).map { _ in Int.random(in: 0..<points.count) }
            let p1 = points[indices[0]]
            let p2 = points[indices[1]]
            let p3 = points[indices[2]]
            
            // Calculate plane from 3 points
            guard let plane = planeFromPoints(p1, p2, p3) else { continue }
            
            // Count inliers
            let inliers = points.filter { point in
                let distance = pointToPlaneDistance(point: point, plane: plane)
                return distance < threshold
            }
            
            if inliers.count > maxInliers {
                maxInliers = inliers.count
                bestPlane = Plane(normal: plane.normal, distance: plane.distance, pointCount: inliers.count)
            }
        }
        
        if bestPlane != nil {
            logger.verbose("RANSAC found plane with \(maxInliers)/\(points.count) inliers")
        } else {
            logger.verbose("RANSAC failed to find a plane")
        }
        
        return bestPlane
    }
    
    /// Calculate plane from 3 points
    private func planeFromPoints(_ p1: simd_float3, _ p2: simd_float3, _ p3: simd_float3) -> Plane? {
        let v1 = p2 - p1
        let v2 = p3 - p1
        let normal = cross(v1, v2)
        
        // Check if points are collinear
        let normalLength = length(normal)
        guard normalLength > 0.001 else { return nil }
        
        let normalizedNormal = normal / normalLength
        let distance = dot(normalizedNormal, p1)
        
        return Plane(normal: normalizedNormal, distance: distance, pointCount: 0)
    }
    
    /// Calculate distance from point to plane
    private func pointToPlaneDistance(point: simd_float3, plane: Plane) -> Float {
        return abs(dot(plane.normal, point) - plane.distance)
    }
    
    /// Calculate intersection of two planes
    private func planeIntersection(_ plane1: Plane, _ plane2: Plane) -> simd_float3? {
        let n1 = plane1.normal
        let n2 = plane2.normal
        let d1 = plane1.distance
        let d2 = plane2.distance
        
        // Cross product gives direction of intersection line
        let direction = cross(n1, n2)
        let directionLength = length(direction)
        
        guard directionLength > 0.001 else { return nil } // Planes are parallel
        
        // Use Cramer's rule to find intersection point
        let det = dot(n1, n1) * dot(n2, n2) - dot(n1, n2) * dot(n1, n2)
        guard abs(det) > 0.001 else { return nil }
        
        let a = (d1 * dot(n2, n2) - d2 * dot(n1, n2)) / det
        let b = (d2 * dot(n1, n1) - d1 * dot(n1, n2)) / det
        
        let point = a * n1 + b * n2
        
        return point
    }
}
