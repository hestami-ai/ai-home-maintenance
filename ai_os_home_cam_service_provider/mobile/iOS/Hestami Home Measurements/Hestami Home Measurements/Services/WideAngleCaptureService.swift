//
//  WideAngleCaptureService.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import Foundation
import os
@preconcurrency import AVFoundation
import Combine
import UIKit
import ImageIO

/// Service for Stage 1 ProRAW capture using the wide-angle camera.
/// This service can ONLY be used when ARKit is NOT running, as ARKit requires
/// exclusive access to the wide-angle camera.
@MainActor
class WideAngleCaptureService: NSObject, ObservableObject {
    private let logger = Logger.make(category: LogCategory.wideAngleCapture)

    // MARK: - Published Properties

    @Published var isSessionRunning = false
    @Published var isCapturing = false
    @Published var isProRAWAvailable = false
    @Published var is48MPAvailable = false
    @Published var capturedCount = 0
    @Published var lastCapturedPreview: UIImage?
    @Published var errorMessage: String?

    // MARK: - Private Properties

    private let captureSession = AVCaptureSession()
    private var photoOutput: AVCapturePhotoOutput?
    private var wideAngleDevice: AVCaptureDevice?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    // Photo capture tracking
    private var pendingCaptures: [Int64: ReferenceCaptureRequest] = [:]
    private var captureCounter: Int64 = 0
    // FIX: Store delegates to prevent them from being deallocated before callback
    private var activeDelegates: [Int64: ReferencePhotoCaptureDelegate] = [:]

    // MARK: - Public Properties

    /// The capture session for preview display
    var session: AVCaptureSession {
        return captureSession
    }

    // MARK: - Initialization

    override init() {
        super.init()
        logger.debug("WideAngleCaptureService initialized")
    }

    // MARK: - Setup

