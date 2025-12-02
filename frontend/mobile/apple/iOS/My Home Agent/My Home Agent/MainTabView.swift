//
//  MainTabView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 6/2/25.
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @State private var showingSidebar = false
    @State private var showSettings = false
    @State private var showHelp = false
    @State private var showFeedback = false
    
    var body: some View {
        ZStack {
            TabView(selection: $selectedTab) {
                // Dashboard Tab
                NavigationView {
                    DashboardView()
                }
                .tabItem {
                    Label("Dashboard", systemImage: "gauge")
                }
                .tag(0)
                
                // Properties Tab
                NavigationView {
                    PropertiesView()
                }
                .tabItem {
                    Label("Properties", systemImage: "house.fill")
                }
                .tag(1)
                
                // Requests Tab
                NavigationView {
                    RequestsView()
                }
                .tabItem {
                    Label("Requests", systemImage: "list.bullet.rectangle")
                }
                .tag(2)
                
                // AI Handyman Tab
                NavigationView {
                    AIHandymanView()
                }
                .tabItem {
                    Label("AI Handyman", systemImage: "brain.head.profile")
                }
                .tag(3)
            }
            .accentColor(AppTheme.successColor) // Use brighter green for better contrast
            .onAppear {
                setupTabBarAppearance()
            }
            
            // Menu button in top-right corner (like Android)
            VStack {
                HStack {
                    Spacer()
                    Button(action: {
                        withAnimation {
                            showingSidebar.toggle()
                        }
                    }) {
                        Image(systemName: "line.3.horizontal")
                            .font(.title2)
                            .foregroundColor(AppTheme.secondaryText)
                            .padding(12)
                    }
                }
                .padding(.top, 47) // Account for status bar/Dynamic Island
                .padding(.trailing, 4)
                Spacer()
            }
            
            // Sidebar overlay when showing
            if showingSidebar {
                SidebarView(
                    showingSidebar: $showingSidebar,
                    showSettings: $showSettings,
                    showHelp: $showHelp,
                    showFeedback: $showFeedback
                )
                .transition(.move(edge: .trailing))
                .animation(.easeInOut, value: showingSidebar)
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationView {
                SettingsView()
            }
        }
        .sheet(isPresented: $showHelp) {
            NavigationView {
                HelpView()
            }
        }
        .sheet(isPresented: $showFeedback) {
            NavigationView {
                FeedbackView()
            }
        }
    }
    
    private func setupTabBarAppearance() {
        // Configure tab bar appearance for better contrast
        let tabBarAppearance = UITabBarAppearance()
        
        // Configure for normal state (when not over scrollable content)
        tabBarAppearance.configureWithDefaultBackground()
        tabBarAppearance.backgroundColor = UIColor(AppTheme.navigationBackground)
        
        // Configure selected item appearance
        tabBarAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(AppTheme.successColor)
        tabBarAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(AppTheme.successColor)
        ]
        
        // Configure normal (unselected) item appearance
        tabBarAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(AppTheme.secondaryText)
        tabBarAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(AppTheme.secondaryText)
        ]
        
        // Apply the appearance
        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
    }
}

struct SidebarView: View {
    @Binding var showingSidebar: Bool
    @Binding var showSettings: Bool
    @Binding var showHelp: Bool
    @Binding var showFeedback: Bool
    
