import SwiftUI

struct UploadScanDialog: View {
    let scan: RoomScan?
    let onUpload: (String) -> Void
    let onCancel: () -> Void
    
    @ObservedObject private var propertiesViewModel = PropertiesViewModel.shared
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
                            Menu {
                                Button("Select a property") {
                                    selectedPropertyId = nil
                                }
                                ForEach(propertiesViewModel.properties) { property in
                                    Button(property.title) {
                                        selectedPropertyId = property.id
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(selectedPropertyId == nil ? "Select a property" : (propertiesViewModel.properties.first(where: { $0.id == selectedPropertyId })?.title ?? "Select a property"))
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(AppTheme.primaryText)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                .padding()
                                .background(AppTheme.cardBackground)
                                .cornerRadius(8)
                            }
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
