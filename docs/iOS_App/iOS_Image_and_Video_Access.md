Here’s a clean checklist for an iOS app that **captures photos/videos (with audio)** and **uploads them to your backend**.

# **Must-have privacy keys (Info.plist)**

Add these in **Target → Info (Custom iOS Target Properties)**:

1. **Camera**

* Key: `Privacy - Camera Usage Description` (`NSCameraUsageDescription`)

* Example: *“Hestami AI uses the camera to capture photos and videos for service requests.”*

2. **Microphone** (for video/audio recording)

* Key: `Privacy - Microphone Usage Description` (`NSMicrophoneUsageDescription`)

* Example: *“Audio is recorded with your videos so pros can hear issues clearly.”*

3. **Saving to Photos (write only)**

* Key: `Privacy - Photo Library Additions Usage Description` (`NSPhotoLibraryAddUsageDescription`)

* Example: *“Save captured media to your Photos library.”*

Tip: If you **only** write to the library and use the modern **PHPicker** to *import* media, you don’t need read permission (no prompt). If you directly read via `PHPhotoLibrary`/`UIImagePickerController`, also add \#4.

4. **Reading from Photos (if you browse the library yourself)**

* Key: `Privacy - Photo Library Usage Description` (`NSPhotoLibraryUsageDescription`)

* Example: *“Allow Hestami AI to select photos/videos from your library.”*

# **Not “permissions” but commonly needed**

5. **Background uploads**

* Use a **background URLSession** (`URLSessionConfiguration.background(withIdentifier:)`).

* In Capabilities, consider enabling **Background Modes → Background fetch** (not strictly required for background transfers, but many apps enable it alongside background sessions).

* Implement `application(_:handleEventsForBackgroundURLSession:completionHandler:)` to be relaunched when uploads finish.

6. **User notifications** (to notify when an upload finishes)

* No Info.plist key, but request at runtime: `UNUserNotificationCenter.current().requestAuthorization(...)`.

7. **App Transport Security (ATS)**

* If your backend is **HTTPS (modern TLS)**, you’re fine.

* If you must hit **HTTP** or legacy TLS, add `NSAppTransportSecurity` exceptions (minimize and scope to your hosts).

8. **Photo/Video metadata (location)**

* If you **actively access device location** (e.g., to attach location to a request), add:

  * `NSLocationWhenInUseUsageDescription` (and optionally `NSLocationAlwaysAndWhenInUseUsageDescription`).

* Simply preserving EXIF from a picked asset doesn’t require location permission unless you query Core Location.

9. **Local network / Bonjour** (rare; only if you talk to devices on LAN)

* `NSLocalNetworkUsageDescription` (+ Bonjour service keys) if you scan/connect on the local network.

10. **Background processing (BGTaskScheduler)** (optional)

* If you schedule background work with BGTaskScheduler, add `BGTaskSchedulerPermittedIdentifiers` and register tasks.

# **Minimal runtime setup (Swift snippets)**

**Request mic permission before recording audio:**

`import AVFoundation`

`func ensureAVPermissions() async throws {`  
    `let cam = await AVCaptureDevice.authorizationStatus(for: .video)`  
    `if cam == .notDetermined {`  
        `_ = await AVCaptureDevice.requestAccess(for: .video)`  
    `}`  
    `let mic = await AVCaptureDevice.authorizationStatus(for: .audio)`  
    `if mic == .notDetermined {`  
        `_ = await AVCaptureDevice.requestAccess(for: .audio)`  
    `}`  
`}`

**Write to Photos (requires `NSPhotoLibraryAddUsageDescription`):**

`import Photos`

`PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in`  
    `// handle .authorized / .limited / .denied`  
`}`

**Pick media without read permission prompt (PHPicker):**

`import PhotosUI`

`var config = PHPickerConfiguration(photoLibrary: .shared())`  
`config.filter = .any(of: [.images, .videos])`  
`config.selectionLimit = 1`  
`let picker = PHPickerViewController(configuration: config)`  
`// present; results return copies you can use/upload`

**Background upload skeleton:**

`let cfg = URLSessionConfiguration.background(withIdentifier: "com.hestami.uploads")`  
`cfg.allowsCellularAccess = true`  
`let session = URLSession(configuration: cfg, delegate: uploaderDelegate, delegateQueue: nil)`

`// Later:`  
`var req = URLRequest(url: URL(string:"https://api.hestami.ai/upload")!)`  
`req.httpMethod = "POST"`  
`let task = session.uploadTask(with: req, fromFile: fileURL)`  
`task.resume()`

# **Quick decision guide**

* **Record photo/video with sound?** `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`.

* **Save to Photos?** `NSPhotoLibraryAddUsageDescription`.

* **Browse user’s library yourself?** Add `NSPhotoLibraryUsageDescription`; or use **PHPicker** to avoid the extra prompt.

* **Upload in background?** Use **background URLSession** (+ optionally enable Background Modes) and implement the relaunch handler.

* **Notify on completion?** Request **User Notifications** at runtime.

* **Non-HTTPS or special hosts?** Configure **ATS** exceptions carefully.

If you tell me your exact media flows (capture-only vs capture+import, save-to-Photos or sandbox-only, background upload yes/no), I’ll produce a tailored Info.plist block and a tiny permissions manager you can drop into your app.

