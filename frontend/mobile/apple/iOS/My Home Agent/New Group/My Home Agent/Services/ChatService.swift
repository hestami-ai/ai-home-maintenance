import Foundation
import OSLog

class ChatService {
    static let shared = ChatService()
    private let networkManager = NetworkManager.shared
    
    private init() {}
    
    // MARK: - Fetch Conversations
    
    /// Fetch all conversations for the current user
    func fetchConversations() async throws -> [Conversation] {
        AppLogger.app.info("Fetching conversations")
        
        do {
            // Try to get the full response structure first
            let response: ConversationsResponse = try await networkManager.request(
                endpoint: "/api/chat/convos",
                method: .get,
                parameters: nil
            )
            
            AppLogger.app.info("Fetched \(response.conversations.count, privacy: .public) conversations")
            return response.conversations
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                AppLogger.app.debug("Conversation fetch cancelled")
                throw error
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                AppLogger.app.debug("Conversation fetch cancelled (NSError)")
                throw error
            }
            
            // Fallback: Try to decode as array directly
            AppLogger.app.debug("Failed to decode as ConversationsResponse, trying array")
            do {
                let conversations: [Conversation] = try await networkManager.request(
                    endpoint: "/api/chat/convos",
                    method: .get,
                    parameters: nil
                )
                AppLogger.app.info("Fetched \(conversations.count, privacy: .public) conversations (array format)")
                return conversations
            } catch {
                // Check cancellation again
                if let urlError = error as? URLError, urlError.code == .cancelled {
                    AppLogger.app.debug("Conversation fetch cancelled (fallback)")
                    throw error
                }
                if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                    AppLogger.app.debug("Conversation fetch cancelled (fallback NSError)")
                    throw error
                }
                
                AppLogger.error("Failed to fetch conversations", error: error, category: AppLogger.app)
                throw error
            }
        }
    }
    
    // MARK: - Fetch Messages
    
    /// Fetch messages for a specific conversation
    func fetchMessages(conversationId: String) async throws -> [LibreChatMessage] {
        AppLogger.app.info("Fetching messages for conversation: \(conversationId, privacy: .public)")
        
        do {
            // Use query parameter format like the web UI
            let messages: [LibreChatMessage] = try await networkManager.request(
                endpoint: "/api/chat/messages?conversationId=\(conversationId)",
                method: .get,
                parameters: nil
            )
            
            AppLogger.app.info("Fetched \(messages.count, privacy: .public) messages")
            return messages
        } catch {
            // Check if it's a cancellation error
            if let urlError = error as? URLError, urlError.code == .cancelled {
                AppLogger.app.debug("Message fetch cancelled")
                throw error
            }
            if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled {
                AppLogger.app.debug("Message fetch cancelled (NSError)")
                throw error
            }
            
            AppLogger.error("Failed to fetch messages", error: error, category: AppLogger.app)
            throw error
        }
    }
    
    // MARK: - Send Message
    
    /// Send a message to the AI agent
    func sendMessage(
        text: String,
        conversationId: String? = nil,
        uploadedFiles: [UploadedFile] = []
    ) async throws -> SendMessageResponse {
        AppLogger.app.info("Sending message")
        #if DEBUG
        AppLogger.app.debug("Text: \(text.prefix(50), privacy: .public)...")
        AppLogger.app.debug("Conversation ID: \(conversationId ?? "new", privacy: .public)")
        AppLogger.app.debug("Attached files: \(uploadedFiles.count, privacy: .public)")
        #endif
        
        // Generate message IDs
        let messageId = UUID().uuidString
        let parentMessageId = "00000000-0000-0000-0000-000000000000" // Root message
        
        // Create request payload matching SvelteKit implementation
        var parameters: [String: Any] = [
            "text": text.isEmpty ? " " : text,  // LibreChat requires text even with files
            "sender": "User",
            "clientTimestamp": ISO8601DateFormatter().string(from: Date()),
            "isCreatedByUser": true,
            "parentMessageId": parentMessageId,
            "messageId": messageId,
            "error": false,
            "endpoint": "google",
            "model": "gemini-2.5-flash-lite",
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
        
        // Add file attachments if present
        if !uploadedFiles.isEmpty {
            let fileAttachments = uploadedFiles.map { file -> [String: Any] in
                var attachment: [String: Any] = [
                    "file_id": file.file_id,
                    "filename": file.filename,
                    "filepath": file.filepath as Any,
                    "type": file.type,
                    "size": file.size
                ]
                
                // Add optional fields if present
                if let width = file.width {
                    attachment["width"] = width
                }
                if let height = file.height {
                    attachment["height"] = height
                }
                if let text = file.text {
                    attachment["text"] = text
                }
                if let source = file.source {
                    attachment["source"] = source
                }
                if let embedded = file.embedded {
                    attachment["embedded"] = embedded
                }
                
                return attachment
            }
            parameters["files"] = fileAttachments
            
            // Build OCR field for documents with extracted text
            if let ocrText = buildOcrField(from: uploadedFiles) {
                parameters["ocr"] = ocrText
                #if DEBUG
                AppLogger.app.debug("Including OCR text for \(uploadedFiles.filter { $0.hasExtractedText }.count) document(s)")
                #endif
            }
            
            // Extract image URLs for LibreChat format
            let imageUrls = uploadedFiles
                .filter { $0.isImage }
                .compactMap { $0.filepath }
            
            if !imageUrls.isEmpty {
                parameters["imageUrls"] = imageUrls
            }
        }
        
        // Send to SvelteKit proxy endpoint
        let response: SendMessageResponse = try await networkManager.request(
            endpoint: "/api/chat/agents/chat/google",
            method: .post,
            parameters: parameters
        )
        
        if let error = response.error {
            AppLogger.app.error("Error in response: \(error, privacy: .public)")
            throw NSError(domain: "ChatService", code: -1, userInfo: [NSLocalizedDescriptionKey: error])
        }
        
        AppLogger.app.info("Message sent successfully")
        #if DEBUG
        if let convId = response.conversation?.conversationId {
            AppLogger.app.debug("Conversation ID: \(convId, privacy: .public)")
        }
        #endif
        
        return response
    }
    
    // MARK: - Delete Conversation
    
    /// Delete a conversation
    func deleteConversation(conversationId: String) async throws {
        AppLogger.app.info("Deleting conversation: \(conversationId, privacy: .public)")
        
        let parameters: [String: Any] = [
            "arg": [
                "conversationId": conversationId,
                "source": "button"
            ]
        ]
        
        let response: DeleteConversationResponse = try await networkManager.request(
            endpoint: "/api/chat/convos",
            method: .delete,
            parameters: parameters
        )
        
        AppLogger.app.info("Conversation deleted - acknowledged: \(response.acknowledged), deletedCount: \(response.deletedCount)")
    }
    
    // MARK: - Update Conversation
    
    /// Update conversation title
    func updateConversation(conversationId: String, title: String) async throws {
        AppLogger.app.info("Updating conversation title: \(conversationId, privacy: .public)")
        
        let parameters: [String: Any] = [
            "conversationId": conversationId,
            "title": title
        ]
        
        let _: EmptyResponse = try await networkManager.request(
            endpoint: "/api/chat/convos/update",
            method: .post,
            parameters: parameters
        )
        
        AppLogger.app.info("Conversation updated")
    }
}
