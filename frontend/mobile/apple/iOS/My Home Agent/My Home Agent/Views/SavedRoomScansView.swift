import SwiftUI
import SceneKit
import RoomPlan
import OSLog

struct SavedRoomScansView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var scans: [RoomScan] = []
    @State private var selectedScan: RoomScan?
    @State private var showDeleteAlert = false
    @State private var scanToDelete: RoomScan?
    @State private var scanToView: RoomScan?
    @State private var showUploadDialog = false
    @State private var scanToUpload: RoomScan?
    @State private var storageSize: String = ""
    
    private let storageService = RoomScanStorageService.shared
    
    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
                
                VStack {
                    if scans.isEmpty {
                        emptyStateView
                    } else {
                        scanListView
                    }
                }
            }
            .navigationTitle("Saved Scans")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.accentColor)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(storageSize)
                            .font(.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                        Text("Storage")
                            .font(.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
            }
        }
        .onAppear {
            loadScans()
            updateStorageSize()
        }
        .fullScreenCover(item: $scanToView) { scan in
            RoomScanViewerView(scan: scan, isPresented: $scanToView)
                .interactiveDismissDisabled(true)
        }
        .sheet(isPresented: $showUploadDialog) {
            if let scan = scanToUpload {
                UploadScanDialog(
                    scan: scan,
                    onUpload: { propertyId in
                        Task {
                            await uploadScan(scan: scan, propertyId: propertyId)
                        }
                    },
                    onCancel: {
                        showUploadDialog = false
                        scanToUpload = nil
                    }
                )
            }
        }
        .alert("Delete Scan", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {
                scanToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let scan = scanToDelete {
                    deleteScan(scan)
                }
            }
        } message: {
            Text("Are you sure you want to delete this scan? This action cannot be undone.")
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "cube.transparent")
                .font(.system(size: 70))
                .foregroundColor(AppTheme.secondaryText)
            
            Text("No Saved Scans")
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Your saved room scans will appear here")
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var scanListView: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(scans) { scan in
                    ScanCard(
                        scan: scan,
                        onView: { viewScan(scan) },
                        onUpload: {
                            scanToUpload = scan
                            showUploadDialog = true
                        },
                        onDelete: {
                            scanToDelete = scan
                            showDeleteAlert = true
                        }
                    )
                }
            }
            .padding()
        }
    }
    
    private func loadScans() {
        AppLogger.storage.debug("Loading scans...")
        scans = storageService.getAllScans()
        AppLogger.storage.info("Loaded \(scans.count, privacy: .public) scans")
        if scans.isEmpty {
            AppLogger.storage.warning("No scans found!")
        } else {
            #if DEBUG
            for scan in scans {
                AppLogger.storage.debug("- \(scan.name, privacy: .public) (ID: \(scan.id, privacy: .public))")
                AppLogger.storage.debug("  File exists: \(FileManager.default.fileExists(atPath: scan.fileURL.path), privacy: .public)")
            }
            #endif
        }
    }
    
    private func updateStorageSize() {
        storageSize = storageService.getStorageSizeFormatted()
    }
    
    private func viewScan(_ scan: RoomScan) {
        AppLogger.roomScan.info("Opening viewer for scan: \(scan.name, privacy: .public)")
        #if DEBUG
        AppLogger.roomScan.debug("File URL: \(scan.fileURL.path, privacy: .public)")
        AppLogger.roomScan.debug("Showing custom viewer")
        #endif
        
        scanToView = scan
    }
    
    private func uploadScan(scan: RoomScan, propertyId: String) async {
        do {
            _ = try await RoomScanUploadService.shared.uploadRoomScan(
                scan: scan,
                propertyId: propertyId
            )
            
            // Reload scans to update status
            await MainActor.run {
                loadScans()
                showUploadDialog = false
                scanToUpload = nil
                HapticManager.shared.playNotificationFeedback(type: .success)
            }
        } catch {
            await MainActor.run {
                showUploadDialog = false
                scanToUpload = nil
                HapticManager.shared.playNotificationFeedback(type: .error)
            }
        }
    }
    
    private func deleteScan(_ scan: RoomScan) {
        do {
            try storageService.deleteScan(id: scan.id)
            loadScans()
            updateStorageSize()
            scanToDelete = nil
            HapticManager.shared.playNotificationFeedback(type: .success)
        } catch {
            AppLogger.error("Failed to delete scan", error: error, category: AppLogger.storage)
            HapticManager.shared.playNotificationFeedback(type: .error)
        }
    }
}

