import Foundation
import UIKit
import CoreHaptics

/// A utility class to manage haptic feedback throughout the app
class HapticManager {
    static let shared = HapticManager()
    
    // MARK: - Properties
    
    /// The haptic engine for advanced haptic patterns
    private var engine: CHHapticEngine?
    
    /// Whether the device supports haptics
    private var supportsHaptics: Bool = false
    
    // MARK: - Initialization
    
    private init() {
        setupHaptics()
    }
    
    // MARK: - Setup
    
    /// Sets up the haptic engine if the device supports it
    private func setupHaptics() {
        // Check if the device supports haptics
        let hapticCapability = CHHapticEngine.capabilitiesForHardware()
        supportsHaptics = hapticCapability.supportsHaptics
        
        // If the device doesn't support haptics, we'll fall back to UIFeedbackGenerator
        guard supportsHaptics else {
            print("Device does not support haptics")
            return
        }
        
        // Create and configure the engine
        do {
            engine = try CHHapticEngine()
            try engine?.start()
            
            // The engine stops when the app goes to the background, so restart it when needed
            engine?.resetHandler = { [weak self] in
                print("Haptic engine needs reset")
                do {
                    try self?.engine?.start()
                } catch {
                    print("Failed to restart the haptic engine: \(error)")
                }
            }
            
            // If the engine stops for any reason, attempt to restart it
            engine?.stoppedHandler = { reason in
                print("Haptic engine stopped for reason: \(reason.rawValue)")
                switch reason {
                case .audioSessionInterrupt:
                    print("Audio session interrupt")
                case .applicationSuspended:
                    print("Application suspended")
                case .idleTimeout:
                    print("Idle timeout")
                case .systemError:
                    print("System error")
                case .notifyWhenFinished:
                    print("Notify when finished")
                case .engineDestroyed:
                    print("Engine destroyed")
                case .gameControllerDisconnect:
                    print("Game controller disconnect")
                @unknown default:
                    print("Unknown reason")
                }
            }
            
        } catch let error {
            print("Haptic engine creation error: \(error)")
        }
    }
    
    // MARK: - Public Methods
    
    /// Plays a simple haptic feedback pattern
    /// - Parameter style: The feedback style to play
    func playFeedback(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
    
    /// Plays a notification haptic feedback
    /// - Parameter type: The type of notification feedback
    func playNotificationFeedback(type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }
    
    /// Plays a selection haptic feedback
    func playSelectionFeedback() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }
    
    /// Plays a custom haptic pattern
    /// - Parameter intensity: The intensity of the haptic pattern (0.0 to 1.0)
    /// - Parameter sharpness: The sharpness of the haptic pattern (0.0 to 1.0)
    func playCustomHaptic(intensity: Float = 1.0, sharpness: Float = 1.0) {
        // Fall back to simple feedback if advanced haptics aren't supported
        guard supportsHaptics, let engine = engine else {
            playFeedback(style: .medium)
            return
        }
        
        // Create a haptic pattern with the specified intensity and sharpness
        let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity)
        let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
        
        // Create an event with the parameters
        let event = CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: 0)
        
        do {
            // Create a pattern from the event
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            
            // Create a player from the pattern
            let player = try engine.makePlayer(with: pattern)
            
            // Start the player
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            // If there's an error, fall back to simple feedback
            print("Failed to play custom haptic pattern: \(error)")
            playFeedback(style: .medium)
        }
    }
    
    /// Handles errors related to haptic feedback
    /// - Parameter error: The error to handle
    func handleHapticError(_ error: Error) {
        // Log the error
        print("Haptic error: \(error)")
        
        // If it's a specific error related to missing files, we can ignore it
        if let nsError = error as NSError?,
           nsError.domain == NSCocoaErrorDomain,
           nsError.code == 260,
           let filePath = nsError.userInfo["NSFilePath"] as? String,
           filePath.contains("hapticpatternlibrary.plist") {
            print("Ignoring missing haptic pattern library error - this is expected in the simulator")
        } else {
            // For other errors, attempt to restart the engine
            do {
                try engine?.start()
            } catch {
                print("Failed to restart haptic engine: \(error)")
            }
        }
    }
}
