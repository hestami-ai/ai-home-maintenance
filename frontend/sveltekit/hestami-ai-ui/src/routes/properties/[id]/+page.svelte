<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import ImageGallery from '$lib/components/ImageGallery.svelte';
	import SimpleLightbox from '$lib/components/SimpleLightbox.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import type { PropertyImage, GalleryItem } from '$lib/components/types';
	import type { Property, Media } from '$lib/types';
	import { 
		Home, 
		ArrowLeft, 
		MapPin, 
		Bed, 
		Bath, 
		Square, 
		Calendar, 
		DollarSign, 
		Car,
		Flame,
		Snowflake,
		Wind,
		Zap,
		Droplet,
		Hammer,
		Layers,
		Trees,
		Waves,
		Fence as FenceIcon
	} from 'lucide-svelte';
	
	// Get data from server-side load function using runes
	const { data } = $props();
	
	// Check for authentication errors and handle them
	onMount(() => {
		// If there's an error in the page data, check if it's an authentication error
		if ($page.error) {
			const errorMessage = $page.error.message || '';
			if (errorMessage.includes('Authentication failed') || 
			    errorMessage.includes('Unauthorized') || 
			    $page.status === 401 || 
			    $page.status === 403) {
				// Redirect to login page with return URL
				const returnUrl = encodeURIComponent($page.url.pathname);
				goto(`/login?returnUrl=${returnUrl}`);
			}
		}
	});
	
	// Extract property from data
	const property: Property = data?.property;
	// Get property ID from route params for navigation
	const propertyId = $page.params.id;
	
	// Check if property data is available
	const propertyAvailable = $state<boolean>(!!property);
	
	// Flag to track if we're using a placeholder image
	const hasRealImage = $state<boolean>(!!property?.featuredImage);
	
	// Extract property descriptives for easier access
	const descriptives = property?.descriptives || {};
	
	// Extract values from descriptives with fallbacks
	const propertyType = descriptives.propertyType || 'N/A';
	const yearBuilt = descriptives.yearBuilt || 'N/A';
	const squareFeet = descriptives.squareFootage || 'N/A';
	const bedrooms = descriptives.bedrooms || 'N/A';
	const bathrooms = descriptives.bathrooms || 'N/A';
	const parkingSpaces = descriptives.garageSpaces || (descriptives.garage ? '1+' : 'N/A');
	
	// Helper function to format field labels
	function formatLabel(value: string): string {
		if (!value) return value;
		return value.split('_').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		).join(' ');
	}
	
	// Main image - use featured image if available
	const mainImage = property.featuredImage;
	
	// Get media items from the API response
	const mediaItems = property.media || [];
	
	// Create property floorplans array from media items
	const propertyFloorplans = $state<PropertyImage[]>(
		mediaItems
			.filter((media: Media) => 
				media.media_type === 'IMAGE' && 
				media.media_sub_type === 'FLOORPLAN' && 
				!media.is_deleted
			)
			.map((media: Media): PropertyImage => ({
				id: media.id,
				url: media.file_url,
				thumbnail: media.file_url,
				area: 'Floorplan',
				description: media.title || media.description || `${property.address} - Floorplan`,
				uploadDate: new Date(media.created_at || new Date().toISOString()),
				tags: ['floorplan'],
				width: 1200,
				height: 800
			}))
	);
	
	// Check for 360-degree media (images and videos)
	const property360Media = $state<Media[]>(
		mediaItems
			.filter((media: Media) => 
				((media.media_type === 'IMAGE' || media.media_type === 'VIDEO') && 
				media.media_sub_type === '360_DEGREE' && 
				!media.is_deleted)
			)
	);
	
	// Virtual tour URL - would come from API in real implementation
	const virtualTourUrl = `/properties/${propertyId}/virtual-tour`;
	
	// No longer needed as we use real videos from the API
	// const videoUrls: string[] = [];
	// Function to go back to properties list
	function goBack() {
		goto('/properties');
	}
	
	// Format currency
	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}
	
	// Format date
	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}
	
	// Active tab state
	let activeTab = $state('details');
	
	// Create property videos array for the gallery from media items
	const propertyVideos = $state<Media[]>(
		mediaItems
			.filter((media: Media) => 
				media.media_type === 'VIDEO' && 
				media.media_sub_type === 'REGULAR' && 
				!media.is_deleted
			)
	);
	
	// State for video lightbox
	let selectedVideo = $state<Media | null>(null);
	let videoLightboxOpen = $state(false);
	
	// Create property images array for the gallery from media items
	const propertyImages = $state<PropertyImage[]>(
		mediaItems
			.filter((media: Media) => 
				media.media_type === 'IMAGE' && 
				media.media_sub_type === 'REGULAR' && 
				!media.is_deleted
			)
			.map((media: Media): PropertyImage => ({
				id: media.id,
				url: media.file_url,
				thumbnail: media.file_url,
				area: media.location_type === 'INTERIOR' ? 'Interior' : 
					media.location_type === 'EXTERIOR' ? 'Exterior' : 
					media.location_type || 'Other',
				description: media.title || media.description || `${property.address} - ${media.location_type || 'Property'}`,
				uploadDate: new Date(media.created_at || new Date().toISOString()),
				tags: [
					media.location_type?.toLowerCase() || 'other',
					media.location_sub_type?.toLowerCase() || 'general'
				],
				width: 1200,
				height: 800
			}))
	);
	
	// State for image filtering and lightbox
	let filteredImages = $state<PropertyImage[]>(propertyImages);
	let selectedAreaTags = $state<string[]>([]);
	let dateRange = $state<{startDate: Date | null, endDate: Date | null}>({ startDate: null, endDate: null });
	let selectedImage = $state<PropertyImage | null>(null);
	let lightboxOpen = $state(false);
	
	// Get unique area tags
	const uniqueAreaTags = [...new Set(propertyImages.map(img => img.area))].filter(Boolean) as string[];
	
	// Filter images based on selected area tags and date range
	$effect(() => {
		filteredImages = propertyImages.filter(img => {
			// Filter by area tags if any are selected
			const passesTagFilter = selectedAreaTags.length === 0 || 
				(img.area && selectedAreaTags.includes(img.area));
			
			// Filter by date range if set
			let passesDateFilter = true;
			if (dateRange.startDate && dateRange.endDate) {
				passesDateFilter = img.uploadDate >= dateRange.startDate && 
					img.uploadDate <= dateRange.endDate;
			}
			
			return passesTagFilter && passesDateFilter;
		});
	});
	
	// Toggle area tag selection
	function toggleAreaTag(tag: string) {
		if (selectedAreaTags.includes(tag)) {
			selectedAreaTags = selectedAreaTags.filter(t => t !== tag);
		} else {
			selectedAreaTags = [...selectedAreaTags, tag];
		}
	}
	
	// Handle date range change
	function handleDateRangeChange(range: {startDate: Date | null, endDate: Date | null}) {
		dateRange = range;
	}
	
	// Open lightbox with selected image
	function openLightbox(image: PropertyImage) {
		selectedImage = image;
		lightboxOpen = true;
	}
	
	// Close lightbox
	function closeLightbox() {
		lightboxOpen = false;
		selectedImage = null;
	}
	
	// Open video lightbox with selected video
	function openVideoLightbox(video: Media) {
		selectedVideo = video;
		videoLightboxOpen = true;
	}
	
	// Close video lightbox
	function closeVideoLightbox() {
		videoLightboxOpen = false;
		selectedVideo = null;
	}
