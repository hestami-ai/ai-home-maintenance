//
//  ScanDetailView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import SwiftData
import os

struct ScanDetailView: View {
    private let logger = Logger.make(category: LogCategory.scanDetailView)
    let session: ScanSession
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var storageService = StorageService()
    @State private var measurementService = MeasurementService()
    @State private var cloudService = CloudService()
    @State private var keyframes: [Keyframe] = []
    @State private var referencePhotos: [ReferencePhoto] = []
    @State private var showingScanView = false
    @State private var showingResultsView = false
    @State private var showingDeleteAlert = false
    @State private var isUploading = false
    @State private var uploadProgress: Double = 0.0
    @State private var errorMessage: String?
    @State private var sessionFiles: [SessionFile] = []
    @State private var showingFileList = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                headerSection
                
                // Status Card
                statusCard
                
                // Statistics
                statisticsSection

                // Reference Photos (Stage 1)
                if !referencePhotos.isEmpty {
                    referencePhotosSection
                }

                // Keyframes
                if !keyframes.isEmpty {
                    keyframesSection
                }
                
                // File List
                if !sessionFiles.isEmpty {
                    fileListSection
                }
                
                // Actions
                actionsSection
                
                // Measurements Preview
                if !measurementService.measurements.isEmpty {
                    measurementsPreview
                }
            }
            .padding()
        }
        .navigationTitle(session.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        showingDeleteAlert = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert("Delete Scan", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                storageService.deleteScanSession(session)
                dismiss()
            }
        } message: {
            Text("Are you sure you want to delete this scan? This action cannot be undone.")
        }
        .sheet(isPresented: $showingScanView) {
            ScanView(session: session)
        }
        .sheet(isPresented: $showingResultsView) {
            ResultsView(session: session)
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
            logger.debug("Appearing for session: \(session.name)")
            storageService.setModelContext(modelContext)
            measurementService.setModelContext(modelContext)
            cloudService.setModelContext(modelContext)
            
            // Load data
            measurementService.loadMeasurements(for: session)
            keyframes = storageService.getKeyframes(for: session)
            referencePhotos = storageService.getReferencePhotos(for: session)
            sessionFiles = storageService.getSessionFiles(for: session)

            logger.debug("Loaded \(referencePhotos.count) reference photos")
            logger.debug("Loaded \(keyframes.count) keyframes")
            logger.debug("Loaded \(sessionFiles.count) files")
            logger.debug("Session status: \(session.status.rawValue)")
            logger.debug("Session duration: \(String(format: "%.1f", session.duration))s")
            logger.debug("Session keyframe count: \(session.keyframeCount)")
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Scan Details")
                .font(.title2)
                .fontWeight(.bold)
            
            HStack {
                Image(systemName: "calendar")
                Text(formattedDate(session.createdAt))
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
                
                Spacer()
                
                Image(systemName: "clock")
                Text(formattedDuration(session.duration))
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Status")
                    .font(.headline)
                
                Spacer()
                
                statusBadge
            }
            
            if isUploading {
                VStack(spacing: 8) {
                    ProgressView(value: uploadProgress)
                        .tint(AppTheme.primary)
                    
                    Text("Uploading... \(Int(uploadProgress * 100))%")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            
            if let uploadId = session.cloudUploadId {
                HStack {
                    Image(systemName: "link")
                    Text("Upload ID: \(uploadId)")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private var statusBadge: some View {
        Text(session.status.displayName)
            .font(.subheadline)
            .fontWeight(.semibold)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .cornerRadius(8)
    }
    
    private var statusColor: Color {
        switch session.status {
        case .notStarted: return AppTheme.disabledText
        case .inProgress: return AppTheme.primary
        case .paused: return AppTheme.warning
        case .completed: return AppTheme.success
        case .uploading: return AppTheme.primary
        case .processing: return AppTheme.accent
        case .success: return AppTheme.success
        case .failed: return AppTheme.error
        }
    }
    
    private var statisticsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Statistics")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                StatCard(
                    icon: "camera.viewfinder",
                    title: "Keyframes",
                    value: "\(keyframes.count)"
                )
                
                StatCard(
                    icon: "ruler",
                    title: "Measurements",
                    value: "\(measurementService.measurements.count)"
                )
                
                StatCard(
                    icon: "clock",
                    title: "Duration",
                    value: formattedDuration(session.duration)
                )
                
                StatCard(
                    icon: "checkmark.circle",
                    title: "Status",
                    value: session.status.displayName
                )
            }
            
            // Measurements explanation
            if measurementService.measurements.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundColor(AppTheme.primary)
                    Text("Measurements are generated after uploading your scan to the cloud for processing.")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .padding(.top, 4)
            }
        }
    }
    
    private var referencePhotosSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Reference Photos")
                    .font(.headline)

                Spacer()

                // ProRAW indicator
                if referencePhotos.first?.isProRAW == true {
                    Label("ProRAW", systemImage: "camera.aperture")
                        .font(.caption)
                        .foregroundColor(AppTheme.success)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(AppTheme.success.opacity(0.2))
                        .cornerRadius(6)
                }

                Text("\(referencePhotos.count) photos")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
            }

            // Photo grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(referencePhotos) { photo in
                    ReferencePhotoThumbnail(photo: photo)
                }
            }

            // Total size
            let totalSize = referencePhotos.reduce(Int64(0)) { $0 + $1.fileSize }
            HStack {
                Image(systemName: "doc.fill")
                    .foregroundColor(AppTheme.primary)
                Text("Total: \(ByteCountFormatter.string(fromByteCount: totalSize, countStyle: .file))")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }

    private var keyframesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Keyframes")
                    .font(.headline)

                Spacer()

                Text("\(keyframes.count) total")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            if keyframes.isEmpty {
                Text("No keyframes captured yet")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else if keyframes.count <= 10 {
                // Show all if 10 or fewer
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    ForEach(keyframes) { keyframe in
                        KeyframeThumbnail(keyframe: keyframe)
                    }
                }
            } else {
                // Show first 6 in grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    ForEach(keyframes.prefix(6)) { keyframe in
                        KeyframeThumbnail(keyframe: keyframe)
                    }
                }
                
                Text("... \(keyframes.count - 6) more keyframes ...")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 4)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private var fileListSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Capture Files")
                    .font(.headline)
                
                Spacer()
                
                Text("\(sessionFiles.count) files")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            // Total size
            let totalSize = sessionFiles.reduce(0) { $0 + $1.size }
            HStack {
                Image(systemName: "externaldrive")
                    .foregroundColor(AppTheme.primary)
                Text("Total Size: \(ByteCountFormatter.string(fromByteCount: totalSize, countStyle: .file))")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            // File table
            if sessionFiles.isEmpty {
                Text("No files captured yet")
                    .font(.subheadline)
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 0) {
                    // Table header
                    HStack(spacing: 12) {
                        Text("File Name")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(AppTheme.secondaryText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        Text("Size")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(AppTheme.secondaryText)
                            .frame(width: 80, alignment: .trailing)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppTheme.cardBackground.opacity(0.5))
                    
                    Divider()
                    
                    // File rows
                    ForEach(sessionFiles) { file in
                        VStack(spacing: 0) {
                            HStack(spacing: 12) {
                                // File type icon
                                Image(systemName: file.type.icon)
                                    .font(.caption)
                                    .foregroundColor(fileTypeColor(for: file.type))
                                    .frame(width: 20)
                                
                                // File name
                                Text(file.name)
                                    .font(.caption)
                                    .foregroundColor(AppTheme.primaryText)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                
                                // File size
                                Text(file.formattedSize)
                                    .font(.caption)
                                    .foregroundColor(AppTheme.secondaryText)
                                    .frame(width: 80, alignment: .trailing)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            
                            if file.id != sessionFiles.last?.id {
                                Divider()
                            }
                        }
                    }
                }
                .background(AppTheme.cardBackground)
                .cornerRadius(8)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private func fileTypeColor(for type: SessionFileType) -> Color {
        switch type {
        case .image: return .blue
        case .depth: return .purple
        case .metadata: return .orange
        case .model: return .green
        case .log: return .gray
        case .other: return .gray
        }
    }
    
    private var actionsSection: some View {
        VStack(spacing: 12) {
            Text("Actions")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            if session.status == .notStarted || session.status == .paused {
                Button(action: { showingScanView = true }) {
                    Label("Resume Scan", systemImage: "play.circle.fill")
                        .font(.headline)
                        .foregroundColor(AppTheme.primaryText)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppTheme.primary)
                        .cornerRadius(10)
                }
            }
            
            if session.status == .completed {
                Button(action: uploadScan) {
                    Label("Upload to Cloud", systemImage: "icloud.and.arrow.up")
                        .font(.headline)
                        .foregroundColor(AppTheme.primaryText)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppTheme.success)
                        .cornerRadius(10)
                }
                .disabled(isUploading)
            }
            
            if session.status == .success || !measurementService.measurements.isEmpty {
                Button(action: { showingResultsView = true }) {
                    Label("View Results", systemImage: "chart.bar.fill")
                        .font(.headline)
                        .foregroundColor(AppTheme.primaryText)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppTheme.accent)
                        .cornerRadius(10)
                }
            }
        }
    }
    
    private var measurementsPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Measurements")
                    .font(.headline)
                
                Spacer()
                
                Button("View All") {
                    showingResultsView = true
                }
                .font(.subheadline)
                .foregroundColor(AppTheme.primary)
            }
            
            ForEach(measurementService.measurements.prefix(3)) { measurement in
                MeasurementRow(measurement: measurement)
            }
            
            if measurementService.measurements.count > 3 {
                Text("+ \(measurementService.measurements.count - 3) more measurements")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private func uploadScan() {
        Task {
            isUploading = true
            do {
                let response = try await cloudService.uploadScan(session: session)
                logger.info("Upload successful: \(response.uploadId)")
            } catch {
                errorMessage = "Upload failed: \(error.localizedDescription)"
            }
            isUploading = false
        }
    }
    
    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func formattedDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(AppTheme.primary)
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
            
            Text(title)
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
    }
}

