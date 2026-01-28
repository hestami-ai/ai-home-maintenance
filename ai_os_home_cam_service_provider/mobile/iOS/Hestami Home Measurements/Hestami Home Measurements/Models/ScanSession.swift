//
//  ScanSession.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData

@Model
final class ScanSession {
    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    var duration: TimeInterval
    var status: ScanStatus
    var keyframeCount: Int
    var cloudUploadId: String?
    var cloudProcessingStatus: CloudProcessingStatus?
    var errorMessage: String?
    
    // Coverage metrics
    var scanMode: String?
    var coverageScore: Double?
    var readinessScore: Double?
    var completionReason: String?

    // Two-stage workflow tracking
    var workflowStageRaw: String?
    var workflowStage: CaptureWorkflowStage {
        get { CaptureWorkflowStage(rawValue: workflowStageRaw ?? "") ?? .referenceCapture }
        set { workflowStageRaw = newValue.rawValue }
    }
    var referencePhotoCount: Int
    var referencePhotoCaptureComplete: Bool?

    @Relationship(deleteRule: .cascade, inverse: \Keyframe.scanSession)
    var keyframes: [Keyframe]?

    @Relationship(deleteRule: .cascade, inverse: \ReferencePhoto.scanSession)
    var referencePhotos: [ReferencePhoto]?

    @Relationship(deleteRule: .cascade, inverse: \MeasurementResult.scanSession)
    var measurements: [MeasurementResult]?
    
    init(name: String, mode: ScanMode = .room, useReferencePhotos: Bool = true) {
        self.id = UUID()
        self.name = name
        self.createdAt = Date()
        self.updatedAt = Date()
        self.duration = 0
        self.status = .notStarted
        self.keyframeCount = 0
        self.scanMode = mode.rawValue
        self.coverageScore = 0.0
        self.readinessScore = 0.0
        // Two-stage workflow
        self.workflowStageRaw = useReferencePhotos ? CaptureWorkflowStage.referenceCapture.rawValue : CaptureWorkflowStage.arkitScan.rawValue
        self.referencePhotoCount = 0
        self.referencePhotoCaptureComplete = !useReferencePhotos
    }
}

enum ScanStatus: String, Codable, CaseIterable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case paused = "paused"
    case completed = "completed"
    case uploading = "uploading"
    case processing = "processing"
    case failed = "failed"
    case success = "success"
}

enum CloudProcessingStatus: String, Codable {
    case pending = "pending"
    case processing = "processing"
    case completed = "completed"
    case failed = "failed"
}
