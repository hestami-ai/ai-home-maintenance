# **Medida‑Class Mobile Scanning SDK (RGB \+ Depth, Cloud‑Allowed)**

## **Introduction and Goal**

Medida’s vision is to enable millimeter-accurate 3D measurements and photorealistic models from a simple smartphone scan. The target platform is an iPhone 14+ equipped with LiDAR (RGB-D sensor) and IMU, scanning indoor architectural scenes (rooms, doors, windows) under real-world conditions (low-texture walls, mixed lighting). The goal is to design a state-of-the-art pipeline that produces two key outcomes: (1) metric-accurate geometry (with errors on the order of only a few millimeters) and (2) high-fidelity, consistent textures, suitable for renovation and construction use-cases. By leveraging on-device capture and cloud processing, the SDK should transform a handheld scan into a usable 3D model and precise measurements “in minutes,” effectively replacing manual tape measurements. This requires bringing together the best algorithms (2022–2026 era) for sensor fusion, SLAM, reconstruction, and rendering into an end-to-end system. Context: The renovation measurement industry still relies on manual measurements with tape measures – a slow, error-prone process unchanged for centuries. Medida (founded 2024\) has demonstrated the demand for a smartphone solution by deploying in 35 U.S. states, achieving $3M ARR with a LiDAR+AI scanning system that eliminates the need for a human surveyor. Their solution currently focuses on doors and windows with *“millimeter-level accuracy”*, now expanding to kitchens, flooring, bathrooms. This research task aims to identify *how* such accuracy and photorealism can be achieved, and to propose a pipeline that meets Medida-class performance in real-world indoor environments.

## **Core Challenges and Research Questions**

To reach Medida’s goals, several core questions must be addressed:

* Mm-Level Accuracy: What pipeline can extract millimeter-accurate measurements from handheld RGB-D scans on an iPhone? How to minimize errors from sensor noise and SLAM drift so that key dimensions (e.g. door width) are within a few mm of ground truth?  
* Photorealistic 3D Reconstruction: How can we achieve high-fidelity geometry and texture simultaneously? We seek realistic surface appearance (high-res textures, correct colors) *and* accurate geometry. How to ensure texturing or mesh smoothing steps do not distort metric fidelity?  
* On-Device vs Cloud Processing: What is the optimal split between on-device processing (for real-time feedback and capture assistance) and cloud processing (for heavy computation)? Which stages can be done in real-time on the iPhone’s A16/A17 chip, and which should be offloaded to a server to maximize accuracy?  
* Error Sources and Mitigation: What are the fundamental error sources in mobile scanning – e.g. sensor noise, pose drift, lighting changes, reflective or textureless surfaces – and how can algorithms detect or bound these errors? How to quantify uncertainty in the final measurements and ensure reliability (with confidence intervals at the millimeter scale)?

These questions span the entire pipeline: from sensor capture and calibration, through pose estimation and mapping, to dense reconstruction, texturing, and measurement extraction. We structure the investigation along key stages of the pipeline, reviewing state-of-the-art methods (2022–2026) and evaluating their accuracy, robustness, and feasibility for a mobile/cloud SDK.

## **Capture & Sensor Fusion (RGB \+ Depth \+ IMU)**

Sensor Alignment and Calibration: The iPhone’s LiDAR and RGB camera must be tightly calibrated to avoid misalignment errors. Apple’s factory calibration typically provides aligned depth maps (e.g. ARKit produces a 256×192 depth map per frame, already registered to the RGB image). Nevertheless, any slight extrinsic calibration error will directly affect measurement accuracy (e.g. a 1° misalignment could cause mm-level discrepancies over distances). Best practice is to validate and, if needed, calibrate the RGB-D extrinsics. This can be done by scanning a reference object with known dimensions or using algorithms for cross-modal calibration. Given that our target is mm accuracy, even subtle calibration drift over time should be monitored (e.g. temperature changes can alter intrinsics slightly). An on-device calibration check step could be included (for example, detecting a planar wall in the scan and ensuring the LiDAR points align to a plane in the RGB image). Synchronized Capture: We will leverage Apple’s ARKit framework for synchronized capture of IMU, camera frames, and LiDAR depth. ARKit’s Visual-Inertial Odometry (VIO) provides real-time device pose tracking at high frequency by fusing the IMU and camera feature tracking. VIO gives robust pose estimates even in low-texture or low-light scenes (where pure vision might fail) by relying on inertial continuity. The LiDAR sensor provides depth images at up to \~10 fps, which ARKit fuses with the VIO pose to build an internal scene understanding. Careful timestamp alignment is crucial so that each depth frame is paired with the correct camera pose and image. Pose Estimation: For pose tracking, we consider three approaches: (1) ARKit VIO (classical feature-based SLAM with IMU), (2) a learned pose network (trained end-to-end to regress camera pose from images, or refine ARKit’s pose), and (3) a hybrid SLAM with additional mapping (e.g. adding loop closure or bundle adjustment on top of ARKit). ARKit’s VIO is known to be very accurate in local tracking (often \<1% drift) and leverages hardware efficiently, so we will use it as the baseline for real-time tracking. However, VIO alone can accumulate drift over a long scan (especially rotation and scale drift in purely visual segments). Since the iPhone provides absolute scale via LiDAR and IMU, scale drift is largely mitigated, but loop closure is not automatically handled by ARKit (it has limited mapping). To achieve global consistency and minimize drift, a cloud-based Bundle Adjustment (BA) will be performed after capture: we will send keyframes (images \+ depth) to the cloud and run a global pose graph optimization, using the depth maps to add pose constraints (point clouds from overlapping frames can be aligned). This is similar to approaches that perform BA with depth constraints or plane constraints to reduce drift. Notably, research has shown that incorporating structural constraints (like Manhattan-world plane alignment) during SLAM can dramatically reduce drift in indoor scenes: one LiDAR SLAM with Manhattan plane constraints achieved up to 99% reduction in trajectory error in a corridor environment compared to standard LOAM. We will incorporate such constraints in the global optimization (e.g. encourage detected walls to remain vertical and parallel). Frame Selection: During capture, the SDK should smartly select and compress frames to send to the cloud. Rather than uploading hundreds of redundant frames, we use ARKit’s spatial tracking data to choose keyframes that cover the scene from different viewpoints. For example, we might select a new keyframe every \~10–15° of rotation or every 0.5 m of translation, or when a new area of the scene enters view. This reduces data size and also avoids overloading the fusion stage with repetitive data. If the device returns confidence scores for depth pixels (ARKit provides a confidence map for LiDAR depth), those can be stored to weight the fusion process. Capture Best Practices: To maximize accuracy, the user should be guided to follow best practices identified by recent studies. A 2023 experiment found that an iPad Pro LiDAR produced point clouds with \<1 mm error (plane fitting residual) when the device was kept static or on a tripod, but error grew to \~1 cm when scanning dynamically due to pose errors. This indicates we should encourage a steady scanning motion: move slowly and smoothly, avoid sudden jumps or shakes, and maintain good overlap between successive frames. Additionally, keeping the sensor 1–1.5 m from surfaces yields the best results (too close can introduce distortion, too far reduces LiDAR accuracy). The app can provide real-time feedback (e.g. “move closer to the wall” or “slow down”) based on ARKit tracking quality and depth return quality. By tightly fusing the camera and LiDAR streams (ensuring each depth pixel is tagged with a precise pose and intrinsics), we lay a solid foundation for accurate reconstruction.

## **Geometry Reconstruction (Dense 3D Mapping)**

With a set of posed RGB-D keyframes, the next stage is to fuse these into a dense, metrically accurate 3D model. This involves depth processing, multi-view integration, and surface extraction. Depth Estimation and Completeness: The iPhone’s LiDAR provides an initial depth map but at a relatively low resolution (\~256×192) and with some limitations (e.g. maximum range \~5m, no returns on glass or very dark surfaces). To achieve high-quality geometry, we can enhance depth data in two ways: (1) Multi-view Stereo (MVS) from RGB frames, and (2) Depth super-resolution or completion using learned models. Classic MVS (like COLMAP’s patch-based stereo) could run on the cloud to densify areas where LiDAR returns were sparse or missing (e.g. far wall textures or through door openings). However, COLMAP is batch-oriented and might be too slow for near-real-time use. Recent advances in learned multi-view depth offer real-time capable solutions: for example, NeuralRecon (CVPR 2021\) processes ARKit RGB-D streams with a CNN to predict per-frame depth and fuse into a TSDF grid in real-time. NeuralRecon’s learned depth fusion uses a GRU to incrementally integrate new frames, handling sensor noise and occlusions better than naive averaging. We will consider a lightweight depth refinement network that runs on the cloud: it takes the initial ARKit depth \+ images from multiple viewpoints and produces a refined depth (and confidence map) for each keyframe. The network can learn to fill holes (exploiting multi-view cues) and filter out noisy measurements. Notably, research on depth fusion networks (e.g. *RoutedFusion* and *DFusion*) shows that learning-based fusion can outperform raw TSDF in accuracy by accounting for typical sensor biases and outliers. Fusion Method – TSDF vs Surfel vs Implicit: After obtaining depth maps (raw or refined) for all keyframes, we fuse them into a single 3D representation. The classic choice is volumetric TSDF fusion (Truncated Signed Distance Function) as popularized by KinectFusion. TSDF fusion works by converting each depth map into a signed distance field and averaging these in a volumetric grid, which is then used to extract an iso-surface (the mesh). TSDFs tend to produce smooth, noise-resistant surfaces and naturally fill small holes via truncation. They are also amenable to weighted fusion (e.g. weighting by confidence or incidence angle). However, TSDF can oversmooth fine details if voxel resolution is not high enough, and large memory volumes can be a challenge on mobile (though fine on cloud). Alternatively, surfel fusion (point-based fusion with per-point normals, as in ElasticFusion) directly merges point clouds, preserving detail but often yielding noisy or hole-ridden meshes if not post-processed. A third emerging option is implicit neural mapping, where a coordinate-based network represents the surface (e.g. Neural SDFs). Methods like NICE-SLAM (2022) optimize a neural implicit scene representation in real-time, achieving impressive detail, but they require a GPU and are still slower than TSDF, with convergence taking on the order of minutes for a room. For our SDK, a practical approach is to adopt TSDF fusion as the backbone, augmented with modern improvements. TSDF is still a reliable way to get a baseline geometry with known error bounds. We will allocate a volumetric grid covering the scene (perhaps 5m × 5m × 3m for a room, at \~5 mm voxel resolution to capture mm detail). Because this could be millions of voxels, the computation will be on the cloud (allowing a powerful GPU to integrate dozens of frames quickly). To avoid artifacts, we incorporate uncertainty-aware fusion: e.g. use the sensor noise model to adjust the weight of each depth observation by distance (LiDAR noise increases with range) and angle (grazing angles are less reliable). Additionally, a confidence map from the depth refinement network can down-weight regions likely to be erroneous (common around depth discontinuities or shiny objects). Recent work on uncertainty-aware SLAM suggests this can improve accuracy of the reconstructed surface. Handling Drift and Loop Closure: If the global BA (pose optimization) succeeded, gross drift should be minimized. However, small residual mis-alignments can cause a “double surface” effect in fused maps (e.g. a wall mapped twice with an offset). To mitigate this, we will perform pose graph refinement with dense alignment: after initial TSDF integration, we can extract a point cloud or TSDF from the model and use an ICP (Iterative Closest Point) or plane alignment to nudge any out-of-place frames. Some systems (e.g. BundleFusion) iteratively alternate between camera pose refinement and TSDF updates to reach consistency. We can incorporate a final ICP pass on the cloud to ensure the fused model’s surfaces align well with original points. Mesh Extraction: Once the TSDF volume is integrated, we extract a polygonal mesh. The standard method is Marching Cubes to produce a watertight surface from the TSDF zero-level set. Marching Cubes will yield a dense mesh (potentially millions of triangles for a whole room at 5mm resolution). We will likely apply mesh simplification (quadric decimation) to reduce triangle count while preserving shape within a tolerance (say 1 mm). Another option is Screened Poisson Surface Reconstruction if we choose to fuse via point cloud; Poisson reconstruction can produce smooth surfaces and fill small holes, but it requires tuning to avoid over-smoothing. Given our weighted TSDF already does smoothing, Marching Cubes is appropriate. To get sharp edges where appropriate (like where walls meet the floor), we can apply a planar segmentation and snapping on the mesh: detect large planar patches (using RANSAC or region growing on mesh normals) and then “split” the mesh along their intersection lines to enforce sharp boundaries. This step can improve the architectural clarity of the model – e.g. making wall corners 90° – which benefits measurement extraction. Some recent research (e.g. *ManhattanSDF*) explicitly constrain surfaces to Manhattan orientations during reconstruction; our approach is a simpler post-process that fits planes to the TSDF mesh. It’s important that any such snapping remains within the sensor error bounds (i.e. don’t deform the mesh more than a couple of mm to fit an ideal plane, unless there is high confidence). Accuracy Considerations: With this pipeline, what accuracy can we expect? The raw sensor accuracy of iPhone LiDAR for object-scale scenes is around ±1 cm for objects \>10 cm. But naive use in large scenes can accumulate to 10–20 cm error if not corrected. By applying global BA and plane constraints, we aim to bring the error way down. Similar systems in research and practice give us optimism: for instance, a study comparing mobile LiDAR scan apps found one pipeline achieved \~10% error on a scale model versus 42% for another, underlining that good algorithms can vastly improve accuracy. Our target is that key measurements (like wall-to-wall distance, door widths) are within, say, ±2–3 mm or \<0.5% of ground truth for room-scale dimensions. Achieving this will rely on correct alignment (so errors don’t accumulate) and noise averaging (so random noise cancels out). The volumetric fusion helps with the latter, as averaging many frames can yield sub-centimeter surface accuracy. Also, by explicitly modeling planes and known angles, we reduce systematic bending of the model. We will validate these claims in the Evaluation section, but each piece (high-res depth, BA, TSDF, plane-fitting) is chosen to push toward mm-level agreement with reality.

