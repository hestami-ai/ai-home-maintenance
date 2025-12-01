package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Media type enumeration matching iOS MediaType.
 */
enum class MediaType {
    @SerializedName("IMAGE") IMAGE,
    @SerializedName("VIDEO") VIDEO,
    @SerializedName("FILE") FILE,
    @SerializedName("3D_MODEL") THREE_D_MODEL,
    UNKNOWN;

    companion object {
        @Suppress("unused")
        fun fromString(value: String): MediaType {
            return entries.find { it.name == value || 
                (it == THREE_D_MODEL && value == "3D_MODEL") 
            } ?: UNKNOWN
        }
    }
}

/**
 * Parent type enumeration matching iOS ParentType.
 */
enum class ParentType {
    @SerializedName("PROPERTY") PROPERTY,
    @SerializedName("SERVICE_REQUEST") SERVICE_REQUEST,
    @SerializedName("SERVICE_REPORT") SERVICE_REPORT,
    UNKNOWN;

    companion object {
        @Suppress("unused")
        fun fromString(value: String): ParentType {
            return entries.find { it.name == value } ?: UNKNOWN
        }
    }
}

/**
 * Processing status enumeration matching iOS ProcessingStatus.
 */
enum class ProcessingStatus {
    @SerializedName("READY") READY,
    @SerializedName("PENDING") PENDING,
    @SerializedName("FAILED") FAILED,
    UNKNOWN;

    companion object {
        @Suppress("unused")
        fun fromString(value: String): ProcessingStatus {
            return entries.find { it.name == value } ?: UNKNOWN
        }
    }
}

/**
 * Media model matching iOS Media.swift implementation.
 */
data class Media(
    @SerializedName("id")
    val id: String,

    @SerializedName("property_ref")
    val propertyRef: String? = null,

    @SerializedName("service_request")
    val serviceRequest: String? = null,

    @SerializedName("service_report")
    val serviceReport: String? = null,

    @SerializedName("report_photo_type")
    val reportPhotoType: String? = null,

    @SerializedName("uploader")
    val uploader: String,

    @SerializedName("file")
    val file: String,

    @SerializedName("file_type")
    val fileType: String,

    @SerializedName("file_size")
    val fileSize: Int,

    @SerializedName("title")
    val title: String,

    @SerializedName("description")
    val description: String,

    @SerializedName("upload_date")
    val uploadDate: Date,

    @SerializedName("file_url")
    val fileUrl: String,

    @SerializedName("thumbnail_small_url")
    val thumbnailSmallUrl: String? = null,

    @SerializedName("thumbnail_medium_url")
    val thumbnailMediumUrl: String? = null,

    @SerializedName("thumbnail_large_url")
    val thumbnailLargeUrl: String? = null,

    @SerializedName("is_image")
    val isImage: Boolean,

    @SerializedName("is_video")
    val isVideo: Boolean,

    @SerializedName("media_type")
    val mediaType: MediaType,

    @SerializedName("media_sub_type")
    val mediaSubType: String,

    @SerializedName("location_type")
    val locationType: String,

    @SerializedName("location_sub_type")
    val locationSubType: String,

    @SerializedName("location_display")
    val locationDisplay: String? = null,

    @SerializedName("parent_type")
    val parentType: ParentType,

    @SerializedName("original_filename")
    val originalFilename: String,

    @SerializedName("mime_type")
    val mimeType: String,

    @SerializedName("processing_status")
    val processingStatus: ProcessingStatus,

    @SerializedName("is_ready")
    val isReady: Boolean
) {
    /**
     * Check if this media is a 3D model.
     */
    @Suppress("unused")
    val is3DModel: Boolean
        get() = mediaType == MediaType.THREE_D_MODEL ||
                mimeType.contains("usdz") ||
                mimeType.contains("model/")
}
