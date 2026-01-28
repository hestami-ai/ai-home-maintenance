//
//  RawPhotoCaptureService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import os
@preconcurrency import AVFoundation
import Combine
import UIKit

/// Service that captures raw DNG photos.
/// NOTE: ProRAW is ONLY supported on the wide-angle camera (builtInWideAngleCamera).
/// ARKit also requires the wide-angle camera for world tracking.
/// Therefore, ProRAW capture CANNOT run simultaneously with ARKit session.
///
/// Design options:
/// 1. PRE-CAPTURE: Capture ProRAW reference photos BEFORE starting ARKit session
/// 2. POST-CAPTURE: Capture ProRAW reference photos AFTER stopping ARKit session
/// 3. HYBRID: Use ARKit's captured images during scanning, capture ProRAW at end
///
/// This service is designed for PRE/POST capture phases, NOT concurrent with ARKit.
@MainActor
class RawPhotoCaptureService: NSObject, ObservableObject {
    private let logger = Logger.make(category: LogCategory.rawPhotoCapture)

    // MARK: - Published Properties

    @Published var isAvailable = false
    @Published var isProRAWAvailable = false
    @Published var isCapturing = false

    // MARK: - Private Properties

    private let captureSession = AVCaptureSession()
    private var photoOutput: AVCapturePhotoOutput?
    private var videoDevice: AVCaptureDevice?

    // Photo capture tracking
    private var pendingCaptures: [Int64: PhotoCaptureRequest] = [:]
    private var captureCounter: Int64 = 0

    // MARK: - Initialization

    override init() {
        super.init()
        logger.debug("RawPhotoCaptureService initialized")
    }

    // MARK: - Setup