## **Photorealistic Texturing & Appearance**

Alongside geometric accuracy, Medida requires photorealistic textures and visuals so that the 3D model is useful for client visualization (e.g. seeing how a new window fits) and not just a mesh of points. Several challenges arise: achieving consistent color across the model, high resolution detail, avoiding seams or blurry patches, and handling varying lighting or reflective surfaces. Texture Atlas Generation: The traditional approach to texturing a 3D reconstruction is to unwrap the mesh to a UV atlas and project the input images onto it. We will generate a texture atlas for the mesh, aiming for resolution sufficient to discern small features (e.g. screw holes or wood grain if present). Each face of the mesh will sample from one or more input images. A naive approach might simply take the nearest camera view’s pixels (“projective texture mapping”), but this often yields visible seams and lighting inconsistencies when adjacent faces use different source images. Instead, we will apply global color calibration and seam optimization. There is rich literature on color consistency for multi-view imagery. One class of methods uses photometric alignment: e.g., adjusting exposure and white balance per image to minimize differences in overlapping regions. We can adopt a global optimization approach (as in Brown and Lowe’s photometric calibration or more recent variants) to find per-image color gain and bias that best harmonize the scene’s appearance. This will correct for the iPhone auto-exposure changes and lighting differences as the user scans (e.g. one side of a room might be brighter due to a window). After color correction, we select for each surface region an optimal source image or blend of images that maximizes sharpness while minimizing artifacts. Modern texturing pipelines (like in OpenMVG/OpenMVS) often do a view selection for each face based on angle and resolution, then a marking and blending step: if multiple images cover a face, they blend colors to avoid a harsh seam. We will refine this by doing a seam placement optimization – cutting the texture atlas along object boundaries or where lighting differences are minimal, to hide transitions. The result should be a single consistent texture map for the whole mesh. Advanced Neural Rendering Approaches: While traditional texture mapping is effective, the absolute gold standard for photorealism in recent years comes from neural rendering techniques like NeRF (Neural Radiance Fields) and 3D Gaussian Splatting (3DGS). These methods can capture view-dependent effects (shiny reflections, transparency) and produce images that look nearly identical to the real scene. Incorporating such methods in a mobile scanning pipeline is cutting-edge, but we consider a hybrid approach: use neural rendering for refinement and filling gaps, then convert the result to a mesh-based format for our output (since clients likely need a standard mesh \+ texture for CAD or BIM workflows). One promising approach is demonstrated by GSFusion (2024), which *“incorporate\[s\] \[3D Gaussian Splatting\] into a volumetric mapping system”* to get the best of both worlds. In GSFusion, a TSDF grid provides the accurate geometry, and a set of rendered 3D Gaussian “splats” provide high-quality appearance, significantly improving visual realism without sacrificing the underlying geometry. The authors note that pure Gaussian maps struggle with structural consistency and real-time performance, but by using the TSDF geometry as a scaffold, they reduced artifacts and achieved fast rendering. Inspired by this, our pipeline could perform an optional cloud refinement: given the fused mesh and all keyframe images, optimize a lightweight neural scene representation (e.g. a set of Gaussians or a small NeRF) over a short time budget (a few minutes). This neural model would adjust fine details of color and even geometry at a sub-voxel level to better match the input photos (e.g. recovering the slight bump of a hinge that the TSDF smoothed over, or the correct glossy appearance of a marble countertop). After optimization, we would distill this implicit representation back into a textured mesh: essentially by sampling the neural model to re-texture the mesh, or by extracting a slightly refined geometry from it. For example, one could ray-trace the NeRF/3DGS from many viewpoints to create a very detailed point cloud and then mesh it, but a more efficient approach is to use the existing mesh and only update its vertex colors/texture using the neural model as a reference. This step is admittedly advanced and might be reserved for the highest-fidelity mode of the SDK (since NeRF training is computationally heavy). If the time budget is limited, the fallback is our more traditional texture atlas approach which can already produce good results. We note that in prior work, NeRF-based SLAM systems have achieved impressive loop closure and detail (implicitly correcting pose as well), but at the cost of slower operation. Given our cloud allowance, we can afford a bit of offline processing, but we’ll balance it to meet a delivery time of e.g. \<5 minutes per scan for the final results. Reflective and Low-Texture Surfaces: Mirror and glass surfaces are notorious failure cases for RGB-D scanning. The LiDAR returns either nothing or very noisy readings (as infrared passes through or scatters), and vision algorithms can confuse reflections for actual structure. Our pipeline will treat these carefully: first, during depth fusion, any depth pixels marked as low confidence or extremely inconsistent (e.g. a cluster of points floating in mid-air or on a mirror) will be filtered out to avoid phantom geometry. For texturing, if a surface is mirror-like (detected by lack of LiDAR hits and recognizing a planar region with a symmetric color pattern), we have two choices: either leave it blank (transparent) or insert a proxy geometry (e.g. assume a planar mirror with the size inferred from the frame). Since our aim is measurements, we prefer not to hallucinate non-existent geometry. So we might represent a mirror as just a planar hole or a transparent texture in the mesh, indicating “mirror here.” The measurements around it (e.g. the size of the mirror or window) can still be taken from the boundary. For low-texture walls (plain white walls), LiDAR will give geometry, but texturing them can show exposure variation. Our color optimization should equalize the wall color across frames. If there is slight lighting gradient on a wall, that is reality (from illumination), and we might keep it if photorealism is desired. But if the goal is a visually consistent model, we could even out wall lighting via an albedo estimation (e.g. assuming Lambertian walls, solve for diffuse color vs shading). Some recent works integrate photometric normals and lighting estimation into RGB-D reconstruction – for example, they perform multi-view photometric stereo to refine surface detail and remove lighting effects. While very sophisticated, these are likely overkill. A simpler heuristic: detect large continuous areas of similar color (a wall) and smooth their texture in the atlas to remove camera auto-exposure flicker. In summary, our texturing stage will combine industry-proven techniques (global color correction, optimal seams) with options for neural refinement to achieve *consistent, high-res textures*. The end result is a photorealistic textured mesh that can be viewed on any device. All original image data is preserved too, so if needed the texture can be re-computed or enhanced as algorithms improve.

## **Measurement Extraction and Verification**

