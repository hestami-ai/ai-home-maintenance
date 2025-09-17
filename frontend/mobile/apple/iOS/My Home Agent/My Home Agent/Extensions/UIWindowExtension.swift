import UIKit
import ObjectiveC

// Extension with helper functions for window access
extension UIApplication {
    // Get the key window using the modern UIWindowScene approach
    class func getKeyWindow() -> UIWindow? {
        // For iOS 15 and later, use UIWindowScene.windows
        if #available(iOS 15.0, *) {
            if let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                return scene.windows.first { $0.isKeyWindow } ?? scene.windows.first
            }
        }
        
        // Fallback for earlier iOS versions
        // We use a runtime check to avoid deprecation warnings
        let selector = NSSelectorFromString("windows")
        if UIApplication.shared.responds(to: selector) {
            if let windowsMethod = class_getInstanceMethod(UIApplication.self, selector) {
                let windowsIMP = method_getImplementation(windowsMethod)
                typealias WindowsFunc = @convention(c) (AnyObject, Selector) -> [UIWindow]
                let windowsFunc = unsafeBitCast(windowsIMP, to: WindowsFunc.self)
                let windows = windowsFunc(UIApplication.shared, selector)
                return windows.first { $0.isKeyWindow }
            }
        }
        
        // Last resort fallback
        return nil
    }
    
    // Get all windows using the modern UIWindowScene approach
    class func getAllWindows() -> [UIWindow] {
        var windows: [UIWindow] = []
        
        // For iOS 15 and later, use UIWindowScene.windows
        if #available(iOS 15.0, *) {
            for scene in UIApplication.shared.connectedScenes {
                if let windowScene = scene as? UIWindowScene {
                    windows.append(contentsOf: windowScene.windows)
                }
            }
        }
        
        // If no windows found, fall back to the deprecated approach using runtime methods
        if windows.isEmpty {
            let selector = NSSelectorFromString("windows")
            if UIApplication.shared.responds(to: selector) {
                if let windowsMethod = class_getInstanceMethod(UIApplication.self, selector) {
                    let windowsIMP = method_getImplementation(windowsMethod)
                    typealias WindowsFunc = @convention(c) (AnyObject, Selector) -> [UIWindow]
                    let windowsFunc = unsafeBitCast(windowsIMP, to: WindowsFunc.self)
                    windows = windowsFunc(UIApplication.shared, selector)
                }
            }
        }
        
        return windows
    }
}
