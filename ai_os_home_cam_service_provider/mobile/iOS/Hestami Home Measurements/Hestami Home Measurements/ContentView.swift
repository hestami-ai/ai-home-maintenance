//
//  ContentView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    
    var body: some View {
        ScanListView()
            .themedBackground()
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [ScanSession.self, Keyframe.self, MeasurementResult.self], inMemory: true)
}
