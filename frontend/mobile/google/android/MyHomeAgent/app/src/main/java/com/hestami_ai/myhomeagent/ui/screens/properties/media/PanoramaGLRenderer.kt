package com.hestami_ai.myhomeagent.ui.screens.properties.media

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.opengl.Matrix
import timber.log.Timber
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * OpenGL ES 2.0 renderer for 360° equirectangular panorama images.
 * Renders the panorama on the inside of a sphere for immersive viewing.
 */
class PanoramaGLRenderer : GLSurfaceView.Renderer {
    
    // Matrices
    private val projectionMatrix = FloatArray(16)
    private val viewMatrix = FloatArray(16)
    private val mvpMatrix = FloatArray(16)
    
    // Camera angles (in degrees)
    var rotationX = 0f  // Pitch (up/down)
    var rotationY = 0f  // Yaw (left/right)
    var fieldOfView = 75f
        set(value) {
            field = max(30f, min(120f, value))
        }
    
    // Sphere geometry
    private var vertexBuffer: FloatBuffer? = null
    private var textureBuffer: FloatBuffer? = null
    private var indexBuffer: ShortBuffer? = null
    private var indexCount = 0
    
    // Shader program
    private var shaderProgram = 0
    private var positionHandle = 0
    private var texCoordHandle = 0
    private var mvpMatrixHandle = 0
    private var textureHandle = 0
    
    // Texture
    private var textureId = 0
    private var pendingBitmap: Bitmap? = null
    private var hasPendingTexture = false
    private var textureLoaded = false
    
    // Callbacks
    var onError: ((String) -> Unit)? = null
    var onReady: (() -> Unit)? = null
    
    private var surfaceWidth = 1
    private var surfaceHeight = 1
    
    companion object {
        private const val SPHERE_RADIUS = 100f
        private const val SPHERE_SLICES = 60
        private const val SPHERE_STACKS = 40
        
        private const val VERTEX_SHADER = """
            uniform mat4 uMVPMatrix;
            attribute vec4 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = uMVPMatrix * aPosition;
                vTexCoord = aTexCoord;
            }
        """
        
        private const val FRAGMENT_SHADER = """
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        """
    }
    
    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        Timber.d("onSurfaceCreated called")
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        // Disable depth test - not needed for single sphere
        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        // Disable culling to ensure we see the sphere from inside
        GLES20.glDisable(GLES20.GL_CULL_FACE)
        
