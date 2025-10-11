import SwiftUI

struct SaveScanDialog: View {
    @Binding var scanName: String
    @Binding var selectedPropertyId: String?
    @StateObject private var propertiesViewModel = PropertiesViewModel()
    
    let onSave: (String, String?) -> Void
    let onCancel: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 24) {
                    Text("Save Room Scan")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                        .padding(.top)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Scan Name")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        TextField("Enter scan name", text: $scanName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .font(AppTheme.bodyFont)
                    }
                    .padding(.horizontal)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Associate with Property (Optional)")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        if propertiesViewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                        } else if propertiesViewModel.properties.isEmpty {
                            Text("No properties available")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                                .italic()
                        } else {
                            Picker("Property", selection: $selectedPropertyId) {
                                Text("None").tag(nil as String?)
                                ForEach(propertiesViewModel.properties) { property in
                                    Text(property.title).tag(property.id as String?)
                                }
                            }
                            .pickerStyle(MenuPickerStyle())
                            .padding()
                            .background(AppTheme.cardBackground)
                            .cornerRadius(8)
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer()
                    
                    HStack(spacing: 16) {
                        Button(action: {
                            onCancel()
                            dismiss()
                        }) {
                            Text("Cancel")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.secondaryText)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(AppTheme.cardBackground)
                                .cornerRadius(10)
                        }
                        
                        Button(action: {
                            if !scanName.isEmpty {
                                onSave(scanName, selectedPropertyId)
                                dismiss()
                            }
                        }) {
                            Text("Save")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(scanName.isEmpty ? Color.gray : AppTheme.buttonBackground)
                                .cornerRadius(10)
                        }
                        .disabled(scanName.isEmpty)
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            if scanName.isEmpty {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd HH:mm"
                scanName = "Room Scan \(formatter.string(from: Date()))"
            }
            
            Task {
                await propertiesViewModel.loadProperties()
            }
        }
    }
}
