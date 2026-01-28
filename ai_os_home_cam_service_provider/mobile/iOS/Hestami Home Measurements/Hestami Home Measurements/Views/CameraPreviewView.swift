//
//  CameraPreviewView.swift
//  Hestami Home Measurements
//
//  Created by Claude on 1/24/26.
//

import SwiftUI
import AVFoundation

/// UIViewRepresentable wrapper for AVCaptureSession video preview.
/// Used in Stage 1 to display camera feed before capturing ProRAW photos.
struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.session = session
        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {
        // Update session if it changed
        if uiView.session !== session {
            uiView.session = session
        }
    }
}

/// UIView subclass that hosts the AVCaptureVideoPreviewLayer
class CameraPreviewUIView: UIView {
    var session: AVCaptureSession? {
        didSet {
            previewLayer.session = session
        }
    }

    private var previewLayer: AVCaptureVideoPreviewLayer {
        return layer as! AVCaptureVideoPreviewLayer
    }

    override class var layerClass: AnyClass {
        return AVCaptureVideoPreviewLayer.self
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupLayer()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLayer()
    }

    private func setupLayer() {
        previewLayer.videoGravity = .resizeAspectFill
        backgroundColor = .black
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Ensure preview layer fills the view
        previewLayer.frame = bounds
    }
}
