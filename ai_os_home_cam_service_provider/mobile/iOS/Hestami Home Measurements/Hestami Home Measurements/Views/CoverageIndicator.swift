//
//  CoverageIndicator.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI

struct CoverageIndicator: View {
    let metrics: CoverageMetrics
    let isReady: Bool
    let failureReasons: [String]
    let scanMode: ScanMode
    
    var body: some View {
        VStack(spacing: 8) {
            // Top row: Status icon and score
            HStack(spacing: 12) {
                // Status icon
                VStack(spacing: 2) {
                    Image(systemName: isReady ? "checkmark.circle.fill" : statusIcon)
                        .font(.title2)
                        .foregroundColor(statusColor)
                    
                    Text("\(Int(metrics.readinessScore * 100))%")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(statusColor)
                }
                
                // Mode-specific status
                VStack(alignment: .leading, spacing: 4) {
                    Text(modeStatusText)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(statusColor)
                    
                    // Mode-specific indicators
                    modeSpecificIndicators
                }
                
                Spacer()
            }
            
            // Bottom row: Compact metrics
            HStack(spacing: 8) {
                Text("Cov: \(Int(metrics.coverageScore * 100))%")
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Obs: \(Int(metrics.observabilityScore * 100))%")
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Dpt: \(Int(metrics.depthQuality * 100))%")
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                Spacer()
                
                // Primary failure reason
                if !isReady && !failureReasons.isEmpty {
                    Text(failureReasons.first ?? "")
                        .font(.caption2)
                        .foregroundColor(AppTheme.error)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.overlayDark.opacity(0.8))
        )
    }
    
    // MARK: - Mode-Specific Indicators
    
    @ViewBuilder
    private var modeSpecificIndicators: some View {
        switch scanMode {
        case .element:
            elementIndicators
        case .room:
            roomIndicators
        }
    }
    
    private var elementIndicators: some View {
        HStack(spacing: 12) {
            // Wall Plane Locked
            HStack(spacing: 4) {
                Image(systemName: metrics.wallPlaneLocked ? "rectangle.portrait.fill" : "rectangle.portrait")
                    .foregroundColor(metrics.wallPlaneLocked ? AppTheme.success : AppTheme.disabledText)
                Text("Wall")
                    .font(.caption2)
                    .foregroundColor(metrics.wallPlaneLocked ? AppTheme.success : AppTheme.secondaryText)
            }
            
            // Opening Likely
            HStack(spacing: 4) {
                Image(systemName: metrics.openingLikely ? "door.left.hand.open.fill" : "door.left.hand.closed")
                    .foregroundColor(metrics.openingLikely ? AppTheme.success : AppTheme.disabledText)
                Text("Opening")
                    .font(.caption2)
                    .foregroundColor(metrics.openingLikely ? AppTheme.success : AppTheme.secondaryText)
            }
            
            // Boundary Coverage
            HStack(spacing: 4) {
                Image(systemName: boundaryIcon)
                    .foregroundColor(boundaryColor)
                Text("Boundary: \(Int(metrics.boundaryCoverage * 100))%")
                    .font(.caption2)
                    .foregroundColor(boundaryColor)
            }
        }
    }
    
    private var roomIndicators: some View {
        HStack(spacing: 12) {
            // Walls Detected
            HStack(spacing: 4) {
                Image(systemName: "square.fill")
                    .foregroundColor(wallsColor)
                Text("Walls: \(metrics.wallsDetected)/4")
                    .font(.caption2)
                    .foregroundColor(wallsColor)
            }
            
            // Floor Detected
            HStack(spacing: 4) {
                Image(systemName: metrics.floorDetected ? "checkmark.square.fill" : "square")
                    .foregroundColor(metrics.floorDetected ? AppTheme.success : AppTheme.disabledText)
                Text("Floor")
                    .font(.caption2)
                    .foregroundColor(metrics.floorDetected ? AppTheme.success : AppTheme.secondaryText)
            }
            
            // Corners Detected
            HStack(spacing: 4) {
                Image(systemName: "triangle.fill")
                    .foregroundColor(cornersColor)
                Text("Corners: \(metrics.cornersDetected)")
                    .font(.caption2)
                    .foregroundColor(cornersColor)
            }
        }
    }
    
    // MARK: - Helper Properties
    
    private var statusColor: Color {
        if isReady {
            return AppTheme.success
        } else if metrics.readinessScore >= 0.50 {
            return AppTheme.warning
        } else {
            return AppTheme.error
        }
    }
    
    private var statusIcon: String {
        if metrics.trackingQuality < 0.5 {
            return "wifi.slash"
        } else if metrics.depthQuality < 0.5 {
            return "sensor.fill"
        } else {
            return "exclamationmark.triangle.fill"
        }
    }
    
    private var modeStatusText: String {
        switch scanMode {
        case .element:
            if isReady {
                return "Element Ready"
            } else if metrics.wallPlaneLocked && metrics.openingLikely {
                return "Scanning boundary..."
            } else if metrics.wallPlaneLocked {
                return "Finding opening..."
            } else {
                return "Finding wall plane..."
            }
        case .room:
            if isReady {
                return "Room Ready"
            } else if metrics.floorDetected && metrics.wallsDetected >= 3 {
                return "Scanning corners..."
            } else if metrics.floorDetected {
                return "Scanning walls..."
            } else {
                return "Finding floor..."
            }
        }
    }
    
    private var boundaryColor: Color {
        if metrics.boundaryCoverage >= 0.90 {
            return AppTheme.success
        } else if metrics.boundaryCoverage >= 0.60 {
            return AppTheme.warning
        } else {
            return AppTheme.error
        }
    }
    
    private var boundaryIcon: String {
        if metrics.boundaryCoverage >= 0.90 {
            return "checkmark.circle.fill"
        } else if metrics.boundaryCoverage >= 0.60 {
            return "circle.fill"
        } else {
            return "circle"
        }
    }
    
    private var wallsColor: Color {
        if metrics.wallsDetected >= 4 {
            return AppTheme.success
        } else if metrics.wallsDetected >= 2 {
            return AppTheme.warning
        } else {
            return AppTheme.disabledText
        }
    }
    
    private var cornersColor: Color {
        if metrics.cornersDetected >= 4 {
            return AppTheme.success
        } else if metrics.cornersDetected >= 2 {
            return AppTheme.warning
        } else {
            return AppTheme.disabledText
        }
    }
}

struct CoverageMetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            
            Text(value)
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
            
