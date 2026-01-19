<script lang="ts">
	import { Home, MapPin, Building2, Wrench, Plus, Search, Loader2 } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';

	interface Property {
		id: string;
		name: string;
		addressLine1: string;
		city: string;
		state: string;
		postalCode: string;
		propertyType: string;
		hasExternalHoa: boolean;
		activeCaseCount: number;
		squareFeet: number | null;
		yearBuilt: number | null;
	}

	interface Props {
		data: {
			properties: Property[];
		};
	}

	let { data }: Props = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let properties = $state<Property[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			properties = data.properties ?? [];
		}
	});

	const filteredProperties = $derived(
		properties.filter((p) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				p.name.toLowerCase().includes(query) ||
				p.addressLine1.toLowerCase().includes(query) ||
				p.city.toLowerCase().includes(query)
			);
		})
	);

	const propertyTypeLabels: Record<string, string> = {
		SINGLE_FAMILY: 'Single Family',
		CONDOMINIUM: 'Condo',
		TOWNHOUSE: 'Townhouse',
		COOPERATIVE: 'Co-op',
		MIXED_USE: 'Mixed Use',
		COMMERCIAL: 'Commercial'
	};

	function loadProperties() {
		// This is naturally handled by the parent load function on mount/navigation
		// But we keep the function name for the "Try Again" button
		window.location.reload();
	}
</script>

<svelte:head>
	<title>My Properties | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">My Properties</h1>
				<p class="mt-1 text-surface-500">
					Manage your properties and their details
				</p>
			</div>
			<a href="/app/concierge/properties/new" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				Add Property
			</a>
		</div>

		<!-- Search -->
		{#if properties.length > 0}
			<div class="mt-6">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
					<input
						type="text"
						placeholder="Search properties..."
						bind:value={searchQuery}
						class="input w-full pl-10"
					/>
				</div>
			</div>
		{/if}

		<!-- Properties List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="md">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={loadProperties} class="btn preset-tonal-primary mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if properties.length === 0}
				<Card variant="outlined" padding="none">
					<div class="p-6">
						<EmptyState
							title="No properties yet"
							description="Add your first property to start managing it with Hestami AI."
						>
							{#snippet actions()}
								<a href="/app/concierge/properties/new" class="btn preset-filled-primary-500">
									<Plus class="mr-2 h-4 w-4" />
									Add Your First Property
								</a>
							{/snippet}
						</EmptyState>
					</div>
				</Card>
			{:else if filteredProperties.length === 0}
				<Card variant="outlined" padding="md">
					<p class="text-center text-surface-500">No properties match your search.</p>
				</Card>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredProperties as property (property.id)}
						<a href="/app/concierge/properties/{property.id}" class="group">
							<Card 
								variant="outlined" 
								padding="md"
								class="h-full transition-all hover:border-primary-500 hover:shadow-md"
							>
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
										<Home class="h-5 w-5 text-primary-500" />
									</div>
									<div class="min-w-0 flex-1">
										<h3 class="font-semibold group-hover:text-primary-500">{property.name}</h3>
										<div class="mt-1 flex items-center gap-1 text-sm text-surface-500">
											<MapPin class="h-3 w-3 shrink-0" />
											<span class="truncate">{property.addressLine1}</span>
										</div>
										<p class="text-sm text-surface-500">
											{property.city}, {property.state} {property.postalCode}
										</p>
									</div>
								</div>

								<div class="mt-4 flex flex-wrap items-center gap-2">
									<span class="inline-flex items-center rounded-full bg-surface-500/10 px-2 py-0.5 text-xs">
										<Building2 class="mr-1 h-3 w-3" />
										{propertyTypeLabels[property.propertyType] || property.propertyType}
									</span>
									{#if property.hasExternalHoa}
										<span class="inline-flex items-center rounded-full bg-warning-500/10 px-2 py-0.5 text-xs text-warning-600 dark:text-warning-400">
											HOA
										</span>
									{/if}
									{#if property.activeCaseCount > 0}
										<span class="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
											<Wrench class="mr-1 h-3 w-3" />
											{property.activeCaseCount} active
										</span>
									{/if}
								</div>

								{#if property.squareFeet || property.yearBuilt}
									<div class="mt-3 flex gap-4 text-xs text-surface-500">
										{#if property.squareFeet}
											<span>{property.squareFeet.toLocaleString()} sq ft</span>
										{/if}
										{#if property.yearBuilt}
											<span>Built {property.yearBuilt}</span>
										{/if}
									</div>
								{/if}
							</Card>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
