//
//  RoomPlanView.swift
//  My Home Agent
//
//  Created by Cascade AI on 4/16/25.
//

import SwiftUI
import RoomPlan
import AVFoundation
import CoreHaptics
import OSLog

struct RoomPlanView: View {
    @State private var isScanning = false
    @State private var capturedRoom: CapturedRoom?
    @State private var showExportSheet = false
    @State private var exportURL: URL?
    @State private var showPermissionAlert = false
    @State private var permissionAlertMessage = ""
    @State private var showSaveDialog = false
    @State private var scanName = ""
    @State private var selectedPropertyId: String?
    @State private var isSaving = false
    @State private var showUploadDialog = false
    @State private var isUploading = false
    @State private var savedScan: RoomScan?
    @State private var showSavedScansView = false
    @State private var showRoomCaptureView = false
    @State private var isProcessingScan = false
    
    let propertyId: String?
    
    init(propertyId: String? = nil) {
        self.propertyId = propertyId
        _selectedPropertyId = State(initialValue: propertyId)
    }
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 24) {
                if let capturedRoom = capturedRoom {
                    scanCompleteView(capturedRoom: capturedRoom)
                } else {
                    idleView
                }
            }
            .padding()
        }
        .fullScreenCover(isPresented: $showRoomCaptureView) {
            RoomCaptureModalView(capturedRoom: $capturedRoom, isPresented: $showRoomCaptureView, isProcessing: $isProcessingScan)
        }
        .navigationTitle("Room Scan")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showSavedScansView = true }) {
                    Image(systemName: "folder")
                        .foregroundColor(AppTheme.accentColor)
                }
            }
        }
        .sheet(isPresented: $showExportSheet, content: {
            if let exportURL = exportURL {
                ActivityView(activityItems: [exportURL])
            }
        })
        .alert("Camera Permission Required", isPresented: $showPermissionAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(permissionAlertMessage)
        }
        .sheet(isPresented: $showSaveDialog) {
            SaveScanDialog(
                scanName: $scanName,
                selectedPropertyId: $selectedPropertyId,
                onSave: { name, propId in
                    Task {
                        await saveScan(name: name, propertyId: propId)
                    }
                },
                onCancel: {
                    showSaveDialog = false
                }
            )
        }
        .sheet(isPresented: $showUploadDialog) {
            UploadScanDialog(
                scan: savedScan,
                onUpload: { propId in
                    Task {
                        await uploadScan(propertyId: propId)
                    }
                },
                onCancel: {
                    showUploadDialog = false
                }
            )
        }
        .sheet(isPresented: $showSavedScansView) {
            SavedRoomScansView()
        }
    }
    
    // MARK: - View Components
    
    private func scanCompleteView(capturedRoom: CapturedRoom) -> some View {
        VStack(spacing: 20) {
            Text("Room scan complete!")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.buttonBackground)
            
            if savedScan != nil {
                Text("Scan saved successfully")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.green)
                    .multilineTextAlignment(.center)
            } else {
                Text("Save your scan to access it later")
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                    .multilineTextAlignment(.center)
            }
            
            if savedScan == nil {
                Button(action: { showSaveDialog = true }) {
                    Label("Save Scan", systemImage: "square.and.arrow.down")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.buttonText)
                        .padding()
                        .frame(width: 220)
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(10)
                }
                .disabled(isSaving)
            } else {
                Button(action: { showUploadDialog = true }) {
                    Label("Upload to Cloud", systemImage: "icloud.and.arrow.up")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.buttonText)
                        .padding()
                        .frame(width: 220)
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(10)
                }
                .disabled(isUploading || savedScan?.uploadStatus == .uploaded)
            }
            
            Button(action: { exportUSDZ(room: capturedRoom) }) {
                Label("Export as USDZ", systemImage: "square.and.arrow.up")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.buttonText)
                    .padding()
                    .frame(width: 220)
                    .background(AppTheme.buttonBackground)
                    .cornerRadius(10)
            }
            
            Button(action: { 
                self.capturedRoom = nil
                savedScan = nil
            }) {
                Label("New Scan", systemImage: "arrow.counterclockwise")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.buttonText)
                    .padding()
                    .frame(width: 220)
                    .background(AppTheme.accentColor)
                    .cornerRadius(10)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var idleView: some View {
        VStack(spacing: 30) {
            Image(systemName: "house.fill")
                .font(.system(size: 70))
                .foregroundColor(AppTheme.buttonBackground)
            Text("Press Start to begin scanning your property")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
            Button(action: checkCameraPermissionAndStart) {
                Text("Start Scanning")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.buttonText)
                    .padding()
                    .frame(width: 200)
                    .background(AppTheme.buttonBackground)
                    .cornerRadius(10)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    // MARK: - Actions
    
    private func checkCameraPermissionAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showRoomCaptureView = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showRoomCaptureView = true
                    } else {
                        permissionAlertMessage = "Camera access is required to scan your room."
                        showPermissionAlert = true
                    }
                }
            }
        default:
            permissionAlertMessage = "Camera access is required to scan your room. Please enable it in Settings."
            showPermissionAlert = true
        }
    }
    
    private func exportUSDZ(room: CapturedRoom) {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("RoomScan.usdz")
        do {
            try room.export(to: tempURL)
            exportURL = tempURL
            showExportSheet = true
        } catch {
            permissionAlertMessage = "Failed to export USDZ file: \(error.localizedDescription)"
            showPermissionAlert = true
        }
    }
    
    private func exportImage(room: CapturedRoom) {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("RoomScan.png")
        do {
            // Create a screenshot of the current view instead
            let renderer = UIGraphicsImageRenderer(bounds: UIScreen.main.bounds)
            let image = renderer.image { _ in
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let window = windowScene.windows.first {
                    window.rootViewController?.view.drawHierarchy(in: UIScreen.main.bounds, afterScreenUpdates: true)
                }
            }
            if let data = image.pngData() {
                try data.write(to: tempURL)
                exportURL = tempURL
                showExportSheet = true
            } else {
                permissionAlertMessage = "Failed to generate image data."
                showPermissionAlert = true
            }
        } catch {
            permissionAlertMessage = "Failed to export image: \(error.localizedDescription)"
            showPermissionAlert = true
        }
    }
    
    private func saveScan(name: String, propertyId: String?) async {
        guard let capturedRoom = capturedRoom else {
            AppLogger.roomScan.error("No captured room to save")
            return
        }
        
        AppLogger.roomScan.info("Starting to save scan '\(name, privacy: .public)'")
        isSaving = true
        showSaveDialog = false
        
        do {
            let scan = try await RoomScanStorageService.shared.saveRoomScan(
                capturedRoom: capturedRoom,
                name: name,
                propertyId: propertyId
            )
            
            AppLogger.roomScan.info("Scan saved successfully with ID \(scan.id, privacy: .public)")
            
            await MainActor.run {
                self.savedScan = scan
                self.isSaving = false
                // Skip haptic - can cause hangs
            }
        } catch {
            AppLogger.error("Failed to save scan", error: error, category: AppLogger.roomScan)
            await MainActor.run {
                self.isSaving = false
                self.permissionAlertMessage = "Failed to save scan: \(error.localizedDescription)"
                self.showPermissionAlert = true
                // Skip haptic - can cause hangs
            }
        }
    }
    
    private func uploadScan(propertyId: String) async {
        guard let scan = savedScan else { return }
        
        isUploading = true
        showUploadDialog = false
        
        do {
            _ = try await RoomScanUploadService.shared.uploadRoomScan(
                scan: scan,
                propertyId: propertyId
            )
            
            // Reload the scan to get updated status
            if let updatedScan = RoomScanStorageService.shared.getScan(byId: scan.id) {
                await MainActor.run {
                    self.savedScan = updatedScan
                    self.isUploading = false
                    // Skip haptic - can cause hangs
                }
            }
        } catch {
            await MainActor.run {
                self.isUploading = false
                self.permissionAlertMessage = "Failed to upload scan: \(error.localizedDescription)"
                self.showPermissionAlert = true
                // Skip haptic - can cause hangs
            }
        }
    }
}

