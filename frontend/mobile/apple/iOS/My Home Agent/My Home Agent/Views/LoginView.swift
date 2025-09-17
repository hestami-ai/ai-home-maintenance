import SwiftUI
import Foundation

struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                Image("hestami-logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 150, height: 150)
                    .padding(.bottom, 20)
                
                Text("Welcome to\nHestami Home Services!")
                    .font(.largeTitle.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                TextField("Email", text: $viewModel.email)
                    .disableInputAssistant()
                    .padding()
                    .background(AppTheme.inputBackground)
                    .cornerRadius(10)
                    .foregroundColor(AppTheme.textPrimary)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                    .disableAutocorrection(true)
                
                SecureField("Password", text: $viewModel.password)
                    .padding()
                    .background(AppTheme.inputBackground)
                    .cornerRadius(10)
                    .foregroundColor(AppTheme.textPrimary)
                
                HStack {
                    Toggle(isOn: $viewModel.rememberMe) {
                        Text("Remember Me")
                            .foregroundColor(AppTheme.primaryText)
                            .font(.subheadline)
                    }
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.accentColor))
                }
                .padding(.vertical, 5)
                
                // Error handling is now done with alerts
                
                Button(action: {
                    Task {
                        await viewModel.login()
                    }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonText))
                    } else {
                        Text("Login")
                            .font(.headline.bold())
                            .foregroundColor(AppTheme.buttonText)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding()
                .background(AppTheme.buttonBackground)
                .cornerRadius(10)
                .disabled(viewModel.isLoading)
                
                if viewModel.canUseBiometrics {
                    Button(action: {
                        Task {
                            await viewModel.loginWithBiometrics()
                        }
                    }) {
                        HStack {
                            Image(systemName: "faceid")
                                .font(.system(size: 20))
                            Text("Login with Face ID")
                                .font(.headline)
                        }
                        .foregroundColor(AppTheme.accentColor)
                        .frame(maxWidth: .infinity)
                    }
                    .padding()
                    .background(Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(AppTheme.accentColor, lineWidth: 1)
                    )
                    .cornerRadius(10)
                    .disabled(viewModel.isLoading)
                }
                
                Button(action: {
                    // Forgot password action
                }) {
                    Text("Forgot Password?")
                        .foregroundColor(AppTheme.accentColor)
                        .font(.subheadline)
                }
                .padding(.top, 10)
                
                Spacer()
                
                HStack {
                    Text("Don't have an account?")
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Button(action: {
                        // Sign up action
                    }) {
                        Text("Sign Up")
                            .foregroundColor(AppTheme.successColor)
                            .fontWeight(.bold)
                    }
                }
                .padding(.bottom, 20)
            }
            .padding()
        }
        .navigationBarHidden(true)
        .onAppear {
            viewModel.checkAuthentication()
        }
        .fullScreenCover(isPresented: $viewModel.isAuthenticated) {
            TabViewContainer()
        }
        .alert(isPresented: $viewModel.showErrorAlert) {
            if let error = viewModel.error {
                if let localizedError = error as? LocalizedError {
                    return Alert(
                        title: Text("Login Failed"),
                        message: Text(localizedError.errorDescription ?? error.localizedDescription),
                        dismissButton: .default(Text("OK")) {
                            viewModel.showErrorAlert = false
                        }
                    )
                } else {
                    return Alert(
                        title: Text("Login Failed"),
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
    }
}

struct LoginView_Previews: PreviewProvider {
    static var previews: some View {
        LoginView()
    }
}