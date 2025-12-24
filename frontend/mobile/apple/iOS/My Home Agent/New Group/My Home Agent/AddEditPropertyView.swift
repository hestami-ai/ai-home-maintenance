import SwiftUI
import OSLog

struct AddEditPropertyView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var viewModel = PropertiesViewModel.shared
    
    // Basic Info
    @State private var name: String = ""
    @State private var streetAddress: String = ""
    @State private var city: String = ""
    @State private var state: String = ""
    @State private var zipCode: String = ""
    @State private var county: String = ""
    @State private var country: String = "United States"
    @State private var description: String = ""
    
    // Property Details
    @State private var propertyType: String = "Single Family Home"
    @State private var squareFootage: String = ""
    @State private var lotSize: String = ""
    @State private var stories: String = ""
    @State private var bedrooms: String = ""
    @State private var bathrooms: String = ""
    @State private var yearBuilt: String = ""
    @State private var unitNumber: String = ""
    
    // Structure & Features
    @State private var basement: Bool = false
    @State private var basementType: String = "None"
    @State private var garage: Bool = false
    @State private var garageType: String = "None"
    @State private var garageSpaces: String = ""
    @State private var attic: Bool = false
    @State private var atticAccess: String = "None"
    @State private var crawlSpace: Bool = false
    
    // HVAC
    @State private var heatingSystem: String = "None"
    @State private var heatingFuel: String = "None"
    @State private var coolingSystem: String = "None"
    @State private var airConditioning: Bool = false
    @State private var hvacAge: String = ""
    @State private var thermostatType: String = "Manual"
    
    // Exterior
    @State private var roofType: String = "None"
    @State private var roofAge: String = ""
    @State private var exteriorMaterial: String = "None"
    @State private var foundationType: String = "None"
    
    // Access & Security
    @State private var gatedCommunity: Bool = false
    @State private var accessCode: String = ""
    @State private var accessInstructions: String = ""
    @State private var parkingType: String = "None"
    @State private var parkingSpaces: String = ""
    
    // Landscaping
    @State private var sprinklerSystem: Bool = false
    @State private var pool: Bool = false
    @State private var poolType: String = "None"
    @State private var fence: Bool = false
    @State private var fenceType: String = "None"
    @State private var deck: Bool = false
    @State private var deckMaterial: String = "None"
    @State private var patio: Bool = false
    @State private var patioMaterial: String = "None"
    
    // Special Considerations
    @State private var petFriendly: Bool = false
    @State private var smokingAllowed: Bool = false
    @State private var wheelchairAccessible: Bool = false
    @State private var fireplace: Bool = false
    @State private var fireplaceType: String = "None"
    
    // Notes
    @State private var maintenanceNotes: String = ""
    @State private var specialInstructions: String = ""
    
    // UI State
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var expandedSections: Set<String> = ["basic"]
    
    let propertyTypes = ["Single Family Home", "Condominium", "Townhouse", "Apartment", "Multi-Family Home", "Vacation Home", "Mobile Home", "Commercial", "Other"]
    let countries = ["United States", "Canada", "Mexico", "Other"]
    let basementTypes = ["None", "Finished", "Unfinished", "Partially Finished"]
    let garageTypes = ["None", "Attached", "Detached"]
    let atticAccessTypes = ["None", "Pull Down", "Stairway", "Scuttle"]
    let heatingSystems = ["None", "Forced Air", "Radiant", "Heat Pump", "Baseboard", "Boiler", "Geothermal", "Other"]
    let heatingFuels = ["None", "Natural Gas", "Electric", "Oil", "Propane", "Solar", "Other"]
    let coolingSystems = ["None", "Central AC", "Heat Pump", "Window Units", "Evaporative", "Ductless Mini-Split", "Other"]
    let thermostatTypes = ["Manual", "Programmable", "Smart"]
    let roofTypes = ["None", "Asphalt Shingle", "Metal", "Tile", "Slate", "Flat", "Rubber", "Other"]
    let exteriorMaterials = ["None", "Vinyl", "Brick", "Wood", "Stucco", "Stone", "Fiber Cement", "Mixed", "Other"]
    let foundationTypes = ["None", "Slab", "Crawlspace", "Basement", "Pier & Beam"]
    let parkingTypes = ["None", "Garage", "Driveway", "Street", "Carport", "Covered"]
    let poolTypes = ["None", "In-Ground", "Above-Ground"]
    let fenceTypes = ["None", "Wood", "Vinyl", "Chain Link", "Wrought Iron"]
    let deckMaterials = ["None", "Wood", "Composite", "Vinyl", "Aluminum"]
    let patioMaterials = ["None", "Concrete", "Pavers", "Stone", "Brick", "Tile"]
    let fireplaceTypes = ["None", "Wood", "Gas", "Electric"]
    
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
                VStack(spacing: 16) {
                    // Basic Information Section (Always Expanded)
                    ExpandableSection(title: "Basic Information", icon: "house.fill", isExpanded: .constant(true)) {
                        VStack(spacing: 16) {
                            FormField(title: "Property Name *", placeholder: "Enter property name", text: $name)
                            FormField(title: "Street Address *", placeholder: "Enter street address", text: $streetAddress)
                            FormField(title: "City *", placeholder: "Enter city", text: $city)
                            FormField(title: "State *", placeholder: "Enter state", text: $state)
                            FormField(title: "ZIP Code *", placeholder: "Enter ZIP code", text: $zipCode, keyboardType: .numbersAndPunctuation)
                            FormField(title: "County", placeholder: "Enter county (optional)", text: $county)
                            FormPickerField(title: "Country *", selection: $country, options: countries)
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Description")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                TextEditor(text: $description)
                                    .foregroundColor(AppTheme.primaryText)
                                    .frame(minHeight: 80)
                                    .padding(10)
                                    .background(AppTheme.cardBackground)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(AppTheme.borderColor, lineWidth: 1)
                                    )
                            }
                        }
                    }
                    
                    // Property Details Section
                    ExpandableSection(title: "Property Details", icon: "info.circle.fill", isExpanded: binding(for: "details")) {
                        VStack(spacing: 16) {
                            FormPickerField(title: "Property Type", selection: $propertyType, options: propertyTypes)
                            FormField(title: "Square Footage", placeholder: "Enter square footage", text: $squareFootage, keyboardType: .numberPad)
                            FormField(title: "Lot Size", placeholder: "e.g., 0.25 acres", text: $lotSize)
                            FormField(title: "Stories", placeholder: "Number of stories", text: $stories, keyboardType: .numberPad)
                            FormField(title: "Bedrooms", placeholder: "Number of bedrooms", text: $bedrooms, keyboardType: .numberPad)
                            FormField(title: "Bathrooms", placeholder: "Number of bathrooms", text: $bathrooms, keyboardType: .decimalPad)
                            FormField(title: "Year Built", placeholder: "Enter year built", text: $yearBuilt, keyboardType: .numberPad)
                            FormField(title: "Unit Number", placeholder: "Apt/Unit # (if applicable)", text: $unitNumber)
                        }
                    }
                    
                    // Structure & Features Section
                    ExpandableSection(title: "Structure & Features", icon: "building.2.fill", isExpanded: binding(for: "structure")) {
                        VStack(spacing: 16) {
                            FormToggleField(title: "Basement", isOn: $basement)
                            if basement {
                                FormPickerField(title: "Basement Type", selection: $basementType, options: basementTypes)
                            }
                            
                            FormToggleField(title: "Garage", isOn: $garage)
                            if garage {
                                FormPickerField(title: "Garage Type", selection: $garageType, options: garageTypes)
                                FormField(title: "Garage Spaces", placeholder: "Number of spaces", text: $garageSpaces, keyboardType: .numberPad)
                            }
                            
                            FormToggleField(title: "Attic", isOn: $attic)
                            if attic {
                                FormPickerField(title: "Attic Access", selection: $atticAccess, options: atticAccessTypes)
                            }
                            
                            FormToggleField(title: "Crawl Space", isOn: $crawlSpace)
                        }
                    }
                    
                    // HVAC Section
                    ExpandableSection(title: "HVAC & Climate", icon: "wind", isExpanded: binding(for: "hvac")) {
                        VStack(spacing: 16) {
                            FormPickerField(title: "Heating System", selection: $heatingSystem, options: heatingSystems)
                            if heatingSystem != "None" {
                                FormPickerField(title: "Heating Fuel", selection: $heatingFuel, options: heatingFuels)
                            }
                            
                            FormPickerField(title: "Cooling System", selection: $coolingSystem, options: coolingSystems)
                            FormToggleField(title: "Air Conditioning", isOn: $airConditioning)
                            FormField(title: "HVAC Age (years)", placeholder: "Age of HVAC system", text: $hvacAge, keyboardType: .numberPad)
                            FormPickerField(title: "Thermostat Type", selection: $thermostatType, options: thermostatTypes)
                        }
                    }
                    
                    // Exterior Section
                    ExpandableSection(title: "Exterior & Roofing", icon: "house.lodge.fill", isExpanded: binding(for: "exterior")) {
                        VStack(spacing: 16) {
                            FormPickerField(title: "Roof Type", selection: $roofType, options: roofTypes)
                            FormField(title: "Roof Age", placeholder: "Age in years or 'Unknown'", text: $roofAge)
                            FormPickerField(title: "Exterior Material", selection: $exteriorMaterial, options: exteriorMaterials)
                            FormPickerField(title: "Foundation Type", selection: $foundationType, options: foundationTypes)
                        }
                    }
                    
                    // Access & Security Section
                    ExpandableSection(title: "Access & Security", icon: "lock.shield.fill", isExpanded: binding(for: "access")) {
                        VStack(spacing: 16) {
                            FormToggleField(title: "Gated Community", isOn: $gatedCommunity)
                            FormField(title: "Access Code", placeholder: "Gate/door code", text: $accessCode)
                            FormField(title: "Access Instructions", placeholder: "Special access instructions", text: $accessInstructions)
                            FormPickerField(title: "Parking Type", selection: $parkingType, options: parkingTypes)
                            FormField(title: "Parking Spaces", placeholder: "Number of spaces", text: $parkingSpaces, keyboardType: .numberPad)
                        }
                    }
                    
                    // Landscaping Section
                    ExpandableSection(title: "Landscaping & Outdoor", icon: "leaf.fill", isExpanded: binding(for: "landscaping")) {
                        VStack(spacing: 16) {
                            FormToggleField(title: "Sprinkler System", isOn: $sprinklerSystem)
                            
                            FormToggleField(title: "Pool", isOn: $pool)
                            if pool {
                                FormPickerField(title: "Pool Type", selection: $poolType, options: poolTypes)
                            }
                            
                            FormToggleField(title: "Fence", isOn: $fence)
                            if fence {
                                FormPickerField(title: "Fence Type", selection: $fenceType, options: fenceTypes)
                            }
                            
                            FormToggleField(title: "Deck", isOn: $deck)
                            if deck {
                                FormPickerField(title: "Deck Material", selection: $deckMaterial, options: deckMaterials)
                            }
                            
                            FormToggleField(title: "Patio", isOn: $patio)
                            if patio {
                                FormPickerField(title: "Patio Material", selection: $patioMaterial, options: patioMaterials)
                            }
                        }
                    }
                    
                    // Special Considerations Section
                    ExpandableSection(title: "Special Considerations", icon: "star.fill", isExpanded: binding(for: "special")) {
                        VStack(spacing: 16) {
                            FormToggleField(title: "Pet Friendly", isOn: $petFriendly)
                            FormToggleField(title: "Smoking Allowed", isOn: $smokingAllowed)
                            FormToggleField(title: "Wheelchair Accessible", isOn: $wheelchairAccessible)
                            
                            FormToggleField(title: "Fireplace", isOn: $fireplace)
                            if fireplace {
                                FormPickerField(title: "Fireplace Type", selection: $fireplaceType, options: fireplaceTypes)
                            }
                        }
                    }
                    
                    // Notes Section
                    ExpandableSection(title: "Maintenance & Notes", icon: "note.text", isExpanded: binding(for: "notes")) {
                        VStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Maintenance Notes")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                TextEditor(text: $maintenanceNotes)
                                    .foregroundColor(AppTheme.primaryText)
                                    .frame(minHeight: 80)
                                    .padding(10)
                                    .background(AppTheme.cardBackground)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(AppTheme.borderColor, lineWidth: 1)
                                    )
                            }
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Special Instructions")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                TextEditor(text: $specialInstructions)
                                    .foregroundColor(AppTheme.primaryText)
                                    .frame(minHeight: 80)
                                    .padding(10)
                                    .background(AppTheme.cardBackground)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(AppTheme.borderColor, lineWidth: 1)
                                    )
                            }
                        }
                    }
                    
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
                .padding(.vertical)
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
        .task {
            if let property = property {
                loadPropertyData(property)
            }
        }
    }
    
    // Helper function to create binding for expandable sections
    private func binding(for section: String) -> Binding<Bool> {
        Binding(
            get: { expandedSections.contains(section) },
            set: { isExpanded in
                if isExpanded {
                    expandedSections.insert(section)
                } else {
                    expandedSections.remove(section)
                }
            }
        )
    }
    
    // Helper to map display labels to backend values
    private func toBackendValue(_ displayValue: String, choices: [String: String]) -> String? {
        if displayValue == "None" { return nil }
        // Find the key for the display value
        for (key, value) in choices {
            if value == displayValue {
                return key
            }
        }
        return displayValue // fallback to display value if not found
    }
    
    // Helper to map backend values to display labels
    private func toDisplayValue(_ backendValue: String?, choices: [String: String]) -> String {
        guard let backendValue = backendValue else { return "None" }
        return choices[backendValue] ?? backendValue
    }
    
    // Value mapping dictionaries (backend_value: display_label)
    private let heatingSystemMap: [String: String] = [
        "forced_air": "Forced Air",
        "radiant": "Radiant",
        "heat_pump": "Heat Pump",
        "baseboard": "Baseboard",
        "boiler": "Boiler",
        "geothermal": "Geothermal",
        "none": "None",
        "other": "Other"
    ]
    
    private let heatingFuelMap: [String: String] = [
        "natural_gas": "Natural Gas",
        "electric": "Electric",
        "oil": "Oil",
        "propane": "Propane",
        "solar": "Solar",
        "other": "Other",
        "none": "None"
    ]
    
    private let coolingSystemMap: [String: String] = [
        "central_ac": "Central AC",
        "heat_pump": "Heat Pump",
        "window_units": "Window Units",
        "evaporative": "Evaporative",
        "ductless_mini_split": "Ductless Mini-Split",
        "none": "None",
        "other": "Other"
    ]
    
    private let thermostatTypeMap: [String: String] = [
        "manual": "Manual",
        "programmable": "Programmable",
        "smart": "Smart"
    ]
    
    private let roofTypeMap: [String: String] = [
        "asphalt_shingle": "Asphalt Shingle",
        "metal": "Metal",
        "tile": "Tile",
        "slate": "Slate",
        "flat": "Flat",
        "rubber": "Rubber",
        "other": "Other",
        "none": "None"
    ]
    
    private let exteriorMaterialMap: [String: String] = [
        "vinyl": "Vinyl",
        "brick": "Brick",
        "wood": "Wood",
        "stucco": "Stucco",
        "stone": "Stone",
        "fiber_cement": "Fiber Cement",
        "mixed": "Mixed",
        "other": "Other",
        "none": "None"
    ]
    
    private let foundationTypeMap: [String: String] = [
        "slab": "Slab",
        "crawlspace": "Crawlspace",
        "basement": "Basement",
        "pier_beam": "Pier & Beam",
        "none": "None"
    ]
    
    private let basementTypeMap: [String: String] = [
        "finished": "Finished",
        "unfinished": "Unfinished",
        "partial": "Partially Finished",
        "none": "None"
    ]
    
    private let garageTypeMap: [String: String] = [
        "attached": "Attached",
        "detached": "Detached",
        "none": "None"
    ]
    
    private let atticAccessMap: [String: String] = [
        "pull_down": "Pull Down",
        "stairway": "Stairway",
        "scuttle": "Scuttle",
        "none": "None"
    ]
    
    private let parkingTypeMap: [String: String] = [
        "garage": "Garage",
        "driveway": "Driveway",
        "street": "Street",
        "carport": "Carport",
        "covered": "Covered",
        "none": "None"
    ]
    
    private let poolTypeMap: [String: String] = [
        "inground": "In-Ground",
        "aboveground": "Above-Ground",
        "none": "None"
    ]
    
    private let fenceTypeMap: [String: String] = [
        "wood": "Wood",
        "vinyl": "Vinyl",
        "chain_link": "Chain Link",
        "wrought_iron": "Wrought Iron",
        "none": "None"
    ]
    
    private let deckMaterialMap: [String: String] = [
        "wood": "Wood",
        "composite": "Composite",
        "vinyl": "Vinyl",
        "aluminum": "Aluminum",
        "none": "None"
    ]
    
    private let patioMaterialMap: [String: String] = [
        "concrete": "Concrete",
        "pavers": "Pavers",
        "stone": "Stone",
        "brick": "Brick",
        "tile": "Tile",
        "none": "None"
    ]
    
    private let fireplaceTypeMap: [String: String] = [
        "wood": "Wood",
        "gas": "Gas",
        "electric": "Electric",
        "none": "None"
    ]
    
    private let propertyTypeMap: [String: String] = [
        "single_family": "Single Family Home",
        "condo": "Condominium",
        "townhome": "Townhouse",
        "apartment": "Apartment",
        "multi_family": "Multi-Family Home",
        "vacation_home": "Vacation Home",
        "mobile_home": "Mobile Home",
        "commercial": "Commercial",
        "other": "Other"
    ]
    
    // Load property data into form fields
    private func loadPropertyData(_ property: Property) {
        AppLogger.app.info("Loading property data for: \(property.title, privacy: .public)")
        
        // Basic Info
        name = property.title
        streetAddress = property.address
        city = property.city
        state = property.state
        zipCode = property.zipCode
        county = property.county ?? ""
        country = property.country
        description = property.description
        
        // Load descriptives if available
        guard let desc = property.descriptives else {
            AppLogger.app.warning("No descriptives found for property")
            return
        }
        
        AppLogger.app.debug("Loading descriptives...")
        
        // Property Details - Map backend values to display labels
        #if DEBUG
        AppLogger.app.debug("Backend propertyType: '\(desc.propertyType ?? "nil", privacy: .public)'")
        #endif
        propertyType = toDisplayValue(desc.propertyType, choices: propertyTypeMap)
        #if DEBUG
        AppLogger.app.debug("Display propertyType: '\(propertyType, privacy: .public)'")
        #endif
        squareFootage = desc.squareFootage.map { String($0) } ?? ""
        lotSize = desc.lotSize ?? ""
        stories = desc.stories.map { String($0) } ?? ""
        bedrooms = desc.bedrooms.map { String($0) } ?? ""
        bathrooms = desc.bathrooms ?? ""
        yearBuilt = desc.yearBuilt.map { String($0) } ?? ""
        unitNumber = desc.unitNumber ?? ""
        
        // Structure & Features - Map backend values to display labels
        basement = desc.basement ?? false
        #if DEBUG
        AppLogger.app.debug("Backend basementType: '\(desc.basementType ?? "nil", privacy: .public)'")
        #endif
        basementType = toDisplayValue(desc.basementType, choices: basementTypeMap)
        #if DEBUG
        AppLogger.app.debug("Display basementType: '\(basementType, privacy: .public)'")
        #endif
        garage = desc.garage ?? false
        garageType = toDisplayValue(desc.garageType, choices: garageTypeMap)
        garageSpaces = desc.garageSpaces.map { String($0) } ?? ""
        attic = desc.attic ?? false
        atticAccess = toDisplayValue(desc.atticAccess, choices: atticAccessMap)
        crawlSpace = desc.crawlSpace ?? false
        
        // HVAC - Map backend values to display labels
        #if DEBUG
        AppLogger.app.debug("Backend heatingSystem: '\(desc.heatingSystem ?? "nil", privacy: .public)'")
        #endif
        heatingSystem = toDisplayValue(desc.heatingSystem, choices: heatingSystemMap)
        #if DEBUG
        AppLogger.app.debug("Display heatingSystem: '\(heatingSystem, privacy: .public)'")
        #endif
        
        heatingFuel = toDisplayValue(desc.heatingFuel, choices: heatingFuelMap)
        coolingSystem = toDisplayValue(desc.coolingSystem, choices: coolingSystemMap)
        airConditioning = desc.airConditioning ?? false
        hvacAge = desc.hvacAge.map { String($0) } ?? ""
        thermostatType = toDisplayValue(desc.thermostatType, choices: thermostatTypeMap)
        
        // Exterior - Map backend values to display labels
        roofType = toDisplayValue(desc.roofType, choices: roofTypeMap)
        roofAge = desc.roofAge ?? ""
        exteriorMaterial = toDisplayValue(desc.exteriorMaterial, choices: exteriorMaterialMap)
        foundationType = toDisplayValue(desc.foundationType, choices: foundationTypeMap)
        
        AppLogger.app.info("Finished loading property data")
        
        // Access & Security
        gatedCommunity = desc.gatedCommunity ?? false
        accessCode = desc.accessCode ?? ""
        accessInstructions = desc.accessInstructions ?? ""
        parkingType = toDisplayValue(desc.parkingType, choices: parkingTypeMap)
        parkingSpaces = desc.parkingSpaces.map { String($0) } ?? ""
        
        // Landscaping - Map backend values to display labels
        sprinklerSystem = desc.sprinklerSystem ?? false
        pool = desc.pool ?? false
        poolType = toDisplayValue(desc.poolType, choices: poolTypeMap)
        fence = desc.fence ?? false
        fenceType = toDisplayValue(desc.fenceType, choices: fenceTypeMap)
        deck = desc.deck ?? false
        deckMaterial = toDisplayValue(desc.deckMaterial, choices: deckMaterialMap)
        patio = desc.patio ?? false
        patioMaterial = toDisplayValue(desc.patioMaterial, choices: patioMaterialMap)
        
        // Special Considerations
        petFriendly = desc.petFriendly ?? false
        smokingAllowed = desc.smokingAllowed ?? false
        wheelchairAccessible = desc.wheelchairAccessible ?? false
        fireplace = desc.fireplace ?? false
        fireplaceType = toDisplayValue(desc.fireplaceType, choices: fireplaceTypeMap)
        
        // Notes
        maintenanceNotes = desc.maintenanceNotes ?? ""
        specialInstructions = desc.specialInstructions ?? ""
        
        #if DEBUG
        AppLogger.app.debug("Final loaded values: propertyType='\(propertyType, privacy: .public)', heatingSystem='\(heatingSystem, privacy: .public)', coolingSystem='\(coolingSystem, privacy: .public)', basementType='\(basementType, privacy: .public)'")
        #endif
    }
    
    // Build complete descriptives dictionary with all fields mapped to backend values
    private func buildDescriptivesDictionary() -> [String: Any?] {
        return [
            // Basic Property Info
            "propertyType": toBackendValue(propertyType, choices: propertyTypeMap),
            "yearBuilt": yearBuilt.isEmpty ? nil : Int(yearBuilt),
            "squareFootage": squareFootage.isEmpty ? nil : Int(squareFootage),
            "lotSize": lotSize.isEmpty ? nil : lotSize,
            "stories": stories.isEmpty ? nil : Int(stories),
            "bedrooms": bedrooms.isEmpty ? nil : Int(bedrooms),
            "bathrooms": bathrooms.isEmpty ? nil : bathrooms,
            "unitNumber": unitNumber.isEmpty ? nil : unitNumber,
            
            // Access & Security
            "gatedCommunity": gatedCommunity,
            "accessCode": accessCode.isEmpty ? nil : accessCode,
            "accessInstructions": accessInstructions.isEmpty ? nil : accessInstructions,
            "parkingType": toBackendValue(parkingType, choices: parkingTypeMap),
            "parkingSpaces": parkingSpaces.isEmpty ? nil : Int(parkingSpaces),
            
            // Structure & Features
            "basement": basement,
            "basementType": toBackendValue(basementType, choices: basementTypeMap),
            "garage": garage,
            "garageType": toBackendValue(garageType, choices: garageTypeMap),
            "garageSpaces": garageSpaces.isEmpty ? nil : Int(garageSpaces),
            "attic": attic,
            "atticAccess": toBackendValue(atticAccess, choices: atticAccessMap),
            "crawlSpace": crawlSpace,
            
            // HVAC & Climate Control
            "heatingSystem": toBackendValue(heatingSystem, choices: heatingSystemMap),
            "heatingFuel": toBackendValue(heatingFuel, choices: heatingFuelMap),
            "coolingSystem": toBackendValue(coolingSystem, choices: coolingSystemMap),
            "airConditioning": airConditioning,
            "hvacAge": hvacAge.isEmpty ? nil : Int(hvacAge),
            "thermostatType": toBackendValue(thermostatType, choices: thermostatTypeMap),
            
            // Roofing & Exterior
            "roofType": toBackendValue(roofType, choices: roofTypeMap),
            "roofAge": roofAge.isEmpty ? nil : roofAge,
            "exteriorMaterial": toBackendValue(exteriorMaterial, choices: exteriorMaterialMap),
            "foundationType": toBackendValue(foundationType, choices: foundationTypeMap),
            
            // Landscaping & Exterior
            "sprinklerSystem": sprinklerSystem,
            "pool": pool,
            "poolType": toBackendValue(poolType, choices: poolTypeMap),
            "fence": fence,
            "fenceType": toBackendValue(fenceType, choices: fenceTypeMap),
            "deck": deck,
            "deckMaterial": toBackendValue(deckMaterial, choices: deckMaterialMap),
            "patio": patio,
            "patioMaterial": toBackendValue(patioMaterial, choices: patioMaterialMap),
            
            // Special Considerations
            "petFriendly": petFriendly,
            "smokingAllowed": smokingAllowed,
            "wheelchairAccessible": wheelchairAccessible,
            "fireplace": fireplace,
            "fireplaceType": toBackendValue(fireplaceType, choices: fireplaceTypeMap),
            
            // Maintenance & Notes
            "maintenanceNotes": maintenanceNotes.isEmpty ? nil : maintenanceNotes,
            "specialInstructions": specialInstructions.isEmpty ? nil : specialInstructions,
            
            // Metadata
            "createdFrom": "ios_app"
        ]
    }
    
    private func submitProperty() {
        // Validate inputs
        guard isFormValid else {
            alertMessage = "Please complete all required fields"
            showingAlert = true
            return
        }
        
        // Build descriptives dictionary with all fields
        let descriptivesDict = buildDescriptivesDictionary()
        
        // Convert dictionary to PropertyDescriptives using JSON encoding/decoding
        var descriptives: PropertyDescriptives? = nil
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: descriptivesDict.compactMapValues { $0 })
            descriptives = try JSONDecoder().decode(PropertyDescriptives.self, from: jsonData)
        } catch {
            AppLogger.error("Error encoding descriptives", error: error, category: AppLogger.app)
            alertMessage = "Failed to prepare property data"
            showingAlert = true
            return
        }
        
        Task {
            if isEditing, let property = property {
                // Update existing property
                do {
                    _ = try await viewModel.updateProperty(
                        id: property.id,
                        title: name,
                        description: description,
                        address: streetAddress,
                        city: city,
                        state: state,
                        zipCode: zipCode,
                        county: county.isEmpty ? nil : county,
                        country: country,
                        descriptives: descriptives
                    )
                    onSave?()
                    dismiss()
                } catch {
                    alertMessage = "Failed to update property: \(error.localizedDescription)"
                    showingAlert = true
                }
            } else {
                // Create new property - convert display values to backend values
                await viewModel.createProperty(
                    title: name,
                    description: description,
                    address: streetAddress,
                    city: city,
                    state: state,
                    zipCode: zipCode,
                    country: country,
                    propertyType: toBackendValue(propertyType, choices: propertyTypeMap),
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

// MARK: - Helper Views

struct ExpandableSection<Content: View>: View {
    let title: String
    let icon: String
    @Binding var isExpanded: Bool
    let content: Content
    
    init(title: String, icon: String, isExpanded: Binding<Bool>, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self._isExpanded = isExpanded
        self.content = content()
    }
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: {
                withAnimation {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(AppTheme.accentPrimary)
                        .frame(width: 24)
                    
                    Text(title)
                        .font(AppTheme.subheadlineFont.bold())
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(AppTheme.secondaryText)
                        .font(.caption)
                }
                .padding()
                .background(AppTheme.cardBackground)
            }
            
            if isExpanded {
                VStack(spacing: 16) {
                    content
                }
                .padding()
                .background(AppTheme.cardBackground.opacity(0.5))
            }
        }
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
        .padding(.horizontal)
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

struct FormPickerField: View {
    let title: String
    @Binding var selection: String
    let options: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(option) {
                        selection = option
                    }
                }
            } label: {
                HStack {
                    Text(selection)
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
    }
}

struct FormToggleField: View {
    let title: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack {
            Text(title)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(AppTheme.accentPrimary)
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

struct AddEditPropertyView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            AddEditPropertyView()
        }
        .preferredColorScheme(.dark)
    }
}