<script lang="ts">
	import { DebugUSDLoader } from '$lib/loaders/DebugUSDLoader';
	import { DimensionHelper } from '$lib/utils/DimensionHelper';
	import { onMount, onDestroy } from 'svelte';
	import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
	
	// Props
	let { 
		src = '',
		alt = '3D Model',
		width = '100%',
		height = '500px',
		showArButton = true
	} = $props();
	
	// Check if file is USDZ - use $derived for reactive computation
	const isUSDZ = $derived(src.toLowerCase().includes('.usdz'));
	
	// State for USDZ format compatibility
	let usdzFormatWarning = $state<string | null>(null);
	
	// State variables
	let containerElement = $state<HTMLDivElement | undefined>(undefined);
	let renderer: any;
	let labelRenderer: CSS2DRenderer | null = null;
	let dimensionHelper: DimensionHelper | null = null;
	let animationFrameId: number;
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let showDimensions = $state(false);
	let dimensionUnit = $state<'meters' | 'feet'>('feet');
	let showFilterPanel = $state(false);
	let dimensionFilters = $state({
		showWalls: true,
		showFloors: true,
		showWindows: true,
		showDoors: true,
		showFurniture: false,
		showOpenings: true
	});
	
	// Load USDZ viewer on mount
	onMount(() => {
		if (isUSDZ && containerElement) {
			initUSDZViewer();
		}
	});
	
	onDestroy(() => {
		// Clean up Three.js resources
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		if (dimensionHelper) {
			dimensionHelper.dispose();
		}
		if (labelRenderer) {
			labelRenderer.domElement.remove();
		}
		if (renderer) {
			renderer.dispose();
		}
	});
	
	async function initUSDZViewer() {
		try {
			isLoading = true;
			loadError = null;
			
			// Check if container element is available
			if (!containerElement) {
				throw new Error('Container element not available');
			}
			
			// Dynamically import Three.js modules
			const THREE = await import('three');
			const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
			const { DebugUSDLoader } = await import('$lib/loaders/DebugUSDLoader');
			
			// Setup camera
			const camera = new THREE.PerspectiveCamera(
				45,
				containerElement.clientWidth / containerElement.clientHeight,
				0.25,
				20
			);
			camera.position.set(0, 1.5, 3);
			
			// Setup scene with transparent background to match theme
			const scene = new THREE.Scene();
			scene.background = null; // Transparent background
			
			// Add lights
			const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
			scene.add(ambientLight);
			
			const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
			directionalLight.position.set(1, 2, 3);
			scene.add(directionalLight);
			
			// Setup renderer - Three.js r163+ requires WebGL2
			try {
				// Create canvas and explicitly request WebGL2 context
				const canvas = document.createElement('canvas');
				
				// Try multiple context attribute combinations for Firefox compatibility
				const contextOptions = [
					{
						alpha: true,
						antialias: true,
						powerPreference: 'default' as WebGLPowerPreference,
						failIfMajorPerformanceCaveat: false,
						preserveDrawingBuffer: false,
						premultipliedAlpha: true
					},
					{
						alpha: true,
						antialias: false,
						powerPreference: 'low-power' as WebGLPowerPreference,
						failIfMajorPerformanceCaveat: false
					},
					{
						alpha: true,
						failIfMajorPerformanceCaveat: false
					}
				];
				
				let context: WebGL2RenderingContext | null = null;
				
				// Try each set of options
				for (const options of contextOptions) {
					context = canvas.getContext('webgl2', options) as WebGL2RenderingContext | null;
					if (context) {
						console.log('WebGL2 context created with options:', options);
						break;
					}
				}
				
				if (!context) {
					// Last resort: try with no options
					context = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
				}
				
				if (!context) {
					// Firefox might have WebGL2 blocked due to GPU/driver issues
					throw new Error('WebGL 2 is required but blocked by your browser. This may be due to GPU driver issues. Try updating your graphics drivers or use Chrome/Edge.');
				}
				
				renderer = new THREE.WebGLRenderer({ 
					canvas: canvas,
					context: context as any,
					antialias: true, 
					alpha: true 
				});
			} catch (e: any) {
				console.error('WebGL2 initialization failed:', e);
				throw new Error(e.message || 'WebGL 2 is required but not available in your browser.');
			}
			
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			containerElement.appendChild(renderer.domElement);
			
			// Setup CSS2D renderer for dimension labels
			labelRenderer = new CSS2DRenderer();
			labelRenderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
			labelRenderer.domElement.style.position = 'absolute';
			labelRenderer.domElement.style.top = '0';
			labelRenderer.domElement.style.pointerEvents = 'none';
			containerElement.appendChild(labelRenderer.domElement);
			
			// Initialize dimension helper with debug enabled and selective filters
			dimensionHelper = new DimensionHelper(scene, {
				color: 0x0066ff,
				textColor: '#0066ff',
				unit: dimensionUnit,
				offset: 0.15,
				debug: true, // Enable debug logging
				filters: {
					showWalls: true,
					showFloors: true,
					showWindows: true,
					showDoors: true,
					showFurniture: false, // Disabled by default to reduce clutter
					showOpenings: true
				}
			});
			dimensionHelper.setVisible(showDimensions);
			
			// Setup controls - prevent event propagation to parent elements
			const controls = new OrbitControls(camera, renderer.domElement);
			controls.target.set(0, 0.5, 0);
			controls.enableDamping = true;
			controls.dampingFactor = 0.05;
			controls.minDistance = 0.5;
			controls.maxDistance = 10;
			controls.update();
			
			// OrbitControls will handle all events internally
			// We don't need to stop propagation - the z-index layering prevents
			// events from reaching the overlay button
			
			// Load USDZ model
			console.log('Loading USDZ from URL:', src);
			const loader = new DebugUSDLoader();
			
			// Load with proper error handling
			loader.load(
				src,
				(group: any) => {
					console.log('USDZ model loaded successfully:', group);
					console.log('Group children count:', group.children.length);
					
					// Debug: traverse and log all objects with transforms
					group.traverse((child: any) => {
						console.log('Child:', child.type, child.name, 'hasGeometry:', !!child.geometry);
						console.log('  Position:', child.position.toArray());
						console.log('  Rotation:', child.rotation.toArray());
						console.log('  Scale:', child.scale.toArray());
						if (child.geometry) {
							console.log('  Vertex count:', child.geometry.attributes.position?.count);
							// Log first few vertices to see actual positions
							const positions = child.geometry.attributes.position.array;
							console.log('  First vertex:', [positions[0], positions[1], positions[2]]);
						}
					});
					
					// Get bounding box to scale model appropriately
					const box = new THREE.Box3().setFromObject(group);
					console.log('Bounding box:', box);
					const center = box.getCenter(new THREE.Vector3());
					const size = box.getSize(new THREE.Vector3());
					console.log('Center:', center, 'Size:', size);
					
					const maxDim = Math.max(size.x, size.y, size.z);
					console.log('Max dimension:', maxDim);
					const scale = 2.0 / maxDim;  // Scale to fit in view
					console.log('Scale factor:', scale);
					
					// Only scale - transforms are baked into geometry via xformOp:transform matrices
					group.scale.setScalar(scale);
					
					scene.add(group);
					
					// Store the scale factor for dimension calculations
					// Dimensions will be added later when user clicks the button
					if (dimensionHelper) {
						dimensionHelper.setModelScale(scale);
						dimensionHelper.setModelGroup(group);
					}
					
					// Point camera and controls at the center of the model
					controls.target.copy(center.multiplyScalar(scale));
					camera.position.set(
						center.x * scale,
						center.y * scale + maxDim * scale * 0.5,
						center.z * scale + maxDim * scale * 1.5
					);
					controls.update();
					
					isLoading = false;
					usdzFormatWarning = null; // Clear any warnings on successful load
				},
				(progress: any) => {
					const percent = (progress.loaded / progress.total * 100).toFixed(2);
					console.log('Loading progress:', percent + '%');
				},
				(error: any) => {
					console.error('Error loading USDZ:', error);
					
					// Check if error is due to unsupported format (USDC)
					const errorMsg = error?.message || error?.toString() || '';
					if (errorMsg.includes('parse') || errorMsg.includes('USDC') || errorMsg.includes('Crate')) {
						loadError = 'This USDZ file uses an unsupported internal format (USDC binary). Three.js currently only supports USDA (ASCII) format.';
						usdzFormatWarning = 'The file can still be viewed in AR on iOS devices using the "View in AR" button.';
					} else {
						loadError = `Failed to load USDZ model: ${errorMsg}`;
					}
					isLoading = false;
				}
			);
			
			// Handle window resize
			const handleResize = () => {
				if (!containerElement) return;
				
				camera.aspect = containerElement.clientWidth / containerElement.clientHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
				if (labelRenderer) {
					labelRenderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
				}
			};
			window.addEventListener('resize', handleResize);
			
			// Animation loop
			function animate() {
				animationFrameId = requestAnimationFrame(animate);
				controls.update();
				renderer.render(scene, camera);
				if (labelRenderer) {
					labelRenderer.render(scene, camera);
				}
			}
			animate();
			
			
		} catch (error) {
			console.error('Error loading USDZ model:', error);
			loadError = 'Failed to load 3D model. Please try downloading the file.';
			isLoading = false;
		}
	}
	
	// Toggle dimension visibility
	function toggleDimensions() {
		showDimensions = !showDimensions;
		if (dimensionHelper) {
			if (showDimensions) {
				// Add dimensions when turning on
				refreshDimensions();
			} else {
				// Just hide when turning off
				dimensionHelper.setVisible(false);
			}
		}
	}
	
	// Toggle dimension unit
	function toggleUnit() {
		dimensionUnit = dimensionUnit === 'meters' ? 'feet' : 'meters';
		refreshDimensions();
	}
	
	// Toggle filter panel
	function toggleFilterPanel() {
		showFilterPanel = !showFilterPanel;
	}
	
	// Update dimension filters
	function updateFilters() {
		if (dimensionHelper) {
			dimensionHelper.updateFilters(dimensionFilters);
			refreshDimensions();
		}
	}
	
	// Refresh dimensions with current settings
	function refreshDimensions() {
		if (!dimensionHelper) return;
		
		// Store references before clearing
		const modelScale = dimensionHelper['modelScale'];
		const modelGroup = dimensionHelper['modelGroup'];
		
		// Clear existing dimensions
		dimensionHelper.clear();
		
		// Update options
		dimensionHelper['options'].unit = dimensionUnit;
		dimensionHelper['options'].filters = dimensionFilters;
		
		// Re-add dimensions only to the model group if it exists
		if (modelGroup) {
			modelGroup.updateMatrixWorld(true);
			dimensionHelper.addRoomDimensions(modelGroup);
			dimensionHelper.setVisible(true);
		}
	}
