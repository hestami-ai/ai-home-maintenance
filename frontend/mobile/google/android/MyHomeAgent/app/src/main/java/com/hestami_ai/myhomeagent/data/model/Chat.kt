package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName

/**
 * Chat models matching iOS Chat.swift implementation.
 */

// MARK: - Conversation Model
data class Conversation(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("title") val title: String,
    @SerializedName("updatedAt") val updatedAt: String,
    @SerializedName("endpoint") val endpoint: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

// MARK: - Conversations Response
data class ConversationsResponse(
    @SerializedName("conversations") val conversations: List<Conversation>,
    @SerializedName("pageNumber") val pageNumber: Int? = null,
    @SerializedName("pages") val pages: Int? = null
)

// MARK: - Message Content
data class MessageContent(
    @SerializedName("type") val type: String,
    @SerializedName("text") val text: String? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("think") val think: String? = null
)

// MARK: - File Attachment Model
data class FileAttachment(
    @SerializedName("file_id") val fileId: String,
    @SerializedName("filename") val filename: String,
    @SerializedName("filepath") val filepath: String? = null,
    @SerializedName("type") val type: String,
    @SerializedName("size") val size: Int,
    @SerializedName("width") val width: Int? = null,
    @SerializedName("height") val height: Int? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("source") val source: String? = null,
    @SerializedName("embedded") val embedded: Boolean? = null
) {
    val isImage: Boolean get() = type.startsWith("image/")
    
    fun displayUrl(baseUrl: String): String? {
        return filepath?.let { "$baseUrl/api/chat/files/serve$it" }
    }
}

// MARK: - Uploaded File Response
data class UploadedFile(
    @SerializedName("file_id") val fileId: String,
    @SerializedName("_id") val id: String? = null,
    @SerializedName("filename") val filename: String,
    @SerializedName("filepath") val filepath: String? = null,
    @SerializedName("type") val type: String,
    @SerializedName("size") val size: Int,
    @SerializedName("width") val width: Int? = null,
    @SerializedName("height") val height: Int? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("source") val source: String? = null,
    @SerializedName("embedded") val embedded: Boolean? = null
) {
    val isImage: Boolean get() = type.startsWith("image/")
    val hasExtractedText: Boolean get() = !text.isNullOrEmpty() && source == "text"
    
    fun displayUrl(baseUrl: String): String? {
        return filepath?.let { "$baseUrl/api/chat/files/serve$it" }
    }
    
    fun toFileAttachment(): FileAttachment = FileAttachment(
        fileId = fileId,
        filename = filename,
        filepath = filepath,
        type = type,
        size = size,
        width = width,
        height = height,
        text = text,
        source = source,
        embedded = embedded
    )
}

// MARK: - LibreChat Message Model
data class LibreChatMessage(
    @SerializedName("messageId") val messageId: String,
    @SerializedName("conversationId") val conversationId: String? = null,
    @SerializedName("parentMessageId") val parentMessageId: String? = null,
    @SerializedName("text") val text: String,
    @SerializedName("sender") val sender: String,
    @SerializedName("isCreatedByUser") val isCreatedByUser: Boolean,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("error") val error: Boolean? = null,
    @SerializedName("endpoint") val endpoint: String? = null,
    @SerializedName("model") val model: String? = null,
    @SerializedName("content") val content: List<MessageContent>? = null,
    @SerializedName("files") val files: List<FileAttachment>? = null
) {
    val isFromUser: Boolean get() = isCreatedByUser
    
    /**
     * Get the display text from either text field or content array.
     */
    val displayText: String
        get() {
            // For user messages, use the text field
            if (isCreatedByUser && text.isNotEmpty()) {
                return text
            }
            
            // For AI messages, extract text from content array
            content?.let { contentList ->
                val textParts = contentList
                    .filter { it.type == "text" }
                    .mapNotNull { it.text }
                
                if (textParts.isNotEmpty()) {
                    return textParts.joinToString("\n\n")
                }
                
                // If no text content, check for errors
                val errorParts = contentList
                    .filter { it.type == "error" }
                    .mapNotNull { it.error }
                    .map { "Error: $it" }
                
                if (errorParts.isNotEmpty()) {
                    return errorParts.joinToString("\n")
                }
            }
            
            // Fallback to text field
            return text.ifEmpty { "No response" }
        }
}

// MARK: - Send Message Request
data class SendMessageRequest(
    @SerializedName("text") val text: String,
    @SerializedName("sender") val sender: String,
    @SerializedName("clientTimestamp") val clientTimestamp: String,
    @SerializedName("isCreatedByUser") val isCreatedByUser: Boolean,
    @SerializedName("parentMessageId") val parentMessageId: String,
    @SerializedName("messageId") val messageId: String,
    @SerializedName("error") val error: Boolean,
    @SerializedName("endpoint") val endpoint: String,
    @SerializedName("model") val model: String,
    @SerializedName("agent_id") val agentId: String,
    @SerializedName("conversationId") val conversationId: String? = null,
    @SerializedName("thinking") val thinking: Boolean,
    @SerializedName("clientOptions") val clientOptions: ClientOptions
)

data class ClientOptions(
    @SerializedName("disableStreaming") val disableStreaming: Boolean
)

// MARK: - Send Message Response
data class SendMessageResponse(
    @SerializedName("requestMessage") val requestMessage: LibreChatMessage? = null,
    @SerializedName("responseMessage") val responseMessage: LibreChatMessage? = null,
    @SerializedName("conversation") val conversation: ConversationInfo? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("error") val error: String? = null
)

data class ConversationInfo(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("title") val title: String? = null
)

// MARK: - Delete Conversation Request
data class DeleteConversationRequest(
    @SerializedName("arg") val arg: DeleteConversationArg
)

data class DeleteConversationArg(
    @SerializedName("conversationId") val conversationId: String,
    @SerializedName("source") val source: String
)

// MARK: - Delete Conversation Response
data class DeleteConversationResponse(
    @SerializedName("acknowledged") val acknowledged: Boolean,
    @SerializedName("deletedCount") val deletedCount: Int,
    @SerializedName("messages") val messages: DeletedMessagesInfo? = null
)

data class DeletedMessagesInfo(
    @SerializedName("acknowledged") val acknowledged: Boolean,
    @SerializedName("deletedCount") val deletedCount: Int
)
