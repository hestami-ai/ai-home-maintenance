import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import OSLog

/// SwiftUI wrapper for media selection (gallery and camera)
struct MediaPickerView: UIViewControllerRepresentable {
    @Binding var selectedFiles: [URL]
    @Environment(\.presentationMode) var presentationMode
    
    let sourceType: SourceType
    let selectionLimit: Int
    
    enum SourceType {
        case photoLibrary
        case camera
    }
    
    func makeUIViewController(context: Context) -> UIViewController {
        switch sourceType {
        case .photoLibrary:
            return makePHPickerViewController(context: context)
        case .camera:
            return makeImagePickerController(context: context)
        }
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // No updates needed
    }
    
    // MARK: - PHPicker (Photo Library)
    
    private func makePHPickerViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = selectionLimit
        config.filter = .any(of: [.images, .videos])
        
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }
    
    // MARK: - UIImagePickerController (Camera)
    
    private func makeImagePickerController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.mediaTypes = ["public.image", "public.movie"]
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }
    
    // MARK: - Coordinator
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: MediaPickerView
        
        init(_ parent: MediaPickerView) {
            self.parent = parent
        }
        
        // MARK: - PHPickerViewControllerDelegate
        
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.presentationMode.wrappedValue.dismiss()
            
            guard !results.isEmpty else { return }
            
            let group = DispatchGroup()
            var fileURLs: [URL] = []
            
            for result in results {
                group.enter()
                
                // Check if it's an image or video
                if result.itemProvider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    loadImage(from: result.itemProvider) { url in
                        if let url = url {
                            fileURLs.append(url)
                        }
                        group.leave()
                    }
                } else if result.itemProvider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                    loadVideo(from: result.itemProvider) { url in
                        if let url = url {
                            fileURLs.append(url)
                        }
                        group.leave()
                    }
                }
            }
            
            group.notify(queue: .main) {
                self.parent.selectedFiles = fileURLs
            }
        }
        
        private func loadImage(from itemProvider: NSItemProvider, completion: @escaping (URL?) -> Void) {
            itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
                guard let url = url, error == nil else {
                    AppLogger.media.error("Failed to load image: \(error?.localizedDescription ?? "unknown error", privacy: .public)")
                    completion(nil)
                    return
                }
                
                // Copy to temp directory with proper extension
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension(url.pathExtension.isEmpty ? "jpg" : url.pathExtension)
                
                do {
                    if FileManager.default.fileExists(atPath: tempURL.path) {
                        try FileManager.default.removeItem(at: tempURL)
                    }
                    try FileManager.default.copyItem(at: url, to: tempURL)
                    completion(tempURL)
                } catch {
                    AppLogger.error("Failed to copy image", error: error, category: AppLogger.media)
                    completion(nil)
                }
            }
        }
        
        private func loadVideo(from itemProvider: NSItemProvider, completion: @escaping (URL?) -> Void) {
            itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
                guard let url = url, error == nil else {
                    AppLogger.media.error("Failed to load video: \(error?.localizedDescription ?? "unknown error", privacy: .public)")
                    completion(nil)
                    return
                }
                
                // Copy to temp directory
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension(url.pathExtension.isEmpty ? "mp4" : url.pathExtension)
                
                do {
                    if FileManager.default.fileExists(atPath: tempURL.path) {
                        try FileManager.default.removeItem(at: tempURL)
                    }
                    try FileManager.default.copyItem(at: url, to: tempURL)
                    completion(tempURL)
                } catch {
                    AppLogger.error("Failed to copy video", error: error, category: AppLogger.media)
                    completion(nil)
                }
            }
        }
        
        // MARK: - UIImagePickerControllerDelegate
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            parent.presentationMode.wrappedValue.dismiss()
            
            // Handle image from camera
            if let image = info[.originalImage] as? UIImage {
                saveImageToTempFile(image) { url in
                    if let url = url {
                        DispatchQueue.main.async {
                            self.parent.selectedFiles = [url]
                        }
                    }
                }
            }
            // Handle video from camera
            else if let videoURL = info[.mediaURL] as? URL {
                // Copy to temp directory
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension("mov")
                
                do {
                    if FileManager.default.fileExists(atPath: tempURL.path) {
                        try FileManager.default.removeItem(at: tempURL)
                    }
                    try FileManager.default.copyItem(at: videoURL, to: tempURL)
                    
                    DispatchQueue.main.async {
                        self.parent.selectedFiles = [tempURL]
                    }
                } catch {
                    AppLogger.error("Failed to copy video from camera", error: error, category: AppLogger.media)
                }
            }
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.presentationMode.wrappedValue.dismiss()
        }
        
        private func saveImageToTempFile(_ image: UIImage, completion: @escaping (URL?) -> Void) {
            DispatchQueue.global(qos: .userInitiated).async {
                guard let imageData = image.jpegData(compressionQuality: 0.9) else {
                    completion(nil)
                    return
                }
                
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension("jpg")
                
                do {
                    try imageData.write(to: tempURL)
                    completion(tempURL)
                } catch {
                    AppLogger.error("Failed to save image", error: error, category: AppLogger.media)
                    completion(nil)
                }
            }
        }
    }
}

