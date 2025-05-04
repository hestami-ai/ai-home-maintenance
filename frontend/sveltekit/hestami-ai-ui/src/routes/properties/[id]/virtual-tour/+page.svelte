<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft } from 'lucide-svelte';
	import VirtualTourViewer from '$lib/components/virtual-tour/VirtualTourViewer.svelte';
	
	// Get property ID from route params
	const propertyId = $page.params.id;
	
	// Mock property data - in a real app, this would come from an API
	const property = {
		id: propertyId,
		address: '123 Main Street',
		city: 'Boston',
		state: 'MA',
		zipCode: '02108',
		// Sample panorama URL - replace with your actual panorama images
		panoramaUrl: 'https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg'
	};
	
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
		<p class="text-surface-600-300-token">{property.address}, {property.city}, {property.state} {property.zipCode}</p>
	</div>
	
	<!-- Virtual Tour Viewer -->
	<div class="card p-4">
		<div class="card-header pb-4">
			<h2 class="h3">Explore the Property</h2>
			<p class="text-surface-600-300-token">Navigate the 360° panorama using your mouse or touch screen</p>
		</div>
		
		<div class="card-body">
			<VirtualTourViewer 
				panoramaUrl={property.panoramaUrl} 
				title={property.address}
			/>
		</div>
		
		<div class="card-footer pt-4">
			<p class="text-sm text-surface-600-300-token">
				<strong>Tip:</strong> Use your mouse to drag and look around. Scroll to zoom in and out. On mobile, use two fingers to navigate.
			</p>
		</div>
	</div>
</div>
