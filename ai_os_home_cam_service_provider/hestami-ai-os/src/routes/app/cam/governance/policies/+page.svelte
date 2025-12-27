<script lang="ts">
	import { ArrowLeft, BookOpen, Plus, Search, Download } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { governanceApi } from '$lib/api/cam';

	interface Policy {
		id: string;
		title: string;
		category: string;
		version: string;
		status: string;
		effectiveDate: string;
		lastReviewedDate?: string;
		nextReviewDate?: string;
		summary?: string;
		documentId?: string;
	}

	let policies = $state<Policy[]>([]);
	let selectedPolicy = $state<Policy | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let categoryFilter = $state('all');

	const categoryOptions = [
		{ value: 'all', label: 'All Categories' },
		{ value: 'ARCHITECTURAL', label: 'Architectural' },
		{ value: 'FINANCIAL', label: 'Financial' },
		{ value: 'ENFORCEMENT', label: 'Enforcement' },
		{ value: 'OPERATIONAL', label: 'Operational' },
		{ value: 'GOVERNANCE', label: 'Governance' },
		{ value: 'OTHER', label: 'Other' }
	];

	async function loadPolicies() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await governanceApi.resolutions.list({
				status: categoryFilter !== 'all' ? categoryFilter as any : undefined
			});
			if (response.ok) {
				policies = response.data.resolutions as any;
			}
		} catch (e) {
			console.error('Failed to load policies:', e);
		} finally {
			isLoading = false;
		}
	}

	function selectPolicy(policy: Policy) {
		selectedPolicy = policy;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'ACTIVE': return 'text-success-500 bg-success-500/10';
			case 'DRAFT': return 'text-warning-500 bg-warning-500/10';
			case 'SUPERSEDED': return 'text-surface-500 bg-surface-500/10';
			case 'ARCHIVED': return 'text-surface-400 bg-surface-400/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadPolicies();
		}
	});

	$effect(() => {
		categoryFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadPolicies();
		}
	});
</script>

<svelte:head>
	<title>Policies | Governance | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/governance')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Policies</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button class="btn btn-sm preset-filled-primary-500">
				<Plus class="mr-1 h-4 w-4" />
				New Policy
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<SplitView hasSelection={!!selectedPolicy}>
			{#snippet listPanel()}
				<ListPanel loading={isLoading}>
					{#snippet header()}
						<div class="flex gap-2">
							<div class="relative flex-1">
								<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									type="text"
									placeholder="Search policies..."
									bind:value={searchQuery}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
								/>
							</div>
							<select
								bind:value={categoryFilter}
								class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
							>
								{#each categoryOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					{/snippet}

					{#snippet items()}
						{#if policies.length === 0}
							<EmptyState
								title="No policies"
								description="Association policies will appear here."
							/>
						{:else}
							{#each policies as policy}
								<button
									type="button"
									onclick={() => selectPolicy(policy)}
									class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedPolicy?.id === policy.id ? 'bg-primary-500/10' : ''}"
								>
									<div class="flex items-start justify-between">
										<div>
											<p class="font-medium">{policy.title}</p>
											<p class="text-sm text-surface-500">{policy.category}</p>
										</div>
										<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(policy.status)}">
											{policy.status}
										</span>
									</div>
									<p class="mt-1 text-xs text-surface-400">
										v{policy.version} · Effective {formatDate(policy.effectiveDate)}
									</p>
								</button>
							{/each}
						{/if}
					{/snippet}
				</ListPanel>
			{/snippet}

			{#snippet detailPanel()}
				{#if selectedPolicy}
					{@const p = selectedPolicy}
					<DetailPanel>
						{#snippet header()}
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm text-surface-500">{p.category}</span>
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(p.status)}">
										{p.status}
									</span>
								</div>
								<h2 class="mt-1 text-xl font-semibold">{p.title}</h2>
							</div>
						{/snippet}

						{#snippet actions()}
							{#if p.documentId}
								<a href="/api/document/{p.documentId}/download" class="btn btn-sm preset-filled-primary-500">
									<Download class="mr-1 h-4 w-4" />
									Download
								</a>
							{/if}
							<button class="btn btn-sm preset-tonal-surface">
								Edit
							</button>
						{/snippet}

						{#snippet content()}
							<div class="space-y-6 p-6">
								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Policy Details</h3>
									<div class="space-y-4">
										{#if p.summary}
											<div>
												<h4 class="text-sm font-medium text-surface-500">Summary</h4>
												<p class="mt-1">{p.summary}</p>
											</div>
										{/if}
										<div class="grid gap-4 sm:grid-cols-2">
											<div>
												<h4 class="text-sm font-medium text-surface-500">Category</h4>
												<p class="mt-1">{p.category}</p>
											</div>
											<div>
												<h4 class="text-sm font-medium text-surface-500">Version</h4>
												<p class="mt-1">v{p.version}</p>
											</div>
											<div>
												<h4 class="text-sm font-medium text-surface-500">Status</h4>
												<p class="mt-1">
													<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(p.status)}">
														{p.status}
													</span>
												</p>
											</div>
										</div>
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Timeline</h3>
									<div class="grid gap-4 sm:grid-cols-3">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Effective Date</h4>
											<p class="mt-1">{formatDate(p.effectiveDate)}</p>
										</div>
										{#if p.lastReviewedDate}
											<div>
												<h4 class="text-sm font-medium text-surface-500">Last Reviewed</h4>
												<p class="mt-1">{formatDate(p.lastReviewedDate)}</p>
											</div>
										{/if}
										{#if p.nextReviewDate}
											<div>
												<h4 class="text-sm font-medium text-surface-500">Next Review</h4>
												<p class="mt-1">{formatDate(p.nextReviewDate)}</p>
											</div>
										{/if}
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Version History</h3>
									<EmptyState
										title="No version history"
										description="Previous versions will appear here."
									/>
								</Card>
							</div>
						{/snippet}
					</DetailPanel>
				{/if}
			{/snippet}

			{#snippet emptyDetail()}
				<div class="text-center">
					<BookOpen class="mx-auto h-12 w-12 text-surface-300" />
					<p class="mt-2 text-surface-500">Select a policy to view details</p>
				</div>
			{/snippet}
		</SplitView>
	</div>
</div>