// MARK: - Scan Card Component

struct ScanCard: View {
    let scan: RoomScan
    let onView: () -> Void
    let onUpload: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(scan.name)
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.primaryText)
                        .lineLimit(2)
                    
                    Text(formatDate(scan.createdAt))
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    // Show floorplan indicator if available
                    if scan.floorplanURL != nil {
                        HStack(spacing: 4) {
                            Image(systemName: "map.fill")
                                .font(.caption2)
                            Text("Floorplan available")
                                .font(.caption2)
                        }
                        .foregroundColor(AppTheme.accentColor)
                        .padding(.top, 2)
                    }
                }
                
                Spacer()
                
                uploadStatusBadge
            }
            
            HStack(spacing: 12) {
                Button(action: onView) {
                    Label("View", systemImage: "eye")
                        .font(.caption)
                        .foregroundColor(AppTheme.buttonText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(6)
                }
                
                if scan.uploadStatus != .uploaded {
                    Button(action: onUpload) {
                        Label("Upload", systemImage: "icloud.and.arrow.up")
                            .font(.caption)
                            .foregroundColor(AppTheme.buttonText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(AppTheme.accentColor)
                            .cornerRadius(6)
                    }
                    .disabled(scan.uploadStatus == .uploading)
                }
                
                Spacer()
                
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundColor(AppTheme.errorColor)
                        .padding(6)
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
    
    private var uploadStatusBadge: some View {
        Group {
            switch scan.uploadStatus {
            case .notUploaded:
                Label("Local", systemImage: "iphone")
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(4)
            case .uploading:
                Label("Uploading", systemImage: "arrow.up.circle")
                    .font(.caption2)
                    .foregroundColor(.blue)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            case .uploaded:
                Label("Cloud", systemImage: "checkmark.icloud")
                    .font(.caption2)
                    .foregroundColor(.green)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(4)
            case .failed:
                Label("Failed", systemImage: "exclamationmark.triangle")
                    .font(.caption2)
                    .foregroundColor(.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.red.opacity(0.2))
                    .cornerRadius(4)
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Room Scan Viewer

struct RoomScanViewerView: View {
    let scan: RoomScan
    @Binding var isPresented: RoomScan?
    @State private var showShareSheet = false
    @State private var isViewReady = false
    @State private var selectedTab = 0 // 0 = 3D Model, 1 = Floorplan
    @State private var useMetric = true
    @State private var showMeasurementToggle = false
    
    var body: some View {
        VStack(spacing: 0) {
                // Header
                HStack {
                    Button(action: { 
                        AppLogger.roomScan.debug("Closing viewer")
                        isPresented = nil 
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title2)
                            Text("Close")
                                .font(AppTheme.bodyFont)
                        }
                        .foregroundColor(.white)
                    }
                    
                    Spacer()
                    
                    Text(scan.name)
                        .font(AppTheme.titleFont)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    // Measurement toggle (only show when floorplan is visible)
                    if selectedTab == 1 {
                        Button(action: { useMetric.toggle() }) {
                            HStack(spacing: 4) {
                                Image(systemName: "ruler")
                                    .font(.caption)
                                Text(useMetric ? "m" : "ft")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.2))
                            .cornerRadius(6)
                        }
                    }
                    
                    Button(action: { showShareSheet = true }) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.title2)
                            .foregroundColor(.white)
                    }
                }
                .padding()
                .background(Color.black.opacity(0.8))
                
                // Tab selector
                if scan.floorplanURL != nil {
                    Picker("View Type", selection: $selectedTab) {
                        Text("3D Model").tag(0)
                        Text("Floorplan").tag(1)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(AppTheme.cardBackground)
                }
                
                // Content area
                GeometryReader { geometry in
                    if selectedTab == 0 {
                        // 3D Viewer
                        if isViewReady {
                            SceneKitView(url: scan.fileURL)
                                .frame(width: geometry.size.width, height: geometry.size.height)
                        } else {
                            AppTheme.primaryBackground
                                .overlay(
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                                        .scaleEffect(1.5)
                                )
                        }
                    } else {
                        // Floorplan viewer
                        FloorplanImageView(scan: scan, useMetric: useMetric)
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .background(AppTheme.primaryBackground)
                    }
                }
                .background(AppTheme.primaryBackground)
                .edgesIgnoringSafeArea(.bottom)
                .ignoresSafeArea(.all)
        }
        .background(AppTheme.primaryBackground)
        .onAppear {
            AppLogger.roomScan.debug("RoomScanViewerView appeared")
            
            // Delay showing the SceneKit view to ensure proper layout
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                AppLogger.roomScan.debug("Setting isViewReady = true")
                isViewReady = true
            }
            
        }
        .onDisappear {
            AppLogger.roomScan.debug("RoomScanViewerView disappeared")
        }
        .sheet(isPresented: $showShareSheet) {
            ActivityView(activityItems: [scan.fileURL])
        }
    }
}

// MARK: - Floorplan Image View

struct FloorplanImageView: View {
    let scan: RoomScan
    let useMetric: Bool
    @State private var floorplanImage: UIImage?
    @State private var isLoading = true
    @State private var currentScale: CGFloat = 1.0
    @State private var currentOffset: CGSize = .zero
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.accentColor))
                    .scaleEffect(1.5)
            } else if let image = floorplanImage {
                GeometryReader { geometry in
                    ZoomableScrollView(scale: $currentScale, offset: $currentOffset) {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: geometry.size.width, height: geometry.size.height)
                    }
                }
                .overlay(
                    // Zoom controls
                    VStack {
                        HStack {
                            Spacer()
                            VStack(spacing: 12) {
                                // Zoom in button
                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        currentScale = min(currentScale + 0.5, 5.0)
                                    }
                                }) {
                                    Image(systemName: "plus.magnifyingglass")
                                        .font(.system(size: 16))
                                        .foregroundColor(.white)
                                        .frame(width: 40, height: 40)
                                        .background(Color.black.opacity(0.6))
                                        .cornerRadius(8)
                                }
                                
                                // Zoom out button
                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        currentScale = max(currentScale - 0.5, 1.0)
                                        if currentScale == 1.0 {
                                            currentOffset = .zero
                                        }
                                    }
                                }) {
                                    Image(systemName: "minus.magnifyingglass")
                                        .font(.system(size: 16))
                                        .foregroundColor(.white)
                                        .frame(width: 40, height: 40)
                                        .background(Color.black.opacity(0.6))
                                        .cornerRadius(8)
                                }
                                
                                // Reset button
                                if currentScale > 1.0 {
                                    Button(action: {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            currentScale = 1.0
                                            currentOffset = .zero
                                        }
                                    }) {
                                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                                            .font(.system(size: 16))
                                            .foregroundColor(.white)
                                            .frame(width: 40, height: 40)
                                            .background(Color.black.opacity(0.6))
                                            .cornerRadius(8)
                                    }
                                }
                            }
                            .padding()
                        }
                        Spacer()
                    }
                )
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "map")
                        .font(.system(size: 48))
                        .foregroundColor(AppTheme.secondaryText)
                    Text("Floorplan not available")
                        .font(AppTheme.bodyFont)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        }
        .onAppear {
            loadFloorplan()
        }
        .onChange(of: useMetric) {
            // Reset zoom when changing units
            currentScale = 1.0
            currentOffset = .zero
            loadFloorplan()
        }
    }
    
    private func loadFloorplan() {
        isLoading = true
        
        // Try to load CapturedRoom data and regenerate with current units
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                // Load the CapturedRoom data
                let capturedRoom = try RoomScanStorageService.shared.loadCapturedRoomData(for: scan.id)
                
                // Generate floorplan with current measurement system
                let image = FloorplanGeneratorService.shared.generateFloorplan(
                    from: capturedRoom,
                    useMetric: useMetric
                )
                
                DispatchQueue.main.async {
                    self.floorplanImage = image
                    self.isLoading = false
                }
            } catch {
                AppLogger.error("Failed to regenerate floorplan", error: error, category: AppLogger.roomScan)
                
                // Fallback: try to load the saved floorplan image
                if let floorplanURL = scan.floorplanURL,
                   FileManager.default.fileExists(atPath: floorplanURL.path),
                   let image = UIImage(contentsOfFile: floorplanURL.path) {
                    AppLogger.roomScan.info("Loaded saved floorplan as fallback")
                    DispatchQueue.main.async {
                        self.floorplanImage = image
                        self.isLoading = false
                    }
                } else {
                    AppLogger.roomScan.warning("No floorplan available")
                    DispatchQueue.main.async {
                        self.floorplanImage = nil
                        self.isLoading = false
                    }
                }
            }
        }
    }
}

