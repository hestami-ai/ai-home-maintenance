//
//  StopConditionsPanel.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/27/26.
//

import SwiftUI

struct StopConditionsPanel: View {
    let metrics: CoverageMetrics
    let isReady: Bool
    let scanMode: ScanMode
    let failureReasons: [String]
    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(spacing: 8) {
            // Header - tap to expand
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)

                    Text("Stop Conditions")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.primaryText)

                    Spacer()

                    // Overall status
                    HStack(spacing: 4) {
                        Circle()
                            .fill(isReady ? AppTheme.success : AppTheme.warning)
                            .frame(width: 8, height: 8)

                        Text(isReady ? "Ready" : "Not Ready")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(isReady ? AppTheme.success : AppTheme.warning)
                    }
                }
            }
            .buttonStyle(.plain)

            // Expanded content
            if isExpanded {
                VStack(spacing: 6) {
                    // Mode-specific conditions
                    ForEach(modeConditions, id: \.self) { condition in
                        StopConditionRow(
                            title: condition.title,
                            icon: condition.icon,
                            isMet: condition.isMet,
                            target: condition.target
                        )
                    }

                    // Failure reasons
                    if !isReady && !failureReasons.isEmpty {
                        Divider()
                            .padding(.vertical, 4)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Issues to fix:")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(AppTheme.error)

                            ForEach(failureReasons, id: \.self) { reason in
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .font(.caption2)
                                        .foregroundColor(AppTheme.error)
                                    Text(reason)
                                        .font(.caption2)
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                            }
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.overlayDark.opacity(0.8))
        )
    }

    private struct Condition: Hashable {
        let title: String
        let icon: String
        let isMet: Bool
        let target: String
    }

    private var modeConditions: [Condition] {
        switch scanMode {
        case .element:
            return [
                Condition(
                    title: "Wall Plane Locked",
                    icon: "rectangle.portrait.fill",
                    isMet: metrics.wallPlaneLocked,
                    target: "Required"
                ),
                Condition(
                    title: "Opening Detected",
                    icon: "door.left.hand.open.fill",
                    isMet: metrics.openingLikely,
                    target: "Required"
                ),
                Condition(
                    title: "Boundary Coverage",
                    icon: "checkmark.circle.fill",
                    isMet: metrics.boundaryCoverage >= 0.90,
                    target: "≥90%"
                ),
                Condition(
                    title: "Readiness Score",
                    icon: "chart.bar.fill",
                    isMet: metrics.readinessScore >= 0.75,
                    target: "≥75%"
                )
            ]
        case .room:
            return [
                Condition(
                    title: "Floor Detected",
                    icon: "checkmark.square.fill",
                    isMet: metrics.floorDetected,
                    target: "Required"
                ),
                Condition(
                    title: "Walls Detected",
                    icon: "square.fill",
                    isMet: metrics.wallsDetected >= 3,
                    target: "≥3/4"
                ),
                Condition(
                    title: "Corners Detected",
                    icon: "triangle.fill",
                    isMet: metrics.cornersDetected >= 2,
                    target: "≥2"
                ),
                Condition(
                    title: "Coverage Score",
                    icon: "chart.bar.fill",
                    isMet: metrics.coverageScore >= 0.65,
                    target: "≥65%"
                ),
                Condition(
                    title: "Readiness Score",
                    icon: "chart.bar.fill",
                    isMet: metrics.readinessScore >= 0.70,
                    target: "≥70%"
                )
            ]
        }
    }
}

struct StopConditionRow: View {
    let title: String
    let icon: String
    let isMet: Bool
    let target: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(isMet ? AppTheme.success : AppTheme.disabledText)
                .frame(width: 16)

            Text(title)
                .font(.caption)
                .foregroundColor(isMet ? AppTheme.primaryText : AppTheme.secondaryText)

            Spacer()

            Text(target)
                .font(.caption2)
                .foregroundColor(AppTheme.secondaryText)

            Image(systemName: isMet ? "checkmark.circle.fill" : "circle")
                .font(.caption2)
                .foregroundColor(isMet ? AppTheme.success : AppTheme.disabledText)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        // Ready Element state
        StopConditionsPanel(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.85
                m.coverageScore = 0.90
                m.wallPlaneLocked = true
                m.openingLikely = true
                m.boundaryCoverage = 0.92
                return m
            }(),
            isReady: true,
            scanMode: .element,
            failureReasons: []
        )

        // Not Ready Element state
        StopConditionsPanel(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.45
                m.coverageScore = 0.50
                m.wallPlaneLocked = true
                m.openingLikely = false
                m.boundaryCoverage = 0.55
                return m
            }(),
            isReady: false,
            scanMode: .element,
            failureReasons: [
                "Opening not detected",
                "Boundary coverage 55% < 90%"
            ]
        )

        // Ready Room state
        StopConditionsPanel(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.82
                m.coverageScore = 0.85
                m.wallsDetected = 4
                m.floorDetected = true
                m.cornersDetected = 4
                return m
            }(),
            isReady: true,
            scanMode: .room,
            failureReasons: []
        )

        // Not Ready Room state
        StopConditionsPanel(
            metrics: {
                var m = CoverageMetrics()
                m.readinessScore = 0.42
                m.coverageScore = 0.45
                m.wallsDetected = 2
                m.floorDetected = true
                m.cornersDetected = 1
                return m
            }(),
            isReady: false,
            scanMode: .room,
            failureReasons: [
                "Coverage 45% < 65%",
                "Only 2 walls detected (need 3)",
                "Only 1 corner detected (need 2)"
            ]
        )
    }
    .padding()
}
