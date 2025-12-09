import Foundation

// MARK: - Conversation Model
struct Conversation: Codable, Identifiable {
    let conversationId: String
    let title: String
    let updatedAt: String
    let endpoint: String?
    let createdAt: String?
    
    var id: String { conversationId }
    
    var updatedDate: Date? {
        ISO8601DateFormatter().date(from: updatedAt)
    }
    
    var createdDate: Date? {
        guard let createdAt = createdAt else { return nil }
        return ISO8601DateFormatter().date(from: createdAt)
    }
    
    // Explicit CodingKeys to handle both camelCase from API
    // (NetworkManager uses convertFromSnakeCase which would expect snake_case)
    enum CodingKeys: String, CodingKey {
        case conversationId
        case title
        case updatedAt
        case endpoint
        case createdAt
    }
}

// MARK: - Conversations Response
struct ConversationsResponse: Codable {
    let conversations: [Conversation]
    let pageNumber: Int?
    let pages: Int?
}

// MARK: - LibreChat Message Content
struct MessageContent: Codable {
    let type: String
    let text: String?
    let error: String?
    let think: String?
    
    enum CodingKeys: String, CodingKey {
        case type
        case text
        case error
        case think
    }
}

// MARK: - LibreChat Message Model
struct LibreChatMessage: Codable, Identifiable {
    let messageId: String
    let conversationId: String?
    let parentMessageId: String?
    let text: String
    let sender: String
    let isCreatedByUser: Bool
    let createdAt: String?
    let updatedAt: String?
    let error: Bool?
    let endpoint: String?
    let model: String?
    let content: [MessageContent]?
    let files: [FileAttachment]?
    
    var id: String { messageId }
    
    var timestamp: Date? {
        guard let createdAt = createdAt else { return nil }
        return ISO8601DateFormatter().date(from: createdAt)
    }
    
    var isFromUser: Bool {
        isCreatedByUser
    }
    
    /// Get the display text from either text field or content array
    var displayText: String {
        // For user messages, use the text field
        if isCreatedByUser && !text.isEmpty {
            return text
        }
        
        // For AI messages, extract text from content array
        if let content = content {
            // Concatenate all text content
            let textParts = content.compactMap { item -> String? in
                if item.type == "text", let text = item.text {
                    return text
                }
                return nil
            }
            
            if !textParts.isEmpty {
                return textParts.joined(separator: "\n\n")
            }
            
            // If no text content, check for errors
            let errorParts = content.compactMap { item -> String? in
                if item.type == "error", let error = item.error {
                    return "Error: \(error)"
                }
                return nil
            }
            
            if !errorParts.isEmpty {
                return errorParts.joined(separator: "\n")
            }
        }
        
        // Fallback to text field
        return text.isEmpty ? "No response" : text
    }
    
    enum CodingKeys: String, CodingKey {
        case messageId
        case conversationId
        case parentMessageId
        case text
        case sender
        case isCreatedByUser
        case createdAt
        case updatedAt
        case error
        case endpoint
        case model
        case content
        case files
        case attachments
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        messageId = try container.decode(String.self, forKey: .messageId)
        conversationId = try container.decodeIfPresent(String.self, forKey: .conversationId)
        parentMessageId = try container.decodeIfPresent(String.self, forKey: .parentMessageId)
        text = try container.decode(String.self, forKey: .text)
        sender = try container.decode(String.self, forKey: .sender)
        isCreatedByUser = try container.decode(Bool.self, forKey: .isCreatedByUser)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        error = try container.decodeIfPresent(Bool.self, forKey: .error)
        endpoint = try container.decodeIfPresent(String.self, forKey: .endpoint)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        content = try container.decodeIfPresent([MessageContent].self, forKey: .content)
        
        // Try to decode files first, then fall back to attachments
        if let filesArray = try? container.decodeIfPresent([FileAttachment].self, forKey: .files) {
            files = filesArray
        } else if let attachmentsArray = try? container.decodeIfPresent([FileAttachment].self, forKey: .attachments) {
            files = attachmentsArray
        } else {
            files = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(messageId, forKey: .messageId)
        try container.encodeIfPresent(conversationId, forKey: .conversationId)
        try container.encodeIfPresent(parentMessageId, forKey: .parentMessageId)
        try container.encode(text, forKey: .text)
        try container.encode(sender, forKey: .sender)
        try container.encode(isCreatedByUser, forKey: .isCreatedByUser)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(error, forKey: .error)
        try container.encodeIfPresent(endpoint, forKey: .endpoint)
        try container.encodeIfPresent(model, forKey: .model)
        try container.encodeIfPresent(content, forKey: .content)
        
        // Always encode as 'files' when encoding
        try container.encodeIfPresent(files, forKey: .files)
    }
}

// MARK: - Send Message Request
struct SendMessageRequest: Codable {
    let text: String
    let sender: String
    let clientTimestamp: String
    let isCreatedByUser: Bool
    let parentMessageId: String
    let messageId: String
    let error: Bool
    let endpoint: String
    let model: String
    let agentId: String
    let conversationId: String?
    let thinking: Bool
    let clientOptions: ClientOptions
    
    struct ClientOptions: Codable {
        let disableStreaming: Bool
    }
    
    enum CodingKeys: String, CodingKey {
        case text
        case sender
        case clientTimestamp
        case isCreatedByUser
        case parentMessageId
        case messageId
        case error
        case endpoint
        case model
        case agentId = "agent_id"
        case conversationId
        case thinking
        case clientOptions
    }
}

// MARK: - Send Message Response
struct SendMessageResponse: Codable {
    let requestMessage: LibreChatMessage?
    let responseMessage: LibreChatMessage?
    let conversation: ConversationInfo?
    let title: String?
    let error: String?
    
    struct ConversationInfo: Codable {
        let conversationId: String
        let title: String?
    }
}

// MARK: - Messages Response (array of messages)
typealias MessagesResponse = [LibreChatMessage]

// MARK: - Delete Conversation Response
struct DeleteConversationResponse: Codable {
    let acknowledged: Bool
    let deletedCount: Int
    let messages: DeletedMessagesInfo?
    
    struct DeletedMessagesInfo: Codable {
        let acknowledged: Bool
        let deletedCount: Int
    }
}
