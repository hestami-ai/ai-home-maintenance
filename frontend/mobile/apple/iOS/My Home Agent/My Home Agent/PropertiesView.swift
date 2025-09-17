//
//  PropertiesView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 6/2/25.
//

import SwiftUI
import RoomPlan

struct PropertiesView: View {
    @StateObject private var viewModel = PropertiesViewModel()
    @State private var showingAddProperty = false
    @State private var showingDeleteAlert = false
    @State private var propertyToDelete: Property?
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack {
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage = viewModel.errorMessage {
                    VStack(spacing: 20) {
                        Text("Error loading properties")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text(errorMessage)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button("Retry") {
                            Task {
                                await viewModel.loadProperties()
                            }
                        }
                        .padding()
                        .background(AppTheme.buttonBackground)
                        .foregroundColor(AppTheme.buttonText)
                        .cornerRadius(10)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.properties.isEmpty {
                    EmptyPropertiesView(onAddProperty: {
                        showingAddProperty = true
                    })
                } else {
                    List {
                        ForEach(viewModel.properties) { property in
                            NavigationLink(destination: PropertyDetailView(property: property)) {
                                PropertyRowView(property: property)
                            }
                            .listRowBackground(AppTheme.cardBackground)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    propertyToDelete = property
                                    showingDeleteAlert = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                
                                NavigationLink(destination: AddEditPropertyView(property: property)) {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .tint(AppTheme.accentPrimary)
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                    
                    Button(action: {
                        showingAddProperty = true
                    }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                            Text("Add New Property")
                                .font(AppTheme.bodyFont)
                        }
                        .foregroundColor(AppTheme.buttonText)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(10)
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
        }
        .navigationDestination(isPresented: $showingAddProperty) {
            AddEditPropertyView()
        }
        .alert("Delete Property", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let property = propertyToDelete {
                    Task {
                        await viewModel.deleteProperty(id: property.id)
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this property? This action cannot be undone.")
        }
        .navigationTitle("My Properties")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            await viewModel.loadProperties()
        }
    }
}

struct PropertyRowView: View {
    let property: Property
    
    var body: some View {
        HStack(spacing: 16) {
            // Property image or icon
            if let featuredImage = property.featuredImage, !featuredImage.isEmpty {
                AsyncImage(url: URL(string: featuredImage)) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(width: 50, height: 50)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 50, height: 50)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    case .failure:
                        Image(systemName: "house.fill")
                            .font(.title)
                            .foregroundColor(AppTheme.buttonBackground)
                            .frame(width: 50, height: 50)
                            .background(AppTheme.buttonBackground.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    @unknown default:
                        Image(systemName: "house.fill")
                            .font(.title)
                            .foregroundColor(AppTheme.buttonBackground)
                            .frame(width: 50, height: 50)
                            .background(AppTheme.buttonBackground.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            } else {
                Image(systemName: "house.fill")
                    .font(.title)
                    .foregroundColor(AppTheme.buttonBackground)
                    .frame(width: 50, height: 50)
                    .background(AppTheme.buttonBackground.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(property.title)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                Text(formatAddress(property))
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(1)
                
                if let propertyType = property.descriptives?.propertyType {
                    Text(propertyType)
                        .font(.caption)
                        .foregroundColor(AppTheme.accentColor)
                }
                
                // Status indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor(property.status))
                        .frame(width: 8, height: 8)
                    
                    Text(property.status.rawValue.capitalized)
                        .font(.caption2)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    // Helper function to format address
    private func formatAddress(_ property: Property) -> String {
        var addressComponents = [property.address]
        
        if !property.city.isEmpty {
            addressComponents.append(property.city)
        }
        
        if !property.state.isEmpty {
            addressComponents.append(property.state)
        }
        
        if !property.zipCode.isEmpty {
            addressComponents.append(property.zipCode)
        }
        
        return addressComponents.joined(separator: ", ")
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

struct PropertyDetailView: View {
    let property: Property
    @StateObject private var viewModel = PropertiesViewModel()
    @State private var showingEditProperty = false
    @State private var selectedMediaIndex = 0
    
    var body: some View {
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
                                .padding(.bottom, 4)
                            
                            // Property Stats Grid
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                if let squareFootage = descriptives.squareFootage {
                                    PropertyStatView(icon: "square.fill", title: "Square Footage", value: "\(squareFootage) sq ft")
                                }
                                
                                if let bedrooms = descriptives.bedrooms {
                                    PropertyStatView(icon: "bed.double.fill", title: "Bedrooms", value: bedrooms)
                                }
                                
                                if let bathrooms = descriptives.bathrooms {
                                    PropertyStatView(icon: "shower.fill", title: "Bathrooms", value: bathrooms)
                                }
                                
                                if let yearBuilt = descriptives.yearBuilt {
                                    PropertyStatView(icon: "calendar", title: "Year Built", value: yearBuilt)
                                }
                                
                                if descriptives.garage == true {
                                    PropertyStatView(icon: "car.fill", title: "Garage", value: "Yes")
                                }
                                
                                if descriptives.basement == true {
                                    PropertyStatView(icon: "arrow.down.square.fill", title: "Basement", value: "Yes")
                                }
                                
                                if descriptives.airConditioning == true {
                                    PropertyStatView(icon: "thermometer.snowflake", title: "A/C", value: "Yes")
                                }
                                
                                if let heatingSystem = descriptives.heatingSystem {
                                    PropertyStatView(icon: "thermometer.sun.fill", title: "Heating", value: heatingSystem)
                                }
                            }
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
                        
                        // Service Requests
                        if let serviceRequests = property.serviceRequests, !serviceRequests.isEmpty {
                            Divider()
                                .background(AppTheme.borderColor)
                                .padding(.vertical, 8)
                            
                            Text("Service Requests")
                                .font(AppTheme.subheadlineFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                                .padding(.bottom, 4)
                            
                            ForEach(serviceRequests) { request in
                                ServiceRequestRow(request: request)
                            }
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
                        
                        NavigationLink(destination: ServicesView()) {
                            ActionButtonView(icon: "magnifyingglass", title: "Browse Services")
                        }
                        
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
        .navigationDestination(isPresented: $showingEditProperty) {
            AddEditPropertyView(property: property)
        }
        .alert("Room Scanning Not Available", isPresented: $viewModel.showRoomPlanAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Room scanning requires a device with LiDAR scanner (iPhone 12 Pro/Pro Max or newer, or iPad Pro with LiDAR). This feature is not available in the simulator.")
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

struct ActionButtonView: View {
    let icon: String
    let title: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(AppTheme.buttonText)
            
            Text(title)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.buttonText)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(AppTheme.buttonText.opacity(0.8))
        }
        .padding()
        .background(AppTheme.buttonBackground)
        .cornerRadius(10)
    }
}

struct EmptyPropertiesView: View {
    var onAddProperty: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "house.lodge")
                .font(.system(size: 70))
                .foregroundColor(AppTheme.secondaryText)
                .padding()
                .background(Circle().fill(AppTheme.cardBackground))
                .overlay(
                    Circle()
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
                .padding()
            
            Text("No Properties Added")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Add properties to manage service requests and maintenance")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Button(action: onAddProperty) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                    Text("Add New Property")
                        .font(AppTheme.bodyFont)
                }
                .foregroundColor(AppTheme.buttonText)
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppTheme.buttonBackground)
                .cornerRadius(10)
            }
            .padding(.horizontal, 40)
            .padding(.top, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct PropertiesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            PropertiesView()
        }
    }
}