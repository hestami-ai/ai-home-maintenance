<script lang="ts">
	import { Building2, Search } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { camStore, currentAssociation, organizationStore } from '$lib/stores';
	import { associationApi } from '$lib/api/cam';

	interface Association {
		id: string;
		name: string;
		legalName?: string;
		status: string;
		fiscalYearEnd: number;
		unitCount?: number;
		createdAt?: string;
	}

	let associations = $state<Association[]>([]);
	let selectedAssociation = $state<Association | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');

	async function loadAssociations() {
		const orgId = $organizationStore.current?.organization.id;
		if (!orgId) return;

		isLoading = true;
		try {
			const response = await associationApi.list({});
			if (response.ok) {
				associations = response.data.associations as any;
			}
		} catch (error) {
			console.error('Failed to load associations:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectAssociation(association: Association) {
		selectedAssociation = association;
	}

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const filteredAssociations = $derived(
		associations.filter((a) =>
			a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(a.legalName && a.legalName.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	$effect(() => {
		loadAssociations();
	});
</script>

<svelte:head>
	<title>Associations | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedAssociation}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<h1 class="text-lg font-semibold">Associations</h1>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search associations..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredAssociations.length === 0}
					<div class="p-6">
						<EmptyState
							title="No associations found"
							description={searchQuery
								? 'Try adjusting your search.'
								: 'No associations have been created yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredAssociations as association}
							<button
								type="button"
								onclick={() => selectAssociation(association)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedAssociation?.id === association.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="font-medium">{association.name}</p>
										{#if association.legalName && association.legalName !== association.name}
											<p class="mt-0.5 text-sm text-surface-500">
												{association.legalName}
											</p>
										{/if}
										{#if association.unitCount !== undefined}
											<p class="mt-0.5 text-sm text-surface-500">
												{association.unitCount} units
											</p>
										{/if}
									</div>
									<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-success-500/10 text-success-500">
										{association.status}
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
		{#if selectedAssociation}
			<DetailPanel>
				{#snippet header()}
					{@const a = selectedAssociation!}
					<div>
						<h2 class="text-xl font-semibold">{a.name}</h2>
						{#if a.legalName && a.legalName !== a.name}
							<p class="mt-1 text-sm text-surface-500">{a.legalName}</p>
						{/if}
					</div>
				{/snippet}

				{#snippet actions()}
					{@const a = selectedAssociation!}
					<button
						type="button"
						onclick={() => {
							camStore.setCurrentAssociation({
								id: a.id,
								name: a.name,
								legalName: a.legalName,
								status: a.status,
								fiscalYearEnd: a.fiscalYearEnd
							});
						}}
						class="btn btn-sm preset-filled-primary-500"
					>
						Switch to This
					</button>
					<a href="/app/cam/associations/{a.id}/edit" class="btn btn-sm preset-tonal-surface">
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
			<Building2 class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select an association to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedAssociation}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Name</h3>
					<p class="mt-1">{selectedAssociation.name}</p>
				</div>
				{#if selectedAssociation.legalName}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Legal Name</h3>
						<p class="mt-1">{selectedAssociation.legalName}</p>
					</div>
				{/if}
				<div>
					<h3 class="text-sm font-medium text-surface-500">Status</h3>
					<p class="mt-1">{selectedAssociation.status}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Fiscal Year End</h3>
					<p class="mt-1">Month {selectedAssociation.fiscalYearEnd}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Created</h3>
					<p class="mt-1">{formatDate(selectedAssociation.createdAt)}</p>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Governing documents will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Activity events will appear here."
	/>
{/snippet}
