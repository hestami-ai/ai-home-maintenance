import SwiftUI

struct AddEditPropertyView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = PropertiesViewModel()
    @State private var name: String = ""
    @State private var address: String = ""
    @State private var propertyType: String = "Single Family Home"
    @State private var squareFootage: String = ""
    @State private var bedrooms: String = ""
    @State private var bathrooms: String = ""
    @State private var yearBuilt: String = ""
    @State private var description: String = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    let propertyTypes = ["Single Family Home", "Condo", "Apartment", "Townhouse", "Vacation Home", "Commercial", "Other"]
    let isEditing: Bool
    var property: Property?
    
    init(property: Property? = nil) {
        self.property = property
        self.isEditing = property != nil
    }
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    // Form Fields
                    VStack(alignment: .leading, spacing: 20) {
                        // Property Name
                        FormField(title: "Property Name", placeholder: "Enter property name", text: $name)
                        
                        // Property Address
                        FormField(title: "Address", placeholder: "Enter property address", text: $address)
                        
                        // Property Type
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Property Type")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            Menu {
                                ForEach(propertyTypes, id: \.self) { type in
                                    Button(type) {
                                        propertyType = type
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(propertyType)
                                        .foregroundColor(AppTheme.primaryText)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                .padding()
                                .background(AppTheme.cardBackground)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(AppTheme.borderColor, lineWidth: 1)
                                )
                            }
                        }
                        
                        // Square Footage
                        FormField(title: "Square Footage", placeholder: "Enter square footage", text: $squareFootage, keyboardType: .numberPad)
                        
                        // Bedrooms
                        FormField(title: "Bedrooms", placeholder: "Enter number of bedrooms", text: $bedrooms, keyboardType: .numberPad)
                        
                        // Bathrooms
                        FormField(title: "Bathrooms", placeholder: "Enter number of bathrooms", text: $bathrooms, keyboardType: .decimalPad)
                        
                        // Year Built
                        FormField(title: "Year Built", placeholder: "Enter year built", text: $yearBuilt, keyboardType: .numberPad)
                        
                        // Description
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            TextEditor(text: $description)
                                .foregroundColor(AppTheme.primaryText)
                                .frame(minHeight: 100)
                                .padding(10)
                                .background(AppTheme.cardBackground)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(AppTheme.borderColor, lineWidth: 1)
                                )
                        }
                    }
                    .padding()
                    
                    // Submit Button
                    Button(action: {
                        submitProperty()
                    }) {
                        HStack {
                            Spacer()
                            Text(isEditing ? "Update Property" : "Add Property")
                                .font(AppTheme.bodyFont.bold())
                            Spacer()
                        }
                        .padding()
                        .background(AppTheme.buttonBackground)
                        .foregroundColor(AppTheme.buttonText)
                        .cornerRadius(10)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 20)
                    .disabled(name.isEmpty || address.isEmpty)
                    .opacity(name.isEmpty || address.isEmpty ? 0.6 : 1)
                }
            }
            
            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.3))
            }
        }
        .navigationTitle(isEditing ? "Edit Property" : "Add Property")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .alert(alertMessage, isPresented: $showingAlert) {
            Button("OK", role: .cancel) {}
        }
        .onAppear {
            if let property = property {
                // Populate fields with existing property data
                name = property.title
                address = property.address
                
                // Get values from descriptives if available
                if let descriptives = property.descriptives {
                    propertyType = descriptives.propertyType ?? "Single Family Home"
                    squareFootage = descriptives.squareFootage ?? ""
                    bedrooms = descriptives.bedrooms ?? ""
                    bathrooms = descriptives.bathrooms ?? ""
                    yearBuilt = descriptives.yearBuilt ?? ""
                }
                
                description = property.description
            }
        }
    }
    
    private func submitProperty() {
        // Validate inputs
        guard !name.isEmpty, !address.isEmpty else {
            alertMessage = "Please enter property name and address"
            showingAlert = true
            return
        }
        
        Task {
            if isEditing, let property = property {
                // Update existing property using the correct method signature
                do {
                    _ = try await viewModel.updateProperty(
                        id: property.id,
                        title: name,
                        description: description,
                        address: address,
                        city: property.city,
                        state: property.state,
                        zipCode: property.zipCode,
                        country: property.country,
                        propertyType: propertyType.isEmpty ? nil : propertyType,
                        bedrooms: bedrooms.isEmpty ? nil : bedrooms,
                        bathrooms: bathrooms.isEmpty ? nil : bathrooms,
                        yearBuilt: yearBuilt.isEmpty ? nil : yearBuilt,
                        squareFootage: squareFootage.isEmpty ? nil : squareFootage
                    )
                    dismiss()
                } catch {
                    alertMessage = "Failed to update property: \(error.localizedDescription)"
                    showingAlert = true
                }
            } else {
                // Create new property - parse address components
                let addressComponents = address.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                let streetAddress = addressComponents.first ?? address
                let city = addressComponents.count > 1 ? addressComponents[1] : "Unknown"
                let stateZip = addressComponents.count > 2 ? addressComponents[2] : ""
                let stateZipComponents = stateZip.split(separator: " ").map { $0.trimmingCharacters(in: .whitespaces) }
                let state = stateZipComponents.first ?? "Unknown"
                let zipCode = stateZipComponents.count > 1 ? stateZipComponents[1] : "00000"
                
                await viewModel.createProperty(
                    title: name,
                    description: description,
                    address: streetAddress,
                    city: city,
                    state: state,
                    zipCode: zipCode,
                    country: "US",
                    propertyType: propertyType.isEmpty ? nil : propertyType,
                    bedrooms: bedrooms.isEmpty ? nil : bedrooms,
                    bathrooms: bathrooms.isEmpty ? nil : bathrooms,
                    yearBuilt: yearBuilt.isEmpty ? nil : yearBuilt,
                    squareFootage: squareFootage.isEmpty ? nil : squareFootage
                )
                
                if viewModel.errorMessage == nil {
                    dismiss()
                } else {
                    alertMessage = viewModel.errorMessage ?? "An unknown error occurred"
                    showingAlert = true
                }
            }
        }
    }
}

struct FormField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            TextField(placeholder, text: $text)
                .disableInputAssistant()
                .foregroundColor(AppTheme.primaryText)
                .padding()
                .background(AppTheme.cardBackground)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
                .keyboardType(keyboardType)
        }
    }
}

struct AddEditPropertyView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            AddEditPropertyView()
        }
        .preferredColorScheme(.dark)
    }
}