struct KeyframeThumbnail: View {
    let keyframe: Keyframe
    @State private var thumbnailImage: UIImage?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Thumbnail image
            ZStack {
                if let image = thumbnailImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 100)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(AppTheme.cardBackground)
                        .frame(height: 100)
                        .overlay(
                            Image(systemName: "photo")
                                .font(.title)
                                .foregroundColor(AppTheme.disabledText)
                        )
                }
                
                // Quality badge overlay
                VStack {
                    HStack {
                        Spacer()
                        qualityBadge
                    }
                    Spacer()
                    
                    // Depth indicator
                    HStack {
                        Spacer()
                        depthIndicator
                    }
                }
                .padding(6)
            }
            .cornerRadius(8)
            
            // Keyframe info
            VStack(alignment: .leading, spacing: 2) {
                Text("#\(keyframe.index)")
                    .font(.caption)
                    .fontWeight(.semibold)
                
                HStack(spacing: 8) {
                    // Quality
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                        Text("\(Int(keyframe.qualityScore * 100))%")
                            .font(.caption2)
                    }
                    .foregroundColor(qualityColor)
                    
                    // Depth confidence
                    HStack(spacing: 4) {
                        Image(systemName: "cube.fill")
                            .font(.caption2)
                        Text("\(Int(keyframe.depthConfidence * 100))%")
                            .font(.caption2)
                    }
                    .foregroundColor(.blue)
                }
            }
        }
        .onAppear {
            loadThumbnail()
        }
    }
    
    private var depthIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: "cube.fill")
                .font(.caption2)
            Text("LiDAR")
                .font(.caption2)
                .fontWeight(.bold)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(AppTheme.primary.opacity(0.9))
        .foregroundColor(AppTheme.primaryText)
        .cornerRadius(6)
    }
    
    private var qualityBadge: some View {
        Text("\(Int(keyframe.qualityScore * 100))%")
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(qualityColor.opacity(0.9))
            .foregroundColor(.white)
            .cornerRadius(6)
    }
    
    private var qualityColor: Color {
        switch keyframe.qualityScore {
        case 0.9...1.0: return AppTheme.success
        case 0.7..<0.9: return AppTheme.warning
        default: return AppTheme.error
        }
    }
    
    private func loadThumbnail() {
        guard let imagePath = keyframe.rgbImagePath else { return }

        DispatchQueue.global(qos: .userInitiated).async {
            if let image = UIImage(contentsOfFile: imagePath) {
                // Fix image orientation by creating a properly oriented image
                let orientedImage = self.fixImageOrientation(image)
                DispatchQueue.main.async {
                    self.thumbnailImage = orientedImage
                }
            }
        }
    }

    private func fixImageOrientation(_ image: UIImage) -> UIImage {
        // If the image orientation is already correct, return as-is
        guard image.imageOrientation != .up else {
            return image
        }

        // Calculate the transform to correct the orientation
        var transform = CGAffineTransform.identity

        switch image.imageOrientation {
        case .down:
            transform = transform.rotated(by: .pi)
        case .left:
            transform = transform.rotated(by: .pi / 2)
        case .right:
            transform = transform.rotated(by: -.pi / 2)
        case .upMirrored:
            transform = transform.scaledBy(x: -1, y: 1)
        case .downMirrored:
            transform = transform.rotated(by: .pi)
            transform = transform.scaledBy(x: -1, y: 1)
        case .leftMirrored:
            transform = transform.rotated(by: .pi / 2)
            transform = transform.scaledBy(x: -1, y: 1)
        case .rightMirrored:
            transform = transform.rotated(by: -.pi / 2)
            transform = transform.scaledBy(x: -1, y: 1)
        default:
            break
        }

        // Create a CGContext to redraw the image with correct orientation
        let size = image.size
        UIGraphicsBeginImageContextWithOptions(size, false, image.scale)
        defer { UIGraphicsEndImageContext() }

        if let context = UIGraphicsGetCurrentContext() {
            context.concatenate(transform)
            image.draw(in: CGRect(origin: .zero, size: size))
        }

        return UIGraphicsGetImageFromCurrentImageContext() ?? image
    }
}

