import SwiftUI

struct AIHandymanView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var userInput = ""
    @State private var showConversationList = false
    @State private var showDeleteConfirmation = false
    @State private var conversationToDelete: String?
    
    // File picker states
    @State private var showPhotoPicker = false
    @State private var showDocumentPicker = false
    @State private var showCameraPicker = false
    @State private var showFileActionSheet = false
    
    var body: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                // Header with conversation selector
                conversationHeader
                
                // Main content
                if viewModel.isLoadingConversations {
                    loadingView
                } else if !viewModel.hasConversations && !viewModel.hasMessages {
                    emptyStateView
                } else {
                    chatContentView
                }
                
                // Input area
                messageInputView
            }
        }
        .sheet(isPresented: $showConversationList) {
            conversationListSheet
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoPicker(isPresented: $showPhotoPicker) { files in
                handleSelectedFiles(files)
            }
        }
        .sheet(isPresented: $showDocumentPicker) {
            DocumentPicker(isPresented: $showDocumentPicker) { files in
                handleSelectedFiles(files)
            }
        }
        .sheet(isPresented: $showCameraPicker) {
            CameraPicker(isPresented: $showCameraPicker) { file in
                handleSelectedFiles([file])
            }
        }
        .confirmationDialog("Add Attachment", isPresented: $showFileActionSheet) {
            Button("Take Photo") {
                showCameraPicker = true
            }
            Button("Photo Library") {
                showPhotoPicker = true
            }
            Button("Browse Files") {
                showDocumentPicker = true
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {
                viewModel.showError = false
            }
        } message: {
            Text(viewModel.error ?? "An error occurred")
        }
        .alert("Delete Conversation", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {
                conversationToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let id = conversationToDelete {
                    Task {
                        await viewModel.deleteConversation(id)
                    }
                }
                conversationToDelete = nil
            }
        } message: {
            Text("Are you sure you want to delete this conversation? This action cannot be undone.")
        }
        .onAppear {
            Task {
                await viewModel.loadConversations()
            }
        }
    }
    
    // MARK: - Header
    
    private var conversationHeader: some View {
        HStack {
            // Conversation selector button
            Button(action: {
                showConversationList = true
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.title3)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(viewModel.selectedConversation?.title ?? "New Conversation")
                            .font(AppTheme.bodyFont.bold())
                            .lineLimit(1)
                        
                        if viewModel.hasConversations {
                            Text("\(viewModel.conversations.count) conversation\(viewModel.conversations.count == 1 ? "" : "s")")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .foregroundColor(AppTheme.primaryText)
                .padding()
                .background(AppTheme.cardBackground)
            }
            
            // New conversation button
            Button(action: {
                viewModel.createNewConversation()
            }) {
                Image(systemName: "square.and.pencil")
                    .font(.title3)
                    .foregroundColor(AppTheme.accentPrimary)
                    .padding()
                    .background(AppTheme.cardBackground)
                    .cornerRadius(8)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(AppTheme.primaryBackground)
    }
    
    // MARK: - Chat Content
    
    private var chatContentView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.messages) { message in
                        ChatMessageBubble(message: message)
                            .id(message.id)
                    }
                    
                    // Loading indicator while sending
                    if viewModel.isSendingMessage {
                        HStack {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                            Text("Thinking...")
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                        .padding()
                    }
                }
                .padding()
            }
            .onChange(of: viewModel.messages.count) { oldValue, newValue in
                // Auto-scroll to bottom when new message arrives
                if let lastMessage = viewModel.messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }
    
    // MARK: - Empty State
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.fill.questionmark")
                .font(.system(size: 60))
                .foregroundColor(AppTheme.accentPrimary)
                .padding()
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
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Loading View
    
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentPrimary))
                .scaleEffect(1.5)
            
            Text("Loading conversations...")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Message Input
    
    private var messageInputView: some View {
        VStack(spacing: 8) {
            // Pending files preview
            if !viewModel.pendingFiles.isEmpty {
                pendingFilesView
            }
            
            HStack(spacing: 12) {
                // Attachment button
                Button(action: {
                    showFileActionSheet = true
                }) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 20))
                        .foregroundColor(AppTheme.accentPrimary)
                        .padding(12)
                }
                .disabled(viewModel.isSendingMessage)
                
                TextField("Ask a question...", text: $userInput, axis: .vertical)
                    .disableInputAssistant()
                    .padding(12)
                    .background(AppTheme.inputBackground)
                    .cornerRadius(20)
                    .foregroundColor(AppTheme.textPrimary)
                    .lineLimit(1...5)
                
                Button(action: {
                    Task {
                        let message = userInput
                        userInput = ""
                        await viewModel.sendMessage(message)
                    }
                }) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 20))
                        .foregroundColor(AppTheme.buttonText)
                        .padding(12)
                        .background(
                            Circle()
                                .fill(canSendMessage
                                      ? AppTheme.accentPrimary
                                      : AppTheme.secondaryBackground)
                        )
                }
                .disabled(!canSendMessage)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(AppTheme.cardBackground)
    }
    
    private var canSendMessage: Bool {
        let hasText = !userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasFiles = !viewModel.pendingFiles.isEmpty
        return (hasText || hasFiles) && !viewModel.isSendingMessage
    }
    
    // MARK: - Pending Files View
    
    private var pendingFilesView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Attachments (\(viewModel.pendingFiles.count))")
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
                .padding(.horizontal)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(viewModel.pendingFiles) { file in
                        PendingFileCard(file: file) {
                            viewModel.removePendingFile(file)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 4)
            }
            .frame(height: 100)
        }
        .padding(.top, 8)
        .background(AppTheme.primaryBackground)
    }
    
    // MARK: - Conversation List Sheet
    
    private var conversationListSheet: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                if viewModel.conversations.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 50))
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Text("No Conversations Yet")
                            .font(AppTheme.titleFont)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Start a new conversation to get help from your AI Handyman")
                            .font(AppTheme.bodyFont)
                            .foregroundColor(AppTheme.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                } else {
                    List {
                        ForEach(viewModel.conversations) { conversation in
                            Button(action: {
                                Task {
                                    await viewModel.selectConversation(conversation.conversationId)
                                    showConversationList = false
                                }
                            }) {
                                ConversationRow(
                                    conversation: conversation,
                                    isSelected: conversation.conversationId == viewModel.selectedConversationId
                                )
                            }
                            .listRowBackground(AppTheme.cardBackground)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    conversationToDelete = conversation.conversationId
                                    showDeleteConfirmation = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Conversations")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(AppTheme.primaryBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        showConversationList = false
                    }
                    .foregroundColor(AppTheme.accentPrimary)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        viewModel.createNewConversation()
                        showConversationList = false
                    }) {
                        Image(systemName: "square.and.pencil")
                            .foregroundColor(AppTheme.accentPrimary)
                    }
                }
            }
        }
    }
    
    // MARK: - File Handling
    
    private func handleSelectedFiles(_ files: [SelectedFile]) {
        print("🎯 AIHandymanView received \(files.count) files")
        for file in files {
            print("🎯 Adding file to pending: \(file.filename)")
            viewModel.addPendingFile(
                fileData: file.data,
                filename: file.filename,
                mimeType: file.mimeType,
                thumbnail: file.thumbnail
            )
        }
        print("🎯 Total pending files now: \(viewModel.pendingFiles.count)")
    }
}