// MARK: - RoomCaptureModalView: Modal presentation using RoomPlan's built-in view controller

class RoomCaptureCoordinator: NSObject, RoomCaptureSessionDelegate, NSCoding {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var isPresented: Bool
    @Binding var isProcessing: Bool
    var captureSession: RoomCaptureSession?
    private var latestCapturedRoom: CapturedRoom?
    weak var viewController: RoomCaptureWrapperViewController?
    private var hasReceivedFirstInstruction = false
    
    init(capturedRoom: Binding<CapturedRoom?>, isPresented: Binding<Bool>, isProcessing: Binding<Bool>) {
        _capturedRoom = capturedRoom
        _isPresented = isPresented
        _isProcessing = isProcessing
        super.init()
        AppLogger.roomScan.debug("Coordinator initialized")
    }
    
    // NSCoding required methods (not actually used, but required for compilation)
    required init?(coder: NSCoder) {
        // This should never be called since we're not using storyboards
        AppLogger.roomScan.error("NSCoding init(coder:) called unexpectedly - not supported")
        return nil
    }
    
    func encode(with coder: NSCoder) {
        // This should never be called since we're not using storyboards
        AppLogger.roomScan.error("NSCoding encode(with:) called unexpectedly - not supported")
    }
    
    deinit {
        AppLogger.roomScan.debug("Coordinator deinit")
    }
    
