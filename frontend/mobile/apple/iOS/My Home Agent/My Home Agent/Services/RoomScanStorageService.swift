import Foundation
import RoomPlan
import UIKit

class RoomScanStorageService {
    static let shared = RoomScanStorageService()
    
    private let fileManager = FileManager.default
    private let metadataFileName = "room_scans_metadata.json"
    private let scansDirectoryName = "RoomScans"
    
    private init() {
        print("📁 RoomScanStorage: Initializing")
        print("   Documents directory: \(documentsDirectory.path)")
        print("   Scans directory: \(scansDirectory.path)")
        print("   Metadata file: \(metadataFileURL.path)")
        createScansDirectoryIfNeeded()
    }
    
    // MARK: - Directory Management
    
    private var documentsDirectory: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    private var scansDirectory: URL {
        documentsDirectory.appendingPathComponent(scansDirectoryName)
    }
    
    private var metadataFileURL: URL {
        documentsDirectory.appendingPathComponent(metadataFileName)
    }
    
    private func createScansDirectoryIfNeeded() {
        if !fileManager.fileExists(atPath: scansDirectory.path) {
            do {
                try fileManager.createDirectory(at: scansDirectory, withIntermediateDirectories: true)
                print("📁 RoomScanStorage: Created scans directory at \(scansDirectory.path)")
            } catch {
                print("❌ RoomScanStorage: Failed to create scans directory: \(error)")
            }
        }
    }
    
    // MARK: - Metadata Management
    
    private func loadMetadata() -> RoomScanMetadata {
        guard fileManager.fileExists(atPath: metadataFileURL.path) else {
            print("📋 RoomScanStorage: No metadata file exists, returning empty")
            return RoomScanMetadata()
        }
        
        do {
            let data = try Data(contentsOf: metadataFileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let metadata = try decoder.decode(RoomScanMetadata.self, from: data)
            print("📋 RoomScanStorage: Loaded metadata with \(metadata.scans.count) scans")
            return metadata
        } catch {
            print("❌ RoomScanStorage: Failed to load metadata: \(error)")
            print("⚠️ RoomScanStorage: Attempting to delete corrupted metadata file")
            try? fileManager.removeItem(at: metadataFileURL)
            return RoomScanMetadata()
        }
    }
    
    private func saveMetadata(_ metadata: RoomScanMetadata) throws {
        print("💾 RoomScanStorage: Attempting to save metadata with \(metadata.scans.count) scans")
        print("   Metadata file path: \(metadataFileURL.path)")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        do {
            let data = try encoder.encode(metadata)
            print("   Encoded \(data.count) bytes of JSON")
            try data.write(to: metadataFileURL, options: .atomic)
            print("✅ RoomScanStorage: Saved metadata with \(metadata.scans.count) scans")
            
            // Verify it was written
            if fileManager.fileExists(atPath: metadataFileURL.path) {
                let verifyData = try Data(contentsOf: metadataFileURL)
                print("✅ RoomScanStorage: Verified metadata file exists (\(verifyData.count) bytes)")
                
                // Verify we can decode it back
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let verifyMetadata = try decoder.decode(RoomScanMetadata.self, from: verifyData)
                print("✅ RoomScanStorage: Verified metadata is valid with \(verifyMetadata.scans.count) scans")
            } else {
                print("❌ RoomScanStorage: Metadata file does not exist after write!")
            }
        } catch {
            print("❌ RoomScanStorage: Failed to save metadata: \(error)")
            throw error
        }
    }
    
    // MARK: - Save Room Scan
    
    func saveRoomScan(
        capturedRoom: CapturedRoom,
        name: String,
        propertyId: String? = nil
    ) async throws -> RoomScan {
        let scanId = UUID().uuidString
        let fileName = "\(scanId).usdz"
        let fileURL = scansDirectory.appendingPathComponent(fileName)
        
        print("💾 RoomScanStorage: Starting export to \(fileURL.path)")
        print("   Scans directory: \(scansDirectory.path)")
        print("   Directory exists: \(fileManager.fileExists(atPath: scansDirectory.path))")
        
        // Export the USDZ file on main thread (RoomPlan requires this)
        let exportResult = await MainActor.run {
            do {
                try capturedRoom.export(to: fileURL)
                print("✅ RoomScanStorage: Export completed on main thread")
                return Result<Void, Error>.success(())
            } catch {
                print("❌ RoomScanStorage: Export failed: \(error)")
                return Result<Void, Error>.failure(error)
            }
        }
        
        // Check export result
        switch exportResult {
        case .success:
            break
        case .failure(let error):
            throw error
        }
        
        // Verify file was created
        guard fileManager.fileExists(atPath: fileURL.path) else {
            let error = NSError(
                domain: "RoomScanStorage",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "USDZ file was not created at expected path"]
            )
            print("❌ RoomScanStorage: File verification failed - file does not exist")
            throw error
        }
        
        // Get file size
        let attributes = try fileManager.attributesOfItem(atPath: fileURL.path)
        let fileSize = attributes[.size] as? Int64 ?? 0
        print("✅ RoomScanStorage: File verified - size: \(fileSize) bytes")
        
        // Generate thumbnail
        let thumbnailURL = try? await generateThumbnail(for: capturedRoom, scanId: scanId)
        
        // Save CapturedRoom data for later regeneration
        _ = try? await saveCapturedRoomData(capturedRoom, scanId: scanId)
        
        // Generate floorplan
        let floorplanURL = try? await generateFloorplan(for: capturedRoom, scanId: scanId)
        
        // Create room scan metadata
        let roomScan = RoomScan(
            id: scanId,
            name: name,
            propertyId: propertyId,
            createdAt: Date(),
            fileURL: fileURL,
            thumbnailURL: thumbnailURL,
            floorplanURL: floorplanURL,
            uploadStatus: .notUploaded,
            backendMediaId: nil
        )
        
        // Update metadata
        var metadata = loadMetadata()
        metadata.scans.append(roomScan)
        try saveMetadata(metadata)
        
        print("✅ RoomScanStorage: Saved room scan '\(name)' with ID \(scanId)")
        return roomScan
    }
    
