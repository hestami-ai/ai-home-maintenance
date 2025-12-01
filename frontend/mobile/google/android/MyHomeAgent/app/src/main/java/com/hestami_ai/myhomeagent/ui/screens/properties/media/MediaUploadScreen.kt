package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import kotlinx.coroutines.launch

/**
 * Location type options for media.
 */
val LOCATION_TYPES = listOf(
    "GENERAL" to "General",
    "EXTERIOR" to "Exterior",
    "INTERIOR" to "Interior",
    "ROOM" to "Room",
    "SYSTEM" to "System"
)

/**
 * Media sub-type options.
 */
val MEDIA_SUB_TYPES = listOf(
    "GENERAL" to "General",
    "FLOORPLAN" to "Floorplan",
    "360_DEGREE" to "360° Virtual Tour",
    "BEFORE" to "Before",
    "AFTER" to "After",
    "DAMAGE" to "Damage",
    "REPAIR" to "Repair"
)

/**
 * Screen for selecting and uploading media files.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediaUploadScreen(
    propertyId: String,
    onNavigateBack: () -> Unit,
    onUploadComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uploadState by MediaUploadManager.uploadState.collectAsState()
    
    var selectedUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var showMetadataEditor by remember { mutableStateOf(false) }
    var currentEditingTaskId by remember { mutableStateOf<String?>(null) }
    
    // Gallery picker launcher
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris.isNotEmpty()) {
            selectedUris = selectedUris + uris
            scope.launch {
                val tasks = MediaUploadManager.createUploadTasks(context, uris, propertyId)
                MediaUploadManager.addToQueue(tasks)
            }
        }
    }
    
    // Document picker for additional file types
    val documentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        if (uris.isNotEmpty()) {
            selectedUris = selectedUris + uris
            scope.launch {
                val tasks = MediaUploadManager.createUploadTasks(context, uris, propertyId)
                MediaUploadManager.addToQueue(tasks)
            }
        }
    }
    
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Upload Media",
                        color = AppColors.PrimaryText,
                        fontWeight = FontWeight.Bold
                    )
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
                .padding(16.dp)
        ) {
            // Upload progress section (when uploading)
            if (uploadState.isUploading) {
                UploadProgressSection(uploadState)
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // File selection area
            if (!uploadState.isUploading) {
                FileSelectionArea(
                    onSelectImages = { galleryLauncher.launch("image/*") },
                    onSelectVideos = { galleryLauncher.launch("video/*") },
                    onSelectDocuments = { 
                        documentLauncher.launch(arrayOf(
                            "model/vnd.usdz+zip",
                            "model/gltf-binary",
                            "model/gltf+json",
                            "application/octet-stream"
                        ))
                    }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Queue list
            if (uploadState.uploadQueue.isNotEmpty()) {
                Text(
                    text = "Upload Queue (${uploadState.uploadQueue.size})",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
                Spacer(modifier = Modifier.height(8.dp))
                
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uploadState.uploadQueue) { task ->
                        UploadTaskCard(
                            task = task,
                            onEditMetadata = {
                                currentEditingTaskId = task.id
                                showMetadataEditor = true
                            },
                            onRemove = {
                                // Remove from queue
                                MediaUploadManager.clearCompletedTasks()
                            }
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Upload button
                if (!uploadState.isUploading) {
                    val pendingCount = uploadState.uploadQueue.count { it.status == UploadStatus.PENDING }
                    Button(
                        onClick = {
                            scope.launch {
                                MediaUploadManager.startUpload(
                                    context = context,
                                    onAllComplete = { completed, failed ->
                                        if (failed == 0) {
                                            onUploadComplete()
                                        }
                                    }
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = pendingCount > 0,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.AccentPrimary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Upload $pendingCount Files",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                } else {
                    // Cancel button during upload
                    Button(
                        onClick = { MediaUploadManager.cancelAllUploads() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppColors.ErrorColor
                        )
                    ) {
                        Text(
                            text = "Cancel Upload",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                // Empty state
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoLibrary,
                            contentDescription = null,
                            tint = AppColors.SecondaryText,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No files selected",
                            fontSize = 16.sp,
                            color = AppColors.SecondaryText
                        )
                        Text(
                            text = "Tap above to select photos, videos, or 3D models",
                            fontSize = 14.sp,
                            color = AppColors.DisabledText,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
    
    // Metadata editor dialog
    if (showMetadataEditor && currentEditingTaskId != null) {
        val task = uploadState.uploadQueue.find { it.id == currentEditingTaskId }
        if (task != null) {
            MetadataEditorDialog(
                task = task,
                onDismiss = { 
                    showMetadataEditor = false
                    currentEditingTaskId = null
                },
                onSave = { title, description, mediaSubType, locationType ->
                    MediaUploadManager.updateTaskMetadata(
                        taskId = task.id,
                        title = title,
                        description = description,
                        mediaSubType = mediaSubType,
                        locationType = locationType
                    )
                    showMetadataEditor = false
                    currentEditingTaskId = null
                }
            )
        }
    }
}

@Composable
private fun FileSelectionArea(
    onSelectImages: () -> Unit,
    onSelectVideos: () -> Unit,
    onSelectDocuments: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "Select Files",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FileTypeButton(
                    icon = Icons.Default.Image,
                    label = "Photos",
                    onClick = onSelectImages
                )
                FileTypeButton(
                    icon = Icons.Default.PlayCircle,
                    label = "Videos",
                    onClick = onSelectVideos
                )
                FileTypeButton(
                    icon = Icons.Default.ViewInAr,
                    label = "3D Models",
                    onClick = onSelectDocuments
                )
            }
        }
    }
}

@Composable
private fun FileTypeButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .background(AppColors.AccentPrimary.copy(alpha = 0.1f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = AppColors.AccentPrimary,
                modifier = Modifier.size(28.dp)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            color = AppColors.SecondaryText
        )
    }
}

@Composable
private fun UploadProgressSection(uploadState: MediaUploadState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Uploading...",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
                Text(
                    text = "${(uploadState.overallProgress * 100).toInt()}%",
                    fontSize = 14.sp,
                    color = AppColors.AccentPrimary,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { uploadState.overallProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = AppColors.AccentPrimary,
                trackColor = AppColors.SecondaryBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "File ${uploadState.currentUploadIndex + 1} of ${uploadState.uploadQueue.size}",
                fontSize = 12.sp,
                color = AppColors.SecondaryText
            )
        }
    }
}

@Composable
private fun UploadTaskCard(
    task: MediaUploadTask,
    onEditMetadata: () -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail or icon
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(AppColors.SecondaryBackground),
                contentAlignment = Alignment.Center
            ) {
                if (task.mimeType.startsWith("image/")) {
                    AsyncImage(
                        model = task.fileUri,
                        contentDescription = task.fileName,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = when {
                            task.mimeType.startsWith("video/") -> Icons.Default.PlayCircle
                            task.mimeType.contains("model/") -> Icons.Default.ViewInAr
                            else -> Icons.Default.Image
                        },
                        contentDescription = null,
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // File info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title.ifEmpty { task.fileName },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.PrimaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = formatFileSize(task.fileSize),
                    fontSize = 12.sp,
                    color = AppColors.SecondaryText
                )
                
                // Progress bar for uploading
                if (task.status == UploadStatus.UPLOADING) {
                    Spacer(modifier = Modifier.height(4.dp))
                    LinearProgressIndicator(
                        progress = { task.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = AppColors.AccentPrimary,
                        trackColor = AppColors.SecondaryBackground
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(8.dp))
            
            // Status icon or actions
            when (task.status) {
                UploadStatus.PENDING -> {
                    IconButton(onClick = onEditMetadata) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Edit metadata",
                            tint = AppColors.AccentPrimary
                        )
                    }
                }
                UploadStatus.UPLOADING -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = AppColors.AccentPrimary,
                        strokeWidth = 2.dp
                    )
                }
                UploadStatus.COMPLETED -> {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Completed",
                        tint = AppColors.SuccessColor,
                        modifier = Modifier.size(24.dp)
                    )
                }
                UploadStatus.FAILED -> {
                    Icon(
                        imageVector = Icons.Default.Error,
                        contentDescription = "Failed",
                        tint = AppColors.ErrorColor,
                        modifier = Modifier.size(24.dp)
                    )
                }
                UploadStatus.CANCELLED -> {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cancelled",
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MetadataEditorDialog(
    task: MediaUploadTask,
    onDismiss: () -> Unit,
    onSave: (title: String, description: String, mediaSubType: String, locationType: String) -> Unit
) {
    var title by remember { mutableStateOf(task.title) }
    var description by remember { mutableStateOf(task.description) }
    var mediaSubType by remember { mutableStateOf(task.mediaSubType) }
    var locationType by remember { mutableStateOf(task.locationType) }
    
    var mediaSubTypeExpanded by remember { mutableStateOf(false) }
    var locationTypeExpanded by remember { mutableStateOf(false) }
    
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = AppColors.CardBackground,
        title = {
            Text(
                text = "Edit Metadata",
                color = AppColors.PrimaryText,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppColors.PrimaryText,
                        unfocusedTextColor = AppColors.PrimaryText,
                        focusedBorderColor = AppColors.AccentPrimary,
                        unfocusedBorderColor = AppColors.BorderColor
                    )
                )
                
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppColors.PrimaryText,
                        unfocusedTextColor = AppColors.PrimaryText,
                        focusedBorderColor = AppColors.AccentPrimary,
                        unfocusedBorderColor = AppColors.BorderColor
                    )
                )
                
                // Media Sub Type dropdown
                ExposedDropdownMenuBox(
                    expanded = mediaSubTypeExpanded,
                    onExpandedChange = { mediaSubTypeExpanded = it }
                ) {
                    OutlinedTextField(
                        value = MEDIA_SUB_TYPES.find { it.first == mediaSubType }?.second ?: "General",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Media Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mediaSubTypeExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = AppColors.PrimaryText,
                            unfocusedTextColor = AppColors.PrimaryText,
                            focusedBorderColor = AppColors.AccentPrimary,
                            unfocusedBorderColor = AppColors.BorderColor
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = mediaSubTypeExpanded,
                        onDismissRequest = { mediaSubTypeExpanded = false }
                    ) {
                        MEDIA_SUB_TYPES.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    mediaSubType = value
                                    mediaSubTypeExpanded = false
                                }
                            )
                        }
                    }
                }
                
                // Location Type dropdown
                ExposedDropdownMenuBox(
                    expanded = locationTypeExpanded,
                    onExpandedChange = { locationTypeExpanded = it }
                ) {
                    OutlinedTextField(
                        value = LOCATION_TYPES.find { it.first == locationType }?.second ?: "General",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Location") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = locationTypeExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = AppColors.PrimaryText,
                            unfocusedTextColor = AppColors.PrimaryText,
                            focusedBorderColor = AppColors.AccentPrimary,
                            unfocusedBorderColor = AppColors.BorderColor
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = locationTypeExpanded,
                        onDismissRequest = { locationTypeExpanded = false }
                    ) {
                        LOCATION_TYPES.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    locationType = value
                                    locationTypeExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(title, description, mediaSubType, locationType) },
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.AccentPrimary)
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.SecondaryBackground)
            ) {
                Text("Cancel", color = AppColors.PrimaryText)
            }
        }
    )
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${bytes / (1024 * 1024 * 1024)} GB"
    }
}
