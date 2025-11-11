<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
		searchProviders,
		semanticSearch,
		type SearchFilters,
		type Provider
	} from '$lib/services/providerSearch';
	import {
		Search,
		MapPin,
		Star,
		Phone,
		Globe,
		Award,
		Filter,
		Loader2,
		Map as MapIcon,
		AlertCircle,
		CheckCircle2
	} from 'lucide-svelte';

	// Search state
	let loading = false;
	let results: Provider[] = [];
	let resultCount = 0;
	let error: string | null = null;
	let successMessage: string | null = null;

	// Unified search query
	let searchQuery = '';

	// Filters
	let filters: SearchFilters = {
		available_only: true,
		limit: 20
	};

	// Location search
	let useLocation = false;
	let locationAddress = '';
	let geocodedLocation: { latitude: number; longitude: number } | null = null;
	let geocoding = false;

	// UI state
	let showFilters = false;

	// Geocode address to lat/lng
	async function geocodeAddress() {
		if (!locationAddress.trim()) {
			geocodedLocation = null;
			return;
		}

		geocoding = true;
		try {
			// Use a geocoding service (e.g., Nominatim, Google Maps, etc.)
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationAddress)}&limit=1`
			);
			const data = await response.json();
			
			if (data && data.length > 0) {
				geocodedLocation = {
					latitude: parseFloat(data[0].lat),
					longitude: parseFloat(data[0].lon)
				};
				successMessage = `Location found: ${data[0].display_name}`;
			} else {
				error = 'Address not found. Please try a different address.';
				geocodedLocation = null;
			}
		} catch (err) {
			error = 'Failed to geocode address';
			geocodedLocation = null;
		} finally {
			geocoding = false;
		}
	}

	async function handleSearch() {
		loading = true;
		error = null;
		successMessage = null;

		try {
			let response;

			// Geocode address if location search is enabled and not already geocoded
			if (useLocation && locationAddress.trim() && !geocodedLocation) {
				await geocodeAddress();
				if (!geocodedLocation) {
					// Geocoding failed, stop search
					loading = false;
					return;
				}
			}

			// Unified search: use semantic if query provided, otherwise filter-only
			if (searchQuery.trim()) {
				// Semantic/hybrid search with optional location
				const options: any = { limit: filters.limit };
				if (useLocation && geocodedLocation) {
					options.latitude = geocodedLocation.latitude;
					options.longitude = geocodedLocation.longitude;
					options.radius_miles = filters.radius_miles || 50;
				}
				response = await semanticSearch(searchQuery, options);
			} else {
				// Filter-only search
				const searchFilters = { ...filters };
				if (useLocation && geocodedLocation) {
					searchFilters.latitude = geocodedLocation.latitude;
					searchFilters.longitude = geocodedLocation.longitude;
				}
				response = await searchProviders(searchFilters);
			}

			results = response.results;
			resultCount = response.count;
			successMessage = `Found ${resultCount} provider${resultCount !== 1 ? 's' : ''}`;
		} catch (err: any) {
			error = err.message || 'Search failed';
			results = [];
			resultCount = 0;
		} finally {
			loading = false;
		}
	}

	function clearFilters() {
		filters = {
			available_only: true,
			limit: 20
		};
		searchQuery = '';
		useLocation = false;
		locationAddress = '';
		geocodedLocation = null;
		results = [];
		resultCount = 0;
	}
</script>

<svelte:head>
	<title>Provider Search - Hestami AI</title>
</svelte:head>

<div class="container mx-auto p-4 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="h1">Provider Search</h1>
			<p class="text-surface-600-300-token mt-1">
				Unified search with natural language, location, and advanced filters
			</p>
		</div>
	</div>

	<!-- Error/Success Messages -->
	{#if error}
		<div class="alert variant-filled-error flex items-center gap-3">
			<AlertCircle class="h-5 w-5" />
			<span>{error}</span>
		</div>
	{/if}
	{#if successMessage}
		<div class="alert variant-filled-success flex items-center gap-3">
			<CheckCircle2 class="h-5 w-5" />
			<span>{successMessage}</span>
		</div>
	{/if}

	<!-- Unified Search Panel -->
	<div class="card">
		<div class="p-6 space-y-4">
			<!-- Main Search Input -->
			<div>
				<label class="label mb-2">
					<span class="font-semibold">Search Providers</span>
				</label>
				<div class="input-group input-group-divider grid-cols-[1fr_auto]">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="e.g., emergency HVAC repair, roofing contractor, plumbing services..."
						class="input text-lg"
						on:keydown={(e) => e.key === 'Enter' && handleSearch()}
					/>
					<button class="variant-filled-primary px-6" on:click={handleSearch} disabled={loading}>
						{#if loading}
							<Loader2 class="h-5 w-5 animate-spin" />
						{:else}
							<Search class="h-5 w-5" />
						{/if}
						<span class="ml-2">Search</span>
					</button>
				</div>
				<p class="text-sm text-surface-600-300-token mt-2">
					💡 <strong>Smart search:</strong> Uses AI to understand your query and find relevant providers.
					Try natural language like "24/7 emergency HVAC" or simple keywords like "roofing".
				</p>
			</div>

			<!-- Location Filter -->
			{#if useLocation}
				<div class="card variant-ghost-surface p-4 space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="h6 font-semibold flex items-center gap-2">
							<MapPin class="h-4 w-4 text-primary-500" />
							Search Near Property Address
						</h3>
						<button
							class="btn btn-sm variant-ghost-surface"
							on:click={() => {
								useLocation = false;
								locationAddress = '';
								geocodedLocation = null;
							}}
						>
							Remove
						</button>
					</div>
					
					<div class="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
						<label class="label">
							<span class="text-sm">Property Address</span>
							<input
								type="text"
								class="input"
								bind:value={locationAddress}
								placeholder="e.g., 123 Main St, City, State"
								on:change={geocodeAddress}
							/>
						</label>
						<label class="label">
							<span class="text-sm">Radius (miles)</span>
							<input
								type="number"
								class="input w-24"
								bind:value={filters.radius_miles}
								placeholder="50"
								min="1"
								max="500"
							/>
						</label>
						<button
							class="btn variant-filled-secondary"
							on:click={geocodeAddress}
							disabled={geocoding || !locationAddress.trim()}
						>
							{#if geocoding}
								<Loader2 class="h-4 w-4 animate-spin" />
							{:else}
								<MapPin class="h-4 w-4" />
							{/if}
							<span>Locate</span>
						</button>
					</div>
					
					{#if geocodedLocation}
						<div class="text-sm text-success-500 flex items-center gap-2">
							<CheckCircle2 class="h-4 w-4" />
							<span>Location confirmed</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Quick Filters Row -->
			<div class="flex flex-wrap gap-4 items-center justify-between">
				<div class="flex flex-wrap gap-4 items-center">
					<!-- Location Toggle -->
					<button
						class="btn variant-ghost-surface btn-sm"
						on:click={() => (useLocation = !useLocation)}
					>
						<MapPin class="h-4 w-4" />
						<span>{useLocation ? 'Hide' : 'Add'} Location Filter</span>
					</button>

					<!-- Available Only -->
					<label class="flex items-center space-x-2 cursor-pointer">
						<input type="checkbox" class="checkbox" bind:checked={filters.available_only} />
						<CheckCircle2 class="h-4 w-4 text-success-500" />
						<span>Available only</span>
					</label>
				</div>

				<!-- Advanced Filters Toggle -->
				<button
					class="btn variant-ghost-surface btn-sm"
					on:click={() => (showFilters = !showFilters)}
				>
					<Filter class="h-4 w-4" />
					<span>{showFilters ? 'Hide' : 'Show'} Advanced Filters</span>
				</button>
			</div>

			<!-- Advanced Filters (Collapsible) -->
			{#if showFilters}
				<div class="card variant-ghost-surface p-4 space-y-4">
					<h3 class="h5 font-semibold">Advanced Filters</h3>
					
					<div class="grid grid-cols-2 gap-4">
						<label class="label">
							<span>Min Rating</span>
							<input
								type="number"
								class="input"
								bind:value={filters.min_rating}
								placeholder="0.0"
								min="0"
								max="5"
								step="0.1"
							/>
						</label>
						<label class="label">
							<span>Max Results</span>
							<input
								type="number"
								class="input"
								bind:value={filters.limit}
								placeholder="20"
								min="1"
								max="100"
							/>
						</label>
					</div>

					<div class="flex gap-2">
						<button class="btn variant-filled-secondary btn-sm" on:click={clearFilters}>
							Clear All
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Results -->
	{#if results.length > 0}
		<div class="card">
			<header class="card-header">
				<h2 class="h3">Results ({resultCount})</h2>
			</header>
			<section class="p-4">
				<div class="grid gap-4">
					{#each results as provider}
						<div class="card variant-ghost-surface p-4 hover:variant-soft-surface transition-colors">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<h3 class="h4 mb-2">{provider.business_name}</h3>
									{#if provider.description}
										<p class="text-sm text-surface-600-300-token mb-3">
											{provider.description}
										</p>
									{/if}

									<div class="flex flex-wrap gap-4 text-sm">
										{#if provider.rating && typeof provider.rating === 'number'}
											<div class="flex items-center gap-1">
												<Star class="h-4 w-4 text-warning-500 fill-warning-500" />
												<span class="font-medium">{provider.rating.toFixed(1)}</span>
												<span class="text-surface-600-300-token">
													({provider.total_reviews || 0} reviews)
												</span>
											</div>
										{/if}

										{#if provider.address}
											<div class="flex items-center gap-1 text-surface-600-300-token">
												<MapPin class="h-4 w-4" />
												<span>{provider.address}</span>
											</div>
										{/if}

										{#if provider.phone}
											<div class="flex items-center gap-1 text-surface-600-300-token">
												<Phone class="h-4 w-4" />
												<span>{provider.phone}</span>
											</div>
										{/if}

										{#if provider.website}
											<a
												href={provider.website}
												target="_blank"
												rel="noopener noreferrer"
												class="flex items-center gap-1 text-primary-500 hover:text-primary-600"
											>
												<Globe class="h-4 w-4" />
												<span>Website</span>
											</a>
										{/if}

										{#if provider.business_license}
											<div class="flex items-center gap-1 text-success-500">
												<Award class="h-4 w-4" />
												<span>Licensed</span>
											</div>
										{/if}
									</div>

									{#if provider.distance !== undefined && typeof provider.distance === 'number'}
										<div class="mt-2 text-sm text-surface-600-300-token">
											<MapIcon class="inline h-3 w-3" />
											{provider.distance.toFixed(1)} miles away
										</div>
									{/if}

									{#if provider.similarity !== undefined && typeof provider.similarity === 'number'}
										<div class="mt-2">
											<div class="badge variant-soft-primary">
												Relevance: {((1 - provider.similarity) * 100).toFixed(0)}%
											</div>
										</div>
									{/if}
								</div>

								<div class="flex flex-col gap-2">
									<span
										class="badge {provider.is_available
											? 'variant-filled-success'
											: 'variant-filled-surface'}"
									>
										{provider.is_available ? 'Available' : 'Unavailable'}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
	{:else if !loading && resultCount === 0}
		<div class="card p-8 text-center">
			<Search class="h-12 w-12 mx-auto text-surface-400-500-token mb-4" />
			<h3 class="h3 mb-2">No results found</h3>
			<p class="text-surface-600-300-token">Try adjusting your search filters</p>
		</div>
	{/if}
</div>