// MARK: - Zoomable Scroll View

struct ZoomableScrollView<Content: View>: UIViewRepresentable {
    @Binding var scale: CGFloat
    @Binding var offset: CGSize
    let content: Content
    
    init(scale: Binding<CGFloat>, offset: Binding<CGSize>, @ViewBuilder content: () -> Content) {
        self._scale = scale
        self._offset = offset
        self.content = content()
    }
    
    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.delegate = context.coordinator
        scrollView.maximumZoomScale = 5.0
        scrollView.minimumZoomScale = 1.0
        scrollView.bouncesZoom = true
        scrollView.showsHorizontalScrollIndicator = true
        scrollView.showsVerticalScrollIndicator = true
        
        let hostingController = UIHostingController(rootView: content)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(hostingController.view)
        
        context.coordinator.hostingController = hostingController
        
        NSLayoutConstraint.activate([
            hostingController.view.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            hostingController.view.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            hostingController.view.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
            hostingController.view.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor)
        ])
        
        return scrollView
    }
    
    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        scrollView.zoomScale = scale
        context.coordinator.hostingController?.rootView = content
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(scale: $scale, offset: $offset)
    }
    
    class Coordinator: NSObject, UIScrollViewDelegate {
        @Binding var scale: CGFloat
        @Binding var offset: CGSize
        var hostingController: UIHostingController<Content>?
        
        init(scale: Binding<CGFloat>, offset: Binding<CGSize>) {
            self._scale = scale
            self._offset = offset
        }
        
        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            return hostingController?.view
        }
        
        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            // Avoid "Modifying state during view update" warning
            DispatchQueue.main.async {
                self.scale = scrollView.zoomScale
            }
        }
        
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            // Avoid "Modifying state during view update" warning
            let newOffset = CGSize(
                width: scrollView.contentOffset.x,
                height: scrollView.contentOffset.y
            )
            DispatchQueue.main.async {
                self.offset = newOffset
            }
        }
    }
}

