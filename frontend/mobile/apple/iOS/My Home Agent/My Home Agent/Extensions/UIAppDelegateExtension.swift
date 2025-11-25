import UIKit
import SwiftUI

// AppDelegate with app configuration functionality
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Configure network settings asynchronously to avoid blocking UI
        Task {
            await configureNetworkSettings()
        }
        return true
    }
    
    private func configureNetworkSettings() async {
        // Network configuration is now handled by AppConfiguration
        // Static media server settings are automatically configured based on build environment
        AppLogger.info("Static media server: \(AppConfiguration.staticMediaHost):\(AppConfiguration.staticMediaPort)", category: AppLogger.network)
        
        // Clear expired caches on app startup
        CacheManager.shared.clearExpiredCache()
        AppLogger.info("Cleared expired caches", category: AppLogger.storage)
        
        // Test URL rewriting in debug builds only
        #if DEBUG
        if AppConfiguration.allowLocalhostConnections {
            let testUrl = "http://localhost:8090/media-secure/test/image.jpg"
            let rewrittenUrl = NetworkManager.shared.rewriteMediaURL(testUrl)
            AppLogger.debug("URL rewriting test:\n  Original: \(testUrl)\n  Rewritten: \(rewrittenUrl)", category: AppLogger.network)
        }
        #endif
    }
}
