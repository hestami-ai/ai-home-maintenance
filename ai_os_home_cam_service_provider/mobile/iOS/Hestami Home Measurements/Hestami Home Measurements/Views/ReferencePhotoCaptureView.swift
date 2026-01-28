//
//  ReferencePhotoCaptureView.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import SwiftUI
import SwiftData
import os

/// Stage 1 capture view for capturing high-quality ProRAW reference photos
/// from multiple angles before starting the ARKit scan.
struct ReferencePhotoCaptureView: View {
    let session: ScanSession
    let onComplete: () -> Void

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @StateObject private var captureService = WideAngleCaptureService()

    @State private var capturedAngles: Set<CaptureAngle> = []
    @State private var currentTargetAngle: CaptureAngle = .center
    @State private var showingExitAlert = false
    @State private var showingContinueAlert = false
    @State private var captureError: String?
    @State private var showingError = false
    @State private var isTransitioning = false

    private let logger = Logger.make(category: LogCategory.wideAngleCapture)

    // Minimum required photos before continuing
    private let minimumPhotos = 3

    var body: some View {
        ZStack {
            // Camera preview (full screen)
            CameraPreviewView(session: captureService.session)
                .ignoresSafeArea()

            // Overlay UI
            VStack {
                topBar
                Spacer()
                angleGuidance
                Spacer()
                capturedPhotosStrip
                bottomControls
            }
            .padding()

            // Loading overlay during transition
            if isTransitioning {
                transitionOverlay
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            setupCapture()
        }
        .onDisappear {
            captureService.stopSession()
        }
        .alert("Exit Reference Capture?", isPresented: $showingExitAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Exit", role: .destructive) {
                dismiss()
            }
        } message: {
            Text("You have \(capturedAngles.count) photos captured. Exiting will discard them.")
        }
        .alert("Continue to LiDAR Scan?", isPresented: $showingContinueAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Continue") {
                transitionToARKitScan()
            }
        } message: {
            Text("You've captured \(capturedAngles.count) reference photos. Continue to the LiDAR scanning phase?")
        }
        .alert("Capture Error", isPresented: $showingError) {
            Button("OK") {}
        } message: {
            Text(captureError ?? "An error occurred")
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Close button
            Button {
                if capturedAngles.isEmpty {
                    dismiss()
                } else {
                    showingExitAlert = true
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.title3)
                    .foregroundColor(AppTheme.primaryText)
                    .frame(width: 44, height: 44)
                    .background(AppTheme.overlayMedium)
                    .clipShape(Circle())
            }

            Spacer()

            // Session name badge
            Text(session.name)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(AppTheme.overlayMedium)
                .cornerRadius(8)

            Spacer()

            // Stage indicator
            HStack(spacing: 4) {
                Circle()
                    .fill(AppTheme.primary)
                    .frame(width: 8, height: 8)
                Text("Stage 1")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(AppTheme.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(AppTheme.overlayMedium)
            .cornerRadius(8)
        }
    }

    // MARK: - Angle Guidance

    private var angleGuidance: some View {
        AngleGuidanceCard(
            capturedAngles: capturedAngles,
            currentTargetAngle: $currentTargetAngle
        )
    }

    // MARK: - Captured Photos Strip

    private var capturedPhotosStrip: some View {
        Group {
            if !capturedAngles.isEmpty {
                HStack(spacing: 12) {
                    ForEach(CaptureAngle.standardAngles, id: \.self) { angle in
                        if capturedAngles.contains(angle) {
                            capturedThumbnail(for: angle)
                        } else {
                            emptyThumbnail(for: angle)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(AppTheme.overlayDark.opacity(0.7))
                .cornerRadius(12)
            }
        }
    }

    private func capturedThumbnail(for angle: CaptureAngle) -> some View {
        VStack(spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.success.opacity(0.2))
                    .frame(width: 60, height: 60)

                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .foregroundColor(AppTheme.success)
            }

            Text(angle.displayName)
                .font(.caption2)
                .foregroundColor(AppTheme.secondaryText)
        }
    }

    private func emptyThumbnail(for angle: CaptureAngle) -> some View {
        VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.secondaryText.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4]))
                .frame(width: 60, height: 60)

