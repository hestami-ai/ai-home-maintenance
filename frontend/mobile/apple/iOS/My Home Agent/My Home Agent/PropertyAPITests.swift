import SwiftUI

struct PropertyAPITests: View {
    @ObservedObject private var viewModel = PropertiesViewModel.shared
    @State private var testResults: [String] = []
    @State private var isRunningTests = false
    @State private var testProperty: Property?
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(alignment: .leading, spacing: 20) {
                Text("Property API Tests")
                    .font(AppTheme.titleFont)
                    .foregroundColor(AppTheme.primaryText)
                    .padding(.horizontal)
                
                if isRunningTests {
                    ProgressView("Running tests...")
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                        .foregroundColor(AppTheme.primaryText)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(testResults, id: \.self) { result in
                                HStack(alignment: .top, spacing: 8) {
                                    if result.contains("SUCCESS") {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(.green)
                                    } else if result.contains("FAILURE") {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.red)
                                    } else {
                                        Image(systemName: "info.circle.fill")
                                            .foregroundColor(AppTheme.accentColor)
                                    }
                                    
                                    Text(result)
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(AppTheme.primaryText)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        runTests()
                    }) {
                        Text("Run API Tests")
                            .font(AppTheme.bodyFont.bold())
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
        .navigationTitle("API Tests")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
    
    private func runTests() {
        isRunningTests = true
        testResults = ["Starting Property API tests..."]
        
        Task {
            // Test 1: Get Properties
            await testGetProperties()
            
            // Test 2: Create Property
            await testCreateProperty()
            
            // Test 3: Get Single Property
            if let property = testProperty {
                await testGetProperty(id: property.id)
                
                // Test 4: Update Property
                await testUpdateProperty(id: property.id)
                
                // Test 5: Delete Property
                await testDeleteProperty(id: property.id)
            } else {
                testResults.append("SKIPPED: Get Single Property - No test property created")
                testResults.append("SKIPPED: Update Property - No test property created")
                testResults.append("SKIPPED: Delete Property - No test property created")
            }
            
            // Complete
            testResults.append("All tests completed")
            isRunningTests = false
        }
    }
    
    private func testGetProperties() async {
        testResults.append("Testing: Get Properties")
        
        do {
            let properties = try await PropertyService.shared.getProperties()
            testResults.append("SUCCESS: Retrieved \(properties.count) properties")
        } catch {
            testResults.append("FAILURE: Get Properties - \(error.localizedDescription)")
        }
    }
    
    private func testCreateProperty() async {
        testResults.append("Testing: Create Property")
        
        let descriptives = PropertyDescriptives(
            propertyType: "Test Property",
            yearBuilt: 2020,
            squareFootage: 1500,
            bedrooms: 3,
            bathrooms: "2.5",
            unitNumber: nil,
            garage: false,
            basement: false,
            gatedCommunity: false,
            heatingSystem: nil,
            airConditioning: false,
            utilities: nil,
            createdFrom: "ios_app_tests"
        )
        
        let testProp = PropertyCreateRequest(
            title: "Test Property \(Date())",
            description: "This is a test property created for API testing.",
            address: "123 Test Street",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
            descriptives: descriptives
        )
        
        do {
            let createdProperty = try await PropertyService.shared.createProperty(property: testProp)
            testProperty = createdProperty
            testResults.append("SUCCESS: Created property with ID: \(createdProperty.id)")
        } catch {
            testResults.append("FAILURE: Create Property - \(error.localizedDescription)")
        }
    }
    
    private func testGetProperty(id: String) async {
        testResults.append("Testing: Get Property by ID")
        
        do {
            let property = try await PropertyService.shared.getProperty(id: id)
            testResults.append("SUCCESS: Retrieved property: \(property.title)")
        } catch {
            testResults.append("FAILURE: Get Property - \(error.localizedDescription)")
        }
    }
    
    private func testUpdateProperty(id: String) async {
        testResults.append("Testing: Update Property")
        
        let updateRequest = PropertyUpdateRequest(
            title: "Updated Test Property",
            description: "This property was updated during API testing.",
            address: nil,
            city: nil,
            state: nil,
            zipCode: nil,
            county: nil,
            country: nil,
            descriptives: nil
        )
        
        do {
            let updatedProperty = try await PropertyService.shared.updateProperty(id: id, updates: updateRequest)
            testResults.append("SUCCESS: Updated property title to: \(updatedProperty.title)")
        } catch {
            testResults.append("FAILURE: Update Property - \(error.localizedDescription)")
        }
    }
    
    private func testDeleteProperty(id: String) async {
        testResults.append("Testing: Delete Property")
        
        do {
            try await PropertyService.shared.deleteProperty(id: id)
            testResults.append("SUCCESS: Deleted property with ID: \(id)")
        } catch {
            testResults.append("FAILURE: Delete Property - \(error.localizedDescription)")
        }
    }
}

struct PropertyAPITests_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            PropertyAPITests()
        }
        .preferredColorScheme(.dark)
    }
}
