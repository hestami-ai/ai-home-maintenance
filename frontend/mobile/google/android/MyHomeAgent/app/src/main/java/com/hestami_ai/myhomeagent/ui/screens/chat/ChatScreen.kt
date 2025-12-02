package com.hestami_ai.myhomeagent.ui.screens.chat

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.data.model.Conversation
import com.hestami_ai.myhomeagent.data.network.ChatMessage
import com.hestami_ai.myhomeagent.data.network.ChatServiceState
import com.hestami_ai.myhomeagent.data.network.PendingFileUpload
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.ChatViewModel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Embedded AI Chat content for use within the main tab navigation.
 * Does not include its own Scaffold or TopAppBar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmbeddedChatScreen(
    modifier: Modifier = Modifier,
    viewModel: ChatViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var showConversationList by remember { mutableStateOf(false) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var conversationToDelete by remember { mutableStateOf<String?>(null) }
    var showAttachmentMenu by remember { mutableStateOf(false) }
    
    // File picker launchers
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        uris.forEach { uri ->
            handleFileSelection(context, uri, viewModel)
        }
    }
    
    val documentPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        uris.forEach { uri ->
            handleFileSelection(context, uri, viewModel)
        }
    }

    // Load conversations on first appearance
    LaunchedEffect(Unit) {
        viewModel.loadConversations()
    }

    // Scroll to bottom when new message arrives
    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.PrimaryBackground)
    ) {
        // Conversation Header with selector
        ConversationHeader(
            selectedConversation = uiState.selectedConversation,
            conversationCount = uiState.conversations.size,
            onShowConversations = { showConversationList = true },
            onNewConversation = { viewModel.createNewConversation() }
        )
        
        // Messages list
        if (uiState.isLoadingConversations) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = AppColors.SuccessColor)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Loading conversations...",
                        color = AppColors.SecondaryText
                    )
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Welcome message
                if (uiState.messages.isEmpty() && !uiState.hasConversations) {
                    item {
                        WelcomeMessage()
                    }
                } else if (uiState.messages.isEmpty()) {
                    item {
                        EmptyConversationMessage()
                    }
                }

                items(uiState.messages) { message ->
                    ChatBubble(message = message)
                }

                // Show loading indicator when sending
                if (uiState.serviceState == ChatServiceState.SENDING) {
                    item {
                        ThinkingIndicator()
                    }
                }
            }
        }
        
        // Pending files preview
        if (uiState.pendingFiles.isNotEmpty()) {
            PendingFilesPreview(
                pendingFiles = uiState.pendingFiles,
                onRemoveFile = { viewModel.removePendingFile(it) }
            )
        }

        // Input area with attachment button
        ChatInputWithAttachment(
            value = uiState.inputText,
            onValueChange = viewModel::updateInputText,
            onSend = viewModel::sendMessage,
            onAttachClick = { showAttachmentMenu = true },
            isEnabled = uiState.serviceState != ChatServiceState.SENDING,
            hasPendingFiles = uiState.pendingFiles.isNotEmpty()
        )
    }
    
    // Conversation list bottom sheet
    if (showConversationList) {
        ModalBottomSheet(
            onDismissRequest = { showConversationList = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = AppColors.PrimaryBackground
        ) {
            ConversationListSheet(
                conversations = uiState.conversations,
                selectedConversationId = uiState.currentConversationId,
                onSelectConversation = { conversationId ->
                    viewModel.selectConversation(conversationId)
                    showConversationList = false
                },
                onDeleteConversation = { conversationId ->
                    conversationToDelete = conversationId
                    showDeleteConfirmation = true
                },
                onNewConversation = {
                    viewModel.createNewConversation()
                    showConversationList = false
                },
                onDismiss = { showConversationList = false }
            )
        }
    }
    
    // Attachment menu
    DropdownMenu(
        expanded = showAttachmentMenu,
        onDismissRequest = { showAttachmentMenu = false }
    ) {
        DropdownMenuItem(
            text = { Text("Photo Library", color = AppColors.PrimaryText) },
            onClick = {
                showAttachmentMenu = false
                imagePickerLauncher.launch("image/*")
            },
            leadingIcon = {
                Icon(Icons.Filled.Image, contentDescription = null, tint = AppColors.SuccessColor)
            }
        )
        DropdownMenuItem(
            text = { Text("Browse Files", color = AppColors.PrimaryText) },
            onClick = {
                showAttachmentMenu = false
                documentPickerLauncher.launch(arrayOf("*/*"))
            },
            leadingIcon = {
                Icon(Icons.Filled.Description, contentDescription = null, tint = AppColors.SuccessColor)
            }
        )
    }
    
    // Delete confirmation dialog
    if (showDeleteConfirmation && conversationToDelete != null) {
        AlertDialog(
            onDismissRequest = { 
                showDeleteConfirmation = false
                conversationToDelete = null
            },
            title = { Text("Delete Conversation", color = AppColors.PrimaryText) },
            text = { 
                Text(
                    "Are you sure you want to delete this conversation? This action cannot be undone.",
                    color = AppColors.SecondaryText
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        conversationToDelete?.let { viewModel.deleteConversation(it) }
                        showDeleteConfirmation = false
                        conversationToDelete = null
                        showConversationList = false
                    }
                ) {
                    Text("Delete", color = AppColors.ErrorColor)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirmation = false
                        conversationToDelete = null
                    }
                ) {
                    Text("Cancel", color = AppColors.SecondaryText)
                }
            },
            containerColor = AppColors.CardBackground
        )
    }
    
    // Error dialog
    if (uiState.showError && uiState.error != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            title = { Text("Error", color = AppColors.PrimaryText) },
            text = { Text(uiState.error!!, color = AppColors.SecondaryText) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearError() }) {
                    Text("OK", color = AppColors.SuccessColor)
                }
            },
            containerColor = AppColors.CardBackground
        )
    }
}

