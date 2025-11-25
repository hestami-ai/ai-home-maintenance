import SwiftUI

struct SignupView: View {
    @StateObject private var viewModel = SignupViewModel()
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                ScrollView {
                    VStack(spacing: 20) {
                        Image("hestami-logo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 100, height: 100)
                            .padding(.top, 20)
                        
                        Text("Create Account")
                            .font(.largeTitle.bold())
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Sign up for a new account")
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        // Name fields (side by side)
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("First Name")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                TextField("John", text: $viewModel.firstName)
                                    .disableInputAssistant()
                                    .padding()
                                    .background(AppTheme.inputBackground)
                                    .cornerRadius(10)
                                    .foregroundColor(AppTheme.textPrimary)
                                    .autocapitalization(.words)
                            }
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Last Name")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                                TextField("Doe", text: $viewModel.lastName)
                                    .disableInputAssistant()
                                    .padding()
                                    .background(AppTheme.inputBackground)
                                    .cornerRadius(10)
                                    .foregroundColor(AppTheme.textPrimary)
                                    .autocapitalization(.words)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                            TextField("your@email.com", text: $viewModel.email)
                                .disableInputAssistant()
                                .padding()
                                .background(AppTheme.inputBackground)
                                .cornerRadius(10)
                                .foregroundColor(AppTheme.textPrimary)
                                .autocapitalization(.none)
                                .keyboardType(.emailAddress)
                                .disableAutocorrection(true)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Phone Number")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                            TextField("(123) 456-7890", text: $viewModel.phoneNumber)
                                .disableInputAssistant()
                                .padding()
                                .background(AppTheme.inputBackground)
                                .cornerRadius(10)
                                .foregroundColor(AppTheme.textPrimary)
                                .keyboardType(.phonePad)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("I am a")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                            
                            Menu {
                                Button(action: { viewModel.userRole = "PROPERTY_OWNER" }) {
                                    Label("Property Owner", systemImage: viewModel.userRole == "PROPERTY_OWNER" ? "checkmark" : "")
                                }
                                Button(action: { viewModel.userRole = "SERVICE_PROVIDER" }) {
                                    Label("Service Provider", systemImage: viewModel.userRole == "SERVICE_PROVIDER" ? "checkmark" : "")
                                }
                            } label: {
                                HStack {
                                    Text(viewModel.userRole == "PROPERTY_OWNER" ? "Property Owner" : "Service Provider")
                                        .foregroundColor(AppTheme.primaryText)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                .padding()
                                .background(AppTheme.inputBackground)
                                .cornerRadius(10)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Password")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                            SecureField("********", text: $viewModel.password)
                                .padding()
                                .background(AppTheme.inputBackground)
                                .cornerRadius(10)
                                .foregroundColor(AppTheme.textPrimary)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Confirm Password")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                            SecureField("********", text: $viewModel.confirmPassword)
                                .padding()
                                .background(AppTheme.inputBackground)
                                .cornerRadius(10)
                                .foregroundColor(AppTheme.textPrimary)
                            
                            if !viewModel.passwordsMatch && !viewModel.confirmPassword.isEmpty {
                                Text("Passwords do not match")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.errorColor)
                            }
                        }
                        
                        Button(action: {
                            Task {
                                await viewModel.register()
                            }
                        }) {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonText))
                            } else {
                                Text("Create Account")
                                    .font(.headline.bold())
                                    .foregroundColor(AppTheme.buttonText)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding()
                        .background(viewModel.formValid ? AppTheme.buttonBackground : AppTheme.secondaryBackground)
                        .cornerRadius(10)
                        .disabled(viewModel.isLoading || !viewModel.formValid)
                        
                        HStack {
                            Text("Already have an account?")
                                .foregroundColor(AppTheme.secondaryText)
                            
                            Button(action: {
                                dismiss()
                            }) {
                                Text("Sign In")
                                    .foregroundColor(AppTheme.accentColor)
                                    .fontWeight(.bold)
                            }
                        }
                        .padding(.bottom, 20)
                    }
                    .padding()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarHidden(true)
        }
        .alert(isPresented: $viewModel.showErrorAlert) {
            if let error = viewModel.error {
                if let localizedError = error as? LocalizedError {
                    return Alert(
                        title: Text("Registration Failed"),
                        message: Text(localizedError.errorDescription ?? error.localizedDescription),
                        dismissButton: .default(Text("OK")) {
                            viewModel.showErrorAlert = false
                        }
                    )
                } else {
                    return Alert(
                        title: Text("Registration Failed"),
                        message: Text(error.localizedDescription),
                        dismissButton: .default(Text("OK")) {
                            viewModel.showErrorAlert = false
                        }
                    )
                }
            } else {
                return Alert(
                    title: Text("Error"),
                    message: Text("An unknown error occurred"),
                    dismissButton: .default(Text("OK"))
                )
            }
        }
        .alert("Success", isPresented: $viewModel.registrationSuccessful) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Account created successfully! Please sign in with your credentials.")
        }
    }
}

struct SignupView_Previews: PreviewProvider {
    static var previews: some View {
        SignupView()
    }
}