struct MeasurementRow: View {
    let measurement: MeasurementResult
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(measurement.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(measurement.type.displayName)
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(measurement.formattedValue)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Text(measurement.confidenceLevel)
                    .font(.caption)
                    .foregroundColor(confidenceColor)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var confidenceColor: Color {
        switch measurement.confidence {
        case 0.9...1.0: return AppTheme.success
        case 0.7..<0.9: return AppTheme.warning
        default: return AppTheme.error
        }
    }
}

// MARK: - File List Views

struct FileTypeSummary: View {
    let type: SessionFileType
    let count: Int
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: type.icon)
                .font(.caption)
                .foregroundColor(fileTypeColor)
            
            Text("\(type.rawValue): \(count)")
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(AppTheme.cardBackground)
        .cornerRadius(6)
    }
    
    private var fileTypeColor: Color {
        switch type {
        case .image: return .blue
        case .depth: return .purple
        case .metadata: return .orange
        case .model: return .green
        case .log: return .gray
        case .other: return .gray
        }
    }
}

struct FileListView: View {
    let files: [SessionFile]
    let sessionName: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedFilter: SessionFileType? = nil
    
    var filteredFiles: [SessionFile] {
        if let filter = selectedFilter {
            return files.filter { $0.type == filter }
        }
        return files
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(title: "All", isSelected: selectedFilter == nil) {
                            selectedFilter = nil
                        }
                        
                        ForEach(SessionFileType.allCases, id: \.self) { type in
                            let count = files.filter { $0.type == type }.count
                            if count > 0 {
                                FilterChip(title: "\(type.rawValue) (\(count))", isSelected: selectedFilter == type) {
                                    selectedFilter = type
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .background(AppTheme.cardBackground)
                
                // File list
                if filteredFiles.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(AppTheme.disabledText)
                        
                        Text("No files found")
                            .font(.headline)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredFiles) { file in
                            FileRow(file: file)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Capture Files")
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

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? AppTheme.primary : AppTheme.cardBackground)
                .foregroundColor(isSelected ? AppTheme.primaryText : AppTheme.secondaryText)
                .cornerRadius(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(AppTheme.primary, lineWidth: isSelected ? 0 : 1)
                )
        }
    }
}

struct FileRow: View {
    let file: SessionFile
    
    var body: some View {
        HStack(spacing: 12) {
            // File type icon
            ZStack {
                Circle()
                    .fill(fileTypeColor.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: file.type.icon)
                    .font(.system(size: 18))
                    .foregroundColor(fileTypeColor)
            }
            
            // File info
            VStack(alignment: .leading, spacing: 4) {
                Text(file.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    Text(file.type.rawValue)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text("•")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text(file.formattedSize)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            
            Spacer()
            
            // Date
            VStack(alignment: .trailing, spacing: 4) {
                Text(file.formattedDate)
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var fileTypeColor: Color {
        switch file.type {
        case .image: return .blue
        case .depth: return .purple
        case .metadata: return .orange
        case .model: return .green
        case .log: return .gray
        case .other: return .gray
        }
    }
}

#Preview {
    NavigationStack {
        ScanDetailView(session: ScanSession(name: "Living Room"))
    }
    .modelContainer(for: [ScanSession.self, Keyframe.self, MeasurementResult.self], inMemory: true)
}
