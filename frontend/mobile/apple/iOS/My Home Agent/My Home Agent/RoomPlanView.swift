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
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 24) {
                if let capturedRoom = capturedRoom {
                    VStack(spacing: 20) {
                        Text("Room scan complete!")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.buttonBackground)
                        Text("Your room scan has been saved successfully.")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                            .multilineTextAlignment(.center)
                        Button(action: { exportUSDZ(room: capturedRoom) }) {
                            Label("Export as USDZ", systemImage: "square.and.arrow.up")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                                .padding()
                                .frame(width: 220)
                                .background(AppTheme.buttonBackground)
                                .cornerRadius(10)
                        }
                        Button(action: { exportImage(room: capturedRoom) }) {
                            Label("Export as Image", systemImage: "photo")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                                .padding()
                                .frame(width: 220)
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
                } else if isScanning {
                    VStack(spacing: 30) {
                        Text("Scanning in progress...")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        RoomCaptureViewControllerRepresentable(isScanning: $isScanning, capturedRoom: $capturedRoom)
                            .frame(height: 400)
                            .cornerRadius(16)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(AppTheme.borderColor, lineWidth: 1)
                            )
                        Button(action: { isScanning = false }) {
                            Text("Stop Scanning")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                                .padding()
                                .frame(width: 200)
                                .background(AppTheme.errorColor)
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
                } else {
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
            }
            .padding()
        }
        .navigationTitle("Room Scan")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
    }
    
    private func checkCameraPermissionAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isScanning = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        isScanning = true
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
}

// MARK: - RoomCaptureViewController: A UIKit wrapper for RoomCaptureView

class RoomCaptureViewController: UIViewController {
    private var roomCaptureView: RoomPlan.RoomCaptureView!
    private var onRoomCaptured: ((CapturedRoom?) -> Void)?
    private var isScanning = false
    
    init(onRoomCaptured: @escaping (CapturedRoom?) -> Void) {
        self.onRoomCaptured = onRoomCaptured
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupRoomCaptureView()
    }
    
    private func setupRoomCaptureView() {
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
    }
    
    func startScanning() {
        if !isScanning {
            isScanning = true
            let config = RoomCaptureSession.Configuration()
            roomCaptureView.captureSession.run(configuration: config)
        }
    }
    
    func stopScanning() {
        if isScanning {
            isScanning = false
            roomCaptureView.captureSession.stop()
        }
    }
    
    deinit {
        roomCaptureView.delegate = nil
    }
}

extension RoomCaptureViewController: RoomCaptureViewDelegate {
    func captureView(_ captureView: RoomPlan.RoomCaptureView, didEndWith room: CapturedRoom?, error: Error?) {
        isScanning = false
        if let error = error {
            print("Room capture ended with error: \(error.localizedDescription)")
            HapticManager.shared.handleHapticError(error)
            // Provide haptic feedback for error
            HapticManager.shared.playNotificationFeedback(type: .error)
        } else if let room = room {
            print("Room capture succeeded. Captured room: \(room)")
            // Provide haptic feedback for success
            HapticManager.shared.playNotificationFeedback(type: .success)
        } else {
            print("Room capture ended with no room and no error.")
            // Provide haptic feedback for warning
            HapticManager.shared.playNotificationFeedback(type: .warning)
        }
        onRoomCaptured?(room)
    }
}

// MARK: - RoomCaptureViewControllerRepresentable: SwiftUI wrapper for RoomCaptureViewController

struct RoomCaptureViewControllerRepresentable: UIViewControllerRepresentable {
    @Binding var isScanning: Bool
    @Binding var capturedRoom: CapturedRoom?
    
    func makeUIViewController(context: Context) -> RoomCaptureViewController {
        let controller = RoomCaptureViewController { room in
            DispatchQueue.main.async {
                self.isScanning = false
                self.capturedRoom = room
            }
        }
        return controller
    }
    
    func updateUIViewController(_ uiViewController: RoomCaptureViewController, context: Context) {
        if isScanning {
            uiViewController.startScanning()
        } else {
            uiViewController.stopScanning()
        }
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
