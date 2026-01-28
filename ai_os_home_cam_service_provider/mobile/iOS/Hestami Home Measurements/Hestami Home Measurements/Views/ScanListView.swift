//
//  ScanListView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import SwiftData
import os

struct ScanListView: View {
    private let logger = Logger.make(category: LogCategory.scanListView)
    @Environment(\.modelContext) private var modelContext
    @StateObject private var storageService = StorageService()
    @State private var showingNewScanSheet = false
    @State private var showingSettings = false
    @State private var selectedSession: ScanSession?
    @State private var showingDeleteAlert = false
    @State private var sessionToDelete: ScanSession?
    @State private var navigateToScan = false
    @State private var navigateToReferenceCapture = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                if storageService.scanSessions.isEmpty {
                    emptyStateView
                } else {
                    scanSessionsList
                }
            }
            .navigationTitle("Scans")
            .toolbarBackground(AppTheme.navigationBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { showingSettings = true }) {
                        Image(systemName: "gearshape")
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingNewScanSheet = true }) {
                        Image(systemName: "plus")
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
            }
            .sheet(isPresented: $showingNewScanSheet) {
                NewScanSheet { sessionName, mode, useReferencePhotos in
                    startNewScan(named: sessionName, mode: mode, useReferencePhotos: useReferencePhotos)
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
            .alert("Delete Scan", isPresented: $showingDeleteAlert) {
                Button("Cancel", role: .cancel) { 
                    sessionToDelete = nil
                }
                Button("Delete", role: .destructive) {
                    if let session = sessionToDelete {
                        logger.info("Deleting scan: \(session.name)")
                        storageService.deleteScanSession(session)
                        sessionToDelete = nil
                    }
                }
            } message: {
                Text("Are you sure you want to delete this scan? This action cannot be undone.")
            }
            .onAppear {
                storageService.setModelContext(modelContext)
            }
            .navigationDestination(isPresented: $navigateToScan) {
                if let session = selectedSession {
                    ScanView(session: session)
                }
            }
            .navigationDestination(isPresented: $navigateToReferenceCapture) {
                if let session = selectedSession {
                    ReferencePhotoCaptureView(session: session) {
                        // On Stage 1 complete, transition to Stage 2
                        logger.info("Stage 1 complete, transitioning to Stage 2 (ARKit scan)")
                        navigateToReferenceCapture = false
                        // Small delay to allow navigation to complete
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            navigateToScan = true
                        }
                    }
                }
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "arkit")
                .font(.system(size: 80))
                .foregroundColor(AppTheme.secondaryText)
            
            Text("No Scans Yet")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Start your first scan to measure your space")
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            ThemedButton(title: "Start New Scan", action: { showingNewScanSheet = true })
                .padding(.horizontal)
        }
    }
    
    private var scanSessionsList: some View {
        List {
            ForEach(storageService.scanSessions) { session in
                NavigationLink(destination: ScanDetailView(session: session)) {
                    ScanSessionRow(session: session)
                }
                .listRowBackground(AppTheme.cardBackground)
                .listRowSeparator(.hidden)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        sessionToDelete = session
                        showingDeleteAlert = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            storageService.loadScanSessions()
        }
    }
    
    private func startNewScan(named sessionName: String, mode: ScanMode, useReferencePhotos: Bool = true) {
        logger.info("Starting new scan with name: \(sessionName), mode: \(mode.rawValue), useReferencePhotos: \(useReferencePhotos)")
        if let session = storageService.createScanSession(name: sessionName, mode: mode, useReferencePhotos: useReferencePhotos) {
            logger.debug("Session created with ID: \(session.id), mode: \(session.scanMode ?? "unknown")")
            selectedSession = session

            if useReferencePhotos {
                // Start with Stage 1 (reference photo capture)
                logger.info("Starting Stage 1: Reference photo capture")
                navigateToReferenceCapture = true
            } else {
                // Skip to Stage 2 (existing ARKit scan)
                logger.info("Skipping Stage 1, starting Stage 2: ARKit scan")
                navigateToScan = true
            }
        } else {
            logger.error("Failed to create session")
        }
    }
}

