# iOS App Deployment Configuration Guide

## Overview

The **My Home Agent** iOS app is configured to support three deployment environments:

1. **Development** - Local testing with dev backend (`dev-homeservices.hestami-ai.com`)
2. **Staging** - TestFlight builds with staging backend (`staging-homeservices.hestami-ai.com`)
3. **Production** - App Store builds with production backend (`homeservices.hestami-ai.com`)

## Current Status

✅ **Code Configuration Complete**
- `AppConfiguration.swift` properly configured with all three environments
- `RoomScanUploadService.swift` updated to use `AppConfiguration.apiBaseURL`
- All other services already use `NetworkManager.shared.baseURL` which references `AppConfiguration.apiBaseURL`

⚠️ **Xcode Project Configuration Needed**
- Currently only has **Debug** and **Release** build configurations
- Need to add **Staging** configuration for TestFlight

---

## How It Works

### Build Environment Detection

The app automatically detects the build environment using compiler flags:

```swift
enum BuildEnvironment: String {
    case development
    case staging
    case production
    
    static var current: BuildEnvironment {
        #if DEBUG
        return .development
        #elseif STAGING
        return .staging
        #else
        return .production
        #endif
    }
}
```

### API Base URL Selection

```swift
static var apiBaseURL: String {
    switch environment {
    case .development:
        return "https://dev-homeservices.hestami-ai.com"
    case .staging:
        return "https://staging-homeservices.hestami-ai.com"
    case .production:
        return "https://homeservices.hestami-ai.com"
    }
}
```

---

## Setting Up Staging Configuration in Xcode

### Step 1: Add Staging Build Configuration

1. Open **My Home Agent.xcodeproj** in Xcode
2. Select the project in the Project Navigator
3. Select the **My Home Agent** project (not the target)
4. Go to the **Info** tab
5. Under **Configurations**, click the **+** button
6. Select **Duplicate "Release" Configuration**
7. Name it **Staging**

### Step 2: Add STAGING Compiler Flag

1. Still in the project settings, select the **My Home Agent** target
2. Go to **Build Settings** tab
3. Search for "Swift Compiler - Custom Flags"
4. Find **Other Swift Flags**
5. For the **Staging** configuration, add: `-DSTAGING`

### Step 3: Create Staging Scheme

1. In Xcode menu: **Product** → **Scheme** → **Manage Schemes...**
2. Click the **+** button to add a new scheme
3. Name it **My Home Agent (Staging)**
4. Set the target to **My Home Agent**
5. Click **OK**
6. Select the new **My Home Agent (Staging)** scheme
7. Click **Edit...**
8. For each action (Run, Test, Profile, Analyze, Archive):
   - Set **Build Configuration** to **Staging**
9. Click **Close**

### Step 4: Configure App Display Name (Optional)

To differentiate builds visually on your device:

1. In **Build Settings**, search for "Product Name"
2. Set different values for each configuration:
   - **Debug**: `$(TARGET_NAME) Dev`
   - **Staging**: `$(TARGET_NAME) Beta`
   - **Release**: `$(TARGET_NAME)`

Or use different bundle identifiers:
- **Debug**: `hestami-ai.My-Home-Agent.dev`
- **Staging**: `hestami-ai.My-Home-Agent.staging`
- **Release**: `hestami-ai.My-Home-Agent`

---

## Building for Each Environment

### Development Build
```bash
# In Xcode: Select "My Home Agent" scheme
# Product → Run (⌘R)
# Or build for simulator/device
```

### TestFlight Build (Staging)
```bash
# In Xcode: Select "My Home Agent (Staging)" scheme
# Product → Archive
# Distribute to App Store Connect → TestFlight
```

### Production Build (App Store)
```bash
# In Xcode: Select "My Home Agent" scheme (Release)
# Product → Archive
# Distribute to App Store Connect → App Store
```

---

## Verification

### Check Current Environment at Runtime

The app logs the current configuration on startup. Check the console for:

```
=== App Configuration ===
Environment: development (or staging/production)
API Base URL: https://dev-homeservices.hestami-ai.com
...
========================
```

### Manual Verification

Add this to any view for testing:

```swift
Text("Environment: \(AppConfiguration.environment.rawValue)")
Text("API: \(AppConfiguration.apiBaseURL)")
```

---

## Environment-Specific Settings

The following settings automatically adjust per environment:

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| API Base URL | `dev-homeservices` | `staging-homeservices` | `homeservices` |
| Static Media Host | `dev-static` | `staging-static` | `static` |
| Cache Duration | 5 min | 10 min | 1 hour |
| Request Timeout | 30s | 30s | 20s |
| Verbose Logging | ✅ | ❌ | ❌ |
| Network Logging | ✅ | ❌ | ❌ |
| Crash Reporting | ❌ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ |

---

## Troubleshooting

### App still connects to dev server in staging build

**Check:**
1. Verify the **Staging** scheme is using **Staging** build configuration
2. Ensure `-DSTAGING` flag is set in **Other Swift Flags** for Staging configuration
3. Clean build folder: **Product** → **Clean Build Folder** (⇧⌘K)
4. Rebuild the app

### How to verify which environment is active

Add this temporary code to `DashboardView.swift`:

```swift
.onAppear {
    print("🌍 Current Environment: \(AppConfiguration.environment.rawValue)")
    print("🌐 API Base URL: \(AppConfiguration.apiBaseURL)")
    viewModel.fetchDashboardData()
}
```

---

## App Store Category

The app is configured for:
- **Primary Category**: Productivity (`public.app-category.productivity`)
- **Secondary Category**: Lifestyle (set in App Store Connect)

This is already set in the project settings:
```
INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.productivity"
```

---

## Next Steps

1. ✅ Code is ready - all services use `AppConfiguration.apiBaseURL`
2. ⚠️ Add **Staging** build configuration in Xcode (see Step 1-4 above)
3. 🔄 Test each environment:
   - Run in simulator with Debug scheme → should use dev backend
   - Archive with Staging scheme → should use staging backend
   - Archive with Release scheme → should use production backend
4. 🚀 Upload to TestFlight using Staging scheme
5. 🎯 Submit to App Store using Release scheme

---

## Files Modified

- ✅ `Services/RoomScanUploadService.swift` - Now uses `AppConfiguration.apiBaseURL`
- ✅ `Config/AppConfiguration.swift` - Already properly configured
- ✅ `Networking/NetworkManager.swift` - Already uses `AppConfiguration.apiBaseURL`

## Files to Review

All other services correctly use `NetworkManager.shared.baseURL`:
- `Utils/MediaUploadManager.swift`
- `Views/CreateServiceRequestView.swift`
- All ViewModels and API services

---

**Status**: Ready for Xcode project configuration and TestFlight deployment! 🎉
