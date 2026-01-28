//
//  StorageModels.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import Foundation

// MARK: - Session File Model

struct SessionFile: Identifiable {
    let id = UUID()
    let name: String
    let path: String
    let relativePath: String
    let type: SessionFileType
    let size: Int64
    let createdAt: Date
    
    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }
    
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: createdAt)
    }
}

// MARK: - File Type Enum

enum SessionFileType: String, CaseIterable {
    case image = "Image"
    case depth = "Depth"
    case metadata = "Metadata"
    case model = "3D Model"
    case log = "Log"
    case other = "Other"
    
    var icon: String {
        switch self {
        case .image: return "photo"
        case .depth: return "cube"
        case .metadata: return "doc.text"
        case .model: return "cube.transparent"
        case .log: return "doc.plaintext"
        case .other: return "doc"
        }
    }
    
    var color: String {
        switch self {
        case .image: return "blue"
        case .depth: return "purple"
        case .metadata: return "orange"
        case .model: return "green"
        case .log: return "gray"
        case .other: return "gray"
        }
    }
}
