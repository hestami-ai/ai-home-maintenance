# Launch Screen Setup Instructions

## Overview
A launch screen has been created for the Hestami Home Measurements iOS app. The launch screen displays the app icon and app name when the app first launches.

## What's Been Created

### 1. LaunchScreen.storyboard
Location: `ai_os_home_cam_service_provider/mobile/iOS/Hestami Home Measurements/Hestami Home Measurements/LaunchScreen.storyboard`

The launch screen includes:
- **App Icon**: Centered, 200x200 points, with 10% trimmed edges
- **App Name**: "Hestami Home Measurements" in blue, below the icon
- **Background**: White (system background color)
- **Layout**: Centered vertically and horizontally with proper spacing

## Manual Steps Required

### Step 1: Create the Launch Icon Image

You need to create a trimmed version of the app icon for the launch screen:

1. **Open the full icon:**
   - Navigate to: `ai_os_home_cam_service_provider/mobile/iOS/Hestami Home Measurements/Hestami Home Measurements/Assets.xcassets/AppIcon.appiconset/Hestami Home Measurements Full Icon.png`

2. **Trim the edges by 10%:**
   - Use an image editor (Preview, Photoshop, GIMP, etc.)
   - Crop approximately 10% from each edge (top, bottom, left, right)
   - This will create a tighter, more focused icon for the launch screen
   - Save the result as a PNG file

3. **Add to Assets.xcassets:**
   - Open Xcode
   - Navigate to `Assets.xcassets`
   - Right-click in the assets catalog and select "New Image Set"
   - Name it "LaunchIcon"
   - Drag your trimmed PNG into the 1x, 2x, and 3x slots
   - For best results, use these sizes:
     - 1x: 200x200 points
     - 2x: 400x400 points
     - 3x: 600x600 points

### Step 2: Update Project Settings

The LaunchScreen.storyboard needs to be added to the Xcode project:

1. **Open Xcode**
2. **Select the project file** in the navigator (the blue icon at the top)
3. **Select the target** "Hestami Home Measurements"
4. **Go to the "General" tab**
5. **Scroll to "App Icons and Launch Images"**
6. **Set "Launch Screen File" to "LaunchScreen"**

### Step 3: Verify the Launch Screen

1. **Clean the project**: Product → Clean Build Folder (Shift+Cmd+K)
2. **Build and run** the app on a device or simulator
3. **Observe the launch screen** when the app starts
4. **The launch screen should appear** for 1-2 seconds before transitioning to the main app

## Troubleshooting

### Launch screen doesn't appear
- Make sure "Launch Screen File" is set to "LaunchScreen" in project settings
- Clean and rebuild the project
- Delete the app from the device/simulator and reinstall

### Icon doesn't display
- Verify the image is named "LaunchIcon" in Assets.xcassets
- Check that the image is added to all three slots (1x, 2x, 3x)
- Ensure the image format is PNG

### Icon looks stretched or distorted
- Make sure the image is square (equal width and height)
- Check that "Content Mode" is set to "Scale Aspect Fit" in the storyboard
- Verify the image dimensions match the expected sizes

## Customization

If you want to customize the launch screen:

### Change Icon Size
Edit `LaunchScreen.storyboard` and modify the width/height constraints:
```xml
<constraint firstAttribute="width" constant="200" id="LaunchIconWidth"/>
<constraint firstAttribute="height" constant="200" id="LaunchIconHeight"/>
```

### Change Icon Position
Modify the centerY constraint:
```xml
<constraint firstItem="LaunchIconImageView" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" constant="-50" id="LaunchIconCenterY"/>
```
- Positive values move it down
- Negative values move it up

### Change Background Color
Modify the backgroundColor:
```xml
<color key="backgroundColor" systemColor="systemBackgroundColor"/>
```
Replace with a custom color if desired.

### Change App Name Text
Modify the text attribute:
```xml
<text>Hestami Home Measurements</text>
```

## Files Modified/Created

1. **Created:** `LaunchScreen.storyboard` - The launch screen layout
2. **To be created:** `LaunchIcon` image set in Assets.xcassets
3. **To be updated:** Project settings to reference the launch screen

## Next Steps

1. Create the trimmed LaunchIcon image
2. Add it to Assets.xcassets
3. Update project settings to use LaunchScreen.storyboard
4. Test the launch screen on a device or simulator
