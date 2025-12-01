package com.hestami_ai.myhomeagent.data.network

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.hestami_ai.myhomeagent.config.AppConfiguration
import com.hestami_ai.myhomeagent.data.model.UploadedFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import timber.log.Timber
import java.io.ByteArrayOutputStream
import java.util.UUID

/**
 * File upload constants matching iOS implementation.
 */
object FileUploadConstants {
    val allowedExtensions = listOf("jpg", "jpeg", "png", "gif", "mp4", "mov", "md", "pdf", "docx", "txt", "doc", "usdz")
    val imageExtensions = listOf("jpg", "jpeg", "png", "gif")
    const val maxFileSize = 100 * 1024 * 1024  // 100MB
    
    fun isAllowedExtension(ext: String): Boolean = allowedExtensions.contains(ext.lowercase())
    fun isImageExtension(ext: String): Boolean = imageExtensions.contains(ext.lowercase())
}

/**
 * File upload error types.
 */
sealed class FileUploadError : Exception() {
    data object InvalidResponse : FileUploadError()
    data class ServerError(val statusCode: Int, override val message: String) : FileUploadError()
    data object FileTooLarge : FileUploadError()
    data object UnsupportedFileType : FileUploadError()
    data object NoSessionCookie : FileUploadError()
    data object ImageProcessingFailed : FileUploadError()
    data object FileAccessDenied : FileUploadError()
    
    override val message: String
        get() = when (this) {
            is InvalidResponse -> "Invalid response from server"
            is ServerError -> "Upload failed ($statusCode): $message"
            is FileTooLarge -> "File is too large. Maximum size is 100MB"
            is UnsupportedFileType -> "This file type is not supported"
            is NoSessionCookie -> "Authentication required. Please log in again"
            is ImageProcessingFailed -> "Failed to process image"
            is FileAccessDenied -> "Cannot access file. Please try again"
        }
}

/**
 * Pending file upload model for UI display.
 */
data class PendingFileUpload(
    val id: String = UUID.randomUUID().toString(),
    val filename: String,
    val fileData: ByteArray,
    val mimeType: String,
    val fileExtension: String,
    val thumbnailBitmap: Bitmap? = null,
    var uploadedFile: UploadedFile? = null,
    var isUploading: Boolean = false,
    var uploadProgress: Double = 0.0,
    var error: String? = null
) {
    val isImage: Boolean get() = FileUploadConstants.isImageExtension(fileExtension)
    val isUploaded: Boolean get() = uploadedFile != null
    
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as PendingFileUpload
        return id == other.id
    }
    
    override fun hashCode(): Int = id.hashCode()
}

/**
 * Chat file uploader service matching iOS ChatFileUploader implementation.
 */
class ChatFileUploader private constructor() {
    
    companion object {
        val shared: ChatFileUploader by lazy { ChatFileUploader() }
    }
    
    private val client: OkHttpClient
        get() = NetworkModule.provideOkHttpClient()
    
