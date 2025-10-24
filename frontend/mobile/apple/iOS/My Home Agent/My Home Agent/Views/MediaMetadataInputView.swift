import SwiftUI

/// View for inputting metadata before uploading media files
struct MediaMetadataInputView: View {
    let files: [URL]
    let propertyId: String
    let onUpload: ([MediaUploadTask]) -> Void
    let onCancel: () -> Void
    
    @StateObject private var viewModel = MediaMetadataViewModel()
    @State private var currentFileIndex = 0
    @State private var fileMetadata: [FileMetadata]
    
    init(files: [URL], propertyId: String, onUpload: @escaping ([MediaUploadTask]) -> Void, onCancel: @escaping () -> Void) {
        self.propertyId = propertyId
        self.onUpload = onUpload
        self.onCancel = onCancel
        
        // Expand files to include floorplans for USDZ files
        var expandedFiles: [URL] = []
        for file in files {
            print("📄 Processing file: \(file.lastPathComponent), extension: \(file.pathExtension)")
            
            // Verify file exists
            let fileExists = FileManager.default.fileExists(atPath: file.path)
            print("📄 File exists: \(fileExists) at \(file.path)")
            
            if fileExists {
                expandedFiles.append(file)
                
                // If this is a USDZ file, check for associated floorplan
                if file.pathExtension.lowercased() == "usdz" {
                    print("📄 Detected USDZ file, looking for floorplan...")
                    if let floorplanURL = Self.findFloorplanForUSDZ(file) {
                        let floorplanExists = FileManager.default.fileExists(atPath: floorplanURL.path)
                        print("📎 Found floorplan: \(floorplanURL.lastPathComponent), exists: \(floorplanExists)")
                        if floorplanExists {
                            expandedFiles.append(floorplanURL)
                        }
                    } else {
                        print("📎 No floorplan found for USDZ")
                    }
                }
            } else {
                print("❌ File does not exist, skipping: \(file.path)")
            }
        }
        
        print("📄 Total files after expansion: \(expandedFiles.count)")
        self.files = expandedFiles
        
        // Initialize metadata for all files
        _fileMetadata = State(initialValue: expandedFiles.map { file in
            let fileName = file.lastPathComponent
            let mimeType = Self.getMimeType(for: file)
            let isUSDZ = file.pathExtension.lowercased() == "usdz"
            let defaultMediaType = isUSDZ ? "FILE" : (mimeType.starts(with: "video/") ? "VIDEO" : "IMAGE")
            let defaultMediaSubType = isUSDZ ? "FLOORPLAN" : "REGULAR"
            
            return FileMetadata(
                fileURL: file,
                title: fileName,
                description: "",
                mediaType: defaultMediaType,
                mediaSubType: defaultMediaSubType,
                locationType: "INTERIOR",
                locationSubType: ""
            )
        })
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                if fileMetadata.isEmpty {
                    ProgressView("Preparing files...")
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                } else if viewModel.isLoading {
                    ProgressView("Loading options...")
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                } else {
                    VStack(spacing: 0) {
                        // Progress indicator
                        if files.count > 1 {
                            HStack {
                                Text("File \(currentFileIndex + 1) of \(files.count)")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                Spacer()
                            }
                            .padding()
                            .background(AppTheme.cardBackground)
                        }
                        
                        ScrollView {
                            VStack(spacing: 20) {
                                // File preview
                                if let currentFile = files[safe: currentFileIndex] {
                                    FilePreviewCard(fileURL: currentFile)
                                }
                                
                                // Metadata form
                                VStack(spacing: 16) {
                                    // Title
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Title")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        TextField("Enter title", text: $fileMetadata[currentFileIndex].title)
                                            .textFieldStyle(RoundedBorderTextFieldStyle())
                                    }
                                    
                                    // Description
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Description (Optional)")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        TextField("Enter description", text: $fileMetadata[currentFileIndex].description)
                                            .textFieldStyle(RoundedBorderTextFieldStyle())
                                    }
                                    
                                    // Media Type
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Media Type")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        Picker("Media Type", selection: $fileMetadata[currentFileIndex].mediaType) {
                                            ForEach(viewModel.mediaTypes, id: \.type) { type in
                                                Text(type.label).tag(type.type)
                                            }
                                        }
                                        .pickerStyle(MenuPickerStyle())
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding()
                                        .background(AppTheme.cardBackground)
                                        .cornerRadius(8)
                                    }
                                    
                                    // Media Sub-Type
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Media Sub-Type")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        Picker("Media Sub-Type", selection: $fileMetadata[currentFileIndex].mediaSubType) {
                                            ForEach(viewModel.mediaSubTypes, id: \.type) { subType in
                                                Text(subType.label).tag(subType.type)
                                            }
                                        }
                                        .pickerStyle(MenuPickerStyle())
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding()
                                        .background(AppTheme.cardBackground)
                                        .cornerRadius(8)
                                    }
                                    
