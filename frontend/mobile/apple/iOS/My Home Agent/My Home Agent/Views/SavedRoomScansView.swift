import SwiftUI
import QuickLook

struct SavedRoomScansView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var scans: [RoomScan] = []
    @State private var selectedScan: RoomScan?
    @State private var showDeleteAlert = false
    @State private var scanToDelete: RoomScan?
    @State private var showQuickLook = false
    @State private var quickLookURL: URL?
    @State private var showUploadDialog = false
    @State private var scanToUpload: RoomScan?
    @State private var storageSize: String = ""
    
    private let storageService = RoomScanStorageService.shared
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                VStack {
                    if scans.isEmpty {
                        emptyStateView
                    } else {
                        scanListView
                    }
                }
            }
            .navigationTitle("Saved Scans")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.accentColor)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(storageSize)
                            .font(.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                        Text("Storage")
                            .font(.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
            }
        }
        .onAppear {
            loadScans()
            updateStorageSize()
        }
        .sheet(isPresented: $showQuickLook) {
            if let url = quickLookURL {
                QuickLookView(url: url)
            }
        }
        .sheet(isPresented: $showUploadDialog) {
            if let scan = scanToUpload {
                UploadScanDialog(
                    scan: scan,
                    onUpload: { propertyId in
                        Task {
                            await uploadScan(scan: scan, propertyId: propertyId)
                        }
                    },
                    onCancel: {
                        showUploadDialog = false
                        scanToUpload = nil
                    }
                )
            }
        }
        .alert("Delete Scan", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {
                scanToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let scan = scanToDelete {
                    deleteScan(scan)
                }
            }
        } message: {
            Text("Are you sure you want to delete this scan? This action cannot be undone.")
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 70))
                .foregroundColor(AppTheme.secondaryText)
            
            Text("No Saved Scans")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Your saved room scans will appear here")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var scanListView: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(scans) { scan in
                    ScanCard(
                        scan: scan,
                        onView: { viewScan(scan) },
                        onUpload: {
                            scanToUpload = scan
                            showUploadDialog = true
                        },
                        onDelete: {
                            scanToDelete = scan
                            showDeleteAlert = true
                        }
                    )
                }
            }
            .padding()
        }
    }
    
    private func loadScans() {
        scans = storageService.getAllScans()
        print("📂 SavedRoomScansView: Loaded \(scans.count) scans")
        for scan in scans {
            print("   - \(scan.name) (ID: \(scan.id))")
        }
    }
    
    private func updateStorageSize() {
        storageSize = storageService.getStorageSizeFormatted()
    }
    
    private func viewScan(_ scan: RoomScan) {
        quickLookURL = scan.fileURL
        showQuickLook = true
    }
    
    private func uploadScan(scan: RoomScan, propertyId: String) async {
        do {
            _ = try await RoomScanUploadService.shared.uploadRoomScan(
                scan: scan,
                propertyId: propertyId
            )
            
            // Reload scans to update status
            await MainActor.run {
                loadScans()
                showUploadDialog = false
                scanToUpload = nil
                HapticManager.shared.playNotificationFeedback(type: .success)
            }
        } catch {
            await MainActor.run {
                showUploadDialog = false
                scanToUpload = nil
                HapticManager.shared.playNotificationFeedback(type: .error)
            }
        }
    }
    
    private func deleteScan(_ scan: RoomScan) {
        do {
            try storageService.deleteScan(id: scan.id)
            loadScans()
            updateStorageSize()
            scanToDelete = nil
            HapticManager.shared.playNotificationFeedback(type: .success)
        } catch {
            print("Failed to delete scan: \(error)")
            HapticManager.shared.playNotificationFeedback(type: .error)
        }
    }
}

// MARK: - Scan Card Component

struct ScanCard: View {
    let scan: RoomScan
    let onView: () -> Void
    let onUpload: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(scan.name)
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.primaryText)
                        .lineLimit(2)
                    
                    Text(formatDate(scan.createdAt))
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                uploadStatusBadge
            }
            
            HStack(spacing: 12) {
                Button(action: onView) {
                    Label("View", systemImage: "eye")
                        .font(.caption)
                        .foregroundColor(AppTheme.buttonText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(6)
                }
                
                if scan.uploadStatus != .uploaded {
                    Button(action: onUpload) {
                        Label("Upload", systemImage: "icloud.and.arrow.up")
                            .font(.caption)
                            .foregroundColor(AppTheme.buttonText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(AppTheme.accentColor)
                            .cornerRadius(6)
                    }
                    .disabled(scan.uploadStatus == .uploading)
                }
                
                Spacer()
                
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundColor(AppTheme.errorColor)
                        .padding(6)
                }
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
    
    private var uploadStatusBadge: some View {
        Group {
            switch scan.uploadStatus {
            case .notUploaded:
                Label("Local", systemImage: "iphone")
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(4)
            case .uploading:
                Label("Uploading", systemImage: "arrow.up.circle")
                    .font(.caption2)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            case .uploaded:
                Label("Cloud", systemImage: "checkmark.icloud")
                    .font(.caption2)
                    .foregroundColor(.green)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(4)
            case .failed:
                Label("Failed", systemImage: "exclamationmark.triangle")
                    .font(.caption2)
                    .foregroundColor(.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.red.opacity(0.2))
                    .cornerRadius(4)
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - QuickLook View

struct QuickLookView: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(url: url)
    }
    
    class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL
        
        init(url: URL) {
            self.url = url
        }
        
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
            return 1
        }
        
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            return url as QLPreviewItem
        }
    }
}
