package com.hestami_ai.myhomeagent.utils

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer

class SamDecoder(context: android.content.Context) {
    private val env = OrtEnvironment.getEnvironment()
    private val session: OrtSession

    init {
        // Place 'sam_vit_h_decoder.onnx' inside 'src/main/assets'
        val modelBytes = context.assets.open("sam_vit_h_decoder.onnx").readBytes()
        session = env.createSession(modelBytes)
    }

    fun predict(
        imageEmbeddings: FloatArray, // 1x256x64x64 (From Server/Encoder)
        pointCoords: FloatArray,     // 1x5x2 (x,y)
        pointLabels: FloatArray      // 1x5 (0 or 1)
    ): FloatArray {

        // 1. Wrap inputs
        val embeddingTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(imageEmbeddings), longArrayOf(1, 256, 64, 64))
        val coordsTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(pointCoords), longArrayOf(1, 5, 2))
        val labelsTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(pointLabels), longArrayOf(1, 5))

        // 2. Run Inference
        val inputs = mapOf(
            "image_embeddings" to embeddingTensor,
            "point_coords" to coordsTensor,
            "point_labels" to labelsTensor
        )

        val results = session.run(inputs)

        // 3. Get Output (Masks)
        val outputTensor = results[0] as OnnxTensor
        val masks = outputTensor.floatBuffer.array()

        // 4. Cleanup
        results.close()
        embeddingTensor.close()
        coordsTensor.close()
        labelsTensor.close()

        return masks
    }
}