                                    // Location Type
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Location")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        Picker("Location", selection: $fileMetadata[currentFileIndex].locationType) {
                                            ForEach(viewModel.locationTypes, id: \.type) { type in
                                                Text(type.label).tag(type.type)
                                            }
                                        }
                                        .pickerStyle(MenuPickerStyle())
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding()
                                        .background(AppTheme.cardBackground)
                                        .cornerRadius(8)
                                        .onChange(of: fileMetadata[currentFileIndex].locationType) { _, newValue in
                                            // Load location sub-types when location type changes
                                            Task {
                                                await viewModel.loadLocationSubTypes(for: newValue)
                                                // Reset sub-type to first available option
                                                if let firstSubType = viewModel.locationSubTypes.first {
                                                    fileMetadata[currentFileIndex].locationSubType = firstSubType.type
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Location Sub-Type
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Specific Location")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        
                                        if viewModel.locationSubTypes.isEmpty {
                                            Text("No specific locations available")
                                                .font(AppTheme.captionFont)
                                                .foregroundColor(AppTheme.secondaryText)
                                                .padding()
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .background(AppTheme.cardBackground)
                                                .cornerRadius(8)
                                        } else {
                                            Picker("Specific Location", selection: $fileMetadata[currentFileIndex].locationSubType) {
                                                ForEach(viewModel.locationSubTypes, id: \.type) { subType in
                                                    Text(subType.label).tag(subType.type)
                                                }
                                            }
                                            .pickerStyle(MenuPickerStyle())
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding()
                                            .background(AppTheme.cardBackground)
                                            .cornerRadius(8)
                                        }
                                    }
                                }
                                .padding()
                            }
                        }
                        
                        // Navigation buttons
                        HStack(spacing: 12) {
                            if currentFileIndex > 0 {
                                Button(action: {
                                    currentFileIndex -= 1
                                }) {
                                    Text("Previous")
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(AppTheme.accentPrimary)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(AppTheme.cardBackground)
                                        .cornerRadius(10)
                                }
                            }
                            
                            if currentFileIndex < files.count - 1 {
                                Button(action: {
                                    currentFileIndex += 1
                                }) {
                                    Text("Next")
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(AppTheme.buttonBackground)
                                        .cornerRadius(10)
                                }
                            } else {
                                Button(action: {
                                    uploadFiles()
                                }) {
                                    Text("Upload All")
                                        .font(AppTheme.bodyFont.bold())
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(AppTheme.accentPrimary)
                                        .cornerRadius(10)
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Add Media Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                }
            }
        }
        .onAppear {
            Task {
                await viewModel.loadMediaTypes()
                await viewModel.loadLocationTypes()
                
                // Load initial location sub-types for the default location type
                if !fileMetadata.isEmpty {
                    let initialLocationType = fileMetadata[0].locationType
                    await viewModel.loadLocationSubTypes(for: initialLocationType)
                    
                    // Set the initial location sub-type to the first available option
                    if let firstSubType = viewModel.locationSubTypes.first {
                        for index in fileMetadata.indices {
                            fileMetadata[index].locationSubType = firstSubType.type
                        }
                    }
                }
            }
        }
    }
    
    private static func getMimeType(for url: URL) -> String {
        let fileExtension = url.pathExtension.lowercased()
        switch fileExtension {
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "gif": return "image/gif"
        case "mp4": return "video/mp4"
        case "mov": return "video/quicktime"
        case "usdz": return "model/vnd.usdz+zip"
        default: return "application/octet-stream"
        }
    }
    
    private static func findFloorplanForUSDZ(_ usdzURL: URL) -> URL? {
        // Get the scan ID from the USDZ filename (assuming format: scanId.usdz)
        let scanId = usdzURL.deletingPathExtension().lastPathComponent
        
        // Check if this USDZ file is from a RoomScan
        let scans = RoomScanStorageService.shared.getAllScans()
        if let scan = scans.first(where: { $0.fileURL == usdzURL || $0.id == scanId }) {
            return scan.floorplanURL
        }
        
        return nil
    }
    
    private func uploadFiles() {
        let tasks = fileMetadata.compactMap { metadata -> MediaUploadTask? in
            guard let attributes = try? FileManager.default.attributesOfItem(atPath: metadata.fileURL.path),
                  let fileSize = attributes[.size] as? Int64 else {
                return nil
            }
            
            return MediaUploadTask(
                id: UUID().uuidString,
                fileURL: metadata.fileURL,
                fileName: metadata.fileURL.lastPathComponent,
                fileSize: fileSize,
                mimeType: Self.getMimeType(for: metadata.fileURL),
                propertyId: propertyId,
                title: metadata.title,
                description: metadata.description,
                mediaType: metadata.mediaType,
                mediaSubType: metadata.mediaSubType,
                locationType: metadata.locationType,
                locationSubType: metadata.locationSubType
            )
        }
        
        onUpload(tasks)
    }
}

// MARK: - File Metadata Model

struct FileMetadata {
    let fileURL: URL
    var title: String
    var description: String
    var mediaType: String
    var mediaSubType: String
    var locationType: String
    var locationSubType: String
}

// MARK: - File Preview Card

struct FilePreviewCard: View {
    let fileURL: URL
    
    var body: some View {
        VStack {
            if isImage(fileURL) {
                if let uiImage = UIImage(contentsOfFile: fileURL.path) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 200)
                        .cornerRadius(12)
                }
            } else if isVideo(fileURL) {
                ZStack {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(height: 200)
                        .cornerRadius(12)
                    
                    VStack {
                        Image(systemName: "video.fill")
                            .font(.system(size: 50))
                            .foregroundColor(AppTheme.accentPrimary)
                        Text("Video")
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
            }
            
            Text(fileURL.lastPathComponent)
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
                .lineLimit(1)
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private func isImage(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        return ["jpg", "jpeg", "png", "gif"].contains(ext)
    }
    
    private func isVideo(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        return ["mp4", "mov"].contains(ext)
    }
}

// MARK: - Array Extension for Safe Access

extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}
