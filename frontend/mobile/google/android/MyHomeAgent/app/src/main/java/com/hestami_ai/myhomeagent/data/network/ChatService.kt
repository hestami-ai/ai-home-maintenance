package com.hestami_ai.myhomeagent.data.network

import com.hestami_ai.myhomeagent.data.model.ClientOptions
import com.hestami_ai.myhomeagent.data.model.Conversation
import com.hestami_ai.myhomeagent.data.model.ConversationsResponse
import com.hestami_ai.myhomeagent.data.model.DeleteConversationArg
import com.hestami_ai.myhomeagent.data.model.DeleteConversationRequest
import com.hestami_ai.myhomeagent.data.model.FileAttachment
import com.hestami_ai.myhomeagent.data.model.LibreChatMessage
import com.hestami_ai.myhomeagent.data.model.SendMessageRequest
import com.hestami_ai.myhomeagent.data.model.SendMessageResponse
import com.hestami_ai.myhomeagent.data.model.UploadedFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Chat message model for UI display.
 */
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val conversationId: String? = null,
    val files: List<FileAttachment>? = null
)

/**
 * Chat service state.
 */
enum class ChatServiceState {
    IDLE,
    LOADING,
    SENDING,
    ERROR
}

/**
 * HTTP-based chat service for AI chat functionality.
 * Matches iOS ChatService implementation using REST API endpoints.
 */
@Suppress("unused")
class ChatService private constructor() {

    companion object {
        val shared: ChatService by lazy { ChatService() }
    }

    private val apiService: ApiService
        get() = NetworkModule.provideApiService()

    /**
     * Fetch all conversations for the current user.
     * Handles empty responses and different response formats.
     */
    suspend fun fetchConversations(): List<Conversation> = withContext(Dispatchers.IO) {
        Timber.d("Fetching conversations")
        
        // Debug: Log session cookie status
        val hasSession = NetworkModule.hasActiveSession()
        val sessionHeader = NetworkModule.getSessionCookieHeader()
        Timber.d("Has active session: $hasSession")
        Timber.d("Session cookie header: $sessionHeader")
        
        try {
            // First, make a raw request to see what we're getting
            val rawResponse = apiService.getConversationsRaw()
            val rawBody = rawResponse.body()?.string()
            Timber.d("Raw conversations response code: ${rawResponse.code()}")
            Timber.d("Raw conversations response body: $rawBody")
            Timber.d("Raw conversations response body length: ${rawBody?.length ?: 0}")
            
            // If empty or null body, return empty list
            if (rawBody.isNullOrBlank()) {
                Timber.i("Empty response body - no conversations yet")
                return@withContext emptyList()
            }
            
            // Try to parse as ConversationsResponse (wrapped format)
            try {
                val gson = com.google.gson.Gson()
                val conversationsResponse = gson.fromJson(rawBody, ConversationsResponse::class.java)
                if (conversationsResponse?.conversations != null) {
                    Timber.i("Parsed ${conversationsResponse.conversations.size} conversations (wrapped format)")
                    return@withContext conversationsResponse.conversations
                }
            } catch (e: Exception) {
                Timber.d("Failed to parse as ConversationsResponse: ${e.message}")
            }
            
            // Try to parse as array format
            try {
                val gson = com.google.gson.Gson()
                val listType = object : com.google.gson.reflect.TypeToken<List<Conversation>>() {}.type
                val conversations: List<Conversation> = gson.fromJson(rawBody, listType)
                Timber.i("Parsed ${conversations.size} conversations (array format)")
                return@withContext conversations
            } catch (e: Exception) {
                Timber.d("Failed to parse as array: ${e.message}")
            }
            
            Timber.w("Could not parse conversations response, returning empty list")
            emptyList()
        } catch (e: Exception) {
            // Handle empty response (EOFException) - means no conversations
            if (e is java.io.EOFException || e.cause is java.io.EOFException) {
                Timber.i("Empty response (EOFException) - no conversations yet")
                return@withContext emptyList()
            }
            Timber.e(e, "Failed to fetch conversations")
            throw e
        }
    }