struct ScanSessionRow: View {
    let session: ScanSession
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.name)
                    .font(.headline)
                    .foregroundColor(AppTheme.primaryText)
                
                Text(formattedDate(session.createdAt))
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                statusBadge
                
                Text("\(session.keyframeCount) keyframes")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var statusBadge: some View {
        Text(session.status.displayName)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(AppTheme.statusColor(for: session.status).opacity(0.2))
            .foregroundColor(AppTheme.statusColor(for: session.status))
            .cornerRadius(8)
    }
    
    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct NewScanSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var sessionName = ""
    @State private var selectedMode: ScanMode = .room
    @State private var useReferencePhotos = true
    let onStart: (String, ScanMode, Bool) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Scan Name", text: $sessionName)
                        .textInputAutocapitalization(.words)
                } header: {
                    Text("New Scan")
                } footer: {
                    Text("Give your scan a descriptive name, like 'Living Room' or 'Master Bedroom'")
                }

                Section {
                    ForEach(ScanMode.allCases, id: \.self) { mode in
                        ModeSelectionRow(
                            mode: mode,
                            isSelected: selectedMode == mode
                        ) {
                            selectedMode = mode
                        }
                    }
                } header: {
                    Text("Scan Type")
                } footer: {
                    Text(modeDescription)
                }

                Section {
                    Toggle(isOn: $useReferencePhotos) {
                        HStack {
                            Image(systemName: "camera.aperture")
                                .foregroundColor(AppTheme.primary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Capture Reference Photos")
                                    .foregroundColor(AppTheme.primaryText)
                                Text("ProRAW/48MP")
                                    .font(.caption)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        }
                    }
                    .tint(AppTheme.primary)
                } header: {
                    Text("High-Quality Capture")
                } footer: {
                    Text(useReferencePhotos
                         ? "Capture ProRAW photos from 3 angles before LiDAR scanning. Enables high-resolution texture mapping for better results."
                         : "Skip reference photos and go directly to LiDAR scanning. Faster but lower texture quality.")
                }
            }
            .navigationTitle("New Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Start") {
                        if !sessionName.isEmpty {
                            onStart(sessionName, selectedMode, useReferencePhotos)
                            dismiss()
                        }
                    }
                    .disabled(sessionName.isEmpty)
                }
            }
        }
    }

    private var modeDescription: String {
        switch selectedMode {
        case .room:
            return "Measure entire rooms, kitchens, or bathrooms. Requires scanning walls, corners, and floor."
        case .element:
            return "Measure doors, windows, or frames. Requires circling around the element."
        }
    }
}

struct ModeSelectionRow: View {
    let mode: ScanMode
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                ZStack {
                    Circle()
                        .fill(modeColor.opacity(0.2))
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: modeIcon)
                        .font(.system(size: 20))
                        .foregroundColor(modeColor)
                }
                
                // Text
                VStack(alignment: .leading, spacing: 4) {
                    Text(mode.displayName)
                        .font(.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(modeSubtitle)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                // Selection indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(AppTheme.primary)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
    
    private var modeIcon: String {
        switch mode {
        case .room: return "house.fill"
        case .element: return "door.left.hand.open"
        }
    }
    
    private var modeColor: Color {
        switch mode {
        case .room: return .blue
        case .element: return .green
        }
    }
    
    private var modeSubtitle: String {
        switch mode {
        case .room: return "Full room measurement"
        case .element: return "Door/window measurement"
        }
    }
}

// MARK: - Extensions

extension ScanStatus {
    var displayName: String {
        switch self {
        case .notStarted: return "Not Started"
        case .inProgress: return "In Progress"
        case .paused: return "Paused"
        case .completed: return "Completed"
        case .uploading: return "Uploading"
        case .processing: return "Processing"
        case .failed: return "Failed"
        case .success: return "Success"
        }
    }
}

#Preview {
    ScanListView()
        .modelContainer(for: [ScanSession.self, Keyframe.self, MeasurementResult.self], inMemory: true)
}
