//
//  MediaEditView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 10/17/25.
//

import SwiftUI

struct MediaEditView: View {
    let media: Media
    let onSave: (Media) -> Void
    let onCancel: () -> Void
    
    @StateObject private var viewModel = MediaMetadataViewModel()
    @State private var title: String
    @State private var description: String
    @State private var mediaType: String
    @State private var mediaSubType: String
    @State private var locationType: String
    @State private var locationSubType: String
    @State private var isSaving = false
    @State private var saveError: String?
    
    init(media: Media, onSave: @escaping (Media) -> Void, onCancel: @escaping () -> Void) {
        self.media = media
        self.onSave = onSave
        self.onCancel = onCancel
        
        _title = State(initialValue: media.title)
        _description = State(initialValue: media.description)
        _mediaType = State(initialValue: media.mediaType.rawValue)
        _mediaSubType = State(initialValue: media.mediaSubType)
        _locationType = State(initialValue: media.locationType)
        _locationSubType = State(initialValue: media.locationSubType)
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                if viewModel.isLoading {
                    ProgressView("Loading options...")
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentPrimary))
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            // Media preview
                            MediaPreviewCard(media: media)
                            
                            // Metadata form
                            VStack(spacing: 16) {
                                // Title
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Title")
                                        .font(AppTheme.bodyFont.bold())
                                        .foregroundColor(AppTheme.primaryText)
                                    TextField("Enter title", text: $title)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                }
                                
                                // Description
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Description")
                                        .font(AppTheme.bodyFont.bold())
                                        .foregroundColor(AppTheme.primaryText)
                                    TextField("Enter description", text: $description)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                }
                                
                                // Media Type
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Media Type")
                                        .font(AppTheme.bodyFont.bold())
                                        .foregroundColor(AppTheme.primaryText)
                                    Picker("Media Type", selection: $mediaType) {
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
                                    Picker("Media Sub-Type", selection: $mediaSubType) {
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
                                    Text("Location Type")
                                        .font(AppTheme.bodyFont.bold())
                                        .foregroundColor(AppTheme.primaryText)
                                    Picker("Location Type", selection: $locationType) {
                                        Text("Select...").tag("")
                                        ForEach(viewModel.locationTypes, id: \.type) { type in
                                            Text(type.label).tag(type.type)
                                        }
                                    }
                                    .pickerStyle(MenuPickerStyle())
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .background(AppTheme.cardBackground)
                                    .cornerRadius(8)
                                }
                                
                                // Location Sub-Type
                                if !locationType.isEmpty && !viewModel.locationSubTypes.isEmpty {
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Specific Location")
                                            .font(AppTheme.bodyFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        Picker("Specific Location", selection: $locationSubType) {
                                            Text("Select...").tag("")
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
                }
                
                // Loading overlay
                if isSaving {
                    ZStack {
                        Color.black.opacity(0.4)
                            .edgesIgnoringSafeArea(.all)
                        
                        VStack(spacing: 16) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(1.5)
                            
                            Text("Saving...")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(.white)
                        }
                        .padding(30)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(12)
                    }
                }
            }
            .navigationTitle("Edit Media")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                    .foregroundColor(AppTheme.secondaryText)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveChanges()
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                    .disabled(isSaving || title.isEmpty)
                }
            }
            .alert("Save Failed", isPresented: Binding(
                get: { saveError != nil },
                set: { if !$0 { saveError = nil } }
            )) {
                Button("OK", role: .cancel) {
                    saveError = nil
                }
            } message: {
                if let error = saveError {
                    Text(error)
                }
            }
        }
        .onAppear {
            Task {
                await viewModel.loadMediaTypes()
                await viewModel.loadLocationTypes()
                // Load subtypes for current location type
                if !locationType.isEmpty {
                    await viewModel.loadLocationSubTypes(for: locationType)
                }
            }
        }
        .onChange(of: locationType) { oldValue, newValue in
            Task {
                if !newValue.isEmpty {
                    await viewModel.loadLocationSubTypes(for: newValue)
                } else {
                    viewModel.locationSubTypes = []
                }
            }
        }
    }
    
    private func saveChanges() {
        isSaving = true
        saveError = nil
        
        Task {
            do {
                // Prepare metadata
                var metadata: [String: Any] = [
                    "title": title,
                    "description": description,
                    "media_type": mediaType,
                    "media_sub_type": mediaSubType
                ]
                
                if !locationType.isEmpty {
                    metadata["location_type"] = locationType
                }
                
                if !locationSubType.isEmpty {
                    metadata["location_sub_type"] = locationSubType
                }
                
                // Update media
                let updatedMedia = try await NetworkManager.shared.updateMediaMetadata(
                    mediaId: media.id,
                    metadata: metadata
                )
                
                await MainActor.run {
                    isSaving = false
                    onSave(updatedMedia)
                }
                
            } catch {
                await MainActor.run {
                    isSaving = false
                    saveError = error.localizedDescription
                }
            }
        }
    }
}

struct MediaPreviewCard: View {
    let media: Media
    
    var body: some View {
        VStack(spacing: 12) {
            // Preview image/video/3D
            if media.is3DModel {
                ZStack {
                    Rectangle()
                        .fill(AppTheme.cardBackground)
                        .frame(height: 200)
                    
                    Image(systemName: "cube.fill")
                        .font(.system(size: 60))
                        .foregroundColor(AppTheme.accentPrimary)
                }
                .cornerRadius(12)
            } else if media.isVideo {
                if let thumbnailUrl = media.thumbnailMediumUrl, let url = URL(string: thumbnailUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                    .frame(height: 200)
                                ProgressView()
                            }
                        case .success(let image):
                            ZStack {
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(height: 200)
                                    .clipped()
                                
                                Image(systemName: "play.circle.fill")
                                    .font(.system(size: 50))
                                    .foregroundColor(.white)
                                    .shadow(radius: 2)
                            }
                        case .failure:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                    .frame(height: 200)
                                Image(systemName: "video.fill")
                                    .font(.system(size: 60))
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .cornerRadius(12)
                } else {
                    ZStack {
                        Rectangle()
                            .fill(AppTheme.cardBackground)
                            .frame(height: 200)
                        Image(systemName: "video.fill")
                            .font(.system(size: 60))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .cornerRadius(12)
                }
            } else if media.isImage {
                if let thumbnailUrl = media.thumbnailMediumUrl, let url = URL(string: thumbnailUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                    .frame(height: 200)
                                ProgressView()
                            }
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(height: 200)
                                .clipped()
                        case .failure:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                    .frame(height: 200)
                                Image(systemName: "photo")
                                    .font(.system(size: 60))
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .cornerRadius(12)
                } else {
                    ZStack {
                        Rectangle()
                            .fill(AppTheme.cardBackground)
                            .frame(height: 200)
                        Image(systemName: "photo")
                            .font(.system(size: 60))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .cornerRadius(12)
                }
            } else {
                ZStack {
                    Rectangle()
                        .fill(AppTheme.cardBackground)
                        .frame(height: 200)
                    Image(systemName: "doc.fill")
                        .font(.system(size: 60))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .cornerRadius(12)
            }
            
            // File info
            VStack(alignment: .leading, spacing: 4) {
                Text(media.originalFilename)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text(ByteCountFormatter.string(fromByteCount: Int64(media.fileSize), countStyle: .file))
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
    }
}
