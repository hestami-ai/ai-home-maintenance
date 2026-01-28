//
//  ScanView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import os
import ARKit
import RealityKit
import SwiftData

struct ScanView: View {
    let logger = Logger.make(category: LogCategory.scanview)
    let session: ScanSession
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @StateObject private var captureService = CaptureService()
    @StateObject private var coverageService = CoverageService()
    @State private var showingPauseAlert = false
    @State private var showingStopAlert = false
    @State private var showingNotReadyAlert = false
    @State private var errorMessage: String?
    @State private var showCoverageIndicator = true
    
    var body: some View {
        ZStack {
            // AR Camera View
            ARViewContainer(
                captureService: captureService,
                coverageService: coverageService,
                sessionId: session.id
            )
            .edgesIgnoringSafeArea(.all)
            
            // UI Overlay
            VStack {
                // Top Bar
                topBar
                
                Spacer()
                
                // Coverage Indicator (collapsible)
                if showCoverageIndicator {
                    CoverageIndicator(
                        metrics: coverageService.metrics,
                        isReady: coverageService.isReady,
                        failureReasons: coverageService.failureReasons,
                        scanMode: captureService.scanMode
                    )
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Stop Conditions Panel (collapsible)
                if showCoverageIndicator {
                    StopConditionsPanel(
                        metrics: coverageService.metrics,
                        isReady: coverageService.isReady,
                        scanMode: captureService.scanMode,
                        failureReasons: coverageService.failureReasons
                    )
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Bottom Controls
                bottomControls
            }
            .padding()
        }
        .navigationBarHidden(true)
        .alert("Pause Scan", isPresented: $showingPauseAlert) {
            Button("Resume", role: .cancel) {
                captureService.resumeScan()
            }
            Button("Stop Scan", role: .destructive) {
                captureService.stopScan()
                dismiss()
            }
        } message: {
            Text("Scan paused. Resume or stop the scan?")
        }
        .alert("Stop Scan", isPresented: $showingStopAlert) {
            Button("Continue", role: .cancel) { }
            Button("Stop", role: .destructive) {
                captureService.stopScan()
                dismiss()
            }
        } message: {
            Text("Are you sure you want to stop the scan? You can resume later or upload to cloud for processing.")
        }
        .alert("Not Ready to Stop", isPresented: $showingNotReadyAlert) {
            Button("Continue Scanning", role: .cancel) { }
            Button("Stop Anyway", role: .destructive) {
                captureService.stopScan()
                dismiss()
            }
        } message: {
            Text("The scan doesn't meet quality requirements yet. Continue scanning to improve coverage, or stop anyway (results may be poor).")
        }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") {
                errorMessage = nil
            }
        } message: {
            if let error = errorMessage {
                Text(error)
            }
        }
        .onAppear {
            logger.info("ScanView appearing with session: \(session.name)")
            captureService.setModelContext(modelContext)
            captureService.startScan(session: session)

            // Use the session's scan mode
            let mode = ScanMode(rawValue: session.scanMode ?? ScanMode.room.rawValue) ?? .room
            logger.info("Starting coverage service with mode: \(mode.rawValue)")
            coverageService.startScan(mode: mode)
        }
        .onDisappear {
            if captureService.isScanning {
                captureService.pauseScan()
            }
            coverageService.stopScan()
        }
    }
    