private fun handleFileSelection(
    context: android.content.Context,
    uri: Uri,
    viewModel: ChatViewModel
) {
    try {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val filename = uri.lastPathSegment ?: "file"
        
        contentResolver.openInputStream(uri)?.use { inputStream ->
            val fileData = inputStream.readBytes()
            
            // Create thumbnail for images
            val thumbnail = if (mimeType.startsWith("image/")) {
                try {
                    BitmapFactory.decodeByteArray(fileData, 0, fileData.size)
                } catch (e: Exception) {
                    null
                }
            } else null
            
            viewModel.addPendingFile(
                fileData = fileData,
                filename = filename,
                mimeType = mimeType,
                thumbnail = thumbnail
            )
        }
    } catch (e: Exception) {
        timber.log.Timber.e(e, "Failed to read file: $uri")
    }
}

@Composable
private fun ChatHeader(serviceState: ChatServiceState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.PrimaryBackground)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(AppColors.SuccessColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.SmartToy,
                contentDescription = null,
                tint = AppColors.PrimaryText,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = "AI Handyman",
                color = AppColors.PrimaryText,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Text(
                text = when (serviceState) {
                    ChatServiceState.IDLE -> "Ready to help"
                    ChatServiceState.LOADING -> "Loading..."
                    ChatServiceState.SENDING -> "Thinking..."
                    ChatServiceState.ERROR -> "Connection error"
                },
                color = when (serviceState) {
                    ChatServiceState.IDLE -> AppColors.SuccessColor
                    ChatServiceState.LOADING, ChatServiceState.SENDING -> AppColors.WarningColor
                    ChatServiceState.ERROR -> AppColors.ErrorColor
                },
                fontSize = 12.sp
            )
        }
    }
}

