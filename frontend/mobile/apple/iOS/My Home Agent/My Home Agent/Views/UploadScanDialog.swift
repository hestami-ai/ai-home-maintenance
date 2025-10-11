import SwiftUI

struct UploadScanDialog: View {
    let scan: RoomScan?
    let onUpload: (String) -> Void
    let onCancel: () -> Void
    
    @StateObject private var propertiesViewModel = PropertiesViewModel()
    @State private var selectedPropertyId: String?
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                VStack(spacing: 24) {
                    Image(systemName: "icloud.and.arrow.up")
                        .font(.system(size: 60))
                        .foregroundColor(AppTheme.buttonBackground)
                        .padding(.top)
                    
                    Text("Upload to Cloud")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("Upload your scan to the cloud for backup and access across devices")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Select Property")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        if propertiesViewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                        } else if propertiesViewModel.properties.isEmpty {
                            Text("No properties available. Please create a property first.")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.errorColor)
                                .italic()
                        } else {
                            Picker("Property", selection: $selectedPropertyId) {
                                Text("Select a property").tag(nil as String?)
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
                            if let propertyId = selectedPropertyId {
                                onUpload(propertyId)
                                dismiss()
                            }
                        }) {
                            Text("Upload")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(selectedPropertyId == nil ? Color.gray : AppTheme.buttonBackground)
                                .cornerRadius(10)
                        }
                        .disabled(selectedPropertyId == nil)
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            // Pre-select property if scan already has one
            selectedPropertyId = scan?.propertyId
            
            Task {
                await propertiesViewModel.loadProperties()
            }
        }
    }
}
