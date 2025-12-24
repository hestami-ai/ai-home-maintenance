<script lang="ts">
	import { Home, Plus, Search } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { unitApi, type Unit } from '$lib/api/cam';

	interface UnitListItem extends Unit {
		propertyName?: string;
		ownerName?: string;
		tenantName?: string;
		createdAt?: string;
	}

	let units = $state<Unit[]>([]);
	let selectedUnit = $state<Unit | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let typeFilter = $state<string>('');

	const typeOptions = [
		{ value: '', label: 'All Types' },
		{ value: 'SINGLE_FAMILY', label: 'Single Family' },
		{ value: 'TOWNHOUSE', label: 'Townhouse' },
		{ value: 'CONDO', label: 'Condo' },
		{ value: 'APARTMENT', label: 'Apartment' },
		{ value: 'LOT', label: 'Lot' }
	];

	async function loadUnits() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { unitType?: string; search?: string } = {};
			if (typeFilter) params.unitType = typeFilter;
			if (searchQuery) params.search = searchQuery;

			const response = await unitApi.list(params);
			if (response.ok && response.data?.units) {
				units = response.data.units as UnitListItem[];
			}
		} catch (error) {
			console.error('Failed to load units:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectUnit(unit: Unit) {
		selectedUnit = unit;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const filteredUnits = $derived(
		units.filter((u) =>
			u.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.ownerName && u.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
			(u.address && u.address.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadUnits();
		}
	});

	$effect(() => {
		loadUnits();
	});
</script>

<svelte:head>
	<title>Units & Properties | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedUnit}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Units & Properties</h1>
						<a href="/app/cam/units/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search units..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<select
						bind:value={typeFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each typeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredUnits.length === 0}
					<div class="p-6">
						<EmptyState
							title="No units found"
							description={searchQuery || typeFilter
								? 'Try adjusting your filters.'
								: 'No units have been added yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredUnits as unit}
							<button
								type="button"
								onclick={() => selectUnit(unit)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedUnit?.id === unit.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="font-medium">Unit {unit.unitNumber}</p>
										<p class="mt-0.5 text-sm text-surface-500">
											{unit.unitType.replace(/_/g, ' ')}
										</p>
										{#if unit.ownerName}
											<p class="mt-0.5 text-sm text-surface-500">
												Owner: {unit.ownerName}
											</p>
										{/if}
									</div>
									<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-surface-200-800">
										{unit.status}
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedUnit}
			<DetailPanel>
				{#snippet header()}
					{@const u = selectedUnit!}
					<div>
						<h2 class="text-xl font-semibold">Unit {u.unitNumber}</h2>
						<p class="mt-1 text-sm text-surface-500">{u.unitType.replace(/_/g, ' ')}</p>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const u = selectedUnit!}
					<a href="/app/cam/units/{u.id}/edit" class="btn btn-sm preset-tonal-surface">
						Edit
					</a>
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{ id: 'overview', label: 'Overview', content: overviewTab },
							{ id: 'documents', label: 'Documents', content: documentsTab },
							{ id: 'history', label: 'History', content: historyTab }
						]}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<Home class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a unit to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedUnit}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Unit Number</h3>
					<p class="mt-1">{selectedUnit.unitNumber}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Type</h3>
					<p class="mt-1">{selectedUnit.unitType.replace(/_/g, ' ')}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Property</h3>
					<p class="mt-1">{selectedUnit.propertyName}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Status</h3>
					<p class="mt-1">{selectedUnit.status}</p>
				</div>
				{#if selectedUnit.ownerName}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Owner</h3>
						<p class="mt-1">{selectedUnit.ownerName}</p>
					</div>
				{/if}
				{#if selectedUnit.tenantName}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Tenant</h3>
						<p class="mt-1">{selectedUnit.tenantName}</p>
					</div>
				{/if}
				{#if selectedUnit.address}
					<div class="sm:col-span-2">
						<h3 class="text-sm font-medium text-surface-500">Address</h3>
						<p class="mt-1">{selectedUnit.address}</p>
					</div>
				{/if}
			</div>

			<div class="border-t border-surface-300-700 pt-4">
				<h3 class="mb-3 font-medium">Quick Links</h3>
				<div class="flex flex-wrap gap-2">
					<a href="/app/cam/violations?unitId={selectedUnit.id}" class="btn btn-sm preset-tonal-surface">
						View Violations
					</a>
					<a href="/app/cam/arc?unitId={selectedUnit.id}" class="btn btn-sm preset-tonal-surface">
						ARC Requests
					</a>
					<a href="/app/cam/work-orders?unitId={selectedUnit.id}" class="btn btn-sm preset-tonal-surface">
						Work Orders
					</a>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Unit-specific documents will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Activity events and ownership history will appear here."
	/>
{/snippet}
