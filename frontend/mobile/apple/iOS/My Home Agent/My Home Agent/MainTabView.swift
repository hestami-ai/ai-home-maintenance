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
                
                // My Properties Tab
                NavigationView {
                    PropertiesView()
                }
                .tabItem {
                    Label("My Properties", systemImage: "house.fill")
                }
                .tag(1)
                
                // Service Requests Tab
                NavigationView {
                    RequestsView()
                }
                .tabItem {
                    Label("Service Requests", systemImage: "list.bullet.rectangle")
                }
                .tag(2)
                
                // More Tab
                NavigationView {
                    MoreView(showingSidebar: $showingSidebar)
                }
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
                .tag(3)
            }
            .accentColor(AppTheme.successColor) // Use brighter green for better contrast
            .onAppear {
                setupTabBarAppearance()
            }
            
            // Sidebar overlay when showing
            if showingSidebar {
                SidebarView(showingSidebar: $showingSidebar)
                    .transition(.move(edge: .trailing))
                    .animation(.easeInOut, value: showingSidebar)
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

struct MoreView: View {
    @Binding var showingSidebar: Bool
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack {
                HStack {
                    Spacer()
                    Button(action: {
                        withAnimation {
                            showingSidebar.toggle()
                        }
                    }) {
                        Image(systemName: "line.3.horizontal")
                            .font(.title)
                            .foregroundColor(AppTheme.primaryText)
                            .padding()
                    }
                }
                
                ScrollView {
                    VStack(spacing: 20) {
                        // Section title
                        HStack {
                            Text("Tools & Features")
                                .font(AppTheme.subheadlineFont)
                                .foregroundColor(AppTheme.secondaryText)
                                .padding(.horizontal)
                            Spacer()
                        }
                        
                        // Available options
                        NavigationLink(destination: EmptyView()) {
                            MoreOptionItemView(icon: "doc.text", title: "Documents", description: "View and manage property documents")
                        }
                        
                        NavigationLink(destination: EmptyView()) {
                            MoreOptionItemView(icon: "chart.bar", title: "Reports", description: "Generate property reports and analytics")
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

struct SidebarView: View {
    @Binding var showingSidebar: Bool
    
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
                    // Header
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
                    
                    Divider()
                        .background(AppTheme.borderColor)
                    
                    // Menu Items
                    NavigationLink(destination: SettingsView()) {
                        SidebarMenuItemView(icon: "gear", title: "Settings")
                    }
                    
                    NavigationLink(destination: HelpView()) {
                        SidebarMenuItemView(icon: "questionmark.circle", title: "Help")
                    }
                    
                    NavigationLink(destination: FeedbackView()) {
                        SidebarMenuItemView(icon: "envelope", title: "Send Feedback")
                    }
                    
                    Spacer()
                }
                .frame(width: UIScreen.main.bounds.width * 0.75)
                .background(AppTheme.cardBackground)
                .edgesIgnoringSafeArea(.vertical)
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
    @State private var showLogoutConfirmation = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                // Settings sections
                SettingsSectionView(title: "Account") {
                    Button(action: {
                        showLogoutConfirmation = true
                    }) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .foregroundColor(.red)
                            Text("Logout")
                                .foregroundColor(.red)
                            Spacer()
                        }
                        .padding()
                        .background(AppTheme.cardBackground)
                        .cornerRadius(8)
                    }
                }
                
                Spacer()
            }
            .padding()
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .alert("Logout", isPresented: $showLogoutConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Logout", role: .destructive) {
                logout()
            }
        } message: {
            Text("Are you sure you want to logout?")
        }
    }
    
    private func logout() {
        // Call AuthManager to logout
        AuthManager.shared.logout()
        
        // Post notification to trigger login screen
        NotificationCenter.default.post(name: NSNotification.Name("LogoutRequired"), object: nil)
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