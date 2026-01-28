//
//  SettingsView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import os

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var cloudEndpoint = "https://api.hestami.com/v1"
    @State private var autoUpload = false
    @State private var deleteOldScans = false
    @State private var oldScanDays = 30
    @State private var showingAbout = false
    @State private var showingPrivacyPolicy = false
    
    var body: some View {
        NavigationStack {
            Form {
                // Cloud Settings
                Section("Cloud Settings") {
                    TextField("Cloud Endpoint", text: $cloudEndpoint)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    Toggle("Auto-upload after scan", isOn: $autoUpload)
                    
                    NavigationLink {
                        CloudStatusView()
                    } label: {
                        Label("Cloud Status", systemImage: "icloud")
                    }
                }
                
                // Storage Settings
                Section("Storage") {
                    Toggle("Delete old scans automatically", isOn: $deleteOldScans)
                    
                    if deleteOldScans {
                        HStack {
                            Text("Delete scans older than")
                            Spacer()
                            Stepper("\(oldScanDays) days", value: $oldScanDays, in: 7...365)
                        }
                    }
                    
                    NavigationLink {
                        StorageManagementView()
                    } label: {
                        Label("Manage Storage", systemImage: "externaldrive")
                    }
                }
                
                // Scan Settings
                Section("Scan Settings") {
                    NavigationLink {
                        ScanQualitySettingsView()
                    } label: {
                        Label("Scan Quality", systemImage: "slider.horizontal.3")
                    }
                    
                    NavigationLink {
                        ScanGuidanceSettingsView()
                    } label: {
                        Label("Scan Guidance", systemImage: "lightbulb")
                    }
                }
                
                // About
                Section("About") {
                    Button(action: { showingAbout = true }) {
                        Label("About Hestami Measurements", systemImage: "info.circle")
                    }
                    
                    Button(action: { showingPrivacyPolicy = true }) {
                        Label("Privacy Policy", systemImage: "hand.raised.fill")
                    }
                    
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingAbout) {
                AboutView()
            }
            .sheet(isPresented: $showingPrivacyPolicy) {
                PrivacyPolicyView()
            }
        }
    }
    
    private var appVersion: String {
        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
           let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            return "\(version) (\(build))"
        }
        return "1.0 (1)"
    }
}