// MARK: - SceneKit View

struct SceneKitView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> SCNView {
        AppLogger.roomScan.debug("SceneKitView: Creating view for URL: \(url.path, privacy: .public)")
        
        // Create with a default frame to avoid zero-size issues
        let sceneView = SCNView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        sceneView.backgroundColor = .black
        sceneView.allowsCameraControl = true
        sceneView.autoenablesDefaultLighting = false  // Disable default lighting (too bright)
        sceneView.antialiasingMode = .multisampling4X
        sceneView.showsStatistics = false  // Hide FPS stats
        sceneView.isOpaque = true
        sceneView.contentMode = .scaleAspectFit
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        // Check if file exists
        guard FileManager.default.fileExists(atPath: url.path) else {
            AppLogger.roomScan.error("SceneKitView: File does not exist at path: \(url.path, privacy: .public)")
            return sceneView
        }
        
        AppLogger.roomScan.debug("SceneKitView: File exists, loading scene...")
        
        // Load the USDZ scene - use file:// scheme explicitly
        do {
            // Ensure we're using file URL scheme
            var fileURL = url
            if fileURL.scheme == nil {
                fileURL = URL(fileURLWithPath: url.path)
            }
            
            let scene = try SCNScene(url: fileURL, options: [
                .checkConsistency: true,
                .flattenScene: false
            ])
            
            AppLogger.roomScan.info("SceneKitView: Scene loaded successfully")
            #if DEBUG
            AppLogger.roomScan.debug("Root node children count: \(scene.rootNode.childNodes.count, privacy: .public)")
            #endif
            
            sceneView.scene = scene
            
            // Setup camera
            let cameraNode = SCNNode()
            cameraNode.camera = SCNCamera()
            cameraNode.camera?.zFar = 1000
            cameraNode.position = SCNVector3(x: 0, y: 3, z: 8)
            cameraNode.look(at: SCNVector3(x: 0, y: 0, z: 0))
            scene.rootNode.addChildNode(cameraNode)
            sceneView.pointOfView = cameraNode
            
            // Add ambient light (reduced intensity to avoid washed-out look)
            let ambientLight = SCNNode()
            ambientLight.light = SCNLight()
            ambientLight.light?.type = .ambient
            ambientLight.light?.color = UIColor.white
            ambientLight.light?.intensity = 200  // Reduced from 500
            scene.rootNode.addChildNode(ambientLight)
            
            // Add directional light (reduced intensity)
            let directionalLight = SCNNode()
            directionalLight.light = SCNLight()
            directionalLight.light?.type = .directional
            directionalLight.light?.color = UIColor.white
            directionalLight.light?.intensity = 400  // Reduced from 1000
            directionalLight.position = SCNVector3(x: 5, y: 10, z: 5)
            directionalLight.look(at: SCNVector3(x: 0, y: 0, z: 0))
            scene.rootNode.addChildNode(directionalLight)
            
            AppLogger.roomScan.debug("SceneKitView: Camera and lighting configured")
            
        } catch {
            AppLogger.error("SceneKitView: Failed to load scene", error: error, category: AppLogger.roomScan)
        }
        