// MARK: - Pending File Card

struct PendingFileCard: View {
    let file: PendingFileUpload
    let onRemove: () -> Void
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 4) {
                // Thumbnail or icon
                ZStack {
                    if let thumbnail = file.thumbnail {
                        Image(uiImage: thumbnail)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 80, height: 80)
                            .clipped()
                            .cornerRadius(8)
                    } else {
                        Image(systemName: fileIcon(for: file.fileExtension))
                            .font(.system(size: 32))
                            .foregroundColor(AppTheme.accentPrimary)
                            .frame(width: 80, height: 80)
                            .background(AppTheme.cardBackground)
                            .cornerRadius(8)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
                
                // Filename
                Text(file.filename)
                    .font(.caption2)
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(1)
                    .frame(width: 80)
            }
            .opacity(file.isUploading ? 0.6 : 1.0)
            .overlay {
                if file.isUploading {
                    ZStack {
                        Color.black.opacity(0.3)
                            .cornerRadius(8)
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    .frame(width: 80, height: 80)
                }
            }
            
            // Remove button
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.white)
                    .background(Circle().fill(Color.red))
            }
            .offset(x: 10, y: -10)
            
            // Error indicator
            if file.error != nil {
                VStack {
                    Spacer()
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2)
                        Text("Failed")
                            .font(.caption2)
                    }
                    .foregroundColor(.white)
                    .padding(4)
                    .background(Color.red)
                    .cornerRadius(4)
                }
                .frame(width: 80, height: 80)
            }
        }
        .frame(width: 90, height: 110)
    }
    
    private func fileIcon(for ext: String) -> String {
        switch ext.lowercased() {
        case "pdf": return "doc.fill"
        case "txt", "md": return "doc.text.fill"
        case "doc", "docx": return "doc.richtext.fill"
        case "mp4", "mov": return "video.fill"
        default: return "doc.fill"
        }
    }
}