    var body: some View {
        ZStack {
            // Semi-transparent background
            Color.black.opacity(0.4)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    withAnimation {
                        showingSidebar = false
                    }
                }
            
            // Sidebar content
            HStack {
                Spacer()
                VStack(alignment: .leading, spacing: 0) {
                    // Header with safe area padding
                    HStack {
                        Text("Menu")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                            .padding()
                        
                        Spacer()
                        
                        Button(action: {
                            withAnimation {
                                showingSidebar = false
                            }
                        }) {
                            Image(systemName: "xmark")
                                .font(.title3)
                                .foregroundColor(AppTheme.primaryText)
                                .padding()
                        }
                    }
                    .padding(.top, 50) // Add padding for status bar/Dynamic Island
                    
                    Divider()
                        .background(AppTheme.borderColor)
                    
                    // Menu Items
                    Button(action: {
                        withAnimation {
                            showingSidebar = false
                        }
                        // Delay showing the sheet until after sidebar closes
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            showSettings = true
                        }
                    }) {
                        SidebarMenuItemView(icon: "gear", title: "Settings")
                    }
                    
                    Button(action: {
                        withAnimation {
                            showingSidebar = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            showHelp = true
                        }
                    }) {
                        SidebarMenuItemView(icon: "questionmark.circle", title: "Help")
                    }
                    
                    Button(action: {
                        withAnimation {
                            showingSidebar = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            showFeedback = true
                        }
                    }) {
                        SidebarMenuItemView(icon: "envelope", title: "Send Feedback")
                    }
                    
                    Spacer()
                }
                .frame(width: UIScreen.main.bounds.width * 0.75)
                .background(AppTheme.cardBackground)
            }
        }
    }
}

struct SidebarMenuItemView: View {
    let icon: String
    let title: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(AppTheme.buttonBackground)
                .frame(width: 24)
            
            Text(title)
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .background(AppTheme.cardBackground)
    }
}

// Placeholder views for sidebar destinations
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showLogoutConfirmation = false
    @State private var showAccountInfo = false
    @State private var showChangePassword = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    // Account Section
                    SettingsSectionView(title: "Account") {
                        VStack(spacing: 0) {
                            Button(action: {
                                showAccountInfo = true
                            }) {
                                SettingsItemView(icon: "person.circle", title: "Account Information", iconColor: AppTheme.accentPrimary)
                            }
                            
                            Divider()
                                .background(AppTheme.borderColor)
                                .padding(.leading, 60)
                            
                            Button(action: {
                                showChangePassword = true
                            }) {
                                SettingsItemView(icon: "lock.rotation", title: "Change Password", iconColor: AppTheme.accentPrimary)
                            }
                        }
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                    }
                    
                    // Sign Out Section
                    SettingsSectionView(title: "Session") {
                        Button(action: {
                            showLogoutConfirmation = true
                        }) {
                            SettingsItemView(icon: "rectangle.portrait.and.arrow.right", title: "Sign Out", iconColor: .red, textColor: .red)
                        }
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                    }
                    
                    Spacer()
                }
                .padding()
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done") {
                    dismiss()
                }
                .foregroundColor(AppTheme.accentPrimary)
            }
        }
        .alert("Sign Out", isPresented: $showLogoutConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                logout()
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
        .sheet(isPresented: $showAccountInfo) {
            NavigationView {
                AccountInfoView()
            }
        }
        .sheet(isPresented: $showChangePassword) {
            NavigationView {
                ChangePasswordView()
            }
        }
    }
    
    private func logout() {
        // Call AuthManager to logout
        AuthManager.shared.logout()
        
        // Dismiss settings view
        dismiss()
        
        // Post notification to trigger login screen
        NotificationCenter.default.post(name: NSNotification.Name("LogoutRequired"), object: nil)
    }
}

struct SettingsItemView: View {
    let icon: String
    let title: String
    var iconColor: Color = AppTheme.accentPrimary
    var textColor: Color = AppTheme.primaryText
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(iconColor)
                .frame(width: 28)
            
            Text(title)
                .font(AppTheme.bodyFont)
                .foregroundColor(textColor)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
    }
}

