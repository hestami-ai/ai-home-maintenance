import Foundation
import SwiftUI

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
    
    private let chatService = ChatService.shared
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
        print("📱 ChatViewModel: Initialized")
    }
    
    // MARK: - Load Conversations
    
    func loadConversations() async {
        // Prevent duplicate loading
        guard !isLoadingConversations else {
            print("⚠️ ChatViewModel: Already loading conversations, skipping duplicate call")
            return
        }
        
        // Skip if already loaded (unless explicitly refreshing)
        guard !hasLoadedConversations else {
            print("⚠️ ChatViewModel: Conversations already loaded, skipping")
            return
        }
        
        print("📱 ChatViewModel: Loading conversations")
        isLoadingConversations = true
        error = nil
        
        do {
            conversations = try await chatService.fetchConversations()
            hasLoadedConversations = true
            print("✅ ChatViewModel: Loaded \(conversations.count) conversations")
            
            // Auto-select first conversation if available and none selected
            if selectedConversationId == nil, let firstConversation = conversations.first {
                await selectConversation(firstConversation.conversationId)
            }
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                print("⚠️ ChatViewModel: Conversation loading cancelled")
                return
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                print("⚠️ ChatViewModel: Conversation loading cancelled (NSError)")
                return
            }
            
            print("❌ ChatViewModel: Failed to load conversations: \(error)")
            self.error = "Failed to load conversations: \(error.localizedDescription)"
            showError = true
        }
        
        isLoadingConversations = false
    }
    
    // MARK: - Select Conversation
    
    func selectConversation(_ conversationId: String) async {
        print("📱 ChatViewModel: Selecting conversation: \(conversationId)")
        selectedConversationId = conversationId
        await loadMessages(for: conversationId)
    }
    
    // MARK: - Load Messages
    
    func loadMessages(for conversationId: String) async {
        print("📱 ChatViewModel: Loading messages for: \(conversationId)")
        isLoadingMessages = true
        error = nil
        
        do {
            messages = try await chatService.fetchMessages(conversationId: conversationId)
            print("✅ ChatViewModel: Loaded \(messages.count) messages")
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                print("⚠️ ChatViewModel: Message loading cancelled")
                return
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                print("⚠️ ChatViewModel: Message loading cancelled (NSError)")
                return
            }
            
            print("❌ ChatViewModel: Failed to load messages: \(error)")
            self.error = "Failed to load messages: \(error.localizedDescription)"
            showError = true
            messages = []
        }
        
        isLoadingMessages = false
    }
    
    // MARK: - Send Message
    
    func sendMessage(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            print("⚠️ ChatViewModel: Cannot send empty message")
            return
        }
        
        print("📱 ChatViewModel: Sending message")
        isSendingMessage = true
        error = nil
        
        do {
            let response = try await chatService.sendMessage(
                text: text,
                conversationId: selectedConversationId
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
                    print("✅ ChatViewModel: Created new conversation: \(newConversationId)")
                }
            }
            
            print("✅ ChatViewModel: Message sent successfully")
        } catch {
            print("❌ ChatViewModel: Failed to send message: \(error)")
            self.error = "Failed to send message: \(error.localizedDescription)"
            showError = true
        }
        
        isSendingMessage = false
    }
    
    // MARK: - Create New Conversation
    
    func createNewConversation() {
        print("📱 ChatViewModel: Creating new conversation")
        selectedConversationId = nil
        messages = []
        error = nil
    }
    
    // MARK: - Delete Conversation
    
    func deleteConversation(_ conversationId: String) async {
        print("📱 ChatViewModel: Deleting conversation: \(conversationId)")
        
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
            
            print("✅ ChatViewModel: Conversation deleted")
        } catch {
            print("❌ ChatViewModel: Failed to delete conversation: \(error)")
            self.error = "Failed to delete conversation: \(error.localizedDescription)"
            showError = true
        }
    }
    
    // MARK: - Update Conversation Title
    
    func updateConversationTitle(_ conversationId: String, title: String) async {
        print("📱 ChatViewModel: Updating conversation title")
        
        do {
            try await chatService.updateConversation(conversationId: conversationId, title: title)
            
            // Reload conversations to get updated data
            await loadConversations()
            
            print("✅ ChatViewModel: Conversation title updated")
        } catch {
            print("❌ ChatViewModel: Failed to update conversation: \(error)")
            self.error = "Failed to update conversation: \(error.localizedDescription)"
            showError = true
        }
    }
    
    // MARK: - Refresh
    
    func refresh() async {
        hasLoadedConversations = false
        await loadConversations()
    }
}
