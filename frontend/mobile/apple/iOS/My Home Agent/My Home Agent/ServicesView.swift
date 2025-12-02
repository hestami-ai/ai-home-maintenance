import SwiftUI
import UIKit

struct Service: Identifiable {
    let id: UUID
    let name: String
    let icon: String
    let description: String
    var estimatedCost: String
}

struct ServicesView: View {
    @StateObject private var viewModel = ServicesViewModel()
    @State private var searchText = ""
    
    var filteredServices: [Service] {
        if searchText.isEmpty {
            return viewModel.services
        }
        return viewModel.services.filter { $0.name.localizedCaseInsensitiveContains(searchText) ||
                               $0.description.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack {
                SharedSearchBar(text: $searchText)
                    .modifier(ServiceSearchModifier())
                    .padding()
                
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage = viewModel.errorMessage {
                    VStack(spacing: 20) {
                        Text("Error loading services")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text(errorMessage)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                        
                        Button("Retry") {
                            Task {
                                await viewModel.loadServices()
                            }
                        }
                        .padding()
                        .background(AppTheme.buttonBackground)
                        .foregroundColor(AppTheme.buttonText)
                        .cornerRadius(10)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredServices.isEmpty {
                    UnifiedEmptyStateView(
                        icon: "magnifyingglass",
                        title: searchText.isEmpty ? "No services available" : "No matching services",
                        message: searchText.isEmpty ? "Check back later for new services" : "Try adjusting your search terms",
                        actionTitle: !searchText.isEmpty ? "Clear Search" : nil,
                        action: !searchText.isEmpty ? { searchText = "" } : nil
                    )
                } else {
                    List(filteredServices) { service in
                        NavigationLink(destination: ServiceDetailView(service: service)) {
                            ServiceRowView(service: service)
                        }
                        .listRowBackground(AppTheme.cardBackground)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .navigationTitle("Available Services")
        .standardToolbar()
        .task {
            await viewModel.loadServices()
            await viewModel.loadCategories()
        }
    }
}

struct ServiceRowView: View {
    let service: Service
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: service.icon)
                .font(.title2)
                .foregroundColor(AppTheme.buttonBackground)
                .frame(width: 40, height: 40)
                .background(AppTheme.buttonBackground.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(service.name)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                Text(service.description)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
                
                Text(service.estimatedCost)
                    .font(.caption)
                    .foregroundColor(AppTheme.buttonBackground)
            }
        }
        .padding(.vertical, 8)
    }
}

struct ServiceDetailView: View {
    let service: Service
    @State private var selectedPhotos: [UIImage] = []
    @State private var notes: String = ""
    @State private var showingImagePicker = false
    @State private var showingConfirmation = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Service Header
                    CardView {
                        HStack {
                            Image(systemName: service.icon)
                                .font(.largeTitle)
                                .foregroundColor(AppTheme.buttonBackground)
                            
                            VStack(alignment: .leading) {
                                Text(service.name)
                                    .font(AppTheme.titleFont)
                                    .foregroundColor(AppTheme.primaryText)
                                Text(service.estimatedCost)
                                    .font(AppTheme.bodyFont)
                                    .foregroundColor(AppTheme.buttonBackground)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    // Description
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            Text(service.description)
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    }
                    
                    // Photo Attachments
                    CardView {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Photos")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                Spacer()
                                Button("Add Photos") {
                                    showingImagePicker = true
                                }
                                .foregroundColor(AppTheme.buttonBackground)
                                .font(AppTheme.captionFont.bold())
                            }
                            
                            if !selectedPhotos.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 10) {
                                        ForEach(0..<selectedPhotos.count, id: \.self) { index in
                                            Image(uiImage: selectedPhotos[index])
                                                .resizable()
                                                .scaledToFill()
                                                .frame(width: 100, height: 100)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(AppTheme.borderColor, lineWidth: 1)
                                                )
                                        }
                                    }
                                }
                            } else {
                                Text("No photos selected")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                    .padding()
                                    .frame(maxWidth: .infinity)
                                    .background(AppTheme.cardBackground.opacity(0.5))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    
                    // Notes
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Additional Notes")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            TextEditor(text: $notes)
                                .frame(height: 100)
                                .padding(8)
                                .background(AppTheme.cardBackground.opacity(0.5))
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(AppTheme.borderColor, lineWidth: 1)
                                )
                                .foregroundColor(AppTheme.primaryText)
                        }
                    }
                    
                    // Request Button
                    Button(action: {
                        showingConfirmation = true
                    }) {
                        Text("Request Service")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 10)
                }
                .padding()
            }
        }
        .standardToolbar(displayMode: .inline)
        .alert("Confirm Service Request", isPresented: $showingConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Confirm") {
                // TODO: Submit service request
            }
        } message: {
            Text("Would you like to submit a service request for \(service.name)?")
        }
        // TODO: Add image picker sheet
    }
}

// Custom SearchBar styling for ServicesView
struct ServiceSearchModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(AppTheme.bodyFont)
            .foregroundColor(AppTheme.primaryText)
            .padding(10)
            .background(AppTheme.cardBackground)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
            .accentColor(AppTheme.buttonBackground)
    }
}

struct ServicesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            ServicesView()
        }
    }
}
