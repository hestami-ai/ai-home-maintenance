//
//  PropertyDetailView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 6/2/25.
//

import SwiftUI
import OSLog
import RoomPlan
import AVKit

struct PropertyDetailView: View {
    let propertyId: String
    @ObservedObject private var viewModel = PropertiesViewModel.shared
    @State private var showingEditProperty = false
    @State private var selectedMediaIndex = 0
    @State private var showingMediaSelection = false
    @State private var showingMetadataInput = false
    @State private var showingUploadProgress = false
    @State private var showingMediaManagement = false
    @State private var selectedFiles: [URL] = []
    @ObservedObject private var uploadManager = MediaUploadManager.shared
    
    // Computed property to get the latest property data from viewModel
    private var property: Property? {
        viewModel.properties.first { $0.id == propertyId }
    }
    
    // Value mapping for display
    private let valueDisplayMap: [String: String] = [
        // Heating systems
        "forced_air": "Forced Air",
        "radiant": "Radiant",
        "heat_pump": "Heat Pump",
        "baseboard": "Baseboard",
        "boiler": "Boiler",
        "geothermal": "Geothermal",
        // Cooling systems
        "central_ac": "Central AC",
        "window_units": "Window Units",
        "evaporative": "Evaporative",
        "ductless_mini_split": "Ductless Mini-Split",
        // Fuels
        "natural_gas": "Natural Gas",
        "propane": "Propane",
        // Materials
        "asphalt_shingle": "Asphalt Shingle",
        "fiber_cement": "Fiber Cement",
        "chain_link": "Chain Link",
        "wrought_iron": "Wrought Iron",
        "pier_beam": "Pier & Beam",
        // Pool/Fence types
        "inground": "In-Ground",
        "aboveground": "Above-Ground"
    ]
    
    private func displayValue(_ value: String?) -> String {
        guard let value = value else { return "Unknown" }
        return valueDisplayMap[value] ?? value.capitalized
    }
    
