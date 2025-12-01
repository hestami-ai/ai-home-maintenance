package com.hestami_ai.myhomeagent.ui.viewmodel

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.data.model.Conversation
import com.hestami_ai.myhomeagent.data.model.UploadedFile
import com.hestami_ai.myhomeagent.data.network.ChatFileUploader
import com.hestami_ai.myhomeagent.data.network.ChatMessage
import com.hestami_ai.myhomeagent.data.network.ChatService
import com.hestami_ai.myhomeagent.data.network.ChatServiceState
import com.hestami_ai.myhomeagent.data.network.FileUploadConstants
import com.hestami_ai.myhomeagent.data.network.PendingFileUpload
import com.hestami_ai.myhomeagent.data.network.getImageDimensions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * UI state for the chat screen.
 */
data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val inputText: String = "",
    val serviceState: ChatServiceState = ChatServiceState.IDLE,
    val currentConversationId: String? = null,
    val error: String? = null,
    val showError: Boolean = false,
    // Conversation management
    val conversations: List<Conversation> = emptyList(),
    val isLoadingConversations: Boolean = false,
    // File upload
    val pendingFiles: List<PendingFileUpload> = emptyList(),
    val isUploadingFiles: Boolean = false
) {
    val selectedConversation: Conversation?
        get() = conversations.find { it.conversationId == currentConversationId }
    
    val hasConversations: Boolean get() = conversations.isNotEmpty()
    val hasMessages: Boolean get() = messages.isNotEmpty()
}

/**
 * ViewModel for the AI chat screen.
 * Matches iOS ChatViewModel.swift implementation using HTTP REST API.
 */
class ChatViewModel : ViewModel() {

    private val chatService = ChatService.shared
    private val fileUploader = ChatFileUploader.shared

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    /**
     * Update the input text.
     */
    fun updateInputText(text: String) {
        _uiState.update { it.copy(inputText = text) }
    }

    // ==================== Conversations ====================