// MARK: - Chat Message Bubble

struct ChatMessageBubble: View {
    let message: LibreChatMessage
    @State private var selectedImageURL: IdentifiableURL?
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.isFromUser {
                Spacer(minLength: 60)
            }
            
            VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 8) {
                // Display images for user messages (above text)
                if message.isFromUser {
                    fileAttachmentsView
                }
                
                // Message bubble with markdown support for AI responses
                if !message.displayText.isEmpty {
                    Group {
                        if message.isFromUser {
                            // User messages: plain text
                            Text(message.displayText)
                                .font(AppTheme.bodyFont)
                                .foregroundColor(AppTheme.buttonText)
                        } else {
                            // AI messages: markdown rendering
                            MarkdownText(
                                message.displayText,
                                textColor: AppTheme.primaryText,
                                font: AppTheme.bodyFont
                            )
                        }
                    }
                    .padding(12)
                    .background(
                        message.isFromUser
                        ? AppTheme.accentPrimary
                        : AppTheme.cardBackground
                    )
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                message.isFromUser ? Color.clear : AppTheme.borderColor,
                                lineWidth: 1
                            )
                    )
                }
                
                // Display images for assistant messages (below text)
                if !message.isFromUser {
                    fileAttachmentsView
                }
                
                // Timestamp
                if let timestamp = message.timestamp {
                    Text(formatTimestamp(timestamp))
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                        .padding(.horizontal, 4)
                }
            }
            
            if !message.isFromUser {
                Spacer(minLength: 60)
            }
        }
        .sheet(item: $selectedImageURL) { identifiableURL in
            FullScreenImageViewer(imageURL: identifiableURL.url, isPresented: $selectedImageURL)
        }
    }
    
    @ViewBuilder
    private var fileAttachmentsView: some View {
        if let files = message.files, !files.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 8) {
                ForEach(files, id: \.file_id) { file in
                    if file.isImage, let url = file.displayURL(baseURL: AppConfiguration.apiBaseURL) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                                    .frame(width: 150, height: 150)
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(maxWidth: 200, maxHeight: 150)
                                    .clipped()
                                    .cornerRadius(8)
                            case .failure:
                                Image(systemName: "photo")
                                    .font(.system(size: 40))
                                    .foregroundColor(AppTheme.secondaryText)
                                    .frame(width: 150, height: 150)
                                    .background(AppTheme.inputBackground)
                                    .cornerRadius(8)
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .onTapGesture {
                            selectedImageURL = IdentifiableURL(url: url)
                        }
                    } else {
                        // Non-image file attachment
                        HStack(spacing: 8) {
                            Image(systemName: "doc.fill")
                                .foregroundColor(AppTheme.accentPrimary)
                            Text(file.filename)
                                .font(AppTheme.captionFont)
                                .foregroundColor(AppTheme.primaryText)
                                .lineLimit(1)
                        }
                        .padding(8)
                        .background(AppTheme.inputBackground)
                        .cornerRadius(8)
                    }
                }
            }
        }
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        
        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday " + date.formatted(date: .omitted, time: .shortened)
        } else {
            formatter.dateFormat = "MMM d, h:mm a"
        }
        
        return formatter.string(from: date)
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let conversation: Conversation
    let isSelected: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(conversation.title)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(2)
                
                if let updatedDate = conversation.updatedDate {
                    Text(formatDate(updatedDate))
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(AppTheme.accentPrimary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct AIHandymanView_Previews: PreviewProvider {
    static var previews: some View {
        AIHandymanView()
            .preferredColorScheme(.dark)
    }
}
