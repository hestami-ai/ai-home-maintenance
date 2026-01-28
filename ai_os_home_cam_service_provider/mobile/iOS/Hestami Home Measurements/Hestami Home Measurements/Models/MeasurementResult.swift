//
//  MeasurementResult.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation
import SwiftData
import simd

@Model
final class MeasurementResult {
    var id: UUID
    var type: MeasurementType
    var name: String
    var value: Double
    var unit: MeasurementUnit
    var confidence: Double
    var uncertainty: Double
    var position: String? // simd_float3 encoded as base64 string
    var normal: String? // simd_float3 encoded as base64 string
    var metadata: String? // JSON string for additional data
    
    var scanSession: ScanSession?
    
    init(type: MeasurementType, name: String, value: Double, unit: MeasurementUnit, confidence: Double, uncertainty: Double) {
        self.id = UUID()
        self.type = type
        self.name = name
        self.value = value
        self.unit = unit
        self.confidence = confidence
        self.uncertainty = uncertainty
    }
    
    // Helper to store position as base64 string
    func setPosition(_ position: simd_float3) {
        var vec = position
        let data = Data(bytes: &vec, count: MemoryLayout<simd_float3>.size)
        self.position = data.base64EncodedString()
    }

    // Helper to retrieve position
    func getPosition() -> simd_float3? {
        guard let base64String = position,
              let data = Data(base64Encoded: base64String) else { return nil }
        return data.withUnsafeBytes { pointer in
            pointer.load(as: simd_float3.self)
        }
    }

    // Helper to store normal as base64 string
    func setNormal(_ normal: simd_float3) {
        var vec = normal
        let data = Data(bytes: &vec, count: MemoryLayout<simd_float3>.size)
        self.normal = data.base64EncodedString()
    }

    // Helper to retrieve normal
    func getNormal() -> simd_float3? {
        guard let base64String = normal,
              let data = Data(base64Encoded: base64String) else { return nil }
        return data.withUnsafeBytes { pointer in
            pointer.load(as: simd_float3.self)
        }
    }
    
    // Formatted value with uncertainty
    var formattedValue: String {
        let formatter = NumberFormatter()
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 2
        let valueStr = formatter.string(from: NSNumber(value: value)) ?? "\(value)"
        let uncertaintyStr = formatter.string(from: NSNumber(value: uncertainty)) ?? "\(uncertainty)"
        return "\(valueStr) ± \(uncertaintyStr) \(unit.symbol)"
    }
    
    // Confidence level description
    var confidenceLevel: String {
        switch confidence {
        case 0.9...1.0: return "High"
        case 0.7..<0.9: return "Medium"
        case 0.5..<0.7: return "Low"
        default: return "Very Low"
        }
    }
}

enum MeasurementType: String, Codable, CaseIterable {
    case doorWidth = "door_width"
    case doorHeight = "door_height"
    case windowWidth = "window_width"
    case windowHeight = "window_height"
    case wallLength = "wall_length"
    case wallHeight = "wall_height"
    case roomWidth = "room_width"
    case roomLength = "room_length"
    case roomHeight = "room_height"
    case floorArea = "floor_area"
    case ceilingHeight = "ceiling_height"
    case custom = "custom"
    
    var displayName: String {
        switch self {
        case .doorWidth: return "Door Width"
        case .doorHeight: return "Door Height"
        case .windowWidth: return "Window Width"
        case .windowHeight: return "Window Height"
        case .wallLength: return "Wall Length"
        case .wallHeight: return "Wall Height"
        case .roomWidth: return "Room Width"
        case .roomLength: return "Room Length"
        case .roomHeight: return "Room Height"
        case .floorArea: return "Floor Area"
        case .ceilingHeight: return "Ceiling Height"
        case .custom: return "Custom"
        }
    }
}

enum MeasurementUnit: String, Codable, CaseIterable {
    case millimeters = "mm"
    case centimeters = "cm"
    case meters = "m"
    case inches = "in"
    case feet = "ft"
    case squareMeters = "m²"
    case squareFeet = "ft²"
    
    var symbol: String {
        return self.rawValue
    }
    
    var displayName: String {
        switch self {
        case .millimeters: return "Millimeters"
        case .centimeters: return "Centimeters"
        case .meters: return "Meters"
        case .inches: return "Inches"
        case .feet: return "Feet"
        case .squareMeters: return "Square Meters"
        case .squareFeet: return "Square Feet"
        }
    }
}

// Group of related measurements (e.g., all measurements for a door)
@Model
final class MeasurementGroup {
    var id: UUID
    var name: String
    var type: MeasurementGroupType
    var createdAt: Date
    
    @Relationship(deleteRule: .cascade)
    var measurements: [MeasurementResult]?
    
    init(name: String, type: MeasurementGroupType) {
        self.id = UUID()
        self.name = name
        self.type = type
        self.createdAt = Date()
    }
}

enum MeasurementGroupType: String, Codable, CaseIterable {
    case door = "door"
    case window = "window"
    case wall = "wall"
    case room = "room"
    case floor = "floor"
    case ceiling = "ceiling"
    case custom = "custom"
    
    var displayName: String {
        switch self {
        case .door: return "Door"
        case .window: return "Window"
        case .wall: return "Wall"
        case .room: return "Room"
        case .floor: return "Floor"
        case .ceiling: return "Ceiling"
        case .custom: return "Custom"
        }
    }
}