    /**
     * Load all conversations.
     */
    fun loadConversations() {
        if (_uiState.value.isLoadingConversations) {
            Timber.w("Already loading conversations, skipping duplicate call")
            return
        }

        Timber.d("Loading conversations")
        _uiState.update { it.copy(isLoadingConversations = true, error = null) }

        viewModelScope.launch {
            try {
                val conversations = chatService.fetchConversations()
                _uiState.update { state ->
                    state.copy(
                        conversations = conversations,
                        isLoadingConversations = false
                    )
                }
                Timber.i("Loaded ${conversations.size} conversations")

                // Auto-select first conversation if available and none selected
                if (_uiState.value.currentConversationId == null && conversations.isNotEmpty()) {
                    selectConversation(conversations.first().conversationId)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load conversations")
                _uiState.update { 
                    it.copy(
                        isLoadingConversations = false,
                        error = "Failed to load conversations: ${e.message}",
                        showError = true
                    )
                }
            }
        }
    }

    /**
     * Select a conversation and load its messages.
     */
    fun selectConversation(conversationId: String) {
        Timber.d("Selecting conversation: $conversationId")
        _uiState.update { it.copy(currentConversationId = conversationId) }
        loadMessages(conversationId)
    }

    /**
     * Load messages for a conversation.
     */
    private fun loadMessages(conversationId: String) {
        Timber.d("Loading messages for: $conversationId")
        _uiState.update { it.copy(serviceState = ChatServiceState.LOADING, error = null) }

        viewModelScope.launch {
            try {
                val messages = chatService.fetchMessages(conversationId)
                val chatMessages = messages.map { msg ->
                    ChatMessage(
                        id = msg.messageId,
                        content = msg.displayText,
                        isUser = msg.isFromUser,
                        conversationId = conversationId,
                        files = msg.files
                    )
                }

                _uiState.update { 
                    it.copy(
                        messages = chatMessages,
                        serviceState = ChatServiceState.IDLE
                    )
                }
                Timber.i("Loaded ${chatMessages.size} messages")
            } catch (e: Exception) {
                Timber.e(e, "Failed to load messages")
                _uiState.update { 
                    it.copy(
                        serviceState = ChatServiceState.ERROR,
                        error = "Failed to load messages: ${e.message}",
                        showError = true,
                        messages = emptyList()
                    )
                }
            }
        }
    }

    /**
     * Create a new conversation.
     */
    fun createNewConversation() {
        Timber.d("Creating new conversation")
        _uiState.update { 
            it.copy(
                currentConversationId = null,
                messages = emptyList(),
                error = null,
                pendingFiles = emptyList()
            )
        }
    }

    /**
     * Delete a conversation.
     */
    fun deleteConversation(conversationId: String) {
        Timber.d("Deleting conversation: $conversationId")

        viewModelScope.launch {
            try {
                chatService.deleteConversation(conversationId)

                // Remove from local list
                val updatedConversations = _uiState.value.conversations
                    .filter { it.conversationId != conversationId }

                _uiState.update { state ->
                    state.copy(conversations = updatedConversations)
                }

                // If this was the selected conversation, clear selection
                if (_uiState.value.currentConversationId == conversationId) {
                    _uiState.update { 
                        it.copy(
                            currentConversationId = null,
                            messages = emptyList()
                        )
                    }

                    // Auto-select first conversation if available
                    if (updatedConversations.isNotEmpty()) {
                        selectConversation(updatedConversations.first().conversationId)
                    }
                }

                Timber.i("Conversation deleted")
            } catch (e: Exception) {
                Timber.e(e, "Failed to delete conversation")
                _uiState.update { 
                    it.copy(
                        error = "Failed to delete conversation: ${e.message}",
                        showError = true
                    )
                }
            }
        }
    }

    // ==================== Send Message ====================

    /**
     * Send a message to the AI.
     */
    fun sendMessage() {
        val text = _uiState.value.inputText.trim()
        val pendingFiles = _uiState.value.pendingFiles

        // Allow empty text if there are files attached
        if (text.isEmpty() && pendingFiles.isEmpty()) {
            Timber.w("Cannot send empty message without attachments")
            return
        }

        Timber.d("Sending message with ${pendingFiles.size} files")
        _uiState.update { 
            it.copy(
                inputText = "",
                serviceState = ChatServiceState.SENDING
            )
        }

        viewModelScope.launch {
            // Upload any pending files first
            val uploadedFiles = uploadPendingFiles()

            // Check if any uploads failed
            if (_uiState.value.pendingFiles.any { it.error != null }) {
                _uiState.update { 
                    it.copy(
                        serviceState = ChatServiceState.ERROR,
                        error = "Some files failed to upload. Please remove them and try again.",
                        showError = true
                    )
                }
                return@launch
            }

            // Add user message immediately
            val userMessage = ChatMessage(
                content = text,
                isUser = true,
                conversationId = _uiState.value.currentConversationId,
                files = uploadedFiles.map { it.toFileAttachment() }.takeIf { it.isNotEmpty() }
            )

            _uiState.update { 
                it.copy(messages = it.messages + userMessage)
            }

            try {
                val response = chatService.sendMessage(
                    text = text,
                    conversationId = _uiState.value.currentConversationId,
                    uploadedFiles = uploadedFiles
                )

                // Update conversation ID if this is a new conversation
                val conversationId = response.conversation?.conversationId
                    ?: _uiState.value.currentConversationId

                // Extract AI response text
                val aiResponseText = response.responseMessage?.displayText
                    ?: response.responseMessage?.text
                    ?: "No response received"

                val aiMessage = ChatMessage(
                    id = response.responseMessage?.messageId ?: java.util.UUID.randomUUID().toString(),
                    content = aiResponseText,
                    isUser = false,
                    conversationId = conversationId,
                    files = response.responseMessage?.files
                )

                // Handle new conversation creation
                if (response.conversation != null && _uiState.value.currentConversationId == null) {
                    val newConversation = Conversation(
                        conversationId = conversationId!!,
                        title = response.title ?: text.take(50),
                        updatedAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                            .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                            .format(java.util.Date()),
                        endpoint = "google",
                        createdAt = null
                    )
                    _uiState.update { state ->
                        state.copy(
                            conversations = listOf(newConversation) + state.conversations
                        )
                    }
                    Timber.i("Created new conversation: $conversationId")
                }

                _uiState.update { state ->
                    state.copy(
                        messages = state.messages + aiMessage,
                        serviceState = ChatServiceState.IDLE,
                        currentConversationId = conversationId,
                        pendingFiles = emptyList() // Clear pending files after successful send
                    )
                }

                Timber.i("Message sent and response received for conversation: $conversationId")
            } catch (e: Exception) {
                Timber.e(e, "Failed to send message")
                _uiState.update { 
                    it.copy(
                        serviceState = ChatServiceState.ERROR,
                        error = "Failed to send message: ${e.message}",
                        showError = true
                    )
                }
            }
        }
    }

    // ==================== File Upload ====================

    /**
     * Add a file to the pending upload queue.
     */
    fun addPendingFile(
        fileData: ByteArray,
        filename: String,
        mimeType: String,
        thumbnail: Bitmap? = null
    ) {
        val fileExtension = filename.substringAfterLast('.', "")

        Timber.d("Adding pending file: $filename, size: ${fileData.size} bytes, extension: $fileExtension")

        // Validate file extension
        if (!FileUploadConstants.isAllowedExtension(fileExtension)) {
            Timber.e("File extension '$fileExtension' not allowed")
            _uiState.update { 
                it.copy(
                    error = "File type '$fileExtension' is not supported",
                    showError = true
                )
            }
            return
        }

        // Validate file size
        if (fileData.size > FileUploadConstants.maxFileSize) {
            Timber.e("File too large: ${fileData.size} bytes")
            _uiState.update { 
                it.copy(
                    error = "File is too large. Maximum size is 100MB",
                    showError = true
                )
            }
            return
        }

        val pendingFile = PendingFileUpload(
            filename = filename,
            fileData = fileData,
            mimeType = mimeType,
            fileExtension = fileExtension,
            thumbnailBitmap = thumbnail
        )

        _uiState.update { state ->
            state.copy(pendingFiles = state.pendingFiles + pendingFile)
        }
        Timber.i("Added pending file: $filename. Total pending: ${_uiState.value.pendingFiles.size}")
    }

    /**
     * Remove a pending file.
     */
    fun removePendingFile(fileId: String) {
        _uiState.update { state ->
            state.copy(
                pendingFiles = state.pendingFiles.filter { it.id != fileId }
            )
        }
        Timber.d("Removed pending file: $fileId")
    }

    /**
     * Upload all pending files that haven't been uploaded yet.
     */
    private suspend fun uploadPendingFiles(): List<UploadedFile> {
        val pendingFiles = _uiState.value.pendingFiles
        if (pendingFiles.isEmpty()) return emptyList()

        _uiState.update { it.copy(isUploadingFiles = true) }

        val uploadedFiles = mutableListOf<UploadedFile>()

        for (file in pendingFiles) {
            // Skip files that are already uploaded or currently uploading
            if (file.uploadedFile != null || file.isUploading) {
                file.uploadedFile?.let { uploadedFiles.add(it) }
                continue
            }

            // Mark as uploading
            updatePendingFileState(file.id) { it.copy(isUploading = true, error = null) }

            try {
                // Extract dimensions for images
                var width: Int? = null
                var height: Int? = null

                if (file.isImage) {
                    val dimensions = file.fileData.getImageDimensions()
                    if (dimensions != null) {
                        width = dimensions.first
                        height = dimensions.second
                    } else {
                        throw Exception("Failed to get image dimensions")
                    }
                }

                // Upload the file
                val uploadedFile = fileUploader.uploadFile(
                    fileData = file.fileData,
                    filename = file.filename,
                    mimeType = file.mimeType,
                    width = width,
                    height = height
                )

                // Update with uploaded file info
                updatePendingFileState(file.id) { 
                    it.copy(
                        uploadedFile = uploadedFile,
                        isUploading = false,
                        uploadProgress = 1.0
                    )
                }

                uploadedFiles.add(uploadedFile)
                Timber.i("Successfully uploaded: ${file.filename}")
            } catch (e: Exception) {
                // Mark upload as failed
                updatePendingFileState(file.id) { 
                    it.copy(
                        isUploading = false,
                        error = e.message ?: "Upload failed"
                    )
                }
                Timber.e(e, "Failed to upload file: ${file.filename}")
            }
        }

        _uiState.update { it.copy(isUploadingFiles = false) }
        return uploadedFiles
    }

    private fun updatePendingFileState(fileId: String, update: (PendingFileUpload) -> PendingFileUpload) {
        _uiState.update { state ->
            state.copy(
                pendingFiles = state.pendingFiles.map { file ->
                    if (file.id == fileId) update(file) else file
                }
            )
        }
    }

    /**
     * Clear all pending files.
     */
    fun clearPendingFiles() {
        _uiState.update { it.copy(pendingFiles = emptyList()) }
    }

    // ==================== Utility ====================

    /**
     * Clear error state.
     */
    fun clearError() {
        _uiState.update { it.copy(error = null, showError = false) }
    }

    /**
     * Refresh conversations.
     */
    fun refresh() {
        loadConversations()
    }
}
