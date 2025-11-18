import Foundation

class ChatService {
    static let shared = ChatService()
    private let networkManager = NetworkManager.shared
    
    private init() {}
    
    // MARK: - Fetch Conversations
    
    /// Fetch all conversations for the current user
    func fetchConversations() async throws -> [Conversation] {
        print("📱 ChatService: Fetching conversations")
        
        do {
            // Try to get the full response structure first
            let response: ConversationsResponse = try await networkManager.request(
                endpoint: "/api/chat/convos",
                method: .get,
                parameters: nil
            )
            
            print("✅ ChatService: Fetched \(response.conversations.count) conversations")
            return response.conversations
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                print("⚠️ ChatService: Conversation fetch cancelled")
                throw error
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                print("⚠️ ChatService: Conversation fetch cancelled (NSError)")
                throw error
            }
            
            // Fallback: Try to decode as array directly
            print("⚠️ ChatService: Failed to decode as ConversationsResponse, trying array")
            do {
                let conversations: [Conversation] = try await networkManager.request(
                    endpoint: "/api/chat/convos",
                    method: .get,
                    parameters: nil
                )
                print("✅ ChatService: Fetched \(conversations.count) conversations (array format)")
                return conversations
            } catch {
                // Check cancellation again
                if let urlError = error as? URLError, urlError.code == .cancelled {
                    print("⚠️ ChatService: Conversation fetch cancelled (fallback)")
                    throw error
                }
                if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                    print("⚠️ ChatService: Conversation fetch cancelled (fallback NSError)")
                    throw error
                }
                
                print("❌ ChatService: Failed to fetch conversations: \(error)")
                throw error
            }
        }
    }
    
    // MARK: - Fetch Messages
    
    /// Fetch messages for a specific conversation
    func fetchMessages(conversationId: String) async throws -> [LibreChatMessage] {
        print("📱 ChatService: Fetching messages for conversation: \(conversationId)")
        
        do {
            // Use query parameter format like the web UI
            let messages: [LibreChatMessage] = try await networkManager.request(
                endpoint: "/api/chat/messages?conversationId=\(conversationId)",
                method: .get,
                parameters: nil
            )
            
            print("✅ ChatService: Fetched \(messages.count) messages")
            return messages
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                print("⚠️ ChatService: Message fetch cancelled")
                throw error
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                print("⚠️ ChatService: Message fetch cancelled (NSError)")
                throw error
            }
            
            print("❌ ChatService: Failed to fetch messages: \(error)")
            throw error
        }
    }
    
    // MARK: - Send Message
    
    /// Send a message to the AI agent
    func sendMessage(
        text: String,
        conversationId: String? = nil
    ) async throws -> SendMessageResponse {
        print("📱 ChatService: Sending message")
        print("📱 ChatService: Text: \(text.prefix(50))...")
        print("📱 ChatService: Conversation ID: \(conversationId ?? "new")")
        
        // Generate message IDs
        let messageId = UUID().uuidString
        let parentMessageId = "00000000-0000-0000-0000-000000000000" // Root message
        
        // Create request payload matching SvelteKit implementation
        var parameters: [String: Any] = [
            "text": text,
            "sender": "User",
            "clientTimestamp": ISO8601DateFormatter().string(from: Date()),
            "isCreatedByUser": true,
            "parentMessageId": parentMessageId,
            "messageId": messageId,
            "error": false,
            "endpoint": "google",
            "model": "gemini-2.0-flash-lite",
            "agent_id": "ephemeral",
            "thinking": false,
            "clientOptions": [
                "disableStreaming": true
            ]
        ]
        
        // Add conversationId if present
        if let conversationId = conversationId {
            parameters["conversationId"] = conversationId
        }
        
        // Send to SvelteKit proxy endpoint
        let response: SendMessageResponse = try await networkManager.request(
            endpoint: "/api/chat/agents/chat/google",
            method: .post,
            parameters: parameters
        )
        
        if let error = response.error {
            print("❌ ChatService: Error in response: \(error)")
            throw NSError(domain: "ChatService", code: -1, userInfo: [NSLocalizedDescriptionKey: error])
        }
        
        print("✅ ChatService: Message sent successfully")
        if let convId = response.conversation?.conversationId {
            print("✅ ChatService: Conversation ID: \(convId)")
        }
        
        return response
    }
    
    // MARK: - Delete Conversation
    
    /// Delete a conversation
    func deleteConversation(conversationId: String) async throws {
        print("📱 ChatService: Deleting conversation: \(conversationId)")
        
        let _: EmptyResponse = try await networkManager.request(
            endpoint: "/api/chat/convos/\(conversationId)",
            method: .delete,
            parameters: nil
        )
        
        print("✅ ChatService: Conversation deleted")
    }
    
    // MARK: - Update Conversation
    
    /// Update conversation title
    func updateConversation(conversationId: String, title: String) async throws {
        print("📱 ChatService: Updating conversation title: \(conversationId)")
        
        let parameters: [String: Any] = [
            "conversationId": conversationId,
            "title": title
        ]
        
        let _: EmptyResponse = try await networkManager.request(
            endpoint: "/api/chat/convos/update",
            method: .post,
            parameters: parameters
        )
        
        print("✅ ChatService: Conversation updated")
    }
}