</script>

<div class="space-y-8">
	<!-- Back button and title -->
	<div class="flex items-center justify-between">
		<button class="btn btn-sm variant-soft" onclick={goBack}>
			<ArrowLeft class="h-4 w-4 mr-1" />
			Back to Properties
		</button>
		<button class="btn btn-sm variant-filled-primary" onclick={() => goto(`/properties/${propertyId}/edit`)}>
			<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
			</svg>
			Edit Property
		</button>
	</div>

	{#if !propertyAvailable}
		<div class="card p-8 text-center">
			<div class="flex flex-col items-center justify-center space-y-4">
				<div class="p-4 rounded-full bg-error-100 text-error-500">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				</div>
				<h2 class="h3">Unable to Load Property</h2>
				<p class="text-surface-600-300-token max-w-md">We couldn't load the property details. This may be due to an authentication issue or the property may not exist.</p>
				<button class="btn variant-filled-primary" onclick={() => goto('/login')}>
					Go to Login
				</button>
			</div>
		</div>
	{:else}
	
	<!-- Section 1: Header with main property view and address -->
	<div class="card overflow-hidden">
		<div class="relative">
			{#if hasRealImage && mainImage}
				<!-- Real property image -->
				<img 
					src={mainImage} 
					alt={property.address} 
					class="w-full h-[400px] object-cover"
				/>
			{:else}
				<!-- Home icon placeholder -->
				<div class="w-full h-[400px] flex items-center justify-center bg-surface-200-700-token/30">
					<Home class="h-48 w-48 text-primary-500 opacity-50" />
				</div>
			{/if}
			<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
				<h1 class="h2 text-white">{property.address}</h1>
				<div class="flex items-center text-white/90">
					<MapPin class="h-4 w-4 mr-1" />
					<span>{property.city}, {property.state} {property.zip_code}</span>
				</div>
			</div>
		</div>
		
		<!-- Property highlights -->
		<div class="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-100-800-token">
			<div class="flex items-center">
				<Bed class="h-5 w-5 mr-2 text-primary-500" />
				<div>
					<div class="text-sm text-surface-600-300-token">Bedrooms</div>
					<div class="font-semibold">{bedrooms}</div>
				</div>
			</div>
			<div class="flex items-center">
				<Bath class="h-5 w-5 mr-2 text-primary-500" />
				<div>
					<div class="text-sm text-surface-600-300-token">Bathrooms</div>
					<div class="font-semibold">{bathrooms}</div>
				</div>
			</div>
			<div class="flex items-center">
				<Square class="h-5 w-5 mr-2 text-primary-500" />
				<div>
					<div class="text-sm text-surface-600-300-token">Square Feet</div>
					<div class="font-semibold">{squareFeet}</div>
				</div>
			</div>
		</div>
	</div>
	
	<!-- Tabs for different sections -->
	<div class="card p-4">
		<nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row flex flex-wrap gap-1 mb-4">
			<button 
				class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'details' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}" 
				onclick={() => activeTab = 'details'}
			>
				Details
			</button>
			<button 
				class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'virtual-tour' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}" 
				onclick={() => activeTab = 'virtual-tour'}
			>
				Virtual Tour
			</button>
			<button 
				class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'floorplans' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}" 
				onclick={() => activeTab = 'floorplans'}
			>
				Floorplans
			</button>
			<button 
				class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'videos' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}" 
				onclick={() => activeTab = 'videos'}
			>
				Videos
			</button>
			<button 
				class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'images' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}" 
				onclick={() => activeTab = 'images'}
			>
				Images
			</button>
		</nav>
		
		<div class="p-4">
			<!-- Section 1: Property Details Tab -->
			{#if activeTab === 'details'}
				<div class="space-y-6">
					<div>
						<h2 class="h3 mb-2">Description</h2>
						<p class="text-surface-600-300-token">{property.description}</p>
					</div>
					
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<h3 class="h4 mb-2">Property Information</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								<div class="flex items-start">
									<Home class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Property Type</div>
										<div class="text-sm text-surface-600-300-token">{propertyType}</div>
									</div>
								</div>
								<div class="flex items-start">
									<Calendar class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Year Built</div>
										<div class="text-sm text-surface-600-300-token">{yearBuilt}</div>
									</div>
								</div>
								<div class="flex items-start">
									<Square class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Square Footage</div>
										<div class="text-sm text-surface-600-300-token">{squareFeet} sq ft</div>
									</div>
								</div>
								<div class="flex items-start">
									<Bed class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Bedrooms</div>
										<div class="text-sm text-surface-600-300-token">{bedrooms}</div>
									</div>
								</div>
								<div class="flex items-start">
									<Bath class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Bathrooms</div>
										<div class="text-sm text-surface-600-300-token">{bathrooms}</div>
									</div>
								</div>
								<div class="flex items-start">
									<Car class="h-4 w-4 mr-2 mt-1 text-primary-500" />
									<div>
										<div class="font-medium">Parking</div>
										<div class="text-sm text-surface-600-300-token">{parkingSpaces}</div>
									</div>
								</div>
							</div>
						</div>
						
						<!-- HVAC & Climate Control -->
						{#if descriptives.heatingSystem || descriptives.coolingSystem || descriptives.airConditioning}
							<div>
								<h3 class="h4 mb-2">HVAC & Climate Control</h3>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{#if descriptives.heatingSystem}
										<div class="flex items-start">
											<Flame class="h-4 w-4 mr-2 mt-1 text-primary-500" />
											<div>
												<div class="font-medium">Heating System</div>
												<div class="text-sm text-surface-600-300-token">{formatLabel(descriptives.heatingSystem)}</div>
											</div>
										</div>
									{/if}
									{#if descriptives.coolingSystem}
										<div class="flex items-start">
											<Snowflake class="h-4 w-4 mr-2 mt-1 text-primary-500" />
											<div>
												<div class="font-medium">Cooling System</div>
												<div class="text-sm text-surface-600-300-token">{formatLabel(descriptives.coolingSystem)}</div>
											</div>
										</div>
									{/if}
									{#if descriptives.airConditioning}
										<div class="flex items-start">
											<Wind class="h-4 w-4 mr-2 mt-1 text-primary-500" />
											<div>
												<div class="font-medium">Air Conditioning</div>
												<div class="text-sm text-surface-600-300-token">Yes</div>
											</div>
										</div>
									{/if}
									{#if descriptives.hvacAge}
										<div class="flex items-start">
											<Calendar class="h-4 w-4 mr-2 mt-1 text-primary-500" />
											<div>
												<div class="font-medium">HVAC Age</div>
												<div class="text-sm text-surface-600-300-token">{descriptives.hvacAge} years</div>
											</div>
										</div>
									{/if}
									{#if descriptives.hvacBrand}
										<div class="flex items-start">
											<Wind class="h-4 w-4 mr-2 mt-1 text-primary-500" />
											<div>
												<div class="font-medium">HVAC Brand</div>
												<div class="text-sm text-surface-600-300-token">{descriptives.hvacBrand}</div>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					
					<!-- Structure & Features -->
					{#if descriptives.basement || descriptives.garage || descriptives.attic || descriptives.pool || descriptives.fence || descriptives.deck || descriptives.patio}
						<div>
							<h3 class="h4 mb-2">Structure & Features</h3>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								{#if descriptives.basement}
									<div class="flex items-center">
										<Layers class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Basement{descriptives.basementType ? ` (${formatLabel(descriptives.basementType)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.garage}
									<div class="flex items-center">
										<Car class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Garage{descriptives.garageType ? ` (${formatLabel(descriptives.garageType)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.attic}
									<div class="flex items-center">
										<Home class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Attic</span>
									</div>
								{/if}
								{#if descriptives.pool}
									<div class="flex items-center">
										<Waves class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Pool{descriptives.poolType ? ` (${formatLabel(descriptives.poolType)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.fence}
									<div class="flex items-center">
										<FenceIcon class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Fence{descriptives.fenceType ? ` (${formatLabel(descriptives.fenceType)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.gatedCommunity}
									<div class="flex items-center">
										<Home class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Gated Community</span>
									</div>
								{/if}
								{#if descriptives.deck}
									<div class="flex items-center">
										<Layers class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Deck{descriptives.deckMaterial ? ` (${formatLabel(descriptives.deckMaterial)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.patio}
									<div class="flex items-center">
										<Square class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Patio{descriptives.patioMaterial ? ` (${formatLabel(descriptives.patioMaterial)})` : ''}</span>
									</div>
								{/if}
								{#if descriptives.sprinklerSystem}
									<div class="flex items-center">
										<Droplet class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<span class="text-sm">Sprinkler System</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					
					<!-- Roofing & Exterior -->
					{#if descriptives.roofType || descriptives.roofAge || descriptives.exteriorMaterial || descriptives.foundationType}
						<div>
							<h3 class="h4 mb-2">Roofing & Exterior</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{#if descriptives.roofType}
									<div class="flex items-start">
										<Home class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Roof Type</div>
											<div class="text-sm text-surface-600-300-token">{formatLabel(descriptives.roofType)}</div>
										</div>
									</div>
								{/if}
								{#if descriptives.roofAge}
									<div class="flex items-start">
										<Calendar class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Roof Age</div>
											<div class="text-sm text-surface-600-300-token">{descriptives.roofAge} years</div>
										</div>
									</div>
								{/if}
								{#if descriptives.exteriorMaterial}
									<div class="flex items-start">
										<Layers class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Exterior Material</div>
											<div class="text-sm text-surface-600-300-token">{formatLabel(descriptives.exteriorMaterial)}</div>
										</div>
									</div>
								{/if}
								{#if descriptives.foundationType}
									<div class="flex items-start">
										<Hammer class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Foundation Type</div>
											<div class="text-sm text-surface-600-300-token">{formatLabel(descriptives.foundationType)}</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					
					<!-- Utilities -->
					{#if descriptives.utilities && (descriptives.utilities.gas || descriptives.utilities.electricity || descriptives.utilities.water)}
						<div>
							<h3 class="h4 mb-2">Utilities</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{#if descriptives.utilities.gas}
									<div class="flex items-start">
										<Flame class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Gas</div>
											<div class="text-sm text-surface-600-300-token">{descriptives.utilities.gas}</div>
										</div>
									</div>
								{/if}
								{#if descriptives.utilities.electricity}
									<div class="flex items-start">
										<Zap class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Electricity</div>
											<div class="text-sm text-surface-600-300-token">{descriptives.utilities.electricity}</div>
										</div>
									</div>
								{/if}
								{#if descriptives.utilities.water}
									<div class="flex items-start">
										<Droplet class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Water</div>
											<div class="text-sm text-surface-600-300-token">{descriptives.utilities.water}</div>
										</div>
									</div>
								{/if}
								{#if descriptives.utilities.sewer}
									<div class="flex items-start">
										<Droplet class="h-4 w-4 mr-2 mt-1 text-primary-500" />
										<div>
											<div class="font-medium">Sewer</div>
											<div class="text-sm text-surface-600-300-token">{descriptives.utilities.sewer}</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					</div>
				</div>
			{/if}

			<!-- Section 2: Virtual Tour Tab -->
			{#if activeTab === 'virtual-tour'}
				<div class="space-y-4">
					<h2 class="h3">Virtual Tour</h2>
					{#if property360Media.length > 0}
						<div class="card p-8 flex flex-col items-center justify-center bg-surface-200-700-token/30 h-[400px]">
							<div class="text-4xl mb-4">🏠</div>
							<p class="text-center text-surface-600-300-token">Experience a 360° virtual tour of this property</p>
							<p class="text-center text-surface-600-300-token">Explore each room as if you were there in person</p>
							<a href={virtualTourUrl} class="btn variant-filled-primary">
								Start Virtual Tour
							</a>
						</div>
					{:else}
						<div class="card p-8 flex flex-col items-center justify-center bg-surface-200-700-token/30 h-[400px]">
							<div class="text-4xl mb-4">🏠</div>
							<p class="text-center text-surface-600-300-token">No virtual tour media currently available</p>
							<p class="text-center text-surface-600-300-token">Upload 360° media for virtual tours of this property</p>
						</div>
					{/if}
				</div>
			{/if}
			
			<!-- Section 3: Floorplans Tab -->
			{#if activeTab === 'floorplans'}
				<div class="space-y-4">
					<h2 class="h3">Floorplans</h2>
					{#if propertyFloorplans.length > 0}
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each propertyFloorplans as floorplan}
								<div class="card overflow-hidden">
									<div 
										class="relative cursor-pointer" 
										onclick={() => openLightbox(floorplan)}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && openLightbox(floorplan)}
									>
										<img 
											src={floorplan.url} 
											alt={floorplan.description || 'Property Floorplan'} 
											class="w-full h-64 object-contain hover:scale-105 transition-transform duration-300"
										/>
										<div class="absolute top-2 right-2">
											<button 
												type="button" 
												class="btn-icon variant-filled-surface btn-sm" 
												onclick={(e) => { e.stopPropagation(); openLightbox(floorplan); }}
												aria-label="View fullscreen"
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
											</button>
										</div>
									</div>
									<div class="p-3">
										<p class="font-medium">{floorplan.description || 'Property Floorplan'}</p>
										<p class="text-sm text-surface-600-300-token">
											Uploaded: {floorplan.uploadDate.toLocaleDateString()}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="card p-8 flex flex-col items-center justify-center bg-surface-200-700-token/30">
							<p class="text-center text-surface-600-300-token">No floorplans available</p>
						</div>
					{/if}
				</div>
			{/if}
			
			<!-- Section 4: Videos Tab -->
			{#if activeTab === 'videos'}
				<div class="space-y-4">
					<h2 class="h3">Property Videos</h2>
					{#if propertyVideos.length > 0}
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each propertyVideos as video}
								<div class="card overflow-hidden">
									<div 
										class="relative cursor-pointer" 
										onclick={() => openVideoLightbox(video)}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && openVideoLightbox(video)}
									>
										<img 
											src={video.thumbnail_large_url} 
											alt={video.title || video.description || 'Property Video'} 
											class="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
										/>
										<div class="absolute inset-0 flex items-center justify-center">
											<div class="rounded-full bg-black/50 p-3">
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
													<polygon points="5 3 19 12 5 21 5 3"></polygon>
												</svg>
											</div>
										</div>
										<div class="absolute top-2 right-2">
											<button 
												type="button" 
												class="btn-icon variant-filled-surface btn-sm" 
												onclick={(e) => { e.stopPropagation(); openVideoLightbox(video); }}
												aria-label="Play video"
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
											</button>
										</div>
									</div>
									<div class="p-3">
										<p class="font-medium">{video.title || 'Property Video'}</p>
										<p class="text-sm text-surface-600-300-token">
											Uploaded: {new Date(video.upload_date).toLocaleDateString()}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="card p-8 flex flex-col items-center justify-center bg-surface-200-700-token/30">
							<p class="text-center text-surface-600-300-token">No videos available</p>
						</div>
					{/if}
				</div>
			{/if}
			
			<!-- Section 5: Images Tab -->
			{#if activeTab === 'images'}
				<div class="space-y-4">
					<h2 class="h3">Property Images</h2>
					
					<!-- Filtering controls -->
					<div class="card p-4">
						<div class="flex flex-wrap gap-4 items-center">
							<!-- Area tag filters -->
							<div class="flex-1">
								<h4 class="font-medium mb-2">Filter by area:</h4>
								<div class="flex flex-wrap gap-2">
									{#each uniqueAreaTags as tag}
										<button 
											type="button" 
											class="chip variant-soft {selectedAreaTags.includes(tag) ? 'variant-filled-primary' : ''}" 
											onclick={() => toggleAreaTag(tag)}
										>
											{tag}
										</button>
									{/each}
									
									{#if selectedAreaTags.length > 0}
										<button 
											type="button" 
											class="chip variant-soft-surface" 
											onclick={() => selectedAreaTags = []}
										>
											Clear
										</button>
									{/if}
								</div>
							</div>
							
							<!-- Date range filter -->
							<div>
								<DateRangePicker 
									startDate={dateRange.startDate} 
									endDate={dateRange.endDate}
									onRangeChange={handleDateRangeChange}
									containerClass="relative z-10"
									buttonClass="btn variant-soft-surface"
									inputClass="input"
								/>
							</div>
						</div>
					</div>
					
					<!-- Image gallery grid -->
					{#if filteredImages.length > 0}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each filteredImages as image}
								<div class="card overflow-hidden">
									<div 
										class="relative cursor-pointer" 
										onclick={() => openLightbox(image)}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && openLightbox(image)}
									>
										<img 
											src={image.url} 
											alt={image.description || image.area || 'Property'} 
											class="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
										/>
										<div class="absolute top-2 right-2">
											<button 
												type="button" 
												class="btn-icon variant-filled-surface btn-sm" 
												onclick={(e) => { e.stopPropagation(); openLightbox(image); }}
												aria-label="View fullscreen"
											>
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
											</button>
										</div>
									</div>
									<div class="p-3">
										{#if image.area}
											<p class="font-medium">{image.area}</p>
										{/if}
										<p class="text-sm text-surface-600-300-token">
											Uploaded: {new Date(image.uploadDate).toLocaleDateString()}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="card p-8 flex flex-col items-center justify-center bg-surface-200-700-token/30">
							<p class="text-center text-surface-600-300-token">No images match your filters</p>
							<button 
								type="button" 
								class="btn variant-soft-primary mt-4" 
								onclick={() => { selectedAreaTags = []; dateRange = { startDate: null, endDate: null }; }}
							>
								Clear all filters
							</button>
						</div>
					{/if}
					
					<!-- Lightbox component is moved to the end of the file for better z-index handling -->
				</div>
			{/if}
		</div>
	</div>
	{/if}
</div>


<!-- Lightbox components at root level for proper z-index handling -->
<SimpleLightbox 
	image={selectedImage} 
	isOpen={lightboxOpen} 
	onClose={closeLightbox} 
	containerClass="z-50"
/>

<!-- Video Lightbox -->
{#if videoLightboxOpen && selectedVideo}
	<div class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
		<div class="relative w-full max-w-4xl">
			<!-- Close button -->
			<button 
				type="button" 
				class="absolute -top-10 right-0 text-white hover:text-primary-500 transition-colors"
				onclick={closeVideoLightbox}
				aria-label="Close video"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
			
			<!-- Video player -->
			<div class="aspect-video bg-black rounded-lg overflow-hidden">
				<video 
					class="w-full h-full" 
					controls 
					autoplay
					src={selectedVideo.file_url}
				>
					<track kind="captions" src="" label="English" />
					Your browser does not support the video tag.
				</video>
			</div>
			
			<!-- Video title and description -->
			<div class="mt-4 text-white">
				<h3 class="text-xl font-semibold">{selectedVideo.title || 'Property Video'}</h3>
				{#if selectedVideo.description}
					<p class="mt-2">{selectedVideo.description}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
