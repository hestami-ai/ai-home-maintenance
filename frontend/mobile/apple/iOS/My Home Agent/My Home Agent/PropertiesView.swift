//
//  PropertiesView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 6/2/25.
//

import SwiftUI
import RoomPlan
import AVKit

struct PropertiesView: View {
    @ObservedObject private var viewModel = PropertiesViewModel.shared
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
                            NavigationLink(destination: PropertyDetailView(propertyId: property.id)) {
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
        .sheet(isPresented: $showingAddProperty) {
            AddEditPropertyView(onSave: {
                Task {
                    await viewModel.loadProperties()
                }
            })
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

// MARK: - Expandable Detail Section Component

struct ExpandableDetailSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: () -> Content
    @State private var isExpanded: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(AppTheme.accentPrimary)
                        .frame(width: 24)
                    
                    Text(title)
                        .font(AppTheme.bodyFont.bold())
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(AppTheme.secondaryText)
                        .font(.caption)
                }
                .padding()
                .background(AppTheme.cardBackground)
                .cornerRadius(8)
            }
            .buttonStyle(PlainButtonStyle())
            
            // Expandable Content
            if isExpanded {
                VStack(alignment: .leading, spacing: 0) {
                    content()
                }
                .padding()
                .background(AppTheme.cardBackground.opacity(0.5))
                .cornerRadius(8)
                .padding(.top, 4)
            }
        }
    }
}

// MARK: - Detail Row Component

struct DetailRow: View {
    let label: String
    let value: String
    var indented: Bool = false
    
    var body: some View {
        HStack(alignment: .top) {
            if indented {
                Spacer()
                    .frame(width: 20)
            }
            
            Text(label)
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            Text(value)
                .font(AppTheme.captionFont.bold())
                .foregroundColor(AppTheme.primaryText)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 4)
    }
}

struct PropertiesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            PropertiesView()
        }
    }
}
