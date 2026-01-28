//
//  CaptureService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import ARKit
import Combine
import UIKit
import SwiftData
import simd
import os

@MainActor
class CaptureService: NSObject, ObservableObject {
    private let logger = Logger.make(category: LogCategory.captureService)
    // MARK: - Published Properties
    
    @Published var isScanning = false
    @Published var isPaused = false
    @Published var trackingQuality: ARCamera.TrackingState = .notAvailable
    @Published var keyframeCount = 0
    @Published var scanDuration: TimeInterval = 0
    @Published var currentPose: simd_float4x4?
    @Published var depthConfidence: Double = 1.0
    @Published var errorMessage: String?
    @Published var coverageMetrics = CoverageMetrics()
    @Published var scanMode: ScanMode = .room
    
    // MARK: - Private Properties
    
    private var scanSession: ScanSession?
    private var keyframes: [Keyframe] = []
    private var scanStartTime: Date?
    private var timer: Timer?
    private var modelContext: ModelContext?
    private var voxelMap: VoxelMap?
    private var lastCoverageUpdateTime: Date?
    
    // MARK: - Initialization
    
    override init() {
        super.init()
        logger.debug("CaptureService initialized")
    }
    
    // MARK: - Public Methods
    
    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }
    
    func startScan(session: ScanSession, mode: ScanMode = .room) {
        guard !isScanning else { 
            logger.warning("Already scanning")
            return 
        }
        
        logger.info("Starting scan with session: \(session.name) (ID: \(session.id))")
        logger.info("Scan mode: \(mode.displayName)")
        
        // Use the existing session
        self.scanSession = session
        session.status = .inProgress
        session.createdAt = Date()
        session.updatedAt = Date()
        
        logger.info("Using existing session")
        
        // Set scan mode
        self.scanMode = mode
        
        // Initialize voxel map
        self.voxelMap = VoxelMap(voxelSize: mode.voxelSize, maxRange: mode.maxRange)
        
        // Reset state
        keyframes.removeAll()
        keyframeCount = 0
        scanDuration = 0
        errorMessage = nil
        coverageMetrics = CoverageMetrics()
        lastCoverageUpdateTime = nil
        
        // Start timer
        scanStartTime = Date()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.updateScanDuration()
                self.updateSessionDuration()
            }
        }
        
        isScanning = true
        isPaused = false
        logger.info("Scan started successfully")
    }
    
    func pauseScan() {
        guard isScanning && !isPaused else { 
            logger.warning("Cannot pause - not scanning or already paused")
            return 
        }
        
        logger.info("Pausing scan")
        isPaused = true
        timer?.invalidate()
        
        scanSession?.status = .paused
        scanSession?.duration = scanDuration
    }
    
    func resumeScan() {
        guard isScanning && isPaused else { 
            logger.warning("Cannot resume - not scanning or not paused")
            return 
        }
        
        logger.info("Resuming scan")
        isPaused = false
        
        // Resume timer
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                self.updateScanDuration()
            }
        }
        
        scanSession?.status = .inProgress
    }
    
    func stopScan() {
        guard isScanning else { 
            logger.warning("Cannot stop - not scanning")
            return 
        }
        
        logger.info("Stopping scan")
        timer?.invalidate()
        
        isScanning = false
        isPaused = false
        
        // Update session with coverage metrics
        scanSession?.status = .completed
        scanSession?.duration = scanDuration
        scanSession?.keyframeCount = keyframes.count
        scanSession?.updatedAt = Date()
        scanSession?.coverageScore = Double(coverageMetrics.coverageScore)
        scanSession?.readinessScore = Double(coverageMetrics.readinessScore)
        
        // Save keyframes
        if let context = modelContext, let session = scanSession {
            logger.debug("Saving \(self.keyframes.count) keyframes to context")
            for keyframe in self.keyframes {
                keyframe.scanSession = session
                context.insert(keyframe)
            }
            
            // Force save to ensure data persists
            do {
                try context.save()
                logger.info("Context saved successfully")
            } catch {
                logger.error("Failed to save context: \(error.localizedDescription)")
            }
        }
        
        logger.info("Scan stopped successfully")
    }
    
    func cancelScan() {
        guard isScanning else { 
            logger.warning("Cannot cancel - not scanning")
            return 
        }
        
        logger.info("Cancelling scan")
        timer?.invalidate()
        
        isScanning = false
        isPaused = false
        
        // Delete session
        if let context = modelContext, let session = scanSession {
            context.delete(session)
        }
        
        scanSession = nil
        keyframes.removeAll()
        keyframeCount = 0
        voxelMap = nil
        coverageMetrics = CoverageMetrics()
    }
    
    func addKeyframe(_ keyframe: Keyframe) {
        logger.debug("Adding keyframe #\(keyframe.index) to array")
        keyframes.append(keyframe)
        logger.debug("Keyframe array now has \(self.keyframes.count) keyframes")

        // Immediately save keyframe to Core Data so it appears in scan details
        if let context = modelContext, let session = scanSession {
            keyframe.scanSession = session
            context.insert(keyframe)
            logger.debug("Inserted keyframe #\(keyframe.index) into Core Data context")
        }
    }

    func updateKeyframeRawDNGPath(keyframeId: UUID, path: String) {
        let keyframesArray = self.keyframes
        if let keyframe = keyframesArray.first(where: { kf in kf.id == keyframeId }) {
            keyframe.rawDNGPath = path
            logger.debug("Updated keyframe \(keyframeId) with raw DNG path")
        } else {
            logger.warning("Keyframe \(keyframeId) not found for raw DNG path update")
        }
    }

    // MARK: - Private Methods
    
    private func updateScanDuration() {
        guard let startTime = scanStartTime else { return }
        scanDuration = Date().timeIntervalSince(startTime)
    }
    
    private func updateSessionDuration() {
        guard let session = scanSession else { return }
        session.duration = scanDuration
        session.keyframeCount = keyframes.count
    }
    
    // MARK: - Coverage Tracking
    // NOTE: Coverage tracking is now handled by CoverageService.updateWithDepthData()
    // to avoid ARFrame retention issues. See ScanView.swift Coordinator for details.

    private func updateCoverageMetrics() {
        guard let voxelMap = voxelMap else { return }
        
        // Update tracking quality
        switch trackingQuality {
        case .normal:
            coverageMetrics.trackingQuality = 1.0
        case .notAvailable:
            coverageMetrics.trackingQuality = 0.0
        case .limited:
            coverageMetrics.trackingQuality = 0.5
        @unknown default:
            coverageMetrics.trackingQuality = 0.5
        }
        
        // Update depth quality
        coverageMetrics.depthQuality = Float(depthConfidence)
        
        // Update coverage and observability scores
        coverageMetrics.coverageScore = voxelMap.getCoverageScore(mode: scanMode)
        coverageMetrics.observabilityScore = voxelMap.getObservabilityScore(mode: scanMode)
        
        // Update voxel counts
        coverageMetrics.voxelCount = voxelMap.getVoxelCount()
        coverageMetrics.goodVoxelCount = voxelMap.getGoodVoxels(mode: scanMode).count
        
        // Calculate overall readiness score
        coverageMetrics.readinessScore = 0.45 * coverageMetrics.coverageScore +
                                         0.25 * coverageMetrics.observabilityScore +
                                         0.20 * coverageMetrics.depthQuality +
                                         0.10 * coverageMetrics.trackingQuality
    }
}

