//
//  Panorama360View.swift
//  My Home Agent
//
//  Created by Marshall Hendricks on 10/11/25.
//

import SwiftUI
import SceneKit

struct Panorama360View: View {
    let imageURL: URL
    @State private var image: UIImage?
    @State private var isLoading = true
    @State private var loadError = false
    @State private var showInstructions = true
    
    var body: some View {
        ZStack {
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                    .scaleEffect(1.5)
            } else if loadError {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(AppTheme.secondaryText)
                    Text("Failed to load 360° image")
                        .foregroundColor(AppTheme.secondaryText)
                }
            } else if let image = image {
                PanoramaSceneView(image: image)
                
                // Instructions overlay
                if showInstructions {
                    VStack {
                        Spacer()
                        VStack(spacing: 8) {
                            HStack(spacing: 12) {
                                Image(systemName: "hand.draw")
                                    .font(.title3)
                                Text("Drag to look around")
                                    .font(.subheadline)
                            }
                            HStack(spacing: 12) {
                                Image(systemName: "pinch")
                                    .font(.title3)
                                Text("Pinch to zoom")
                                    .font(.subheadline)
                            }
                            HStack(spacing: 12) {
                                Image(systemName: "hand.tap")
                                    .font(.title3)
                                Text("Double-tap to reset")
                                    .font(.subheadline)
                            }
                        }
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(12)
                        .padding(.bottom, 40)
                    }
                    .transition(.opacity)
                }
            }
        }
        .onAppear {
            loadImage()
            // Hide instructions after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                withAnimation {
                    showInstructions = false
                }
            }
        }
    }
    
    private func loadImage() {
        print("🌐 Panorama360View: Loading image from URL: \(imageURL.absoluteString)")
        
        URLSession.shared.dataTask(with: imageURL) { data, response, error in
            DispatchQueue.main.async {
                if let data = data, let loadedImage = UIImage(data: data) {
                    print("✅ Panorama360View: Successfully loaded image - Size: \(loadedImage.size)")
                    self.image = loadedImage
                    self.isLoading = false
                } else {
                    print("❌ Panorama360View: Failed to load image - Error: \(error?.localizedDescription ?? "Unknown")")
                    self.loadError = true
                    self.isLoading = false
                }
            }
        }.resume()
    }
}

struct PanoramaSceneView: UIViewRepresentable {
    let image: UIImage
    
    func makeUIView(context: Context) -> SCNView {
        let sceneView = SCNView()
        sceneView.backgroundColor = .black
        sceneView.allowsCameraControl = false
        sceneView.autoenablesDefaultLighting = true
        
        // Create scene
        let scene = SCNScene()
        sceneView.scene = scene
        
        // Create sphere for panorama
        let sphere = SCNSphere(radius: 10.0)
        sphere.segmentCount = 96 // Higher for smoother appearance
        
        // Create material with the panorama image
        let material = SCNMaterial()
        material.diffuse.contents = image
        material.isDoubleSided = true
        sphere.materials = [material]
        
        // Create sphere node (inverted for interior view)
        let sphereNode = SCNNode(geometry: sphere)
        sphereNode.scale = SCNVector3(x: -1, y: 1, z: 1) // Invert X to see interior
        scene.rootNode.addChildNode(sphereNode)
        
        // Create camera
        let camera = SCNCamera()
        camera.zNear = 0.1
        camera.zFar = 100
        camera.fieldOfView = 75 // Adjust for desired FOV
        
        let cameraNode = SCNNode()
        cameraNode.camera = camera
        cameraNode.position = SCNVector3(x: 0, y: 0, z: 0) // Center of sphere
        scene.rootNode.addChildNode(cameraNode)
        
        // Store camera node for gesture handling
        context.coordinator.cameraNode = cameraNode
        context.coordinator.sceneView = sceneView
        
        // Add gesture recognizers
        let panGesture = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        sceneView.addGestureRecognizer(panGesture)
        
        let pinchGesture = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        sceneView.addGestureRecognizer(pinchGesture)
        
        let doubleTapGesture = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleDoubleTap(_:)))
        doubleTapGesture.numberOfTapsRequired = 2
        sceneView.addGestureRecognizer(doubleTapGesture)
        
        return sceneView
    }
    
    func updateUIView(_ uiView: SCNView, context: Context) {
        // No updates needed
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject {
        var cameraNode: SCNNode?
        var sceneView: SCNView?
        
        // Camera rotation state
        var currentRotationX: Float = 0
        var currentRotationY: Float = 0
        
        // Zoom state
        var currentFOV: CGFloat = 75
        let minFOV: CGFloat = 30
        let maxFOV: CGFloat = 100
        
        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let sceneView = sceneView else { return }
            
            let translation = gesture.translation(in: sceneView)
            
            // Convert translation to rotation
            let rotationSpeed: Float = 0.005
            let deltaX = Float(translation.x) * rotationSpeed
            let deltaY = Float(translation.y) * rotationSpeed
            
            if gesture.state == .changed {
                currentRotationY -= deltaX
                currentRotationX -= deltaY
                
                // Clamp vertical rotation to prevent flipping
                currentRotationX = max(-Float.pi / 2, min(Float.pi / 2, currentRotationX))
                
                // Apply rotation to camera
                cameraNode?.eulerAngles = SCNVector3(currentRotationX, currentRotationY, 0)
                
                gesture.setTranslation(.zero, in: sceneView)
            }
        }
        
        @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            guard let camera = cameraNode?.camera else { return }
            
            if gesture.state == .changed {
                let scale = gesture.scale
                let newFOV = currentFOV / scale
                
                // Clamp FOV
                camera.fieldOfView = max(minFOV, min(maxFOV, newFOV))
            } else if gesture.state == .ended {
                currentFOV = camera.fieldOfView
            }
        }
        
        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            // Reset to initial view
            SCNTransaction.begin()
            SCNTransaction.animationDuration = 0.3
            
            currentRotationX = 0
            currentRotationY = 0
            currentFOV = 75
            
            cameraNode?.eulerAngles = SCNVector3(0, 0, 0)
            cameraNode?.camera?.fieldOfView = 75
            
            SCNTransaction.commit()
        }
    }
}

// Preview wrapper for testing
struct Panorama360View_Previews: PreviewProvider {
    static var previews: some View {
        if let url = URL(string: "https://example.com/panorama.jpg") {
            Panorama360View(imageURL: url)
        }
    }
}