    func setupCaptureSession() {
        logger.debug("Setting up capture session")

        // IMPORTANT: ARKit already controls the camera session.
        // On multi-camera devices (iPhone 11 Pro+), we can use a separate camera.
        // On single-camera devices, we cannot run a parallel session.
        // We'll attempt setup and gracefully fail if ARKit has exclusive control.

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
            isAvailable = false
        }
    }

    private func configureCaptureSession() {
        captureSession.beginConfiguration()

        // Set session preset for highest quality
        if captureSession.canSetSessionPreset(.photo) {
            captureSession.sessionPreset = .photo
        }

        // IMPORTANT: ARKit uses the wide-angle camera, so we need to use a DIFFERENT camera
        // to avoid conflicts. Try ultra-wide first (available on iPhone 11 Pro+), then telephoto.
        // If no secondary camera available, this service won't work on that device.
        var camera: AVCaptureDevice?

        if #available(iOS 13.0, *) {
            // Try ultra-wide camera first
            camera = AVCaptureDevice.default(.builtInUltraWideCamera, for: .video, position: .back)
            if camera != nil {
                logger.debug("Using ultra-wide camera (ARKit uses wide)")
            }
        }

        // Fallback to telephoto if ultra-wide not available
        if camera == nil {
            camera = AVCaptureDevice.default(.builtInTelephotoCamera, for: .video, position: .back)
            if camera != nil {
                logger.debug("Using telephoto camera (ARKit uses wide)")
            }
        }

        // If still no camera, this device doesn't support parallel capture
        guard let captureCamera = camera else {
            logger.warning("No secondary camera available")
            logger.warning("ARKit owns the wide camera, cannot run parallel session")
            logger.warning("Raw DNG capture requires multi-camera device (iPhone 11 Pro+)")
            captureSession.commitConfiguration()
            isAvailable = false
            return
        }

        videoDevice = captureCamera

        // Add camera input
        do {
            let input = try AVCaptureDeviceInput(device: captureCamera)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
                logger.debug("Camera input added")
            } else {
                logger.warning("Cannot add camera input")
                captureSession.commitConfiguration()
                isAvailable = false
                return
            }
        } catch {
            logger.error("Error creating camera input: \(error)")
            captureSession.commitConfiguration()
            isAvailable = false
            return
        }

        // Add photo output
        let output = AVCapturePhotoOutput()
        if captureSession.canAddOutput(output) {
            captureSession.addOutput(output)
            photoOutput = output
            logger.debug("Photo output added")

            // Check for DNG/RAW support on the current camera
            // NOTE: ProRAW is only supported on the wide-angle camera, but we're using
            // ultra-wide or telephoto to avoid conflicting with ARKit's camera session.
            if output.availablePhotoFileTypes.contains(.dng) {
                isProRAWAvailable = true
                logger.info("DNG/RAW capture is available on this camera")

                // Enable Apple ProRAW if supported (iPhone 12 Pro and newer)
                if #available(iOS 14.3, *) {
                    if output.isAppleProRAWSupported {
                        output.isAppleProRAWEnabled = true
                        logger.info("Apple ProRAW enabled")
                    }
                }
            } else {
                isProRAWAvailable = false
                logger.info("DNG/RAW capture not available on the secondary camera (ultra-wide/telephoto)")
                logger.info("This is expected - ProRAW only works on the wide-angle camera which ARKit uses")
                logger.info("Will capture high-quality HEIC instead")
            }

            isAvailable = true
        } else {
            logger.warning("Cannot add photo output")
            isAvailable = false
        }

        captureSession.commitConfiguration()

        // Start the session on a background thread
        let session = captureSession
        let log = logger
        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
            Task { @MainActor in
                log.debug("Capture session started")
            }
        }
    }

    // MARK: - Capture

    /// Captures a raw DNG photo
    /// - Parameters:
    ///   - name: Base name for the file (without extension)
    ///   - sessionId: Scan session ID for organizing files
    ///   - completion: Called when capture completes with file path or error
    func captureRawPhoto(name: String, sessionId: UUID, completion: @escaping (Result<String, Error>) -> Void) {
        guard isAvailable, let photoOutput = photoOutput else {
            completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Photo capture not available"])))
            return
        }

        guard !isCapturing else {
            logger.warning("Already capturing, skipping")
            completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 2, userInfo: [NSLocalizedDescriptionKey: "Already capturing"])))
            return
        }

        isCapturing = true

        // Create photo settings
        let settings: AVCapturePhotoSettings

        if #available(iOS 14.3, *), photoOutput.isAppleProRAWSupported && photoOutput.isAppleProRAWEnabled {
            // Use Apple ProRAW (includes DNG + processed image)
            guard let proRAWFormat = photoOutput.availableRawPhotoPixelFormatTypes.first else {
                isCapturing = false
                completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 3, userInfo: [NSLocalizedDescriptionKey: "No ProRAW format available"])))
                return
            }
            settings = AVCapturePhotoSettings(rawPixelFormatType: proRAWFormat, processedFormat: [AVVideoCodecKey: AVVideoCodecType.hevc])
        } else if photoOutput.availablePhotoFileTypes.contains(.dng) {
            // Use standard RAW DNG
            guard let rawFormat = photoOutput.availableRawPhotoPixelFormatTypes.first else {
                isCapturing = false
                completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 4, userInfo: [NSLocalizedDescriptionKey: "No RAW format available"])))
                return
            }
            settings = AVCapturePhotoSettings(rawPixelFormatType: rawFormat)
        } else {
            // Fallback to HEIF/JPEG high quality
            settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.hevc])
            // Use highest quality available, but don't exceed maxPhotoQualityPrioritization
            settings.photoQualityPrioritization = photoOutput.maxPhotoQualityPrioritization
        }

        // Configure settings
        if photoOutput.isFlashScene {
            settings.flashMode = .auto
        } else {
            settings.flashMode = .off
        }

        // Create capture request
        let captureId = captureCounter
        captureCounter += 1

        let request = PhotoCaptureRequest(
            id: captureId,
            name: name,
            sessionId: sessionId,
            completion: completion
        )
        pendingCaptures[captureId] = request

        logger.debug("Capturing photo #\(captureId) with name '\(name)'")

        // Create delegate for this capture
        let delegate = PhotoCaptureDelegate(captureId: captureId, service: self)

        // Capture the photo
        photoOutput.capturePhoto(with: settings, delegate: delegate)
    }

    // MARK: - Internal

    fileprivate func handleCapturedPhoto(captureId: Int64, photoData: Data?, error: Error?) {
        guard let request = pendingCaptures[captureId] else {
            logger.warning("No pending request for capture #\(captureId)")
            isCapturing = false
            return
        }

        pendingCaptures.removeValue(forKey: captureId)
        isCapturing = false

        if let error = error {
            logger.error("Capture failed: \(error)")
            request.completion(.failure(error))
            return
        }

        guard let data = photoData else {
            logger.error("No photo data received")
            request.completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 5, userInfo: [NSLocalizedDescriptionKey: "No photo data"])))
            return
        }

        // Save to disk
        let filePath = savePhotoData(data, name: request.name, sessionId: request.sessionId)

        if let filePath = filePath {
            let sizeStr = ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)
            logger.debug("Saved raw photo: \(filePath) (size: \(sizeStr))")
            request.completion(.success(filePath))
        } else {
            logger.error("Failed to save photo data")
            request.completion(.failure(NSError(domain: "RawPhotoCaptureService", code: 6, userInfo: [NSLocalizedDescriptionKey: "Failed to save photo"])))
        }
    }

    private func savePhotoData(_ data: Data, name: String, sessionId: UUID) -> String? {
        // Determine file extension based on data
        let fileExtension: String
        if data.starts(with: [0x49, 0x49]) || data.starts(with: [0x4D, 0x4D]) { // TIFF magic numbers
            fileExtension = "dng"
        } else if data.starts(with: [0xFF, 0xD8, 0xFF]) { // JPEG magic
            fileExtension = "jpg"
        } else if data.starts(with: [0x00, 0x00, 0x00]) { // HEIC/HEIF
            fileExtension = "heic"
        } else {
            fileExtension = "raw"
        }

        // Create file path
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let scansPath = documentsPath.appendingPathComponent("scans/\(sessionId.uuidString)")
        let filePath = scansPath.appendingPathComponent("\(name)_raw.\(fileExtension)")

        // Create directory if needed
        try? FileManager.default.createDirectory(at: scansPath, withIntermediateDirectories: true)

        // Write file
        do {
            try data.write(to: filePath)
            return filePath.path
        } catch {
            logger.error("Error writing file: \(error)")
            return nil
        }
    }

    // MARK: - Cleanup

    func stop() {
        logger.debug("Stopping capture session")
        captureSession.stopRunning()
    }
}

// MARK: - Supporting Types

private struct PhotoCaptureRequest {
    let id: Int64
    let name: String
    let sessionId: UUID
    let completion: (Result<String, Error>) -> Void
}

private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    let logger = Logger.make(category: LogCategory.rawPhotoCapture)
    let captureId: Int64
    weak var service: RawPhotoCaptureService?

    init(captureId: Int64, service: RawPhotoCaptureService) {
        self.captureId = captureId
        self.service = service
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            logger.error("Error processing photo: \(error)")
            Task { @MainActor in
                service?.handleCapturedPhoto(captureId: captureId, photoData: nil, error: error)
            }
            return
        }

        // Try to get DNG data first, then fall back to processed photo
        let photoData = photo.fileDataRepresentation()

        if let data = photoData {
            let sizeStr = ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file)
            logger.debug("Photo processed successfully (size: \(sizeStr))")
        } else {
            logger.warning("No photo data available")
        }

        Task { @MainActor in
            service?.handleCapturedPhoto(captureId: captureId, photoData: photoData, error: nil)
        }
    }
}
