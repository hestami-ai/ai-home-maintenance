//
//  AngleIndicatorButton.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import SwiftUI

/// Button component for selecting and displaying capture angle status.
/// Shows whether an angle has been captured, is the current target, or is available.
struct AngleIndicatorButton: View {
    let angle: CaptureAngle
    let isCaptured: Bool
    let isTarget: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    // Background circle
                    Circle()
                        .fill(backgroundColor)
                        .frame(width: 56, height: 56)

                    // Icon or checkmark
                    if isCaptured {
                        Image(systemName: "checkmark")
                            .font(.title2.weight(.semibold))
                            .foregroundColor(AppTheme.success)
                    } else {
                        Image(systemName: angle.iconName)
                            .font(.title2)
                            .foregroundColor(isTarget ? AppTheme.primary : AppTheme.secondaryText)
                    }
                }
                // Selection ring
                .overlay(
                    Circle()
                        .stroke(isTarget ? AppTheme.primary : Color.clear, lineWidth: 3)
                )
                // Pulse animation when target
                .overlay(
                    Circle()
                        .stroke(AppTheme.primary.opacity(0.3), lineWidth: 2)
                        .scaleEffect(isTarget ? 1.2 : 1.0)
                        .opacity(isTarget ? 0 : 1)
                        .animation(
                            isTarget ? Animation.easeOut(duration: 1.0).repeatForever(autoreverses: false) : .default,
                            value: isTarget
                        )
                )

                // Label
                Text(angle.displayName)
                    .font(.caption)
                    .fontWeight(isTarget ? .semibold : .regular)
                    .foregroundColor(isTarget ? AppTheme.primaryText : AppTheme.secondaryText)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isCaptured)
    }

    private var backgroundColor: Color {
        if isCaptured {
            return AppTheme.success.opacity(0.2)
        } else if isTarget {
            return AppTheme.primary.opacity(0.2)
        } else {
            return AppTheme.overlayMedium
        }
    }
}

/// Horizontal row of angle indicators for the standard three angles.
struct AngleIndicatorRow: View {
    let capturedAngles: Set<CaptureAngle>
    @Binding var currentTargetAngle: CaptureAngle

    var body: some View {
        HStack(spacing: 24) {
            ForEach(CaptureAngle.standardAngles, id: \.self) { angle in
                AngleIndicatorButton(
                    angle: angle,
                    isCaptured: capturedAngles.contains(angle),
                    isTarget: currentTargetAngle == angle
                ) {
                    currentTargetAngle = angle
                }
            }
        }
    }
}

/// Full guidance card with angle selection and instructions.
struct AngleGuidanceCard: View {
    let capturedAngles: Set<CaptureAngle>
    @Binding var currentTargetAngle: CaptureAngle

    var body: some View {
        VStack(spacing: 16) {
            // Guidance text
            Text(currentTargetAngle.guidanceText)
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
                .multilineTextAlignment(.center)

            // Angle indicators
            AngleIndicatorRow(
                capturedAngles: capturedAngles,
                currentTargetAngle: $currentTargetAngle
            )

            // Progress text
            Text("\(capturedAngles.count) of 3 angles captured")
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(AppTheme.overlayDark.opacity(0.8))
        )
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()

        VStack(spacing: 40) {
            // Individual buttons
            HStack(spacing: 24) {
                AngleIndicatorButton(
                    angle: .left,
                    isCaptured: true,
                    isTarget: false
                ) {}

                AngleIndicatorButton(
                    angle: .center,
                    isCaptured: false,
                    isTarget: true
                ) {}

                AngleIndicatorButton(
                    angle: .right,
                    isCaptured: false,
                    isTarget: false
                ) {}
            }

            // Full guidance card
            AngleGuidanceCard(
                capturedAngles: [.left],
                currentTargetAngle: .constant(.center)
            )
        }
        .padding()
    }
}
