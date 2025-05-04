<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Viewer } from '@photo-sphere-viewer/core';
	import '@photo-sphere-viewer/core/index.css';
	
	// Props
	export let panoramaUrl: string;
	export let title: string = '';
	
	// DOM references
	let container: HTMLElement;
	
	// Viewer instance
	let viewer: Viewer | null = null;
	
	onMount(() => {
		if (container) {
			// Initialize the viewer
			viewer = new Viewer({
				container,
				panorama: panoramaUrl,
				caption: title,
				navbar: [
					'autorotate',
					'zoom',
					'fullscreen'
				],
				defaultZoomLvl: 50,
				touchmoveTwoFingers: true,
				mousewheelCtrlKey: true
			});
		}
	});
	
	onDestroy(() => {
		// Clean up resources when component is destroyed
		if (viewer) {
			viewer.destroy();
			viewer = null;
		}
	});
	
	// Handle visibility changes to optimize performance
	function handleVisibilityChange() {
		if (document.hidden && viewer) {
			// Pause rendering when tab not visible
			viewer.stopAnimation();
		} else if (viewer) {
			// Resume rendering when tab becomes visible
			// When the tab becomes visible again, we don't need to explicitly restart animation
			// as the viewer will continue rendering normally once stopAnimation is no longer called
			// If we wanted to trigger autorotate, we could use:
			// viewer.setOption('autorotateEnabled', true);
		}
	}
	
	// Set up visibility change listener
	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<div bind:this={container} class="virtual-tour-container"></div>

<style>
	.virtual-tour-container {
		width: 100%;
		height: 80vh;
		min-height: 500px;
		position: relative;
	}
	
	/* Ensure Photo Sphere Viewer styles are applied correctly */
	:global(.psv-container) {
		width: 100%;
		height: 100%;
	}
</style>
