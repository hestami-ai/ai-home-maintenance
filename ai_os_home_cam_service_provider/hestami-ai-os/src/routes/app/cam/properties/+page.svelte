<script lang="ts">
	import { Building2, Plus, Search } from 'lucide-svelte';
	import { SplitView, ListPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { propertyApi, type Property } from '$lib/api/cam';

	interface PropertyListItem extends Property {
		createdAt?: string;
	}

	let properties = $state<Property[]>([]);
	let selectedProperty = $state<Property | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');

	async function loadProperties() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { search?: string } = {};
			if (searchQuery) params.search = searchQuery;

			const response = await propertyApi.list(params as any);
			if (response.ok) {
				properties = response.data.properties as PropertyListItem[];
			}
		} catch (error) {
			console.error('Failed to load properties:', error);
		} finally {
			isLoading = false;
		}
	}

	function getPropertyTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			'SINGLE_FAMILY': 'Single Family',
			'TOWNHOME': 'Townhome',
			'CONDO': 'Condominium',
			'APARTMENT': 'Apartment',
			'COMMERCIAL': 'Commercial',
			'MIXED_USE': 'Mixed Use'
		};
		return labels[type] || type.replace(/_/g, ' ');
	}

	const filteredProperties = $derived(
		properties.filter((p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(p.city + ', ' + p.state).toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadProperties();
		}
	});
</script>

<svelte:head>
	<title>Properties | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedProperty}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Properties</h1>
						<a href="/app/cam/properties/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							Add
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search properties..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			{/snippet}

			{#snippet items()}
				{#each filteredProperties as property}
					{@const p = property}
					<button
						type="button"
						onclick={() => selectedProperty = p}
						class="w-full border-b border-surface-200-800 p-4 text-left transition-colors hover:bg-surface-100-900 {selectedProperty?.id === p.id ? 'bg-primary-500/10' : ''}"
					>
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<p class="font-medium">{p.name}</p>
								<p class="mt-0.5 text-sm text-surface-500">{p.city}, {p.state}</p>
							</div>
							<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs">
								{p.unitCount} units
							</span>
						</div>
						<div class="mt-2 flex items-center gap-2 text-xs text-surface-500">
							<span>{getPropertyTypeLabel(p.propertyType)}</span>
						</div>
					</button>
				{/each}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedProperty}
			{@const p = selectedProperty}
			<div class="flex h-full flex-col">
				<div class="border-b border-surface-300-700 px-6 py-4">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-lg font-semibold">{p.name}</h2>
							<p class="text-sm text-surface-500">{p.city}, {p.state}</p>
						</div>
						<a href="/app/cam/properties/{p.id}" class="btn btn-sm preset-tonal-surface">
							View Details
						</a>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<Card variant="outlined" padding="md">
							<p class="text-sm text-surface-500">Property Type</p>
							<p class="mt-1 font-medium">{getPropertyTypeLabel(p.propertyType)}</p>
						</Card>

						<Card variant="outlined" padding="md">
							<p class="text-sm text-surface-500">Status</p>
							<p class="mt-1 font-medium">Active</p>
						</Card>

						<Card variant="outlined" padding="md">
							<p class="text-sm text-surface-500">Units</p>
							<p class="mt-1 text-2xl font-semibold">{p.unitCount}</p>
						</Card>

						<Card variant="outlined" padding="md">
							<p class="text-sm text-surface-500">Common Areas</p>
							<p class="mt-1 text-2xl font-semibold">-</p>
						</Card>
					</div>

					<div class="mt-6">
						<h3 class="mb-3 font-semibold">Quick Actions</h3>
						<div class="flex flex-wrap gap-2">
							<a href="/app/cam/units?propertyId={p.id}" class="btn btn-sm preset-tonal-surface">
								View Units
							</a>
							<a href="/app/cam/work-orders?propertyId={p.id}" class="btn btn-sm preset-tonal-surface">
								Work Orders
							</a>
							<a href="/app/cam/violations?propertyId={p.id}" class="btn btn-sm preset-tonal-surface">
								Violations
							</a>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<EmptyState
			title="Select a Property"
			description="Choose a property from the list to view details"
		/>
	{/snippet}
</SplitView>