    private var topBar: some View {
        HStack {
            // Back Button
            Button(action: {
                if captureService.isScanning {
                    showingStopAlert = true
                } else {
                    dismiss()
                }
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(AppTheme.primaryText)
                    .background(Circle().fill(AppTheme.overlayMedium))
            }
            
            Spacer()
            
            // Session Name
            Text(session.name)
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(AppTheme.overlayMedium)
                .cornerRadius(8)
            
            Spacer()
            
            // Toggle Coverage Indicator
            Button(action: {
                withAnimation {
                    showCoverageIndicator.toggle()
                }
            }) {
                Image(systemName: showCoverageIndicator ? "chart.bar.fill" : "chart.bar")
                    .font(.title2)
                    .foregroundColor(AppTheme.primaryText)
                    .background(Circle().fill(AppTheme.overlayMedium))
            }
        }
    }
    
    private var bottomControls: some View {
        VStack(spacing: 8) {
            // Scan Info - Compact horizontal layout
            HStack(spacing: 16) {
                // Duration
                VStack(alignment: .leading, spacing: 2) {
                    Text("Duration")
                        .font(.caption2)
                        .foregroundColor(AppTheme.primaryText.opacity(0.7))
                    
                    Text(formattedDuration(captureService.scanDuration))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.primaryText)
                }
                
                Spacer()
                
                // Keyframes
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Keyframes")
                        .font(.caption2)
                        .foregroundColor(AppTheme.primaryText.opacity(0.7))
                    
                    Text("\(captureService.keyframeCount)")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.primaryText)
                }
                
                Spacer()
                
                // Tracking Quality
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Tracking")
                        .font(.caption2)
                        .foregroundColor(AppTheme.primaryText.opacity(0.7))
                    
                    Text(trackingQualityText)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(trackingQualityColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(AppTheme.overlayMedium)
            .cornerRadius(8)
            
            // Control Buttons
            controlButtons
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
    }
    
    private var controlButtons: some View {
        HStack(spacing: 20) {
            // Pause/Resume Button
            Button(action: {
                if captureService.isPaused {
                    captureService.resumeScan()
                } else {
                    showingPauseAlert = true
                }
            }) {
                Image(systemName: captureService.isPaused ? "play.fill" : "pause.fill")
                    .font(.title)
                    .foregroundColor(AppTheme.primaryText)
                    .frame(width: 60, height: 60)
                    .background(Circle().fill(AppTheme.overlayDark))
            }
            
            // Stop Button
            Button(action: {
                if coverageService.isReady {
                    showingStopAlert = true
                } else {
                    showingNotReadyAlert = true
                }
            }) {
                Image(systemName: "stop.fill")
                    .font(.title)
                    .foregroundColor(AppTheme.primaryText)
                    .frame(width: 60, height: 60)
                    .background(Circle().fill(coverageService.isReady ? AppTheme.error.opacity(0.8) : AppTheme.disabledText.opacity(0.6)))
            }
        }
    }
    
    private var trackingQualityText: String {
        switch captureService.trackingQuality {
        case .normal:
            return "Good"
        case .notAvailable:
            return "N/A"
        case .limited(let reason):
            switch reason {
            case .initializing:
                return "Init"
            case .relocalizing:
                return "Reloc"
            case .excessiveMotion:
                return "Slow"
            case .insufficientFeatures:
                return "Low"
            @unknown default:
                return "Limited"
            }
        }
    }
    
    private var trackingQualityColor: Color {
        switch captureService.trackingQuality {
        case .normal:
            return .green
        case .notAvailable:
            return .gray
        case .limited:
            return .orange
        }
    }
    
    private func formattedDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - ARView Container

struct ARViewContainer: UIViewRepresentable {
    let logger = Logger.make(category: LogCategory.scanview)
    @ObservedObject var captureService: CaptureService
    @ObservedObject var coverageService: CoverageService
    let sessionId: UUID

    func makeUIView(context: Context) -> ARView {
        logger.debugUnlessMinimal("Creating ARView")
        let arView = ARView(frame: .zero)

        // IMPORTANT: Disable automatic AR mesh occlusion so our voxels are visible
        // The AR mesh can hide our coverage visualization spheres
        arView.environment.sceneUnderstanding.options = []

        // Configure AR session
        let configuration = ARWorldTrackingConfiguration()
        // FIX: Disable sceneReconstruction to prevent AnchorManagementConsumer spam
        // sceneReconstruction = .mesh causes 50+ anchor updates per frame, causing backboardd hang
        // Our VoxelMap provides coverage feedback, we don't need AR mesh for this
        configuration.sceneReconstruction = []
        configuration.environmentTexturing = .automatic

        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            configuration.frameSemantics = .sceneDepth
            logger.info("LiDAR available - Scene depth supported and enabled")
            logger.info("Depth and confidence maps will be captured")
        } else {
            logger.warning("LiDAR not available - Scene depth not supported")
            logger.warning("Running on iOS Simulator or device without LiDAR sensor")
            logger.warning("Only RGB images will be captured (no depth/confidence data)")
            logger.warning("Depth confidence will show 0% for all keyframes")
        }

        configuration.planeDetection = [.horizontal, .vertical]

        logger.info("Starting AR session")
        arView.session.run(configuration)

        // Set up delegate
        context.coordinator.arView = arView
        context.coordinator.captureService = captureService
        context.coordinator.coverageService = coverageService
        context.coordinator.sessionId = sessionId
        arView.session.delegate = context.coordinator

        return arView
    }
    
    func updateUIView(_ uiView: ARView, context: Context) {
        // Update view if needed
    }
    
    func makeCoordinator() -> Coordinator {
        logger.debugUnlessMinimal("Creating coordinator")
        return Coordinator()
    }

    class Coordinator: NSObject, ARSessionDelegate {
        let logger = Logger.make(category: LogCategory.scanview)
        weak var captureService: CaptureService?
        weak var coverageService: CoverageService?
        var arView: ARView?
        var lastKeyframeTime: TimeInterval = 0
        var lastKeyframePose: simd_float4x4?
        var sessionId: UUID?

        // Keyframe selection thresholds
        private let minTranslationDistance: Float = 0.3 // 30cm
        private let minRotationAngle: Float = 0.2 // ~11 degrees
        private let maxKeyframeInterval: TimeInterval = 2.0 // seconds

        // Voxel visualization
        private var voxelAnchors: [String: AnchorEntity] = [:]
        private var lastVoxelUpdateTime: TimeInterval = 0
        private let voxelUpdateInterval: TimeInterval = 0.5 // Update visualization every 0.5 seconds

        // MEMORY MANAGEMENT NOTE:
        // ARFrame retention was causing LiDAR failure. The camera stops delivering frames
        // if too many ARFrames are retained. We extract all needed data from ARFrame
        // IMMEDIATELY (synchronously) before any async work.
        //
        // CRITICAL: CVPixelBuffers (depthMap, confidenceMap, capturedImage) are OWNED by ARFrame.
        // ARKit recycles the underlying memory when the frame is released, even if Swift's ARC
        // holds a reference to the CVPixelBuffer. Since we use them in an async Task, we MUST
        // create deep copies via deepCopy() before the async boundary. Without this, the buffers
        // may be nil or contain stale/corrupted data by the time the async task executes.

        func session(_ session: ARSession, didUpdate frame: ARFrame) {
            // Extract all needed data from ARFrame IMMEDIATELY (synchronously)
            // to avoid retaining the frame in async tasks
            let cameraTransform = frame.camera.transform
            let trackingState = frame.camera.trackingState
            let intrinsics = frame.camera.intrinsics
            let timestamp = frame.timestamp
            let exposureDuration = frame.camera.exposureDuration

            // Extract depth/confidence maps if available
            // IMPORTANT: CVPixelBuffers are owned by ARFrame and will be recycled when frame is released.
            // We MUST deep copy them before any async boundary to prevent data corruption/nil.
            // Swift ARC manages CVPixelBuffer references but ARKit recycles the underlying memory.
            let depthMap = frame.sceneDepth?.depthMap.deepCopy()
            let confidenceMap = frame.sceneDepth?.confidenceMap?.deepCopy()

            // For keyframe capture, we need a copy of the pixel buffer
            let capturedImage = frame.capturedImage.deepCopy()

            // Update capture service with extracted data (not the whole frame)
            Task { @MainActor in
                // Ensure we have valid pixel buffers
                guard let capturedImage = capturedImage else {
                    logger.warning("Failed to copy capturedImage pixel buffer")
                    return
                }

                captureService?.currentPose = cameraTransform
                captureService?.trackingQuality = trackingState

                // Update coverage service with extracted data
                if captureService?.isScanning == true && captureService?.isPaused == false {
                    if let depthMap = depthMap, let confidenceMap = confidenceMap {
                        coverageService?.updateWithDepthData(
                            depthMap: depthMap,
                            confidenceMap: confidenceMap,
                            pose: cameraTransform,
                            intrinsics: intrinsics,
                            trackingQuality: trackingState,
                            depthConfidence: captureService?.depthConfidence ?? 1.0
                        )
                    }
                }

                // Update voxel visualization periodically
                if captureService?.isScanning == true && captureService?.isPaused == false {
                    if timestamp - lastVoxelUpdateTime > voxelUpdateInterval {
                        lastVoxelUpdateTime = timestamp
                        updateVoxelVisualization()
                    }
                }

                // Check if we should capture a keyframe
                if captureService?.isScanning == true && captureService?.isPaused == false {
                    if shouldCaptureKeyframe(currentPose: cameraTransform) {
                        captureKeyframe(
                            capturedImage: capturedImage,
                            depthMap: depthMap,
                            confidenceMap: confidenceMap,
                            cameraTransform: cameraTransform,
                            intrinsics: intrinsics,
                            trackingState: trackingState,
                            timestamp: timestamp,
                            exposureDuration: exposureDuration
                        )
                    }
                }
            }
        }
        
        private func shouldCaptureKeyframe(currentPose: simd_float4x4) -> Bool {
            // First frame always capture
            guard let lastPose = lastKeyframePose else {
                logger.debugUnlessMinimal("First keyframe - capturing")
                return true
            }

            // Calculate translation distance
            let translation = simd_distance(lastPose.columns.3, currentPose.columns.3)

            // Calculate rotation (simplified)
            let rotationDiff = abs(lastPose.columns.0.x - currentPose.columns.0.x) +
                              abs(lastPose.columns.1.y - currentPose.columns.1.y) +
                              abs(lastPose.columns.2.z - currentPose.columns.2.z)

            // Check thresholds
            let hasMovedEnough = translation >= minTranslationDistance
            let hasRotatedEnough = rotationDiff >= minRotationAngle

            if hasMovedEnough || hasRotatedEnough {
                logger.debugUnlessMinimal("Keyframe criteria met - moved: \(String(format: "%.2f", translation))m, rotated: \(String(format: "%.2f", rotationDiff))")
                return true
            }

            return false
        }
        
        private func captureKeyframe(
            capturedImage: CVPixelBuffer,
            depthMap: CVPixelBuffer?,
            confidenceMap: CVPixelBuffer?,
            cameraTransform: simd_float4x4,
            intrinsics: simd_float3x3,
            trackingState: ARCamera.TrackingState,
            timestamp: TimeInterval,
            exposureDuration: TimeInterval
        ) {
            guard let service = captureService else { return }

            logger.debugUnlessMinimal("Capturing keyframe #\(service.keyframeCount)")

            // Create keyframe
            let keyframe = Keyframe(index: service.keyframeCount, timestamp: Date(timeIntervalSince1970: timestamp))

            // Store pose
            keyframe.setPose(cameraTransform)
            lastKeyframePose = cameraTransform

            // Store intrinsics
            keyframe.setIntrinsics(intrinsics)

            // Calculate quality metrics
            let quality = calculateFrameQuality(
                depthMap: depthMap,
                confidenceMap: confidenceMap,
                trackingState: trackingState,
                exposureDuration: exposureDuration
            )
            keyframe.qualityScore = quality.overallScore
            keyframe.depthConfidence = quality.depthConfidence
            keyframe.motionBlurDetected = quality.motionBlurDetected

            logger.verbose("Keyframe quality - score: \(String(format: "%.2f", quality.overallScore)), depth confidence: \(String(format: "%.2f", quality.depthConfidence))")

            // Save images to disk
            saveFrameImages(
                capturedImage: capturedImage,
                depthMap: depthMap,
                confidenceMap: confidenceMap,
                intrinsics: intrinsics,
                exposureDuration: exposureDuration,
                to: keyframe
            )

            // Add keyframe to service's keyframes array
            service.addKeyframe(keyframe)

            // Update service
            service.keyframeCount += 1
            logger.debugUnlessMinimal("Keyframe captured successfully. Total: \(service.keyframeCount)")
        }

        private func calculateFrameQuality(
            depthMap: CVPixelBuffer?,
            confidenceMap: CVPixelBuffer?,
            trackingState: ARCamera.TrackingState,
            exposureDuration: TimeInterval
        ) -> (overallScore: Double, depthConfidence: Double, motionBlurDetected: Bool) {
            // Check tracking quality
            let trackingScore: Double
            switch trackingState {
            case .normal:
                trackingScore = 1.0
            case .notAvailable:
                trackingScore = 0.0
            case .limited(let reason):
                switch reason {
                case .initializing, .relocalizing:
                    trackingScore = 0.5
                case .excessiveMotion:
                    trackingScore = 0.3
                case .insufficientFeatures:
                    trackingScore = 0.4
                @unknown default:
                    trackingScore = 0.5
                }
            }

            // Check depth confidence
            var depthConfidence = 1.0
            if let depthMap = depthMap {
                // Calculate percentage of valid depth pixels
                CVPixelBufferLockBaseAddress(depthMap, .readOnly)
                defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

                let width = CVPixelBufferGetWidth(depthMap)
                let height = CVPixelBufferGetHeight(depthMap)
                let baseAddress = CVPixelBufferGetBaseAddress(depthMap)

                if let floatBuffer = baseAddress?.assumingMemoryBound(to: Float32.self) {
                    var validPixels = 0
                    for i in 0..<(width * height) {
                        if floatBuffer[i] > 0 && floatBuffer[i] < Float.infinity {
                            validPixels += 1
                        }
                    }
                    depthConfidence = Double(validPixels) / Double(width * height)
                    logger.debugUnlessMinimal("Depth confidence: \(Int(depthConfidence * 100))% (\(validPixels)/\(width * height) valid pixels)")
                }
            } else {
                logger.warning("No depth map available - LiDAR not working")
                logger.warning("This device does not support LiDAR scene depth, or you are running on iOS Simulator")
                logger.warning("Depth confidence will be 0%, and no depth/confidence images will be saved")
                logger.warning("To capture LiDAR data, you must use a physical device with LiDAR sensor: iPhone 12 Pro/Pro Max or newer, iPad Pro 2020 or newer")
                depthConfidence = 0.0
            }

            // Detect motion blur (simplified - check exposure duration)
            let motionBlurDetected = exposureDuration > 0.033 // > 1/30s
            let motionScore = motionBlurDetected ? 0.5 : 1.0

            // Overall score
            let overallScore = (trackingScore * 0.4) + (depthConfidence * 0.4) + (motionScore * 0.2)

            return (overallScore, depthConfidence, motionBlurDetected)
        }
        
        private func saveFrameImages(
            capturedImage: CVPixelBuffer,
            depthMap: CVPixelBuffer?,
            confidenceMap: CVPixelBuffer?,
            intrinsics: simd_float3x3,
            exposureDuration: TimeInterval,
            to keyframe: Keyframe
        ) {
            // Save RGB image as DNG (raw format with full sensor metadata)
            let rgbPath = savePixelBufferAsDNG(
                capturedImage,
                name: "rgb_\(keyframe.id.uuidString)",
                intrinsics: intrinsics,
                exposureDuration: exposureDuration
            )
            keyframe.rgbImagePath = rgbPath
            logger.verbose("Saved RGB image as DNG to: \(rgbPath ?? "nil")")

            // Check if scene depth is available
            guard depthMap != nil || confidenceMap != nil else {
                logger.warning("ARFrame.sceneDepth is nil - depth and confidence maps not available")
                return
            }

            // Save depth image
            if let depthMap = depthMap {
                logger.debugUnlessMinimal("Depth map available - converting to UIImage")
                let depthImage = depthMap.toUIImage()
                let depthPath = saveImage(depthImage, name: "depth_\(keyframe.id.uuidString)")
                keyframe.depthImagePath = depthPath
                logger.verbose("Saved depth image to: \(depthPath ?? "nil")")
            } else {
                logger.verbose("Depth map is nil")
            }

            // Save confidence image if available
            if let confidenceMap = confidenceMap {
                logger.debugUnlessMinimal("Confidence map available - converting to UIImage")
                let confidenceImage = confidenceMap.toUIImage()
                let confidencePath = saveImage(confidenceImage, name: "confidence_\(keyframe.id.uuidString)")
                keyframe.confidenceImagePath = confidencePath
                logger.verbose("Saved confidence image to: \(confidencePath ?? "nil")")
            } else {
                logger.verbose("Confidence map is nil")
            }
        }

        private func savePixelBufferAsDNG(
            _ pixelBuffer: CVPixelBuffer,
            name: String,
            intrinsics: simd_float3x3,
            exposureDuration: TimeInterval
        ) -> String? {
            guard let sessionId = sessionId else { return nil }

            let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
            let context = CIContext()

            // Prepare file path
            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let scansPath = documentsPath.appendingPathComponent("scans/\(sessionId.uuidString)")
            let filePath = scansPath.appendingPathComponent("\(name).jpg")

            // Create directory if needed
            try? FileManager.default.createDirectory(at: scansPath, withIntermediateDirectories: true)

            // Write JPEG file (properly encoded, not fake DNG)
            do {
                let jpegData = context.jpegRepresentation(of: ciImage, colorSpace: CGColorSpaceCreateDeviceRGB())
                if let data = jpegData {
                    try data.write(to: filePath)
                    let sizeStr = ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)
                    logger.verbose("Saved JPEG image: \(filePath.path) (size: \(sizeStr))")
                    return filePath.path
                } else {
                    logger.error("Failed to create JPEG data")
                    return nil
                }
            } catch {
                logger.error("Failed to save JPEG: \(error)")
                return nil
            }
        }

        private func saveImageAsHEIC(_ image: UIImage, quality: CGFloat = 0.9) -> Data? {
            guard let cgImage = image.cgImage else { return nil }

            let ciImage = CIImage(cgImage: cgImage)
            let context = CIContext()

            let options: [CIImageRepresentationOption: Any] = [
                kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: quality
            ]

            return context.heifRepresentation(of: ciImage, format: .RGBA8, colorSpace: cgImage.colorSpace ?? CGColorSpaceCreateDeviceRGB(), options: options)
        }

        private func saveImage(_ image: UIImage, name: String) -> String? {
            guard let sessionId = sessionId else { return nil }

            // Determine format based on image type
            // RGB images: Use PNG for truly lossless storage (required for measurement accuracy)
            // Depth/Confidence: Use JPEG with high quality (these are grayscale visualizations)
            let isRGBImage = name.contains("rgb")
            let (data, fileExtension): (Data?, String) = {
                if isRGBImage {
                    // PNG provides truly lossless compression for cloud pipeline processing
                    // Essential for preserving full fidelity for measurements and 3D reconstruction
                    return (image.pngData(), "png")
                } else {
                    // Depth and confidence maps use JPEG
                    return (image.jpegData(compressionQuality: 0.85), "jpg")
                }
            }()

            guard let imageData = data else { return nil }

            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let scansPath = documentsPath.appendingPathComponent("scans/\(sessionId.uuidString)")
            let filePath = scansPath.appendingPathComponent("\(name).\(fileExtension)")

            // Create directory if needed
            try? FileManager.default.createDirectory(at: scansPath, withIntermediateDirectories: true)

            // Write file synchronously to ensure it exists before returning path
            do {
                try imageData.write(to: filePath)
                logger.verbose("Saved image to: \(filePath.path) (size: \(ByteCountFormatter.string(fromByteCount: Int64(imageData.count), countStyle: .file)))")
                return filePath.path
            } catch {
                logger.error("Failed to save image: \(error)")
                return nil
            }
        }
        
        private func updateVoxelVisualization() {
            // Debug: Log that we're attempting visualization
            logger.debug("=== VOXEL VISUALIZATION ATTEMPT ===")
            logger.debug("isScanning: \(self.captureService?.isScanning.description ?? "nil"), isPaused: \(self.captureService?.isPaused.description ?? "nil")")

            guard let arView = arView else {
                logger.error("Voxel visualization FAILED: ARView is nil")
                return
            }

            guard let coverageService = coverageService else {
                logger.error("Voxel visualization FAILED: CoverageService is nil")
                return
            }

            guard let voxelMap = coverageService.voxelMapForVisualization else {
                logger.error("Voxel visualization FAILED: VoxelMap is nil")
                return
            }

            let allVoxels = voxelMap.getAllVoxels()
            let goodVoxels = voxelMap.getGoodVoxels(mode: coverageService.scanMode)

            logger.info("Voxel visualization: Total=\(allVoxels.count), Good=\(goodVoxels.count), Displayed=\(self.voxelAnchors.count)")

            if allVoxels.isEmpty {
                logger.warning("Voxel visualization SKIPPED: No voxels yet (still building coverage)")
                return
            }

            // Log camera position for debugging
            if let cameraTransform = captureService?.currentPose {
                let cameraPos = simd_float3(cameraTransform.columns.3.x, cameraTransform.columns.3.y, cameraTransform.columns.3.z)
                logger.verbose("Camera position: (\(String(format: "%.2f", cameraPos.x)), \(String(format: "%.2f", cameraPos.y)), \(String(format: "%.2f", cameraPos.z)))")
            }

            // Limit visualization to avoid performance issues (max 500 voxels)
            let maxVoxelsToDisplay = 500

            // Track which voxels are currently displayed
            var displayedKeys = Set<String>()
            
            // Create or update voxel entities
            for (key, stats) in allVoxels.prefix(maxVoxelsToDisplay) {
                let voxelId = "voxel_\(key.x)_\(key.y)_\(key.z)"
                displayedKeys.insert(voxelId)
                
                // Get voxel position (centroid or fallback to voxel center)
                let position: simd_float3
                if let centroid = stats.centroid {
                    position = centroid
                } else {
                    let voxelSize = coverageService.scanMode.voxelSize
                    position = simd_float3(
                        Float(key.x) * voxelSize,
                        Float(key.y) * voxelSize,
                        Float(key.z) * voxelSize
                    )
                }
                
                // Check if this is a good voxel
                let isGood = goodVoxels[key] != nil
                
                // Create or update anchor
                if let existingAnchor = voxelAnchors[voxelId] {
                    // Update position
                    existingAnchor.position = SIMD3<Float>(position.x, position.y, position.z)

                    // Update color if voxel status changed
                    if let entity = existingAnchor.children.first as? ModelEntity {
                        let newColor: UIColor = isGood ? .green : .red
                        let material = UnlitMaterial(color: newColor.withAlphaComponent(0.9))
                        entity.model?.materials = [material]
                    }
                } else {
                    // Create new anchor with entity
                    // Make spheres much larger (0.10m = 10cm radius) for better visibility
                    let sphereRadius: Float = 0.10
                    let sphere = MeshResource.generateSphere(radius: sphereRadius)

                    // Use UnlitMaterial so voxels are always visible regardless of lighting
                    // CRITICAL: UnlitMaterial + disabled sceneUnderstanding.options ensures
                    // voxels render on top of AR mesh reconstruction and are always visible
                    let color: UIColor = isGood ? .green : .red
                    let material = UnlitMaterial(color: color.withAlphaComponent(0.9))

                    let entity = ModelEntity(mesh: sphere, materials: [material])

                    // Create anchor at position
                    let anchor = AnchorEntity(world: SIMD3<Float>(position.x, position.y, position.z))
                    anchor.addChild(entity)

                    // Add to scene
                    arView.scene.addAnchor(anchor)
                    voxelAnchors[voxelId] = anchor

                    logger.verbose("Created voxel sphere at (\(String(format: "%.2f", position.x)), \(String(format: "%.2f", position.y)), \(String(format: "%.2f", position.z))), color: \(isGood ? "green" : "red"), radius: \(sphereRadius)m")
                }
            }
            
            // Remove voxels that are no longer in the map
            let keysToRemove = voxelAnchors.keys.filter { !displayedKeys.contains($0) }
            if !keysToRemove.isEmpty {
                logger.verbose("Removing voxels that are no longer in map")
            }
            for key in keysToRemove {
                if let anchor = voxelAnchors[key] {
                    arView.scene.removeAnchor(anchor)
                    voxelAnchors.removeValue(forKey: key)
                }
            }

            logger.verbose("Voxel visualization updated - Displaying: \(voxelAnchors.count) voxels in AR scene (limited to \(maxVoxelsToDisplay))")
        }
        
        func session(_ session: ARSession, didFailWithError error: Error) {
            logger.error("AR Session failed: \(error.localizedDescription)")
            Task { @MainActor in
                captureService?.errorMessage = "AR Session failed: \(error.localizedDescription)"
            }
        }
        
        func sessionWasInterrupted(_ session: ARSession) {
            logger.warning("AR Session was interrupted")
            Task { @MainActor in
                captureService?.errorMessage = "AR Session was interrupted"
            }
        }
        
        func sessionInterruptionEnded(_ session: ARSession) {
            logger.info("AR Session interruption ended")
            Task { @MainActor in
                captureService?.errorMessage = nil
            }
        }
    }
}

#Preview {
    ScanView(session: ScanSession(name: "Living Room"))
        .modelContainer(for: [ScanSession.self, Keyframe.self, MeasurementResult.self], inMemory: true)
}
