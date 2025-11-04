import SwiftUI
import PhotosUI
import AVFoundation

struct CreateServiceRequestView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = RequestsViewModel()
    @State private var properties: [Property] = []
    @State private var isLoadingProperties = false
    
    // Form fields
    @State private var selectedProperty: Property?
    @State private var title = ""
    @State private var description = ""
    @State private var selectedCategory = "HVAC"
    @State private var selectedPriority: ServiceRequestPriority = .MEDIUM
    @State private var scheduledStart: Date?
    @State private var scheduledEnd: Date?
    @State private var useSchedule = false
    
    // Media attachment
    @State private var selectedMediaItems: [PhotosPickerItem] = []
    @State private var loadedMedia: [MediaItem] = []
    
    struct MediaItem: Identifiable {
        let id = UUID()
        let pickerItem: PhotosPickerItem
        let type: MediaType
        let thumbnail: UIImage?
        let data: Data
        let fileName: String
        let mimeType: String
        
        enum MediaType {
            case image
            case video
        }
    }
    
    // UI state
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var showError = false
    
    let categories = [
        "HVAC", "PLUMBING", "ELECTRICAL", "APPLIANCE",
        "STRUCTURAL", "LANDSCAPING", "CLEANING", "PEST_CONTROL",
        "SECURITY", "OTHER"
    ]
    
    var body: some View {
        NavigationView {
            mainContent
        }
        .task {
            await loadProperties()
        }
    }
    
    private var mainContent: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                        propertySelectionSection
                        
                        titleSection
                        
                        descriptionSection
                        
                        categorySection
                        
                        prioritySection
                        
                        scheduleSection
                        
                        photoAttachmentSection
                        
                        submitButton
                    }
                    .padding()
                }
            }
            .navigationTitle("New Service Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.primaryText)
                    .font(AppTheme.bodyFont)
                }
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "An unknown error occurred")
            }
    }
    
    // MARK: - Section Views
    
    private var propertySelectionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Property")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            if isLoadingProperties {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
            } else if properties.isEmpty {
                Text("No properties available")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(AppTheme.secondaryText)
            } else {
                propertyMenu
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
    
    private var propertyMenu: some View {
        Menu {
            ForEach(properties) { property in
                Button(action: {
                    selectedProperty = property
                }) {
                    Text(property.title)
                }
            }
        } label: {
            HStack {
                Text(selectedProperty?.title ?? "Select a property")
                    .foregroundColor(selectedProperty == nil ? AppTheme.secondaryText : AppTheme.primaryText)
                Spacer()
                Image(systemName: "chevron.down")
                    .foregroundColor(AppTheme.secondaryText)
            }
            .padding()
            .background(AppTheme.inputBackground)
            .cornerRadius(AppTheme.cornerRadius)
        }
    }
    
    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Title")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            TextField("Enter a brief title", text: $title)
                .padding()
                .background(AppTheme.inputBackground)
                .cornerRadius(AppTheme.cornerRadius)
                .foregroundColor(AppTheme.textPrimary)
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Description")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            TextEditor(text: $description)
                .frame(minHeight: 100)
                .padding(8)
                .background(AppTheme.inputBackground)
                .cornerRadius(AppTheme.cornerRadius)
                .foregroundColor(AppTheme.textPrimary)
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Category")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            categoryMenu
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var categoryMenu: some View {
        Menu {
            ForEach(categories, id: \.self) { category in
                Button(action: {
                    selectedCategory = category
                }) {
                    Text(category.replacingOccurrences(of: "_", with: " ").capitalized)
                }
            }
        } label: {
            HStack {
                Text(selectedCategory.replacingOccurrences(of: "_", with: " ").capitalized)
                    .foregroundColor(AppTheme.primaryText)
                Spacer()
                Image(systemName: "chevron.down")
                    .foregroundColor(AppTheme.secondaryText)
            }
            .padding()
            .background(AppTheme.inputBackground)
            .cornerRadius(AppTheme.cornerRadius)
        }
    }
    
    private var prioritySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Priority")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            priorityMenu
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var priorityMenu: some View {
        Menu {
            Button(action: { selectedPriority = .LOW }) {
                Label("Low", systemImage: selectedPriority == .LOW ? "checkmark" : "")
            }
            Button(action: { selectedPriority = .MEDIUM }) {
                Label("Medium", systemImage: selectedPriority == .MEDIUM ? "checkmark" : "")
            }
            Button(action: { selectedPriority = .HIGH }) {
                Label("High", systemImage: selectedPriority == .HIGH ? "checkmark" : "")
            }
            Button(action: { selectedPriority = .URGENT }) {
                Label("Urgent", systemImage: selectedPriority == .URGENT ? "checkmark" : "")
            }
        } label: {
            HStack {
                Text(selectedPriority.rawValue.capitalized)
                    .foregroundColor(priorityColor(selectedPriority))
                Spacer()
                Image(systemName: "chevron.down")
                    .foregroundColor(AppTheme.secondaryText)
            }
            .padding()
            .background(AppTheme.inputBackground)
            .cornerRadius(AppTheme.cornerRadius)
        }
    }
    
    private var scheduleSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $useSchedule) {
                Text("Schedule Service")
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
            }
            .tint(AppTheme.accentColor)
            
            if useSchedule {
                scheduleDatePickers
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
    
    private var scheduleDatePickers: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Start Date")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
            
            DatePicker("", selection: Binding(
                get: { scheduledStart ?? Date() },
                set: { scheduledStart = $0 }
            ), displayedComponents: [.date, .hourAndMinute])
            .labelsHidden()
            .datePickerStyle(.compact)
            
            Text("End Date")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
            
            DatePicker("", selection: Binding(
                get: { scheduledEnd ?? Date() },
                set: { scheduledEnd = $0 }
            ), displayedComponents: [.date, .hourAndMinute])
            .labelsHidden()
            .datePickerStyle(.compact)
        }
    }
    
    private var photoAttachmentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Attach Media (Optional)")
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            Text("Photos and videos (JPG, PNG, GIF, MP4, MOV)")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
            
            // Media picker button - supports both images and videos
            PhotosPicker(
                selection: $selectedMediaItems,
                maxSelectionCount: 10,
                matching: .any(of: [.images, .videos])
            ) {
                HStack {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.title3)
                    Text("Select Media")
                        .font(AppTheme.bodyFont)
                    Spacer()
                    if !loadedMedia.isEmpty {
                        Text("\(loadedMedia.count)")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                .padding()
                .background(AppTheme.inputBackground)
                .foregroundColor(AppTheme.primaryText)
                .cornerRadius(AppTheme.cornerRadius)
            }
            .onChange(of: selectedMediaItems) { oldValue, newValue in
                Task {
                    await loadMediaItems(newValue)
                }
            }
            
            // Media preview grid
            if !loadedMedia.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(loadedMedia.indices, id: \.self) { index in
                            ZStack(alignment: .topTrailing) {
                                // Thumbnail
                                if let thumbnail = loadedMedia[index].thumbnail {
                                    ZStack {
                                        Image(uiImage: thumbnail)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 80, height: 80)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                        
                                        // Video indicator
                                        if loadedMedia[index].type == .video {
                                            Image(systemName: "play.circle.fill")
                                                .font(.title)
                                                .foregroundColor(.white)
                                                .shadow(radius: 2)
                                        }
                                    }
                                } else {
                                    // Placeholder for items without thumbnails
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(AppTheme.borderColor)
                                        .frame(width: 80, height: 80)
                                        .overlay(
                                            Image(systemName: loadedMedia[index].type == .video ? "video.fill" : "photo.fill")
                                                .foregroundColor(AppTheme.secondaryText)
                                        )
                                }
                                
                                // Remove button
                                Button(action: {
                                    loadedMedia.remove(at: index)
                                    selectedMediaItems.remove(at: index)
                                }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white)
                                        .background(Circle().fill(Color.black.opacity(0.6)))
                                }
                                .padding(4)
                            }
                        }
                    }
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
    
    private var submitButton: some View {
        Button(action: submitRequest) {
            HStack {
                if isSubmitting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }
                Text(isSubmitting ? "Creating..." : "Create Service Request")
                    .font(AppTheme.bodyFont.bold())
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isFormValid ? AppTheme.buttonBackground : AppTheme.borderColor.opacity(0.5))
            .foregroundColor(isFormValid ? AppTheme.buttonText : AppTheme.disabledText)
            .cornerRadius(12)
        }
        .disabled(!isFormValid || isSubmitting)
    }
    
    // MARK: - Helper Properties
    
    private var isFormValid: Bool {
        return selectedProperty != nil &&
               !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
               !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    private func loadMediaItems(_ items: [PhotosPickerItem]) async {
        loadedMedia.removeAll()
        
        for item in items {
            // Try to load as image first
            if let data = try? await item.loadTransferable(type: Data.self) {
                // Determine if it's an image or video based on supported identifiers
                let isVideo = item.supportedContentTypes.contains { type in
                    type.identifier.contains("video") || 
                    type.identifier.contains("movie") ||
                    type.identifier.contains("quicktime")
                }
                
                if isVideo {
                    // Handle video
                    let tempDir = FileManager.default.temporaryDirectory
                    let fileName = "temp_video_\(UUID().uuidString).mov"
                    let fileURL = tempDir.appendingPathComponent(fileName)
                    
                    do {
                        try data.write(to: fileURL)
                        
                        // Generate thumbnail from video
                        let thumbnail = generateVideoThumbnail(from: fileURL)
                        
                        // Determine mime type
                        let mimeType: String
                        if fileName.hasSuffix(".mp4") {
                            mimeType = "video/mp4"
                        } else {
                            mimeType = "video/quicktime"
                        }
                        
                        let mediaItem = MediaItem(
                            pickerItem: item,
                            type: .video,
                            thumbnail: thumbnail,
                            data: data,
                            fileName: fileName,
                            mimeType: mimeType
                        )
                        
                        await MainActor.run {
                            loadedMedia.append(mediaItem)
                        }
                        
                        // Clean up temp file
                        try? FileManager.default.removeItem(at: fileURL)
                    } catch {
                        print("Error processing video: \(error)")
                    }
                } else if let image = UIImage(data: data) {
                    // Handle image
                    let fileName: String
                    let mimeType: String
                    
                    // Determine file type from content type
                    if let contentType = item.supportedContentTypes.first {
                        if contentType.identifier.contains("png") {
                            fileName = "image_\(UUID().uuidString).png"
                            mimeType = "image/png"
                        } else if contentType.identifier.contains("gif") {
                            fileName = "image_\(UUID().uuidString).gif"
                            mimeType = "image/gif"
                        } else {
                            fileName = "image_\(UUID().uuidString).jpg"
                            mimeType = "image/jpeg"
                        }
                    } else {
                        fileName = "image_\(UUID().uuidString).jpg"
                        mimeType = "image/jpeg"
                    }
                    
                    let mediaItem = MediaItem(
                        pickerItem: item,
                        type: .image,
                        thumbnail: image,
                        data: data,
                        fileName: fileName,
                        mimeType: mimeType
                    )
                    
                    await MainActor.run {
                        loadedMedia.append(mediaItem)
                    }
                }
            }
        }
    }
    
    private func generateVideoThumbnail(from url: URL) -> UIImage? {
        let asset = AVAsset(url: url)
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        
        do {
            let cgImage = try imageGenerator.copyCGImage(at: .zero, actualTime: nil)
            return UIImage(cgImage: cgImage)
        } catch {
            print("Error generating video thumbnail: \(error)")
            return nil
        }
    }
    
    private func loadProperties() async {
        isLoadingProperties = true
        do {
            properties = try await PropertyService.shared.getProperties()
            if !properties.isEmpty && selectedProperty == nil {
                selectedProperty = properties.first
            }
        } catch {
            errorMessage = "Failed to load properties: \(error.localizedDescription)"
            showError = true
        }
        isLoadingProperties = false
    }
    
    private func submitRequest() {
        guard let property = selectedProperty else { return }
        
        isSubmitting = true
        errorMessage = nil
        
        Task {
            do {
                let newRequest = try await viewModel.createServiceRequest(
                    propertyId: property.id,
                    title: title,
                    description: description,
                    category: selectedCategory,
                    priority: selectedPriority,
                    scheduledStart: useSchedule ? scheduledStart : nil,
                    scheduledEnd: useSchedule ? scheduledEnd : nil
                )
                
                // Upload media if any were selected
                if !loadedMedia.isEmpty {
                    try await uploadMedia(for: newRequest.id)
                }
                
                // Success - dismiss the view
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showError = true
                    isSubmitting = false
                }
            }
        }
    }
    
    private func uploadMedia(for requestId: String) async throws {
        for (index, mediaItem) in loadedMedia.enumerated() {
            // Use the already loaded data
            let fileData = mediaItem.data
            let fileName = mediaItem.fileName
            let mimeType = mediaItem.mimeType
            
            // Upload via NetworkManager
            let endpoint = "/api/media/services/requests/\(requestId)/upload"
            
            var request = URLRequest(url: URL(string: NetworkManager.shared.baseURL + endpoint)!)
            request.httpMethod = "POST"
            
            // Create multipart form data
            let boundary = "Boundary-\(UUID().uuidString)"
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            
            var body = Data()
            
            // Add file
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(fileData)
            body.append("\r\n".data(using: .utf8)!)
            
            // Add metadata fields
            let mediaTypeString = mediaItem.type == .video ? "VIDEO" : "PHOTO"
            let metadata: [String: String] = [
                "title": "Service Request \(mediaItem.type == .video ? "Video" : "Photo") \(index + 1)",
                "description": "\(mediaItem.type == .video ? "Video" : "Photo") attached to service request",
                "media_type": mediaTypeString,
                "media_sub_type": "REGULAR",
                "location_type": "SERVICE_REQUEST",
                "location_sub_type": ""
            ]
            
            for (key, value) in metadata {
                body.append("--\(boundary)\r\n".data(using: .utf8)!)
                body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
                body.append("\(value)\r\n".data(using: .utf8)!)
            }
            
            body.append("--\(boundary)--\r\n".data(using: .utf8)!)
            
            // Perform upload
            let (_, response) = try await URLSession.shared.upload(for: request, from: body)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                throw NSError(domain: "MediaUpload", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to upload \(mediaItem.type == .video ? "video" : "photo")"])
            }
        }
    }
    
    private func priorityColor(_ priority: ServiceRequestPriority) -> Color {
        switch priority {
        case .URGENT:
            return Color.red
        case .HIGH:
            return Color.orange
        case .MEDIUM:
            return Color.yellow
        case .LOW:
            return Color.green
        case .UNKNOWN:
            return Color.gray
        }
    }
}

struct CreateServiceRequestView_Previews: PreviewProvider {
    static var previews: some View {
        CreateServiceRequestView()
    }
}
