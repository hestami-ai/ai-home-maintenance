//
//  CloudModels.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation

// MARK: - Upload Request

struct ScanUploadRequest: Codable {
    let sessionId: UUID
    let sessionName: String
    let createdAt: Date
    let duration: TimeInterval
    let keyframeCount: Int
    let metadata: ScanMetadata
}

struct ScanMetadata: Codable {
    let deviceModel: String
    let iOSVersion: String
    let appVersion: String
    let arKitVersion: String
    let lidarAvailable: Bool
}

// MARK: - Upload Response

struct ScanUploadResponse: Codable {
    let uploadId: String
    let sessionId: UUID
    let status: String
    let estimatedProcessingTime: TimeInterval?
    let message: String?
}

// MARK: - Processing Status

struct ProcessingStatusResponse: Codable {
    let uploadId: String
    let sessionId: UUID
    let status: ProcessingStatus
    let progress: Double
    let estimatedTimeRemaining: TimeInterval?
    let errorMessage: String?
}

enum ProcessingStatus: String, Codable {
    case pending = "pending"
    case uploading = "uploading"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
}

// MARK: - Results Response

struct ScanResultsResponse: Codable {
    let uploadId: String
    let sessionId: UUID
    let status: ProcessingStatus
    let results: ScanResults?
    let errorMessage: String?
}

struct ScanResults: Codable {
    let meshUrl: String
    let textureUrl: String?
    let measurements: [CloudMeasurement]
    let processingTime: TimeInterval
    let metadata: ResultsMetadata
}

struct CloudMeasurement: Codable {
    let id: UUID
    let type: String
    let name: String
    let value: Double
    let unit: String
    let confidence: Double
    let uncertainty: Double
    let position: [Double]?
    let normal: [Double]?
    let metadata: String?
}

struct ResultsMetadata: Codable {
    let accuracy: AccuracyMetrics
    let sceneType: String
    let processingDetails: ProcessingDetails
}

struct AccuracyMetrics: Codable {
    let averageError: Double
    let maxError: Double
    let confidence95: Double
}

struct ProcessingDetails: Codable {
    let bundleAdjustmentTime: Double
    let tsdfFusionTime: Double
    let meshingTime: Double
    let texturingTime: Double
    let measurementExtractionTime: Double
}

// MARK: - Error Response

struct CloudErrorResponse: Codable {
    let error: String
    let code: String
    let details: String?
    let timestamp: Date
}

// MARK: - File Upload

struct FileUploadRequest {
    let uploadId: String
    let fileType: FileType
    let fileIndex: Int
    let totalFiles: Int
    let data: Data
    let filename: String
    let mimeType: String
}

enum FileType: String, Codable {
    case rgbImage = "rgb_image"
    case depthImage = "depth_image"
    case confidenceImage = "confidence_image"
    case poseData = "pose_data"
    case metadata = "metadata"
}

// MARK: - Download Models

struct DownloadedResults {
    let uploadId: String
    let sessionId: UUID
    let meshData: Data
    let textureData: Data?
    let measurements: [MeasurementResult]
    let metadata: ScanResults
}

// MARK: - Configuration

struct CloudConfiguration: Sendable {
    let baseURL: String
    let uploadEndpoint: String
    let statusEndpoint: String
    let resultsEndpoint: String
    let timeout: TimeInterval
    let maxRetries: Int
    
    nonisolated static let `default` = CloudConfiguration(
        baseURL: "https://api.hestami.com/v1",
        uploadEndpoint: "/scans/upload",
        statusEndpoint: "/scans/status",
        resultsEndpoint: "/scans/results",
        timeout: 300.0,
        maxRetries: 3
    )
}