Beyond creating a pretty 3D model, the SDK must output accurate measurements of architectural elements – this is core to Medida’s value (automating renovation measurements). We therefore include a dedicated stage to extract and report measurements with uncertainty. Plane and Corner Detection: We first parse the geometry to identify structures of interest. A large fraction of indoor geometry can be described by planes (walls, floor, ceiling) meeting at right angles (Manhattan world assumption). We will run a plane detection algorithm on the fused mesh or point cloud. Techniques like RANSAC can find dominant planes; we can leverage the Manhattan assumption by looking for three orthogonal directions that many planes align with. If the device’s coordinate system is aligned via gravity (ARKit gives us gravity vector) and perhaps one dominant wall normal, we can easily classify planes as vertical or horizontal. These planar segments are then labeled (wall1, wall2, floor, etc.). The intersections of planes give candidate corner points and edges. For example, the line where a wall meets the floor is a straight edge; the intersection of two wall-planes gives a vertical corner line. By computing these intersections from the plane equations (which are robustly estimated from many points), we get very precise definitions of corners – likely more precise than any individual points in the raw mesh. This is a key advantage: even if the raw mesh had slight waviness, fitting a plane through it effectively averages out noise, yielding mm-accurate plane parameters. Indeed, research on plane-constrained SLAM shows improved accuracy because the system “locks onto” these large-scale structural features. Door and Window Recognition: While planes cover the basic surfaces, we also need to locate specific structures like door frames, window openings, etc., and measure them. This is where semantic priors or object detection comes in. We can employ a simple object detection on the images (e.g. a neural network trained to recognize doors, window panes, etc. in RGB) and then project those detections into the 3D model. If an image detects a rectangular door outline, we can map those image pixels via the depth data to 3D and thus localize the door in the model. Alternatively, since we have a full 3D mesh, we can look for rectangular holes or intrusions in the wall planes. A door, for instance, might appear as an opening (if the door is removed) or as a door geometry slightly inset from the wall. If the scan is done with the door closed, we might just measure the door *frame*. In any case, by combining geometric cues (an axis-aligned rectangular shape on a wall plane) and perhaps known dimensions (doors often have standard sizes), we can reliably identify them. We will likely implement a rule-based classifier: find rectangular clusters of points on wall planes that either are empty (hole) or have a different plane (the door) inset – that would indicate a doorway. Similarly for windows: a rectangular hole or glass pane on a wall. The IMU (gravity) helps differentiate windows (which usually aren’t floor-bound, they float at some height) from doors (which extend to floor). Measurement Computation: Once we have the structural entities (planes, openings), computing measurements is straightforward analytically. For each wall plane, we can report its width and height (by projecting the plane’s portion of the model onto axes). For a door, we compute its width and height, likely by taking the distance between the two vertical edges for width, and floor to top-of-frame for height. Because these edges come from plane-plane intersections, their positions come from least-squares fits and should be very precise. We will output dimensions in millimeters (since we target mm accuracy). We also measure distances like wall-to-wall (room width) by taking parallel planes (e.g. two opposite walls) and computing the distance between their planes. If the walls are not perfectly parallel (old houses might not be), we might detect that as a slight angle; however, Manhattan assumption expects parallel. In case of slight non-parallelism, we can either report an average distance or both distances at each end (but that might overwhelm the user). Likely, we assume the deviation is small enough to report a single number. For doors/windows, a tolerance can be given (e.g. width \= 800.5 mm ±1 mm). Uncertainty and Error Bounds: It’s important to quantify confidence in the measurements. The system can provide an uncertainty estimate for each measurement by propagating the uncertainties from the data. For instance, when fitting a plane to a wall, we get a standard deviation of point distances to the plane – if that is say 2 mm, it indicates the wall had \~2 mm noise or deviation, so the distance between this wall and another wall could have a ±2 mm uncertainty plus any other factors. We will present a 95% confidence interval for each reported dimension. If the pipeline is very confident (lots of consistent data), this interval might be small (±1–2 mm); if the area was hard to scan (few returns, or partially occluded), we might see larger uncertainty (±5 mm, etc.). This alerts users to double-check critical areas. One way to get per-measurement uncertainty is via Monte Carlo simulation: perturb the input data or the pose slightly within expected noise bounds, re-run the measurement extraction, and see the variation. However, that’s expensive to do repeatedly. Instead, we can analytically derive it in simple cases (for a plane, the covariance of the fit gives distance uncertainty). We will incorporate known sensor noise models – e.g. LiDAR ranging noise might be \~5 mm at 2 m range – to inform these calculations. Structural Priors to Improve Metrics: We can also inject domain-specific knowledge to stabilize measurements. For example, if our raw output for a standard door frame comes out to 802 mm width and we know from context it’s likely meant to be 800 mm, we might “snap” it to 800 exactly. This must be done cautiously – we don’t want to override real data blindly. But given the renovation domain, many elements have standard sizes (e.g. a window might be exactly 48 inches wide). A possible approach is to have a library of common dimensions and if the measured size is within a small epsilon of a standard, ask: is it more plausible the slight difference is measurement error or truly a non-standard size? In renovation, existing structures can indeed be off-standard, so we shouldn’t automatically quantize. Perhaps a better approach is to report *both* the raw measurement and note “closest standard size is X”. Ultimately, providing an accurate measurement with uncertainty might suffice, and let the user decide if it’s effectively a standard size. Incorporating semantic context (like recognizing a door vs a window) allows us to present the measurements in a user-friendly way (grouped by element type) and apply any element-specific logic (e.g. calculating area for flooring, or perimeter of a window for frames, etc.). The semantic labels could come from the detection step or even from user input (the user might tag certain features during or after scan). Finally, all extracted measurements will be cross-checked with the geometric model to ensure consistency (no impossible geometry). If inconsistencies arise (e.g. sum of two segment lengths doesn’t equal total length due to rounding), we ensure the numbers are reconciled or clearly reported.

## **On-Device vs Cloud Offload Strategy**

To achieve the above pipeline efficiently, we split tasks between the iPhone (on-device) and the cloud:

* On-Device (Real-Time): The iPhone will handle all real-time capture duties. This includes sensor data acquisition (RGB, depth, IMU) via ARKit, real-time pose tracking (VIO), and a lightweight meshing for user feedback. For example, as the user scans, we can render a low-poly live mesh or point cloud on the phone screen to show coverage (ARKit provides a raw point cloud of LiDAR points each frame). This helps the user see if they missed a spot. The phone can also perform basic plane detection in real-time (ARKit has plane detection for horizontal/vertical planes) to guide the process (e.g. highlighting a detected wall or floor). These on-device computations are chosen for responsiveness and to leverage Apple’s optimized libraries (like RealityKit) for things like meshing and plane detection. However, on-device results will be coarse – the final high-res processing is deferred to the cloud.  
* Cloud (Post-Processing): Once capture is done (likely a scan of 30 seconds to 2 minutes), the heavy lifting is done on the cloud server. The device will upload the selected keyframe data: this includes images (possibly at full resolution or downsampled if too large), depth maps, and the ARKit pose trajectory. Thanks to keyframe selection, the data volume is manageable – perhaps on the order of 50–100 frames, which even at 12 MP each is \~ hundreds of MB; compressed (JPEG images, depth as maybe sparse points) it might be only tens of MB. With a good network or Wi-Fi, upload can take a few seconds to a minute. Once on the cloud, we perform the global mapping pipeline: bundle adjustment, depth refinement, TSDF fusion, meshing, texturing, analysis – as described in previous sections. The cloud can use GPU clusters to parallelize tasks (e.g. run the depth CNN on all frames simultaneously, or split the volume for TSDF fusion). We aim for a total cloud processing time of perhaps \~2–3 minutes for a typical room scan, which is reasonable in a professional workflow. The cloud then sends back the final outputs (mesh, textures, measurements). The user could receive a notification and download the results in-app.  
* Streaming and Data Handling: A critical design aspect is *what* data to stream to cloud to minimize bandwidth while preserving accuracy. One strategy is to stream only depth \+ pose \+ low-res imagery during scanning, to start a preliminary reconstruction on the fly, and then upload full-res imagery later for texturing. For example, as the user scans, the app could send frame-by-frame depth maps and poses to the cloud, allowing a rough TSDF map to build progressively (this rough model might even be sent back to show a preview). After scanning, the high-res photos can be uploaded for final texturing. This two-tier approach ensures the cloud has a head start on geometry before the user even finishes scanning, potentially reducing wait time.

Alternatively, since connectivity may not always be robust on-site, the SDK could also operate in a *delayed upload* mode: store everything on-device and upload when a connection is available. This requires enough local storage for images and possibly partial processing on-device to compress data. We should therefore also consider compressing depth maps (e.g. as point clouds) and using efficient image compression. There’s also a privacy consideration: uploading raw imagery of someone’s home to the cloud might raise concerns. A solution is to perform an on-device privacy filter (e.g. blurring out faces or photos on the wall in the images) before upload, or allow an opt-out to do full on-device processing (with a longer wait and reduced quality if the device cannot handle the full load). Cloud Security & Reliability: Since the cloud will handle possibly sensitive spatial data of interiors, strong encryption in transit (HTTPS) and at rest is required. If targeting enterprise clients (construction firms), we might even allow them to run the cloud component in a private cloud or on-premises. The SDK architecture should be flexible in this regard. Device Compute Constraints: The iPhone 14 Pro has a powerful Apple Neural Engine and GPU – in theory it could run some of the reconstruction steps (there are demos of real-time TSDF fusion on device). However, doing so at full fidelity (mm accuracy) would likely overheat or throttle the phone. For example, a high-quality photogrammetry on device (like Apple’s Object Capture) can take several minutes for just a small object and uses significant memory. Given mm accuracy requires processing large point clouds and images, offloading to cloud is justified to meet performance and accuracy targets. We still use the device for what it does best in real-time (tracking, preview). The division is thus: Device \= data collection & real-time UX, Cloud \= heavy computation & refinement.

## **Evaluation & Benchmarking Plan**

To validate the pipeline’s performance (especially the mm-level accuracy claim), a rigorous evaluation plan is needed: Datasets & Scenes: We will collect a test suite of 10–20 indoor scenes representative of our use cases: e.g. single door frame in a wall, a wall with multiple windows, a small room (with 4 walls, a door, a window), a large open space (for stress-testing range), a kitchen with cabinets (for smaller details), etc. Where possible, we include both high-texture scenes (lots of visual features) and low-texture scenes (blank walls, low lighting) to test robustness. Dynamic objects should be minimal (we prefer static scenes for measurement accuracy). Ground Truth Acquisition: For each scene, we obtain ground-truth measurements using high-precision methods. This could include: hand measuring key distances with laser rangefinders and steel tape (for critical distances like door width), and using a terrestrial laser scanner or industrial scanner to get a full 3D ground-truth model. For instance, a FARO or Leica laser scanner gives point clouds with sub-millimeter accuracy over the whole room; or a structured-light scanner for smaller areas. In some cases, if that’s not available, we may rely on a combination of manual reference measurements (like marking specific points and measuring between them carefully). Ground truth for textures (for PSNR/SSIM) is basically the original photographs themselves, or a high-quality panorama of the room for comparison. Accuracy Metrics: We will evaluate:

* Linear measurement error: For each important dimension (width of each door/window, ceiling height, room length, etc.), compare the SDK’s measurement to the ground truth. Report the absolute error in mm and relative error. We expect most errors to be within a few millimeters; we’ll compute mean and 95th percentile error.  
* Surface deviation: Using the ground-truth point cloud or mesh, compute the cloud-to-cloud or cloud-to-mesh distance distribution to our reconstructed mesh. E.g., use the CloudCompare tool to get average distance and standard deviation. This will show if any particular area bulges or deviates by more than a few mm. Ideally, mean deviation should be \<5 mm and max deviations perhaps \<10 mm except at edges or holes.  
* Texture fidelity: To assess photorealism, we can use PSNR (Peak Signal-to-Noise Ratio) and SSIM (Structural Similarity) metrics. One approach: take the output textured model, render it from the same viewpoints as a few input photos, and compare the render to the actual photo. High PSNR/SSIM would indicate the texture mapping preserved details. We will also rely on human inspection for perceptual quality (since metrics may not capture everything). Additionally, check for obvious artifacts like ghosting at seams, blurriness, or color inconsistency.  
* Robustness tests: We will intentionally scan some scenes under challenging conditions – e.g. very low light (to test if VIO still works or if motion blur affects images), featureless walls (to test if VIO drifts or if LiDAR carries it), and presence of mirrors or glass. The metric here is not just accuracy but whether the system gracefully handles it (e.g. mirror might create a hole – that’s fine as long as it doesn’t create a false wall). We document any failure modes: e.g., did a glossy floor cause holes in the mesh? Did the VIO lose tracking causing a misaligned model (and if so, did our global BA fix it)? If failures are found, we feed that back into pipeline improvement (maybe require the user to do a loop to allow loop closure, etc.).  
* Processing time and device thermal: We will record the time taken for each stage, and whether the iPhone experienced any thermal slowdowns. For on-device, ensure the app can run for a few minutes of scanning without overheating. For cloud, measure the end-to-end latency from upload to result download. The goal is to keep this reasonably low (few minutes). If any stage is a bottleneck, we’ll note it and consider faster alternatives or approximations.

Benchmarks and Baselines: We will also benchmark against existing solutions if possible: for example, compare our results to those from leading apps like Polycam or Scaniverse on the same scene (both in geometry and measurement accuracy). According to one 2025 study, different apps can vary widely: Scaniverse achieved \~10% error on a test object vs 42% for Polycam in that test. We expect our solution to outperform those, hopefully bringing error down to just a few percent or better. If available, we might also test Apple’s built-in RoomPlan API (which creates simplified room models) to see how we compare in dimension accuracy. Datasets: Besides our own collected scenes, we can validate on public datasets. For example, the ScanNet dataset (though focused on semantic labeling) provides many RGB-D indoor scans; however, their “ground truth” is the same type of TSDF reconstructions, not precision ground truth. The newer TUM MVIB dataset or others might have precise reconstructions. If we find a dataset with accurate room dimensions (perhaps the SUN3D or Matterport3D dataset which has some alignment to floor plans), we could run our pipeline on those frames and see if we reconstruct consistent layouts. In summary, the evaluation will confirm if the pipeline meets the mm-level accuracy bar (with statistical confidence) and identify any edge cases where errors creep above that. The texture quality metrics and stress tests ensure we didn’t trade off visual realism for accuracy (we aim for both). We will compile results in an evaluation report with tables of errors and example visuals.