// MARK: - Media Selection Sheet

struct MediaSelectionSheet: View {
    @Binding var isPresented: Bool
    @Binding var selectedFiles: [URL]
    @State private var showingPhotoPicker = false
    @State private var showingCamera = false
    @State private var showingRoomScanPicker = false
    
    let selectionLimit: Int
    let propertyId: String?
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Photo Library Option
                Button(action: {
                    showingPhotoPicker = true
                }) {
                    HStack {
                        Image(systemName: "photo.on.rectangle")
                            .font(.title2)
                            .foregroundColor(AppTheme.accentPrimary)
                            .frame(width: 44)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Choose from Library")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            Text("Select up to \(selectionLimit) photos or videos")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal)
                .padding(.top)
                
                // Camera Option
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button(action: {
                        showingCamera = true
                    }) {
                        HStack {
                            Image(systemName: "camera.fill")
                                .font(.title2)
                                .foregroundColor(AppTheme.accentPrimary)
                                .frame(width: 44)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Take Photo or Video")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                Text("Capture with camera")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        .padding()
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .padding(.horizontal)
                    .padding(.top, 12)
                }
                
                // Room Scan Option
                Button(action: {
                    showingRoomScanPicker = true
                }) {
                    HStack {
                        Image(systemName: "cube.transparent")
                            .font(.title2)
                            .foregroundColor(AppTheme.accentPrimary)
                            .frame(width: 44)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Choose Room Scan")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            Text("Select a saved 3D room scan")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal)
                .padding(.top, 12)
                
                Spacer()
            }
            .background(AppTheme.primaryBackground)
            .navigationTitle("Add Media")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                }
            }
            .sheet(isPresented: $showingPhotoPicker) {
                MediaPickerView(
                    selectedFiles: $selectedFiles,
                    sourceType: .photoLibrary,
                    selectionLimit: selectionLimit
                )
            }
            .sheet(isPresented: $showingCamera) {
                MediaPickerView(
                    selectedFiles: $selectedFiles,
                    sourceType: .camera,
                    selectionLimit: 1
                )
            }
            .sheet(isPresented: $showingRoomScanPicker) {
                RoomScanPickerView(
                    selectedFiles: $selectedFiles,
                    propertyId: propertyId
                )
            }
            .onChange(of: selectedFiles) { oldFiles, newFiles in
                // Dismiss the selection sheet when files are selected
                if !newFiles.isEmpty {
                    isPresented = false
                }
            }
        }
    }
}

// MARK: - Room Scan Picker View

struct RoomScanPickerView: View {
    @Binding var selectedFiles: [URL]
    @Environment(\.dismiss) var dismiss
    let propertyId: String?
    
    @State private var scans: [RoomScan] = []
    @State private var selectedScan: RoomScan?
    
    var body: some View {
        NavigationView {
            List {
                ForEach(scans) { scan in
                    Button(action: {
                        selectedScan = scan
                        
                        // Verify file exists
                        let fileExists = FileManager.default.fileExists(atPath: scan.fileURL.path)
                        #if DEBUG
                        AppLogger.storage.debug("Room scan file exists: \(fileExists, privacy: .public) at \(scan.fileURL.path, privacy: .public)")
                        #endif
                        
                        if fileExists {
                            // Add USDZ file URL
                            selectedFiles = [scan.fileURL]
                            AppLogger.storage.info("Selected room scan: \(scan.name, privacy: .public)")
                            dismiss()
                        } else {
                            AppLogger.storage.error("Room scan file not found at: \(scan.fileURL.path, privacy: .public)")
                        }
                    }) {
                        HStack {
                            Image(systemName: "cube.transparent")
                                .font(.title2)
                                .foregroundColor(AppTheme.accentPrimary)
                                .frame(width: 44)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(scan.name)
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                Text(formatDate(scan.createdAt))
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            
                            Spacer()
                            
                            if scan.floorplanURL != nil {
                                Image(systemName: "map")
                                    .foregroundColor(AppTheme.accentPrimary)
                            }
                        }
                    }
                }
            }
            .listStyle(PlainListStyle())
            .background(AppTheme.primaryBackground)
            .navigationTitle("Select Room Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                }
            }
            .onAppear {
                loadScans()
            }
        }
    }
    
    private func loadScans() {
        if let propertyId = propertyId {
            scans = RoomScanStorageService.shared.getScans(forPropertyId: propertyId)
        } else {
            scans = RoomScanStorageService.shared.getAllScans()
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
