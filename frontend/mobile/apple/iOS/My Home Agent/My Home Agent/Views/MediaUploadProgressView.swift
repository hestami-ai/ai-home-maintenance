import SwiftUI

/// Bottom sheet showing upload progress with detailed file status
struct MediaUploadProgressView: View {
    @ObservedObject var uploadManager = MediaUploadManager.shared
    @Binding var isPresented: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            // Handle
            RoundedRectangle(cornerRadius: 3)
                .fill(AppTheme.secondaryText.opacity(0.3))
                .frame(width: 40, height: 5)
                .padding(.top, 12)
                .padding(.bottom, 20)
            
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(uploadManager.isUploading ? "Uploading Media" : "Upload Complete")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                    
                    if uploadManager.isUploading {
                        let completed = uploadManager.uploadQueue.filter { $0.status == .completed }.count
                        let total = uploadManager.uploadQueue.count
                        Text("\(completed) of \(total) files")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                    } else {
                        let successful = uploadManager.uploadQueue.filter { $0.status == .completed }.count
                        let failed = uploadManager.uploadQueue.filter { $0.status == .failed }.count
                        
                        if failed > 0 {
                            Text("\(successful) succeeded, \(failed) failed")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.errorText)
                        } else {
                            Text("All files uploaded successfully")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.successText)
                        }
                    }
                }
                
                Spacer()
                
                if !uploadManager.isUploading {
                    Button(action: {
                        isPresented = false
                        uploadManager.uploadQueue.removeAll()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 16)
            
            // Overall Progress Bar
            if uploadManager.isUploading {
                VStack(spacing: 8) {
                    ProgressView(value: uploadManager.overallProgress)
                        .progressViewStyle(LinearProgressViewStyle(tint: AppTheme.accentPrimary))
                    
                    Text("\(Int(uploadManager.overallProgress * 100))%")
                        .font(AppTheme.captionFont.bold())
                        .foregroundColor(AppTheme.secondaryText)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
            }
            
            Divider()
                .background(AppTheme.borderColor)
            
            // File List
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(uploadManager.uploadQueue) { task in
                        UploadTaskRow(task: task)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .frame(maxHeight: 300)
            
            // Actions
            if !uploadManager.isUploading {
                VStack(spacing: 12) {
                    Divider()
                        .background(AppTheme.borderColor)
                    
                    HStack(spacing: 12) {
                        // Retry Failed
                        let failedTasks = uploadManager.uploadQueue.filter { $0.status == .failed }
                        if !failedTasks.isEmpty {
                            Button(action: {
                                // Retry all failed uploads
                                for task in failedTasks {
                                    uploadManager.retryUpload(taskId: task.id) { _ in }
                                }
                            }) {
                                HStack {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Retry Failed")
                                }
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.buttonText)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(AppTheme.accentPrimary)
                                .cornerRadius(10)
                            }
                        }
                        
                        // Done
                        Button(action: {
                            isPresented = false
                            uploadManager.uploadQueue.removeAll()
                        }) {
                            Text("Done")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.buttonText)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(AppTheme.buttonBackground)
                                .cornerRadius(10)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
            } else {
                // Cancel All
                VStack(spacing: 12) {
                    Divider()
                        .background(AppTheme.borderColor)
                    
                    Button(action: {
                        uploadManager.cancelAllUploads()
                        isPresented = false
                    }) {
                        Text("Cancel All Uploads")
                            .font(AppTheme.bodyFont.bold())
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(AppTheme.cardBackground)
                            .cornerRadius(10)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
            }
        }
        .background(AppTheme.primaryBackground)
        .cornerRadius(20, corners: [.topLeft, .topRight])
    }
}

// MARK: - Upload Task Row

struct UploadTaskRow: View {
    let task: MediaUploadTask
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon
            statusIcon
                .font(.title3)
                .frame(width: 32)
            
            // File Info
            VStack(alignment: .leading, spacing: 4) {
                Text(task.fileName)
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    Text(formatFileSize(task.fileSize))
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    if task.status == .uploading {
                        Text("• \(Int(task.progress * 100))%")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.accentPrimary)
                    } else if task.status == .failed, let error = task.error {
                        Text("• \(error)")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.errorText)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
            
            // Status/Action
            statusView
        }
        .padding(12)
        .background(AppTheme.cardBackground)
        .cornerRadius(8)
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch task.status {
        case .pending:
            Image(systemName: "clock.fill")
                .foregroundColor(AppTheme.secondaryText)
        case .uploading:
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentPrimary))
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(AppTheme.successText)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.errorText)
        case .cancelled:
            Image(systemName: "xmark.circle.fill")
                .foregroundColor(AppTheme.secondaryText)
        }
    }
    
    @ViewBuilder
    private var statusView: some View {
        switch task.status {
        case .pending:
            Text("Queued")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
        case .uploading:
            ProgressView(value: task.progress)
                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentPrimary))
                .frame(width: 24, height: 24)
        case .completed:
            EmptyView()
        case .failed:
            Button(action: {
                MediaUploadManager.shared.retryUpload(taskId: task.id) { _ in }
            }) {
                Text("Retry")
                    .font(AppTheme.captionFont.bold())
                    .foregroundColor(AppTheme.accentPrimary)
            }
        case .cancelled:
            Text("Cancelled")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
        }
    }
    
    private func formatFileSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Helper Extension for Rounded Corners

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - Theme Extensions

extension AppTheme {
    static var successText: Color {
        Color.green
    }
    
    static var errorText: Color {
        Color.red
    }
}
