import SwiftUI

struct SplashScreenView: View {
    @StateObject private var viewModel = SplashScreenViewModel()
    @State private var isAnimating = false
    
    var body: some View {
        ZStack {
            // Background
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack {
                // Logo
                Image("hestami-logo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 200, height: 200)
                    .scaleEffect(isAnimating ? 1.0 : 0.8)
                    .opacity(isAnimating ? 1 : 0.5)
                
                // App name
                Text("My Home Agent")
                    .font(.title.bold())
                    .foregroundColor(AppTheme.primaryText)
                    .padding(.top, 20)
                    .opacity(isAnimating ? 1 : 0)
                
                // Loading indicator
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonBackground))
                        .scaleEffect(1.5)
                        .padding(.top, 40)
                }
            }
        }
        .onAppear {
            // Start animations
            withAnimation(.easeOut(duration: 1.2)) {
                isAnimating = true
            }
            
            // Check authentication status
            Task {
                await viewModel.checkAuthenticationStatus()
            }
        }
        .fullScreenCover(isPresented: $viewModel.showLoginView) {
            LoginView()
        }
        .fullScreenCover(isPresented: $viewModel.showMainApp) {
            TabViewContainer()
        }
    }
}

struct SplashScreenView_Previews: PreviewProvider {
    static var previews: some View {
        SplashScreenView()
    }
}
