package com.hestami_ai.myhomeagent.ui.screens.properties.media

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material.icons.filled.Vrpano
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.model.MediaType
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.theme.AppColors

/**
 * Media section types matching iOS PropertyMediaGalleryView.
 */
enum class MediaSection(val displayName: String, val icon: ImageVector) {
    VIRTUAL_TOUR("Virtual Tour", Icons.Default.Vrpano),
    FLOORPLANS("Floorplans", Icons.Default.Map),
    THREE_D_MODELS("3D Models", Icons.Default.ViewInAr),
    VIDEOS("Videos", Icons.Default.PlayCircle),
    IMAGES("Images", Icons.Default.Image)
}

/**
 * Property media gallery view matching iOS PropertyMediaGalleryView.
 * Displays media organized by sections.
 */
@Composable
fun PropertyMediaGallery(
    media: List<Media>,
    onMediaClick: (Media) -> Unit,
    modifier: Modifier = Modifier
) {
    val virtualTourMedia = media.filter { it.mediaSubType == "360_DEGREE" }
    val floorplanMedia = media.filter { it.mediaSubType == "FLOORPLAN" }
    val threeDModelMedia = media.filter { 
        it.mediaType == MediaType.THREE_D_MODEL || 
        it.mimeType.contains("usdz") || 
        it.mimeType.contains("model/")
    }
    val videoMedia = media.filter { 
        it.mediaType == MediaType.VIDEO && 
        it.mediaSubType != "FLOORPLAN" && 
        it.mediaSubType != "360_DEGREE" 
    }
    val imageMedia = media.filter { 
        it.mediaType == MediaType.IMAGE && 
        it.mediaSubType != "FLOORPLAN" && 
        it.mediaSubType != "360_DEGREE" 
    }
    
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (virtualTourMedia.isNotEmpty()) {
            MediaSectionView(
                section = MediaSection.VIRTUAL_TOUR,
                media = virtualTourMedia,
                onMediaClick = onMediaClick
            )
        }
        
        if (floorplanMedia.isNotEmpty()) {
            MediaSectionView(
                section = MediaSection.FLOORPLANS,
                media = floorplanMedia,
                onMediaClick = onMediaClick
            )
        }
        
        if (threeDModelMedia.isNotEmpty()) {
            MediaSectionView(
                section = MediaSection.THREE_D_MODELS,
                media = threeDModelMedia,
                onMediaClick = onMediaClick
            )
        }
        
        if (videoMedia.isNotEmpty()) {
            MediaSectionView(
                section = MediaSection.VIDEOS,
                media = videoMedia,
                onMediaClick = onMediaClick
            )
        }
        
        if (imageMedia.isNotEmpty()) {
            MediaSectionView(
                section = MediaSection.IMAGES,
                media = imageMedia,
                onMediaClick = onMediaClick
            )
        }
    }
}

/**
 * Expandable media section view.
 */
@Composable
fun MediaSectionView(
    section: MediaSection,
    media: List<Media>,
    onMediaClick: (Media) -> Unit,
    modifier: Modifier = Modifier,
    initiallyExpanded: Boolean = false
) {
    var isExpanded by remember { mutableStateOf(initiallyExpanded) }
    val rotationAngle by animateFloatAsState(
        targetValue = if (isExpanded) 180f else 0f,
        label = "rotation"
    )
    
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = section.icon,
                    contentDescription = null,
                    tint = AppColors.AccentPrimary,
                    modifier = Modifier.size(24.dp)
                )
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Text(
                    text = section.displayName,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText,
                    modifier = Modifier.weight(1f)
                )
                
                Text(
                    text = "${media.size}",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText,
                    modifier = Modifier.padding(end = 8.dp)
                )
                
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = AppColors.SecondaryText,
                    modifier = Modifier
                        .size(24.dp)
                        .rotate(rotationAngle)
                )
            }
            
            // Content
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                MediaThumbnailGrid(
                    media = media,
                    onMediaClick = onMediaClick,
                    modifier = Modifier.padding(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 16.dp
                    )
                )
            }
        }
    }
}

/**
 * Grid of media thumbnails.
 */
@Composable
fun MediaThumbnailGrid(
    media: List<Media>,
    onMediaClick: (Media) -> Unit,
    modifier: Modifier = Modifier,
    columns: Int = 3
) {
    // Use a fixed height grid instead of LazyVerticalGrid to avoid nested scrolling issues
    val rows = (media.size + columns - 1) / columns
    
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        for (rowIndex in 0 until rows) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                for (colIndex in 0 until columns) {
                    val index = rowIndex * columns + colIndex
                    if (index < media.size) {
                        MediaThumbnail(
                            media = media[index],
                            onClick = { onMediaClick(media[index]) },
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        // Empty spacer to maintain grid alignment
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/**
 * Single media thumbnail.
 */
@Composable
fun MediaThumbnail(
    media: Media,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.SecondaryBackground)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        // Thumbnail image
        val thumbnailUrl = media.thumbnailMediumUrl 
            ?: media.thumbnailSmallUrl 
            ?: if (media.isImage) media.fileUrl else null
        
        if (thumbnailUrl != null) {
            AsyncImage(
                model = NetworkModule.rewriteMediaUrl(thumbnailUrl),
                contentDescription = media.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            // Placeholder icon based on media type
            Icon(
                imageVector = when (media.mediaType) {
                    MediaType.VIDEO -> Icons.Default.PlayCircle
                    MediaType.THREE_D_MODEL -> Icons.Default.ViewInAr
                    else -> Icons.Default.Image
                },
                contentDescription = null,
                tint = AppColors.SecondaryText,
                modifier = Modifier.size(32.dp)
            )
        }
        
        // Overlay for videos and 3D models
        if (media.mediaType == MediaType.VIDEO || media.mediaType == MediaType.THREE_D_MODEL) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(AppColors.PrimaryBackground.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (media.mediaType) {
                        MediaType.VIDEO -> Icons.Default.PlayCircle
                        MediaType.THREE_D_MODEL -> Icons.Default.ViewInAr
                        else -> Icons.Default.Image
                    },
                    contentDescription = null,
                    tint = AppColors.PrimaryText,
                    modifier = Modifier.size(40.dp)
                )
            }
        }
        
        // 360° badge for virtual tours
        if (media.mediaSubType == "360_DEGREE") {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp)
                    .background(
                        AppColors.AccentPrimary,
                        RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 4.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "360°",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.ButtonText
                )
            }
        }
    }
}
