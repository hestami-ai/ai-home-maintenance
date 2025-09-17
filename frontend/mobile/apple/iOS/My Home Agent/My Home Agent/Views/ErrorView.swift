import SwiftUI

// Extension to present errors in alerts
extension View {
    func errorAlert(error: Binding<Error?>, buttonTitle: String = "OK") -> some View {
        let localizedError = error.wrappedValue as? LocalizedError
        return alert(isPresented: .constant(error.wrappedValue != nil), content: {
            Alert(
                title: Text("Error"),
                message: Text(localizedError?.errorDescription ?? error.wrappedValue?.localizedDescription ?? "Unknown error"),
                dismissButton: .default(Text(buttonTitle)) {
                    error.wrappedValue = nil
                }
            )
        })
    }
}

// Extension to present errors as overlays
extension View {
    func errorOverlay<T: Error>(
        error: Binding<T?>,
        retryAction: (() -> Void)? = nil
    ) -> some View {
        ZStack {
            self
            
            if let currentError = error.wrappedValue {
                Color.black.opacity(0.4)
                    .edgesIgnoringSafeArea(.all)
                    .transition(.opacity)
                
                NetworkErrorView(error: currentError, retryAction: retryAction)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut, value: error.wrappedValue != nil)
    }
}

// Preview provider
struct ErrorView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ErrorView(
                message: "Network connection failed. Please check your internet connection and try again.",
                retryAction: {}
            )
        }
        .preferredColorScheme(.dark)
    }
}