    var body: some View {
        Group {
            if let property = property {
                propertyDetailContent(for: property)
            } else {
                // Property not found or loading
                ZStack {
                    AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                    VStack(spacing: 16) {
                        ProgressView("Loading property...")
                            .foregroundColor(AppTheme.primaryText)
                        Text("Property ID: \(propertyId)")
                            .font(.caption)
                            .foregroundColor(AppTheme.secondaryText)
                        Text("Properties in list: \(viewModel.properties.count)")
                            .font(.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                .onAppear {
                    #if DEBUG
                    AppLogger.app.debug("Looking for property \(propertyId, privacy: .public)")
                    AppLogger.app.debug("Properties in viewModel: \(viewModel.properties.map { $0.id }, privacy: .public)")
                    #endif
                    
                    // If properties list is empty, try to load them
                    if viewModel.properties.isEmpty {
                        Task {
                            await viewModel.loadProperties()
                        }
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private func propertyDetailContent(for property: Property) -> some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Property Image or Gallery
                    if let featuredImage = property.featuredImage, !featuredImage.isEmpty {
                        AsyncImage(url: URL(string: featuredImage)) { phase in
                            switch phase {
                            case .empty:
                                ZStack {
                                    Rectangle()
                                        .fill(AppTheme.cardBackground)
                                        .frame(height: 200)
                                    
                                    ProgressView()
                                }
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(height: 200)
                                    .clipped()
                            case .failure:
                                ZStack {
                                    Rectangle()
                                        .fill(AppTheme.cardBackground)
                                        .frame(height: 200)
                                    
                                    Image(systemName: "house.fill")
                                        .font(.system(size: 80))
                                        .foregroundColor(AppTheme.buttonBackground.opacity(0.8))
                                }
                            @unknown default:
                                ZStack {
                                    Rectangle()
                                        .fill(AppTheme.cardBackground)
                                        .frame(height: 200)
                                    
                                    Image(systemName: "house.fill")
                                        .font(.system(size: 80))
                                        .foregroundColor(AppTheme.buttonBackground.opacity(0.8))
                                }
                            }
                        }
                        .cornerRadius(12)
                        .padding(.horizontal)
                    } else if let media = property.media, !media.isEmpty {
                        // Media gallery
                        TabView(selection: $selectedMediaIndex) {
                            ForEach(0..<media.count, id: \.self) { index in
                                if let url = URL(string: media[index].fileUrl) {
                                    AsyncImage(url: url) { phase in
                                        switch phase {
                                        case .empty:
                                            ZStack {
                                                Rectangle()
                                                    .fill(AppTheme.cardBackground)
                                                
                                                ProgressView()
                                            }
                                        case .success(let image):
                                            image
                                                .resizable()
                                                .aspectRatio(contentMode: .fill)
                                                .clipped()
                                        case .failure:
                                            ZStack {
                                                Rectangle()
                                                    .fill(AppTheme.cardBackground)
                                                
                                                Image(systemName: "photo")
                                                    .font(.system(size: 40))
                                                    .foregroundColor(AppTheme.buttonBackground.opacity(0.8))
                                            }
                                        @unknown default:
                                            EmptyView()
                                        }
                                    }
                                    .tag(index)
                                } else {
                                    ZStack {
                                        Rectangle()
                                            .fill(AppTheme.cardBackground)
                                        
                                        Image(systemName: "photo")
                                            .font(.system(size: 40))
                                            .foregroundColor(AppTheme.buttonBackground.opacity(0.8))
                                    }
                                    .tag(index)
                                }
                            }
                        }
                        .tabViewStyle(PageTabViewStyle())
                        .frame(height: 200)
                        .cornerRadius(12)
                        .padding(.horizontal)
                    } else {
                        // Default placeholder
                        ZStack {
                            Rectangle()
                                .fill(AppTheme.cardBackground)
                                .frame(height: 200)
                            
                            Image(systemName: "house.fill")
                                .font(.system(size: 80))
                                .foregroundColor(AppTheme.buttonBackground.opacity(0.8))
                        }
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }
                    
                    // Property Details
                    VStack(alignment: .leading, spacing: 16) {
                        Text(property.title)
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        
                        // Status indicator
                        HStack(spacing: 8) {
                            Circle()
                                .fill(statusColor(property.status))
                                .frame(width: 10, height: 10)
                            
                            Text(property.status.rawValue.capitalized)
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        
                        // Address
                        HStack(alignment: .top) {
                            Image(systemName: "mappin.circle.fill")
                                .foregroundColor(AppTheme.secondaryText)
                                .padding(.top, 2)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(property.address)
                                    .font(AppTheme.bodyFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                
                                Text("\(property.city), \(property.state) \(property.zipCode)")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                
                                if let county = property.county {
                                    Text("\(county), \(property.country)")
                                        .font(AppTheme.captionFont)
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                            }
                        }
                        
                        // Property Type
                        if let propertyType = property.descriptives?.propertyType {
                            HStack {
                                Image(systemName: "house.fill")
                                    .foregroundColor(AppTheme.secondaryText)
                                Text(propertyType)
                                    .font(AppTheme.bodyFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        }
                        
                        // Additional Property Details
                        if let descriptives = property.descriptives {
                            Divider()
                                .background(AppTheme.borderColor)
                                .padding(.vertical, 8)
                            
                            Text("Property Details")
                                .font(AppTheme.subheadlineFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                                .padding(.bottom, 8)
                            
                            // Key Stats (Always Visible)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                if let squareFootage = descriptives.squareFootage {
                                    PropertyStatView(icon: "square.fill", title: "Square Footage", value: "\(squareFootage) sq ft")
                                }
                                
                                if let bedrooms = descriptives.bedrooms {
                                    PropertyStatView(icon: "bed.double.fill", title: "Bedrooms", value: "\(bedrooms)")
                                }
                                
                                if let bathrooms = descriptives.bathrooms {
                                    PropertyStatView(icon: "shower.fill", title: "Bathrooms", value: bathrooms)
                                }
                                
                                if let yearBuilt = descriptives.yearBuilt {
                                    PropertyStatView(icon: "calendar", title: "Year Built", value: "\(yearBuilt)")
                                }
                            }
                            
                            // Expandable Sections
                            VStack(spacing: 12) {
                                // Structure & Features
                                ExpandableDetailSection(
                                    title: "Structure & Features",
                                    icon: "building.2.fill"
                                ) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        if let stories = descriptives.stories {
                                            DetailRow(label: "Stories", value: "\(stories)")
                                        }
                                        if let lotSize = descriptives.lotSize {
                                            DetailRow(label: "Lot Size", value: lotSize)
                                        }
                                        if descriptives.basement == true {
                                            DetailRow(label: "Basement", value: "Yes")
                                            if let basementType = descriptives.basementType {
                                                DetailRow(label: "Basement Type", value: displayValue(basementType), indented: true)
                                            }
                                        }
                                        if descriptives.garage == true {
                                            DetailRow(label: "Garage", value: "Yes")
                                            if let garageType = descriptives.garageType {
                                                DetailRow(label: "Garage Type", value: displayValue(garageType), indented: true)
                                            }
                                            if let garageSpaces = descriptives.garageSpaces {
                                                DetailRow(label: "Garage Spaces", value: "\(garageSpaces)", indented: true)
                                            }
                                        }
                                        if descriptives.attic == true {
                                            DetailRow(label: "Attic", value: "Yes")
                                            if let atticAccess = descriptives.atticAccess {
                                                DetailRow(label: "Attic Access", value: displayValue(atticAccess), indented: true)
                                            }
                                        }
                                        if descriptives.crawlSpace == true {
                                            DetailRow(label: "Crawl Space", value: "Yes")
                                        }
                                    }
                                }
                                
                                // HVAC & Climate
                                ExpandableDetailSection(
                                    title: "HVAC & Climate",
                                    icon: "thermometer.medium"
                                ) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        if let heatingSystem = descriptives.heatingSystem {
                                            DetailRow(label: "Heating System", value: displayValue(heatingSystem))
                                        }
                                        if let heatingFuel = descriptives.heatingFuel {
                                            DetailRow(label: "Heating Fuel", value: displayValue(heatingFuel))
                                        }
                                        if let coolingSystem = descriptives.coolingSystem {
                                            DetailRow(label: "Cooling System", value: displayValue(coolingSystem))
                                        }
                                        if descriptives.airConditioning == true {
                                            DetailRow(label: "Air Conditioning", value: "Yes")
                                        }
                                        if let hvacAge = descriptives.hvacAge {
                                            DetailRow(label: "HVAC Age", value: "\(hvacAge) years")
                                        }
                                        if let hvacBrand = descriptives.hvacBrand {
                                            DetailRow(label: "HVAC Brand", value: hvacBrand)
                                        }
                                        if let thermostatType = descriptives.thermostatType {
                                            DetailRow(label: "Thermostat", value: displayValue(thermostatType))
                                        }
                                    }
                                }
                                
                                // Exterior & Roofing
                                ExpandableDetailSection(
                                    title: "Exterior & Roofing",
                                    icon: "house.fill"
                                ) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        if let roofType = descriptives.roofType {
                                            DetailRow(label: "Roof Type", value: displayValue(roofType))
                                        }
                                        if let roofAge = descriptives.roofAge {
                                            DetailRow(label: "Roof Age", value: roofAge)
                                        }
                                        if let exteriorMaterial = descriptives.exteriorMaterial {
                                            DetailRow(label: "Exterior Material", value: displayValue(exteriorMaterial))
                                        }
                                        if let foundationType = descriptives.foundationType {
                                            DetailRow(label: "Foundation", value: displayValue(foundationType))
                                        }
                                        if descriptives.fence == true {
                                            DetailRow(label: "Fence", value: "Yes")
                                            if let fenceType = descriptives.fenceType {
                                                DetailRow(label: "Fence Type", value: displayValue(fenceType), indented: true)
                                            }
                                        }
                                    }
                                }
                                
                                // Utilities & Systems
                                ExpandableDetailSection(
                                    title: "Utilities & Systems",
                                    icon: "bolt.fill"
                                ) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        if let waterSource = descriptives.waterSource {
                                            DetailRow(label: "Water Source", value: displayValue(waterSource))
                                        }
                                        if let sewerSystem = descriptives.sewerSystem {
                                            DetailRow(label: "Sewer System", value: displayValue(sewerSystem))
                                        }
                                        if descriptives.gasService == true {
                                            DetailRow(label: "Gas Service", value: "Yes")
                                        }
                                        if let electricalPanel = descriptives.electricalPanel {
                                            DetailRow(label: "Electrical Panel", value: displayValue(electricalPanel))
                                        }
                                        if let electricalAmps = descriptives.electricalAmps {
                                            DetailRow(label: "Electrical Amps", value: "\(electricalAmps)A")
                                        }
                                    }
                                }
                                
                                // Outdoor Features (if applicable)
                                if descriptives.pool == true || descriptives.patio == true || descriptives.deck == true {
                                    ExpandableDetailSection(
                                        title: "Outdoor Features",
                                        icon: "sun.max.fill"
                                    ) {
                                        VStack(alignment: .leading, spacing: 12) {
                                            if descriptives.pool == true {
                                                DetailRow(label: "Pool", value: "Yes")
                                                if let poolType = descriptives.poolType {
                                                    DetailRow(label: "Pool Type", value: displayValue(poolType), indented: true)
                                                }
                                            }
                                            if descriptives.patio == true {
                                                DetailRow(label: "Patio", value: "Yes")
                                            }
                                            if descriptives.deck == true {
                                                DetailRow(label: "Deck", value: "Yes")
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(.top, 8)
                        }
                        
                        // Description
                        if !property.description.isEmpty {
                            Divider()
                                .background(AppTheme.borderColor)
                                .padding(.vertical, 8)
                            
                            Text("Description")
                                .font(AppTheme.subheadlineFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                                .padding(.bottom, 4)
                            
                            Text(property.description)
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.secondaryText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        
                        // Media Gallery
                        if let media = property.media, !media.isEmpty {
                            Divider()
                                .background(AppTheme.borderColor)
                                .padding(.vertical, 8)
                            
                            Text("Media Gallery")
                                .font(AppTheme.subheadlineFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                                .padding(.bottom, 8)
                            
                            PropertyMediaGalleryView(media: media)
                        }
                        
                        Divider()
                            .background(AppTheme.borderColor)
                    }
                    .padding(.horizontal)
                    
                    // Edit Property Button
                    Button(action: {
                        showingEditProperty = true
                    }) {
                        HStack {
                            Image(systemName: "pencil")
                                .font(.title3)
                            Text("Edit Property")
                                .font(AppTheme.bodyFont.bold())
                            Spacer()
                        }
                        .foregroundColor(AppTheme.buttonText)
                        .padding()
                        .background(AppTheme.accentPrimary)
                        .cornerRadius(10)
                    }
                    .padding(.horizontal)
                    
                    // Upload Media Button
                    Button(action: {
                        showingMediaSelection = true
                    }) {
                        HStack {
                            Image(systemName: "photo.on.rectangle.angled")
                                .font(.title3)
                            Text("Upload Media")
                                .font(AppTheme.bodyFont.bold())
                            Spacer()
                            
                            // Media count badge
                            if let mediaCount = property.media?.count, mediaCount > 0 {
                                Text("\(mediaCount)")
                                    .font(AppTheme.captionFont.bold())
                                    .foregroundColor(AppTheme.buttonText)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.3))
                                    .cornerRadius(12)
                            }
                        }
                        .foregroundColor(AppTheme.buttonText)
                        .padding()
                        .background(AppTheme.accentPrimary)
                        .cornerRadius(10)
                    }
                    .padding(.horizontal)
                    
                    // Manage Media Button
                    if let media = property.media, !media.isEmpty {
                        Button(action: {
                            showingMediaManagement = true
                        }) {
                            HStack {
                                Image(systemName: "square.grid.2x2")
                                    .font(.title3)
                                Text("Manage Media")
                                    .font(AppTheme.bodyFont.bold())
                                Spacer()
                            }
                            .foregroundColor(AppTheme.buttonText)
                            .padding()
                            .background(AppTheme.accentPrimary)
                            .cornerRadius(10)
                        }
                        .padding(.horizontal)
                    }
                    
                    // Property Actions
                    VStack(spacing: 16) {
                        if RoomCaptureSession.isSupported {
                            NavigationLink(destination: RoomPlanView()) {
                                ActionButtonView(icon: "house.fill", title: "Scan Property")
                            }
                        } else {
                            // Show a disabled button with explanation when RoomPlan is not supported
                            Button(action: {
                                // Show alert explaining why RoomPlan is not available
                                viewModel.showRoomPlanAlert = true
                            }) {
                                ActionButtonView(icon: "house.fill", title: "Scan Property")
                                    .opacity(0.6) // Visual indication that it's disabled
                            }
                        }
                        
                        //NavigationLink(destination: ServicesView()) {
                        //    ActionButtonView(icon: "magnifyingglass", title: "Browse Services")
                        //}
                        
                        NavigationLink(destination: RequestsView()) {
                            ActionButtonView(icon: "list.bullet.rectangle", title: "View Requests")
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(isPresented: $showingEditProperty) {
            NavigationView {
                AddEditPropertyView(property: property, onSave: {
                    // Refresh the property list after editing
                    Task {
                        await viewModel.loadProperties()
                    }
                })
            }
        }
        .alert("Room Scanning Not Available", isPresented: $viewModel.showRoomPlanAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Room scanning requires a device with LiDAR scanner (iPhone 12 Pro/Pro Max or newer, or iPad Pro with LiDAR). This feature is not available in the simulator.")
        }
        .sheet(isPresented: $showingMediaSelection) {
            MediaSelectionSheet(
                isPresented: $showingMediaSelection,
                selectedFiles: $selectedFiles,
                selectionLimit: 10,
                propertyId: propertyId
            )
        }
        .sheet(isPresented: $showingMetadataInput) {
            MediaMetadataInputView(
                files: selectedFiles,
                propertyId: propertyId,
                onUpload: { tasks in
                    showingMetadataInput = false
                    
                    // Start upload with metadata
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        showingUploadProgress = true
                        MediaUploadManager.shared.uploadMedia(tasks: tasks) { result in
                            AppLogger.media.debug("Upload completion callback triggered")
                            
                            // Clear selected files
                            DispatchQueue.main.async {
                                selectedFiles = []
                            }
                            
                            // Refresh property data on completion
                            Task {
                                await viewModel.loadProperties()
                            }
                            
                            switch result {
                            case .success(let media):
                                AppLogger.media.info("Successfully uploaded \(media.count, privacy: .public) files")
                            case .failure(let error):
                                AppLogger.error("Upload error", error: error, category: AppLogger.media)
                            }
                        }
                    }
                },
                onCancel: {
                    showingMetadataInput = false
                    selectedFiles = []
                }
            )
        }
        .sheet(isPresented: $showingUploadProgress) {
            MediaUploadProgressView(isPresented: $showingUploadProgress)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showingMediaManagement) {
            if let currentProperty = viewModel.properties.first(where: { $0.id == propertyId }),
               let mediaArray = currentProperty.media {
                MediaManagementView(
                    propertyId: propertyId,
                    media: Binding(
                        get: { mediaArray },
                        set: { newMedia in
                            // Update will happen via viewModel.loadProperties()
                        }
                    )
                )
            }
        }
        .onChange(of: selectedFiles) { oldFiles, newFiles in
            guard !newFiles.isEmpty else { return }
            
            AppLogger.media.info("Selected \(newFiles.count, privacy: .public) files")
            #if DEBUG
            AppLogger.media.debug("File URLs: \(newFiles.map { $0.lastPathComponent }, privacy: .public)")
            #endif
            
            // Dismiss the media selection sheet first
            showingMediaSelection = false
            
            // Show metadata input view
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                showingMetadataInput = true
            }
        }
    }
    
    // Helper function to get status color
    private func statusColor(_ status: PropertyStatus) -> Color {
        switch status {
        case .ACTIVE:
            return Color.green
        case .INACTIVE:
            return Color.gray
        case .PENDING:
            return Color.orange
        case .COUNTY_PROCESSING:
            return Color.blue
        case .UNKNOWN:
            return Color.gray
        }
    }
}