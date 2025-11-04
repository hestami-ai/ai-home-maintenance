//
//  PropertiesMediaGalleryView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 10/11/25.
//

import SwiftUI
import AVKit

// MARK: - Media Gallery Components

struct PropertyMediaGalleryView: View {
    let media: [Media]
    @State private var expandedSections: Set<MediaSection> = []
    @State private var selectedMedia: Media?
    
    enum MediaSection: String, CaseIterable {
        case virtualTour = "Virtual Tour"
        case floorplans = "Floorplans"
        case videos = "Videos"
        case images = "Images"
    }
    
    var body: some View {
        VStack(spacing: 12) {
            // Virtual Tour Section
            if !virtualTourMedia.isEmpty {
                MediaSectionView(
                    title: MediaSection.virtualTour.rawValue,
                    icon: "view.3d",
                    media: virtualTourMedia,
                    isExpanded: expandedSections.contains(.virtualTour),
                    onToggle: { toggleSection(.virtualTour) },
                    onMediaTap: { media in
                        selectedMedia = media
                    }
                )
            }
            
            // Floorplans Section
            if !floorplanMedia.isEmpty {
                MediaSectionView(
                    title: MediaSection.floorplans.rawValue,
                    icon: "map",
                    media: floorplanMedia,
                    isExpanded: expandedSections.contains(.floorplans),
                    onToggle: { toggleSection(.floorplans) },
                    onMediaTap: { media in
                        selectedMedia = media
                    }
                )
            }
            
            // Videos Section
            if !videoMedia.isEmpty {
                MediaSectionView(
                    title: MediaSection.videos.rawValue,
                    icon: "video.fill",
                    media: videoMedia,
                    isExpanded: expandedSections.contains(.videos),
                    onToggle: { toggleSection(.videos) },
                    onMediaTap: { media in
                        selectedMedia = media
                    }
                )
            }
            
            // Images Section
            if !imageMedia.isEmpty {
                MediaSectionView(
                    title: MediaSection.images.rawValue,
                    icon: "photo.fill",
                    media: imageMedia,
                    isExpanded: expandedSections.contains(.images),
                    onToggle: { toggleSection(.images) },
                    onMediaTap: { media in
                        selectedMedia = media
                    }
                )
            }
        }
        .sheet(item: $selectedMedia) { media in
            MediaViewerView(media: media)
        }
    }
    
    private var virtualTourMedia: [Media] {
        media.filter { $0.mediaSubType == "360_DEGREE" }
    }
    
    private var floorplanMedia: [Media] {
        // Include all floorplans: images, videos, and 3D models
        media.filter { $0.mediaSubType == "FLOORPLAN" }
    }
    
    private var videoMedia: [Media] {
        // Only regular videos (exclude floorplans and 360°)
        media.filter { $0.mediaType == .VIDEO && $0.mediaSubType != "FLOORPLAN" && $0.mediaSubType != "360_DEGREE" }
    }
    
    private var imageMedia: [Media] {
        // Only regular images (exclude floorplans, 360°, and 3D models)
        media.filter { 
            $0.mediaType == .IMAGE && 
            $0.mediaSubType != "FLOORPLAN" && 
            $0.mediaSubType != "360_DEGREE" 
        }
    }
    
    private func toggleSection(_ section: MediaSection) {
        if expandedSections.contains(section) {
            expandedSections.remove(section)
        } else {
            expandedSections.insert(section)
        }
    }
}