struct AccountInfoView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var userEmail = "Loading..."
    @State private var userName = "Loading..."
    @State private var userRole = "Loading..."
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    // Profile Icon
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(AppTheme.accentPrimary)
                        .padding(.top, 20)
                    
                    // Account Details
                    VStack(spacing: 16) {
                        AccountInfoRow(label: "Name", value: userName)
                        AccountInfoRow(label: "Email", value: userEmail)
                        AccountInfoRow(label: "Role", value: userRole)
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .padding(.horizontal)
                    
                    Spacer()
                }
            }
        }
        .navigationTitle("Account Information")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done") {
                    dismiss()
                }
                .foregroundColor(AppTheme.accentPrimary)
            }
        }
        .task {
            await loadAccountInfo()
        }
    }
    
    private func loadAccountInfo() async {
        do {
            let user: User = try await NetworkManager.shared.request(
                endpoint: "/api/users/profile/",
                method: .get,
                parameters: [:]
            )
            userName = user.displayName
            userEmail = user.email
            userRole = user.userRole == "PROPERTY_OWNER" ? "Property Owner" : "Service Provider"
        } catch {
            userName = "Error loading"
            userEmail = "Error loading"
            userRole = "Error loading"
        }
    }
}

struct AccountInfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.secondaryText)
                .frame(width: 80, alignment: .leading)
            
            Text(value)
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
        }
    }
}

struct ChangePasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var showSuccess = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Current Password")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        SecureField("Enter current password", text: $currentPassword)
                            .padding()
                            .background(AppTheme.inputBackground)
                            .cornerRadius(10)
                            .foregroundColor(AppTheme.textPrimary)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("New Password")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        SecureField("Enter new password", text: $newPassword)
                            .padding()
                            .background(AppTheme.inputBackground)
                            .cornerRadius(10)
                            .foregroundColor(AppTheme.textPrimary)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Confirm New Password")
                            .font(AppTheme.captionFont)
                            .foregroundColor(AppTheme.secondaryText)
                        SecureField("Confirm new password", text: $confirmPassword)
                            .padding()
                            .background(AppTheme.inputBackground)
                            .cornerRadius(10)
                            .foregroundColor(AppTheme.textPrimary)
                        
                        if !confirmPassword.isEmpty && newPassword != confirmPassword {
                            Text("Passwords do not match")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.errorColor)
                        }
                    }
                    
                    Button(action: {
                        Task {
                            await changePassword()
                        }
                    }) {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonText))
                        } else {
                            Text("Change Password")
                                .font(.headline.bold())
                                .foregroundColor(AppTheme.buttonText)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding()
                    .background(formValid ? AppTheme.buttonBackground : AppTheme.secondaryBackground)
                    .cornerRadius(10)
                    .disabled(isLoading || !formValid)
                    
                    Spacer()
                }
                .padding()
            }
        }
        .navigationTitle("Change Password")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Cancel") {
                    dismiss()
                }
                .foregroundColor(AppTheme.accentPrimary)
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage ?? "An error occurred")
        }
        .alert("Success", isPresented: $showSuccess) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Your password has been changed successfully")
        }
    }
    
    private var formValid: Bool {
        !currentPassword.isEmpty &&
        !newPassword.isEmpty &&
        !confirmPassword.isEmpty &&
        newPassword == confirmPassword
    }
    
    private func changePassword() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let _: EmptyResponse = try await NetworkManager.shared.request(
                endpoint: "/api/users/password/change/",
                method: .post,
                parameters: [
                    "old_password": currentPassword,
                    "new_password": newPassword,
                    "confirm_password": confirmPassword
                ]
            )
            
            isLoading = false
            showSuccess = true
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            isLoading = false
        }
    }
}

struct HelpView: View {
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            Text("Help & Support")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
        }
        .navigationTitle("Help & Support")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

struct FeedbackView: View {
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            Text("Send Feedback")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
        }
        .navigationTitle("Send Feedback")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

// Settings section component
struct SettingsSectionView<Content: View>: View {
    let title: String
    let content: () -> Content
    
    init(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(AppTheme.subheadlineFont)
                .foregroundColor(AppTheme.secondaryText)
                .padding(.horizontal)
            
            content()
        }
    }
}

struct MainTabView_Previews: PreviewProvider {
    static var previews: some View {
        MainTabView()
            .preferredColorScheme(.dark)
    }
}