struct CloudStatusView: View {
    var body: some View {
        List {
            Section("Connection Status") {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(AppTheme.success)
                    Text("Connected")
                }
                
                HStack {
                    Image(systemName: "server.rack")
                    Text("Server: api.hestami.com")
                }
                
                HStack {
                    Image(systemName: "clock")
                    Text("Last sync: Just now")
                }
            }
            
            Section("API Information") {
                HStack {
                    Text("API Version")
                    Spacer()
                    Text("v1.0")
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                HStack {
                    Text("Endpoint")
                    Spacer()
                    Text("/v1/scans")
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        }
        .navigationTitle("Cloud Status")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StorageManagementView: View {
    private let logger = Logger.make(category: LogCategory.storageManagement)
    @State private var storageUsed: Int64 = 0
    @State private var storageTotal: Int64 = 0
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        List {
            Section("Storage Usage") {
                    if isLoading {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Loading...")
                                .font(.caption)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    } else if let error = errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(AppTheme.warning)
                            Text(error)
                                .font(.caption)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                } else {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Used")
                                .font(.caption)
                                .foregroundColor(AppTheme.secondaryText)
                            Text(formatBytes(storageUsed))
                                .font(.headline)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing) {
                            Text("Total")
                                .font(.caption)
                                .foregroundColor(AppTheme.secondaryText)
                            Text(formatBytes(storageTotal))
                                .font(.headline)
                        }
                    }
                    
                    if storageTotal > 0 {
                        ProgressView(value: Double(storageUsed) / Double(storageTotal))
                            .tint(AppTheme.primary)
                    }
                }
            }
            
            Section("Actions") {
                Button(role: .destructive) {
                    // Clear all scans
                } label: {
                    Label("Delete All Scans", systemImage: "trash")
                }
                
                Button {
                    // Clear cache
                } label: {
                    Label("Clear Cache", systemImage: "arrow.clockwise")
                }
            }
        }
        .navigationTitle("Manage Storage")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadStorageInfo()
        }
    }
    
    private func loadStorageInfo() {
        logger.debug("Loading storage info")
        isLoading = true
        errorMessage = nil
        
        let storageService = StorageService()
        let (used, total) = storageService.getStorageUsage()
        
        logger.debug("Used: \(formatBytes(used)), Total: \(formatBytes(total))")
        
        storageUsed = used
        storageTotal = total
        isLoading = false
        
        if total == 0 {
            errorMessage = "No storage data available"
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

struct ScanQualitySettingsView: View {
    @State private var keyframeQuality = "high"
    @State private var depthResolution = "high"
    @State private var imageQuality = 0.8
    
    var body: some View {
        Form {
            Section("Keyframe Selection") {
                Picker("Quality", selection: $keyframeQuality) {
                    Text("High").tag("high")
                    Text("Medium").tag("medium")
                    Text("Low").tag("low")
                }
                
                Text("Higher quality captures more keyframes but uses more storage and takes longer to upload.")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Section("Depth Resolution") {
                Picker("Resolution", selection: $depthResolution) {
                    Text("High").tag("high")
                    Text("Medium").tag("medium")
                    Text("Low").tag("low")
                }
                
                Text("Higher resolution provides more accurate measurements but increases file size.")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Section("Image Compression") {
                VStack(alignment: .leading) {
                    Text("Quality: \(Int(imageQuality * 100))%")
                    Slider(value: $imageQuality, in: 0.5...1.0, step: 0.1)
                }
                
                Text("Lower compression reduces file size but may affect texture quality.")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .navigationTitle("Scan Quality")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ScanGuidanceSettingsView: View {
    @State private var showTrackingWarnings = true
    @State private var showDepthWarnings = true
    @State private var showMotionWarnings = true
    @State private var guidanceLevel = "standard"
    
    var body: some View {
        Form {
            Section("Warnings") {
                Toggle("Show tracking warnings", isOn: $showTrackingWarnings)
                Toggle("Show depth warnings", isOn: $showDepthWarnings)
                Toggle("Show motion warnings", isOn: $showMotionWarnings)
            }
            
            Section("Guidance Level") {
                Picker("Level", selection: $guidanceLevel) {
                    Text("Minimal").tag("minimal")
                    Text("Standard").tag("standard")
                    Text("Detailed").tag("detailed")
                }
                
                Text("Choose how much guidance you want during scanning.")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .navigationTitle("Scan Guidance")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AboutView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 30) {
                    // Logo
                    Image(systemName: "arkit")
                        .font(.system(size: 80))
                        .foregroundColor(AppTheme.primary)
                    
                    // App Name
                    Text("Hestami Measurements")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    // Version
                    Text("Version 1.0 (1)")
                        .font(.subheadline)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Divider()
                    
                    // Description
                    Text("Professional-grade 3D scanning and measurement tool for iOS devices with LiDAR.")
                        .font(.body)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    // Features
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Features")
                            .font(.headline)
                        
                        FeatureRow(icon: "camera.viewfinder", text: "LiDAR-powered 3D scanning")
                        FeatureRow(icon: "ruler", text: "Millimeter-accurate measurements")
                        FeatureRow(icon: "cube", text: "Photorealistic 3D models")
                        FeatureRow(icon: "icloud", text: "Cloud processing")
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    
                    // Links
                    VStack(spacing: 16) {
                        Link(destination: URL(string: "https://hestami.com")!) {
                            Label("Website", systemImage: "globe")
                        }
                        
                        Link(destination: URL(string: "https://hestami.com/support")!) {
                            Label("Support", systemImage: "questionmark.circle")
                        }
                        
                        Link(destination: URL(string: "https://hestami.com/terms")!) {
                            Label("Terms of Service", systemImage: "doc.text")
                        }
                    }
                    .padding()
                }
                .padding()
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(AppTheme.primary)
                .frame(width: 24)
            Text(text)
                .font(.body)
        }
    }
}

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Privacy Policy")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Last updated: January 23, 2026")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text("""
                    Hestami Measurements is committed to protecting your privacy. This policy explains how we collect, use, and protect your data.
                    
                    **Data Collection**
                    
                    We collect the following data:
                    - Scan data (RGB images, depth maps, camera poses)
                    - Device information (model, iOS version)
                    - Usage analytics (optional)
                    
                    **Data Usage**
                    
                    Your scan data is used to:
                    - Generate 3D models and measurements
                    - Improve our algorithms
                    - Provide cloud processing services
                    
                    **Data Storage**
                    
                    - Scan data is stored locally on your device
                    - Cloud uploads are encrypted in transit and at rest
                    - You can delete your data at any time
                    
                    **Data Sharing**
                    
                    We do not sell your personal data. We may share data with:
                    - Cloud processing services (encrypted)
                    - Analytics providers (aggregated, anonymized)
                    
                    **Your Rights**
                    
                    You have the right to:
                    - Access your data
                    - Delete your data
                    - Export your data
                    - Opt out of analytics
                    
                    **Contact**
                    
                    For privacy inquiries, contact us at privacy@hestami.com
                    """)
                    .font(.body)
                }
                .padding()
            }
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    SettingsView()
}
