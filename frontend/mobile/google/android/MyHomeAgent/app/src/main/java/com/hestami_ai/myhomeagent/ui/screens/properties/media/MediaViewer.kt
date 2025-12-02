package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.model.MediaType
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.theme.AppColors

/**
 * Full-screen media viewer for images, videos, and 3D models.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediaViewer(
    media: Media,
    onDismiss: () -> Unit,
    onView3DModel: ((Media) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (media.mediaSubType == "360_DEGREE") {
                                media.title?.ifEmpty { "360° View" } ?: "360° View"
                            } else {
                                media.title?.ifEmpty { "Media" } ?: "Media"
                            },
                            color = AppColors.PrimaryText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        media.locationDisplay?.let { location ->
                            Text(
                                text = location,
                                color = AppColors.SecondaryText,
                                fontSize = 12.sp
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .padding(8.dp)
                            .background(
                                AppColors.PrimaryBackground.copy(alpha = 0.7f),
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = AppColors.PrimaryText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        },
        containerColor = Color.Black
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentAlignment = Alignment.Center
        ) {
            // Check for 360° panorama first
            if (media.mediaSubType == "360_DEGREE") {
                Panorama360GLView(
                    imageUrl = NetworkModule.rewriteMediaUrl(media.fileUrl),
                    onLoadingChanged = { /* handled internally */ },
                    onError = { /* handled internally */ },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                when (media.mediaType) {
                    MediaType.IMAGE -> {
                        ZoomableImage(
                            media = media,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    MediaType.VIDEO -> {
                        VideoPlayer(
                            media = media,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    MediaType.THREE_D_MODEL -> {
                        ThreeDModelPlaceholder(
                            media = media,
                            onView3DModel = onView3DModel,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    else -> {
                        // Fallback for unknown types
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Image,
                                contentDescription = null,
                                tint = AppColors.SecondaryText,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Unsupported media type",
                                color = AppColors.SecondaryText,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Zoomable image viewer with pinch-to-zoom and pan.
 */
@Composable
fun ZoomableImage(
    media: Media,
    modifier: Modifier = Modifier
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    var isLoading by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = NetworkModule.rewriteMediaUrl(media.fileUrl),
            contentDescription = media.title,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offsetX,
                    translationY = offsetY
                )
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        scale = (scale * zoom).coerceIn(1f, 5f)
                        if (scale > 1f) {
                            offsetX += pan.x
                            offsetY += pan.y
                        } else {
                            offsetX = 0f
                            offsetY = 0f
                        }
                    }
                },
            contentScale = ContentScale.Fit,
            onState = { state ->
                isLoading = state is AsyncImagePainter.State.Loading
                hasError = state is AsyncImagePainter.State.Error
            }
        )
        
        if (isLoading) {
            CircularProgressIndicator(
                color = AppColors.AccentPrimary,
                modifier = Modifier.size(48.dp)
            )
        }
        
        if (hasError) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Image,
                    contentDescription = null,
                    tint = AppColors.SecondaryText,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Failed to load image",
                    color = AppColors.SecondaryText,
                    fontSize = 16.sp
                )
            }
        }
    }
}

/**
 * Video player using ExoPlayer.
 */
@Composable
fun VideoPlayer(
    media: Media,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            val mediaItem = MediaItem.fromUri(NetworkModule.rewriteMediaUrl(media.fileUrl))
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
            repeatMode = Player.REPEAT_MODE_OFF
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            exoPlayer.release()
        }
    }
    
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                useController = true
                setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
            }
        },
        modifier = modifier
    )
}

/**
 * Placeholder for 3D models with option to open in 3D viewer.
 */
@Composable
fun ThreeDModelPlaceholder(
    media: Media,
    onView3DModel: ((Media) -> Unit)?,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.ViewInAr,
            contentDescription = null,
            tint = AppColors.AccentPrimary,
            modifier = Modifier.size(80.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = media.title.ifEmpty { "3D Model" },
            color = AppColors.PrimaryText,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = media.originalFilename,
            color = AppColors.SecondaryText,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        if (onView3DModel != null) {
            androidx.compose.material3.Button(
                onClick = { onView3DModel(media) },
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = AppColors.AccentPrimary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.ViewInAr,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.size(8.dp))
                Text(
                    text = "View 3D Model",
                    fontWeight = FontWeight.SemiBold
                )
            }
        } else {
            Text(
                text = "3D model viewing coming soon",
                color = AppColors.SecondaryText,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
