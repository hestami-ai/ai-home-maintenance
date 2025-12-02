package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.GLSurfaceView
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import timber.log.Timber
import kotlin.math.max
import kotlin.math.min

/**
 * Custom GLSurfaceView for displaying 360° panorama images.
 * Handles touch gestures for panning and zooming.
 */
class PanoramaGLSurfaceView(context: Context) : GLSurfaceView(context) {
    
    private val renderer = PanoramaGLRenderer()
    private val gestureDetector: GestureDetector
    private val scaleGestureDetector: ScaleGestureDetector
    
    // Touch tracking
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isDragging = false
    
    // Sensitivity
    private val rotationSensitivity = 0.15f
    
    var onError: ((String) -> Unit)? = null
        set(value) {
            field = value
            renderer.onError = value
        }
    
    var onReady: (() -> Unit)? = null
        set(value) {
            field = value
            renderer.onReady = value
        }
    
    init {
        // Use OpenGL ES 2.0
        setEGLContextClientVersion(2)
        
        // Set renderer
        setRenderer(renderer)
        
        // Render only when requested (better battery life)
        renderMode = RENDERMODE_CONTINUOUSLY
        
        // Gesture detector for double-tap to reset
        gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDoubleTap(e: MotionEvent): Boolean {
                resetView()
                return true
            }
        })
        
        // Scale gesture detector for pinch-to-zoom
        scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                val scaleFactor = detector.scaleFactor
                // Inverse scale factor for intuitive zoom (pinch out = zoom in = lower FOV)
                renderer.fieldOfView /= scaleFactor
                renderer.updateFieldOfView()
                return true
            }
        })
    }
    
    override fun onTouchEvent(event: MotionEvent): Boolean {
        // Handle scale gestures first
        scaleGestureDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        
        // Don't process drag if scaling
        if (scaleGestureDetector.isInProgress) {
            return true
        }
        
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x
                lastTouchY = event.y
                isDragging = true
            }
            MotionEvent.ACTION_MOVE -> {
                if (isDragging && event.pointerCount == 1) {
                    val deltaX = event.x - lastTouchX
                    val deltaY = event.y - lastTouchY
                    
                    // Update rotation (invert X for natural panning)
                    renderer.rotationY -= deltaX * rotationSensitivity
                    renderer.rotationX += deltaY * rotationSensitivity
                    
                    // Clamp pitch to prevent flipping
                    renderer.rotationX = max(-85f, min(85f, renderer.rotationX))
                    
                    lastTouchX = event.x
                    lastTouchY = event.y
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                isDragging = false
            }
        }
        
        return true
    }
    
    /**
     * Load a panorama image from a bitmap.
     */
    fun setPanoramaBitmap(bitmap: Bitmap) {
        Timber.d("Setting panorama bitmap: ${bitmap.width}x${bitmap.height}")
        
        // Scale down if too large for GPU
        val maxTextureSize = 4096
        val scaledBitmap = if (bitmap.width > maxTextureSize || bitmap.height > maxTextureSize) {
            val scale = min(
                maxTextureSize.toFloat() / bitmap.width,
                maxTextureSize.toFloat() / bitmap.height
            )
            val newWidth = (bitmap.width * scale).toInt()
            val newHeight = (bitmap.height * scale).toInt()
            Timber.d("Scaling panorama from ${bitmap.width}x${bitmap.height} to ${newWidth}x${newHeight}")
            Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true).also {
                if (it != bitmap) {
                    bitmap.recycle()
                }
            }
        } else {
            bitmap
        }
        
        renderer.setPanoramaBitmap(scaledBitmap)
    }
    
    /**
     * Load a panorama image from byte array.
     */
    fun setPanoramaFromBytes(bytes: ByteArray) {
        try {
            val options = BitmapFactory.Options().apply {
                inPreferredConfig = Bitmap.Config.RGB_565 // Use less memory
            }
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
            if (bitmap != null) {
                setPanoramaBitmap(bitmap)
            } else {
                onError?.invoke("Failed to decode image")
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to decode panorama image")
            onError?.invoke("Failed to decode image: ${e.message}")
        }
    }
    
    /**
     * Reset view to initial position.
     */
    fun resetView() {
        renderer.resetView()
    }
    
    /**
     * Clean up resources.
     */
    fun cleanup() {
        queueEvent {
            renderer.cleanup()
        }
    }
}
