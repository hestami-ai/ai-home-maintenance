//
//  Hestami_Home_MeasurementsApp.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import SwiftData

@main
struct Hestami_Home_MeasurementsApp: App {
    @State private var showLaunchScreen = true

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            ScanSession.self,
            Keyframe.self,
            ReferencePhoto.self,
            MeasurementResult.self,
            MeasurementGroup.self,
        ])

        // Ensure Application Support directory exists before creating model container
        let fileManager = FileManager.default
        let appSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!

        do {
            // Create directory if it doesn't exist
            if !fileManager.fileExists(atPath: appSupportURL.path) {
                try fileManager.createDirectory(at: appSupportURL, withIntermediateDirectories: true, attributes: nil)
            }
        } catch {
            // Silently handle - this is non-critical initialization
        }

        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ZStack {
                if showLaunchScreen {
                    LaunchScreenView()
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                                withAnimation {
                                    showLaunchScreen = false
                                }
                            }
                        }
                } else {
                    ContentView()
                }
            }
        }
        .modelContainer(sharedModelContainer)
    }
}