## **Comparative Pipeline Approaches and Trade-offs**

To ensure we choose the best design, we surveyed a range of pipeline architectures (from classical to bleeding-edge). Below is a comparison of several candidate approaches, assessed on key criteria: metric accuracy, visual fidelity, runtime (performance), device feasibility, and risk factors. This serves as a “baseline matrix” of options:

1. Classic RGB-D SLAM with TSDF Fusion: This pipeline resembles KinectFusion or BundleFusion: use ARKit poses (or ORB-SLAM with depth) for tracking, integrate depth frames into a TSDF volume in real-time on device, and output a mesh.  
   * *Accuracy:* Moderate. TSDF averages noise well, but without global BA, drift could cause a few-cm errors over a room.  
   * *Photorealism:* Low. Visual quality is limited by on-device color fusion (often blurry, and lighting not corrected).  
   * *Runtime:* Real-time feasible on device at lower resolution; high-res might lag or overheat.  
   * *Device cost:* Uses phone’s GPU/CPU heavily; risk of thermal throttling for large scenes.  
   * *Risks:* No cloud means no heavy optimization; if tracking fails, holes or misalignments remain. Good for quick preview, but not enough for mm accuracy or final textures.  
2. Learned Multi-View Depth \+ TSDF: This augments the above by using a learned depth model to improve depth quality and possibly a learned fusion module (like NeuralRecon’s GRU fusion). The heavy learning parts run on cloud GPU.  
   * *Accuracy:* High potential. The network can fill gaps and reduce noise, leading to more complete and accurate TSDF surfaces (especially for thin structures or distant surfaces classic methods might miss).  
   * *Photorealism:* Moderate. Geometry is improved (which indirectly helps texture mapping), but final texturing is still standard.  
   * *Runtime:* Cloud processing adds some time (neural networks on dozens of frames). With optimization, could be a couple minutes – acceptable.  
   * *Device cost:* Light; device just captures. Cloud GPU required.  
   * *Risks:* Learned models might generalize poorly to unusual scenes or sensor characteristics not in training data, potentially causing small biases. But with ARKit data widely available, training on similar data mitigates this. Overall, this approach is promising for robust geometry.  
3. LiDAR-First Pipeline with Photogrammetry Refinement: This approach uses LiDAR to capture a base mesh, then runs photogrammetry (multi-view stereo from RGB) to refine detail and texture. For example, some workflows use the LiDAR mesh to scale and initialize a COLMAP reconstruction.  
   * *Accuracy:* Potentially high. LiDAR gives correct scale; photogrammetry can add fine detail that LiDAR missed. However, alignment between the LiDAR model and photogrammetry must be precise to benefit metric accuracy. If fused properly, detail like small moldings or trim could be captured and measured.  
   * *Photorealism:* High. Photogrammetry excels at high-detail texturing. The final model can be very realistic in appearance (some apps achieve near photo-quality by this hybrid).  
   * *Runtime:* High. Full photogrammetry (feature extraction, matching, MVS) is computationally expensive – likely requires cloud and several minutes or more.  
   * *Device cost:* Device just does LiDAR capture; cloud does heavy lifting. Possibly more involved than neural nets if not optimized.  
   * *Risks:* Photogrammetry can fail in low-texture areas or if images have exposure differences. It might produce slightly warped models if not anchored by LiDAR – though LiDAR helps anchor scale, photogrammetry might still introduce local distortions unless a tight fusion step is used. Also, merging the LiDAR and MVS point clouds needs careful calibration (though ARKit provides initial alignment). In practice, this pipeline can produce beautiful models, but ensuring mm accuracy everywhere (especially on blank walls with little visual feature) could be tricky – LiDAR covers that part, so the fusion method must correctly weight LiDAR vs vision.  
4. Neural Implicit Mapping \+ Mesh Distillation: In this cutting-edge approach, we would optimize a Neural Radiance Field or Neural SDF for the scene (possibly combining RGB and depth constraints in the loss) and then extract a mesh from it. Systems like NICE-SLAM (NeRF-based) or NeuralRGB-D (Neural SDF) fall in this category.  
   * *Accuracy:* Potentially very high locally (the model can fit the data precisely), but global consistency depends on optimization. Neural methods can implicitly do loop closure (NeRF’s global scene reasoning helps correct drift). In one example, a NeRF-SLAM achieved state-of-the-art tracking and mapping accuracy on ScanNet. We might see \~millimeter-level fit to points that the network achieves. However, some reports indicate pure photometric losses can converge to slightly *less* accurate geometry than depth-guided methods – hence we’d use depth in training too.  
   * *Photorealism:* Very high. NeRF-based reconstructions can render extremely realistic views, capturing even reflections or fine texture detail. If we successfully distill this into a mesh+texture, it would likely look the best of all options.  
   * *Runtime:* Very slow relative to others. Traditional NeRF training might take hours; even accelerated ones (InstantNGP) take minutes for a small scene. Some recent neural SLAM (like EC-SLAM, 2024\) reach \~20 Hz by using very sparse encodings, but that’s still on a PC GPU for small scenes. For a full room, expect a few minutes of GPU optimization at least.  
   * *Device cost:* All cloud; not feasible on device.  
   * *Risks:* Neural reconstructions often require careful parameter tuning. They might struggle with dynamic range of lighting or shiny objects, sometimes “hallucinating” incorrect surfaces if data is missing (though depth guidance mitigates that). Also, extracting a clean mesh from a NeRF or SDF network can be non-trivial (marching cubes on a learned SDF works but can miss very thin structures or produce overly smooth surfaces unless resolution is high). This approach is on the frontier and, while promising, might be complex to productize robustly in 2025\. It could be an option for a cloud “high quality” mode if a client needs the absolutely best visuals and is willing to wait longer.  
5. 3D Gaussian Splatting (3DGS) with Mesh Proxy: Use 3D Gaussian splats as the primary representation for capturing appearance, possibly fused with depth data for structure (as in GSFusion). Then convert to a mesh (or keep as splats for rendering in some contexts).  
   * *Accuracy:* With a TSDF backbone (as in our plan), geometry stays accurate. The Gaussians mainly augment appearance. If one tried to use 3DGS alone from RGB input, the geometry would be less accurate (the splats are positioned by multi-view triangulation which is less precise than LiDAR). So we’d definitely combine it with a depth-fused geometry.  
   * *Photorealism:* Very high when viewed as splats – almost as good as NeRF, and much faster to render. If we down-sample that into a mesh+texture, we should retain much of the quality.  
   * *Runtime:* Faster than NeRF. Some Gaussian-based SLAM systems are approaching real-time, though still not fully there. A small optimization (\~10 minutes for 300 images reported originally) might be needed. Possibly within a couple minutes for our number of frames, given parallel computing.  
   * *Device:* cloud mainly; though visualization of Gaussians could be done on device if needed for AR (some mobile GPUs could render a moderate number of splats).  
   * *Risks:* As noted, pure Gaussian methods had trouble with holes and consistency, which is why we combine with TSDF (mitigating that). The conversion to a mesh is another step (you might volume render the Gaussians into an image or point cloud then mesh, which could introduce slight blurring). Still, as per GSFusion’s results, this hybrid seems one of the best current approaches for visual \+ structural quality.  
6. Semantic Structure Modeling (CAD-like): This pipeline would focus on recognizing planar structures and directly creating a simplified CAD model (walls as planes, etc.) rather than a dense mesh. It could leverage the Manhattan world heavily.  
   * *Accuracy:* Very high for the dimensions it models (since it basically fits perfect planes and right angles). E.g., one could output a room as 2.500 m by 3.000 m if the data shows \~2499 mm by 3002 mm, effectively snapping to neat values. This is great for architectural plans. However, it loses any non-conforming details (e.g. a wall that bows by 5 mm won’t be represented). If those details matter (pipe extrusions, ornamentation), this approach can’t capture them.  
   * *Photorealism:* Low. Usually this approach yields a schematic model with maybe flat textures on planes. It’s not meant for visual realism, more for measurements and BIM.  
   * *Runtime:* Fast. Fitting planes and lines is computationally cheap relative to dense reconstruction. Could possibly all be done on device or quickly on cloud.  
   * *Device:* Could run on device (ARKit’s RoomPlan is an example that does something like this on device, outputting a parametric room layout).  
   * *Risks:* It’s limited in scope – only works in strictly man-made rectangular environments. It might completely fail or produce incorrect results if the scene has non-Manhattan structure or clutter. Also it doesn’t produce a rich mesh for visualization. We include this for comparison because it represents one extreme (all abstraction, no dense data). For Medida’s needs (which include photorealistic models), this alone is insufficient, but certain aspects (like ensuring walls are planar) are incorporated into our pipeline as a sub-step.

Summary of Comparison: The hybrid approach we outlined (combining reliable TSDF fusion for structure, learned refinement for detail, and possibly neural/GS for appearance) aims to hit a sweet spot: Metric accuracy from sensor data and global optimization, photorealism via high-quality texturing (with optional neural help), reasonable runtime with cloud acceleration, and proven robustness by leaning on well-understood components (TSDF, plane detection, ARKit tracking) and adding learning where it truly helps (depth denoising, maybe texture refinement). The comparative analysis reinforces this choice – purely on-device or classical methods likely fall short in accuracy or visual quality, while pure neural might be too slow or unpredictable. A mix of the best methods in a staged pipeline appears most practical and powerful.

## **Proposed End-to-End SDK Pipeline Architecture**

Bringing it all together, we propose the following stage-wise pipeline for the Medida-class mobile scanning SDK, indicating for each stage the chosen algorithms (with top alternatives considered) and the division between on-device and cloud:

1. Capture & Tracking (On-Device):  
   * Input: Live RGB camera feed, LiDAR depth stream, IMU.  
   * Process: ARKit Visual-Inertial Odometry for real-time pose; ARKit depth alignment (intrinsic/extrinsic calibration from device). Keyframe selection logic running in real-time (based on coverage and view change). Live guidance UI (show point cloud, detected planes).  
   * Output: Stream of keyframe data packets: each contains an RGB image, a depth map (with confidence), and a coarse pose estimate. Also plane hints (e.g. ARKit-detected floor plane) can be sent as prior info.  
     *(Alternatives considered: ORB-SLAM3 with inertial on device – rejected in favor of ARKit’s optimized pipeline; learned odometry networks – not as robust as ARKit in general indoor use.)*  
2. Global Pose Optimization (Cloud):  
   * Input: All keyframe poses (from ARKit) and possibly sparse point cloud from device.  
   * Process: Perform Bundle Adjustment on keyframe poses: minimize reprojection error of 3D points (from depth or extracted features) across images. Include depth constraints: e.g. back-project depth points to 3D and enforce consistency between overlapping frames (ICP or plane alignment on shared areas). Incorporate Manhattan-world constraints by adding soft penalties for deviations of major plane normals from perpendicular directions (if plane hints available). If loop closure is detected (frames revisiting a spot), enforce consistency.  
   * Output: Optimized poses for all keyframes (and an uncertainty estimate for each pose).  
     *(Tools: g2o or Ceres solver for BA; we can also use known libraries like COLMAP’s mapper for feature-based BA augmented with depth error terms. We’ll shortlist two implementations: one classic feature BA, one custom depth ICP alignment to compare.)*  
