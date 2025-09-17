import Foundation
import SwiftUI

class ErrorHandler {
    static let shared = ErrorHandler()
    
    private init() {}
    
    // Handle network errors and return user-friendly messages
    func handleNetworkError(_ error: Error) -> String {
        if let networkError = error as? NetworkError {
            return networkError.localizedDescription
        } else {
            return "An unexpected error occurred. Please try again."
        }
    }
    
    // Check if error is an authentication error
    func isAuthError(_ error: Error) -> Bool {
        if let networkError = error as? NetworkError {
            return networkError.isAuthError
        }
        return false
    }
    
    // Present an alert with the error message
    func showError(error: Error, retryAction: (() -> Void)? = nil) -> Alert {
        let message = handleNetworkError(error)
        
        if let retry = retryAction {
            return Alert(
                title: Text("Error"),
                message: Text(message),
                primaryButton: .default(Text("Retry"), action: retry),
                secondaryButton: .cancel(Text("Dismiss"))
            )
        } else {
            return Alert(
                title: Text("Error"),
                message: Text(message),
                dismissButton: .default(Text("OK"))
            )
        }
    }
    
    // Log errors for debugging
    func logError(_ error: Error, file: String = #file, function: String = #function, line: Int = #line) {
        #if DEBUG
        let fileName = (file as NSString).lastPathComponent
        print("❌ ERROR: \(error.localizedDescription)")
        print("📍 Location: \(fileName):\(line) - \(function)")
        
        if let networkError = error as? NetworkError, case .httpError(let statusCode, let data) = networkError {
            print("📡 Status Code: \(statusCode)")
            if let data = data, let responseString = String(data: data, encoding: .utf8) {
                print("📄 Response: \(responseString)")
            }
        }
        #endif
    }
}

// MARK: - SwiftUI View Extension for Error Handling
extension View {
    func handleNetworkError(_ error: Binding<Error?>, retryAction: (() -> Void)? = nil) -> some View {
        let isPresented = Binding<Bool>(
            get: { error.wrappedValue != nil },
            set: { if !$0 { error.wrappedValue = nil } }
        )
        
        return alert(isPresented: isPresented) {
            if let currentError = error.wrappedValue {
                return ErrorHandler.shared.showError(error: currentError, retryAction: retryAction)
            } else {
                return Alert(title: Text("Error"), message: Text("Unknown error occurred"), dismissButton: .default(Text("OK")))
            }
        }
    }
}

// MARK: - Error View Components
struct ErrorView: View {
    let message: String
    let retryAction: (() -> Void)?
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(AppTheme.errorColor)
            
            Text("Something went wrong")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text(message)
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            if let retry = retryAction {
                Button(action: retry) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Try Again")
                    }
                    .padding()
                    .background(AppTheme.buttonBackground)
                    .foregroundColor(AppTheme.buttonText)
                    .cornerRadius(10)
                }
                .padding(.top, 10)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
        .padding()
    }
}

struct NetworkErrorView: View {
    let error: Error
    let retryAction: (() -> Void)?
    
    var body: some View {
        ErrorView(
            message: ErrorHandler.shared.handleNetworkError(error),
            retryAction: retryAction
        )
    }
}