    @objc func doneButtonTapped() {
        AppLogger.roomScan.debug("Done button tapped - finishing immediately")
        AppLogger.roomScan.debug("Current state: captureSession=\(self.captureSession != nil, privacy: .public), latestCapturedRoom=\(self.latestCapturedRoom != nil, privacy: .public)")
        
        // Use the latest captured room immediately instead of waiting for stop callback
        DispatchQueue.main.async {
            if let room = self.latestCapturedRoom {
                AppLogger.roomScan.debug("Using latest captured room immediately")
                self.capturedRoom = room
            } else {
                AppLogger.roomScan.warning("No room captured")
                self.capturedRoom = nil
            }
            
            AppLogger.roomScan.debug("Dismissing modal immediately")
            self.isPresented = false
            
            // Skip haptic feedback - it can cause 30+ second hangs when initializing the haptic engine
            // The visual feedback of dismissal is sufficient
        }
        
        // Stop session in background (don't wait for it)
        DispatchQueue.global(qos: .background).async {
            self.captureSession?.stop()
            AppLogger.roomScan.debug("Stop called on capture session (background)")
        }
    }
    
    // RoomCaptureSessionDelegate methods
    func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didUpdate called")
        AppLogger.roomScan.debug("Room has \(room.walls.count, privacy: .public) walls, \(room.doors.count, privacy: .public) doors, \(room.windows.count, privacy: .public) windows")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didEndWith called")
        if let error = error {
            AppLogger.roomScan.error("Error: \(error.localizedDescription, privacy: .public)")
        }
        AppLogger.roomScan.debug("Latest room: \(self.latestCapturedRoom != nil ? "present" : "nil", privacy: .public)")
        
        DispatchQueue.main.async {
            // Hide processing indicator
            self.isProcessing = false
            
            if let error = error {
                AppLogger.roomScan.error("Capture session ended with error: \(error.localizedDescription, privacy: .public)")
                // Skip haptic - causes 30+ second hangs
                self.capturedRoom = nil
            } else if let room = self.latestCapturedRoom {
                AppLogger.roomScan.info("Using latest captured room with \(room.walls.count, privacy: .public) walls")
                // Skip haptic - causes 30+ second hangs
                self.capturedRoom = room
            } else {
                AppLogger.roomScan.warning("No room captured")
                // Skip haptic - causes 30+ second hangs
                self.capturedRoom = nil
            }
            
            AppLogger.roomScan.debug("Dismissing modal - setting isPresented = false")
            self.isPresented = false
        }
    }
    
    func captureSession(_ session: RoomCaptureSession, didAdd room: CapturedRoom) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didAdd called")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didChange room: CapturedRoom) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didChange called")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didRemove room: CapturedRoom) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didRemove called")
    }
    
    func captureSession(_ session: RoomCaptureSession, didProvide instruction: RoomCaptureSession.Instruction) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didProvide instruction")
        
        // Hide overlay on first instruction - camera is now fully ready
        if !hasReceivedFirstInstruction {
            hasReceivedFirstInstruction = true
            AppLogger.roomScan.debug("First instruction received - camera is ready, hiding overlay")
            DispatchQueue.main.async {
                self.viewController?.hideInitializingOverlay()
            }
        }
    }
    
    func captureSession(_ session: RoomCaptureSession, didStartWith configuration: RoomCaptureSession.Configuration) {
        AppLogger.roomScan.debug("SESSION DELEGATE: didStartWith configuration")
        AppLogger.roomScan.debug("Session started, waiting for first instruction to confirm camera is ready")
    }
}

struct RoomCaptureModalView: UIViewControllerRepresentable {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var isPresented: Bool
    @Binding var isProcessing: Bool
    
    func makeUIViewController(context: Context) -> RoomCaptureWrapperViewController {
        AppLogger.roomScan.debug("Creating RoomCaptureWrapperViewController")
        let wrapper = RoomCaptureWrapperViewController()
        wrapper.coordinator = context.coordinator
        return wrapper
    }
    
    func updateUIViewController(_ uiViewController: RoomCaptureWrapperViewController, context: Context) {
        // Update processing overlay
        uiViewController.setProcessing(context.coordinator.isProcessing)
    }
    