</script>

{#if isUSDZ}
	<!-- Three.js USDZ viewer -->
	<div class="usdz-viewer-container" style="width: {width}; height: {height};">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div 
			bind:this={containerElement} 
			class="threejs-container"
		></div>
		
		{#if isLoading}
			<div class="loading-overlay">
				<div class="spinner"></div>
				<p>Loading 3D model...</p>
			</div>
		{/if}
		
		{#if loadError}
			<div class="error-overlay">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p class="error-message">{loadError}</p>
				{#if usdzFormatWarning}
					<p class="warning-message">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; vertical-align: middle; margin-right: 0.5rem;">
							<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
							<line x1="12" y1="9" x2="12" y2="13"></line>
							<line x1="12" y1="17" x2="12.01" y2="17"></line>
						</svg>
						{usdzFormatWarning}
					</p>
				{/if}
				<div class="error-actions">
					<a href={src} download class="btn variant-soft-surface">
						Download Model
					</a>
					{#if usdzFormatWarning}
						<a href={src} rel="ar" class="btn variant-filled-primary">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
								<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
							</svg>
							View in AR (iOS)
						</a>
					{/if}
				</div>
			</div>
		{/if}
		
		<!-- Control buttons overlay -->
		{#if !loadError}
			<div class="controls-overlay">
				<!-- Dimension toggle button -->
				<button 
					type="button"
					class="control-btn"
					class:active={showDimensions}
					onclick={toggleDimensions}
					title="Toggle dimensions"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="3" y1="9" x2="21" y2="9"></line>
						<line x1="9" y1="21" x2="9" y2="9"></line>
					</svg>
					<span>Dimensions</span>
				</button>
				
				<!-- Unit toggle button (only show when dimensions are visible) -->
				{#if showDimensions}
					<button 
						type="button"
						class="control-btn unit-btn"
						onclick={toggleUnit}
						title="Toggle units"
					>
						{dimensionUnit === 'meters' ? 'm' : 'ft'}
					</button>
					
					<!-- Filter button -->
					<button 
						type="button"
						class="control-btn"
						class:active={showFilterPanel}
						onclick={toggleFilterPanel}
						title="Filter dimensions"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
						</svg>
						<span>Filter</span>
					</button>
				{/if}
			</div>
			
			<!-- Filter panel -->
			{#if showDimensions && showFilterPanel}
				<div class="filter-panel">
					<h4>Show Dimensions For:</h4>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showWalls} onchange={updateFilters} />
						<span>Walls</span>
					</label>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showFloors} onchange={updateFilters} />
						<span>Floors</span>
					</label>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showWindows} onchange={updateFilters} />
						<span>Windows</span>
					</label>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showDoors} onchange={updateFilters} />
						<span>Doors</span>
					</label>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showOpenings} onchange={updateFilters} />
						<span>Openings</span>
					</label>
					<label>
						<input type="checkbox" bind:checked={dimensionFilters.showFurniture} onchange={updateFilters} />
						<span>Furniture</span>
					</label>
				</div>
			{/if}
		{/if}
		
		{#if showArButton && !loadError}
			<div class="ar-button-overlay">
				<a href={src} rel="ar" class="btn variant-filled-primary">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
						<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
					</svg>
					View in AR
				</a>
			</div>
		{/if}
	</div>
{:else}
	<!-- Regular model-viewer for glTF/GLB files 
	<model-viewer
		{src}
		{alt}
		ar
		ar-modes="webxr scene-viewer quick-look"
		camera-controls
		auto-rotate
		shadow-intensity="1"
		style="width: {width}; height: {height}; background-color: #f5f5f5;"
	>
		{#if showArButton}
			<button 
				slot="ar-button" 
				class="btn variant-filled-primary"
				style="position: absolute; bottom: 16px; right: 16px;"
			>
				View in AR
			</button>
		{/if}
		
		<div slot="progress-bar" class="progress-bar">
			<div class="update-bar"></div>
		</div>
	</model-viewer>
	-->
{/if}

<style>
	model-viewer {
		border-radius: 8px;
	}
	
	.progress-bar {
		display: block;
		width: 33%;
		height: 10%;
		max-height: 2%;
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate3d(-50%, -50%, 0);
		border-radius: 25px;
		box-shadow: 0px 3px 10px 3px rgba(0, 0, 0, 0.5), 0px 0px 5px 1px rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.9);
		background-color: rgba(0, 0, 0, 0.5);
	}
	
	.update-bar {
		background-color: rgba(255, 255, 255, 0.9);
		width: 0%;
		height: 100%;
		border-radius: 25px;
		float: left;
		transition: width 0.3s;
	}
	
	.usdz-viewer-container {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		background: rgb(var(--color-surface-100));
	}
	
	:global(.dark) .usdz-viewer-container {
		background: rgb(var(--color-surface-800));
	}
	
	.threejs-container {
		width: 100%;
		height: 100%;
	}
	
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(var(--color-surface-50), 0.95);
		z-index: 10;
	}
	
	:global(.dark) .loading-overlay {
		background: rgba(var(--color-surface-900), 0.95);
	}
	
	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid rgba(var(--color-surface-300), 0.3);
		border-top-color: rgb(var(--color-primary-500));
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}
	
	:global(.dark) .spinner {
		border-color: rgba(var(--color-surface-600), 0.3);
		border-top-color: rgb(var(--color-primary-400));
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.loading-overlay p {
		color: rgb(var(--color-surface-600));
		font-weight: 500;
	}
	
	:global(.dark) .loading-overlay p {
		color: rgb(var(--color-surface-400));
	}
	
	.error-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(var(--color-surface-50), 0.98);
		z-index: 10;
		padding: 2rem;
		text-align: center;
	}
	
	:global(.dark) .error-overlay {
		background: rgba(var(--color-surface-900), 0.98);
	}
	
	.error-overlay svg {
		color: rgb(var(--color-error-500));
		margin-bottom: 1rem;
	}
	
	.error-overlay .error-message {
		color: rgb(var(--color-surface-600));
		margin-bottom: 1rem;
		max-width: 500px;
		font-weight: 500;
	}
	
	:global(.dark) .error-overlay .error-message {
		color: rgb(var(--color-surface-400));
	}
	
	.error-overlay .warning-message {
		color: rgb(var(--color-warning-700));
		background: rgba(var(--color-warning-100), 0.5);
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		max-width: 500px;
		font-size: 0.9rem;
		border: 1px solid rgba(var(--color-warning-300), 0.5);
	}
	
	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}
	
	.controls-overlay {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.control-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.95);
		border: 2px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
		color: rgb(var(--color-surface-700));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	
	:global(.dark) .control-btn {
		background: rgba(var(--color-surface-800), 0.95);
		border-color: rgb(var(--color-surface-600));
		color: rgb(var(--color-surface-300));
	}
	
	.control-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border-color: rgb(var(--color-primary-500));
	}
	
	.control-btn.active {
		background: rgb(var(--color-primary-500));
		border-color: rgb(var(--color-primary-600));
		color: white;
	}
	
	:global(.dark) .control-btn.active {
		background: rgb(var(--color-primary-600));
		border-color: rgb(var(--color-primary-700));
	}
	
	.control-btn svg {
		flex-shrink: 0;
	}
	
	.unit-btn {
		padding: 0.5rem 0.75rem;
		font-family: monospace;
		font-weight: bold;
		min-width: 50px;
		justify-content: center;
	}
	
	.filter-panel {
		position: absolute;
		top: 200px;
		left: 16px;
		background: rgba(255, 255, 255, 0.98);
		border: 2px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
		padding: 1rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		z-index: 20;
		min-width: 200px;
	}
	
	:global(.dark) .filter-panel {
		background: rgba(var(--color-surface-800), 0.98);
		border-color: rgb(var(--color-surface-600));
	}
	
	.filter-panel h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: rgb(var(--color-surface-700));
	}
	
	:global(.dark) .filter-panel h4 {
		color: rgb(var(--color-surface-200));
	}
	
	.filter-panel label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		cursor: pointer;
		font-size: 0.875rem;
		color: rgb(var(--color-surface-600));
	}
	
	:global(.dark) .filter-panel label {
		color: rgb(var(--color-surface-300));
	}
	
	.filter-panel label:hover {
		color: rgb(var(--color-primary-500));
	}
	
	.filter-panel input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: rgb(var(--color-primary-500));
	}
	
	.ar-button-overlay {
		position: absolute;
		bottom: 16px;
		right: 16px;
		z-index: 5;
	}
	
	.ar-button-overlay a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: all 0.2s;
	}
	
	.ar-button-overlay a:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
</style>
