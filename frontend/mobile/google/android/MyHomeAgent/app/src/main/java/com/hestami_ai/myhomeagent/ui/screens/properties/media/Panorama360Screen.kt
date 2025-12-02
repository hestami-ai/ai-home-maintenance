package com.hestami_ai.myhomeagent.ui.screens.properties.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Vrpano
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.net.URL

/**
 * 360° Panorama viewer screen using native OpenGL ES.
 * Displays equirectangular panorama images in an interactive spherical view.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Panorama360Screen(
    media: Media,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = media.title?.ifEmpty { "360° View" } ?: "360° View",
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
                        onClick = onNavigateBack,
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
            // Native OpenGL panorama rendering
            Panorama360GLView(
                imageUrl = NetworkModule.rewriteMediaUrl(media.fileUrl),
                onLoadingChanged = { loading -> isLoading = loading },
                onError = { error -> errorMessage = error },
                modifier = Modifier.fillMaxSize()
            )
            
            // Loading indicator
            if (isLoading) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(
                        color = AppColors.AccentPrimary,
                        modifier = Modifier.size(48.dp)
                    )
                    Text(
                        text = "Loading 360° view...",
                        color = AppColors.PrimaryText,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 16.dp)
                    )
                }
            }
            
            // Error state
            errorMessage?.let { error ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Vrpano,
                        contentDescription = null,
                        tint = AppColors.ErrorColor,
                        modifier = Modifier.size(64.dp)
                    )
                    Text(
                        text = "Failed to load 360° view",
                        color = AppColors.ErrorColor,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(top = 16.dp)
                    )
                    Text(
                        text = error,
                        color = AppColors.SecondaryText,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
    }
}

/**
 * Native OpenGL ES component that renders 360° panorama.
 * Downloads the image and renders it on a sphere using OpenGL.
 */
@Composable
fun Panorama360GLView(
    imageUrl: String,
    onLoadingChanged: (Boolean) -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var imageBytes by remember { mutableStateOf<ByteArray?>(null) }
    
    // Download image in background
    LaunchedEffect(imageUrl) {
        Timber.d("Downloading panorama image: $imageUrl")
        try {
            val bytes = withContext(Dispatchers.IO) {
                val url = URL(imageUrl)
                val connection = url.openConnection()
                connection.connectTimeout = 30000
                connection.readTimeout = 30000
                
                val data = connection.getInputStream().use { it.readBytes() }
                Timber.d("Downloaded panorama: ${data.size} bytes")
                data
            }
            imageBytes = bytes
        } catch (e: Exception) {
            Timber.e(e, "Failed to download panorama image")
            onError(e.message ?: "Failed to download image")
        }
    }
    
    val glSurfaceView = remember {
        PanoramaGLSurfaceView(context).apply {
            this.onError = { error ->
                Timber.e("Panorama GL error: $error")
                onError(error)
            }
            this.onReady = {
                Timber.d("Panorama GL renderer ready")
            }
        }
    }
    
    // Load image into GL view when downloaded
    LaunchedEffect(imageBytes) {
        imageBytes?.let { bytes ->
            Timber.d("Loading panorama into GL view")
            glSurfaceView.setPanoramaFromBytes(bytes)
            onLoadingChanged(false)
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            glSurfaceView.cleanup()
        }
    }
    
    AndroidView(
        factory = { glSurfaceView },
        modifier = modifier
    )
}
