<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	
	// Get data from server load function
	export let data: PageData;
	
	// Get property ID from route params
	const propertyId = $page.params.id;
	
	// Extract property and panoramas from server data
	const { property, panoramas } = data;
	
	// Get the first panorama URL (or null if none available)
	const panoramaUrl = panoramas.length > 0 ? panoramas[0].file_url : null;
	
	// Dynamically import VirtualTourViewer only on client-side
	let VirtualTourViewer: any;
	if (browser) {
		import('$lib/components/virtual-tour/VirtualTourViewer.svelte').then((module) => {
			VirtualTourViewer = module.default;
		});
	}
	
	// Function to navigate back to property details
	function goBack() {
		goto(`/properties/${propertyId}`);
	}
</script>

<div class="container mx-auto p-4 space-y-6">
	<!-- Header with back button -->
	<div class="flex items-center space-x-2">
		<button class="btn btn-sm variant-soft" on:click={goBack}>
			<ArrowLeft class="h-4 w-4 mr-1" />
			Back to Property Details
		</button>
	</div>
	
	<!-- Property info header -->
	<div class="card p-4">
		<h1 class="h2">Virtual Tour</h1>
		<p class="text-surface-600-300-token">{property.address}, {property.city}, {property.state} {property.zip_code}</p>
	</div>
	
	<!-- Virtual Tour Viewer -->
	<div class="card p-4">
		<div class="card-header pb-4">
			<h2 class="h3">Explore the Property</h2>
			<p class="text-surface-600-300-token">Navigate the 360° panorama using your mouse or touch screen</p>
		</div>
		
		<div class="card-body">
			{#if panoramaUrl}
				{#if VirtualTourViewer}
					<svelte:component this={VirtualTourViewer} 
						panoramaUrl={panoramaUrl} 
						title={property.address}
					/>
				{:else}
					<div class="flex items-center justify-center h-[500px]">
						<div class="text-center">
							<div class="animate-pulse">Loading virtual tour viewer...</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="alert variant-ghost-warning p-8 text-center">
					<h3 class="h4 mb-2">No Virtual Tour Available</h3>
					<p class="text-surface-600-300-token">
						This property does not currently have a 360° panorama or virtual tour available.
					</p>
				</div>
			{/if}
		</div>
		
		{#if panoramaUrl}
			<div class="card-footer pt-4">
				<p class="text-sm text-surface-600-300-token">
					<strong>Tip:</strong> Use your mouse to drag and look around. Scroll to zoom in and out. On mobile, use two fingers to navigate.
				</p>
			</div>
		{/if}
	</div>
</div>
