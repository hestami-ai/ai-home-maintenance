//
//  MediaManagementView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 10/17/25.
//

import SwiftUI
import AVKit

struct MediaManagementView: View {
    let propertyId: String
    @Binding var media: [Media]
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var viewModel = PropertiesViewModel.shared
    
    @State private var selectedMedia: Media?
    @State private var showingEditSheet = false
    @State private var showingDeleteAlert = false
    @State private var mediaToDelete: Media?
    @State private var isDeleting = false
    @State private var deleteError: String?
    
    // Group media by type
    private var groupedMedia: [(String, [Media])] {
        var groups: [String: [Media]] = [:]
        
        for item in media {
            let groupKey: String
            if item.is3DModel {
                groupKey = "3D Models"
            } else if item.mediaSubType == "FLOORPLAN" {
                groupKey = "Floorplans"
            } else if item.mediaSubType == "360_DEGREE" {
                groupKey = "360° Photos"
            } else if item.isVideo {
                groupKey = "Videos"
            } else if item.isImage {
                groupKey = "Images"
            } else {
                groupKey = "Other Files"
            }
            
            if groups[groupKey] == nil {
                groups[groupKey] = []
            }
            groups[groupKey]?.append(item)
        }
        
        // Sort groups in a specific order
        let order = ["Images", "Videos", "Floorplans", "360° Photos", "3D Models", "Other Files"]
        return order.compactMap { key in
            guard let items = groups[key], !items.isEmpty else { return nil }
            return (key, items)
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                if media.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 60))
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Text("No Media")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Upload media to get started")
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: [.sectionHeaders]) {
                            ForEach(groupedMedia, id: \.0) { group in
                                Section {
                                    LazyVStack(spacing: 12) {
                                        ForEach(group.1) { mediaItem in
                                            MediaManagementRow(
                                                media: mediaItem,
                                                onEdit: {
                                                    selectedMedia = mediaItem
                                                    showingEditSheet = true
                                                },
                                                onDelete: {
                                                    mediaToDelete = mediaItem
                                                    deleteMedia(mediaItem)
                                                }
                                            )
                                        }
                                    }
                                } header: {
                                    HStack {
                                        Text(group.0)
                                            .font(AppTheme.subheadlineFont.bold())
                                            .foregroundColor(AppTheme.primaryText)
                                        
                                        Spacer()
                                        
                                        Text("\(group.1.count)")
                                            .font(AppTheme.captionFont)
                                            .foregroundColor(AppTheme.secondaryText)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(AppTheme.cardBackground)
                                            .cornerRadius(8)
                                    }
                                    .padding(.horizontal)
                                    .padding(.vertical, 8)
                                    .background(AppTheme.primaryBackground)
                                }
                            }
                        }
                        .padding(.vertical)
                    }
                }
                
                // Loading overlay
                if isDeleting {
                    ZStack {
                        Color.black.opacity(0.4)
                            .edgesIgnoringSafeArea(.all)
                        
                        VStack(spacing: 16) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(1.5)
                            
                            Text("Deleting...")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(.white)
                        }
                        .padding(30)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(12)
                    }
                }
            }
            .navigationTitle("Manage Media")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                }
            }
            .sheet(isPresented: $showingEditSheet) {
                if let selectedMedia = selectedMedia {
                    MediaEditView(
                        media: selectedMedia,
                        onSave: { updatedMedia in
                            // Update the media in the array
                            if let index = media.firstIndex(where: { $0.id == updatedMedia.id }) {
                                media[index] = updatedMedia
                            }
                            showingEditSheet = false
                            
                            // Refresh property data
                            Task {
                                await viewModel.loadProperties()
                            }
                        },
                        onCancel: {
                            showingEditSheet = false
                        }
                    )
                }
            }
            .alert("Delete Failed", isPresented: Binding(
                get: { deleteError != nil },
                set: { if !$0 { deleteError = nil } }
            )) {
                Button("OK", role: .cancel) {
                    deleteError = nil
                }
            } message: {
                if let error = deleteError {
                    Text(error)
                }
            }
        }
    }
    
    private func deleteMedia(_ mediaItem: Media) {
        isDeleting = true
        deleteError = nil
        
        Task {
            do {
                try await NetworkManager.shared.deleteMedia(mediaId: mediaItem.id)
                
                // Remove from local array
                await MainActor.run {
                    media.removeAll { $0.id == mediaItem.id }
                    isDeleting = false
                }
                
                // Refresh property data
                await viewModel.loadProperties()
                
            } catch {
                await MainActor.run {
                    isDeleting = false
                    deleteError = error.localizedDescription
                }
            }
        }
    }
}

struct MediaManagementRow: View {
    let media: Media
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail
            MediaThumbnailPreview(media: media)
                .frame(width: 80, height: 80)
                .cornerRadius(8)
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(media.title.isEmpty ? "Untitled" : media.title)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(2)
                
                if !media.description.isEmpty {
                    Text(media.description)
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .lineLimit(1)
                }
                
                HStack(spacing: 8) {
                    if let location = media.locationDisplay {
                        Label(location, systemImage: "location.fill")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    
                    if media.is3DModel {
                        Label("3D", systemImage: "cube.fill")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.accentPrimary)
                    }
                }
            }
            
            Spacer()
            
            // Actions
            HStack(spacing: 8) {
                Button(action: onEdit) {
                    Image(systemName: "pencil.circle.fill")
                        .font(.title2)
                        .foregroundColor(AppTheme.accentPrimary)
                }
                
                Button(action: onDelete) {
                    Image(systemName: "trash.circle.fill")
                        .font(.title2)
                        .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

struct MediaThumbnailPreview: View {
    let media: Media
    
    var body: some View {
        if media.is3DModel {
            ZStack {
                Rectangle()
                    .fill(AppTheme.cardBackground)
                
                Image(systemName: "cube.fill")
                    .font(.system(size: 30))
                    .foregroundColor(AppTheme.accentPrimary)
            }
        } else if media.isVideo {
            if let thumbnailUrl = media.thumbnailSmallUrl, let url = URL(string: thumbnailUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ZStack {
                            Rectangle()
                                .fill(AppTheme.cardBackground)
                            ProgressView()
                        }
                    case .success(let image):
                        ZStack {
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                            
                            Image(systemName: "play.circle.fill")
                                .font(.title)
                                .foregroundColor(.white)
                                .shadow(radius: 2)
                        }
                    case .failure:
                        ZStack {
                            Rectangle()
                                .fill(AppTheme.cardBackground)
                            Image(systemName: "video.fill")
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                ZStack {
                    Rectangle()
                        .fill(AppTheme.cardBackground)
                    Image(systemName: "video.fill")
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        } else if media.isImage {
            if let thumbnailUrl = media.thumbnailSmallUrl, let url = URL(string: thumbnailUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ZStack {
                            Rectangle()
                                .fill(AppTheme.cardBackground)
                            ProgressView()
                        }
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        ZStack {
                            Rectangle()
                                .fill(AppTheme.cardBackground)
                            Image(systemName: "photo")
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                ZStack {
                    Rectangle()
                        .fill(AppTheme.cardBackground)
                    Image(systemName: "photo")
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        } else {
            ZStack {
                Rectangle()
                    .fill(AppTheme.cardBackground)
                Image(systemName: "doc.fill")
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
    }
}
