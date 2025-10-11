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
            RoomCaptureModalView(capturedRoom: $capturedRoom, isPresented: $showRoomCaptureView)
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
        guard let capturedRoom = capturedRoom else { return }
        
        isSaving = true
        showSaveDialog = false
        
        do {
            let scan = try await RoomScanStorageService.shared.saveRoomScan(
                capturedRoom: capturedRoom,
                name: name,
                propertyId: propertyId
            )
            
            await MainActor.run {
                self.savedScan = scan
                self.isSaving = false
                HapticManager.shared.playNotificationFeedback(type: .success)
            }
        } catch {
            await MainActor.run {
                self.isSaving = false
                self.permissionAlertMessage = "Failed to save scan: \(error.localizedDescription)"
                self.showPermissionAlert = true
                HapticManager.shared.playNotificationFeedback(type: .error)
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
                    HapticManager.shared.playNotificationFeedback(type: .success)
                }
            }
        } catch {
            await MainActor.run {
                self.isUploading = false
                self.permissionAlertMessage = "Failed to upload scan: \(error.localizedDescription)"
                self.showPermissionAlert = true
                HapticManager.shared.playNotificationFeedback(type: .error)
            }
        }
    }
}

// MARK: - RoomCaptureModalView: Modal presentation using RoomPlan's built-in view controller

class RoomCaptureCoordinator: NSObject, RoomCaptureSessionDelegate, NSCoding {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var isPresented: Bool
    var captureSession: RoomCaptureSession?
    private var latestCapturedRoom: CapturedRoom?
    
    init(capturedRoom: Binding<CapturedRoom?>, isPresented: Binding<Bool>) {
        _capturedRoom = capturedRoom
        _isPresented = isPresented
        super.init()
        print("🎯 Coordinator initialized: \(self)")
    }
    
    // NSCoding required methods (not actually used, but required for compilation)
    required init?(coder: NSCoder) {
        fatalError("NSCoding not supported")
    }
    
    func encode(with coder: NSCoder) {
        fatalError("NSCoding not supported")
    }
    
    deinit {
        print("♻️ Coordinator deinit")
    }
    
    @objc func doneButtonTapped() {
        print("👆 Done button tapped - stopping session")
        print("📊 Current state: captureSession=\(captureSession != nil), latestCapturedRoom=\(latestCapturedRoom != nil)")
        captureSession?.stop()
        print("✅ Stop called on capture session")
    }
    
    // RoomCaptureSessionDelegate methods
    func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        print("🔄 SESSION DELEGATE: didUpdate called!!!")
        print("   Room has \(room.walls.count) walls, \(room.doors.count) doors, \(room.windows.count) windows")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        print("📱 SESSION DELEGATE: didEndWith called!!!")
        print("   Error: \(error?.localizedDescription ?? "none")")
        print("   Latest room: \(latestCapturedRoom != nil ? "present" : "nil")")
        
        DispatchQueue.main.async {
            if let error = error {
                print("❌ Error: \(error.localizedDescription)")
                HapticManager.shared.playNotificationFeedback(type: .error)
                self.capturedRoom = nil
            } else if let room = self.latestCapturedRoom {
                print("✅ Using latest captured room with \(room.walls.count) walls")
                HapticManager.shared.playNotificationFeedback(type: .success)
                self.capturedRoom = room
            } else {
                print("⚠️ No room captured")
                HapticManager.shared.playNotificationFeedback(type: .warning)
                self.capturedRoom = nil
            }
            
            print("🚪 Dismissing modal - setting isPresented = false")
            self.isPresented = false
        }
    }
    
    func captureSession(_ session: RoomCaptureSession, didAdd room: CapturedRoom) {
        print("➕ SESSION DELEGATE: didAdd called!!!")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didChange room: CapturedRoom) {
        print("🔄 SESSION DELEGATE: didChange called!!!")
        latestCapturedRoom = room
    }
    
    func captureSession(_ session: RoomCaptureSession, didRemove room: CapturedRoom) {
        print("➖ SESSION DELEGATE: didRemove called")
    }
    
    func captureSession(_ session: RoomCaptureSession, didProvide instruction: RoomCaptureSession.Instruction) {
        print("💬 SESSION DELEGATE: didProvide instruction")
    }
    
    func captureSession(_ session: RoomCaptureSession, didStartWith configuration: RoomCaptureSession.Configuration) {
        print("🎬 SESSION DELEGATE: didStartWith configuration!!!")
    }
}

struct RoomCaptureModalView: UIViewControllerRepresentable {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var isPresented: Bool
    
    func makeUIViewController(context: Context) -> RoomCaptureWrapperViewController {
        print("🏗️ Creating RoomCaptureWrapperViewController")
        let wrapper = RoomCaptureWrapperViewController()
        wrapper.coordinator = context.coordinator
        return wrapper
    }
    