    /**
     * Upload a file with optional image dimensions.
     */
    suspend fun uploadFile(
        fileData: ByteArray,
        filename: String,
        mimeType: String,
        width: Int? = null,
        height: Int? = null
    ): UploadedFile = withContext(Dispatchers.IO) {
        Timber.d("Uploading file: $filename, size: ${fileData.size} bytes")
        
        // Validate file size
        if (fileData.size > FileUploadConstants.maxFileSize) {
            throw FileUploadError.FileTooLarge
        }
        
        // Get session cookie
        val sessionCookie = NetworkModule.getSessionCookieHeader()
        if (sessionCookie.isNullOrEmpty()) {
            Timber.e("No session cookie available for file upload")
            throw FileUploadError.NoSessionCookie
        }
        
        // Build multipart request
        val boundary = UUID.randomUUID().toString()
        val requestBody = buildMultipartBody(
            fileData = fileData,
            filename = filename,
            mimeType = mimeType,
            width = width,
            height = height,
            boundary = boundary
        )
        
        val url = "${AppConfiguration.apiBaseUrl}/api/chat/files/upload"
        
        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .header("Content-Type", "multipart/form-data; boundary=$boundary")
            .header("Cookie", sessionCookie)
            .build()
        
        Timber.d("Sending upload request to $url")
        
        try {
            val response = client.newCall(request).execute()
            
            Timber.d("Upload response status: ${response.code}")
            
            if (response.code != 200) {
                val errorMessage = response.body?.string() ?: "Unknown error"
                Timber.e("Upload failed: $errorMessage")
                throw FileUploadError.ServerError(response.code, errorMessage)
            }
            
            val responseBody = response.body?.string()
                ?: throw FileUploadError.InvalidResponse
            
            val uploadedFile = com.google.gson.Gson().fromJson(responseBody, UploadedFile::class.java)
            Timber.i("File uploaded successfully: ${uploadedFile.fileId}")
            
            if (uploadedFile.hasExtractedText) {
                Timber.d("Text extracted from document (source: ${uploadedFile.source})")
            }
            
            uploadedFile
        } catch (e: FileUploadError) {
            throw e
        } catch (e: Exception) {
            Timber.e(e, "Failed to upload file")
            throw FileUploadError.InvalidResponse
        }
    }
    
    private fun buildMultipartBody(
        fileData: ByteArray,
        filename: String,
        mimeType: String,
        width: Int?,
        height: Int?,
        boundary: String
    ): okhttp3.RequestBody {
        val body = StringBuilder()
        
        // Add file
        body.append("--$boundary\r\n")
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"$filename\"\r\n")
        body.append("Content-Type: $mimeType\r\n\r\n")
        
        // Build the complete body with file data
        val preFileBytes = body.toString().toByteArray(Charsets.UTF_8)
        
        val postFile = StringBuilder()
        postFile.append("\r\n")
        
        // Add endpoint
        postFile.append("--$boundary\r\n")
        postFile.append("Content-Disposition: form-data; name=\"endpoint\"\r\n\r\n")
        postFile.append("google\r\n")
        
        // Add dimensions for images
        width?.let {
            postFile.append("--$boundary\r\n")
            postFile.append("Content-Disposition: form-data; name=\"width\"\r\n\r\n")
            postFile.append("$it\r\n")
        }
        
        height?.let {
            postFile.append("--$boundary\r\n")
            postFile.append("Content-Disposition: form-data; name=\"height\"\r\n\r\n")
            postFile.append("$it\r\n")
        }
        
        // Close multipart
        postFile.append("--$boundary--\r\n")
        
        val postFileBytes = postFile.toString().toByteArray(Charsets.UTF_8)
        
        // Combine all parts
        val fullBody = ByteArrayOutputStream()
        fullBody.write(preFileBytes)
        fullBody.write(fileData)
        fullBody.write(postFileBytes)
        
        return fullBody.toByteArray().toRequestBody("multipart/form-data; boundary=$boundary".toMediaType())
    }
}

/**
 * Extension function to get image dimensions from byte array.
 */
fun ByteArray.getImageDimensions(): Pair<Int, Int>? {
    return try {
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeByteArray(this, 0, this.size, options)
        if (options.outWidth > 0 && options.outHeight > 0) {
            Pair(options.outWidth, options.outHeight)
        } else {
            null
        }
    } catch (e: Exception) {
        Timber.e(e, "Failed to get image dimensions")
        null
    }
}

/**
 * Build OCR field for documents with extracted text.
 */
fun buildOcrField(files: List<UploadedFile>): String? {
    val docsWithText = files.filter { it.hasExtractedText }
    if (docsWithText.isEmpty()) return null
    
    val parts = docsWithText.map { file ->
        "# \"${file.filename}\"\n${file.text}"
    }
    
    return "Attached document(s):\n```md${parts.joinToString("\n\n")}\n```"
}
