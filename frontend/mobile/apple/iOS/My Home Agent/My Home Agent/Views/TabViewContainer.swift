import SwiftUI
import OSLog

/// A wrapper around MainTabView to avoid redeclaration issues
struct TabViewContainer: View {
    @State private var showLoginView = false
    
    var body: some View {
        ZStack {
            MainTabView()
                .fullScreenCover(isPresented: $showLoginView) {
                    LoginView()
                }
        }
        .onAppear {
            // Set up notification observer for logout events
            setupNotificationObserver()
        }
    }
    
    private func setupNotificationObserver() {
        // Add observer for logout notifications
        NotificationCenter.default.addObserver(forName: NSNotification.Name("LogoutRequired"), object: nil, queue: .main) { _ in
            AppLogger.auth.info("Received LogoutRequired notification")
            // Show login view on the main thread
            DispatchQueue.main.async {
                showLoginView = true
            }
        }
    }
}
