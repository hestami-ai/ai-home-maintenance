package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Upload status for individual media files.
 */
enum class UploadStatus {
    PENDING,
    UPLOADING,
    COMPLETED,
    FAILED,
    CANCELLED
}

/**
 * Media upload task containing file info and metadata.
 */
data class MediaUploadTask(
    val id: String = UUID.randomUUID().toString(),
    val fileUri: Uri,
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val propertyId: String,
    
    // Metadata fields
    var title: String = "",
    var description: String = "",
    var mediaType: String = "IMAGE",
    var mediaSubType: String = "GENERAL",
    var locationType: String = "GENERAL",
    var locationSubType: String = "OTHER",
    
    var status: UploadStatus = UploadStatus.PENDING,
    var progress: Float = 0f,
    var error: String? = null
)

/**
 * Overall upload state.
 */
data class MediaUploadState(
    val uploadQueue: List<MediaUploadTask> = emptyList(),
    val isUploading: Boolean = false,
    val currentUploadIndex: Int = 0,
    val overallProgress: Float = 0f,
    val completedCount: Int = 0,
    val failedCount: Int = 0
)

/**
 * Manages media file uploads with progress tracking.
 * Singleton pattern matching iOS MediaUploadManager.
 */
object MediaUploadManager {
    
    private val _uploadState = MutableStateFlow(MediaUploadState())
    val uploadState: StateFlow<MediaUploadState> = _uploadState.asStateFlow()
    
    // Configuration
    const val MAX_FILE_SIZE: Long = 100 * 1024 * 1024 // 100MB
    val ALLOWED_IMAGE_TYPES = listOf("image/jpeg", "image/png", "image/gif", "image/webp")
    val ALLOWED_VIDEO_TYPES = listOf("video/mp4", "video/quicktime", "video/webm")
    val ALLOWED_3D_TYPES = listOf("model/vnd.usdz+zip", "model/gltf-binary", "model/gltf+json")
    
    /**
     * Create upload tasks from selected URIs.
     */
    suspend fun createUploadTasks(
        context: Context,
        uris: List<Uri>,
        propertyId: String
    ): List<MediaUploadTask> = withContext(Dispatchers.IO) {
        uris.mapNotNull { uri ->
            try {
                val fileName = getFileName(context, uri) ?: "unknown_${System.currentTimeMillis()}"
                val fileSize = getFileSize(context, uri)
                val mimeType = getMimeType(context, uri) ?: "application/octet-stream"
                
                // Validate file size
                if (fileSize > MAX_FILE_SIZE) {
                    Timber.w("File too large: $fileName ($fileSize bytes)")
                    return@mapNotNull null
                }
                
                // Determine media type from mime type
                val mediaType = when {
                    mimeType.startsWith("image/") -> "IMAGE"
                    mimeType.startsWith("video/") -> "VIDEO"
                    mimeType.contains("usdz") || mimeType.contains("gltf") || mimeType.contains("model/") -> "3D_MODEL"
                    else -> "FILE"
                }
                
                MediaUploadTask(
                    fileUri = uri,
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    propertyId = propertyId,
                    title = fileName.substringBeforeLast("."),
                    mediaType = mediaType
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to create upload task for URI: $uri")
                null
            }
        }
    }
    
    /**
     * Add tasks to the upload queue.
     */
    fun addToQueue(tasks: List<MediaUploadTask>) {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue + tasks
        )
        Timber.d("Added ${tasks.size} tasks to queue. Total: ${_uploadState.value.uploadQueue.size}")
    }
    
