import SwiftUI

struct RequestsView: View {
    @StateObject private var viewModel = RequestsViewModel()
    @State private var searchText = ""
    @State private var selectedFilter: ServiceRequestStatus? = nil
    @State private var showingCreateRequest = false
    @State private var groupByProperty = false
    
    var filteredRequests: [ServiceRequest] {
        var filtered = viewModel.serviceRequests
        
        if let filter = selectedFilter {
            filtered = filtered.filter { $0.status == filter }
        }
        
        if !searchText.isEmpty {
            filtered = filtered.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.description.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        return filtered
    }
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ServiceRequestsTabView(viewModel: viewModel, searchText: $searchText, selectedFilter: $selectedFilter, filteredRequests: filteredRequests, groupByProperty: $groupByProperty)
        }
        .background(AppTheme.primaryBackground)
        .navigationTitle("Service Requests")
        .standardToolbar()
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    showingCreateRequest = true
                }) {
                    Image(systemName: "plus")
                        .foregroundColor(AppTheme.primaryText)
                        .font(.system(size: 20, weight: .semibold))
                }
            }
        }
        .sheet(isPresented: $showingCreateRequest) {
            CreateServiceRequestView()
        }
        .task {
            await viewModel.loadServiceRequests()
        }
    }
}

struct StatusFilterButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AppTheme.captionFont)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? AppTheme.buttonBackground : Color.clear)
                .foregroundColor(isSelected ? AppTheme.buttonText : AppTheme.secondaryText)
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(isSelected ? AppTheme.buttonBackground : AppTheme.borderColor, lineWidth: 1)
                )
        }
    }
}

struct RequestRowView: View {
    let request: ServiceRequest
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(request.title)
                    .font(.headline)
                    .foregroundColor(AppTheme.primaryText)
                Spacer()
                UnifiedStatusBadge(
                    text: request.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized,
                    color: statusColor(request.status)
                )
            }
            
            Text(request.description)
                .font(.subheadline)
                .foregroundColor(AppTheme.secondaryText)
            
            HStack {
                // Property info if available
                if let propertyDetails = request.propertyDetails {
                    Text(propertyDetails.title)
                        .font(.caption)
                        .foregroundColor(AppTheme.accentColor)
                }
                
                Spacer()
                
                // Date
                Text(request.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            // Priority indicator if urgent or high
            if request.priority == .URGENT || request.priority == .HIGH {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                    Text(request.priority.rawValue.capitalized)
                        .font(.caption)
                    Spacer()
                }
                .foregroundColor(priorityColor(request.priority))
            }
        }
        .padding(.vertical, 4)
    }
    
    // Helper function to get status color
    private func statusColor(_ status: ServiceRequestStatus) -> Color {
        switch status {
        case .PENDING:
            return AppTheme.warningColor
        case .IN_PROGRESS:
            return AppTheme.infoColor
        case .COMPLETED:
            return AppTheme.successColor
        case .CANCELLED, .DECLINED:
            return AppTheme.errorColor
        case .SCHEDULED:
            return Color.blue
        case .BIDDING, .REOPENED_BIDDING:
            return Color.purple
        case .ACCEPTED:
            return Color.green
        case .IN_RESEARCH:
            return Color.orange
        case .UNKNOWN:
            return Color(red: 0.5, green: 0.5, blue: 0.5)
        }
    }
    
    // Helper function to get priority color
    private func priorityColor(_ priority: ServiceRequestPriority) -> Color {
        switch priority {
        case .URGENT:
            return Color.red
        case .HIGH:
            return Color.orange
        case .MEDIUM:
            return Color.yellow
        case .LOW:
            return Color.green
        case .UNKNOWN:
            return Color.gray
        }
    }
}


