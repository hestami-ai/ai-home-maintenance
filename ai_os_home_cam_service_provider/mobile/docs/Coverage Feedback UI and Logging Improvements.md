# Coverage Feedback UI and Logging Improvements

## Summary

Made significant improvements to the coverage feedback system to make it less intrusive and added comprehensive logging for debugging coverage issues.

## Changes Made

### 1. UI Improvements - CoverageIndicator.swift

**Before:** Large card occupying significant screen space with:
- Status header with icon and text
- Progress bar
- 4 metric cards in a grid
- List of failure reasons

**After:** Compact horizontal bar with:
- Status icon and readiness score
- Status text (Ready/Almost Ready/Not Ready)
- Compact metrics row (Cov, Obs, Dpt percentages)
- Primary failure reason (if not ready)
- Semi-transparent dark background

**Benefits:**
- Reduces screen real estate by ~70%
- Less intrusive during scanning
- Still provides essential information at a glance
- Semi-transparent background doesn't block camera view

### 2. Comprehensive Logging

Added detailed logging throughout the coverage system with emoji prefixes for easy filtering:

#### CoverageService.swift (📊)
- Frame processing status
- Point sampling statistics (valid, skipped low confidence, skipped out of range)
- Voxel map updates
- Metrics updates (coverage, observability, depth, tracking)
- Plane detection results
- Readiness check results
- Failure reasons

#### VoxelMap.swift (🗺️)
- Voxel update statistics (new, updated, out of range)
- Coverage score calculation with thresholds
- Observability score calculation
- Total voxel count

#### ReadinessChecker.swift (✅)
- Room readiness checks with pass/fail for each criterion
- Element readiness checks with pass/fail for each criterion
- Opening detection results
- Boundary coverage calculation

#### PlaneDetection.swift (📐)
- Plane detection start/end
- Individual plane details (normal, point count, orientation)
- Corner detection results
- RANSAC inlier counts

## How to Use the Logs for Debugging

### Viewing Logs

1. Open Xcode
2. Run the app on a device
3. Open the Console (View → Debug Area → Activate Console)
4. Filter logs using the emoji prefixes:
   - `📊` for CoverageService
   - `🗺️` for VoxelMap
   - `✅` for ReadinessChecker
   - `📐` for PlaneDetection

### Common Issues and What to Look For

#### Issue: "Not Ready" status never changes

**Check:**
1. Are points being sampled?
   ```
   📊 CoverageService: Sampled X valid points
   ```
   - If 0 or very low: Check depth camera availability and confidence

2. Are voxels being created?
   ```
   🗺️ VoxelMap: Updated - New: X, Updated: Y, Total: Z
   ```
   - If 0: Points may be out of range or have low confidence

3. What are the coverage scores?
   ```
   🗺️ VoxelMap: Coverage score - Good: X/Y = Z
   ```
   - If low: Need more observations or better angular diversity

4. Are planes being detected?
   ```
   📐 PlaneDetection: Detected X planes total
   ```
   - If 0: Not enough points or poor geometry

#### Issue: Observations not changing

**Check:**
1. Is the voxel map updating?
   ```
   🗺️ VoxelMap: Updated - New: X, Updated: Y
   ```
   - If only "Updated" and no "New": You're scanning the same area repeatedly

2. What's the angular diversity?
   ```
   🗺️ VoxelMap: Observability score - AvgAngDiv: X, Target: Y
   ```
   - If low: Move around the object more to get different viewing angles

#### Issue: Element mode not detecting wall plane

**Check:**
1. Are there enough points?
   ```
   📐 PlaneDetection: Starting plane detection with X points
   ```
   - Need at least 3 points for plane detection

2. Is a vertical plane found?
   ```
   📐 PlaneDetection: Detected plane 1 - IsVertical: true/false
   ```
   - If false: May be detecting floor/ceiling instead

3. What's the boundary coverage?
   ```
   🔍 ReadinessChecker: Boundary coverage - BoundaryPoints: X/Y = Z
   ```
   - If low: Need to scan the edges of the element more thoroughly

### Understanding the Metrics

#### Coverage Score
- **What it measures:** Ratio of "good" voxels to total voxels
- **Good voxel criteria:**
  - Minimum observations (3 for room, 5 for element)
  - Minimum confidence (0.6 for room, 0.65 for element)
  - Minimum angular diversity (0.08 for room, 0.12 for element)
  - Within range (< 3m)
- **Target:** ≥ 65% for room mode

#### Observability Score
- **What it measures:** Average angular diversity of good voxels
- **Why it matters:** Different viewing angles provide better 3D reconstruction
- **Target:** ≥ 2x minimum angular diversity

#### Depth Quality
- **What it measures:** Overall confidence of depth measurements
- **Target:** ≥ 60% for room, ≥ 65% for element

#### Tracking Quality
- **What it measures:** ARKit tracking state
- **Values:** 1.0 (normal), 0.5 (limited), 0.0 (not available)
- **Target:** ≥ 0.7

### Tips for Better Coverage

#### For Element Mode (doors/windows)
1. Start 1-2 meters from the element
2. Move in a slow arc around the element
3. Capture both sides of jambs + header + sill
4. Include some surrounding wall for plane reference
5. Don't stay in one spot - move to get different angles

#### For Room Mode
1. Start in one corner
2. Sweep each wall systematically
3. Capture each corner (critical for plane detection)
4. Include floor and ceiling intersection lines
5. End near starting point (helps with consistency)

## Thresholds

### Room Mode
- Voxel size: 7.5 cm
- Min observations: 3
- Min confidence: 0.6
- Min angular diversity: 0.08
- Coverage target: ≥ 65%
- Readiness target: ≥ 70%
- Walls required: ≥ 3
- Corners required: ≥ 2

### Element Mode
- Voxel size: 3-5 cm
- Min observations: 5
- Min confidence: 0.65
- Min angular diversity: 0.12
- Readiness target: ≥ 75%
- Boundary coverage target: ≥ 70%

## Next Steps

1. Test the app with the new logging enabled
2. Capture a door/window and review the logs
3. Identify which metrics are failing
4. Adjust scanning technique based on the logs
5. If metrics still don't improve, consider adjusting thresholds in:
   - `CoverageModels.swift` (ScanMode thresholds)
   - `ReadinessChecker.swift` (readiness criteria)

## Files Modified

1. `CoverageIndicator.swift` - UI redesign
2. `CoverageService.swift` - Added comprehensive logging
3. `VoxelMap.swift` - Added logging for voxel operations
4. `ReadinessChecker.swift` - Added logging for readiness checks
5. `PlaneDetection.swift` - Added logging for plane detection
