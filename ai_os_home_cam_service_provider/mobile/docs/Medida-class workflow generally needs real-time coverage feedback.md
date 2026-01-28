Medida-class workflow generally needs **real-time “coverage feedback”** so the user knows whether the capture is geometrically sufficient for measurement, even if the final metric model is produced in the cloud.

What’s likely happening is that your current capture UX is exposing **the wrong intermediate artifact** (keyframes as standalone photos) instead of exposing **scan completeness and geometric observability**. Keyframes alone will almost never “look like the whole room,” and they are not the right proxy for “will this measure correctly?”

Below is a concrete way to reframe expectations, plus a pragmatic set of **on-device live signals** you can implement quickly that will tell you (and the user) whether a scan is likely to produce reliable measurements.

---

## **1\) Keyframes won’t look like a “room model” by design**

Keyframes are selected to:

* maximize viewpoint diversity,

* avoid redundancy,

* preserve parallax for depth fusion,

* reduce upload size.

A good keyframe set often looks like a handful of partial views—because it is. The “whole-room” feeling comes from **fusing depth \+ poses**, not from viewing keyframes.

So the issue is not that the keyframes don’t show the whole room. The issue is that you need a **preview that is geometry-centric**, not photo-centric.

---

## **2\) What scenarios is a Medida-class solution intended for?**

There are two broad capture scenarios:

### **Scenario A: Element-focused measurement (what Medida reportedly started with)**

* Doors/windows/frames, localized wall segments

* Limited scan volume (1–3 meters range)

* User walks a semicircle around the element

* Results: highly accurate localized dimensions, fast turnaround

In this scenario, you do *not* need a full-room preview. You need a high-confidence reconstruction of the element and its local plane context.

### **Scenario B: Room-scale capture (rooms/kitchens/baths)**

* Requires loop closure / global consistency

* Requires coverage planning (walls \+ corners \+ floor-ceiling)

* More prone to drift and missing geometry

* Results: larger model, broader measurement set

If your current UX is “scan the whole room,” then you absolutely need coverage feedback. Otherwise users will scan “enough photos” but miss the surfaces needed for metric confidence.

Given your message, you are trying to do Scenario B while your app is currently behaving like Scenario A (keyframe-only capture with no geometric coverage feedback).

---

## **3\) What you should show live instead of keyframes**

You want a “scan quality HUD” built from three live products:

### **A. Live depth/mesh preview (coarse is fine)**

Even a crude on-device preview is valuable. Options:

* **ARKit Scene Reconstruction mesh** (if enabled) for a rough mesh overlay.

* **Accumulated point cloud**: fuse LiDAR points into a rolling point cloud in world space.

This is not the final model. It is a **coverage proxy**.

### **B. Coverage heatmap on surfaces**

Maintain a voxel grid (coarse, e.g. 5–10 cm voxels) or surfel map and mark:

* “Observed at least N times”

* “Observed from at least K view angles”

* “Observed with high confidence depth”

Then display: green \= good coverage, yellow \= marginal, red \= missing.

### **C. Measurement readiness indicators (element-level and room-level)**

Instead of “I have 30 keyframes,” show “You can now reliably measure X.”

Example readiness checks:

* Door/window: “Frame boundary detected \+ plane fit stable \+ \>80% edge coverage”

* Room: “4 walls detected \+ at least 2 corners observed \+ floor plane stable”

---

## **4\) The missing concept: geometric observability**

For measurement, you care about **whether geometry is observable**, not whether imagery looks complete.

A scan is “useful for measuring” when:

* poses are stable (no tracking loss, low drift),

* depth is high confidence on relevant surfaces,

* surfaces are observed with sufficient angle diversity,

* structural primitives (planes, corners, openings) are well constrained.

This can be computed live.

---

## **5\) Minimal “Measurement Usefulness” scorecard (implementable now)**

Add these live metrics and thresholds:

### **5.1 Tracking quality (pose reliability)**

* ARKit tracking state is normal for most of scan

* low relocalization events

* camera motion not too fast (blur proxy)

**UI:** “Tracking: Good / Fair / Poor”

### **5.2 Depth quality**

* percent of depth pixels with high confidence

* median depth noise proxy (frame-to-frame depth residual on static areas)

**UI:** “Depth: 72% high-confidence”

### **5.3 Coverage (the most important)**

For each candidate surface/region (or voxel cell):

* number of observations

* min/max view angle range (parallax proxy)

* distance range (LiDAR performs best closer)

**UI:** “Coverage: 3/4 walls captured” (room mode)  
 or “Coverage: left jamb missing” (door mode)

### **5.4 Structural constraint readiness**

Run lightweight detection:

* floor plane found?

* wall plane(s) found?

* corners found (wall-wall intersections)?

* opening rectangle found (door/window)?

**UI:** checklist with ticks.

---

