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
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            SplashScreenView()
                .preferredColorScheme(.dark)
                .disableSystemInputAssistant()
        }
        .modelContainer(sharedModelContainer)
    }
}
