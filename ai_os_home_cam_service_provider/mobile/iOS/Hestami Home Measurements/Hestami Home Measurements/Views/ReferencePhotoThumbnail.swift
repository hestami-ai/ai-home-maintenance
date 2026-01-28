//
//  ReferencePhotoThumbnail.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import SwiftUI

/// Thumbnail view for displaying reference photos in ScanDetailView.
struct ReferencePhotoThumbnail: View {
    let photo: ReferencePhoto

    @State private var image: UIImage?

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Background
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.secondaryBackground)
                    .frame(height: 80)

                // Image or placeholder
                if let image = image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    VStack(spacing: 4) {
                        Image(systemName: photo.captureAngle.iconName)
                            .font(.title2)
                            .foregroundColor(AppTheme.secondaryText)

                        Text(photo.captureAngle.displayName)
                            .font(.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }

                // Angle badge
                VStack {
                    HStack {
                        Text(photo.captureAngle.displayName)
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(AppTheme.primaryText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppTheme.overlayDark)
                            .cornerRadius(4)

                        Spacer()
                    }

                    Spacer()

                    // ProRAW/HEIC indicator
                    HStack {
                        Spacer()

                        if photo.isProRAW {
                            Text("DNG")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(AppTheme.success)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(AppTheme.success.opacity(0.3))
                                .cornerRadius(3)
                        }
                    }
                }
                .padding(4)
            }

            // File size
            Text(photo.formattedFileSize)
                .font(.caption2)
                .foregroundColor(AppTheme.secondaryText)
        }
        .onAppear {
            loadImage()
        }
    }

    private func loadImage() {
        // Try to load preview image first, then DNG
        if let previewPath = photo.jpegPreviewPath,
           let uiImage = UIImage(contentsOfFile: previewPath) {
            image = uiImage
        } else if let dngPath = photo.dngFilePath,
                  let uiImage = UIImage(contentsOfFile: dngPath) {
            // Create a smaller thumbnail from DNG
            let size = CGSize(width: 200, height: 200)
            image = uiImage.preparingThumbnail(of: size)
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        AppTheme.primaryBackground.ignoresSafeArea()

        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            ForEach(CaptureAngle.standardAngles, id: \.self) { angle in
                let photo = ReferencePhoto(index: 0, angle: angle)
                photo.fileSize = 25_000_000  // 25MB
                photo.isProRAW = true
                return ReferencePhotoThumbnail(photo: photo)
            }
        }
        .padding()
    }
}