## **6\) What “good capture” looks like for each scenario**

### **Scenario A: Door/window measurement capture**

A good scan is:

* 1–2 meters from the frame

* slow arc motion

* captures both sides of jambs \+ header \+ sill

* some surrounding wall for plane reference

**Preview needed:** local mesh/point cloud around frame \+ rectangle overlay.

### **Scenario B: Room capture**

A good scan is:

* start in one corner, sweep walls

* capture each corner (critical)

* include floor \+ ceiling intersection lines periodically

* end near start (implicit loop closure)

**Preview needed:** coverage heatmap \+ “corners captured” indicators.

---

## **7\) If your expectations are “I should see a full room model live”**

You can, but it’s optional:

* Many successful measurement-first products show *coverage and plane detection*, not a full detailed room model.

* A full live model can be misleading if it looks “complete” but has poor metric conditioning.

So the correct expectation is:  
 **Live preview should communicate measurement confidence**, not final fidelity.

---

## **8\) Concrete next step: add two modes and a gating policy**

### **Mode 1: Element Scan (doors/windows)**

* stop condition: opening detected \+ boundaries sufficiently observed \+ uncertainty below threshold

* upload smaller dataset

### **Mode 2: Room Scan**

* stop condition: floor \+ 3–4 walls \+ ≥2 corners \+ coverage threshold met

* upload larger dataset

And enforce a **hard gate**:

* If readiness is not met, you do not allow “Complete Scan,” or you warn the user that measurement confidence will be low.

# **1\) Lightweight Coverage / Observability Algorithm (On-Device)**

## **Design goals**

* No dense TSDF fusion on-device.

* Use **coarse geometry proxies** that correlate strongly with “will measurement succeed.”

* Produce **real-time readiness signals** for two modes:

  * **Element mode:** door/window/frame measurement

  * **Room mode:** room-scale capture

## **Core idea**

Maintain a **coarse 3D grid (voxel map)** in world coordinates and accumulate “evidence” that a surface has been observed with:

* enough **depth confidence**

* enough **viewpoint diversity**

* enough **repeat observations**

* acceptable **range** (LiDAR regime)

This yields a per-region **Coverage Score** and **Observability Score**.

---

## **Data inputs per frame (from ARKit)**

For each captured depth frame (or keyframe):

* `T_wc`: camera pose (world-from-camera)

* `K`: intrinsics

* `D(u,v)`: depth map in meters (LiDAR or ARDepth)

* `C(u,v)`: depth confidence map (0..2 or 0..1)

* Optional: tracking quality, exposure/blur proxy

You process only a **subsample** of depth pixels (e.g., every 4th pixel in each dimension).

---

## **Spatial structure**

### **Voxel grid (coarse, hashed)**

* Voxel size: **5–10 cm** (room mode), **2–5 cm** (element mode)

* Representation: `Dictionary<VoxelKey, VoxelStats>`

VoxelKey:

* integer coordinates `ix = floor(x / s)`, `iy`, `iz`

VoxelStats (small, constant memory per voxel):

* `obsCount: UInt16`

* `confSum: Float`

* `firstSeenTime: Float` (optional)

* `lastSeenTime: Float`

* `viewDirMean: Vector3` (normalized running mean)

* `viewDirM2: Float` (scalar for angular diversity estimate; see below)

* `rangeMin, rangeMax: Float`

* `normalMean: Vector3` (optional; from local depth gradients)

* `qualityFlags: bitset` (e.g., “stable”, “lowConf”, “tooFar”)

Keep only voxels within ROI radius from camera (e.g., 6–8 m room mode, 3–4 m element mode).

---

## **Per-frame update (fast)**

### **Step A — sample depth points**

For each sampled pixel `(u,v)`:

1. If `C(u,v) < confThreshold` → skip

2. `z = D(u,v)`; if out of range (e.g., `<0.2m` or `> maxRange`) → skip

3. Back-project to camera space:

   * `p_c = z * K^{-1} [u, v, 1]^T`

4. Transform to world:

   * `p_w = T_wc * p_c`

5. Compute voxel key for `p_w`

### **Step B — update voxel evidence**

Let `v = voxel[p_w]` (create if absent).  
 Update:

* `v.obsCount += 1`

* `v.confSum += C(u,v)` (or normalized confidence)

* `v.rangeMin = min(v.rangeMin, z)`; `v.rangeMax = max(v.rangeMax, z)`

* Compute **view direction** (from surface point toward camera):

  * `dir = normalize(cameraPosition_w - p_w)`

* Update running statistics:

  * `v.viewDirMean = normalize(lerp(v.viewDirMean, dir, α))` (α small)

  * Track angular diversity with a cheap proxy:

    * `v.viewDirM2 += (1 - dot(v.viewDirMean, dir))`  
       (accumulates deviation from mean; larger \= more diverse viewpoints)