    func makeCoordinator() -> RoomCaptureCoordinator {
        RoomCaptureCoordinator(capturedRoom: $capturedRoom, isPresented: $isPresented, isProcessing: $isProcessing)
    }
}

// Wrapper view controller using RoomCaptureSession directly
class RoomCaptureWrapperViewController: UIViewController {
    var coordinator: RoomCaptureCoordinator?
    private var captureView: RoomPlan.RoomCaptureView!
    private var captureSession: RoomCaptureSession!
    private var processingOverlay: UIView?
    private var activityIndicator: UIActivityIndicatorView?
    
    func setProcessing(_ isProcessing: Bool) {
        if isProcessing {
            showProcessingOverlay()
        } else {
            hideProcessingOverlay()
        }
    }
    
    private func showProcessingOverlay() {
        guard processingOverlay == nil else { return }
        
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.color = .white
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.startAnimating()
        overlay.addSubview(indicator)
        
        let label = UILabel()
        label.text = "Processing scan..."
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(label)
        
        NSLayoutConstraint.activate([
            indicator.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            indicator.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -20),
            label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            label.topAnchor.constraint(equalTo: indicator.bottomAnchor, constant: 16)
        ])
        
        view.addSubview(overlay)
        processingOverlay = overlay
        activityIndicator = indicator
    }
    
    private func hideProcessingOverlay() {
        processingOverlay?.removeFromSuperview()
        processingOverlay = nil
        activityIndicator = nil
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        AppLogger.roomScan.debug("RoomCaptureWrapperViewController viewDidLoad")
        
        // Create capture view first
        captureView = RoomPlan.RoomCaptureView(frame: view.bounds)
        captureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(captureView)
        
        // Use the capture view's session and set our coordinator as delegate
        captureSession = captureView.captureSession
        captureSession.delegate = coordinator
        coordinator?.captureSession = captureSession
        coordinator?.viewController = self
        
        AppLogger.roomScan.debug("Capture view created and connected to session")
        AppLogger.roomScan.debug("Session delegate set: \(String(describing: self.captureSession.delegate), privacy: .public)")
        
        // Add Done button
        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.backgroundColor = UIColor.systemBlue
        doneButton.layer.cornerRadius = 8
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        view.addSubview(doneButton)
        
        NSLayoutConstraint.activate([
            doneButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            doneButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            doneButton.widthAnchor.constraint(equalToConstant: 80),
            doneButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Show loading overlay immediately
        showInitializingOverlay()
        
        AppLogger.roomScan.info("Starting room capture session with SESSION DELEGATE")
        let config = RoomCaptureSession.Configuration()
        captureSession.run(configuration: config)
        AppLogger.roomScan.info("Room capture session started")
        AppLogger.roomScan.debug("Session delegate: \(self.captureSession.delegate != nil ? "YES" : "NO", privacy: .public)")
        
        // Safety timeout: hide overlay after 15 seconds if still showing (didStartWith should hide it much sooner)
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            self?.hideInitializingOverlay()
        }
    }
    
    private func showInitializingOverlay() {
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.tag = 9999 // Tag to identify and remove later
        
        let activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.color = .white
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.startAnimating()
        overlay.addSubview(activityIndicator)
        
        let label = UILabel()
        label.text = "Initializing Camera..."
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(label)
        
        let sublabel = UILabel()
        sublabel.text = "This may take 10-15 seconds on first launch"
        sublabel.textColor = UIColor.white.withAlphaComponent(0.7)
        sublabel.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        sublabel.textAlignment = .center
        sublabel.numberOfLines = 2
        sublabel.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(sublabel)
        
        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -30),
            label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            label.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 20),
            sublabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            sublabel.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 8),
            sublabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 40),
            sublabel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -40)
        ])
        
        view.addSubview(overlay)
    }
    
    
    func hideInitializingOverlay() {
        guard view.viewWithTag(9999) != nil else {
            AppLogger.roomScan.debug("Overlay already hidden")
            return
        }
        
        AppLogger.roomScan.debug("Hiding initialization overlay")
        
        if let overlay = view.viewWithTag(9999) {
            UIView.animate(withDuration: 0.3, animations: {
                overlay.alpha = 0
            }) { _ in
                overlay.removeFromSuperview()
                AppLogger.roomScan.debug("Overlay removed from view")
            }
        }
    }
    
    @objc private func doneButtonTapped() {
        AppLogger.roomScan.debug("Done button tapped")
        coordinator?.doneButtonTapped()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        AppLogger.roomScan.debug("View will disappear - session already stopped in background")
        // Don't call stop() here - it's already being called in background from doneButtonTapped()
        // Calling stop() on main thread blocks UI for 20+ seconds
    }
    
    deinit {
        AppLogger.roomScan.debug("RoomCaptureWrapperViewController deinit")
    }
}