        try {
            createSphereGeometry()
            Timber.d("Sphere geometry created, indexCount: $indexCount")
            createShaderProgram()
            Timber.d("Shader program created: $shaderProgram")
            createTexture()
            Timber.d("Texture created: $textureId")
            onReady?.invoke()
        } catch (e: Exception) {
            Timber.e(e, "Failed to initialize panorama renderer")
            onError?.invoke("Failed to initialize: ${e.message}")
        }
    }
    
    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        GLES20.glViewport(0, 0, width, height)
        surfaceWidth = width
        surfaceHeight = height
        updateProjectionMatrix()
    }
    
    private var frameCount = 0
    
    override fun onDrawFrame(gl: GL10?) {
        // Check for pending texture upload
        if (hasPendingTexture && pendingBitmap != null) {
            Timber.d("Uploading pending texture...")
            uploadTexture(pendingBitmap!!)
            pendingBitmap?.recycle()
            pendingBitmap = null
            hasPendingTexture = false
            textureLoaded = true
            Timber.d("Texture upload complete, textureLoaded=$textureLoaded")
        }
        
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        
        // Don't render until texture is loaded
        if (!textureLoaded || shaderProgram == 0) {
            if (frameCount % 60 == 0) {
                Timber.d("Skipping render: textureLoaded=$textureLoaded, shaderProgram=$shaderProgram")
            }
            frameCount++
            return
        }
        
        // Calculate view matrix based on rotation
        val pitchRad = Math.toRadians(rotationX.toDouble()).toFloat()
        val yawRad = Math.toRadians(rotationY.toDouble()).toFloat()
        
        // Camera looks at a point on the sphere based on rotation
        val lookX = cos(pitchRad) * sin(yawRad)
        val lookY = sin(pitchRad)
        val lookZ = cos(pitchRad) * cos(yawRad)
        
        Matrix.setLookAtM(
            viewMatrix, 0,
            0f, 0f, 0f,           // Camera position (center of sphere)
            lookX, lookY, lookZ,   // Look at point
            0f, 1f, 0f             // Up vector
        )
        
        // Combine projection and view matrices
        Matrix.multiplyMM(mvpMatrix, 0, projectionMatrix, 0, viewMatrix, 0)
        
        // Use shader program
        GLES20.glUseProgram(shaderProgram)
        
        // Set MVP matrix
        GLES20.glUniformMatrix4fv(mvpMatrixHandle, 1, false, mvpMatrix, 0)
        
        // Bind texture
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glUniform1i(textureHandle, 0)
        
        // Set vertex attributes
        vertexBuffer?.position(0)
        GLES20.glVertexAttribPointer(positionHandle, 3, GLES20.GL_FLOAT, false, 0, vertexBuffer)
        GLES20.glEnableVertexAttribArray(positionHandle)
        
        textureBuffer?.position(0)
        GLES20.glVertexAttribPointer(texCoordHandle, 2, GLES20.GL_FLOAT, false, 0, textureBuffer)
        GLES20.glEnableVertexAttribArray(texCoordHandle)
        
        // Draw sphere
        GLES20.glDrawElements(GLES20.GL_TRIANGLES, indexCount, GLES20.GL_UNSIGNED_SHORT, indexBuffer)
        
        // Check for GL errors
        val error = GLES20.glGetError()
        if (error != GLES20.GL_NO_ERROR) {
            Timber.e("GL Error after draw: $error")
        } else if (frameCount++ % 60 == 0) {
            Timber.d("Draw complete, indexCount=$indexCount, textureId=$textureId")
        }
        
        // Disable vertex arrays
        GLES20.glDisableVertexAttribArray(positionHandle)
        GLES20.glDisableVertexAttribArray(texCoordHandle)
    }
    
    private fun updateProjectionMatrix() {
        val aspectRatio = surfaceWidth.toFloat() / surfaceHeight.toFloat()
        // Near plane 1, far plane 1000 to ensure sphere at radius 100 is visible
        Matrix.perspectiveM(projectionMatrix, 0, fieldOfView, aspectRatio, 1f, 1000f)
        Timber.d("Projection matrix updated: fov=$fieldOfView, aspect=$aspectRatio")
    }
    
    fun updateFieldOfView() {
        updateProjectionMatrix()
    }
    
    /**
     * Set the panorama bitmap to display.
     * This can be called from any thread - the texture will be uploaded on the GL thread.
     */
    fun setPanoramaBitmap(bitmap: Bitmap) {
        pendingBitmap?.recycle()
        pendingBitmap = bitmap
        hasPendingTexture = true
    }
    
    private fun uploadTexture(bitmap: Bitmap) {
        if (textureId == 0) {
            val textures = IntArray(1)
            GLES20.glGenTextures(1, textures, 0)
            textureId = textures[0]
        }
        
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        
        // Set texture parameters
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        
        // Upload bitmap to texture
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
        
        Timber.d("Uploaded panorama texture: ${bitmap.width}x${bitmap.height}")
    }
    
    private fun createTexture() {
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]
    }
    
    private fun createSphereGeometry() {
        val vertices = mutableListOf<Float>()
        val texCoords = mutableListOf<Float>()
        val indices = mutableListOf<Short>()
        
        // Generate sphere vertices
        for (stack in 0..SPHERE_STACKS) {
            val phi = Math.PI * stack / SPHERE_STACKS
            val sinPhi = sin(phi).toFloat()
            val cosPhi = cos(phi).toFloat()
            
            for (slice in 0..SPHERE_SLICES) {
                val theta = 2 * Math.PI * slice / SPHERE_SLICES
                val sinTheta = sin(theta).toFloat()
                val cosTheta = cos(theta).toFloat()
                
                // Vertex position
                val x = SPHERE_RADIUS * sinPhi * cosTheta
                val y = SPHERE_RADIUS * cosPhi
                val z = SPHERE_RADIUS * sinPhi * sinTheta
                
                vertices.add(x)
                vertices.add(y)
                vertices.add(z)
                
                // Texture coordinates (flipped horizontally for inside view)
                val u = 1f - slice.toFloat() / SPHERE_SLICES
                val v = stack.toFloat() / SPHERE_STACKS
                
                texCoords.add(u)
                texCoords.add(v)
            }
        }
        
        // Generate indices
        for (stack in 0 until SPHERE_STACKS) {
            for (slice in 0 until SPHERE_SLICES) {
                val first = (stack * (SPHERE_SLICES + 1) + slice).toShort()
                val second = (first + SPHERE_SLICES + 1).toShort()
                
                indices.add(first)
                indices.add(second)
                indices.add((first + 1).toShort())
                
                indices.add(second)
                indices.add((second + 1).toShort())
                indices.add((first + 1).toShort())
            }
        }
        
        indexCount = indices.size
        
        // Create vertex buffer
        val vb = ByteBuffer.allocateDirect(vertices.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        vb.put(vertices.toFloatArray())
        vb.position(0)
        vertexBuffer = vb
        
        // Create texture coordinate buffer
        val tb = ByteBuffer.allocateDirect(texCoords.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        tb.put(texCoords.toFloatArray())
        tb.position(0)
        textureBuffer = tb
        
        // Create index buffer
        val ib = ByteBuffer.allocateDirect(indices.size * 2)
            .order(ByteOrder.nativeOrder())
            .asShortBuffer()
        ib.put(indices.toShortArray())
        ib.position(0)
        indexBuffer = ib
    }
    
    private fun createShaderProgram() {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER)
        
        shaderProgram = GLES20.glCreateProgram()
        GLES20.glAttachShader(shaderProgram, vertexShader)
        GLES20.glAttachShader(shaderProgram, fragmentShader)
        GLES20.glLinkProgram(shaderProgram)
        
        // Check link status
        val linkStatus = IntArray(1)
        GLES20.glGetProgramiv(shaderProgram, GLES20.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] == 0) {
            val error = GLES20.glGetProgramInfoLog(shaderProgram)
            GLES20.glDeleteProgram(shaderProgram)
            throw RuntimeException("Shader program link failed: $error")
        }
        
        // Get attribute and uniform locations
        positionHandle = GLES20.glGetAttribLocation(shaderProgram, "aPosition")
        texCoordHandle = GLES20.glGetAttribLocation(shaderProgram, "aTexCoord")
        mvpMatrixHandle = GLES20.glGetUniformLocation(shaderProgram, "uMVPMatrix")
        textureHandle = GLES20.glGetUniformLocation(shaderProgram, "uTexture")
    }
    
    private fun loadShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        
        // Check compile status
        val compileStatus = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compileStatus, 0)
        if (compileStatus[0] == 0) {
            val error = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            throw RuntimeException("Shader compile failed: $error")
        }
        
        return shader
    }
    
    fun resetView() {
        rotationX = 0f
        rotationY = 0f
        fieldOfView = 75f
        updateProjectionMatrix()
    }
    
    fun cleanup() {
        if (textureId != 0) {
            GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
            textureId = 0
        }
        if (shaderProgram != 0) {
            GLES20.glDeleteProgram(shaderProgram)
            shaderProgram = 0
        }
        pendingBitmap?.recycle()
        pendingBitmap = null
    }
}
