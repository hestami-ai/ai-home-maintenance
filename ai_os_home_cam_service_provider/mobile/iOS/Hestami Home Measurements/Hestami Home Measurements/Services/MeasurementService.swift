//
//  MeasurementService.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData
import Combine

@MainActor
class MeasurementService: ObservableObject {
    // MARK: - Published Properties
    
    @Published var measurements: [MeasurementResult] = []
    @Published var errorMessage: String?
    
    // MARK: - Private Properties
    
    private var modelContext: ModelContext?
    
    // MARK: - Initialization
    
    init() {}
    
    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }
    
    // MARK: - Measurement Methods
    
    func loadMeasurements(for session: ScanSession) {
        guard let context = modelContext else { return }
        
        let descriptor = FetchDescriptor<MeasurementResult>()
        
        do {
            let allMeasurements = try context.fetch(descriptor)
            measurements = allMeasurements.filter { $0.scanSession?.id == session.id }
        } catch {
            errorMessage = "Failed to load measurements: \(error.localizedDescription)"
        }
    }
    
    func addMeasurement(_ measurement: MeasurementResult, to session: ScanSession) {
        guard modelContext != nil else { return }
        
        measurement.scanSession = session
        modelContext?.insert(measurement)
        
        loadMeasurements(for: session)
    }
    
    func updateMeasurement(_ measurement: MeasurementResult) {
        guard modelContext != nil else { return }
        
        // SwiftData automatically tracks changes
        if let session = measurement.scanSession {
            loadMeasurements(for: session)
        }
    }
    
    func deleteMeasurement(_ measurement: MeasurementResult) {
        guard modelContext != nil else { return }
        
        let session = measurement.scanSession
        modelContext?.delete(measurement)
        
        if let session = session {
            loadMeasurements(for: session)
        }
    }
    
    // MARK: - Measurement Analysis
    
    func getMeasurementsByType(for session: ScanSession) -> [MeasurementType: [MeasurementResult]] {
        let sessionMeasurements = getMeasurements(for: session)
        var grouped: [MeasurementType: [MeasurementResult]] = [:]
        
        for measurement in sessionMeasurements {
            if grouped[measurement.type] == nil {
                grouped[measurement.type] = []
            }
            grouped[measurement.type]?.append(measurement)
        }
        
        return grouped
    }
    
    func getLowConfidenceMeasurements(for session: ScanSession, threshold: Double = 0.7) -> [MeasurementResult] {
        let sessionMeasurements = getMeasurements(for: session)
        return sessionMeasurements.filter { $0.confidence < threshold }
    }
    
    func getAverageConfidence(for session: ScanSession) -> Double {
        let sessionMeasurements = getMeasurements(for: session)
        guard !sessionMeasurements.isEmpty else { return 0.0 }
        
        let totalConfidence = sessionMeasurements.reduce(0.0) { $0 + $1.confidence }
        return totalConfidence / Double(sessionMeasurements.count)
    }
    
    func getMeasurementStatistics(for session: ScanSession) -> MeasurementStatistics {
        let sessionMeasurements = getMeasurements(for: session)
        
        guard !sessionMeasurements.isEmpty else {
            return MeasurementStatistics(
                totalMeasurements: 0,
                averageConfidence: 0.0,
                lowConfidenceCount: 0,
                highConfidenceCount: 0
            )
        }
        
        let totalConfidence = sessionMeasurements.reduce(0.0) { $0 + $1.confidence }
        let averageConfidence = totalConfidence / Double(sessionMeasurements.count)
        
        let lowConfidenceCount = sessionMeasurements.filter { $0.confidence < 0.7 }.count
        let highConfidenceCount = sessionMeasurements.filter { $0.confidence >= 0.9 }.count
        
        return MeasurementStatistics(
            totalMeasurements: sessionMeasurements.count,
            averageConfidence: averageConfidence,
            lowConfidenceCount: lowConfidenceCount,
            highConfidenceCount: highConfidenceCount
        )
    }
    
    // MARK: - Measurement Validation
    
    func validateMeasurement(_ measurement: MeasurementResult) -> ValidationResult {
        var issues: [String] = []
        
        // Check confidence
        if measurement.confidence < 0.5 {
            issues.append("Low confidence (\(String(format: "%.1f%%", measurement.confidence * 100)))")
        }
        
        // Check uncertainty relative to value
        let uncertaintyRatio = measurement.uncertainty / measurement.value
        if uncertaintyRatio > 0.1 {
            issues.append("High uncertainty ratio (\(String(format: "%.1f%%", uncertaintyRatio * 100)))")
        }
        
        // Check for reasonable values based on type
        switch measurement.type {
        case .doorWidth:
            if measurement.value < 600 || measurement.value > 1200 {
                issues.append("Unusual door width")
            }
        case .doorHeight:
            if measurement.value < 1800 || measurement.value > 2500 {
                issues.append("Unusual door height")
            }
        case .windowWidth:
            if measurement.value < 300 || measurement.value > 3000 {
                issues.append("Unusual window width")
            }
        case .windowHeight:
            if measurement.value < 300 || measurement.value > 2500 {
                issues.append("Unusual window height")
            }
        case .roomWidth, .roomLength:
            if measurement.value < 1000 || measurement.value > 10000 {
                issues.append("Unusual room dimension")
            }
        case .ceilingHeight:
            if measurement.value < 2000 || measurement.value > 4000 {
                issues.append("Unusual ceiling height")
            }
        default:
            break
        }
        
        return ValidationResult(
            isValid: issues.isEmpty,
            issues: issues
        )
    }
    
    // MARK: - Helper Methods
    
    private func getMeasurements(for session: ScanSession) -> [MeasurementResult] {
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
}

// MARK: - Supporting Types

struct MeasurementStatistics {
    let totalMeasurements: Int
    let averageConfidence: Double
    let lowConfidenceCount: Int
    let highConfidenceCount: Int
}

struct ValidationResult {
    let isValid: Bool
    let issues: [String]
}
