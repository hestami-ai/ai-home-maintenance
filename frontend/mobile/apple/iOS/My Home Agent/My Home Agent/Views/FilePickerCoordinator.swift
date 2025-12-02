import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// MARK: - Photo Picker

struct PhotoPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onFilesSelected: ([SelectedFile]) -> Void
    
    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .any(of: [.images, .videos])
        config.selectionLimit = 10  // Allow multiple selections
        config.preferredAssetRepresentationMode = .current
        
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: PhotoPicker
        
        init(_ parent: PhotoPicker) {
            self.parent = parent
        }
        
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.isPresented = false
            
            guard !results.isEmpty else { return }
            
            Task {
                var selectedFiles: [SelectedFile] = []
                
                for result in results {
                    if let file = await loadFile(from: result) {
                        selectedFiles.append(file)
                    }
                }
                
                await MainActor.run {
                    self.parent.onFilesSelected(selectedFiles)
                }
            }
        }
        
        private func loadFile(from result: PHPickerResult) async -> SelectedFile? {
            let itemProvider = result.itemProvider
            
            // Determine file type
            var typeIdentifier: String?
            var fileExtension: String?
            
            if itemProvider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                typeIdentifier = UTType.image.identifier
                fileExtension = "jpg"
            } else if itemProvider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                typeIdentifier = UTType.movie.identifier
                fileExtension = "mov"
            }
            
            guard let typeIdentifier = typeIdentifier else { return nil }
            
            return await withCheckedContinuation { continuation in
                itemProvider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
                    guard let url = url, error == nil else {
                        continuation.resume(returning: nil)
                        return
                    }
                    
                    do {
                        let data = try Data(contentsOf: url)
                        let filename = url.lastPathComponent
                        let mimeType = self.mimeType(for: fileExtension ?? "jpg")
                        
                        // Generate thumbnail for images
                        var thumbnail: UIImage?
                        if typeIdentifier == UTType.image.identifier {
                            thumbnail = UIImage(data: data)
                        }
                        
                        let selectedFile = SelectedFile(
                            data: data,
                            filename: filename,
                            mimeType: mimeType,
                            thumbnail: thumbnail
                        )
                        
                        continuation.resume(returning: selectedFile)
                    } catch {
                        continuation.resume(returning: nil)
                    }
                }
            }
        }
        
        private func mimeType(for fileExtension: String) -> String {
            switch fileExtension.lowercased() {
            case "jpg", "jpeg": return "image/jpeg"
            case "png": return "image/png"
            case "gif": return "image/gif"
            case "mp4": return "video/mp4"
            case "mov": return "video/quicktime"
            default: return "application/octet-stream"
            }
        }
    }
}

// MARK: - Document Picker

struct DocumentPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onFilesSelected: ([SelectedFile]) -> Void
    
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let supportedTypes: [UTType] = [
            .pdf,
            .plainText,
            .text,
            UTType(filenameExtension: "doc") ?? .data,
            UTType(filenameExtension: "docx") ?? .data,
            UTType(filenameExtension: "md") ?? .data,
            UTType(filenameExtension: "usdz") ?? .data
        ]
        
        // Use forOpeningContentTypes (asCopy: false) to get security-scoped access to original files
        // This is more reliable than copying, especially for iCloud and file provider files
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: supportedTypes)
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = true
        picker.shouldShowFileExtensions = true
        
        print("📄 Created document picker for opening (security-scoped access)")
        
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let parent: DocumentPicker
        
        init(_ parent: DocumentPicker) {
            self.parent = parent
        }
        
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            parent.isPresented = false
            
            print("📄 Document picker selected \(urls.count) files")
            
            var selectedFiles: [SelectedFile] = []
            
            for url in urls {
                print("📄 Processing file: \(url.lastPathComponent)")
                print("📄 URL: \(url.absoluteString)")
                
                // Request security-scoped access to the file
                guard url.startAccessingSecurityScopedResource() else {
                    print("❌ Failed to start accessing security-scoped resource for: \(url.lastPathComponent)")
                    continue
                }
                
                // Ensure we stop accessing when done
                defer {
                    url.stopAccessingSecurityScopedResource()
                }
                
                do {
                    // Read the file data
                    let data = try Data(contentsOf: url)
                    let filename = url.lastPathComponent
                    let mimeType = mimeType(for: url.pathExtension)
                    
                    print("✅ Successfully read file: \(filename), size: \(data.count) bytes")
                    
                    let selectedFile = SelectedFile(
                        data: data,
                        filename: filename,
                        mimeType: mimeType,
                        thumbnail: nil
                    )
                    
                    selectedFiles.append(selectedFile)
                } catch {
                    print("❌ Error reading file \(url.lastPathComponent): \(error.localizedDescription)")
                }
            }
            
            print("📄 Calling onFilesSelected with \(selectedFiles.count) files")
            parent.onFilesSelected(selectedFiles)
        }
        
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            parent.isPresented = false
        }
        
        private func mimeType(for fileExtension: String) -> String {
            switch fileExtension.lowercased() {
            case "pdf": return "application/pdf"
            case "txt": return "text/plain"
            case "md": return "text/markdown"
            case "doc": return "application/msword"
            case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            case "usdz": return "model/vnd.usdz+zip"
            default: return "application/octet-stream"
            }
        }
    }
}

// MARK: - Camera Picker

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onImageCaptured: (SelectedFile) -> Void
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        
        init(_ parent: CameraPicker) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            parent.isPresented = false
            
            if let image = info[.originalImage] as? UIImage,
               let data = image.jpegData(compressionQuality: 0.8) {
                let filename = "photo_\(Date().timeIntervalSince1970).jpg"
                let selectedFile = SelectedFile(
                    data: data,
                    filename: filename,
                    mimeType: "image/jpeg",
                    thumbnail: image
                )
                parent.onImageCaptured(selectedFile)
            }
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.isPresented = false
        }
    }
}

// MARK: - Selected File Model

struct SelectedFile {
    let data: Data
    let filename: String
    let mimeType: String
    let thumbnail: UIImage?
}