struct MediaSectionView: View {
    let title: String
    let icon: String
    let media: [Media]
    let isExpanded: Bool
    let onToggle: () -> Void
    let onMediaTap: (Media) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section Header
            Button(action: onToggle) {
                HStack {
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(AppTheme.accentColor)
                        .frame(width: 24)
                    
                    Text(title)
                        .font(AppTheme.bodyFont.bold())
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("(\(media.count))")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(AppTheme.cardBackground)
                .cornerRadius(8)
            }
            
            // Media Grid
            if isExpanded {
                GeometryReader { geometry in
                    let totalWidth = geometry.size.width - 24 // Account for padding
                    let spacing: CGFloat = 8
                    let itemWidth = (totalWidth - (spacing * 2)) / 3
                    let gridHeight = calculateGridHeight(itemCount: media.count, itemWidth: itemWidth, spacing: spacing)
                    
                    LazyVGrid(
                        columns: [
                            GridItem(.fixed(itemWidth), spacing: spacing),
                            GridItem(.fixed(itemWidth), spacing: spacing),
                            GridItem(.fixed(itemWidth), spacing: spacing)
                        ],
                        spacing: spacing
                    ) {
                        ForEach(media) { mediaItem in
                            MediaThumbnailView(media: mediaItem, size: itemWidth)
                                .onTapGesture {
                                    onMediaTap(mediaItem)
                                }
                        }
                    }
                    .padding(.horizontal, 12)
                    .frame(height: gridHeight)
                }
                .frame(height: calculateGridHeight(itemCount: media.count, itemWidth: (UIScreen.main.bounds.width - 48) / 3, spacing: 8))
            }
        }
    }
    
    private func calculateGridHeight(itemCount: Int, itemWidth: CGFloat, spacing: CGFloat) -> CGFloat {
        let rows = ceil(Double(itemCount) / 3.0)
        return CGFloat(rows) * itemWidth + CGFloat(rows - 1) * spacing
    }
}

