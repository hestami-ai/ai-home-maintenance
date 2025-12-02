import Foundation
import SwiftUI
import OSLog

@MainActor
class ChatViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published var conversations: [Conversation] = []
    @Published var selectedConversationId: String?
    @Published var messages: [LibreChatMessage] = []
    @Published var isLoadingConversations = false
    @Published var isLoadingMessages = false
    @Published var isSendingMessage = false
    @Published var error: String?
    @Published var showError = false
    
    // File upload properties
    @Published var pendingFiles: [PendingFileUpload] = []
    @Published var isUploadingFiles = false
    
    private let chatService = ChatService.shared
    private let fileUploader = ChatFileUploader.shared
    private var hasLoadedConversations = false
    
    // MARK: - Computed Properties
    
    var selectedConversation: Conversation? {
        conversations.first { $0.conversationId == selectedConversationId }
    }
    
    var hasConversations: Bool {
        !conversations.isEmpty
    }
    
    var hasMessages: Bool {
        !messages.isEmpty
    }
    
    // MARK: - Initialization
    
    init() {
        AppLogger.app.debug("ChatViewModel: Initialized")
    }
    
    // MARK: - Load Conversations
    
    func loadConversations() async {
        // Prevent duplicate concurrent loading
        guard !isLoadingConversations else {
            AppLogger.app.warning("Already loading conversations, skipping duplicate call")
            return
        }
        
        AppLogger.app.info("Loading conversations")
        isLoadingConversations = true
        error = nil
        
        do {
            conversations = try await chatService.fetchConversations()
            hasLoadedConversations = true
            AppLogger.app.info("Loaded \(self.conversations.count, privacy: .public) conversations")
            
            // Auto-select first conversation if available and none selected
            if selectedConversationId == nil, let firstConversation = conversations.first {
                await selectConversation(firstConversation.conversationId)
            }
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                AppLogger.app.debug("Conversation loading cancelled")
                isLoadingConversations = false
                return
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                AppLogger.app.debug("Conversation loading cancelled (NSError)")
                isLoadingConversations = false
                return
            }
            
            AppLogger.error("Failed to load conversations", error: error, category: AppLogger.app)
            self.error = "Failed to load conversations: \(error.localizedDescription)"
            showError = true
        }
        
        isLoadingConversations = false
    }
    
    // MARK: - Select Conversation
    
    func selectConversation(_ conversationId: String) async {
        AppLogger.app.debug("Selecting conversation: \(conversationId, privacy: .public)")
        selectedConversationId = conversationId
        await loadMessages(for: conversationId)
    }
    
    // MARK: - Load Messages
    
    func loadMessages(for conversationId: String) async {
        AppLogger.app.info("Loading messages for: \(conversationId, privacy: .public)")
        isLoadingMessages = true
        error = nil
        
        do {
            messages = try await chatService.fetchMessages(conversationId: conversationId)
            AppLogger.app.info("Loaded \(self.messages.count, privacy: .public) messages")
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                AppLogger.app.debug("Message loading cancelled")
                return
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                AppLogger.app.debug("Message loading cancelled (NSError)")
                return
            }
            
            AppLogger.error("Failed to load messages", error: error, category: AppLogger.app)
            self.error = "Failed to load messages: \(error.localizedDescription)"
            showError = true
            messages = []
        }
        
        isLoadingMessages = false
    }
    
    // MARK: - Send Message
    
    func sendMessage(_ text: String) async {
        // Allow empty text if there are files attached
        let hasContent = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !pendingFiles.isEmpty
        guard hasContent else {
            AppLogger.app.warning("Cannot send empty message without attachments")
            return
        }
        
        AppLogger.app.info("Sending message")
        isSendingMessage = true
        error = nil
        
        // Upload any pending files first
        await uploadPendingFiles()
        
        // Check if any uploads failed
        if pendingFiles.contains(where: { $0.error != nil }) {
            self.error = "Some files failed to upload. Please remove them and try again."
            showError = true
            isSendingMessage = false
            return
        }
        
        // Get uploaded files
        let uploadedFiles = pendingFiles.compactMap { $0.uploadedFile }
        
        do {
            let response = try await chatService.sendMessage(
                text: text,
                conversationId: selectedConversationId,
                uploadedFiles: uploadedFiles
            )
            
            // Add user message if provided
            if let requestMessage = response.requestMessage {
                messages.append(requestMessage)
            }
            
            // Add AI response if provided
            if let responseMessage = response.responseMessage {
                messages.append(responseMessage)
            }
            
            // Handle new conversation creation
            if let conversation = response.conversation {
                let newConversationId = conversation.conversationId
                
                // If this was a new conversation, add it to the list
                if selectedConversationId == nil {
                    selectedConversationId = newConversationId
                    
                    let title = response.title ?? text.prefix(50).description
                    let newConversation = Conversation(
                        conversationId: newConversationId,
                        title: title,
                        updatedAt: ISO8601DateFormatter().string(from: Date()),
                        endpoint: "google",
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    )
                    
                    conversations.insert(newConversation, at: 0)
                    AppLogger.app.info("Created new conversation: \(newConversationId, privacy: .public)")
                }
            }
            
            AppLogger.app.info("Message sent successfully")
            
            // Clear pending files after successful send
            pendingFiles.removeAll()
        } catch {
            AppLogger.error("Failed to send message", error: error, category: AppLogger.app)
            self.error = "Failed to send message: \(error.localizedDescription)"
            showError = true
        }
        
        isSendingMessage = false
    }
    
    // MARK: - Create New Conversation
    
    func createNewConversation() {
        AppLogger.app.debug("Creating new conversation")
        selectedConversationId = nil
        messages = []
        error = nil
    }
    
    // MARK: - Delete Conversation
    
    func deleteConversation(_ conversationId: String) async {
        AppLogger.app.info("Deleting conversation: \(conversationId, privacy: .public)")
        
        do {
            try await chatService.deleteConversation(conversationId: conversationId)
            
            // Remove from local list
            conversations.removeAll { $0.conversationId == conversationId }
            
            // If this was the selected conversation, clear selection
            if selectedConversationId == conversationId {
                selectedConversationId = nil
                messages = []
                
                // Auto-select first conversation if available
                if let firstConversation = conversations.first {
                    await selectConversation(firstConversation.conversationId)
                }
            }
            
            AppLogger.app.info("Conversation deleted")
        } catch {
            AppLogger.error("Failed to delete conversation", error: error, category: AppLogger.app)
            self.error = "Failed to delete conversation: \(error.localizedDescription)"
            showError = true
        }
    }
    
    // MARK: - Update Conversation Title
    
    func updateConversationTitle(_ conversationId: String, title: String) async {
        AppLogger.app.info("Updating conversation title")
        
        do {
            try await chatService.updateConversation(conversationId: conversationId, title: title)
            
            // Reload conversations to get updated data
            await loadConversations()
            
            AppLogger.app.info("Conversation title updated")
        } catch {
            AppLogger.error("Failed to update conversation", error: error, category: AppLogger.app)
            self.error = "Failed to update conversation: \(error.localizedDescription)"
            showError = true
        }
    }
    
    // MARK: - Refresh
    
    func refresh() async {
        hasLoadedConversations = false
        await loadConversations()
    }
    
    // MARK: - File Upload Management
    
    /// Add a file to the pending upload queue
    func addPendingFile(fileData: Data, filename: String, mimeType: String, thumbnail: UIImage? = nil) {
        let fileExtension = (filename as NSString).pathExtension
        
        print("📦 ChatViewModel.addPendingFile called for: \(filename)")
        print("📦 File size: \(fileData.count) bytes, extension: \(fileExtension)")
        
        // Validate file extension
        guard FileUploadConstants.isAllowedExtension(fileExtension) else {
            print("❌ File extension '\(fileExtension)' not allowed")
            self.error = "File type '\(fileExtension)' is not supported"
            showError = true
            return
        }
        
        // Validate file size
        guard fileData.count <= FileUploadConstants.maxFileSize else {
            print("❌ File too large: \(fileData.count) bytes")
            self.error = "File is too large. Maximum size is 100MB"
            showError = true
            return
        }
        
        let pendingFile = PendingFileUpload(
            filename: filename,
            fileData: fileData,
            mimeType: mimeType,
            fileExtension: fileExtension,
            thumbnail: thumbnail
        )
        
        pendingFiles.append(pendingFile)
        print("✅ File added to pending list. Total pending: \(pendingFiles.count)")
        AppLogger.app.info("Added pending file: \(filename, privacy: .public)")
    }
    
    /// Remove a pending file
    func removePendingFile(_ file: PendingFileUpload) {
        pendingFiles.removeAll { $0.id == file.id }
        AppLogger.app.info("Removed pending file: \(file.filename, privacy: .public)")
    }
    
    /// Upload all pending files that haven't been uploaded yet
    private func uploadPendingFiles() async {
        guard !pendingFiles.isEmpty else { return }
        
        isUploadingFiles = true
        
        for index in pendingFiles.indices {
            // Skip files that are already uploaded or currently uploading
            guard pendingFiles[index].uploadedFile == nil,
                  !pendingFiles[index].isUploading else {
                continue
            }
            
            // Mark as uploading
            pendingFiles[index].isUploading = true
            pendingFiles[index].error = nil
            
            do {
                let file = pendingFiles[index]
                
                // Extract dimensions for images
                var width: Int?
                var height: Int?
                
                if file.isImage {
                    if let dimensions = file.fileData.getImageDimensions() {
                        width = dimensions.width
                        height = dimensions.height
                    } else {
                        throw FileUploadError.imageProcessingFailed
                    }
                }
                
                // Upload the file
                let uploadedFile = try await fileUploader.uploadFile(
                    fileData: file.fileData,
                    filename: file.filename,
                    mimeType: file.mimeType,
                    width: width,
                    height: height
                )
                
                // Update with uploaded file info
                pendingFiles[index].uploadedFile = uploadedFile
                pendingFiles[index].isUploading = false
                pendingFiles[index].uploadProgress = 1.0
                
                AppLogger.app.info("Successfully uploaded: \(file.filename, privacy: .public)")
            } catch {
                // Mark upload as failed
                pendingFiles[index].isUploading = false
                pendingFiles[index].error = error.localizedDescription
                
                AppLogger.error("Failed to upload file", error: error, category: AppLogger.app)
            }
        }
        
        isUploadingFiles = false
    }
    
    /// Clear all pending files
    func clearPendingFiles() {
        pendingFiles.removeAll()
    }
}