// MARK: - Extensions

extension CVPixelBuffer {
    func toUIImage() -> UIImage {
        let ciImage = CIImage(cvPixelBuffer: self)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            return UIImage()
        }
        return UIImage(cgImage: cgImage)
    }
}

extension CVPixelBuffer {
    func toCVPixelBuffer() -> CVPixelBuffer {
        return self
    }

    /// Creates a deep copy of the pixel buffer.
    /// This is essential when you need to use an ARFrame's pixel buffer in an async context,
    /// because ARKit recycles the underlying memory when the frame is released.
    func deepCopy() -> CVPixelBuffer? {
        let width = CVPixelBufferGetWidth(self)
        let height = CVPixelBufferGetHeight(self)
        let pixelFormat = CVPixelBufferGetPixelFormatType(self)

        var copyOut: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            pixelFormat,
            nil,
            &copyOut
        )

        guard status == kCVReturnSuccess, let copy = copyOut else {
            return nil
        }

        CVPixelBufferLockBaseAddress(self, .readOnly)
        CVPixelBufferLockBaseAddress(copy, [])
        defer {
            CVPixelBufferUnlockBaseAddress(self, .readOnly)
            CVPixelBufferUnlockBaseAddress(copy, [])
        }

        // Handle planar vs non-planar formats
        let planeCount = CVPixelBufferGetPlaneCount(self)
        if planeCount > 0 {
            // Planar format (e.g., YCbCr)
            for plane in 0..<planeCount {
                let srcBaseAddress = CVPixelBufferGetBaseAddressOfPlane(self, plane)
                let dstBaseAddress = CVPixelBufferGetBaseAddressOfPlane(copy, plane)
                let bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(self, plane)
                let planeHeight = CVPixelBufferGetHeightOfPlane(self, plane)

                if let src = srcBaseAddress, let dst = dstBaseAddress {
                    memcpy(dst, src, bytesPerRow * planeHeight)
                }
            }
        } else {
            // Non-planar format (e.g., Float32 depth maps)
            let srcBaseAddress = CVPixelBufferGetBaseAddress(self)
            let dstBaseAddress = CVPixelBufferGetBaseAddress(copy)
            let bytesPerRow = CVPixelBufferGetBytesPerRow(self)

            if let src = srcBaseAddress, let dst = dstBaseAddress {
                memcpy(dst, src, bytesPerRow * height)
            }
        }

        return copy
    }
}
