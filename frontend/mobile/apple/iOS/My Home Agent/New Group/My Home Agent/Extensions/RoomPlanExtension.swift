import SwiftUI
import RoomPlan

// Extension to check RoomPlan availability
extension RoomCaptureSession {
    /// Checks if RoomPlan is supported on the current device
    static var isSupported: Bool {
        #if targetEnvironment(simulator)
        // RoomPlan requires LiDAR and is not available in simulators
        return false
        #else
        // For real devices, we need to check if the device has LiDAR
        // This is a simplified check - in production, you might want to use ARKit's
        // ARWorldTrackingConfiguration.supportsSceneReconstruction to be more precise
        if #available(iOS 16.0, *) {
            return true // Assuming iOS 16+ devices with LiDAR support RoomPlan
        } else {
            return false
        }
        #endif
    }
}
