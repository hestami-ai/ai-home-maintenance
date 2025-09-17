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
                    VStack(spacing: 20) {
                        Text(searchText.isEmpty ? "No services available" : "No matching services")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                            .padding(.top, 40)
                        
                        if !searchText.isEmpty {
                            Button("Clear Search") {
                                searchText = ""
                            }
                            .padding()
                            .background(AppTheme.buttonBackground)
                            .foregroundColor(AppTheme.buttonText)
                            .cornerRadius(10)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(AppTheme.bodyFont.bold())
                            .foregroundColor(AppTheme.primaryText)
                        Text(service.description)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Photo Attachments
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
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Notes
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
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Request Button
                    Button(action: {
                        showingConfirmation = true
                    }) {
                        Text("Request Service")
                            .font(AppTheme.bodyFont.bold())
                            .foregroundColor(AppTheme.buttonText)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(AppTheme.buttonBackground)
                            .cornerRadius(10)
                    }
                    .padding(.top, 10)
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
