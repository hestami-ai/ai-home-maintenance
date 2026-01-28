//
//  StorageService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData
import os
import Combine

@MainActor
class StorageService: ObservableObject {
    private let logger = Logger.make(category: LogCategory.storageService)
    // MARK: - Published Properties
    
    @Published var scanSessions: [ScanSession] = []
    @Published var errorMessage: String?
    
    // MARK: - Private Properties
    
    private var modelContext: ModelContext?
    
    // MARK: - Initialization
    
    init() {}
    
    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
        loadScanSessions()
    }
    
    // MARK: - Scan Session Methods
    
    func loadScanSessions() {
        logger.debug("Loading scan sessions")
        guard let context = modelContext else { 
            logger.error("Model context is nil in loadScanSessions")
            return 
        }
        
        let descriptor = FetchDescriptor<ScanSession>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        
        do {
            scanSessions = try context.fetch(descriptor)
            logger.info("Loaded \(self.scanSessions.count) scan sessions")
        } catch {
            logger.error("Failed to load scan sessions: \(error.localizedDescription)")
            errorMessage = "Failed to load scan sessions: \(error.localizedDescription)"
        }
    }
    
    func createScanSession(name: String, mode: ScanMode = .room, useReferencePhotos: Bool = true) -> ScanSession? {
        logger.info("Creating scan session with name: \(name), mode: \(mode.rawValue), useReferencePhotos: \(useReferencePhotos)")
        guard let context = modelContext else {
            logger.error("Model context is nil")
            return nil
        }

        let session = ScanSession(name: name, mode: mode, useReferencePhotos: useReferencePhotos)
        logger.debug("Created session object with ID: \(session.id), mode: \(session.scanMode ?? "unknown"), workflowStage: \(session.workflowStage.rawValue)")
        context.insert(session)
        logger.debug("Inserted session into context")

        loadScanSessions()
        logger.info("Scan sessions loaded, count: \(self.scanSessions.count)")
        return session
    }
    
    func deleteScanSession(_ session: ScanSession) {
        logger.info("Deleting scan session: \(session.name)")
        guard let context = modelContext else { 
            logger.error("Model context is nil")
            return 
        }
        
        // Delete associated files
        deleteSessionFiles(for: session)
        
        context.delete(session)
        
        // Force save to ensure deletion persists
        do {
            try context.save()
            logger.info("Context saved after deletion")
        } catch {
            logger.error("Failed to save context: \(error.localizedDescription)")
        }
        
        loadScanSessions()
        logger.info("Scan session deleted successfully")
    }
    
    func updateScanSession(_ session: ScanSession) {
        session.updatedAt = Date()
        loadScanSessions()
    }
    
    func getScanSession(byId id: UUID) -> ScanSession? {
        guard let context = modelContext else { return nil }
        
        let descriptor = FetchDescriptor<ScanSession>()
        
        do {
            let sessions = try context.fetch(descriptor)
            return sessions.first { $0.id == id }
        } catch {
            errorMessage = "Failed to fetch scan session: \(error.localizedDescription)"
            return nil
        }
    }
    
    // MARK: - Keyframe Methods
    
    func getKeyframes(for session: ScanSession) -> [Keyframe] {
        guard let context = modelContext else { return [] }
        
        let descriptor = FetchDescriptor<Keyframe>(
            sortBy: [SortDescriptor(\.index)]
        )
        
        do {
            let allKeyframes = try context.fetch(descriptor)
            return allKeyframes.filter { $0.scanSession?.id == session.id }
        } catch {
            errorMessage = "Failed to fetch keyframes: \(error.localizedDescription)"
            return []
        }
    }

    func getReferencePhotos(for session: ScanSession) -> [ReferencePhoto] {
        guard let context = modelContext else { return [] }

        let descriptor = FetchDescriptor<ReferencePhoto>(
            sortBy: [SortDescriptor(\.index)]
        )

        do {
            let allPhotos = try context.fetch(descriptor)
            return allPhotos.filter { $0.scanSession?.id == session.id }
        } catch {
            errorMessage = "Failed to fetch reference photos: \(error.localizedDescription)"
            return []
        }
    }

    func deleteKeyframes(for session: ScanSession) {
        guard let context = modelContext else { return }
        
        let descriptor = FetchDescriptor<Keyframe>()
        
        do {
            let allKeyframes = try context.fetch(descriptor)
            let keyframes = allKeyframes.filter { $0.scanSession?.id == session.id }
            for keyframe in keyframes {
                deleteKeyframeFiles(keyframe)
                context.delete(keyframe)
            }
        } catch {
            errorMessage = "Failed to delete keyframes: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Measurement Methods
    
    func getMeasurements(for session: ScanSession) -> [MeasurementResult] {
        guard let context = modelContext else { return [] }
        
        let descriptor = FetchDescriptor<MeasurementResult>()
        
        do {
            let allMeasurements = try context.fetch(descriptor)
            return allMeasurements.filter { $0.scanSession?.id == session.id }
        } catch {
            errorMessage = "Failed to fetch measurements: \(error.localizedDescription)"
            return []
        }
    }
    
    func saveMeasurements(_ measurements: [MeasurementResult], for session: ScanSession) {
        guard let context = modelContext else { return }
        
        for measurement in measurements {
            measurement.scanSession = session
            context.insert(measurement)
        }
        
        updateScanSession(session)
    }
    
    func deleteMeasurements(for session: ScanSession) {
        guard let context = modelContext else { return }
        
        let descriptor = FetchDescriptor<MeasurementResult>()
        
        do {
            let allMeasurements = try context.fetch(descriptor)
            let measurements = allMeasurements.filter { $0.scanSession?.id == session.id }
            for measurement in measurements {
                context.delete(measurement)
            }
        } catch {
            errorMessage = "Failed to delete measurements: \(error.localizedDescription)"
        }
    }
    
    // MARK: - File Management
    
    private func deleteSessionFiles(for session: ScanSession) {
        // Delete all keyframe files
        let keyframes = getKeyframes(for: session)
        for keyframe in keyframes {
            deleteKeyframeFiles(keyframe)
        }
        
        // Delete mesh and texture files if they exist
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let sessionPath = documentsPath.appendingPathComponent("scans/\(session.id.uuidString)")
        
        try? FileManager.default.removeItem(at: sessionPath)
    }
    
    private func deleteKeyframeFiles(_ keyframe: Keyframe) {
        let fileManager = FileManager.default
        
        if let rgbPath = keyframe.rgbImagePath {
            try? fileManager.removeItem(atPath: rgbPath)
        }
        
        if let depthPath = keyframe.depthImagePath {
            try? fileManager.removeItem(atPath: depthPath)
        }
        
        if let confidencePath = keyframe.confidenceImagePath {
            try? fileManager.removeItem(atPath: confidencePath)
        }
    }
    
    func getStorageUsage() -> (used: Int64, total: Int64) {
        let fileManager = FileManager.default
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        
        var totalSize: Int64 = 0
        
        if let enumerator = fileManager.enumerator(at: documentsPath, includingPropertiesForKeys: [.fileSizeKey]) {
            for case let url as URL in enumerator {
                if let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey]),
                   let fileSize = resourceValues.fileSize {
                    totalSize += Int64(fileSize)
                }
            }
        }
        
        // Get total device storage
        if let totalSpace = try? fileManager.attributesOfFileSystem(forPath: documentsPath.path)[.systemSize] as? Int64,
           let freeSpace = try? fileManager.attributesOfFileSystem(forPath: documentsPath.path)[.systemFreeSize] as? Int64 {
            let usedSpace = totalSpace - freeSpace
            return (totalSize, usedSpace)
        }
        
        return (totalSize, 0)
    }
    
    func clearOldScans(olderThan days: Int) {
        guard let context = modelContext else { return }
        
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        
        let descriptor = FetchDescriptor<ScanSession>()
        
        do {
            let allSessions = try context.fetch(descriptor)
            let oldSessions = allSessions.filter { $0.createdAt < cutoffDate }
            for session in oldSessions {
                deleteScanSession(session)
            }
        } catch {
            errorMessage = "Failed to clear old scans: \(error.localizedDescription)"
        }
    }
    
    // MARK: - File Listing Methods
    
    func getSessionFiles(for session: ScanSession) -> [SessionFile] {
        var files: [SessionFile] = []
        let fileManager = FileManager.default
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let sessionPath = documentsPath.appendingPathComponent("scans/\(session.id.uuidString)")
        
        // Check if session directory exists
        guard fileManager.fileExists(atPath: sessionPath.path) else {
            logger.debug("Session directory does not exist: \(sessionPath.path)")
            return files
        }
        
        // Recursively enumerate all files
        if let enumerator = fileManager.enumerator(at: sessionPath, includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]) {
            for case let url as URL in enumerator {
                do {
                    let resourceValues = try url.resourceValues(forKeys: [.fileSizeKey, .creationDateKey])
                    let fileSize = resourceValues.fileSize ?? 0
                    let creationDate = resourceValues.creationDate ?? Date()
                    
                    let fileType = determineFileType(from: url)
                    let fileName = url.lastPathComponent
                    let relativePath = url.path.replacingOccurrences(of: sessionPath.path, with: "")
                    
                    files.append(SessionFile(
                        name: fileName,
                        path: url.path,
                        relativePath: relativePath,
                        type: fileType,
                        size: Int64(fileSize),
                        createdAt: creationDate
                    ))
                } catch {
                    logger.error("Failed to get file info for \(url.path): \(error.localizedDescription)")
                }
            }
        }
        
        // Sort files by type and name
        files.sort { $0.type.rawValue < $1.type.rawValue || ($0.type == $1.type && $0.name < $1.name) }
        
        logger.debug("Found \(files.count) files for session \(session.name)")
        return files
    }
    
    private func determineFileType(from url: URL) -> SessionFileType {
        let pathExtension = url.pathExtension.lowercased()
        let filename = url.lastPathComponent.lowercased()

        // Check filename first for depth/confidence files (before checking extension)
        // This ensures depth_*.jpg and confidence_*.jpg are categorized correctly
        if filename.contains("depth") {
            return .depth
        } else if filename.contains("confidence") {
            return .depth
        } else if filename.contains("rgb") || filename.contains("color") {
            return .image
        } else if filename.contains("pose") || filename.contains("intrinsics") {
            return .metadata
        }

        // Then check extension for other file types
        switch pathExtension {
        case "jpg", "jpeg", "png", "heic", "heif", "dng", "tif", "tiff":
            return .image
        case "depth":
            return .depth
        case "json":
            return .metadata
        case "obj", "ply", "usdz":
            return .model
        case "txt", "log":
            return .log
        default:
            return .other
        }
    }
    
    // MARK: - Export Methods
    
    func exportSession(_ session: ScanSession) -> URL? {
        let fileManager = FileManager.default
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let exportPath = documentsPath.appendingPathComponent("exports")
        
        // Create exports directory
        try? fileManager.createDirectory(at: exportPath, withIntermediateDirectories: true)
        
        let exportFile = exportPath.appendingPathComponent("\(session.name.replacingOccurrences(of: " ", with: "_"))_\(session.id.uuidString).json")
        
        // Create export data
        let exportData = createExportData(for: session)
        
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let jsonData = try encoder.encode(exportData)
            try jsonData.write(to: exportFile)
            return exportFile
        } catch {
            errorMessage = "Failed to export session: \(error.localizedDescription)"
            return nil
        }
    }
    
    private func createExportData(for session: ScanSession) -> ExportData {
        let measurements = getMeasurements(for: session)
        let measurementExports = measurements.map { measurement in
            ExportMeasurement(
                id: measurement.id.uuidString,
                type: measurement.type.rawValue,
                name: measurement.name,
                value: measurement.value,
                unit: measurement.unit.rawValue,
                confidence: measurement.confidence,
                uncertainty: measurement.uncertainty
            )
        }
        
        return ExportData(
            id: session.id.uuidString,
            name: session.name,
            createdAt: session.createdAt,
            duration: session.duration,
            status: session.status.rawValue,
            keyframeCount: session.keyframeCount,
            measurements: measurementExports
        )
    }
}

// MARK: - Export Data Models

struct ExportData: Codable {
    let id: String
    let name: String
    let createdAt: Date
    let duration: TimeInterval
    let status: String
    let keyframeCount: Int
    let measurements: [ExportMeasurement]
}

struct ExportMeasurement: Codable {
    let id: String
    let type: String
    let name: String
    let value: Double
    let unit: String
    let confidence: Double
    let uncertainty: Double
}