* `v.lastSeenTime = now`

Optional: estimate a crude normal if you can afford it (Sobel on depth to get local gradients), but you can omit normals and still get strong signal.

### **Step C — maintain a stable “active map”**

Every N frames:

* prune voxels with `now - lastSeenTime > TTL` (e.g., 10–20s)

* clamp max voxels to avoid blowup (LRU or spatial pruning)

---

## **Derive Coverage and Observability scores**

### **For each voxel**

Compute:

* `confAvg = confSum / obsCount`

* `angDiversity = viewDirM2 / obsCount` (approx)

* `rangeSpan = rangeMax - rangeMin`

Define thresholds (tune empirically):

* `obsCount >= N_min` (e.g., 5 element, 3 room)

* `confAvg >= C_min` (e.g., 0.6 normalized)

* `angDiversity >= A_min` (e.g., 0.08 room, 0.12 element)

* `rangeMin <= Z_maxGood` (prefer closer, e.g., \<3.0m room, \<2.0m element)

Voxel is “good” if it passes all.

### **For a Region of Interest (ROI)**

Compute ROI stats over voxels in ROI:

* `goodVoxelRatio = goodVoxels / totalVoxels`

* `coverageScore = clamp(goodVoxelRatio, 0..1)`

* `observabilityScore = clamp(mean(angDiversity_good) / A_target, 0..1)`

* `depthQualityScore = clamp(mean(confAvg) / C_target, 0..1)`

* `poseScore` (from ARKit tracking state, motion blur proxy)

Global readiness score:

`readiness = 0.45*coverageScore +`  
            `0.25*observabilityScore +`  
            `0.20*depthQualityScore +`  
            `0.10*poseScore`

---

## **Room mode: “walls/corners captured” without full reconstruction**

You can infer “room readiness” from the voxel map without meshing:

### **Plane detection (lightweight, optional but valuable)**

Run plane detection periodically using a random subset of world points:

* Use a simple **RANSAC plane fit** (few iterations; sample 3 points, compute plane, count inliers with distance \< d)

* Find dominant planes:

  * 1 horizontal (floor/ceiling)

  * 2–4 vertical (walls)

Then compute:

* `numVerticalPlanesFound`

* `numCornerCandidates` from plane-plane intersections (normals approx orthogonal)

Room gating heuristics:

* `floorPlaneFound == true`

* `numVerticalPlanesFound >= 3` (or 4 ideal)

* `coverageScore >= 0.65`

* `readiness >= 0.70`

If you skip plane detection, a fallback proxy:

* segment voxels by normal direction from viewDir statistics is weak; better to do the RANSAC pass if possible (it is cheap at low sample count).

---

## **Element mode: door/window readiness**

For element scans, define a **tight ROI**:

* A 3–4 m cube centered around initial target direction OR around a user-tapped anchor.

Then you can implement a cheap “opening readiness” without full semantic detection:

* Detect one dominant wall plane in ROI (RANSAC)

* Project ROI points into that plane’s 2D coordinates

* Build an occupancy grid in plane coordinates (e.g., 2 cm bins)

* A door/window opening appears as a rectangular low-occupancy region surrounded by occupied bins.

Gating heuristics:

* `wallPlaneFound == true`

* `openingCandidateFound == true` OR manual user confirms target bounds

* high coverage along boundary bands (left/right jamb \+ header)

* `readiness >= 0.75`

---

## **HUD outputs (what you show)**

At 5–10 Hz, publish:

* `tracking: Good/Fair/Poor`

* `depthQuality: 0..1`

* `coverageScore: 0..1`

* `observabilityScore: 0..1`

* `readiness: 0..1`

* Mode-specific:

  * Room: `wallsDetected`, `cornersDetected`

  * Element: `wallPlaneLocked`, `openingLikely`, `boundaryCoverage`

This is what makes the scan “feel complete,” not keyframes.

---

# **2\) Agent-Executable Implementation Checklist (HUD \+ Gating)**

Below is structured for multiple agents. Each task has **Definition of Done (DoD)** so you can verify completeness.

---

## **Workstream A — Telemetry & Data Capture Plumbing (On-device)**

**A1. Depth \+ pose ingestion**

* Wire ARKit frame callback to capture: pose `T_wc`, depth map `D`, confidence map `C`, intrinsics `K`

* Add throttling: process at max 10–15 Hz (or keyframes only)

* **DoD:** Logging shows synchronized timestamps and valid transforms; can replay a short capture session deterministically.

**A2. Quality metrics**

* Implement motion proxy (delta pose magnitude \+ optional camera exposure time)

* Map ARKit tracking states to score (Normal=1.0, Limited=0.5, NotAvailable=0)

* **DoD:** HUD can show tracking score changing when you intentionally occlude camera.

---