    func updateUIViewController(_ uiViewController: RoomCaptureWrapperViewController, context: Context) {
        // No updates needed
    }
    
    func makeCoordinator() -> RoomCaptureCoordinator {
        RoomCaptureCoordinator(capturedRoom: $capturedRoom, isPresented: $isPresented)
    }
}

// Wrapper view controller using RoomCaptureSession directly
class RoomCaptureWrapperViewController: UIViewController {
    var coordinator: RoomCaptureCoordinator?
    private var captureView: RoomPlan.RoomCaptureView!
    private var captureSession: RoomCaptureSession!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        print("🔧 RoomCaptureWrapperViewController viewDidLoad")
        
        // Create capture view first
        captureView = RoomPlan.RoomCaptureView(frame: view.bounds)
        captureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(captureView)
        
        // Use the capture view's session and set our coordinator as delegate
        captureSession = captureView.captureSession
        captureSession.delegate = coordinator
        coordinator?.captureSession = captureSession
        
        print("✅ Capture view created and connected to session")
        print("✅ Session delegate set: \(String(describing: captureSession.delegate))")
        
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
        print("▶️ Starting room capture session with SESSION DELEGATE...")
        let config = RoomCaptureSession.Configuration()
        captureSession.run(configuration: config)
        print("✅ Room capture session started")
        print("✅ Session delegate: \(captureSession.delegate != nil ? "YES" : "NO")")
    }
    
    @objc private func doneButtonTapped() {
        print("👆 Done button tapped")
        coordinator?.doneButtonTapped()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        print("🛑 View will disappear - stopping session")
        captureSession.stop()
    }
    
    deinit {
        print("♻️ RoomCaptureWrapperViewController deinit")
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
        print("🔧 Setting up RoomCaptureView...")
        
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
        
        print("✅ Delegate set to: \(String(describing: roomCaptureView.delegate))")
        print("✅ RoomCaptureView setup complete")
    }
    
    @objc private func doneButtonTapped() {
        print("👆 Done button tapped - stopping session")
        roomCaptureView.captureSession.stop(pauseARSession: true)
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("▶️ Starting room capture session...")
        let config = RoomCaptureSession.Configuration()
        roomCaptureView.captureSession.run(configuration: config)
        print("✅ Room capture session started")
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        print("🛑 View will disappear - stopping session")
        roomCaptureView.captureSession.stop(pauseARSession: true)
    }
    
    deinit {
        print("♻️ RoomCaptureViewController deinit")
        roomCaptureView?.delegate = nil
    }
}

extension RoomCaptureViewController: RoomCaptureViewDelegate {
    // This delegate method is called during scanning to provide updates
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didUpdate room: CapturedRoom) {
        print("🔄 RoomCaptureDelegate: didUpdate called - storing latest room")
        latestCapturedRoom = room
    }
    
    // This is called when the scan completes (user stops or session ends)
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didEndWith data: CapturedRoomData, error: Error?) {
        print("📱 RoomCaptureDelegate: didEndWith CapturedRoomData called")
        
        if let error = error {
            print("❌ Room capture ended with error: \(error.localizedDescription)")
            HapticManager.shared.playNotificationFeedback(type: .error)
            delegate?.captureViewController(self, didFinishWith: nil)
        } else {
            print("✅ Room capture ended successfully")
            
            // Use the latest captured room from didUpdate
            if let room = latestCapturedRoom {
                print("✅ Using latestCapturedRoom from didUpdate")
                HapticManager.shared.playNotificationFeedback(type: .success)
                delegate?.captureViewController(self, didFinishWith: room)
            } else {
                print("⚠️ No latestCapturedRoom available")
                HapticManager.shared.playNotificationFeedback(type: .warning)
                delegate?.captureViewController(self, didFinishWith: nil)
            }
        }
    }
    
    // This is called when a room is added
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didAdd room: CapturedRoom) {
        print("➕ RoomCaptureDelegate: didAdd called - storing room")
        latestCapturedRoom = room
    }
    
    // This is called when a room is removed
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didRemove room: CapturedRoom) {
        print("➖ RoomCaptureDelegate: didRemove called")
    }
    
    // This is called when a room is changed
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didChange room: CapturedRoom) {
        print("🔄 RoomCaptureDelegate: didChange called - storing room")
        latestCapturedRoom = room
    }
    
    // This is called to provide instructions
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didProvide instruction: RoomCaptureSession.Instruction) {
        print("💡 RoomCaptureDelegate: didProvide instruction: \(instruction)")
    }
    
    // This is called when scanning starts
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didStartWith configuration: RoomCaptureSession.Configuration) {
        print("🎬 RoomCaptureDelegate: didStartWith configuration")
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
