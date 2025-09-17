import SwiftUI

struct RequestsView: View {
    @StateObject private var viewModel = RequestsViewModel()
    @State private var searchText = ""
    @State private var selectedFilter: ServiceRequestStatus? = nil
    @State private var selectedTab = 0
    
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
            
            VStack(spacing: 0) {
                TabView(selection: $selectedTab) {
                    // Service Requests Tab
                    ServiceRequestsTabView(viewModel: viewModel, searchText: $searchText, selectedFilter: $selectedFilter, filteredRequests: filteredRequests)
                        .tabItem {
                            Label("Service Requests", systemImage: "wrench.and.screwdriver")
                        }
                        .tag(0)
                        .background(AppTheme.primaryBackground)
                    
                    // AI Handyman Tab
                    AIHandymanView()
                        .tabItem {
                            Label("Ask My AI Handyman", systemImage: "person.fill.questionmark")
                        }
                        .tag(1)
                        .background(AppTheme.primaryBackground)
                }
                .background(AppTheme.primaryBackground)
                .accentColor(AppTheme.accentColor)
            }
        }
        .background(AppTheme.primaryBackground)
        .navigationTitle(selectedTab == 0 ? "Service Requests" : "Ask My AI Handyman")
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
                SharedStatusBadge(
                    statusColor: statusColor(request.status), 
                    text: request.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized
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
                        SharedStatusBadge(
                            statusColor: statusColor(request.status), 
                            text: request.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized
                        )
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Property
                    if let propertyDetails = request.propertyDetails {
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
                        .padding()
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(AppTheme.borderColor, lineWidth: 1)
                        )
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Property")
                                .font(AppTheme.bodyFont.bold())
                                .foregroundColor(AppTheme.primaryText)
                            Text("Property ID: \(request.property)")
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        .padding()
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(AppTheme.borderColor, lineWidth: 1)
                        )
                    }
                    
                    // Category and Priority
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
                                Text(provider.companyName)
                                    .foregroundColor(AppTheme.primaryText)
                            }
                        }
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(AppTheme.bodyFont.bold())
                            .foregroundColor(AppTheme.primaryText)
                        Text(request.description)
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Media Gallery
                    if let mediaDetails = request.mediaDetails, !mediaDetails.isEmpty {
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
                        .padding()
                        .background(AppTheme.cardBackground)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(AppTheme.borderColor, lineWidth: 1)
                        )
                    }
                    
                    // Dates
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
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
                    
                    // Actions
                    if request.status == .PENDING || request.status == .IN_PROGRESS || request.status == .SCHEDULED {
                        Button(action: {
                            isShowingCancelAlert = true
                        }) {
                            HStack {
                                Spacer()
                                Text("Cancel Request")
                                    .font(AppTheme.bodyFont.bold())
                                Spacer()
                            }
                            .padding()
                            .background(AppTheme.errorColor.opacity(0.8))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .padding(.top, 10)
                        .alert("Cancel Service Request", isPresented: $isShowingCancelAlert) {
                            Button("Cancel Request", role: .destructive) {
                                Task {
                                    try? await viewModel.cancelServiceRequest(requestId: request.id)
                                }
                            }
                            Button("Keep Request", role: .cancel) {}
                        } message: {
                            Text("Are you sure you want to cancel this service request? This action cannot be undone.")
                        }
                    }
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
                EmptyStateView()
            } else {
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

// AI Handyman View
struct AIHandymanView: View {
    @State private var userQuestion = ""
    @State private var chatMessages: [ChatMessage] = []
    @State private var isLoading = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Chat messages area
            ScrollView {
                LazyVStack(spacing: AppTheme.standardPadding) {
                    ForEach(chatMessages) { message in
                        ChatBubbleView(message: message)
                    }
                    
                    if isLoading {
                        HStack {
                            Spacer()
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                                .scaleEffect(1.2)
                            Spacer()
                        }
                        .padding(.vertical, AppTheme.smallPadding)
                    }
                }
                .padding()
            }
            .background(AppTheme.primaryBackground)
            
            // Empty state if no messages
            if chatMessages.isEmpty && !isLoading {
                VStack(spacing: AppTheme.standardPadding + 4) {
                    Image(systemName: "person.fill.questionmark")
                        .font(.system(size: 60))
                        .foregroundColor(AppTheme.accentColor)
                        .padding(AppTheme.standardPadding)
                        .background(Circle().fill(AppTheme.cardBackground))
                        .overlay(
                            Circle()
                                .stroke(AppTheme.borderColor, lineWidth: 1)
                        )
                    
                    Text("Ask My AI Handyman")
                        .font(AppTheme.titleFont)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("Get instant answers to your home maintenance questions or request assistance with your property needs.")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, AppTheme.standardPadding * 2.5)
                }
                .padding(AppTheme.standardPadding)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            
            // Input area
            HStack(spacing: AppTheme.smallPadding * 1.5) {
                TextField("Ask a question...", text: $userQuestion)
                    .disableInputAssistant()
                    .padding(AppTheme.smallPadding * 1.5)
                    .background(AppTheme.inputBackground)
                    .cornerRadius(AppTheme.cornerRadius * 2)
                    .foregroundColor(AppTheme.textPrimary)
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 20))
                        .foregroundColor(AppTheme.buttonText)
                        .padding(AppTheme.smallPadding + 2)
                        .background(AppTheme.accentColor)
                        .clipShape(Circle())
                }
                .disabled(userQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                .opacity(userQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading ? 0.5 : 1.0)
            }
            .padding(.horizontal, AppTheme.standardPadding)
            .padding(.vertical, AppTheme.smallPadding + 2)
            .background(AppTheme.cardBackground)
        }
    }
    
    private func sendMessage() {
        guard !userQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        let userMessage = ChatMessage(id: UUID().uuidString, content: userQuestion, isFromUser: true, timestamp: Date())
        chatMessages.append(userMessage)
        
        userQuestion = ""
        isLoading = true
        
        // Simulate AI response after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            let responses = [
                "I'd recommend checking if the circuit breaker has tripped first. That's the most common cause of sudden power outages in specific areas of your home.",
                "For a leaky faucet, you'll typically need to replace the washer. It's a simple fix that requires a wrench and a replacement washer that matches your faucet model.",
                "The clicking sound from your furnace could be the igniter trying to light. If it continues without the furnace starting, you might have a faulty igniter or gas supply issue.",
                "To improve your home's energy efficiency, start by checking for drafts around windows and doors. Weather stripping is an inexpensive solution that can make a big difference.",
                "For that type of stain on your carpet, try a mixture of white vinegar and baking soda. Apply it to the stain, let it sit for 15 minutes, then blot it up with a clean cloth."
            ]
            
            let aiResponse = ChatMessage(
                id: UUID().uuidString,
                content: responses.randomElement() ?? "I can help you with that. Would you like me to schedule a service request for you?",
                isFromUser: false,
                timestamp: Date()
            )
            
            chatMessages.append(aiResponse)
            isLoading = false
        }
    }
}

struct ChatMessage: Identifiable {
    let id: String
    let content: String
    let isFromUser: Bool
    let timestamp: Date
}

struct ChatBubbleView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer()
            }
            
            Text(message.content)
                .padding(AppTheme.smallPadding * 1.5)
                .background(message.isFromUser ? AppTheme.accentColor : AppTheme.cardBackground)
                .foregroundColor(message.isFromUser ? AppTheme.buttonText : AppTheme.primaryText)
                .cornerRadius(AppTheme.cornerRadius * 1.6)
                .overlay(
                    RoundedRectangle(cornerRadius: AppTheme.cornerRadius * 1.6)
                        .stroke(message.isFromUser ? AppTheme.accentColor : AppTheme.borderColor, lineWidth: 1)
                )
                .frame(maxWidth: 280, alignment: message.isFromUser ? .trailing : .leading)
            
            if !message.isFromUser {
                Spacer()
            }
        }
    }
}

struct RequestsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            RequestsView()
        }
    }
}