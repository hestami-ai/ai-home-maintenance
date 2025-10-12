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
        // Configure static media server with appropriate host and port
        // In a real app, these might come from a configuration file or environment
        // For now, we'll use the development server IP address
        let mediaHost = "dev-static.hestami-ai.com"  // Replace with actual media server host
        let mediaPort = "443"          // Replace with actual media server port
        
        // Configure the NetworkManager (this is synchronous and fast)
        NetworkManager.shared.configureStaticMediaServer(host: mediaHost, port: mediaPort)
        print("🔧 AppDelegate: Configured static media server: \(mediaHost):\(mediaPort)")
        
        // Test URL rewriting (deferred to avoid blocking startup)
        let testUrl = "http://localhost:8090/media-secure/test/image.jpg"
        let rewrittenUrl = NetworkManager.shared.rewriteMediaURL(testUrl)
        print("🔧 AppDelegate: URL rewriting test:\n  Original: \(testUrl)\n  Rewritten: \(rewrittenUrl)")
    }
}