## **Workstream B — Coverage / Observability Map (Voxel \+ Stats)**

**B1. Hashed voxel map**

* Implement VoxelKey quantization with selectable voxel size per mode

* Implement VoxelStats struct (counts, confSum, viewDirMean, viewDirM2, rangeMin/Max, lastSeen)

* Add TTL pruning and capacity management

* **DoD:** After 30s scan, voxel count is bounded and stable; no memory spikes.

**B2. Per-frame voxel updates**

* Implement subsampled depth iteration (stride 4–8)

* Confidence \+ range gating

* Backproject \+ transform to world

* Update VoxelStats

* **DoD:** CPU stays within budget; frame time impact \< \~5–8 ms at 10 Hz.

**B3. Scoring**

* Implement voxel “good” classification

* Compute coverageScore, observabilityScore, depthQualityScore, poseScore, readiness

* **DoD:** Scores move predictably: scanning more surfaces increases coverage; rotating around a point increases observability.

---

## **Workstream C — Mode-Specific Readiness (Room vs Element)**

**C1. Mode framework**

* Implement scan modes: ROOM, ELEMENT

* Parameterize thresholds \+ voxel size per mode

* **DoD:** Switching mode changes HUD thresholds and behavior.

**C2. Plane detection (RANSAC)**

* Sample N points from voxel map (e.g., 2k points)

* Fit dominant planes (1 horizontal, up to 4 vertical)

* Expose `floorPlaneFound`, `verticalPlanesCount`

* **DoD:** In a simple room, planes are detected consistently within 5–10s.

**C3. Corner proxy (optional but recommended)**

* Compute candidate corners from intersections of vertical plane pairs with near-orthogonal normals

* Expose `cornersDetectedCount`

* **DoD:** Corners count increases when user scans into corners.

**C4. Element opening proxy**

* In element ROI, fit wall plane

* Project points to plane coords; compute occupancy grid

* Detect rectangular “hole” candidate \+ boundary coverage bands

* **DoD:** Door/window scans produce openingLikely=true when boundary is sufficiently scanned.

---

## **Workstream D — HUD UX \+ Visual Overlays**

**D1. HUD panel**

* Display tracking (Good/Fair/Poor)

* Display progress bars: Coverage, Observability, Depth Quality, Readiness

* Display mode-specific counters (walls/corners OR opening/boundary)

* **DoD:** HUD updates at 5–10 Hz, no UI jank.

**D2. Coverage visualization**

* Render a sparse point cloud or voxel cubes colored by “goodness”

* Optionally render plane overlays when detected

* **DoD:** User can visually see “red areas” become green as they scan.

---

## **Workstream E — Gating Logic (Completion Rules)**

**E1. Define gating policy**

* ROOM completion requires:

  * floorPlaneFound

  * verticalPlanesCount ≥ 3

  * coverageScore ≥ X

  * readiness ≥ Y

* ELEMENT completion requires:

  * wallPlaneLocked

  * (openingLikely OR manual confirm)

  * boundaryCoverage ≥ X

  * readiness ≥ Y

* **DoD:** Completion can be blocked and unblocked deterministically in test scenes.

**E2. Completion UX**

* Disable “Finish Scan” until gating passes OR require explicit override with warning

* If override: tag session as “low confidence”

* **DoD:** Sessions clearly labeled in logs as PASS/OVERRIDE with reasons.

**E3. Failure reason reporting**

* Provide top 1–3 reasons why gating fails (e.g., “Need 1 more wall,” “Low depth confidence,” “Insufficient parallax”)

* **DoD:** In testing, reasons match observed behavior.

---

## **Workstream F — Test Harness & Acceptance**

**F1. Grounded test scenes**

* Create 3 simple test scripts:

  * door scan pass

  * room scan pass

  * intentionally bad scan fail

* **DoD:** Same scene reliably yields same PASS/FAIL classification.

**F2. Telemetry export**

* Export time series of scores \+ gating decisions

* Export voxel count and plane counts

* **DoD:** You can plot readiness vs time offline and diagnose thresholds.

---

# **Recommended initial thresholds (starting point)**

### **Room mode**

* voxel size: 7.5 cm

* obsCount min: 3

* confAvg min: 0.6

* angDiversity min: 0.08

* completion: coverage ≥ 0.65, readiness ≥ 0.70, verticalPlanes ≥ 3, floor found

### **Element mode**

* voxel size: 3–5 cm

* obsCount min: 5

* confAvg min: 0.65

* angDiversity min: 0.12

* completion: readiness ≥ 0.75, wallPlaneLocked=true, boundaryCoverage ≥ 0.70

You will tune these using your own capture data.

---

# **What this will immediately fix**

* Users stop judging by “do keyframes show the whole room?”

* You give the user **a real-time explanation** of what’s missing.

* You prevent “garbage capture” from entering your cloud pipeline.

