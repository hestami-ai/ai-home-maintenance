//
//  VoxelMap.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import os
import simd

class VoxelMap {
    private let logger = Logger.make(category: LogCategory.voxelMap)
    private var voxels: [VoxelKey: VoxelStats] = [:]
    private let voxelSize: Float
    private let maxRange: Float
    private let maxVoxels: Int = 10000
    private let ttl: Double = 20.0 // seconds
    
    init(voxelSize: Float, maxRange: Float) {
        self.voxelSize = voxelSize
        self.maxRange = maxRange
    }
    
    // MARK: - Public Methods
    
    func update(with points: [(position: simd_float3, confidence: Float, viewDir: simd_float3, range: Float, time: Double)]) {
        var newVoxels = 0
        var updatedVoxels = 0
        var outOfRange = 0

        for point in points {
            let key = VoxelKey(point: point.position, voxelSize: voxelSize)

            // Check if within range
            // FIX: Use point.range (distance from camera) instead of position length (distance from world origin)
            if point.range > maxRange || point.range < 0.2 {
                outOfRange += 1
                continue
            }

            // Get or create voxel stats
            if voxels[key] == nil {
                newVoxels += 1
            } else {
                updatedVoxels += 1
            }

            var stats = voxels[key, default: VoxelStats()]
            stats.update(position: point.position, confidence: point.confidence, viewDir: point.viewDir, range: point.range, time: point.time)
            voxels[key] = stats
        }

        logger.verbose("Updated - New: \(newVoxels), Updated: \(updatedVoxels), Out of range: \(outOfRange), Total: \(voxels.count)")

        // Don't prune on every update - only prune periodically to avoid removing voxels too quickly
        // Prune old voxels if needed (only every 10 updates or when count exceeds limit)
        if voxels.count > maxVoxels || newVoxels > 100 {
            pruneIfNeeded()
        }
    }
    
    func getVoxel(at key: VoxelKey) -> VoxelStats? {
        return voxels[key]
    }
    
    func getAllVoxels() -> [VoxelKey: VoxelStats] {
        return voxels
    }
    
    func getVoxelCount() -> Int {
        return voxels.count
    }
    
    func getPoints() -> [simd_float3] {
        return voxels.compactMap { key, stats in
            // Use the actual centroid of points in the voxel for higher precision
            // This is critical for RANSAC plane detection to work correctly
            if let centroid = stats.centroid {
                return centroid
            }
            
            // Fallback to voxel center (shouldn't happen if obsCount > 0)
            return simd_float3(Float(key.x) * voxelSize, Float(key.y) * voxelSize, Float(key.z) * voxelSize)
        }
    }
    
    func clear() {
        voxels.removeAll()
    }
    
    // MARK: - Private Methods
    
    private func pruneIfNeeded() {
        // Prune by TTL
        let currentTime = Date().timeIntervalSince1970
        let ttlThreshold = currentTime - ttl

        let beforeCount = voxels.count
        voxels = voxels.filter { _, stats in
            // Only keep voxels with valid timestamps that aren't too old
            // FIX: Ensure we're comparing timestamps correctly
            stats.lastSeenTime > 0.0 && stats.lastSeenTime > ttlThreshold
        }
        let afterCount = voxels.count
        
        if beforeCount != afterCount {
            logger.verbose("Pruned \(beforeCount - afterCount) voxels by TTL (threshold: \(String(format: "%.1f", ttlThreshold)))")
        }

        // Prune by count if needed
        if voxels.count > maxVoxels {
            let beforePruneCount = voxels.count
            // Remove oldest voxels
            let sorted = voxels.sorted { $0.value.firstSeenTime < $1.value.firstSeenTime }
            let toRemove = sorted.prefix(voxels.count - maxVoxels)
            for (key, _) in toRemove {
                voxels.removeValue(forKey: key)
            }
            logger.verbose("Pruned \(beforePruneCount - voxels.count) voxels by count limit")
        }
    }
    
    // MARK: - Quality Assessment
    
    func isVoxelGood(_ stats: VoxelStats, mode: ScanMode) -> Bool {
        guard stats.obsCount >= UInt16(mode.minObservations) else { return false }
        guard stats.confAvg >= mode.minConfidence else { return false }
        
        // Dynamic angular diversity: If confidence is high (LiDAR), effectively bypass diversity check
        // If we have LiDAR (conf > 0.9), we trust the point even with 0 parallax
        let minAngle: Float = stats.confAvg > 0.9 ? 0.0 : mode.minAngularDiversity
        guard stats.angularDiversity >= minAngle else { return false }
        guard stats.rangeMin <= mode.maxRange else { return false }
        
        return true
    }
    
    func getGoodVoxels(mode: ScanMode) -> [VoxelKey: VoxelStats] {
        return voxels.filter { _, stats in
            isVoxelGood(stats, mode: mode)
        }
    }
    
    func getCoverageScore(mode: ScanMode) -> Float {
        guard !voxels.isEmpty else { 
            logger.debugUnlessMinimal("Coverage score - No voxels")
            return 0.0 
        }
        
        // Calculate score and gather failure statistics
        var goodCount = 0
        var failObs = 0
        var failConf = 0
        var failAngle = 0
        var failRange = 0
        
        for stats in voxels.values {
            if isVoxelGood(stats, mode: mode) {
                goodCount += 1
            } else {
                if stats.obsCount < UInt16(mode.minObservations) { failObs += 1 }
                else if stats.confAvg < mode.minConfidence { failConf += 1 }
                else if stats.angularDiversity < (stats.confAvg > 0.9 ? 0.0 : mode.minAngularDiversity) { failAngle += 1 }
                else if stats.rangeMin > mode.maxRange { failRange += 1 }
            }
        }
        
        let score = Float(goodCount) / Float(voxels.count)
        
        logger.debugUnlessMinimal("Coverage score - Good: \(goodCount)/\(voxels.count) = \(String(format: "%.2f", score))")
        if goodCount == 0 || score < 0.1 {
            logger.verbose("Failure Stats - LowObs: \(failObs), LowConf: \(failConf), LowAngle: \(failAngle), Range: \(failRange)")
        }
        logger.verbose("Thresholds - MinObs: \(mode.minObservations), MinConf: \(mode.minConfidence), MinAngDiv: \(mode.minAngularDiversity) (LiDAR: 0.0)")
        
        return score
    }
    
    func getObservabilityScore(mode: ScanMode) -> Float {
        let goodVoxels = getGoodVoxels(mode: mode)
        guard !goodVoxels.isEmpty else { 
            logger.debugUnlessMinimal("Observability score - No good voxels")
            return 0.0 
        }
        
        let targetDiversity = mode.minAngularDiversity * 2.0 // Target 2x minimum
        
        // Calculate score based on diversity OR high confidence (LiDAR)
        var totalScore: Float = 0.0
        for stats in goodVoxels.values {
            if stats.confAvg > 0.9 {
                // For LiDAR, high confidence implies good observability regardless of angle
                totalScore += 1.0
            } else {
                // For visual/low-conf, we rely on angular diversity
                let diversityScore = min(stats.angularDiversity / targetDiversity, 1.0)
                totalScore += diversityScore
            }
        }
        
        let score = totalScore / Float(goodVoxels.count)
        
        logger.debugUnlessMinimal("Observability score - Score: \(String(format: "%.2f", score)) (LiDAR adjusted)")
        
        return score
    }
}
