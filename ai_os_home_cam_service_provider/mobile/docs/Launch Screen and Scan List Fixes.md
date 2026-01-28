# Launch Screen and Scan List Fixes

## Issues Fixed

### 1. Scan List Not Showing Past Scans ✅ FIXED

**Problem**: The home view wasn't displaying existing scan sessions.

**Root Cause**: The `StorageService` was declared with `@State` instead of `@StateObject` in `ScanListView.swift`. This caused the service to be recreated on every view update, losing its data.

**Solution**: Changed the property wrapper from `@State` to `@StateObject`:

```swift
// Before
@State private var storageService = StorageService()

// After
@StateObject private var storageService = StorageService()
```

**File Modified**: `ai_os_home_cam_service_provider/mobile/iOS/Hestami Home Measurements/Hestami Home Measurements/Views/ScanListView.swift`

**Why This Works**:
- `@StateObject` ensures the service instance persists across view updates
- The service maintains its `scanSessions` array properly
- Data loaded from SwiftData is retained and displayed

---

### 2. Launch Screen Not Showing ⚠️ REQUIRES XCODE CONFIGURATION

**Problem**: The launch screen storyboard exists but isn't being displayed when the app launches.

**Root Cause**: The launch screen storyboard needs to be configured in the Xcode project settings.

**Solution**: Follow these steps in Xcode:

#### Step 1: Open Project Settings
1. Open the project in Xcode
2. Click on the blue project icon at the top of the Project Navigator
3. Select the "Hestami Home Measurements" target

#### Step 2: Configure Launch Screen
1. Go to the "General" tab
2. Scroll down to "App Icons and Launch Images" section
3. Find the "Launch Screen File" dropdown
4. Select "LaunchScreen" from the dropdown menu

#### Step 3: Verify Storyboard Reference
1. In the Project Navigator, verify that `LaunchScreen.storyboard` exists in the project
2. Click on the storyboard file
3. In the File Inspector (right panel), verify:
   - Target Membership: "Hestami Home Measurements" is checked
   - File Type: "Storyboard"

#### Step 4: Clean and Rebuild
1. Press `Cmd + Shift + K` to clean the build folder
2. Press `Cmd + B` to rebuild the project
3. Run the app on a device or simulator

#### Step 5: Test Launch Screen
1. Stop the app if running
2. Delete the app from the device/simulator
3. Rebuild and run the app
4. You should see the launch screen briefly before the main app appears

---

## Alternative: Programmatic Launch Screen

If the storyboard approach doesn't work, you can create a programmatic launch screen by modifying the app's Info.plist:

### Option A: Add Launch Screen to Info.plist

1. Open `Info.plist` in Xcode
2. Add a new key: `UILaunchStoryboardName`
3. Set the value to: `LaunchScreen`

### Option B: Use Launch Screen in Code

Create a new file `LaunchScreenView.swift`:

```swift
import SwiftUI

struct LaunchScreenView: View {
    var body: some View {
        ZStack {
            Color(hex: "1A1A2E") // Dark background
            
            VStack(spacing: 20) {
                Image(systemName: "arkit")
                    .font(.system(size: 80))
                    .foregroundColor(.white)
                
                Text("Hestami")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Home Measurements")
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }
        }
        .ignoresSafeArea()
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
```

Then modify `Hestami_Home_MeasurementsApp.swift`:

```swift
@main
struct Hestami_Home_MeasurementsApp: App {
    @State private var showLaunchScreen = true
    
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            ScanSession.self,
            Keyframe.self,
            MeasurementResult.self,
            MeasurementGroup.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ZStack {
                if showLaunchScreen {
                    LaunchScreenView()
                        .onAppear {
                            // Dismiss launch screen after 2 seconds
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                                withAnimation {
                                    showLaunchScreen = false
                                }
                            }
                        }
                } else {
                    ContentView()
                }
            }
        }
        .modelContainer(sharedModelContainer)
    }
}
```

---

## Verification Steps

### Verify Scan List Fix
1. Build and run the app
2. Create a new scan session
3. Navigate back to the home screen
4. Verify the scan appears in the list
5. Stop and restart the app
6. Verify the scan still appears (data persistence)

### Verify Launch Screen Fix
1. Delete the app from device/simulator
2. Clean build folder (Cmd + Shift + K)
3. Build and run the app
4. Observe the launch screen appears briefly
5. Verify the main app loads after the launch screen

---

## Troubleshooting

### Scan List Still Not Showing

If scans still don't appear after the fix:

1. **Check Console Logs**:
   - Look for "📋 StorageService: Loading scan sessions"
   - Look for "✅ StorageService: Loaded X scan sessions"
   - Check for any error messages

2. **Verify SwiftData Setup**:
   - Ensure `ModelContainer` is properly configured
   - Check that all models are included in the schema
   - Verify `isStoredInMemoryOnly: false` is set

3. **Check File Permissions**:
   - Ensure the app has permission to write to the documents directory
   - Check for any sandboxing issues

### Launch Screen Still Not Showing

If the launch screen still doesn't appear:

1. **Verify Storyboard Configuration**:
   - Check that "LaunchScreen" is selected in project settings
   - Verify the storyboard file is included in the target
   - Ensure the storyboard has a valid view controller

2. **Check for Conflicting Settings**:
   - Remove any custom launch screen images from Assets.xcassets
   - Ensure no other launch screen configurations exist

3. **Try Programmatic Approach**:
   - Use the programmatic launch screen option above
   - This bypasses storyboard configuration issues

4. **Check Device/Simulator**:
   - Try on a physical device if using simulator
   - Try different iOS versions
   - Ensure the device supports ARKit (for the ARKit icon)

---

## Summary

- ✅ **Scan List Issue**: Fixed by changing `@State` to `@StateObject`
- ⚠️ **Launch Screen Issue**: Requires Xcode project configuration or programmatic implementation

The scan list fix is complete and should work immediately. The launch screen requires manual configuration in Xcode or implementation of the programmatic approach provided above.