3. Depth Processing & Fusion (Cloud):  
   * Input: Optimized poses, keyframe RGB images, keyframe depth maps.  
   * Depth refinement: Run a multi-view depth fusion network to improve each depth map. (Candidate: a simplified version of NeuralRecon’s network or a CNN that takes neighboring frames to predict a refined depth for a target frame.) Also, fill small holes and remove outliers. Output a depth image \+ confidence for each keyframe.  
   * Volumetric fusion: Integrate all depth maps into a global TSDF volume. Use a hashing spatial data structure (like VoxelHashing) or octree to handle large space efficiently. Weight by confidence and account for pose covariances if available.  
   * Mesh extraction: Run Marching Cubes on the TSDF to get a preliminary mesh. Use a high resolution (few-mm voxels) for important areas (we can do adaptive resolution, refining near measured structures). Decimate mesh modestly to manageable size.  
   * Loop and refine: If any gross misalignment appears (we can check if points from one frame deviate from the mesh by \> threshold), do a second pass pose adjustment (ICP-based) and re-fuse. Usually one pass is fine if BA did its job.  
   * Output: Dense geometric model – a triangle mesh (texturing still to do). Possibly also keep the TSDF in memory for any further use (like sampling for uncertainty).  
     *(Considered alternatives: surfel fusion instead of TSDF – decided TSDF is more suited for stable long-term mapping and easier meshing. Neural implicit mapping – intriguing but slower; may revisit if future optimizations allow.)*  
4. Texturing (Cloud):  
   * Input: Mesh, all RGB images with poses (and possibly radiance field if using neural).  
   * Color alignment: Perform global color calibration across images (compute gain/bias per image to match overlaps). We will likely use a global optimization approach (solving a linear system for color adjustments that minimize difference in overlapping regions).  
   * UV Unwrap: Generate UV coordinates for the mesh. We aim for a single atlas (or a few atlases if needed for resolution). Charts can be created per planar region and complex shapes as needed.  
   * Texture assignment: For each face or texel, choose the best source image (most orthogonal, highest resolution, post color-correction). Use blending for transitions. Optimize seams by shifting chart boundaries if needed to avoid cutting through high-detail areas or across lighting changes. This stage likely uses an approach similar to *“multi-atlas texture integration”* from MVS pipelines.  
   * Neural refinement (optional): If high mode is requested, run a small NeRF/3DGS optimization using the images and initial mesh as input. For instance, use the mesh to initialize a Radiance Field (positions of samples on mesh), optimize colors and small offsets for short time. Then bake the result into the texture: basically render the neural model from multiple angles onto the UV map to supersample detail.  
   * Output: A textured mesh (OBJ/PLY/GLB/USDZ format as needed) with high-res texture images. Also store the per-image adjustments done and perhaps normal maps if generated (could generate normal maps from geometry for completeness).  
     *(Alternative approach if time constrained: skip full global texturing and simply attach per-vertex colors from images – faster but lower quality. We prefer full texture atlas for fidelity.)*  
5. Semantic Analysis & Measurements (Cloud):  
   * Input: Textured mesh (for context), raw mesh/TSDF (for geometry), and possibly the plane segmentation from earlier or re-run it here on the final mesh.  
   * Plane segmentation: Detect large planes (walls, floor, ceiling) on the final mesh. We can reuse any ARKit plane anchors if they were good, but better to re-do on the final for accuracy. Use RANSAC or region-growing on mesh triangles by normal clustering. Label Manhattan orientations (vertical vs horizontal) by checking normals.  
   * Opening detection: Using the mesh \+ images, find doors and windows. We can detect holes in the wall planes by scanning the mesh for significant gaps or depth differences. Also use image-based door/window detections (via a CNN) to corroborate. Represent each opening as a rectangular prism or plane for measurement extraction.  
   * Dimension calculation: For each identified structure (room, wall, door, window, etc.), calculate dimensions. E.g.: room width \= distance between two roughly parallel walls (take plane-plane distance); door width \= distance between two vertical edges of door opening; door height \= floor to top of opening. Compute also areas (floor area, wall areas) if needed by product.  
   * Uncertainty quantification: Using point residuals from plane fits and the quality of alignment, compute an uncertainty for each dimension. E.g., if wall plane fits have std dev σ, and we have N observations, the error on distance between two planes might be \~√2 \* σ (assuming both have similar fit error). We include factors like pose uncertainty (if BA reports pose covariances). For simplicity, we might just categorize confidence as High/Med/Low rather than exact mm error, depending on noise observed.  
   * Output: A structured report of measurements (could be a JSON containing each opening with width/height, each wall length/height, etc., plus uncertainty and maybe an ID linking it to model). These measurements can also be annotated on the 3D model (e.g. lines drawn on the mesh with labels).  
     *(We considered doing this on device with ARKit’s RoomPlan which outputs simplified geometry, but that would yield less detail and not photorealistic output. Instead, we do it as a post-process on the full reconstruction for best accuracy.)*  
6. Final Packaging:  
   * The cloud bundles the deliverables: the textured 3D model, the measurements (in a convenient format), and possibly a scene file that can be opened in a viewer (for example, a USDZ file which can embed the mesh, texture, and custom metadata like measurements). If needed, we also provide 2D outputs like floorplan drawings generated from the model, but that’s an extension.  
   * The results are then transmitted to the device or made available for download. The device can present an AR preview of the model, overlay measurements, etc., allowing the user to inspect and verify. Because we have uncertainty info, the app could flag any measurement that is lower confidence (maybe prompting the user to take an extra photo or scan that area again if needed).

This end-to-end architecture is illustrated in a stage diagram (omitted here in text) showing the flow from iPhone capture → cloud reconstruction → output to user. Each stage uses the best algorithms identified in our research: ARKit VIO for robust tracking, global BA with plane constraints for drift-free alignment, learned depth fusion for completeness, TSDF for stable geometry, Gaussian splatting/NeRF for photorealistic texturing, and plane/object analysis for precise measurement extraction. By combining these, the SDK will fulfill the goal of millimeter accuracy and realistic modeling in a practical workflow.

## **Risk Analysis and Mitigation**

Finally, we address the key risks in achieving mm-level accuracy and how our design mitigates them:

* Pose Drift and Scale Error: If the camera pose is off, all measurements suffer. Risk is reduced by using LiDAR and IMU (giving absolute scale and stable tracking) and performing global bundle adjustment with loop closures. We also incorporate NeRF-based loop closure cues (NeRF SLAM approaches have shown the ability to correct drift implicitly). In case a user scans a very feature-poor environment (all white walls, no LiDAR hits e.g. in darkness), drift could grow. Mitigation: instruct user to include some texture or do a loop. We also consider placing synthetic targets (AR markers or just asking user to point device back to start point to close loop).  
* Depth Sensor Noise and Range Limitations: The LiDAR has an accuracy of \~5–10 mm at close range and worse at \>4 m. Also it doesn’t pick up glass or very black surfaces well. We mitigate noise by averaging via TSDF (random noise cancels out) and by learned filtering of depth. For range, if something is beyond LiDAR (like a far ceiling at 5m), we rely on RGB stereo to fill in. Additionally, we encourage the user to move closer (1–3 m range optimal). For dark surfaces, sometimes the LiDAR yields sparse points – we will fill those with multi-view stereo if possible (the RGB may still pick up some features or edges). Transparent surfaces produce holes; we treat them as such and possibly fill in with basic assumptions (e.g. a glass wall might be assumed flat via planar hole filling).  
* Specular/Reflective Surfaces: As discussed, mirrors and glass can confuse reconstruction, either introducing ghost geometry or large holes. Our pipeline’s approach is to identify and exclude unreliable points in such areas and then handle them as special cases (e.g. insert placeholder plane for a mirror so that room shape remains closed). We won’t attempt to reconstruct reflections (to avoid hallucinated geometry behind a mirror). For measurements, if a mirror covers a wall, we might warn that that wall’s measurement is less certain (since we effectively guess its position from context).  
* Thermal Throttling on Device: Continuous use of LiDAR and camera plus some on-device meshing might heat the phone. We keep on-device processing minimal; ARKit is pretty optimized in C++ and runs at 30/60Hz normally for AR apps. We also limit scan time if possible (maybe encourage scanning in under 2-3 minutes, as longer might warm up device). The heavy parts are offloaded. So this risk is low; still, field testing on older devices would be prudent (iPhone 14 Pro should manage, but perhaps an iPhone 14 base model with LiDAR might push it).  
* Cloud Connectivity and Latency: If internet is slow or unavailable, the pipeline stalls. To mitigate, we ensure the app is functional offline to capture data and save it, with the ability to upload later. Also, we compress data as much as possible. We can also explore an edge computing model (deploy servers closer to users, or even a local laptop could act as “cloud”). Ensuring encryption and possibly anonymization (blurring faces, etc.) is important for user acceptance.  
* Calibration Drift: Over time and usage, the device’s calibration between cameras and LiDAR could drift (though unlikely without significant shock). To be safe, the app could include a calibration checker. If we notice systematic offsets in depth vs image features (e.g. edges in depth map not aligning with edges in image), we might prompt a recalibration or apply a correction transform in software. Apple doesn’t expose manual calibration for LiDAR, so we rely on their factory cal – which generally has errors in the order of a few pixels at the edges at most.  
* Algorithmic Complexity and Integration: Using many advanced components (neural nets, BA, etc.) means potential bugs or integration issues. We mitigate this by modular design: each stage can be tested independently with ground truth. We’ll maintain fallback options (e.g. if the depth refinement network fails on some frame, we can still use raw depth; if the neural texturing is too slow, skip it). We also choose well-supported libraries where possible (Open3D for TSDF, ceres for BA, PyTorch for networks, etc.) to reduce custom bug surface.  
* Overfitting / Hallucination: Learned components might “hallucinate” plausible geometry that isn’t actually there, especially if parts of the scene were unobserved. Our approach keeps the sensor data as primary truth: we don’t let, say, a neural network completely invent a wall – it has to be supported by at least LiDAR or strong multi-view evidence. By weighting confidence and keeping uncertain areas marked, we avoid giving a false sense of accuracy. If an area is unscanned (e.g. behind a couch), the output might have a hole or a low-confidence fill; we will either inform the user or fill it with a clearly marked approximate geometry.