// MARK: - RoomCaptureViewController: UIKit wrapper for RoomCaptureView

protocol RoomCaptureViewControllerDelegate: AnyObject {
    func captureViewController(_ controller: RoomCaptureViewController, didFinishWith room: CapturedRoom?)
    func captureViewControllerDidCancel(_ controller: RoomCaptureViewController)
}

class RoomCaptureViewController: UIViewController {
    weak var delegate: RoomCaptureViewControllerDelegate?
    private var roomCaptureView: RoomPlan.RoomCaptureView!
    private var latestCapturedRoom: CapturedRoom?
    
    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        AppLogger.roomScan.debug("Setting up RoomCaptureView...")
        
        roomCaptureView = RoomPlan.RoomCaptureView()
        roomCaptureView.delegate = self
        roomCaptureView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(roomCaptureView)
        
        NSLayoutConstraint.activate([
            roomCaptureView.topAnchor.constraint(equalTo: view.topAnchor),
            roomCaptureView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            roomCaptureView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            roomCaptureView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Add Done button
        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.backgroundColor = UIColor.systemBlue
        doneButton.layer.cornerRadius = 8
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        view.addSubview(doneButton)
        
        NSLayoutConstraint.activate([
            doneButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            doneButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            doneButton.widthAnchor.constraint(equalToConstant: 80),
            doneButton.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        AppLogger.roomScan.debug("Delegate set to: \(String(describing: self.roomCaptureView.delegate), privacy: .public)")
        AppLogger.roomScan.debug("RoomCaptureView setup complete")
    }
    
    @objc private func doneButtonTapped() {
        AppLogger.roomScan.debug("Done button tapped - stopping session")
        roomCaptureView.captureSession.stop(pauseARSession: true)
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        AppLogger.roomScan.info("Starting room capture session")
        let config = RoomCaptureSession.Configuration()
        roomCaptureView.captureSession.run(configuration: config)
        AppLogger.roomScan.info("Room capture session started")
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        AppLogger.roomScan.debug("View will disappear - stopping session")
        roomCaptureView.captureSession.stop(pauseARSession: true)
    }
    
    deinit {
        AppLogger.roomScan.debug("RoomCaptureViewController deinit")
        roomCaptureView?.delegate = nil
    }
}

extension RoomCaptureViewController: RoomCaptureViewDelegate {
    // This delegate method is called during scanning to provide updates
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didUpdate room: CapturedRoom) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didUpdate called - storing latest room")
        latestCapturedRoom = room
    }
    
    // This is called when the scan completes (user stops or session ends)
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didEndWith data: CapturedRoomData, error: Error?) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didEndWith CapturedRoomData called")
        
        if let error = error {
            AppLogger.roomScan.error("Room capture ended with error: \(error.localizedDescription, privacy: .public)")
            // Skip haptic - causes 30+ second hangs
            delegate?.captureViewController(self, didFinishWith: nil)
        } else {
            AppLogger.roomScan.info("Room capture ended successfully")
            
            // Use the latest captured room from didUpdate
            if let room = latestCapturedRoom {
                AppLogger.roomScan.debug("Using latestCapturedRoom from didUpdate")
                // Skip haptic - causes 30+ second hangs
                delegate?.captureViewController(self, didFinishWith: room)
            } else {
                AppLogger.roomScan.warning("No latestCapturedRoom available")
                // Skip haptic - causes 30+ second hangs
                delegate?.captureViewController(self, didFinishWith: nil)
            }
        }
    }
    
    // This is called when a room is added
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didAdd room: CapturedRoom) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didAdd called - storing room")
        latestCapturedRoom = room
    }
    
    // This is called when a room is removed
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didRemove room: CapturedRoom) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didRemove called")
    }
    
    // This is called when a room is changed
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didChange room: CapturedRoom) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didChange called - storing room")
        latestCapturedRoom = room
    }
    
    // This is called to provide instructions
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didProvide instruction: RoomCaptureSession.Instruction) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didProvide instruction: \(String(describing: instruction), privacy: .public)")
    }
    
    // This is called when scanning starts
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didStartWith configuration: RoomCaptureSession.Configuration) {
        AppLogger.roomScan.debug("RoomCaptureDelegate: didStartWith configuration")
    }
}

// MARK: - ActivityView for sharing/exporting

import UIKit
struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]
    let applicationActivities: [UIActivity]? = nil
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