    /**
     * Fetch messages for a specific conversation.
     */
    suspend fun fetchMessages(conversationId: String): List<LibreChatMessage> = withContext(Dispatchers.IO) {
        Timber.d("Fetching messages for conversation: $conversationId")
        
        try {
            val response = apiService.getMessages(conversationId)
            if (response.isSuccessful) {
                val messages = response.body() ?: emptyList()
                Timber.i("Fetched ${messages.size} messages")
                messages
            } else {
                Timber.e("Failed to fetch messages: ${response.code()}")
                throw NetworkError.HttpError(response.code())
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to fetch messages")
            throw e
        }
    }

    /**
     * Send a message to the AI agent with optional file attachments.
     */
    suspend fun sendMessage(
        text: String,
        conversationId: String? = null,
        uploadedFiles: List<UploadedFile> = emptyList()
    ): SendMessageResponse = withContext(Dispatchers.IO) {
        Timber.d("Sending message to conversation: ${conversationId ?: "new"}")
        Timber.d("Attached files: ${uploadedFiles.size}")
        
        val messageId = UUID.randomUUID().toString()
        val parentMessageId = "00000000-0000-0000-0000-000000000000"
        
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        
        // Build request as a map for flexibility with file attachments
        val parameters = mutableMapOf<String, Any>(
            "text" to text.ifEmpty { " " },
            "sender" to "User",
            "clientTimestamp" to dateFormat.format(Date()),
            "isCreatedByUser" to true,
            "parentMessageId" to parentMessageId,
            "messageId" to messageId,
            "error" to false,
            "endpoint" to "google",
            "model" to "gemini-2.5-flash-lite",
            "agent_id" to "ephemeral",
            "thinking" to false,
            "clientOptions" to mapOf("disableStreaming" to true)
        )
        
        // Add conversationId if present
        conversationId?.let { parameters["conversationId"] = it }
        
        // Add file attachments if present
        if (uploadedFiles.isNotEmpty()) {
            val fileAttachments = uploadedFiles.map { file ->
                mutableMapOf<String, Any?>(
                    "file_id" to file.fileId,
                    "filename" to file.filename,
                    "filepath" to file.filepath,
                    "type" to file.type,
                    "size" to file.size
                ).apply {
                    file.width?.let { put("width", it) }
                    file.height?.let { put("height", it) }
                    file.text?.let { put("text", it) }
                    file.source?.let { put("source", it) }
                    file.embedded?.let { put("embedded", it) }
                }.filterValues { it != null }
            }
            parameters["files"] = fileAttachments
            
            // Build OCR field for documents with extracted text
            buildOcrField(uploadedFiles)?.let { ocrText ->
                parameters["ocr"] = ocrText
                Timber.d("Including OCR text for ${uploadedFiles.count { it.hasExtractedText }} document(s)")
            }
            
            // Extract image URLs for LibreChat format
            val imageUrls = uploadedFiles
                .filter { it.isImage }
                .mapNotNull { it.filepath }
            
            if (imageUrls.isNotEmpty()) {
                parameters["imageUrls"] = imageUrls
            }
        }
        
        try {
            val response = apiService.sendChatMessageWithMap(parameters)
            if (response.isSuccessful) {
                val sendResponse = response.body() ?: throw NetworkError.NoData
                
                if (sendResponse.error != null) {
                    Timber.e("Error in response: ${sendResponse.error}")
                    throw NetworkError.ServerError(sendResponse.error)
                }
                
                Timber.i("Message sent successfully")
                sendResponse
            } else {
                Timber.e("Failed to send message: ${response.code()}")
                throw NetworkError.HttpError(response.code())
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to send message")
            throw e
        }
    }

    /**
     * Delete a conversation.
     */
    suspend fun deleteConversation(conversationId: String) = withContext(Dispatchers.IO) {
        Timber.d("Deleting conversation: $conversationId")
        
        val request = DeleteConversationRequest(
            arg = DeleteConversationArg(
                conversationId = conversationId,
                source = "button"
            )
        )
        
        try {
            val response = apiService.deleteConversation(request)
            if (response.isSuccessful) {
                val deleteResponse = response.body()
                Timber.i("Conversation deleted - acknowledged: ${deleteResponse?.acknowledged}, deletedCount: ${deleteResponse?.deletedCount}")
            } else {
                Timber.e("Failed to delete conversation: ${response.code()}")
                throw NetworkError.HttpError(response.code())
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to delete conversation")
            throw e
        }
    }
}