/**
 * AI Chat screen matching iOS ChatView.swift.
 * Full screen version with back navigation (for deep linking).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    onNavigateBack: () -> Unit,
    propertyId: String? = null,
    modifier: Modifier = Modifier,
    viewModel: ChatViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    // Scroll to bottom when new message arrives
    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(AppColors.SuccessColor),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.SmartToy,
                                contentDescription = null,
                                tint = AppColors.PrimaryText,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "AI Handyman",
                                color = AppColors.PrimaryText,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Text(
                                text = when (uiState.serviceState) {
                                    ChatServiceState.IDLE -> "Ready"
                                    ChatServiceState.LOADING -> "Loading..."
                                    ChatServiceState.SENDING -> "Sending..."
                                    ChatServiceState.ERROR -> "Error"
                                },
                                color = when (uiState.serviceState) {
                                    ChatServiceState.IDLE -> AppColors.SuccessColor
                                    ChatServiceState.LOADING, ChatServiceState.SENDING -> AppColors.WarningColor
                                    ChatServiceState.ERROR -> AppColors.ErrorColor
                                },
                                fontSize = 12.sp
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = AppColors.PrimaryText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.PrimaryBackground
                )
            )
        },
        containerColor = AppColors.PrimaryBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
        ) {
            // Messages list
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Welcome message
                if (uiState.messages.isEmpty()) {
                    item {
                        WelcomeMessage()
                    }
                }

                items(uiState.messages) { message ->
                    ChatBubble(message = message)
                }

                // Show loading indicator when sending
                if (uiState.serviceState == ChatServiceState.SENDING) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Start
                        ) {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = AppColors.CardBackground
                                ),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        color = AppColors.SuccessColor,
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "AI is thinking...",
                                        fontSize = 14.sp,
                                        color = AppColors.SecondaryText
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Input area
            ChatInput(
                value = uiState.inputText,
                onValueChange = viewModel::updateInputText,
                onSend = viewModel::sendMessage,
                isEnabled = uiState.serviceState != ChatServiceState.SENDING
            )
        }
    }
}

@Composable
private fun WelcomeMessage() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(AppColors.SuccessColor.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.SmartToy,
                contentDescription = null,
                tint = AppColors.SuccessColor,
                modifier = Modifier.size(32.dp)
            )
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Hi! I'm your AI Home Assistant",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Ask me anything about home maintenance,\nrepairs, or your properties",
            fontSize = 14.sp,
            color = AppColors.SecondaryText,
            lineHeight = 20.sp
        )
    }
}

@Composable
private fun ChatBubble(message: ChatMessage) {
    val dateFormat = remember { SimpleDateFormat("h:mm a", Locale.getDefault()) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.isUser) Arrangement.End else Arrangement.Start
    ) {
        Card(
            modifier = Modifier.widthIn(max = 300.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (message.isUser) 
                    AppColors.SuccessColor 
                else 
                    AppColors.CardBackground
            ),
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (message.isUser) 16.dp else 4.dp,
                bottomEnd = if (message.isUser) 4.dp else 16.dp
            )
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Text(
                    text = message.content,
                    fontSize = 15.sp,
                    color = AppColors.PrimaryText,
                    lineHeight = 22.sp
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = dateFormat.format(Date(message.timestamp)),
                    fontSize = 11.sp,
                    color = if (message.isUser) 
                        AppColors.PrimaryText.copy(alpha = 0.7f) 
                    else 
                        AppColors.DisabledText
                )
            }
        }
    }
}

@Composable
private fun ChatInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    isEnabled: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.SecondaryBackground)
            .padding(12.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { 
                Text(
                    "Type a message...", 
                    color = AppColors.DisabledText
                ) 
            },
            enabled = isEnabled,
            modifier = Modifier.weight(1f),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = AppColors.PrimaryText,
                unfocusedTextColor = AppColors.PrimaryText,
                focusedBorderColor = AppColors.SuccessColor,
                unfocusedBorderColor = AppColors.BorderColor,
                focusedContainerColor = AppColors.CardBackground,
                unfocusedContainerColor = AppColors.CardBackground,
                cursorColor = AppColors.SuccessColor
            ),
            shape = RoundedCornerShape(24.dp),
            maxLines = 4
        )

        Spacer(modifier = Modifier.width(8.dp))

        IconButton(
            onClick = onSend,
            enabled = isEnabled && value.isNotBlank(),
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(
                    if (isEnabled && value.isNotBlank()) 
                        AppColors.SuccessColor 
                    else 
                        AppColors.DisabledText
                )
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Send,
                contentDescription = "Send",
                tint = AppColors.PrimaryText
            )
        }
    }
}

// ==================== New Composables for Conversation & File Management ====================

@Composable
private fun ConversationHeader(
    selectedConversation: Conversation?,
    conversationCount: Int,
    onShowConversations: () -> Unit,
    onNewConversation: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.CardBackground)
            // Add extra padding on the right (48.dp) to avoid overlapping with the menu button
            .padding(start = 12.dp, end = 56.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Conversation selector button
        Row(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onShowConversations)
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.SmartToy,
                contentDescription = null,
                tint = AppColors.SuccessColor,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = selectedConversation?.title ?: "New Conversation",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = AppColors.PrimaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (conversationCount > 0) {
                    Text(
                        text = "$conversationCount conversation${if (conversationCount == 1) "" else "s"}",
                        fontSize = 12.sp,
                        color = AppColors.SecondaryText
                    )
                }
            }
            Icon(
                imageVector = Icons.Filled.ExpandMore,
                contentDescription = "Show conversations",
                tint = AppColors.SecondaryText
            )
        }
        
        // New conversation button
        IconButton(onClick = onNewConversation) {
            Icon(
                imageVector = Icons.Filled.Edit,
                contentDescription = "New conversation",
                tint = AppColors.SuccessColor
            )
        }
    }
}

@Composable
private fun ConversationListSheet(
    conversations: List<Conversation>,
    selectedConversationId: String?,
    onSelectConversation: (String) -> Unit,
    onDeleteConversation: (String) -> Unit,
    onNewConversation: () -> Unit,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Conversations",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.PrimaryText
            )
            IconButton(onClick = onNewConversation) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = "New conversation",
                    tint = AppColors.SuccessColor
                )
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        if (conversations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Filled.SmartToy,
                        contentDescription = null,
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No Conversations Yet",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                    Text(
                        text = "Start a new conversation to get help",
                        fontSize = 14.sp,
                        color = AppColors.SecondaryText
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(conversations) { conversation ->
                    ConversationItem(
                        conversation = conversation,
                        isSelected = conversation.conversationId == selectedConversationId,
                        onSelect = { onSelectConversation(conversation.conversationId) },
                        onDelete = { onDeleteConversation(conversation.conversationId) }
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun ConversationItem(
    conversation: Conversation,
    isSelected: Boolean,
    onSelect: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) 
                AppColors.SuccessColor.copy(alpha = 0.1f) 
            else 
                AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = conversation.title,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = AppColors.PrimaryText,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = formatRelativeTime(conversation.updatedAt),
                    fontSize = 12.sp,
                    color = AppColors.SecondaryText
                )
            }
            
            if (isSelected) {
                Icon(
                    imageVector = Icons.Filled.SmartToy,
                    contentDescription = "Selected",
                    tint = AppColors.SuccessColor,
                    modifier = Modifier.size(20.dp)
                )
            }
            
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = AppColors.ErrorColor,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
private fun EmptyConversationMessage() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Start typing to begin a new conversation",
            fontSize = 14.sp,
            color = AppColors.SecondaryText
        )
    }
}

@Composable
private fun ThinkingIndicator() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = AppColors.CardBackground
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    color = AppColors.SuccessColor,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "AI is thinking...",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
            }
        }
    }
}

@Composable
private fun PendingFilesPreview(
    pendingFiles: List<PendingFileUpload>,
    onRemoveFile: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.SecondaryBackground)
            .padding(8.dp)
    ) {
        Text(
            text = "Attachments (${pendingFiles.size})",
            fontSize = 12.sp,
            color = AppColors.SecondaryText,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            pendingFiles.forEach { file ->
                PendingFileCard(
                    file = file,
                    onRemove = { onRemoveFile(file.id) }
                )
            }
        }
    }
}

@Composable
private fun PendingFileCard(
    file: PendingFileUpload,
    onRemove: () -> Unit
) {
    Box(
        modifier = Modifier.size(90.dp, 110.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(AppColors.CardBackground),
                contentAlignment = Alignment.Center
            ) {
                if (file.thumbnailBitmap != null) {
                    Image(
                        bitmap = file.thumbnailBitmap.asImageBitmap(),
                        contentDescription = file.filename,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Description,
                        contentDescription = null,
                        tint = AppColors.SuccessColor,
                        modifier = Modifier.size(32.dp)
                    )
                }
                
                // Loading overlay
                if (file.isUploading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(AppColors.PrimaryBackground.copy(alpha = 0.7f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = AppColors.SuccessColor,
                            strokeWidth = 2.dp
                        )
                    }
                }
                
                // Error indicator
                if (file.error != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(AppColors.ErrorColor.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Failed",
                            fontSize = 10.sp,
                            color = AppColors.ErrorColor,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            
            Text(
                text = file.filename,
                fontSize = 10.sp,
                color = AppColors.PrimaryText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.width(80.dp)
            )
        }
        
        // Remove button
        IconButton(
            onClick = onRemove,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(24.dp)
                .clip(CircleShape)
                .background(AppColors.ErrorColor)
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Remove",
                tint = AppColors.PrimaryText,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
private fun ChatInputWithAttachment(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    onAttachClick: () -> Unit,
    isEnabled: Boolean,
    hasPendingFiles: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.SecondaryBackground)
            .padding(12.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        // Attachment button
        IconButton(
            onClick = onAttachClick,
            enabled = isEnabled
        ) {
            Icon(
                imageVector = Icons.Filled.AttachFile,
                contentDescription = "Attach file",
                tint = if (isEnabled) AppColors.SuccessColor else AppColors.DisabledText
            )
        }
        
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { 
                Text(
                    "Ask a question...", 
                    color = AppColors.DisabledText
                ) 
            },
            enabled = isEnabled,
            modifier = Modifier.weight(1f),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = AppColors.PrimaryText,
                unfocusedTextColor = AppColors.PrimaryText,
                focusedBorderColor = AppColors.SuccessColor,
                unfocusedBorderColor = AppColors.BorderColor,
                focusedContainerColor = AppColors.CardBackground,
                unfocusedContainerColor = AppColors.CardBackground,
                cursorColor = AppColors.SuccessColor
            ),
            shape = RoundedCornerShape(24.dp),
            maxLines = 4
        )

        Spacer(modifier = Modifier.width(8.dp))

        val canSend = isEnabled && (value.isNotBlank() || hasPendingFiles)
        IconButton(
            onClick = onSend,
            enabled = canSend,
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(
                    if (canSend) 
                        AppColors.SuccessColor 
                    else 
                        AppColors.DisabledText
                )
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Send,
                contentDescription = "Send",
                tint = AppColors.PrimaryText
            )
        }
    }
}

private fun formatRelativeTime(isoString: String): String {
    return try {
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = format.parse(isoString.substringBefore('.').substringBefore('Z'))
        val now = Date()
        val diff = now.time - (date?.time ?: now.time)
        
        val minutes = diff / (1000 * 60)
        val hours = diff / (1000 * 60 * 60)
        val days = diff / (1000 * 60 * 60 * 24)
        
        when {
            minutes < 1 -> "Just now"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            days < 7 -> "${days}d ago"
            else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(date ?: now)
        }
    } catch (e: Exception) {
        isoString.take(10)
    }
}