            Text(angle.displayName)
                .font(.caption2)
                .foregroundColor(AppTheme.disabledText)
        }
    }

    // MARK: - Bottom Controls

    private var bottomControls: some View {
        VStack(spacing: 16) {
            // Status info
            statusInfo

            // Capture button row
            HStack(spacing: 40) {
                // Spacer for centering
                Spacer()

                // Main capture button
                captureButton

                // Continue button or spacer
                if capturedAngles.count >= minimumPhotos {
                    continueButton
                } else {
                    Spacer()
                        .frame(width: 60)
                }
            }
        }
        .padding(.bottom, 20)
    }

    private var statusInfo: some View {
        HStack {
            // ProRAW status
            if captureService.isProRAWAvailable {
                Label("ProRAW", systemImage: "camera.aperture")
                    .font(.caption)
                    .foregroundColor(AppTheme.success)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppTheme.success.opacity(0.2))
                    .cornerRadius(6)
            } else {
                Label("HEIC", systemImage: "photo")
                    .font(.caption)
                    .foregroundColor(AppTheme.warning)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppTheme.warning.opacity(0.2))
                    .cornerRadius(6)
            }

            Spacer()

            // 48MP indicator
            if captureService.is48MPAvailable {
                Text("48MP")
                    .font(.caption)
                    .foregroundColor(AppTheme.info)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppTheme.info.opacity(0.2))
                    .cornerRadius(6)
            }
        }
        .padding(.horizontal)
    }

    private var captureButton: some View {
        Button {
            capturePhoto()
        } label: {
            ZStack {
                // Outer ring
                Circle()
                    .stroke(AppTheme.primaryText, lineWidth: 4)
                    .frame(width: 72, height: 72)

                // Inner fill
                Circle()
                    .fill(AppTheme.primaryText)
                    .frame(width: 60, height: 60)

                // Capturing indicator
                if captureService.isCapturing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.primaryBackground))
                }
            }
        }
        .disabled(captureService.isCapturing || !captureService.isSessionRunning)
    }

    private var continueButton: some View {
        Button {
            showingContinueAlert = true
        } label: {
            VStack(spacing: 4) {
                Image(systemName: "arrow.right.circle.fill")
                    .font(.title)
                    .foregroundColor(AppTheme.success)

                Text("Continue")
                    .font(.caption)
                    .foregroundColor(AppTheme.success)
            }
        }
        .frame(width: 60)
    }

    // MARK: - Transition Overlay

    private var transitionOverlay: some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.primaryText))
                    .scaleEffect(1.5)

                Text("Preparing LiDAR Scanner...")
                    .font(.headline)
                    .foregroundColor(AppTheme.primaryText)

                Text("Releasing camera for ARKit")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
    }

    // MARK: - Actions

    private func setupCapture() {
        logger.info("Setting up Stage 1 reference photo capture")
        captureService.setupCaptureSession()
        captureService.startSession()
    }

    private func capturePhoto() {
        guard !captureService.isCapturing else { return }

        Task {
            do {
                logger.info("Capturing reference photo at angle: \(currentTargetAngle.displayName)")

                let result = try await captureService.captureReferencePhoto(
                    angle: currentTargetAngle,
                    sessionId: session.id
                )

                // Create and save ReferencePhoto model
                let refPhoto = ReferencePhoto(
                    index: capturedAngles.count,
                    angle: currentTargetAngle
                )
                refPhoto.dngFilePath = result.filePath
                refPhoto.jpegPreviewPath = result.previewPath
                refPhoto.fileSize = result.fileSize
                refPhoto.isProRAW = result.isProRAW
                refPhoto.focalLength = result.metadata.focalLength
                refPhoto.isoValue = result.metadata.isoValue
                refPhoto.exposureDuration = result.metadata.exposureDuration
                refPhoto.aperture = result.metadata.aperture
                refPhoto.imageWidth = result.metadata.width
                refPhoto.imageHeight = result.metadata.height

                if let intrinsics = result.metadata.intrinsics {
                    refPhoto.setIntrinsics(intrinsics)
                }
                if let exif = result.metadata.fullEXIF {
                    refPhoto.setEXIFMetadata(exif)
                }

                refPhoto.scanSession = session
                modelContext.insert(refPhoto)

                // Save context to persist reference photo
                try? modelContext.save()

                // Update session
                session.referencePhotoCount = capturedAngles.count + 1

                // Track captured angle
                capturedAngles.insert(currentTargetAngle)

                logger.info("Reference photo saved successfully: \(result.formattedFileSize)")

                // Auto-advance to next uncaptured angle
                advanceToNextAngle()

            } catch {
                logger.error("Failed to capture reference photo: \(error)")
                captureError = error.localizedDescription
                showingError = true
            }
        }
    }

    private func advanceToNextAngle() {
        // Find next uncaptured standard angle
        for angle in CaptureAngle.standardAngles {
            if !capturedAngles.contains(angle) {
                currentTargetAngle = angle
                return
            }
        }
        // All standard angles captured - stay on current or switch to custom
        if capturedAngles.count >= minimumPhotos {
            currentTargetAngle = .custom
        }
    }

    private func transitionToARKitScan() {
        isTransitioning = true

        // CRITICAL: Stop the camera session before transitioning to ARKit
        logger.info("Stopping wide-angle capture session for ARKit transition")
        captureService.stopSession()

        // Small delay to ensure camera is fully released
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            // Update session state
            session.workflowStage = .arkitScan
            session.referencePhotoCaptureComplete = true

            logger.info("Transitioning to Stage 2 (ARKit + LiDAR scan)")

            // Trigger navigation to ScanView
            onComplete()
        }
    }
}

// MARK: - Preview

#Preview {
    ReferencePhotoCaptureView(
        session: ScanSession(name: "Test Scan"),
        onComplete: {}
    )
}