        return sceneView
    }
    
    func updateUIView(_ uiView: SCNView, context: Context) {
        #if DEBUG
        AppLogger.roomScan.debug("SceneKitView: updateUIView called")
        AppLogger.roomScan.debug("View frame: \(String(describing: uiView.frame), privacy: .public)")
        AppLogger.roomScan.debug("View bounds: \(String(describing: uiView.bounds), privacy: .public)")
        AppLogger.roomScan.debug("Scene: \(uiView.scene != nil ? "present" : "nil", privacy: .public)")
        AppLogger.roomScan.debug("Background color: \(uiView.backgroundColor?.description ?? "nil", privacy: .public)")
        #endif
        
        // Force layout and render when frame changes
        if uiView.frame.size != .zero && uiView.scene != nil {
            #if DEBUG
            AppLogger.roomScan.debug("SceneKitView: Valid frame detected, forcing render")
            #endif
            
            // Force immediate render
            DispatchQueue.main.async {
                uiView.setNeedsDisplay()
                uiView.layoutIfNeeded()
                
                // Force SceneKit to render
                if let scene = uiView.scene {
                    uiView.scene = nil
                    uiView.scene = scene
                    #if DEBUG
                    AppLogger.roomScan.debug("SceneKitView: Scene reassigned to trigger render")
                    #endif
                }
            }
        } else if uiView.frame.size == .zero {
            #if DEBUG
            AppLogger.roomScan.debug("SceneKitView: Frame is still zero")
            #endif
        }
    }
}