    /**
     * Update task metadata.
     */
    fun updateTaskMetadata(
        taskId: String,
        title: String? = null,
        description: String? = null,
        mediaSubType: String? = null,
        locationType: String? = null,
        locationSubType: String? = null
    ) {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue.map { task ->
                if (task.id == taskId) {
                    task.copy(
                        title = title ?: task.title,
                        description = description ?: task.description,
                        mediaSubType = mediaSubType ?: task.mediaSubType,
                        locationType = locationType ?: task.locationType,
                        locationSubType = locationSubType ?: task.locationSubType
                    )
                } else task
            }
        )
    }
    
    /**
     * Start uploading all queued tasks sequentially.
     */
    suspend fun startUpload(
        context: Context,
        onTaskComplete: (MediaUploadTask, Boolean) -> Unit = { _, _ -> },
        onAllComplete: (Int, Int) -> Unit = { _, _ -> }
    ) = withContext(Dispatchers.IO) {
        val queue = _uploadState.value.uploadQueue.filter { it.status == UploadStatus.PENDING }
        
        if (queue.isEmpty()) {
            Timber.w("No pending tasks to upload")
            return@withContext
        }
        
        _uploadState.value = _uploadState.value.copy(
            isUploading = true,
            currentUploadIndex = 0,
            overallProgress = 0f,
            completedCount = 0,
            failedCount = 0
        )
        
        var completedCount = 0
        var failedCount = 0
        
        queue.forEachIndexed { index, task ->
            _uploadState.value = _uploadState.value.copy(currentUploadIndex = index)
            
            // Update task status to uploading
            updateTaskStatus(task.id, UploadStatus.UPLOADING)
            
            try {
                // Perform the actual upload
                val success = uploadFile(context, task)
                
                if (success) {
                    updateTaskStatus(task.id, UploadStatus.COMPLETED)
                    completedCount++
                    onTaskComplete(task, true)
                } else {
                    updateTaskStatus(task.id, UploadStatus.FAILED, "Upload failed")
                    failedCount++
                    onTaskComplete(task, false)
                }
            } catch (e: Exception) {
                Timber.e(e, "Upload failed for task: ${task.id}")
                updateTaskStatus(task.id, UploadStatus.FAILED, e.message)
                failedCount++
                onTaskComplete(task, false)
            }
            
            // Update overall progress
            val progress = (index + 1).toFloat() / queue.size
            _uploadState.value = _uploadState.value.copy(
                overallProgress = progress,
                completedCount = completedCount,
                failedCount = failedCount
            )
        }
        
        _uploadState.value = _uploadState.value.copy(isUploading = false)
        onAllComplete(completedCount, failedCount)
    }
    
    /**
     * Upload a single file to the server.
     */
    private suspend fun uploadFile(context: Context, task: MediaUploadTask): Boolean = withContext(Dispatchers.IO) {
        try {
            // Copy file to temp location for upload
            val tempFile = copyUriToTempFile(context, task.fileUri, task.fileName)
            
            if (tempFile == null) {
                Timber.e("Failed to copy file for upload: ${task.fileName}")
                return@withContext false
            }
            
            // TODO: Implement actual API call using Retrofit
            // For now, simulate upload with delay
            Timber.d("Uploading file: ${task.fileName} (${task.fileSize} bytes)")
            
            // Simulate progress updates
            for (i in 1..10) {
                kotlinx.coroutines.delay(200)
                updateTaskProgress(task.id, i / 10f)
            }
            
            // Clean up temp file
            tempFile.delete()
            
            // TODO: Replace with actual API response
            true
        } catch (e: Exception) {
            Timber.e(e, "Error uploading file: ${task.fileName}")
            false
        }
    }
    
    /**
     * Cancel all uploads.
     */
    fun cancelAllUploads() {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue.map { task ->
                if (task.status == UploadStatus.UPLOADING || task.status == UploadStatus.PENDING) {
                    task.copy(status = UploadStatus.CANCELLED)
                } else task
            },
            isUploading = false
        )
    }
    
    /**
     * Clear completed and failed tasks from queue.
     */
    fun clearCompletedTasks() {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue.filter { 
                it.status == UploadStatus.PENDING || it.status == UploadStatus.UPLOADING 
            }
        )
    }
    
    /**
     * Clear all tasks from queue.
     */
    fun clearAllTasks() {
        _uploadState.value = MediaUploadState()
    }
    
    // Helper functions
    
    private fun updateTaskStatus(taskId: String, status: UploadStatus, error: String? = null) {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue.map { task ->
                if (task.id == taskId) {
                    task.copy(status = status, error = error)
                } else task
            }
        )
    }
    
    private fun updateTaskProgress(taskId: String, progress: Float) {
        _uploadState.value = _uploadState.value.copy(
            uploadQueue = _uploadState.value.uploadQueue.map { task ->
                if (task.id == taskId) {
                    task.copy(progress = progress)
                } else task
            }
        )
    }
    
    private fun getFileName(context: Context, uri: Uri): String? {
        return context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            cursor.moveToFirst()
            if (nameIndex >= 0) cursor.getString(nameIndex) else null
        }
    }
    
    private fun getFileSize(context: Context, uri: Uri): Long {
        return context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            cursor.moveToFirst()
            if (sizeIndex >= 0) cursor.getLong(sizeIndex) else 0L
        } ?: 0L
    }
    
    private fun getMimeType(context: Context, uri: Uri): String? {
        return context.contentResolver.getType(uri) ?: run {
            val extension = MimeTypeMap.getFileExtensionFromUrl(uri.toString())
            MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
        }
    }
    
    private fun copyUriToTempFile(context: Context, uri: Uri, fileName: String): File? {
        return try {
            val tempFile = File(context.cacheDir, "upload_$fileName")
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            }
            tempFile
        } catch (e: Exception) {
            Timber.e(e, "Failed to copy URI to temp file")
            null
        }
    }
}
