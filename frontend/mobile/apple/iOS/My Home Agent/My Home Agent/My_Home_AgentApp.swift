//
//  My_Home_AgentApp.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 3/17/25.
//

import SwiftUI
import SwiftData

@main
struct My_Home_AgentApp: App {
    // Register the app delegate
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Item.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            // Log error instead of crashing in production
            AppLogger.critical("Could not create ModelContainer, falling back to in-memory storage", error: error, category: AppLogger.app)
            
            // Fallback to in-memory storage to prevent app crash
            do {
                let inMemoryConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                let fallbackContainer = try ModelContainer(for: schema, configurations: [inMemoryConfig])
                AppLogger.warning("Using in-memory ModelContainer as fallback", category: AppLogger.app)
                return fallbackContainer
            } catch {
                // If even in-memory fails, this is a critical error
                AppLogger.critical("Failed to create fallback in-memory ModelContainer", error: error, category: AppLogger.app)
                // Create minimal container - this should never fail
                return try! ModelContainer(for: schema, configurations: [ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)])
            }
        }
    }()
    
    init() {
        // Validate app configuration on launch
        AppConfiguration.validate()
        
        // Log app launch
        AppLogger.info("App launched - Version \(AppConfiguration.fullVersion)", category: AppLogger.app)
    }

    var body: some Scene {
        WindowGroup {
            SplashScreenView()
                .preferredColorScheme(.dark)
                .disableSystemInputAssistant()
        }
        .modelContainer(sharedModelContainer)
    }
}
