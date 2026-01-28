//
//  ResultsView.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import SwiftData

struct ResultsView: View {
    let session: ScanSession
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var measurementService = MeasurementService()
    @State private var storageService = StorageService()
    @State private var cloudService = CloudService()
    @State private var selectedTab = 0
    @State private var showingExportSheet = false
    @State private var showingShareSheet = false
    @State private var exportURL: URL?
    @State private var errorMessage: String?
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Measurements Tab
            measurementsTab
                .tabItem {
                    Label("Measurements", systemImage: "ruler")
                }
                .tag(0)
            
            // 3D Model Tab
            model3DTab
                .tabItem {
                    Label("3D Model", systemImage: "cube")
                }
                .tag(1)
            
            // Statistics Tab
            statisticsTab
                .tabItem {
                    Label("Statistics", systemImage: "chart.bar")
                }
                .tag(2)
        }
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button(action: exportResults) {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                    
                    Button(action: shareResults) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingExportSheet) {
            if let url = exportURL {
                ShareSheet(items: [url])
            }
        }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") {
                errorMessage = nil
            }
        } message: {
            if let error = errorMessage {
                Text(error)
            }
        }
        .onAppear {
            measurementService.setModelContext(modelContext)
            storageService.setModelContext(modelContext)
            cloudService.setModelContext(modelContext)
            measurementService.loadMeasurements(for: session)
        }
    }
    
    private var measurementsTab: some View {
        ScrollView {
            VStack(spacing: 16) {
                if measurementService.measurements.isEmpty {
                    emptyMeasurementsView
                } else {
                    ForEach(measurementService.measurements) { measurement in
                        MeasurementCard(measurement: measurement)
                    }
                }
            }
            .padding()
        }
    }
    
    private var emptyMeasurementsView: some View {
        VStack(spacing: 20) {
            Image(systemName: "ruler")
                .font(.system(size: 60))
                .foregroundColor(AppTheme.disabledText)
            
            Text("No Measurements Yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Upload your scan to the cloud to get measurements")
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }
    
    private var model3DTab: some View {
        VStack(spacing: 20) {
            Text("3D Model Viewer")
                .font(.title2)
                .fontWeight(.bold)
            
            Text("The processed 3D model will be displayed here after cloud processing completes.")
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Image(systemName: "cube")
                .font(.system(size: 80))
                .foregroundColor(AppTheme.disabledText)
        }
        .padding()
    }
    
    private var statisticsTab: some View {
        ScrollView {
            VStack(spacing: 20) {
                let stats = measurementService.getMeasurementStatistics(for: session)
                
                // Overview Card
                VStack(alignment: .leading, spacing: 12) {
                    Text("Overview")
                        .font(.headline)
                    
                    StatRow(
                        icon: "number",
                        title: "Total Measurements",
                        value: "\(stats.totalMeasurements)"
                    )
                    
                    StatRow(
                        icon: "checkmark.circle",
                        title: "Average Confidence",
                        value: "\(Int(stats.averageConfidence * 100))%"
                    )
                    
                    StatRow(
                        icon: "exclamationmark.triangle",
                        title: "Low Confidence",
                        value: "\(stats.lowConfidenceCount)",
                        color: AppTheme.warning
                    )
                    
                    StatRow(
                        icon: "checkmark.seal",
                        title: "High Confidence",
                        value: "\(stats.highConfidenceCount)",
                        color: AppTheme.success
                    )
                }
                .padding()
                .background(AppTheme.cardBackground)
                .cornerRadius(12)
                
                // Measurements by Type
                let groupedMeasurements = measurementService.getMeasurementsByType(for: session)
                
                if !groupedMeasurements.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("By Type")
                            .font(.headline)
                        
                        ForEach(groupedMeasurements.keys.sorted(by: { $0.displayName < $1.displayName }), id: \.self) { type in
                            if let measurements = groupedMeasurements[type] {
                                MeasurementTypeRow(
                                    type: type,
                                    count: measurements.count
                                )
                            }
                        }
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                }
                
                // Low Confidence Measurements
                let lowConfidence = measurementService.getLowConfidenceMeasurements(for: session)
                if !lowConfidence.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Low Confidence Measurements")
                            .font(.headline)
                            .foregroundColor(AppTheme.warning)
                        
                        ForEach(lowConfidence) { measurement in
                            MeasurementCard(measurement: measurement)
                        }
                    }
                    .padding()
                    .background(AppTheme.warning.opacity(0.1))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
    }
    
    private func exportResults() {
        if let url = storageService.exportSession(session) {
            exportURL = url
            showingExportSheet = true
        } else {
            errorMessage = "Failed to export results"
        }
    }
    
    private func shareResults() {
        exportResults()
    }
}

struct MeasurementCard: View {
    let measurement: MeasurementResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(measurement.name)
                        .font(.headline)
                    
                    Text(measurement.type.displayName)
                        .font(.subheadline)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                confidenceBadge
            }
            
            Divider()
            
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Value")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text(measurement.formattedValue)
                        .font(.title3)
                        .fontWeight(.bold)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Confidence")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text("\(Int(measurement.confidence * 100))%")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(confidenceColor)
                }
            }
            
            let validation = validateMeasurement(measurement)
            if !validation.issues.isEmpty {
                Divider()
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Issues")
                        .font(.caption)
                        .foregroundColor(AppTheme.warning)
                    
                    ForEach(validation.issues, id: \.self) { issue in
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption)
                            Text(issue)
                                .font(.caption)
                        }
                    }
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
    }
    
    private var confidenceBadge: some View {
        Text(measurement.confidenceLevel)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(confidenceColor.opacity(0.2))
            .foregroundColor(confidenceColor)
            .cornerRadius(6)
    }
    
    private var confidenceColor: Color {
        switch measurement.confidence {
        case 0.9...1.0: return AppTheme.success
        case 0.7..<0.9: return AppTheme.warning
        default: return AppTheme.error
        }
    }
    
    private func validateMeasurement(_ measurement: MeasurementResult) -> ValidationResult {
        var issues: [String] = []
        
        if measurement.confidence < 0.5 {
            issues.append("Low confidence")
        }
        
        let uncertaintyRatio = measurement.uncertainty / measurement.value
        if uncertaintyRatio > 0.1 {
            issues.append("High uncertainty")
        }
        
        return ValidationResult(isValid: issues.isEmpty, issues: issues)
    }
}

struct StatRow: View {
    let icon: String
    let title: String
    let value: String
    var color: Color = AppTheme.primary
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)
            
            Text(title)
                .font(.subheadline)
            
            Spacer()
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }
}

struct MeasurementTypeRow: View {
    let type: MeasurementType
    let count: Int
    
    var body: some View {
        HStack {
            Image(systemName: "ruler")
                .foregroundColor(AppTheme.primary)
                .frame(width: 24)
            
            Text(type.displayName)
                .font(.subheadline)
            
            Spacer()
            
            Text("\(count)")
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    NavigationStack {
        ResultsView(session: ScanSession(name: "Living Room"))
    }
    .modelContainer(for: [ScanSession.self, Keyframe.self, MeasurementResult.self], inMemory: true)
}
