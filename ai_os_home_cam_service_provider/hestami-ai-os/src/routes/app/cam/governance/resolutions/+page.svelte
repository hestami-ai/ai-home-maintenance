<script lang="ts">
	import { ArrowLeft, FileCheck, Plus, Search } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { BoardMotionStatusValues, JobPaymentStatusValues, PolicyStatusValues, governanceApi } from '$lib/api/cam';

	// UI-only status for resolutions before they're formally proposed (not in Prisma enum)
	const UI_STATUS = { DRAFT: PolicyStatusValues.DRAFT, PASSED: 'PASSED', FAILED: JobPaymentStatusValues.FAILED } as const;

	interface Resolution {
		id: string;
		resolutionNumber: string;
		title: string;
		type?: 'BOARD' | 'MEMBER';
		status: string;
		proposedDate?: string;
		adoptedDate?: string;
		votedDate?: string;
		effectiveDate?: string;
		description?: string;
		votesFor?: number;
		votesAgainst?: number;
		votesAbstain?: number;
	}

	let resolutions = $state<Resolution[]>([]);
	let selectedResolution = $state<Resolution | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('all');

	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: PolicyStatusValues.DRAFT, label: 'Draft' },
		{ value: BoardMotionStatusValues.PROPOSED, label: 'Proposed' },
		{ value: 'PASSED', label: 'Passed' },
		{ value: JobPaymentStatusValues.FAILED, label: 'Failed' },
		{ value: BoardMotionStatusValues.TABLED, label: 'Tabled' }
	];

	async function loadResolutions() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await governanceApi.resolutions.list({
				status: statusFilter !== 'all' ? statusFilter as any : undefined
			});
			if (response.ok) {
				resolutions = response.data.resolutions.map(r => ({
					id: r.id,
					resolutionNumber: `RES-${r.id.slice(0, 8).toUpperCase()}`,
					title: r.title,
					status: r.status,
					proposedDate: r.createdAt ? new Date(r.createdAt).toISOString() : undefined
				}));
			}
		} catch (e) {
			console.error('Failed to load resolutions:', e);
		} finally {
			isLoading = false;
		}
	}

	function selectResolution(resolution: Resolution) {
		selectedResolution = resolution;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case UI_STATUS.PASSED: return 'text-success-500 bg-success-500/10';
			case UI_STATUS.FAILED: return 'text-error-500 bg-error-500/10';
			case BoardMotionStatusValues.PROPOSED: return 'text-primary-500 bg-primary-500/10';
			case UI_STATUS.DRAFT: return 'text-surface-500 bg-surface-500/10';
			case BoardMotionStatusValues.TABLED: return 'text-warning-500 bg-warning-500/10';
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
			loadResolutions();
		}
	});

	$effect(() => {
		statusFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadResolutions();
		}
	});
</script>