struct RequestDetailView: View {
    let request: ServiceRequest
    @StateObject private var viewModel = RequestsViewModel()
    @State private var isShowingCancelAlert = false
    @State private var selectedMediaIndex = 0
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Status Header
                    CardView {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(request.title)
                                    .font(AppTheme.titleFont)
                                    .foregroundColor(AppTheme.primaryText)
                                Text(request.createdAt.formatted(date: .long, time: .shortened))
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            Spacer()
                            UnifiedStatusBadge(
                                text: request.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized,
                                color: statusColor(request.status)
                            )
                        }
                    }
                    
                    // Property
                    if let propertyDetails = request.propertyDetails {
                        CardView {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Property")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                Text(propertyDetails.title)
                                    .font(AppTheme.bodyFont)
                                    .foregroundColor(AppTheme.primaryText)
                                
                                Text("\(propertyDetails.address), \(propertyDetails.city), \(propertyDetails.state) \(propertyDetails.zipCode)")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        CardView {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Property")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                Text("Property ID: \(request.property)")
                                    .font(AppTheme.bodyFont)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    
                    // Category and Priority
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Details")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            HStack {
                                Text("Category:")
                                    .foregroundColor(AppTheme.secondaryText)
                                Spacer()
                                Text(request.categoryDisplay ?? request.category)
                                    .foregroundColor(AppTheme.primaryText)
                            }
                            
                            HStack {
                                Text("Priority:")
                                    .foregroundColor(AppTheme.secondaryText)
                                Spacer()
                                Text(request.priority.rawValue.capitalized)
                                    .foregroundColor(priorityColor(request.priority))
                                    .fontWeight(.semibold)
                            }
                            
                            if let provider = request.providerDetails {
                                HStack {
                                    Text("Provider:")
                                        .foregroundColor(AppTheme.secondaryText)
                                    Spacer()
                                    Text(provider.businessName)
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                        }
                    }
                    
                    // Description
                    CardView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            Text(request.description)
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                    // Media Gallery
                    if let mediaDetails = request.mediaDetails, !mediaDetails.isEmpty {
                        CardView {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Media")
                                    .font(AppTheme.bodyFont.bold())
                                    .foregroundColor(AppTheme.primaryText)
                                
                                TabView(selection: $selectedMediaIndex) {
                                    ForEach(0..<mediaDetails.count, id: \.self) { index in
                                        if mediaDetails[index].isImage, let url = URL(string: mediaDetails[index].fileUrl) {
                                            AsyncImage(url: url) { phase in
                                                switch phase {
                                                case .empty:
                                                    ProgressView()
                                                case .success(let image):
                                                    image
                                                        .resizable()
                                                        .aspectRatio(contentMode: .fit)
                                                case .failure:
                                                    Image(systemName: "photo")
                                                        .font(.largeTitle)
                                                        .foregroundColor(AppTheme.secondaryText)
                                                @unknown default:
                                                    EmptyView()
                                                }
                                            }
                                            .tag(index)
                                        } else {
                                            VStack {
                                                Image(systemName: mediaDetails[index].isVideo ? "film" : "doc")
                                                    .font(.largeTitle)
                                                    .foregroundColor(AppTheme.secondaryText)
                                                Text(mediaDetails[index].title)
                                                    .font(.caption)
                                                    .foregroundColor(AppTheme.secondaryText)
                                            }
                                            .tag(index)
                                        }
                                    }
                                }
                                .tabViewStyle(PageTabViewStyle())
                                .frame(height: 200)
                                .cornerRadius(12)
                            }
                        }
                    }
                    
                    // Dates
                    CardView {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Schedule")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            
                            HStack {
                                Text("Created:")
                                    .foregroundColor(AppTheme.secondaryText)
                                Spacer()
                                Text(request.createdAt.formatted(date: .long, time: .shortened))
                                    .foregroundColor(AppTheme.primaryText)
                            }
                            
                            if let scheduledStart = request.scheduledStart {
                                HStack {
                                    Text("Scheduled Start:")
                                        .foregroundColor(AppTheme.secondaryText)
                                    Spacer()
                                    Text(scheduledStart.formatted(date: .long, time: .shortened))
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                            
                            if let scheduledEnd = request.scheduledEnd {
                                HStack {
                                    Text("Scheduled End:")
                                        .foregroundColor(AppTheme.secondaryText)
                                    Spacer()
                                    Text(scheduledEnd.formatted(date: .long, time: .shortened))
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                            
                            if let actualStart = request.actualStart {
                                HStack {
                                    Text("Actual Start:")
                                        .foregroundColor(AppTheme.secondaryText)
                                    Spacer()
                                    Text(actualStart.formatted(date: .long, time: .shortened))
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                            
                            if let actualEnd = request.actualEnd {
                                HStack {
                                    Text("Actual End:")
                                        .foregroundColor(AppTheme.secondaryText)
                                    Spacer()
                                    Text(actualEnd.formatted(date: .long, time: .shortened))
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                        }
                    }
                    
                    // Actions
                    if request.status == .PENDING || request.status == .IN_PROGRESS || request.status == .SCHEDULED {
                        Button(action: {
                            isShowingCancelAlert = true
                        }) {
                            Text("Cancel Request")
                        }
                        .buttonStyle(DestructiveButtonStyle())
                        .padding(.top, 10)
                        .alert("Cancel Service Request", isPresented: $isShowingCancelAlert) {
                            Button("Cancel Request", role: .destructive) {
                                Task {
                                    try? await viewModel.cancelServiceRequest(requestId: request.id)
                                }
                            }
                        } message: {
                            Text("Are you sure you want to cancel this service request? This action cannot be undone.")
                        }
                    }
                }
                .padding()
            }
        }
        .standardToolbar(displayMode: .inline)
    }
    
    // Helper function to get status color
    private func statusColor(_ status: ServiceRequestStatus) -> Color {
        switch status {
        case .PENDING:
            return AppTheme.warningColor
        case .IN_PROGRESS:
            return AppTheme.infoColor
        case .COMPLETED:
            return AppTheme.successColor
        case .CANCELLED, .DECLINED:
            return AppTheme.errorColor
        case .SCHEDULED:
            return Color.blue
        case .BIDDING, .REOPENED_BIDDING:
            return Color.purple
        case .ACCEPTED:
            return Color.green
        case .IN_RESEARCH:
            return Color.orange
        case .UNKNOWN:
            return Color(red: 0.5, green: 0.5, blue: 0.5)
        }
    }
    
    // Helper function to get priority color
    private func priorityColor(_ priority: ServiceRequestPriority) -> Color {
        switch priority {
        case .URGENT:
            return Color.red
        case .HIGH:
            return Color.orange
        case .MEDIUM:
            return Color.yellow
        case .LOW:
            return Color.green
        case .UNKNOWN:
            return Color.gray
        }
    }
}

struct PropertyHeaderView: View {
    let property: PropertySummary?
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(property?.title ?? "Unknown Property")
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                if let property = property {
                    Text("\(property.address), \(property.city), \(property.state)")
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(AppTheme.secondaryText)
                .padding()
                .background(Circle().fill(AppTheme.cardBackground))
                .overlay(
                    Circle()
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
                .padding()
            
            Text("No Service Requests Found")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Your service requests will appear here")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// Service Requests Tab View
struct ServiceRequestsTabView: View {
    @ObservedObject var viewModel: RequestsViewModel
    @Binding var searchText: String
    @Binding var selectedFilter: ServiceRequestStatus?
    let filteredRequests: [ServiceRequest]
    @Binding var groupByProperty: Bool
    
    var groupedRequests: [(property: PropertySummary?, requests: [ServiceRequest])] {
        let grouped = Dictionary(grouping: filteredRequests) { request -> String in
            return request.property
        }
        
        return grouped.map { (propertyId, requests) -> (PropertySummary?, [ServiceRequest]) in
            let propertySummary = requests.first?.propertyDetails
            return (propertySummary, requests.sorted { $0.createdAt > $1.createdAt })
        }.sorted { (first, second) -> Bool in
            if let firstTitle = first.property?.title, let secondTitle = second.property?.title {
                return firstTitle < secondTitle
            } else if first.property != nil {
                return true
            } else {
                return false
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search Bar
            SharedSearchBar(text: $searchText)
                .padding()
            
            // Status Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    StatusFilterButton(title: "All",
                                     isSelected: selectedFilter == nil,
                                     action: { selectedFilter = nil })
                    
                    // Common status filters
                    let commonStatuses: [ServiceRequestStatus] = [
                        .PENDING, .IN_PROGRESS, .SCHEDULED, .COMPLETED, .CANCELLED
                    ]
                    
                    ForEach(commonStatuses, id: \.self) { status in
                        StatusFilterButton(
                            title: status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized,
                            isSelected: selectedFilter == status,
                            action: { selectedFilter = status }
                        )
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical, 8)
            .background(AppTheme.cardBackground.opacity(0.3))
            
            // Group by Property Toggle
            HStack {
                Text("Group by Property")
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.primaryText)
                Spacer()
                Toggle("", isOn: $groupByProperty)
                    .labelsHidden()
                    .tint(AppTheme.accentColor)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(AppTheme.cardBackground.opacity(0.3))
            
            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage = viewModel.errorMessage {
                VStack(spacing: 20) {
                    Text("Error loading requests")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(errorMessage)
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    Button("Retry") {
                        Task {
                            await viewModel.loadServiceRequests()
                        }
                    }
                    .padding()
                    .background(AppTheme.buttonBackground)
                    .foregroundColor(AppTheme.buttonText)
                    .cornerRadius(10)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredRequests.isEmpty {
                UnifiedEmptyStateView(
                    icon: "doc.text.magnifyingglass",
                    title: "No Service Requests Found",
                    message: "Your service requests will appear here"
                )
            } else {
                if groupByProperty {
                    // Grouped by property view
                    List {
                        ForEach(groupedRequests.indices, id: \.self) { index in
                            let group = groupedRequests[index]
                            Section(header: PropertyHeaderView(property: group.property)) {
                                ForEach(group.requests) { request in
                                    NavigationLink(destination: RequestDetailView(request: request)) {
                                        RequestRowView(request: request)
                                    }
                                    .listRowBackground(AppTheme.cardBackground)
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                } else {
                    // Standard list view
                    List {
                        ForEach(filteredRequests) { request in
                            NavigationLink(destination: RequestDetailView(request: request)) {
                                RequestRowView(request: request)
                            }
                            .listRowBackground(AppTheme.cardBackground)
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
        }
    }
}

// AI Handyman View is now in its own file: Views/AIHandymanView.swift

struct RequestsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            RequestsView()
        }
    }
}