    /// Sets up the capture session. Call this when the view appears.
    func setupCaptureSession() {
        logger.info("Setting up wide-angle capture session for Stage 1 ProRAW capture")

        // Request camera permission
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureCaptureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard granted, let service = self else { return }
                Task { @MainActor in
                    service.configureCaptureSession()
                }
            }
        default:
            logger.warning("Camera permission denied")
            errorMessage = "Camera permission is required for photo capture"
        }
    }

    private func configureCaptureSession() {
        captureSession.beginConfiguration()

        // Set session preset for highest quality photos
        if captureSession.canSetSessionPreset(.photo) {
            captureSession.sessionPreset = .photo
            logger.debug("Session preset set to .photo")
        }

        // Use the WIDE-ANGLE camera - this is the main camera that supports ProRAW/48MP
        // IMPORTANT: This can only be used when ARKit is NOT running
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            logger.error("Wide-angle camera not available")
            captureSession.commitConfiguration()
            errorMessage = "Wide-angle camera not available"
            return
        }

        wideAngleDevice = camera
        logger.info("Using wide-angle camera for ProRAW capture")

        // Add camera input
        do {
            let input = try AVCaptureDeviceInput(device: camera)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
                logger.debug("Camera input added")
            } else {
                logger.error("Cannot add camera input")
                captureSession.commitConfiguration()
                errorMessage = "Cannot configure camera input"
                return
            }
        } catch {
            logger.error("Error creating camera input: \(error)")
            captureSession.commitConfiguration()
            errorMessage = "Camera setup failed: \(error.localizedDescription)"
            return
        }

        // Add photo output
        let output = AVCapturePhotoOutput()
        if captureSession.canAddOutput(output) {
            captureSession.addOutput(output)
            photoOutput = output
            logger.debug("Photo output added")

            // Check for ProRAW support (iPhone 12 Pro and newer)
            if #available(iOS 14.3, *) {
                if output.isAppleProRAWSupported {
                    output.isAppleProRAWEnabled = true
                    isProRAWAvailable = true
                    logger.info("Apple ProRAW is available and enabled")
                } else {
                    logger.info("Apple ProRAW not supported on this device")
                }
            }

            // Check for 48MP support (iPhone 14 Pro and newer)
            if #available(iOS 16.0, *) {
                // 48MP is available when using quality prioritization
                is48MPAvailable = output.maxPhotoDimensions.width > 8000
                if is48MPAvailable {
                    logger.info("48MP capture is available (max dimensions: \(output.maxPhotoDimensions.width)x\(output.maxPhotoDimensions.height))")
                } else {
                    logger.info("48MP not available, max resolution: \(output.maxPhotoDimensions.width)x\(output.maxPhotoDimensions.height)")
                }
            }

            // Log available formats
            logger.debug("Available photo file types: \(output.availablePhotoFileTypes)")
            if output.availablePhotoFileTypes.contains(.dng) {
                logger.info("DNG format is available")
            }

        } else {
            logger.error("Cannot add photo output")
            captureSession.commitConfiguration()
            errorMessage = "Cannot configure photo output"
            return
        }

        captureSession.commitConfiguration()
        logger.info("Capture session configured successfully")
    }

    /// Starts the capture session. Call after setup.
    func startSession() {
        guard !isSessionRunning else {
            logger.debug("Session already running")
            return
        }

        logger.info("Starting wide-angle capture session")

        let session = captureSession
        let log = logger

        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
            Task { @MainActor in
                self.isSessionRunning = true
                log.info("Wide-angle capture session started")
            }
        }
    }

    /// Stops the capture session. MUST be called before starting ARKit.
    func stopSession() {
        guard isSessionRunning else {
            logger.debug("Session not running")
            return
        }

        logger.info("Stopping wide-angle capture session")

        let session = captureSession
        let log = logger

        DispatchQueue.global(qos: .userInitiated).async {
            session.stopRunning()
            Task { @MainActor in
                self.isSessionRunning = false
                log.info("Wide-angle capture session stopped - camera released for ARKit")
            }
        }
    }

    // MARK: - Capture

    /// Captures a ProRAW reference photo for Stage 1.
    /// - Parameters:
    ///   - angle: The capture angle (left, center, right, custom)
    ///   - sessionId: Scan session ID for organizing files
    /// - Returns: Path to the saved DNG file
    func captureReferencePhoto(angle: CaptureAngle, sessionId: UUID) async throws -> CaptureResult {
        guard let photoOutput = photoOutput else {
            throw CaptureError.notAvailable
        }

        guard !isCapturing else {
            throw CaptureError.alreadyCapturing
        }

        isCapturing = true
        defer { isCapturing = false }

        logger.info("Capturing reference photo at angle: \(angle.displayName)")

        // Create photo settings for maximum quality
        let settings = createPhotoSettings(photoOutput: photoOutput)

        // Create continuation for async capture
        return try await withCheckedThrowingContinuation { continuation in
            let captureId = captureCounter
            captureCounter += 1

            let request = ReferenceCaptureRequest(
                id: captureId,
                angle: angle,
                sessionId: sessionId,
                continuation: continuation
            )
            pendingCaptures[captureId] = request

            // Create delegate and capture
            // FIX: Store delegate to prevent deallocation before callback fires
            let delegate = ReferencePhotoCaptureDelegate(captureId: captureId, service: self)
            activeDelegates[captureId] = delegate
            photoOutput.capturePhoto(with: settings, delegate: delegate)

            logger.debug("Photo capture initiated with ID: \(captureId)")
        }
    }

    private func createPhotoSettings(photoOutput: AVCapturePhotoOutput) -> AVCapturePhotoSettings {
        let settings: AVCapturePhotoSettings

        if #available(iOS 14.3, *), photoOutput.isAppleProRAWSupported && photoOutput.isAppleProRAWEnabled {
            // Use Apple ProRAW for maximum quality
            guard let proRAWFormat = photoOutput.availableRawPhotoPixelFormatTypes.first else {
                logger.warning("No ProRAW format available, falling back to HEIC")
                return createHEICSettings(photoOutput: photoOutput)
            }

            settings = AVCapturePhotoSettings(
                rawPixelFormatType: proRAWFormat,
                processedFormat: [AVVideoCodecKey: AVVideoCodecType.hevc]
            )
            logger.debug("Using ProRAW format")

        } else if photoOutput.availablePhotoFileTypes.contains(.dng) {
            // Use standard DNG RAW
            guard let rawFormat = photoOutput.availableRawPhotoPixelFormatTypes.first else {
                logger.warning("No RAW format available, falling back to HEIC")
                return createHEICSettings(photoOutput: photoOutput)
            }
            settings = AVCapturePhotoSettings(rawPixelFormatType: rawFormat)
            logger.debug("Using standard DNG format")

        } else {
            // Fallback to high-quality HEIC
            return createHEICSettings(photoOutput: photoOutput)
        }

        // Configure for maximum quality (use max supported by device to avoid crash)
        settings.photoQualityPrioritization = photoOutput.maxPhotoQualityPrioritization

        // Set max photo dimensions for 48MP if available
        if #available(iOS 16.0, *) {
            settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        }

        // Flash off for consistent lighting
        settings.flashMode = .off

        return settings
    }

    private func createHEICSettings(photoOutput: AVCapturePhotoOutput) -> AVCapturePhotoSettings {
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
        // Use max supported by device to avoid crash
        settings.photoQualityPrioritization = photoOutput.maxPhotoQualityPrioritization
        if #available(iOS 16.0, *) {
            settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        }
        settings.flashMode = .off
        logger.debug("Using high-quality HEIC format")
        return settings
    }

    // MARK: - Internal Capture Handling

    fileprivate func handleCapturedPhoto(captureId: Int64, photo: AVCapturePhoto?, error: Error?) {
        guard let request = pendingCaptures.removeValue(forKey: captureId) else {
            logger.warning("No pending request for capture ID: \(captureId)")
            return
        }

        if let error = error {
            logger.error("Photo capture failed: \(error)")
            request.continuation.resume(throwing: CaptureError.captureFailed(error.localizedDescription))
            return
        }

        guard let photo = photo else {
            logger.error("No photo data received")
            request.continuation.resume(throwing: CaptureError.noPhotoData)
            return
        }

        // Get photo data
        guard let photoData = photo.fileDataRepresentation() else {
            logger.error("Could not get file data representation")
            request.continuation.resume(throwing: CaptureError.noPhotoData)
            return
        }

        // Extract metadata
        let metadata = extractMetadata(from: photo)

        // Save the photo
        do {
            let result = try savePhoto(
                data: photoData,
                angle: request.angle,
                sessionId: request.sessionId,
                metadata: metadata,
                isProRAW: photo.isRawPhoto
            )

            capturedCount += 1
            logger.info("Reference photo saved: \(result.filePath) (\(result.formattedFileSize))")

            // Create preview image
            if let cgImage = photo.cgImageRepresentation() {
                lastCapturedPreview = UIImage(cgImage: cgImage)
            }

            request.continuation.resume(returning: result)
        } catch {
            logger.error("Failed to save photo: \(error)")
            request.continuation.resume(throwing: error)
        }
    }

    private func extractMetadata(from photo: AVCapturePhoto) -> PhotoMetadata {
        var metadata = PhotoMetadata()

        // Extract from photo metadata
        let photoMetadata = photo.metadata

        // EXIF data
        if let exif = photoMetadata[kCGImagePropertyExifDictionary as String] as? [String: Any] {
            metadata.isoValue = exif[kCGImagePropertyExifISOSpeedRatings as String] as? Int
            metadata.exposureDuration = exif[kCGImagePropertyExifExposureTime as String] as? Double
            metadata.aperture = exif[kCGImagePropertyExifFNumber as String] as? Double
            metadata.focalLength = exif[kCGImagePropertyExifFocalLength as String] as? Double
        }

        // Image dimensions
        metadata.width = photoMetadata[kCGImagePropertyPixelWidth as String] as? Int
        metadata.height = photoMetadata[kCGImagePropertyPixelHeight as String] as? Int

        // Store full EXIF (binary values converted to base64 for JSON compatibility)
        metadata.fullEXIF = convertEXIFToJSONCompatible(photoMetadata)

        // Try to extract camera intrinsics if available
        if #available(iOS 11.0, *) {
            // Note: Camera intrinsics are not directly available from AVCapturePhoto
            // They would need to be computed from focal length and sensor size
            // For now, we'll compute approximate intrinsics from EXIF data
            if let focalLength = metadata.focalLength,
               let width = metadata.width,
               let height = metadata.height {
                // Approximate intrinsics (assuming 35mm equivalent focal length)
                // These should be refined based on actual sensor specifications
                let fx = Float(focalLength * Double(width) / 36.0) // Approximate
                let fy = fx
                let cx = Float(width) / 2.0
                let cy = Float(height) / 2.0

                metadata.intrinsics = simd_float3x3(
                    SIMD3<Float>(fx, 0, 0),
                    SIMD3<Float>(0, fy, 0),
                    SIMD3<Float>(cx, cy, 1)
                )
            }
        }

        return metadata
    }

    private func savePhoto(
        data: Data,
        angle: CaptureAngle,
        sessionId: UUID,
        metadata: PhotoMetadata,
        isProRAW: Bool
    ) throws -> CaptureResult {
        // Determine file extension
        let fileExtension: String
        if data.starts(with: [0x49, 0x49]) || data.starts(with: [0x4D, 0x4D]) {
            fileExtension = "dng"
        } else if data.starts(with: [0xFF, 0xD8, 0xFF]) {
            fileExtension = "jpg"
        } else if data.starts(with: [0x00, 0x00, 0x00]) {
            fileExtension = "heic"
        } else {
            fileExtension = "raw"
        }

        // Create file path in reference_photos subdirectory
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let referencePhotosPath = documentsPath
            .appendingPathComponent("scans")
            .appendingPathComponent(sessionId.uuidString)
            .appendingPathComponent("reference_photos")

        let fileName = "\(angle.rawValue.lowercased())_\(UUID().uuidString).\(fileExtension)"
        let filePath = referencePhotosPath.appendingPathComponent(fileName)

        // Create directory
        try FileManager.default.createDirectory(at: referencePhotosPath, withIntermediateDirectories: true)

        // Write file
        try data.write(to: filePath)

        // Create and save preview thumbnail
        var previewPath: String? = nil
        if let image = UIImage(data: data) {
            let thumbnailSize = CGSize(width: 300, height: 300)
            if let thumbnail = image.preparingThumbnail(of: thumbnailSize) {
                let previewFileName = "\(angle.rawValue.lowercased())_\(UUID().uuidString)_preview.jpg"
                let previewFilePath = referencePhotosPath.appendingPathComponent(previewFileName)
                if let jpegData = thumbnail.jpegData(compressionQuality: 0.8) {
                    try? jpegData.write(to: previewFilePath)
                    previewPath = previewFilePath.path
                }
            }
        }

        return CaptureResult(
            filePath: filePath.path,
            previewPath: previewPath,
            fileSize: Int64(data.count),
            isProRAW: isProRAW,
            metadata: metadata
        )
    }

    // MARK: - Cleanup

    deinit {
        if captureSession.isRunning {
            captureSession.stopRunning()
        }
    }
}

