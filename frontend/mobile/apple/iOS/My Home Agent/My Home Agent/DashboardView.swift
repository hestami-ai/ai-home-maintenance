//
//  DashboardView.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 6/2/25.
//

import SwiftUI
import ARKit
import RoomPlan

struct DashboardView: View {
    // ViewModel for fetching and managing data
    @StateObject private var viewModel = DashboardViewModel()
    
    // Refresh control
    @State private var isRefreshing = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                RefreshControl(isRefreshing: $isRefreshing, coordinateSpace: .named("pullToRefresh")) {
                    viewModel.fetchDashboardData()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        isRefreshing = false
                    }
                }
                VStack(alignment: .leading, spacing: 20) {
                    // Hestami AI Logo at top center
                    HStack {
                        Spacer()
                        Image("hestami-logo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 80, height: 80)
                        Spacer()
                    }
                    .padding(.top, 10)
                    .padding(.bottom, 5)
                    
                    // Properties Section
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("My Properties")
                                .font(AppTheme.titleFont)
                                .foregroundColor(AppTheme.primaryText)
                            
                            Spacer()
                            
                            NavigationLink(destination: PropertiesView()) {
                                Text("View All")
                                    .font(AppTheme.captionFont.bold())
                                    .foregroundColor(AppTheme.buttonBackground)
                            }
                        }
                        
                        if viewModel.isLoadingProperties {
                            // Loading indicator
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonBackground))
                                Spacer()
                            }
                            .padding(.vertical)
                        } else if viewModel.properties.isEmpty {
                            // Empty state
                            HStack {
                                Spacer()
                                VStack(spacing: 8) {
                                    Image(systemName: "house.circle")
                                        .font(.largeTitle)
                                        .foregroundColor(AppTheme.secondaryText)
                                    Text("No properties found")
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                Spacer()
                            }
                            .padding(.vertical)
                        } else {
                            // Properties list
                            ForEach(viewModel.properties) { property in
                                NavigationLink(destination: PropertyDetailView(propertyId: property.id)) {
                                    DashboardPropertyCard(property: property)
                                }
                            }
                        }
                    }
                    .padding()
                    
                    // Service Requests Section
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Recent Service Requests")
                                .font(AppTheme.titleFont)
                                .foregroundColor(AppTheme.primaryText)
                            
                            Spacer()
                            
                            NavigationLink(destination: RequestsView()) {
                                Text("View All")
                                    .font(AppTheme.captionFont.bold())
                                    .foregroundColor(AppTheme.buttonBackground)
                            }
                        }
                        
                        if viewModel.isLoadingRequests {
                            // Loading indicator
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.buttonBackground))
                                Spacer()
                            }
                            .padding(.vertical)
                        } else if viewModel.serviceRequests.isEmpty {
                            // Empty state
                            HStack {
                                Spacer()
                                VStack(spacing: 8) {
                                    Image(systemName: "wrench.and.screwdriver")
                                        .font(.largeTitle)
                                        .foregroundColor(AppTheme.secondaryText)
                                    Text("No service requests found")
                                        .font(AppTheme.bodyFont)
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                                Spacer()
                            }
                            .padding(.vertical)
                        } else {
                            // Service requests list
                            ForEach(viewModel.serviceRequests) { request in
                                NavigationLink(destination: RequestDetailView(request: request)) {
                                    DashboardRequestCard(request: request)
                                }
                            }
                        }
                    }
                    .padding()
                    
                    /* #if DEBUG
                    // Developer Tools
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Developer Tools")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                            .padding(.horizontal)
                        
                        HStack(spacing: 15) {
                            QuickActionButton(icon: "hammer.fill", text: "API Tests", destination: AnyView(PropertyAPITests()))
                        }
                        .padding(.horizontal)
                    }
                    .padding(.top)
                    #endif */
                }
            }
        }
        .navigationTitle("Dashboard")
        .standardToolbar()
        .coordinateSpace(name: "pullToRefresh")
        .alert("Error", isPresented: $viewModel.showError, actions: {
            Button("Retry") {
                viewModel.retryLoading()
            }
            Button("OK", role: .cancel) {}
        }, message: {
            Text(viewModel.errorMessage ?? "An unknown error occurred")
        })
        .onAppear {
            viewModel.fetchDashboardData()
        }
    }
}

// Dashboard Components
struct DashboardPropertyCard: View {
    let property: Property
    
    var body: some View {
        CardView {
            HStack(spacing: 16) {
                // Use featuredImage if available, otherwise show a default icon
                if let featuredImage = property.featuredImage, !featuredImage.isEmpty {
                    AsyncImage(url: URL(string: featuredImage)) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(width: 45, height: 45)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 45, height: 45)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        case .failure:
                            Image(systemName: "house.fill")
                                .font(.title2)
                                .foregroundColor(AppTheme.buttonBackground)
                                .frame(width: 45, height: 45)
                                .background(AppTheme.buttonBackground.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        @unknown default:
                            Image(systemName: "house.fill")
                                .font(.title2)
                                .foregroundColor(AppTheme.buttonBackground)
                                .frame(width: 45, height: 45)
                                .background(AppTheme.buttonBackground.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                } else {
                    Image(systemName: "house.fill")
                        .font(.title2)
                        .foregroundColor(AppTheme.buttonBackground)
                        .frame(width: 45, height: 45)
                        .background(AppTheme.buttonBackground.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(property.title)
                        .font(AppTheme.bodyFont.bold())
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(property.address)
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .lineLimit(1)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundColor(AppTheme.secondaryText)
                    .font(.caption)
            }
        }
    }
}

struct DashboardRequestCard: View {
    let request: ServiceRequest
    
    func getStatusDisplayText(_ status: ServiceRequestStatus) -> String {
        switch status {
        case .PENDING: return "Pending"
        case .IN_PROGRESS: return "In Progress"
        case .COMPLETED: return "Completed"
        case .CANCELLED: return "Cancelled"
        case .DECLINED: return "Declined"
        case .SCHEDULED: return "Scheduled"
        case .BIDDING: return "Bidding"
        case .REOPENED_BIDDING: return "Reopened Bidding"
        case .ACCEPTED: return "Accepted"
        case .IN_RESEARCH: return "In Research"
        case .UNKNOWN: return "Unknown"
        }
    }
    
    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(request.title)
                        .font(AppTheme.bodyFont.bold())
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    UnifiedStatusBadge(
                        text: getStatusDisplayText(request.status),
                        color: request.statusColor
                    )
                }
                
                Text(request.description)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
                
                HStack {
                    Image(systemName: "calendar")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text(request.date, style: .date)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(AppTheme.secondaryText)
                        .font(.caption)
                }
            }
        }
    }
}

struct QuickActionButton: View {
    let icon: String
    let text: String
    let destination: AnyView
    
    var body: some View {
        NavigationLink(destination: destination) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(AppTheme.buttonBackground)
                    .frame(width: 50, height: 50)
                    .background(AppTheme.cardBackground)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(AppTheme.buttonBackground, lineWidth: 2)
                    )
                
                Text(text)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.primaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
        .buttonStyle(SecondaryButtonStyle())
    }
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            DashboardView()
        }
        .preferredColorScheme(.dark)
    }
}