<svelte:head>
	<title>Resolutions | Governance | CAM | Hestami AI</title>
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
				<h1 class="text-xl font-semibold">Resolutions</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button class="btn btn-sm preset-filled-primary-500">
				<Plus class="mr-1 h-4 w-4" />
				New Resolution
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<SplitView hasSelection={!!selectedResolution}>
			{#snippet listPanel()}
				<ListPanel loading={isLoading}>
					{#snippet header()}
						<div class="flex gap-2">
							<div class="relative flex-1">
								<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									type="text"
									placeholder="Search resolutions..."
									bind:value={searchQuery}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
								/>
							</div>
							<select
								bind:value={statusFilter}
								class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
							>
								{#each statusOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					{/snippet}

					{#snippet items()}
						{#if resolutions.length === 0}
							<EmptyState
								title="No resolutions"
								description="Board and member resolutions will appear here."
							/>
						{:else}
							{#each resolutions as resolution}
								<button
									type="button"
									onclick={() => selectResolution(resolution)}
									class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedResolution?.id === resolution.id ? 'bg-primary-500/10' : ''}"
								>
									<div class="flex items-start justify-between">
										<div>
											<p class="text-sm text-surface-500">{resolution.resolutionNumber}</p>
											<p class="font-medium">{resolution.title}</p>
										</div>
										<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(resolution.status)}">
											{resolution.status}
										</span>
									</div>
									<p class="mt-1 text-xs text-surface-400">
										{resolution.type || 'Resolution'} · {resolution.proposedDate ? formatDate(resolution.proposedDate) : '—'}
									</p>
								</button>
							{/each}
						{/if}
					{/snippet}
				</ListPanel>
			{/snippet}

			{#snippet detailPanel()}
				{#if selectedResolution}
					{@const r = selectedResolution}
					<DetailPanel>
						{#snippet header()}
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm text-surface-500">{r.resolutionNumber}</span>
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(r.status)}">
										{r.status}
									</span>
								</div>
								<h2 class="mt-1 text-xl font-semibold">{r.title}</h2>
							</div>
						{/snippet}

						{#snippet actions()}
							{#if r.status === UI_STATUS.DRAFT}
								<button class="btn btn-sm preset-tonal-surface">
									Edit
								</button>
								<button class="btn btn-sm preset-filled-primary-500">
									Propose
								</button>
							{/if}
							{#if r.status === BoardMotionStatusValues.PROPOSED}
								<button class="btn btn-sm preset-filled-primary-500">
									Record Vote
								</button>
							{/if}
						{/snippet}

						{#snippet content()}
							<div class="space-y-6 p-6">
								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Resolution Details</h3>
									<div class="space-y-4">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Description</h4>
											<p class="mt-1">{r.description}</p>
										</div>
										<div class="grid gap-4 sm:grid-cols-2">
											<div>
												<h4 class="text-sm font-medium text-surface-500">Type</h4>
												<p class="mt-1">{r.type} Resolution</p>
											</div>
											<div>
												<h4 class="text-sm font-medium text-surface-500">Status</h4>
												<p class="mt-1">
													<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(r.status)}">
														{r.status}
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
											<h4 class="text-sm font-medium text-surface-500">Proposed</h4>
											<p class="mt-1">{r.proposedDate ? formatDate(r.proposedDate) : '—'}</p>
										</div>
										{#if r.votedDate}
											<div>
												<h4 class="text-sm font-medium text-surface-500">Voted</h4>
												<p class="mt-1">{formatDate(r.votedDate)}</p>
											</div>
										{/if}
										{#if r.effectiveDate}
											<div>
												<h4 class="text-sm font-medium text-surface-500">Effective</h4>
												<p class="mt-1">{formatDate(r.effectiveDate)}</p>
											</div>
										{/if}
									</div>
								</Card>

								{#if r.votesFor !== undefined || r.votesAgainst !== undefined}
									<Card variant="outlined" padding="lg">
										<h3 class="mb-4 font-semibold">Voting Record</h3>
										<div class="grid gap-4 sm:grid-cols-3">
											<div class="text-center">
												<p class="text-3xl font-bold text-success-500">{r.votesFor ?? 0}</p>
												<p class="text-sm text-surface-500">For</p>
											</div>
											<div class="text-center">
												<p class="text-3xl font-bold text-error-500">{r.votesAgainst ?? 0}</p>
												<p class="text-sm text-surface-500">Against</p>
											</div>
											<div class="text-center">
												<p class="text-3xl font-bold text-surface-500">{r.votesAbstain ?? 0}</p>
												<p class="text-sm text-surface-500">Abstain</p>
											</div>
										</div>
									</Card>
								{/if}
							</div>
						{/snippet}
					</DetailPanel>
				{/if}
			{/snippet}

			{#snippet emptyDetail()}
				<div class="text-center">
					<FileCheck class="mx-auto h-12 w-12 text-surface-300" />
					<p class="mt-2 text-surface-500">Select a resolution to view details</p>
				</div>
			{/snippet}
		</SplitView>
	</div>
</div>
