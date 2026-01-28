//
//  CloudService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData
import Combine
import UIKit
import simd

@MainActor
class CloudService: ObservableObject {
    // MARK: - Published Properties
    
    @Published var isUploading = false
    @Published var isDownloading = false
    @Published var uploadProgress: Double = 0.0
    @Published var downloadProgress: Double = 0.0
    @Published var errorMessage: String?
    @Published var currentUploadId: String?
    
    // MARK: - Private Properties
    
    private let configuration: CloudConfiguration
    private let urlSession: URLSession
    private var modelContext: ModelContext?
    
    // MARK: - Initialization
    
    init(configuration: CloudConfiguration = .default) {
        self.configuration = configuration
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = configuration.timeout
        config.timeoutIntervalForResource = configuration.timeout * 2
        self.urlSession = URLSession(configuration: config)
    }
    
    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }
    
    // MARK: - Upload Methods
    
    func uploadScan(session: ScanSession) async throws -> ScanUploadResponse {
        guard session.status == .completed else {
            throw CloudError.invalidSessionStatus
        }
        
        isUploading = true
        uploadProgress = 0.0
        errorMessage = nil
        
        defer {
            isUploading = false
        }
        
        do {
            // Step 1: Initialize upload
            let uploadRequest = createUploadRequest(for: session)
            let uploadResponse = try await performUploadInitialization(uploadRequest)
            
            currentUploadId = uploadResponse.uploadId
            session.cloudUploadId = uploadResponse.uploadId
            session.status = .uploading
            
            // Step 2: Upload keyframes
            try await uploadKeyframes(for: session, uploadId: uploadResponse.uploadId)
            
            // Step 3: Finalize upload
            try await finalizeUpload(uploadId: uploadResponse.uploadId, sessionId: session.id)
            
            session.status = .processing
            session.cloudProcessingStatus = .pending
            
            return uploadResponse
            
        } catch {
            errorMessage = error.localizedDescription
            session.status = .failed
            session.errorMessage = error.localizedDescription
            throw error
        }
    }
    
    private func createUploadRequest(for session: ScanSession) -> ScanUploadRequest {
        let metadata = ScanMetadata(
            deviceModel: UIDevice.current.model,
            iOSVersion: UIDevice.current.systemVersion,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0",
            arKitVersion: "6.0", // ARKit version
            lidarAvailable: true // iPhone 14+ has LiDAR
        )
        
        return ScanUploadRequest(
            sessionId: session.id,
            sessionName: session.name,
            createdAt: session.createdAt,
            duration: session.duration,
            keyframeCount: session.keyframeCount,
            metadata: metadata
        )
    }
    
    private func performUploadInitialization(_ request: ScanUploadRequest) async throws -> ScanUploadResponse {
        let url = URL(string: configuration.baseURL + configuration.uploadEndpoint)!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        urlRequest.httpBody = try encoder.encode(request)
        
        let (data, response) = try await urlSession.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            throw try parseErrorResponse(from: data)
        }
        
        return try JSONDecoder().decode(ScanUploadResponse.self, from: data)
    }
    
    private func uploadKeyframes(for session: ScanSession, uploadId: String) async throws {
        guard let context = modelContext else {
            throw CloudError.modelContextNotSet
        }
        
        // Fetch keyframes for this session
        let descriptor = FetchDescriptor<Keyframe>(
            sortBy: [SortDescriptor(\.index)]
        )
        
        // Filter keyframes for this session
        let keyframes = try context.fetch(descriptor).filter { $0.scanSession?.id == session.id }
        
        guard !keyframes.isEmpty else {
            throw CloudError.noKeyframes
        }
        
        let totalFiles = keyframes.count * 3 // RGB, depth, confidence per keyframe
        var uploadedFiles = 0
        
        for keyframe in keyframes {
            // Upload RGB image
            if let rgbPath = keyframe.rgbImagePath,
               let rgbData = try? Data(contentsOf: URL(fileURLWithPath: rgbPath)) {
                try await uploadFile(
                    uploadId: uploadId,
                    fileType: .rgbImage,
                    fileIndex: keyframe.index,
                    totalFiles: totalFiles,
                    data: rgbData,
                    filename: "rgb_\(keyframe.id.uuidString).jpg",
                    mimeType: "image/jpeg"
                )
                uploadedFiles += 1
                uploadProgress = Double(uploadedFiles) / Double(totalFiles)
            }
            
            // Upload depth image
            if let depthPath = keyframe.depthImagePath,
               let depthData = try? Data(contentsOf: URL(fileURLWithPath: depthPath)) {
                try await uploadFile(
                    uploadId: uploadId,
                    fileType: .depthImage,
                    fileIndex: keyframe.index,
                    totalFiles: totalFiles,
                    data: depthData,
                    filename: "depth_\(keyframe.id.uuidString).jpg",
                    mimeType: "image/jpeg"
                )
                uploadedFiles += 1
                uploadProgress = Double(uploadedFiles) / Double(totalFiles)
            }
            
            // Upload confidence image
            if let confidencePath = keyframe.confidenceImagePath,
               let confidenceData = try? Data(contentsOf: URL(fileURLWithPath: confidencePath)) {
                try await uploadFile(
                    uploadId: uploadId,
                    fileType: .confidenceImage,
                    fileIndex: keyframe.index,
                    totalFiles: totalFiles,
                    data: confidenceData,
                    filename: "confidence_\(keyframe.id.uuidString).jpg",
                    mimeType: "image/jpeg"
                )
                uploadedFiles += 1
                uploadProgress = Double(uploadedFiles) / Double(totalFiles)
            }
            
            // Mark keyframe as uploaded
            keyframe.isUploaded = true
        }
    }
    
    private func uploadFile(
        uploadId: String,
        fileType: FileType,
        fileIndex: Int,
        totalFiles: Int,
        data: Data,
        filename: String,
        mimeType: String
    ) async throws {
        let url = URL(string: configuration.baseURL + configuration.uploadEndpoint + "/\(uploadId)/files")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add file data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add metadata
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"fileType\"\r\n\r\n".data(using: .utf8)!)
        body.append(fileType.rawValue.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"fileIndex\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(fileIndex)".data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (_, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 || httpResponse.statusCode == 201 else {
            throw CloudError.uploadFailed
        }
    }
    
    private func finalizeUpload(uploadId: String, sessionId: UUID) async throws {
        let url = URL(string: configuration.baseURL + configuration.uploadEndpoint + "/\(uploadId)/finalize")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["sessionId": sessionId.uuidString]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw CloudError.uploadFailed
        }
    }
    
    // MARK: - Status Check Methods
    
    func checkProcessingStatus(uploadId: String) async throws -> ProcessingStatusResponse {
        let url = URL(string: configuration.baseURL + configuration.statusEndpoint + "/\(uploadId)")!
        let request = URLRequest(url: url)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw try parseErrorResponse(from: data)
        }
        
        return try JSONDecoder().decode(ProcessingStatusResponse.self, from: data)
    }
    
    // MARK: - Download Methods
    
    func downloadResults(uploadId: String, sessionId: UUID) async throws -> DownloadedResults {
        isDownloading = true
        downloadProgress = 0.0
        errorMessage = nil
        
        defer {
            isDownloading = false
        }
        
        do {
            // Get results metadata
            let resultsResponse = try await fetchResults(uploadId: uploadId)
            
            guard let results = resultsResponse.results else {
                throw CloudError.resultsNotAvailable
            }
            
            // Download mesh
            downloadProgress = 0.2
            let meshData = try await downloadFile(from: results.meshUrl)
            
            // Download texture if available
            var textureData: Data?
            if let textureUrl = results.textureUrl {
                downloadProgress = 0.5
                textureData = try await downloadFile(from: textureUrl)
            }
            
            downloadProgress = 0.8
            
            // Convert cloud measurements to local models
            let measurements = results.measurements.map { cloudMeasurement in
                let measurement = MeasurementResult(
                    type: MeasurementType(rawValue: cloudMeasurement.type) ?? .custom,
                    name: cloudMeasurement.name,
                    value: cloudMeasurement.value,
                    unit: MeasurementUnit(rawValue: cloudMeasurement.unit) ?? .millimeters,
                    confidence: cloudMeasurement.confidence,
                    uncertainty: cloudMeasurement.uncertainty
                )
                
                // Set position if available
                if let positionArray = cloudMeasurement.position, positionArray.count == 3 {
                    measurement.setPosition(simd_float3(
                        Float(positionArray[0]),
                        Float(positionArray[1]),
                        Float(positionArray[2])
                    ))
                }
                
                // Set normal if available
                if let normalArray = cloudMeasurement.normal, normalArray.count == 3 {
                    measurement.setNormal(simd_float3(
                        Float(normalArray[0]),
                        Float(normalArray[1]),
                        Float(normalArray[2])
                    ))
                }
                
                measurement.metadata = cloudMeasurement.metadata
                return measurement
            }
            
            downloadProgress = 1.0
            
            return DownloadedResults(
                uploadId: uploadId,
                sessionId: sessionId,
                meshData: meshData,
                textureData: textureData,
                measurements: measurements,
                metadata: results
            )
            
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }
    
    private func fetchResults(uploadId: String) async throws -> ScanResultsResponse {
        let url = URL(string: configuration.baseURL + configuration.resultsEndpoint + "/\(uploadId)")!
        let request = URLRequest(url: url)
        
        let (data, response) = try await urlSession.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw try parseErrorResponse(from: data)
        }
        
        return try JSONDecoder().decode(ScanResultsResponse.self, from: data)
    }
    
    private func downloadFile(from urlString: String) async throws -> Data {
        guard let url = URL(string: urlString) else {
            throw CloudError.invalidURL
        }
        
        let (data, response) = try await urlSession.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw CloudError.downloadFailed
        }
        
        return data
    }
    
    // MARK: - Helper Methods
    
    private func parseErrorResponse(from data: Data) throws -> CloudError {
        if let errorResponse = try? JSONDecoder().decode(CloudErrorResponse.self, from: data) {
            return .serverError(errorResponse.error, code: errorResponse.code)
        }
        return .unknownError
    }
}

// MARK: - Cloud Error

enum CloudError: LocalizedError {
    case invalidSessionStatus
    case modelContextNotSet
    case noKeyframes
    case invalidResponse
    case invalidURL
    case uploadFailed
    case downloadFailed
    case resultsNotAvailable
    case serverError(String, code: String)
    case unknownError
    
    var errorDescription: String? {
        switch self {
        case .invalidSessionStatus:
            return "Session must be completed before uploading"
        case .modelContextNotSet:
            return "Model context not set"
        case .noKeyframes:
            return "No keyframes to upload"
        case .invalidResponse:
            return "Invalid response from server"
        case .invalidURL:
            return "Invalid URL"
        case .uploadFailed:
            return "Upload failed"
        case .downloadFailed:
            return "Download failed"
        case .resultsNotAvailable:
            return "Results not available yet"
        case .serverError(let message, _):
            return "Server error: \(message)"
        case .unknownError:
            return "An unknown error occurred"
        }
    }
}