In conclusion, each identified risk has a corresponding strategy in our design, and we will continuously refine these as we implement and test the SDK. The end result will be a robust system that delivers on the promise: taking a smartphone scan and turning it into a photorealistic 3D model with reliable, millimeter-accurate measurements, thus revolutionizing renovation workflows just as Medida envisions. Sources: The above synthesis is informed by recent research and industry developments, including smartphone LiDAR accuracy evaluations, state-of-the-art RGB-D SLAM systems, and practical comparisons of mobile scanning apps, as well as the context of Medida’s deployment in real homes. These guide the recommended pipeline and highlight the importance of each component in achieving Medida-class results.  
Citations  
[Medida raises $4M Seed to turn smartphone scans into millimeter-accurate renovation m | Ctech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20company%20is%20targeting%20the,of%20kitchens%2C%20flooring%2C%20and%20bathrooms)  
[https://www.calcalistech.com/ctechnews/article/bj10jmvzzl](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20company%20is%20targeting%20the,of%20kitchens%2C%20flooring%2C%20and%20bathrooms)  
[Medida raises $4M Seed to turn smartphone scans into millimeter-accurate renovation m | Ctech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=%E2%80%9CThe%20issue%20of%20measurements%20in,%E2%80%9D)  
[https://www.calcalistech.com/ctechnews/article/bj10jmvzzl](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=%E2%80%9CThe%20issue%20of%20measurements%20in,%E2%80%9D)  
[Medida raises $4M Seed to turn smartphone scans into millimeter-accurate renovation m | Ctech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20broader%20renovation%20industry%20is,5%20trillion%20per%20year)  
[https://www.calcalistech.com/ctechnews/article/bj10jmvzzl](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20broader%20renovation%20industry%20is,5%20trillion%20per%20year)  
[Medida raises $4M Seed to turn smartphone scans into millimeter-accurate renovation m | Ctech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=It%E2%80%99s%20not%20only%20cybersecurity%20companies,site)  
[https://www.calcalistech.com/ctechnews/article/bj10jmvzzl](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=It%E2%80%99s%20not%20only%20cybersecurity%20companies,site)  
[Medida raises $4M Seed to turn smartphone scans into millimeter-accurate renovation m | Ctech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20system%20is%20designed%20primarily,for%20such%20a%20young%20startup)  
[https://www.calcalistech.com/ctechnews/article/bj10jmvzzl](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20system%20is%20designed%20primarily,for%20such%20a%20young%20startup)

[Technical Inquiry regarding iPhone… | Apple Developer Forums](https://developer.apple.com/forums/thread/812600#:~:text=Technical%20Inquiry%20regarding%20iPhone%E2%80%A6%20,images%20to%20generate%20256x192)  
[https://developer.apple.com/forums/thread/812600](https://developer.apple.com/forums/thread/812600#:~:text=Technical%20Inquiry%20regarding%20iPhone%E2%80%A6%20,images%20to%20generate%20256x192)

[(PDF) Cross-Modal Extrinsic Calibration of LiDAR and RGB ...](https://www.researchgate.net/publication/399650294_Cross-Modal_Extrinsic_Calibration_of_LiDAR_and_RGB_Cameras_Using_Compact_Planar_Targets_and_Joint_Geometric_Optimization#:~:text=,automation%2C%20and%20fleet%20intelligence)  
[https://www.researchgate.net/publication/399650294\_Cross-Modal\_Extrinsic\_Calibration\_of\_LiDAR\_and\_RGB\_Cameras\_Using\_Compact\_Planar\_Targets\_and\_Joint\_Geometric\_Optimization](https://www.researchgate.net/publication/399650294_Cross-Modal_Extrinsic_Calibration_of_LiDAR_and_RGB_Cameras_Using_Compact_Planar_Targets_and_Joint_Geometric_Optimization#:~:text=,automation%2C%20and%20fleet%20intelligence)

[(PDF) Planar Constraint Assisted LiDAR SLAM Algorithm Based on Manhattan World Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=error%20in%20the%20z,direction%20of)  
[https://www.researchgate.net/publication/366484505\_Planar\_Constraint\_Assisted\_LiDAR\_SLAM\_Algorithm\_Based\_on\_Manhattan\_World\_Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=error%20in%20the%20z,direction%20of)

[(PDF) Planar Constraint Assisted LiDAR SLAM Algorithm Based on Manhattan World Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=the%20overall%20errors%20of%20this,in%20the)  
[https://www.researchgate.net/publication/366484505\_Planar\_Constraint\_Assisted\_LiDAR\_SLAM\_Algorithm\_Based\_on\_Manhattan\_World\_Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=the%20overall%20errors%20of%20this,in%20the)

[(PDF) Planar Constraint Assisted LiDAR SLAM Algorithm Based on Manhattan World Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=datasets%20and%20the%20overall%20error,improved%20compared%20with%20the%20other)  
[https://www.researchgate.net/publication/366484505\_Planar\_Constraint\_Assisted\_LiDAR\_SLAM\_Algorithm\_Based\_on\_Manhattan\_World\_Assumption](https://www.researchgate.net/publication/366484505_Planar_Constraint_Assisted_LiDAR_SLAM_Algorithm_Based_on_Manhattan_World_Assumption#:~:text=datasets%20and%20the%20overall%20error,improved%20compared%20with%20the%20other)

[Evaluating the accuracy and quality of an iPad Pro's built-in lidar for 3D indoor mapping \- ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2666165923000510#:~:text=methods%20in%20various%20environmental%20conditions,Avoiding)  
[https://www.sciencedirect.com/science/article/pii/S2666165923000510](https://www.sciencedirect.com/science/article/pii/S2666165923000510#:~:text=methods%20in%20various%20environmental%20conditions,Avoiding)

[Evaluating the accuracy and quality of an iPad Pro's built-in lidar for 3D indoor mapping \- ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2666165923000510#:~:text=smaller%20areas%20with%20limited%20pose,BIM%20projects)  
[https://www.sciencedirect.com/science/article/pii/S2666165923000510](https://www.sciencedirect.com/science/article/pii/S2666165923000510#:~:text=smaller%20areas%20with%20limited%20pose,BIM%20projects)

[PARF: Primitive-Aware Radiance Fusion for Indoor Scene Novel View Synthesis](https://openaccess.thecvf.com/content/ICCV2023/papers/Ying_PARF_Primitive-Aware_Radiance_Fusion_for_Indoor_Scene_Novel_View_Synthesis_ICCV_2023_paper.pdf#:~:text=function%20and%20achieves%20high%20completeness,42%5D%20applies%20a)  
[https://openaccess.thecvf.com/content/ICCV2023/papers/Ying\_PARF\_Primitive-Aware\_Radiance\_Fusion\_for\_Indoor\_Scene\_Novel\_View\_Synthesis\_ICCV\_2023\_paper.pdf](https://openaccess.thecvf.com/content/ICCV2023/papers/Ying_PARF_Primitive-Aware_Radiance_Fusion_for_Indoor_Scene_Novel_View_Synthesis_ICCV_2023_paper.pdf#:~:text=function%20and%20achieves%20high%20completeness,42%5D%20applies%20a)

[‪Johannes Schönberger‬ \- ‪Google Scholar‬](https://scholar.google.com/citations?user=MlcMCd0AAAAJ&hl=en#:~:text=%E2%80%AAJohannes%20Sch%C3%B6nberger%E2%80%AC%20,CVPR%29)  
[https://scholar.google.com/citations?user=MlcMCd0AAAAJ\&hl=en](https://scholar.google.com/citations?user=MlcMCd0AAAAJ&hl=en#:~:text=%E2%80%AAJohannes%20Sch%C3%B6nberger%E2%80%AC%20,CVPR%29)

[Depth Estimation and Dense Reconstruction Method for Monocular ...](https://www.sciencedirect.com/science/article/pii/S2590123026000599#:~:text=Depth%20Estimation%20and%20Dense%20Reconstruction,deep%20learning%20with%20TSDF)  
[https://www.sciencedirect.com/science/article/pii/S2590123026000599](https://www.sciencedirect.com/science/article/pii/S2590123026000599#:~:text=Depth%20Estimation%20and%20Dense%20Reconstruction,deep%20learning%20with%20TSDF)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=accelerating%20convergence,at%20up%20to%2021%20Hz)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=accelerating%20convergence,at%20up%20to%2021%20Hz)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=The%20contributions%20of%20this%20paper,have%20created%20a%20reliable%20and)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=The%20contributions%20of%20this%20paper,have%20created%20a%20reliable%20and)

[PARF: Primitive-Aware Radiance Fusion for Indoor Scene Novel View Synthesis](https://openaccess.thecvf.com/content/ICCV2023/papers/Ying_PARF_Primitive-Aware_Radiance_Fusion_for_Indoor_Scene_Novel_View_Synthesis_ICCV_2023_paper.pdf#:~:text=2,supervision%2017707)  
[https://openaccess.thecvf.com/content/ICCV2023/papers/Ying\_PARF\_Primitive-Aware\_Radiance\_Fusion\_for\_Indoor\_Scene\_Novel\_View\_Synthesis\_ICCV\_2023\_paper.pdf](https://openaccess.thecvf.com/content/ICCV2023/papers/Ying_PARF_Primitive-Aware_Radiance_Fusion_for_Indoor_Scene_Novel_View_Synthesis_ICCV_2023_paper.pdf#:~:text=2,supervision%2017707)

[Comprehensive Guide to Phone 3D Scanning with LiDAR iPhone and Top 3D Apps – 3D Mag](https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/#:~:text=Peer,130%20m)  
[https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/](https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/#:~:text=Peer,130%20m)

[Comprehensive Guide to Phone 3D Scanning with LiDAR iPhone and Top 3D Apps – 3D Mag](https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/#:~:text=depth%20sensor%2C%20a%20front%20structured,13)  
[https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/](https://www.3dmag.com/3d-wikipedia/phone-3d-scanning-lidar-iphone-3d-apps-guide/#:~:text=depth%20sensor%2C%20a%20front%20structured,13)

[Comparative Study on the Accuracy of Mobile LiDAR Applications in Object-Level Architectural Digitization \- ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1877050925026742#:~:text=The%20results%20show%20a%20significant,modeling%20workflows%20and%20digital%20integration)  
[https://www.sciencedirect.com/science/article/pii/S1877050925026742](https://www.sciencedirect.com/science/article/pii/S1877050925026742#:~:text=The%20results%20show%20a%20significant,modeling%20workflows%20and%20digital%20integration)  
[Neural Colour Correction for Indoor 3D Reconstruction Using RGB-D Data \- PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=Global%20optimization%20methods%20solve%20for,43)  
[https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=Global%20optimization%20methods%20solve%20for,43)  
[Neural Colour Correction for Indoor 3D Reconstruction Using RGB-D Data \- PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=Lowe%20,and%20mitigated%20local%20colour%20differences)  
[https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=Lowe%20,and%20mitigated%20local%20colour%20differences)  
[Neural Colour Correction for Indoor 3D Reconstruction Using RGB-D Data \- PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=problem,of%20colour%20consistency%2C%20contrast%20and)  
[https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243902/#:~:text=problem,of%20colour%20consistency%2C%20contrast%20and)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=Recently%2C%20a%20new%20promising%20technique,scale%20dataset%20%28300%20images)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=Recently%2C%20a%20new%20promising%20technique,scale%20dataset%20%28300%20images)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=optimization,com%2Fgoldoak%2FGSFusion)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=optimization,com%2Fgoldoak%2FGSFusion)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=To%20enhance%20the%20visual%20fidelity,time%20performance)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=To%20enhance%20the%20visual%20fidelity,time%20performance)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=Traditional%20volumetric%20fusion%20algorithms%20preserve,system%20to%20take%20advantage%20of)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=Traditional%20volumetric%20fusion%20algorithms%20preserve,system%20to%20take%20advantage%20of)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=geometric%20information%20and%20propose%20to,com%2Fgoldoak%2FGSFusion)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=geometric%20information%20and%20propose%20to,com%2Fgoldoak%2FGSFusion)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=concurrent%20works%C2%A0,based%20SLAM)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=concurrent%20works%C2%A0,based%20SLAM)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=In%20this%20paper%2C%20we%20argue,Specifically%2C%20we)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=In%20this%20paper%2C%20we%20argue,Specifically%2C%20we)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=We%20introduce%20EC,Extensive%20evaluations%20and%20ablation)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=We%20introduce%20EC,Extensive%20evaluations%20and%20ablation)

[High-Quality RGB-D Reconstruction with Multi-View Photometric ...](https://www.youtube.com/watch?v=l5VwXD-3S_8#:~:text=High,the%20utilization%20of%20a)  
[https://www.youtube.com/watch?v=l5VwXD-3S\_8](https://www.youtube.com/watch?v=l5VwXD-3S_8#:~:text=High,the%20utilization%20of%20a)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=can%20be%20fused%20into%20the,such%20as%20reflection%20and%20transparency)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=can%20be%20fused%20into%20the,such%20as%20reflection%20and%20transparency)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=by%20using%20sparse%20parametric%20encodings,the%20Replica%2C%20ScanNet%2C%20and%20TUM)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=by%20using%20sparse%20parametric%20encodings,the%20Replica%2C%20ScanNet%2C%20and%20TUM)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=systems%20based%20on%20NeRF%20inherently,of%20up%20to%2021%20Hz)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=systems%20based%20on%20NeRF%20inherently,of%20up%20to%2021%20Hz)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=random%20sampling%20in%20NeRF,com%2FLightingooo%2FEC)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=random%20sampling%20in%20NeRF,com%2FLightingooo%2FEC)

[High-Quality RGB-D Reconstruction via Multi-View Uncalibrated Photometric Stereo and Gradient-SDF](https://openaccess.thecvf.com/content/WACV2023/papers/Sang_High-Quality_RGB-D_Reconstruction_via_Multi-View_Uncalibrated_Photometric_Stereo_and_Gradient-SDF_WACV_2023_paper.pdf#:~:text=voxel%20size%20setting,refer%20to%20the%20supplementary%20material)  
[https://openaccess.thecvf.com/content/WACV2023/papers/Sang\_High-Quality\_RGB-D\_Reconstruction\_via\_Multi-View\_Uncalibrated\_Photometric\_Stereo\_and\_Gradient-SDF\_WACV\_2023\_paper.pdf](https://openaccess.thecvf.com/content/WACV2023/papers/Sang_High-Quality_RGB-D_Reconstruction_via_Multi-View_Uncalibrated_Photometric_Stereo_and_Gradient-SDF_WACV_2023_paper.pdf#:~:text=voxel%20size%20setting,refer%20to%20the%20supplementary%20material)

[High-Quality RGB-D Reconstruction via Multi-View Uncalibrated Photometric Stereo and Gradient-SDF](https://openaccess.thecvf.com/content/WACV2023/papers/Sang_High-Quality_RGB-D_Reconstruction_via_Multi-View_Uncalibrated_Photometric_Stereo_and_Gradient-SDF_WACV_2023_paper.pdf#:~:text=the%20real,0)  
[https://openaccess.thecvf.com/content/WACV2023/papers/Sang\_High-Quality\_RGB-D\_Reconstruction\_via\_Multi-View\_Uncalibrated\_Photometric\_Stereo\_and\_Gradient-SDF\_WACV\_2023\_paper.pdf](https://openaccess.thecvf.com/content/WACV2023/papers/Sang_High-Quality_RGB-D_Reconstruction_via_Multi-View_Uncalibrated_Photometric_Stereo_and_Gradient-SDF_WACV_2023_paper.pdf#:~:text=the%20real,0)

[EC-SLAM: Effectively Constrained Neural RGB-D SLAM with Sparse TSDF Encoding and Global Bundle Adjustment](https://arxiv.org/html/2404.13346v2#:~:text=We%20introduce%20EC,Furthermore%2C%20by)  
[https://arxiv.org/html/2404.13346v2](https://arxiv.org/html/2404.13346v2#:~:text=We%20introduce%20EC,Furthermore%2C%20by)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=attempting%20to%20fulfill%20online%20optimization,reduce%20the%20number%20of%20parameters)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=attempting%20to%20fulfill%20online%20optimization,reduce%20the%20number%20of%20parameters)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=employs%20an%20explicit%203D%20Gaussian,scale%20dataset%20%28300%20images)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=employs%20an%20explicit%203D%20Gaussian,scale%20dataset%20%28300%20images)

[GSFusion: Online RGB-D Mapping Where Gaussian Splatting Meets TSDF Fusion](https://arxiv.org/html/2408.12677v1#:~:text=but%20those%20methods%20usually%20rely,particularly%20around%20windows%20and%20mirrors)  
[https://arxiv.org/html/2408.12677v1](https://arxiv.org/html/2408.12677v1#:~:text=but%20those%20methods%20usually%20rely,particularly%20around%20windows%20and%20mirrors)

[Evaluation of the Apple iPhone 12 Pro LiDAR for an Application in ...](https://www.nature.com/articles/s41598-021-01763-9#:~:text=,3D)  
[https://www.nature.com/articles/s41598-021-01763-9](https://www.nature.com/articles/s41598-021-01763-9#:~:text=,3D)  
All Sources  
[calcalistech](https://www.calcalistech.com/ctechnews/article/bj10jmvzzl#:~:text=The%20company%20is%20targeting%20the,of%20kitchens%2C%20flooring%2C%20and%20bathrooms)  
[developer.apple](https://developer.apple.com/forums/thread/812600#:~:text=Technical%20Inquiry%20regarding%20iPhone%E2%80%A6%20,images%20to%20generate%20256x192)  
[researchgate](https://www.researchgate.net/publication/399650294_Cross-Modal_Extrinsic_Calibration_of_LiDAR_and_RGB_Cameras_Using_Compact_Planar_Targets_and_Joint_Geometric_Optimization#:~:text=,automation%2C%20and%20fleet%20intelligence)  
[sciencedirect](https://www.sciencedirect.com/science/article/pii/S2666165923000510#:~:text=methods%20in%20various%20environmental%20conditions,Avoiding)  
[openaccess.thecvf](https://openaccess.thecvf.com/content/ICCV2023/papers/Ying_PARF_Primitive-Aware_Radiance_Fusion_for_Indoor_Scene_Novel_View_Synthesis_ICCV_2023_paper.pdf#:~:text=function%20and%20achieves%20high%20completeness,42%5D%20applies%20a)  
[scholar.google](https://scholar.google.com/citations?user=MlcMCd0AAAAJ&hl=en#:~:text=%E2%80%AAJohannes%20Sch%C3%B6nberger%E2%80%AC%20,CVPR%29)

## **🗺️ Medida-Class SDK Implementation Roadmap (LLM-Friendly)**

### **📦 Phase 1: Planning & Infrastructure Setup**

**Objective:** Define scope, prepare environment, gather tools/data.

**Checklist:**

* Confirm target device specs (iPhone 14+ camera, LiDAR, IMU capabilities)

* Define SDK inputs/outputs and expected performance bounds

* Choose development language(s) and environment (e.g. Swift for iOS, Python/C++ for cloud)

* Create storage/data pipeline for RGB, depth, IMU, poses

* Set up initial cloud compute stack (e.g. AWS/GCP GPU instance or cluster)

* Create shared schema for metadata: timestamps, intrinsics, confidence, etc.

* Initialize version-controlled repository structure

* Create data logging and debug UI for mobile prototype

* Identify evaluation scenes and prepare ground truth capture (e.g. CAD, laser scan)

---

### **🧠 Phase 2: Capture & Pose Pipeline (On-Device)**

**Objective:** Implement real-time capture, pose tracking, and frame selection.

**Checklist:**

* Access ARKit APIs for RGB, depth, IMU capture

* Confirm RGB-D timestamp alignment and camera intrinsics

* Integrate real-time VIO tracking (ARKit pose stream)

* Implement keyframe selection logic (coverage, motion, overlap)

* Stream pose/depth/images to cloud backend with basic compression

* Enable live feedback: point cloud preview, scan guidance

* Log real-time confidence metrics (pose quality, depth completeness)

* Store scan session metadata for future debugging

* Test in low-texture and variable lighting conditions

---

### **🔁 Phase 3: Cloud Mapping & Mesh Generation**

**Objective:** Optimize poses, generate TSDF fusion, extract mesh.

**Checklist:**

* Run bundle adjustment (BA) using depth and RGB constraints

* Integrate Manhattan-world plane constraints (optional toggle)

* Refine poses and assess global drift

* Denoise/refine depth maps with learned or multiview depth fusion

* Fuse refined depth into TSDF volume (adaptive or hashed grid)

* Extract mesh via Marching Cubes; decimate to configurable resolution

* Validate mesh coverage and alignment with source frames

* Store mesh in standardized format (e.g. PLY, GLB)

* Annotate surface confidence scores for downstream use

---

### **🎨 Phase 4: Texturing & Photorealism**

**Objective:** Generate photoreal textures; optionally run neural enhancement.

**Checklist:**

* Run global color alignment across input images

* Unwrap mesh into UV atlas (multi-chart with seam optimization)

* Project texture onto atlas using optimal view selection

* Blend overlapping views to minimize seams and exposure flicker

* Optionally run 3D Gaussian Splatting / NeRF distillation on GPU

* Generate full-resolution texture maps

* Repackage mesh with texture (GLB/USDZ support)

* Validate texture quality (SSIM/PSNR vs source images)

* Render for AR/3D preview

---

### **📏 Phase 5: Measurement Extraction & Semantic Parsing**

**Objective:** Detect planes, openings, and compute mm-accurate dimensions.

**Checklist:**

* Detect walls, floors, ceilings via plane segmentation

* Label planes with vertical/horizontal \+ normal orientation

* Extract corners, edges, intersections between planes

* Detect doors/windows from geometric and image cues

* Compute linear dimensions (door width, ceiling height, room length)

* Annotate uncertainty/confidence for each measurement

* Flag low-confidence zones for possible user rescan

* Export structured report (JSON, CSV, DXF) with measurements

* Validate against ground truth (if available)

---

### **🚀 Phase 6: Evaluation, Optimization & Packaging**

**Objective:** Test across scenes, profile performance, finalize SDK/API.

**Checklist:**

* Run SDK across evaluation suite (10–20 real scenes)

* Record metrics: absolute error (mm), surface deviation, texture fidelity

* Identify runtime bottlenecks (device \+ cloud)

* Optimize neural models (quantization, distillation)

* Add caching or streaming for large scenes

* Package SDK for iOS integration (Swift or Unity bindings)

* Build documentation and developer guide

* Add API interface for cloud upload/results (REST or GraphQL)

* Prepare release candidate and test deployment workflow

---

## **✅ Progress Tracking Template (Per Phase)**

Each LLM agent or team can update this:

`{`  
  `"Phase": "Texturing & Photorealism",`  
  `"Owner": "agent-texture-v2",`  
  `"TasksCompleted": 7,`  
  `"TotalTasks": 9,`  
  `"Blockers": ["UV seam optimization edge cases in corner transitions"],`  
  `"NextAction": "Evaluate 3DGS baking runtime on 2-scene subset"`  
`}`

## **On-device (iOS) additions worth using alongside ARKit**

### **Capture, encoding, throughput**

* **AVFoundation** for camera control when you need deterministic exposure/ISO/white-balance (ARKit tends to prioritize AR tracking, not photometric stability). This is important for texture consistency and for learned depth/refinement training data.

* **Metal \+ Metal Performance Shaders (MPS)** for any on-device preprocessing (depth denoise, confidence-based hole filling, keyframe scoring, fast feature extraction).

* **Vision** (Apple Vision framework) for on-device detection primitives (rectangles, edges, vanishing points) and optionally object detection; useful for scan guidance and for “measure-the-door/window” UX.

* **Core ML** for small on-device models (keyframe selection, blur detection, specular/glass detection, semantic hints).

### **Why not replace ARKit tracking on-device?**

You generally *can*, but it is rarely a net win on iPhone unless you need research control or custom sensors. Independent evaluations often find ARKit among the most accurate commercial VIO options.

---

## **Pose estimation and global consistency (cloud-side, ARKit augmentation)**

ARKit gives strong *local* tracking, but for **mm-level measurement**, you typically want **global optimization**:

* **Ceres Solver** (or **g2o**) for bundle adjustment / pose graph optimization (industry standard).

* Add **depth constraints** into BA (RGB-D BA) to reduce drift and improve convergence (well-established technique).

* **LiDAR-assisted BA variants** can help colorization and robustness even when time alignment/extrinsics aren’t perfect (useful with iPhone depth quirks).

**Practical note:** COLMAP is excellent for classic photogrammetry, but it is not “depth-constraint BA out of the box” in the way you want for an RGB-D SLAM pipeline. It’s still useful for feature extraction, matching, and baseline SfM.

---

## **Dense fusion \+ reconstruction (cloud-side)**

### **TSDF / volumetric fusion (core workhorse)**

* **Open3D reconstruction system** (voxel block / hashed TSDF integration): a strong, production-friendly baseline for RGB-D fusion and meshing.

  * You feed it *known camera poses* (from ARKit, then refined by BA) and integrate depth into TSDF.

### **GPU-accelerated reconstruction**

* If you need high throughput at scale, consider a GPU-centric pipeline design (several research systems redesign the RGB-D pipeline to fully exploit GPU).

---

## **Meshing, cleanup, and “architectural priors”**

ARKit’s mesh is a good preview, but not your final deliverable for mm measurements.

* **Marching Cubes** from TSDF (standard, deterministic).

* **Open3D** also covers mesh post-processing utilities (smoothing, decimation, outlier removal) and is an easy baseline.

* Add **Manhattan-world / plane priors** in your geometry cleanup and measurement extraction (snap walls/edges within tolerance; keep the raw mesh for auditability).

---

## **Texturing / photorealism (cloud-side)**

* Classic MVS texturing toolchains still matter (UV atlas \+ view selection \+ seam optimization). If you want turnkey components:

  * **OpenMVS / OpenMVG** (not cited here; commonly used) for texturing and view blending.

* For a modern “best of both worlds” stack, use neural rendering to **improve appearance** without becoming the geometry authority.

---

## **Neural rendering / 3DGS as an optional refinement layer (cloud-side)**

If you want the current best photorealism per compute-dollar, it is hard to ignore **3D Gaussian Splatting** tooling:

* **Nerfstudio Splatfacto** docs (practical reference implementation).

* **gsplat** (CUDA-accelerated Gaussian rasterization; designed for faster/lower-memory training).

**How to use it safely for measurement-first:** treat 3DGS/NeRF as a *texture/appearance refinement* and keep TSDF/plane-fits as the **authoritative metric geometry**.

---

## **“Beyond ARKit” SLAM libraries (useful mainly for research control / non-iOS reuse)**

If you want a second pose engine for A/B testing (or future Android parity):

* **ORB-SLAM3** (visual / visual-inertial / RGB-D SLAM).  
   This is valuable as an experimental baseline, but on iOS it’s usually not as operationally smooth as ARKit.

---

# **Recommended baseline stack (pragmatic)**

If your priority is mm-level measurement fidelity and robustness:

1. **iOS**: ARKit (poses \+ depth \+ confidence) \+ AVFoundation (photometric control) \+ Metal/MPS (preprocessing)

2. **Cloud**: Ceres (BA with depth constraints) \+ Open3D TSDF integration \+ marching cubes mesh \+ plane/Manhattan fitting for measurements

3. **Photorealism optional**: Nerfstudio/gsplat 3DGS to improve textures/appearance, baked onto your mesh

This combination gives you:

* Deterministic, auditable metric geometry (TSDF \+ plane fits)

* Reduced drift via depth-constrained BA

* A clear “appearance refinement” lane using mainstream 3DGS tooling 

# **System Requirements Document (SRD)**

**System Name:** Medida-Class Mobile Scanning SDK  
 **Version:** 1.0  
 **Status:** Draft – Implementation Baseline  
 **Primary Objective:** Millimeter-level architectural measurement and photorealistic 3D reconstruction from handheld mobile scans (iPhone 14+), with cloud offload permitted.

---

## **1\. Purpose & Scope**

### **1.1 Purpose**

This SRD defines the **functional, non-functional, architectural, and verification requirements** for a mobile scanning SDK capable of producing:

1. **Millimeter-accurate measurements** of architectural elements (doors, windows, walls, rooms).

2. **Photorealistic 3D models** suitable for renovation, estimation, and visualization workflows.

The document is designed to:

* Guide **AI LLM agents** executing development tasks.

* Enable **stage-wise verification** of feature completeness.

* Serve as a reference for **cloud \+ mobile system integration**.

### **1.2 In-Scope**

* RGB \+ depth (LiDAR) capture on iPhone 14+

* Visual-inertial pose estimation

* Cloud-based reconstruction and refinement

* Measurement extraction with uncertainty

* SDK-level outputs (not end-user UI design)

### **1.3 Out-of-Scope**

* Business logic (pricing, billing)

* Contractor marketplace workflows

* CAD/BIM authoring beyond measurement outputs

* Full offline (no-cloud) high-fidelity reconstruction

---

## **2\. System Context & Operating Assumptions**

### **2.1 Target Environment**

* **Device:** iPhone 14 or newer (LiDAR-equipped)

* **OS:** iOS (latest − 1 supported)

* **Network:** Intermittent connectivity allowed; deferred upload supported

* **Scenes:** Indoor architectural spaces (Manhattan-dominant geometry)

### **2.2 Core Assumptions**

* Absolute scale is available via LiDAR \+ IMU.

* Cloud compute (GPU) is available for dense fusion and refinement.

* User follows guided scan instructions (not adversarial input).

---

## **3\. High-Level System Architecture**

### **3.1 Pipeline Overview**

`[On-Device]`  
`RGB + Depth + IMU Capture`  
`→ Real-time VIO Tracking`  
`→ Keyframe Selection`  
`→ Upload Package`

`[Cloud]`  
`Global Pose Optimization (BA)`  
`→ Depth Refinement`  
`→ TSDF Fusion`  
`→ Mesh Extraction`  
`→ Texture Generation`  
`→ Measurement & Uncertainty`  
`→ Deliverables`

### **3.2 Authoritative Geometry Principle**

* **Metric truth** comes from **depth-constrained geometry** (TSDF \+ plane fitting).

* Neural methods may **refine appearance**, not redefine dimensions.

---

## **4\. Functional Requirements**

### **4.1 Capture & Sensor Fusion (On-Device)**

**FR-1.1** The system SHALL capture synchronized RGB, depth, and IMU streams.  
 **FR-1.2** The system SHALL provide real-time pose estimation via visual-inertial odometry.  
 **FR-1.3** The system SHALL associate each depth frame with a calibrated camera pose.  
 **FR-1.4** The system SHALL compute per-frame quality metrics (motion blur, depth confidence).  
 **FR-1.5** The system SHALL select and store keyframes based on spatial coverage and redundancy.  
 **FR-1.6** The system SHALL provide scan-quality guidance feedback (coverage, motion stability).

---

### **4.2 Pose Optimization (Cloud)**

**FR-2.1** The system SHALL perform global pose optimization across all keyframes.  
 **FR-2.2** The system SHALL incorporate depth constraints into bundle adjustment.  
 **FR-2.3** The system SHALL support Manhattan-world structural constraints (configurable).  
 **FR-2.4** The system SHALL output optimized poses with confidence estimates.

---

### **4.3 Geometry Reconstruction**

**FR-3.1** The system SHALL fuse depth maps into a volumetric TSDF representation.  
 **FR-3.2** The system SHALL weight depth integration by confidence and viewing angle.  
 **FR-3.3** The system SHALL extract a watertight mesh via isosurface extraction.  
 **FR-3.4** The system SHALL preserve millimeter-scale geometric fidelity.  
 **FR-3.5** The system SHALL flag regions of low geometric confidence.

---

### **4.4 Texturing & Photorealism**

**FR-4.1** The system SHALL generate a UV-mapped texture atlas.  
 **FR-4.2** The system SHALL perform global photometric normalization across images.  
 **FR-4.3** The system SHALL minimize visible seams and exposure discontinuities.  
 **FR-4.4** The system MAY apply neural rendering (NeRF / 3DGS) for appearance refinement.  
 **FR-4.5** Neural refinement SHALL NOT modify authoritative geometry.

---

### **4.5 Measurement Extraction**

**FR-5.1** The system SHALL detect dominant planes (walls, floor, ceiling).  
 **FR-5.2** The system SHALL compute plane intersections to derive corners and edges.  
 **FR-5.3** The system SHALL identify doors and windows using geometric and/or semantic cues.  
 **FR-5.4** The system SHALL compute linear dimensions in millimeters.  
 **FR-5.5** The system SHALL produce uncertainty/confidence for each measurement.  
 **FR-5.6** The system SHALL flag measurements below confidence thresholds.

---

### **4.6 Outputs & SDK Interfaces**

**FR-6.1** The system SHALL output a textured 3D model (mesh \+ textures).  
 **FR-6.2** The system SHALL output a structured measurement report (JSON).  
 **FR-6.3** The system SHALL support SDK consumption by third-party apps.  
 **FR-6.4** The system SHALL support re-processing without re-capture.

---

## **5\. Non-Functional Requirements**

### **5.1 Accuracy**

* **NFR-A1:** Door/window dimensions ≤ ±2–3 mm error (95% confidence).

* **NFR-A2:** Room-scale dimensions ≤ 0.5% relative error.

### **5.2 Performance**

* **NFR-P1:** On-device scan duration ≤ 3 minutes typical.

* **NFR-P2:** Cloud processing ≤ 5 minutes per standard room scan.

### **5.3 Robustness**

* **NFR-R1:** Operates under low-texture and mixed lighting.

* **NFR-R2:** Handles partial occlusions and reflective surfaces gracefully.

### **5.4 Security & Privacy**

* **NFR-S1:** All uploads encrypted in transit and at rest.

* **NFR-S2:** Raw imagery access restricted to processing pipeline.

* **NFR-S3:** Optional on-device redaction of sensitive imagery.

---

## **6\. Constraints & Design Rules**

* Geometry authority MUST remain depth-anchored.

* Neural models MUST be bounded and auditable.

* All measurements MUST be traceable to geometric primitives.

* No silent snapping to “standard sizes” without confidence annotation.

---

## **7\. Verification & Acceptance Criteria**

### **7.1 Verification Methods**

* Ground-truth comparison (laser measurements / reference scans)

* Cloud-to-mesh deviation analysis

* Texture reprojection PSNR/SSIM

* Stress tests (low texture, mirrors, low light)

### **7.2 Acceptance Criteria**

* ≥ 95% of critical measurements within accuracy bounds.

* No catastrophic topology errors (missing walls, duplicated planes).

* Clear confidence reporting for all outputs.

---

## **8\. AI-Agent Execution Notes (Non-Normative)**

* Each functional section maps to an **independent agent lane**.

* Checklist-based completion validation is REQUIRED.

* Agents MUST fail tasks explicitly if confidence thresholds are unmet.

* Partial implementations without verification are non-compliant.

---

## **9\. Deliverables**

1. Mobile SDK (iOS)

2. Cloud reconstruction service

3. Measurement extraction module

4. SDK documentation \+ API contracts

5. Evaluation report with confidence intervals