            Text(title)
                .font(.caption2)
                .foregroundColor(AppTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(color.opacity(0.1))
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        // Ready Element state
        CoverageIndicator(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.85
                m.coverageScore = 0.90
                m.observabilityScore = 0.80
                m.depthQuality = 0.95
                m.trackingQuality = 1.0
                m.wallPlaneLocked = true
                m.openingLikely = true
                m.boundaryCoverage = 0.92
                return m
            }(),
            isReady: true,
            failureReasons: [],
            scanMode: .element
        )

        // Not Ready Element state
        CoverageIndicator(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.35
                m.coverageScore = 0.40
                m.observabilityScore = 0.30
                m.depthQuality = 0.50
                m.trackingQuality = 0.5
                m.wallPlaneLocked = true
                m.openingLikely = false
                m.boundaryCoverage = 0.45
                return m
            }(),
            isReady: false,
            failureReasons: ["Boundary coverage 45% < 90%"],
            scanMode: .element
        )

        // Ready Room state
        CoverageIndicator(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.82
                m.coverageScore = 0.85
                m.observabilityScore = 0.78
                m.depthQuality = 0.90
                m.trackingQuality = 1.0
                m.wallsDetected = 4
                m.floorDetected = true
                m.cornersDetected = 4
                return m
            }(),
            isReady: true,
            failureReasons: [],
            scanMode: .room
        )

        // Not Ready Room state
        CoverageIndicator(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.42
                m.coverageScore = 0.45
                m.observabilityScore = 0.40
                m.depthQuality = 0.55
                m.trackingQuality = 0.6
                m.wallsDetected = 2
                m.floorDetected = true
                m.cornersDetected = 1
                return m
            }(),
            isReady: false,
            failureReasons: [
                "Coverage too low (45% < 65%)",
                "Need at least 3 walls (found 2)",
                "Floor plane not detected"
            ],
            scanMode: .room
        )
    }
    .padding()
}
