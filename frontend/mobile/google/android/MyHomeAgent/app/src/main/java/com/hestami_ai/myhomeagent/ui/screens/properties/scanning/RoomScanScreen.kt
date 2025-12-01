package com.hestami_ai.myhomeagent.ui.screens.properties.scanning

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import timber.log.Timber

/**
 * Scan state for the room scanning process.
 */
enum class ScanState {
    CHECKING_AVAILABILITY,
    NOT_SUPPORTED,
    NEEDS_PERMISSION,
    READY,
    SCANNING,
    PROCESSING,
    COMPLETED,
    ERROR
}

/**
 * ARCore availability status.
 */
sealed class ARCoreStatus {
    object Checking : ARCoreStatus()
    object Supported : ARCoreStatus()
    object SupportedNeedsInstall : ARCoreStatus()
    object NotSupported : ARCoreStatus()
    data class Error(val message: String) : ARCoreStatus()
}

/**
 * Room scan screen using ARCore for 3D scanning.
 * This provides a basic implementation that can be expanded with full ARCore depth scanning.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomScanScreen(
    propertyId: String,
    onNavigateBack: () -> Unit,
    onScanComplete: (String) -> Unit, // Returns path to saved scan
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var scanState by remember { mutableStateOf(ScanState.CHECKING_AVAILABILITY) }
    var arCoreStatus by remember { mutableStateOf<ARCoreStatus>(ARCoreStatus.Checking) }
    var hasDepthSupport by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var hasCameraPermission by remember { mutableStateOf(false) }
    
    // Camera permission launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (isGranted && arCoreStatus is ARCoreStatus.Supported) {
            scanState = ScanState.READY
        } else if (!isGranted) {
            scanState = ScanState.NEEDS_PERMISSION
        }
    }
    
    // Check ARCore availability on launch
    LaunchedEffect(Unit) {
        // Check camera permission first
        hasCameraPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        
        // Check ARCore availability
        arCoreStatus = checkARCoreAvailability(context)
        
        when (arCoreStatus) {
            is ARCoreStatus.Supported -> {
                hasDepthSupport = checkDepthSupport(context)
                if (hasCameraPermission) {
                    scanState = ScanState.READY
                } else {
                    scanState = ScanState.NEEDS_PERMISSION
                }
            }
            is ARCoreStatus.SupportedNeedsInstall -> {
                scanState = ScanState.NOT_SUPPORTED
                errorMessage = "ARCore needs to be installed. Please install Google Play Services for AR."
            }
            is ARCoreStatus.NotSupported -> {
                scanState = ScanState.NOT_SUPPORTED
                errorMessage = "This device does not support ARCore. Room scanning requires a compatible device with ARCore support."
            }
            is ARCoreStatus.Error -> {
                scanState = ScanState.ERROR
                errorMessage = (arCoreStatus as ARCoreStatus.Error).message
            }
            else -> {}
        }
    }
    
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Room Scan",
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (scanState) {
                ScanState.CHECKING_AVAILABILITY -> {
                    CheckingAvailabilityContent()
                }
                ScanState.NOT_SUPPORTED -> {
                    NotSupportedContent(
                        message = errorMessage,
                        onBack = onNavigateBack
                    )
                }
                ScanState.NEEDS_PERMISSION -> {
                    PermissionRequiredContent(
                        onRequestPermission = {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    )
                }
                ScanState.READY -> {
                    ReadyToScanContent(
                        hasDepthSupport = hasDepthSupport,
                        onStartScan = {
                            scanState = ScanState.SCANNING
                        }
                    )
                }
                ScanState.SCANNING -> {
                    ScanningContent(
                        hasDepthSupport = hasDepthSupport,
                        onStopScan = {
                            scanState = ScanState.PROCESSING
                        },
                        onCancel = {
                            scanState = ScanState.READY
                        }
                    )
                }
                ScanState.PROCESSING -> {
                    ProcessingContent()
                    // Simulate processing
                    LaunchedEffect(Unit) {
                        kotlinx.coroutines.delay(2000)
                        scanState = ScanState.COMPLETED
                    }
                }
                ScanState.COMPLETED -> {
                    CompletedContent(
                        onSave = {
                            // TODO: Save scan and return path
                            onScanComplete("scan_${System.currentTimeMillis()}.usdz")
                        },
                        onDiscard = {
                            scanState = ScanState.READY
                        }
                    )
                }
                ScanState.ERROR -> {
                    ErrorContent(
                        message = errorMessage,
                        onRetry = {
                            scanState = ScanState.CHECKING_AVAILABILITY
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun CheckingAvailabilityContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            androidx.compose.material3.CircularProgressIndicator(
                color = AppColors.AccentPrimary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Checking device compatibility...",
                color = AppColors.PrimaryText,
                fontSize = 16.sp
            )
        }
    }
}

@Composable
private fun NotSupportedContent(
    message: String,
    onBack: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = AppColors.WarningColor,
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Room Scanning Not Available",
                color = AppColors.PrimaryText,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = message,
                color = AppColors.SecondaryText,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Button(
                onClick = onBack,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppColors.AccentPrimary
                )
            ) {
                Text("Go Back")
            }
        }
    }
}

@Composable
private fun PermissionRequiredContent(
    onRequestPermission: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.CameraAlt,
                contentDescription = null,
                tint = AppColors.AccentPrimary,
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Camera Permission Required",
                color = AppColors.PrimaryText,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Room scanning requires camera access to capture your space in 3D.",
                color = AppColors.SecondaryText,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Button(
                onClick = onRequestPermission,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppColors.AccentPrimary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Grant Permission")
            }
        }
    }
}

@Composable
private fun ReadyToScanContent(
    hasDepthSupport: Boolean,
    onStartScan: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.ViewInAr,
            contentDescription = null,
            tint = AppColors.AccentPrimary,
            modifier = Modifier.size(100.dp)
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(
            text = "Ready to Scan",
            color = AppColors.PrimaryText,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Depth support indicator
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (hasDepthSupport) 
                    AppColors.SuccessColor.copy(alpha = 0.1f) 
                else 
                    AppColors.WarningColor.copy(alpha = 0.1f)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (hasDepthSupport) Icons.Default.Check else Icons.Default.Info,
                    contentDescription = null,
                    tint = if (hasDepthSupport) AppColors.SuccessColor else AppColors.WarningColor,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (hasDepthSupport) "Depth Sensor Available" else "Basic Scanning Mode",
                        color = AppColors.PrimaryText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = if (hasDepthSupport) 
                            "Your device supports enhanced 3D scanning with depth sensor" 
                        else 
                            "Scanning will use camera-based reconstruction",
                        color = AppColors.SecondaryText,
                        fontSize = 12.sp
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Instructions
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Scanning Tips",
                    color = AppColors.PrimaryText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(12.dp))
                ScanTip("Move slowly and steadily around the room")
                ScanTip("Ensure good lighting conditions")
                ScanTip("Keep the camera pointed at surfaces")
                ScanTip("Scan all walls, floor, and ceiling")
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = onStartScan,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.AccentPrimary
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.PlayArrow,
                contentDescription = null,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Start Scanning",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun ScanTip(text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(AppColors.AccentPrimary, CircleShape)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = text,
            color = AppColors.SecondaryText,
            fontSize = 14.sp
        )
    }
}

@Composable
private fun ScanningContent(
    hasDepthSupport: Boolean,
    onStopScan: () -> Unit,
    onCancel: () -> Unit
) {
    // TODO: Implement actual ARCore scanning view
    // This is a placeholder that would be replaced with ARCore SceneView
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Placeholder for AR camera view
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.SecondaryBackground),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.ViewInAr,
                    contentDescription = null,
                    tint = AppColors.AccentPrimary,
                    modifier = Modifier.size(80.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Scanning in progress...",
                    color = AppColors.PrimaryText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Move around to capture the room",
                    color = AppColors.SecondaryText,
                    fontSize = 14.sp
                )
            }
        }
        
        // Controls overlay
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Cancel button
                IconButton(
                    onClick = onCancel,
                    modifier = Modifier
                        .size(56.dp)
                        .background(AppColors.ErrorColor, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Cancel",
                        tint = AppColors.ButtonText,
                        modifier = Modifier.size(28.dp)
                    )
                }
                
                // Stop/Complete button
                IconButton(
                    onClick = onStopScan,
                    modifier = Modifier
                        .size(72.dp)
                        .background(AppColors.AccentPrimary, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Stop,
                        contentDescription = "Stop Scanning",
                        tint = AppColors.ButtonText,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ProcessingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            androidx.compose.material3.CircularProgressIndicator(
                color = AppColors.AccentPrimary,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Processing Scan...",
                color = AppColors.PrimaryText,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Creating 3D model of your room",
                color = AppColors.SecondaryText,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun CompletedContent(
    onSave: () -> Unit,
    onDiscard: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Check,
            contentDescription = null,
            tint = AppColors.SuccessColor,
            modifier = Modifier.size(100.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "Scan Complete!",
            color = AppColors.PrimaryText,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "Your room has been captured. Would you like to save this scan?",
            color = AppColors.SecondaryText,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = onSave,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.AccentPrimary
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = "Save Scan",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Button(
            onClick = onDiscard,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.SecondaryBackground
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = "Discard & Scan Again",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
        }
    }
}

@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = AppColors.ErrorColor,
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Something went wrong",
                color = AppColors.PrimaryText,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = message,
                color = AppColors.SecondaryText,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AppColors.AccentPrimary
                )
            ) {
                Text("Try Again")
            }
        }
    }
}

// Helper functions

private fun checkARCoreAvailability(context: Context): ARCoreStatus {
    return try {
        val availability = ArCoreApk.getInstance().checkAvailability(context)
        when {
            availability.isSupported -> ARCoreStatus.Supported
            availability == ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD ||
            availability == ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> {
                ARCoreStatus.SupportedNeedsInstall
            }
            else -> ARCoreStatus.NotSupported
        }
    } catch (e: Exception) {
        Timber.e(e, "Error checking ARCore availability")
        ARCoreStatus.Error(e.message ?: "Unknown error")
    }
}

private fun checkDepthSupport(context: Context): Boolean {
    return try {
        val session = Session(context)
        val config = Config(session)
        val depthSupported = session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)
        session.close()
        depthSupported
    } catch (e: Exception) {
        Timber.e(e, "Error checking depth support")
        false
    }
}
