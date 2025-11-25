import Foundation
import RoomPlan
import UIKit
import OSLog

class RoomScanStorageService {
    static let shared = RoomScanStorageService()
    
    private let fileManager = FileManager.default
    private let metadataFileName = "room_scans_metadata.json"
    private let scansDirectoryName = "RoomScans"
    
    private init() {
        AppLogger.storage.debug("RoomScanStorage: Initializing")
        AppLogger.storage.debug("Documents directory: \(self.documentsDirectory.path, privacy: .public)")
        AppLogger.storage.debug("Scans directory: \(self.scansDirectory.path, privacy: .public)")
        AppLogger.storage.debug("Metadata file: \(self.metadataFileURL.path, privacy: .public)")
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
                AppLogger.storage.info("Created scans directory at \(self.scansDirectory.path, privacy: .public)")
            } catch {
                AppLogger.error("Failed to create scans directory", error: error, category: AppLogger.storage)
            }
        }
    }
    
    // MARK: - Metadata Management
    
    private func loadMetadata() -> RoomScanMetadata {
        guard fileManager.fileExists(atPath: metadataFileURL.path) else {
            AppLogger.storage.debug("No metadata file exists, returning empty")
            return RoomScanMetadata()
        }
        
        do {
            let data = try Data(contentsOf: metadataFileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let metadata = try decoder.decode(RoomScanMetadata.self, from: data)
            AppLogger.storage.debug("Loaded metadata with \(metadata.scans.count, privacy: .public) scans")
            return metadata
        } catch {
            AppLogger.error("Failed to load metadata", error: error, category: AppLogger.storage)
            AppLogger.storage.warning("Attempting to delete corrupted metadata file")
            try? fileManager.removeItem(at: metadataFileURL)
            return RoomScanMetadata()
        }
    }
    
    private func saveMetadata(_ metadata: RoomScanMetadata) throws {
        AppLogger.storage.debug("Attempting to save metadata with \(metadata.scans.count, privacy: .public) scans")
        AppLogger.storage.debug("Metadata file path: \(self.metadataFileURL.path, privacy: .public)")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        do {
            let data = try encoder.encode(metadata)
            AppLogger.storage.debug("Encoded \(data.count, privacy: .public) bytes of JSON")
            try data.write(to: metadataFileURL, options: .atomic)
            AppLogger.storage.info("Saved metadata with \(metadata.scans.count, privacy: .public) scans")
            
            // Verify it was written
            if fileManager.fileExists(atPath: metadataFileURL.path) {
                let verifyData = try Data(contentsOf: metadataFileURL)
                AppLogger.storage.debug("Verified metadata file exists (\(verifyData.count, privacy: .public) bytes)")
                
                // Verify we can decode it back
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let verifyMetadata = try decoder.decode(RoomScanMetadata.self, from: verifyData)
                AppLogger.storage.debug("Verified metadata is valid with \(verifyMetadata.scans.count, privacy: .public) scans")
            } else {
                AppLogger.storage.error("Metadata file does not exist after write!")
            }
        } catch {
            AppLogger.error("Failed to save metadata", error: error, category: AppLogger.storage)
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
        
        AppLogger.roomScan.debug("Starting export to \(fileURL.path, privacy: .public)")
        AppLogger.roomScan.debug("Scans directory: \(self.scansDirectory.path, privacy: .public)")
        AppLogger.roomScan.debug("Directory exists: \(self.fileManager.fileExists(atPath: self.scansDirectory.path), privacy: .public)")
        
        // Export the USDZ file on main thread (RoomPlan requires this)
        let exportResult = await MainActor.run {
            do {
                try capturedRoom.export(to: fileURL)
                AppLogger.roomScan.info("Export completed on main thread")
                return Result<Void, Error>.success(())
            } catch {
                AppLogger.error("Export failed", error: error, category: AppLogger.roomScan)
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
            AppLogger.roomScan.error("File verification failed - file does not exist")
            throw error
        }
        
        // Get file size
        let attributes = try fileManager.attributesOfItem(atPath: fileURL.path)
        let fileSize = attributes[.size] as? Int64 ?? 0
        AppLogger.roomScan.debug("File verified - size: \(fileSize, privacy: .public) bytes")
        
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
        
        AppLogger.roomScan.info("Saved room scan '\(name, privacy: .public)' with ID \(scanId, privacy: .public)")
        return roomScan
    }
    
    // MARK: - CapturedRoom Data Storage
    
    private func saveCapturedRoomData(_ capturedRoom: CapturedRoom, scanId: String) async throws -> URL {
        AppLogger.roomScan.debug("Saving CapturedRoom data...")
        
        let capturedRoomFileName = "\(scanId)_room_data.json"
        let capturedRoomURL = scansDirectory.appendingPathComponent(capturedRoomFileName)
        
        // Encode CapturedRoom to JSON
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        
        let data = try encoder.encode(capturedRoom)
        try data.write(to: capturedRoomURL, options: .atomic)
        
        AppLogger.roomScan.debug("Saved CapturedRoom data at \(capturedRoomURL.path, privacy: .public)")
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
        AppLogger.roomScan.debug("Generating floorplan...")
        
        // Move floorplan generation to background thread to avoid blocking UI
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                guard let floorplanImage = FloorplanGeneratorService.shared.generateFloorplan(from: capturedRoom) else {
                    continuation.resume(throwing: NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate floorplan"]))
                    return
                }
                
                do {
                    let floorplanURL = try FloorplanGeneratorService.shared.saveFloorplan(floorplanImage, for: scanId)
                    AppLogger.roomScan.info("Floorplan generated at \(floorplanURL.path, privacy: .public)")
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
                        AppLogger.roomScan.debug("Generated thumbnail at \(thumbnailURL.path, privacy: .public)")
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
        AppLogger.storage.debug("getAllScans() called")
        
        // List actual files in directory
        do {
            let files = try fileManager.contentsOfDirectory(at: scansDirectory, includingPropertiesForKeys: [.fileSizeKey])
            AppLogger.storage.debug("Found \(files.count, privacy: .public) files in scans directory")
            #if DEBUG
            for file in files {
                let attrs = try? fileManager.attributesOfItem(atPath: file.path)
                let size = attrs?[.size] as? Int64 ?? 0
                AppLogger.storage.debug("  - \(file.lastPathComponent, privacy: .public) (\(size, privacy: .public) bytes)")
            }
            #endif
        } catch {
            AppLogger.error("Failed to list directory", error: error, category: AppLogger.storage)
        }
        
        let metadata = loadMetadata()
        AppLogger.storage.debug("Checking \(metadata.scans.count, privacy: .public) scans for file existence")
        
        // Filter out scans where the file doesn't exist (orphaned metadata)
        let validScans = metadata.scans.filter { scan in
            let exists = fileManager.fileExists(atPath: scan.fileURL.path)
            #if DEBUG
            AppLogger.storage.debug("Scan '\(scan.name, privacy: .public)': file exists = \(exists, privacy: .public)")
            #endif
            if !exists {
                AppLogger.storage.warning("Found orphaned scan '\(scan.name, privacy: .public)' - file missing")
            }
            return exists
        }
        
        AppLogger.storage.debug("Found \(validScans.count, privacy: .public) valid scans out of \(metadata.scans.count, privacy: .public)")
        
        // Update metadata if we found orphaned entries
        if validScans.count != metadata.scans.count {
            var updatedMetadata = metadata
            updatedMetadata.scans = validScans
            try? saveMetadata(updatedMetadata)
            AppLogger.storage.info("Cleaned up \(metadata.scans.count - validScans.count, privacy: .public) orphaned metadata entries")
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
                AppLogger.storage.info("Deleting orphaned file: \(fileURL.lastPathComponent, privacy: .public)")
                try? fileManager.removeItem(at: fileURL)
                deletedCount += 1
            }
            
            if deletedCount > 0 {
                AppLogger.storage.info("Cleaned up \(deletedCount, privacy: .public) orphaned file(s)")
            }
        } catch {
            AppLogger.error("Failed to cleanup orphaned files", error: error, category: AppLogger.storage)
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
        AppLogger.storage.info("Updated scan \(updatedScan.id, privacy: .public)")
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
            AppLogger.storage.info("Deleted USDZ file at \(scan.fileURL.path, privacy: .public)")
        }
        
        // Delete thumbnail if exists
        if let thumbnailURL = scan.thumbnailURL, fileManager.fileExists(atPath: thumbnailURL.path) {
            try fileManager.removeItem(at: thumbnailURL)
            AppLogger.storage.info("Deleted thumbnail at \(thumbnailURL.path, privacy: .public)")
        }
        
        // Remove from metadata
        metadata.scans.removeAll { $0.id == id }
        try saveMetadata(metadata)
        
        AppLogger.storage.info("Deleted scan \(id, privacy: .public)")
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
            AppLogger.error("Failed to calculate storage size", error: error, category: AppLogger.storage)
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
