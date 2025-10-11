import SwiftUI

struct AddEditPropertyView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = PropertiesViewModel()
    @State private var name: String = ""
    @State private var streetAddress: String = ""
    @State private var city: String = ""
    @State private var state: String = ""
    @State private var zipCode: String = ""
    @State private var country: String = "United States"
    @State private var propertyType: String = "Single Family Home"
    @State private var squareFootage: String = ""
    @State private var bedrooms: String = ""
    @State private var bathrooms: String = ""
    @State private var yearBuilt: String = ""
    @State private var description: String = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    let propertyTypes = ["Single Family Home", "Condominium", "Townhouse", "Apartment", "Multi-Family Home", "Vacation Home", "Mobile Home", "Commercial", "Other"]
    let countries = ["United States", "Canada", "Mexico", "Other"]
    let isEditing: Bool
    var property: Property?
    let onSave: (() -> Void)?
    
    init(property: Property? = nil, onSave: (() -> Void)? = nil) {
        self.property = property
        self.isEditing = property != nil
        self.onSave = onSave
    }
    
    private var isFormValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !streetAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !state.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !zipCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !country.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
                        FormField(title: "Street Address", placeholder: "Enter street address", text: $streetAddress)

                        FormField(title: "City", placeholder: "Enter city", text: $city)

                        FormField(title: "State", placeholder: "Enter state", text: $state)

                        FormField(title: "ZIP Code", placeholder: "Enter ZIP code", text: $zipCode, keyboardType: .numbersAndPunctuation)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Country")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)

                            Menu {
                                ForEach(countries, id: \.self) { option in
                                    Button(option) {
                                        country = option
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(country)
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
                    .disabled(!isFormValid)
                    .opacity(isFormValid ? 1 : 0.6)
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
                streetAddress = property.address
                city = property.city
                state = property.state
                zipCode = property.zipCode
                country = property.country
                
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
        guard isFormValid else {
            alertMessage = "Please complete all required fields"
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
                        address: streetAddress,
                        city: city,
                        state: state,
                        zipCode: zipCode,
                        country: country,
                        propertyType: propertyType.isEmpty ? nil : propertyType,
                        bedrooms: bedrooms.isEmpty ? nil : bedrooms,
                        bathrooms: bathrooms.isEmpty ? nil : bathrooms,
                        yearBuilt: yearBuilt.isEmpty ? nil : yearBuilt,
                        squareFootage: squareFootage.isEmpty ? nil : squareFootage
                    )
                    onSave?()
                    dismiss()
                } catch {
                    alertMessage = "Failed to update property: \(error.localizedDescription)"
                    showingAlert = true
                }
            } else {
                await viewModel.createProperty(
                    title: name,
                    description: description,
                    address: streetAddress,
                    city: city,
                    state: state,
                    zipCode: zipCode,
                    country: country,
                    propertyType: propertyType.isEmpty ? nil : propertyType,
                    bedrooms: bedrooms.isEmpty ? nil : bedrooms,
                    bathrooms: bathrooms.isEmpty ? nil : bathrooms,
                    yearBuilt: yearBuilt.isEmpty ? nil : yearBuilt,
                    squareFootage: squareFootage.isEmpty ? nil : squareFootage
                )
                
                if viewModel.errorMessage == nil {
                    onSave?()
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