// MARK: - Supporting Types

struct ReferenceCaptureRequest {
    let id: Int64
    let angle: CaptureAngle
    let sessionId: UUID
    let continuation: CheckedContinuation<CaptureResult, Error>
}

struct PhotoMetadata {
    var intrinsics: simd_float3x3?
    var focalLength: Double?
    var isoValue: Int?
    var exposureDuration: Double?
    var aperture: Double?
    var width: Int?
    var height: Int?
    var fullEXIF: [String: Any]?
}

struct CaptureResult {
    let filePath: String
    let previewPath: String?
    let fileSize: Int64
    let isProRAW: Bool
    let metadata: PhotoMetadata

    var formattedFileSize: String {
        ByteCountFormatter.string(fromByteCount: fileSize, countStyle: .file)
    }
}

enum CaptureError: LocalizedError {
    case notAvailable
    case alreadyCapturing
    case captureFailed(String)
    case noPhotoData
    case saveFailed(String)

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Camera is not available"
        case .alreadyCapturing:
            return "A capture is already in progress"
        case .captureFailed(let reason):
            return "Capture failed: \(reason)"
        case .noPhotoData:
            return "No photo data received"
        case .saveFailed(let reason):
            return "Failed to save photo: \(reason)"
        }
    }
}

// MARK: - Helper Functions

/// Convert EXIF metadata to JSON-compatible format (base64 encode binary data)
private func convertEXIFToJSONCompatible(_ metadata: [String: Any]) -> [String: Any] {
    var result: [String: Any] = [:]
    for (key, value) in metadata {
        if let data = value as? Data {
            // Convert binary data to base64 string
            result[key] = data.base64EncodedString()
        } else if let dict = value as? [String: Any] {
            result[key] = convertEXIFToJSONCompatible(dict)
        } else if let array = value as? [[String: Any]] {
            result[key] = array.map { convertEXIFToJSONCompatible($0) }
        } else {
            result[key] = value
        }
    }
    return result
}

// MARK: - Capture Delegate

private class ReferencePhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    let logger = Logger.make(category: LogCategory.wideAngleCapture)
    let captureId: Int64
    weak var service: WideAngleCaptureService?

    init(captureId: Int64, service: WideAngleCaptureService) {
        self.captureId = captureId
        self.service = service
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.error("Error processing photo: \(error)")
        } else {
            let isRaw = photo.isRawPhoto
            logger.debug("Photo processed - isRawPhoto: \(isRaw)")
        }

        Task { @MainActor in
            service?.handleCapturedPhoto(captureId: captureId, photo: photo, error: error)
        }
    }
}