struct MediaThumbnailView: View {
    let media: Media
    let size: CGFloat
    
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Thumbnail Image with overlays
            ZStack(alignment: .bottomLeading) {
                // Try thumbnail first, fallback to full image for images
                if let thumbnailUrl = media.thumbnailMediumUrl ?? media.thumbnailSmallUrl,
                   let url = URL(string: thumbnailUrl) {
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
                            // If thumbnail fails and it's an image, try the full image
                            if media.isImage, let fullUrl = URL(string: media.fileUrl) {
                                AsyncImage(url: fullUrl) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    default:
                                        ZStack {
                                            Rectangle()
                                                .fill(AppTheme.cardBackground)
                                            Image(systemName: iconName(for: media))
                                                .font(media.is3DModel ? .system(size: 40) : .title)
                                                .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                                        }
                                    }
                                }
                            } else {
                                ZStack {
                                    Rectangle()
                                        .fill(AppTheme.cardBackground)
                                    Image(systemName: iconName(for: media))
                                        .font(media.is3DModel ? .system(size: 40) : .title)
                                        .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                                }
                            }
                        @unknown default:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                Image(systemName: iconName(for: media))
                                    .font(media.is3DModel ? .system(size: 40) : .title)
                                    .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                            }
                        }
                    }
                } else if media.isImage, let url = URL(string: media.fileUrl) {
                    // No thumbnail available, use full image for images
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
                                Image(systemName: iconName(for: media))
                                    .font(media.is3DModel ? .system(size: 40) : .title)
                                    .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                            }
                        @unknown default:
                            ZStack {
                                Rectangle()
                                    .fill(AppTheme.cardBackground)
                                Image(systemName: iconName(for: media))
                                    .font(media.is3DModel ? .system(size: 40) : .title)
                                    .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                            }
                        }
                    }
                } else {
                    // No thumbnail or full image available, show icon
                    ZStack {
                        Rectangle()
                            .fill(AppTheme.cardBackground)
                        Image(systemName: iconName(for: media))
                            .font(media.is3DModel ? .system(size: 40) : .title)
                            .foregroundColor(media.is3DModel ? AppTheme.accentPrimary : AppTheme.secondaryText)
                    }
                }
                
                // Video indicator overlay
                if media.isVideo {
                    HStack {
                        Image(systemName: "play.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.5), radius: 2)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            
            // Location label overlay (outside clipped area)
            if let locationDisplay = media.locationDisplay, !locationDisplay.isEmpty {
                VStack(alignment: .leading) {
                    Spacer()
                    Text(locationDisplay)
                        .font(.caption2)
                        .foregroundColor(.white)
                        .lineLimit(2)
                        .truncationMode(.tail)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 8)
                .padding(.trailing, 8)
                .padding(.bottom, 8)
            }
        }
        .frame(width: size, height: size)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private func iconName(for media: Media) -> String {
        if media.is3DModel {
            return "cube.transparent"
        } else if media.isVideo {
            return "video"
        } else {
            return "photo"
        }
    }
}

struct MediaViewerView: View {
    let media: Media
    @Environment(\.dismiss) var dismiss
    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var showMetadata = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 0) {
                    // Top Toolbar
                    HStack {
                        Button(action: { dismiss() }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title2)
                                .foregroundColor(AppTheme.primaryText)
                        }
                        
                        Spacer()
                        
                        if !media.title.isEmpty {
                            Text(media.title)
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.primaryText)
                                .lineLimit(1)
                        }
                        
                        Spacer()
                        
                        Button(action: { withAnimation { showMetadata.toggle() } }) {
                            Image(systemName: showMetadata ? "info.circle.fill" : "info.circle")
                                .font(.title2)
                                .foregroundColor(AppTheme.primaryText)
                        }
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    
                    // Media Content
                    if media.is3DModel {
                        // 3D Model Viewer - Download and display USDZ
                        RemoteUSDZViewer(fileUrl: media.fileUrl)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if media.isVideo {
                        // Video Player
                        if let url = URL(string: media.fileUrl) {
                            VideoPlayerView(url: url)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            VStack {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.largeTitle)
                                    .foregroundColor(AppTheme.secondaryText)
                                Text("Unable to load video")
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    } else if media.mediaSubType == "360_DEGREE" {
                        // 360° Panorama Viewer
                        ZStack {
                            if let url = URL(string: media.fileUrl) {
                                Panorama360View(imageURL: url)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .onAppear {
                                        print("🎯 MediaViewerView: Opening 360° image")
                                        print("   Media ID: \(media.id)")
                                        print("   Title: \(media.title)")
                                        print("   SubType: \(media.mediaSubType)")
                                        print("   File URL: \(media.fileUrl)")
                                    }
                                
                                // 360° Indicator Badge
                                VStack {
                                    HStack {
                                        Spacer()
                                        HStack(spacing: 4) {
                                            Image(systemName: "view.3d")
                                                .font(.caption)
                                            Text("360°")
                                                .font(.caption)
                                                .fontWeight(.semibold)
                                        }
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(AppTheme.accentColor.opacity(0.9))
                                        .cornerRadius(12)
                                        .padding()
                                    }
                                    Spacer()
                                }
                            } else {
                                VStack {
                                    Image(systemName: "exclamationmark.triangle")
                                        .font(.largeTitle)
                                        .foregroundColor(AppTheme.secondaryText)
                                    Text("Unable to load 360° image")
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }
                    } else {
                        // Regular Image Viewer with Zoom
                        GeometryReader { geometry in
                            if let url = URL(string: media.fileUrl) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .empty:
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fit)
                                            .scaleEffect(scale)
                                            .offset(offset)
                                            .gesture(
                                                MagnificationGesture()
                                                    .onChanged { value in
                                                        let delta = value / lastScale
                                                        lastScale = value
                                                        scale = min(max(scale * delta, 1), 5)
                                                    }
                                                    .onEnded { _ in
                                                        lastScale = 1.0
                                                        if scale < 1 {
                                                            withAnimation {
                                                                scale = 1
                                                                offset = .zero
                                                            }
                                                        }
                                                    }
                                            )
                                            .gesture(
                                                DragGesture()
                                                    .onChanged { value in
                                                        if scale > 1 {
                                                            offset = CGSize(
                                                                width: lastOffset.width + value.translation.width,
                                                                height: lastOffset.height + value.translation.height
                                                            )
                                                        }
                                                    }
                                                    .onEnded { _ in
                                                        lastOffset = offset
                                                    }
                                            )
                                            .onTapGesture(count: 2) {
                                                withAnimation {
                                                    if scale > 1 {
                                                        scale = 1
                                                        offset = .zero
                                                        lastOffset = .zero
                                                    } else {
                                                        scale = 2
                                                    }
                                                }
                                            }
                                    case .failure:
                                        VStack {
                                            Image(systemName: "exclamationmark.triangle")
                                                .font(.largeTitle)
                                                .foregroundColor(AppTheme.secondaryText)
                                            Text("Failed to load image")
                                                .foregroundColor(AppTheme.secondaryText)
                                        }
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                                .frame(width: geometry.size.width, height: geometry.size.height)
                            }
                        }
                    }
                    
                    // Metadata Panel
                    if showMetadata {
                        MediaMetadataView(media: media)
                            .transition(.move(edge: .bottom))
                    }
                }
            }
        }
    }


