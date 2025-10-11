import Foundation
import RoomPlan
import UIKit

class RoomScanStorageService {
    static let shared = RoomScanStorageService()
    
    private let fileManager = FileManager.default
    private let metadataFileName = "room_scans_metadata.json"
    private let scansDirectoryName = "RoomScans"
    
    private init() {
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
            return RoomScanMetadata()
        }
        
        do {
            let data = try Data(contentsOf: metadataFileURL)
            let metadata = try JSONDecoder().decode(RoomScanMetadata.self, from: data)
            return metadata
        } catch {
            print("❌ RoomScanStorage: Failed to load metadata: \(error)")
            return RoomScanMetadata()
        }
    }
    
    private func saveMetadata(_ metadata: RoomScanMetadata) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        let data = try encoder.encode(metadata)
        try data.write(to: metadataFileURL)
        print("💾 RoomScanStorage: Saved metadata with \(metadata.scans.count) scans")
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
        
        // Export the USDZ file
        try capturedRoom.export(to: fileURL)
        print("💾 RoomScanStorage: Exported USDZ to \(fileURL.path)")
        
        // Generate thumbnail
        let thumbnailURL = try? await generateThumbnail(for: capturedRoom, scanId: scanId)
        
        // Create room scan metadata
        let roomScan = RoomScan(
            id: scanId,
            name: name,
            propertyId: propertyId,
            createdAt: Date(),
            fileURL: fileURL,
            thumbnailURL: thumbnailURL,
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
    
    // MARK: - Thumbnail Generation
    
    private func generateThumbnail(for capturedRoom: CapturedRoom, scanId: String) async throws -> URL {
        // Create a simple thumbnail by rendering the room data
        // For now, we'll create a placeholder image
        let thumbnailFileName = "\(scanId)_thumbnail.png"
        let thumbnailURL = scansDirectory.appendingPathComponent(thumbnailFileName)
        
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
            try data.write(to: thumbnailURL)
            print("🖼️ RoomScanStorage: Generated thumbnail at \(thumbnailURL.path)")
            return thumbnailURL
        }
        
        throw NSError(domain: "RoomScanStorage", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate thumbnail"])
    }
    
    // MARK: - Retrieve Room Scans
    
    func getAllScans() -> [RoomScan] {
        let metadata = loadMetadata()
        return metadata.scans.sorted { $0.createdAt > $1.createdAt }
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