    // MARK: - CapturedRoom Data Storage
    
    private func saveCapturedRoomData(_ capturedRoom: CapturedRoom, scanId: String) async throws -> URL {
        print("💾 RoomScanStorage: Saving CapturedRoom data...")
        
        let capturedRoomFileName = "\(scanId)_room_data.json"
        let capturedRoomURL = scansDirectory.appendingPathComponent(capturedRoomFileName)
        
        // Encode CapturedRoom to JSON
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        
        let data = try encoder.encode(capturedRoom)
        try data.write(to: capturedRoomURL, options: .atomic)
        
        print("✅ RoomScanStorage: Saved CapturedRoom data at \(capturedRoomURL.path)")
        return capturedRoomURL
    }
    
    func loadCapturedRoomData(for scanId: String) throws -> CapturedRoom {
        let capturedRoomFileName = "\(scanId)_room_data.json"
        let capturedRoomURL = scansDirectory.appendingPathComponent(capturedRoomFileName)
        
        guard fileManager.fileExists(atPath: capturedRoomURL.path) else {
            throw NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "CapturedRoom data not found"])
        }
        
        let data = try Data(contentsOf: capturedRoomURL)
        let decoder = JSONDecoder()
        let capturedRoom = try decoder.decode(CapturedRoom.self, from: data)
        
        return capturedRoom
    }
    
    // MARK: - Floorplan Generation
    
    private func generateFloorplan(for capturedRoom: CapturedRoom, scanId: String) async throws -> URL {
        print("🏗️ RoomScanStorage: Generating floorplan...")
        
        // Move floorplan generation to background thread to avoid blocking UI
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                guard let floorplanImage = FloorplanGeneratorService.shared.generateFloorplan(from: capturedRoom) else {
                    continuation.resume(throwing: NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate floorplan"]))
                    return
                }
                
                do {
                    let floorplanURL = try FloorplanGeneratorService.shared.saveFloorplan(floorplanImage, for: scanId)
                    print("✅ RoomScanStorage: Floorplan generated at \(floorplanURL.path)")
                    continuation.resume(returning: floorplanURL)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    // MARK: - Thumbnail Generation
    
    private func generateThumbnail(for capturedRoom: CapturedRoom, scanId: String) async throws -> URL {
        // Create a simple thumbnail by rendering the room data
        // For now, we'll create a placeholder image
        let thumbnailFileName = "\(scanId)_thumbnail.png"
        let thumbnailURL = scansDirectory.appendingPathComponent(thumbnailFileName)
        
        // Move thumbnail generation to background thread to avoid blocking UI
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                // Create a simple placeholder image
                let size = CGSize(width: 300, height: 300)
                let renderer = UIGraphicsImageRenderer(size: size)
                
                let image = renderer.image { context in
                    // Background
                    UIColor.systemGray6.setFill()
                    context.fill(CGRect(origin: .zero, size: size))
                    
                    // Icon
                    let iconSize: CGFloat = 100
                    let iconRect = CGRect(
                        x: (size.width - iconSize) / 2,
                        y: (size.height - iconSize) / 2,
                        width: iconSize,
                        height: iconSize
                    )
                    
                    if let houseIcon = UIImage(systemName: "house.fill") {
                        UIColor.systemBlue.setFill()
                        houseIcon.withTintColor(.systemBlue).draw(in: iconRect)
                    }
                }
                
                if let data = image.pngData() {
                    do {
                        try data.write(to: thumbnailURL)
                        print("🖼️ RoomScanStorage: Generated thumbnail at \(thumbnailURL.path)")
                        continuation.resume(returning: thumbnailURL)
                    } catch {
                        continuation.resume(throwing: error)
                    }
                } else {
                    continuation.resume(throwing: NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate thumbnail"]))
                }
            }
        }
    }
    
    // MARK: - Retrieve Room Scans
    
    func getAllScans() -> [RoomScan] {
        print("🔍 RoomScanStorage: getAllScans() called")
        
        // List actual files in directory
        do {
            let files = try fileManager.contentsOfDirectory(at: scansDirectory, includingPropertiesForKeys: [.fileSizeKey])
            print("📁 RoomScanStorage: Found \(files.count) files in scans directory:")
            for file in files {
                let attrs = try? fileManager.attributesOfItem(atPath: file.path)
                let size = attrs?[.size] as? Int64 ?? 0
                print("   - \(file.lastPathComponent) (\(size) bytes)")
            }
        } catch {
            print("❌ RoomScanStorage: Failed to list directory: \(error)")
        }
        
        let metadata = loadMetadata()
        print("🔍 RoomScanStorage: Checking \(metadata.scans.count) scans for file existence")
        
        // Filter out scans where the file doesn't exist (orphaned metadata)
        let validScans = metadata.scans.filter { scan in
            let exists = fileManager.fileExists(atPath: scan.fileURL.path)
            print("   Scan '\(scan.name)': file exists = \(exists) at \(scan.fileURL.path)")
            if !exists {
                print("⚠️ RoomScanStorage: Found orphaned scan '\(scan.name)' - file missing")
            }
            return exists
        }
        
        print("🔍 RoomScanStorage: Found \(validScans.count) valid scans out of \(metadata.scans.count)")
        
        // Update metadata if we found orphaned entries
        if validScans.count != metadata.scans.count {
            var updatedMetadata = metadata
            updatedMetadata.scans = validScans
            try? saveMetadata(updatedMetadata)
            print("🧹 RoomScanStorage: Cleaned up \(metadata.scans.count - validScans.count) orphaned metadata entries")
        }
        
        return validScans.sorted { $0.createdAt > $1.createdAt }
    }
    
    // Manual cleanup function - only call this explicitly, not automatically
    func cleanupOrphanedFiles() {
        let metadata = loadMetadata()
        let validFileURLs = Set(metadata.scans.map { $0.fileURL.path })
        let validThumbnailURLs = Set(metadata.scans.compactMap { $0.thumbnailURL?.path })
        
        do {
            let files = try fileManager.contentsOfDirectory(at: scansDirectory, includingPropertiesForKeys: nil)
            
            var deletedCount = 0
            for fileURL in files {
                let filePath = fileURL.path
                
                // Skip if this file is referenced in valid scans
                if validFileURLs.contains(filePath) || validThumbnailURLs.contains(filePath) {
                    continue
                }
                
                // This is an orphaned file - delete it
                print("🗑️ RoomScanStorage: Deleting orphaned file: \(fileURL.lastPathComponent)")
                try? fileManager.removeItem(at: fileURL)
                deletedCount += 1
            }
            
            if deletedCount > 0 {
                print("🧹 RoomScanStorage: Cleaned up \(deletedCount) orphaned file(s)")
            }
        } catch {
            print("⚠️ RoomScanStorage: Failed to cleanup orphaned files: \(error)")
        }
    }
    
    func getScan(byId id: String) -> RoomScan? {
        let metadata = loadMetadata()
        return metadata.scans.first { $0.id == id }
    }
    
    func getScans(forPropertyId propertyId: String) -> [RoomScan] {
        let metadata = loadMetadata()
        return metadata.scans
            .filter { $0.propertyId == propertyId }
            .sorted { $0.createdAt > $1.createdAt }
    }
    
    // MARK: - Update Room Scan
    
    func updateScan(_ updatedScan: RoomScan) throws {
        var metadata = loadMetadata()
        
        guard let index = metadata.scans.firstIndex(where: { $0.id == updatedScan.id }) else {
            throw NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Scan not found"])
        }
        
        metadata.scans[index] = updatedScan
        try saveMetadata(metadata)
        print("✅ RoomScanStorage: Updated scan \(updatedScan.id)")
    }
    
    // MARK: - Delete Room Scan
    
    func deleteScan(id: String) throws {
        var metadata = loadMetadata()
        
        guard let scan = metadata.scans.first(where: { $0.id == id }) else {
            throw NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Scan not found"])
        }
        
        // Delete USDZ file
        if fileManager.fileExists(atPath: scan.fileURL.path) {
            try fileManager.removeItem(at: scan.fileURL)
            print("🗑️ RoomScanStorage: Deleted USDZ file at \(scan.fileURL.path)")
        }
        
        // Delete thumbnail if exists
        if let thumbnailURL = scan.thumbnailURL, fileManager.fileExists(atPath: thumbnailURL.path) {
            try fileManager.removeItem(at: thumbnailURL)
            print("🗑️ RoomScanStorage: Deleted thumbnail at \(thumbnailURL.path)")
        }
        
        // Remove from metadata
        metadata.scans.removeAll { $0.id == id }
        try saveMetadata(metadata)
        
        print("✅ RoomScanStorage: Deleted scan \(id)")
    }
    
    // MARK: - Storage Info
    
    func getStorageSize() -> Int64 {
        var totalSize: Int64 = 0
        
        do {
            let files = try fileManager.contentsOfDirectory(at: scansDirectory, includingPropertiesForKeys: [.fileSizeKey])
            
            for file in files {
                let attributes = try fileManager.attributesOfItem(atPath: file.path)
                if let fileSize = attributes[.size] as? Int64 {
                    totalSize += fileSize
                }
            }
        } catch {
            print("❌ RoomScanStorage: Failed to calculate storage size: \(error)")
        }
        
        return totalSize
    }
    
    func getStorageSizeFormatted() -> String {
        let size = getStorageSize()
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }
}