struct MediaMetadataView: View {
    let media: Media
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if !media.title.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Title")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        Text(media.title)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
                
                if !media.description.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Description")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        Text(media.description)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
                
                if let locationDisplay = media.locationDisplay {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Location")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        Text(locationDisplay)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.primaryText)
                    }
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Type")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    Text(media.mediaType.rawValue)
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.primaryText)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("File Size")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    Text(formatFileSize(media.fileSize))
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.primaryText)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Upload Date")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    Text(formatDate(media.uploadDate))
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.primaryText)
                }
            }
            .padding()
        }
        .frame(maxHeight: 300)
        .background(AppTheme.cardBackground)
        .cornerRadius(12, corners: [.topLeft, .topRight])
    }
    
    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct VideoPlayerView: View {
    let url: URL
    @State private var player: AVPlayer?
    
    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                player = AVPlayer(url: url)
            }
            .onDisappear {
                player?.pause()
                player = nil
            }
    }
}

// MARK: - Remote USDZ Viewer

struct RemoteUSDZViewer: View {
    let fileUrl: String
    @State private var localFileURL: URL?
    @State private var isDownloading = false
    @State private var downloadError: String?
    
    var body: some View {
        ZStack {
            if let localURL = localFileURL {
                // Display the USDZ file using SceneKitView
                SceneKitView(url: localURL)
            } else if isDownloading {
                VStack(spacing: 20) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentPrimary))
                        .scaleEffect(1.5)
                    Text("Loading 3D Model...")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.secondaryText)
                }
            } else if let error = downloadError {
                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 60))
                        .foregroundColor(AppTheme.secondaryText)
                    Text("Failed to load 3D model")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                    Text(error)
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
            }
        }
        .onAppear {
            downloadUSDZFile()
        }
    }
    
    private func downloadUSDZFile() {
        guard let url = URL(string: fileUrl) else {
            downloadError = "Invalid URL"
            return
        }
        
        isDownloading = true
        print("📥 RemoteUSDZViewer: Starting download from \(fileUrl)")
        
        let task = URLSession.shared.downloadTask(with: url) { tempURL, response, error in
            // Handle errors
            if let error = error {
                DispatchQueue.main.async {
                    isDownloading = false
                    print("❌ RemoteUSDZViewer: Download failed: \(error)")
                    downloadError = error.localizedDescription
                }
                return
            }
            
            guard let tempURL = tempURL else {
                DispatchQueue.main.async {
                    isDownloading = false
                    print("❌ RemoteUSDZViewer: No temp URL")
                    downloadError = "Download failed"
                }
                return
            }
            
            // Create a permanent location in temp directory
            let tempDir = FileManager.default.temporaryDirectory
            let destinationURL = tempDir.appendingPathComponent(UUID().uuidString).appendingPathExtension("usdz")
            
            // Copy the file BEFORE returning from completion handler
            // (URLSession will delete tempURL after this handler completes)
            do {
                try FileManager.default.copyItem(at: tempURL, to: destinationURL)
                print("✅ RemoteUSDZViewer: Downloaded to \(destinationURL.path)")
                
                // Update UI on main thread
                DispatchQueue.main.async {
                    isDownloading = false
                    localFileURL = destinationURL
                }
                
            } catch {
                print("❌ RemoteUSDZViewer: Failed to save file: \(error)")
                DispatchQueue.main.async {
                    isDownloading = false
                    downloadError = "Failed to save file: \(error.localizedDescription)"
                }
            }
        }
        
        task.resume()
    }
}
