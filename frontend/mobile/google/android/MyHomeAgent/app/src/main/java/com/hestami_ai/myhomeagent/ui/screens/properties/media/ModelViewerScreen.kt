package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.MimeTypeMap
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.io.FileInputStream
import java.net.URL

/**
 * Screen for viewing 3D models (USDZ, GLTF, GLB) using Three.js in a WebView.
 */
@Suppress("UNNECESSARY_SAFE_CALL")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelViewerScreen(
    media: Media,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val modelUrl = NetworkModule.rewriteMediaUrl(media.fileUrl)
    
    var isLoading by remember { mutableStateOf(true) }
    var isDownloading by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var localModelFile by remember { mutableStateOf<File?>(null) }
    
    // Download the model file to avoid CORS issues
    LaunchedEffect(modelUrl) {
        try {
            isDownloading = true
            Timber.d("Downloading 3D model from: $modelUrl")
            
            val file = withContext(Dispatchers.IO) {
                val cacheDir = File(context.cacheDir, "models")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                
                // Use media ID as filename to cache
                val extension = media.originalFilename?.substringAfterLast('.', "usdz") ?: "usdz"
                val localFile = File(cacheDir, "${media.id}.$extension")
                
                // Download if not cached or cache is old (> 1 hour)
                if (!localFile.exists() || System.currentTimeMillis() - localFile.lastModified() > 3600000) {
                    val url = URL(modelUrl)
                    val connection = url.openConnection()
                    connection.connectTimeout = 30000
                    connection.readTimeout = 60000
                    
                    connection.getInputStream().use { input ->
                        localFile.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                    Timber.d("Downloaded model to: ${localFile.absolutePath}")
                } else {
                    Timber.d("Using cached model: ${localFile.absolutePath}")
                }
                
                localFile
            }
            
            localModelFile = file
            isDownloading = false
        } catch (e: Exception) {
            Timber.e(e, "Failed to download 3D model")
            hasError = true
            errorMessage = "Failed to download model: ${e.message}"
            isDownloading = false
            isLoading = false
        }
    }
    
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = media.title?.ifEmpty { "3D Model" } ?: "3D Model",
                            color = AppColors.PrimaryText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = media.originalFilename ?: "model.usdz",
                            color = AppColors.SecondaryText,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Only show WebView once model is downloaded
            localModelFile?.let { modelFile ->
                ModelWebView(
                    modelFile = modelFile,
                    onLoadingChanged = { isLoading = it },
                    onError = { message ->
                        hasError = true
                        errorMessage = message
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
            
            // Loading indicator (downloading or WebView loading)
            if ((isDownloading || isLoading) && !hasError) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(AppColors.PrimaryBackground.copy(alpha = 0.8f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(
                            color = AppColors.AccentPrimary,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = if (isDownloading) "Downloading 3D Model..." else "Loading 3D Model...",
                            color = AppColors.PrimaryText,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(top = 16.dp)
                        )
                    }
                }
            }
            
            // Error state
            if (hasError) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(AppColors.PrimaryBackground),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ViewInAr,
                            contentDescription = null,
                            tint = AppColors.ErrorColor,
                            modifier = Modifier.size(64.dp)
                        )
                        Text(
                            text = "Failed to load 3D model",
                            color = AppColors.PrimaryText,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 16.dp)
                        )
                        Text(
                            text = errorMessage.ifEmpty { "Please try again later" },
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
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun ModelWebView(
    modelFile: File,
    onLoadingChanged: (Boolean) -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    
    // Create asset loader to serve local files with proper CORS headers
    val assetLoader = remember {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .addPathHandler("/model/", object : WebViewAssetLoader.PathHandler {
                override fun handle(path: String): WebResourceResponse? {
                    return try {
                        val extension = modelFile.extension.lowercase()
                        val mimeType = when (extension) {
                            "usdz" -> "model/vnd.usdz+zip"
                            "glb" -> "model/gltf-binary"
                            "gltf" -> "model/gltf+json"
                            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "application/octet-stream"
                        }
                        Timber.d("Serving model file: ${modelFile.absolutePath} as $mimeType")
                        WebResourceResponse(
                            mimeType,
                            null,
                            FileInputStream(modelFile)
                        ).apply {
                            // Add CORS headers
                            responseHeaders = mapOf(
                                "Access-Control-Allow-Origin" to "*",
                                "Access-Control-Allow-Methods" to "GET",
                                "Cache-Control" to "max-age=3600"
                            )
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to serve model file")
                        null
                    }
                }
            })
            .build()
    }
    
    val webView = remember {
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
                
                // Enable hardware acceleration for WebGL
                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                
                // Enable WebGL
                mediaPlaybackRequiresUserGesture = false
            }
            
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val url = request?.url
                    Timber.d("WebView requesting: $url")
                    return url?.let { assetLoader.shouldInterceptRequest(it) }
                        ?: super.shouldInterceptRequest(view, request)
                }
                
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Timber.d("WebView page finished: $url")
                    // Give Three.js time to initialize
                    postDelayed({ onLoadingChanged(false) }, 1000)
                }
                
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    val errorDescription = error?.description?.toString() ?: "Unknown error"
                    val requestUrl = request?.url?.toString() ?: "unknown"
                    Timber.e("WebView error for $requestUrl: ${error?.errorCode} - $errorDescription")
                    // Only report error for main frame
                    if (request?.isForMainFrame == true) {
                        onError(errorDescription)
                    }
                }
                
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false
                }
            }
            
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    consoleMessage?.let {
                        when (it.messageLevel()) {
                            ConsoleMessage.MessageLevel.ERROR -> {
                                Timber.e("WebView Console: ${it.message()}")
                                // Check if it's a model loading error (but not CORS since we handle that now)
                                if ((it.message().contains("Failed to load") || 
                                    it.message().contains("Error loading")) &&
                                    !it.message().contains("CORS")) {
                                    onError(it.message())
                                }
                            }
                            ConsoleMessage.MessageLevel.WARNING -> {
                                Timber.w("WebView Console: ${it.message()}")
                            }
                            else -> {
                                Timber.d("WebView Console: ${it.message()}")
                            }
                        }
                    }
                    return true
                }
            }
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            webView.destroy()
        }
    }
    
    AndroidView(
        factory = { webView },
        modifier = modifier,
        update = { view ->
            // Load the model viewer HTML using asset loader URL scheme
            // The model will be served from /model/model.usdz (or appropriate extension)
            val modelFileName = "model.${modelFile.extension}"
            val htmlUrl = "https://appassets.androidplatform.net/assets/model_viewer.html?src=https://appassets.androidplatform.net/model/$modelFileName"
            Timber.d("Loading model viewer with URL: $htmlUrl")
            view.loadUrl(htmlUrl)
            onLoadingChanged(true)
        }
    )
}
