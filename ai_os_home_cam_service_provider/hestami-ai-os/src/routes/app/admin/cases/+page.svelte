<script lang="ts">
	import { ActivityEntityTypeValues, ConciergeCaseStatusValues, JobStatusValues, ViolationStatusValues } from '$lib/api/cam';
	import {
		Briefcase,
		Search,
		Filter,
		Loader2,
		RefreshCw,
		Clock,
		User,
		AlertTriangle,
		ChevronRight
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { invalidate } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	// Get data from server load function
	let { data } = $props();
	// Use $state with $effect to sync data - track data reference but read properties safely
	let cases = $state<any[]>([]);

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			cases = data.cases ?? [];
		}
	});

	let isRefreshing = $state(false);
	let searchQuery = $state('');
	let statusFilter = $state($page.url.searchParams.get('status') || '');

	async function refresh() {
		isRefreshing = true;
		try {
			await invalidate('data');
		} finally {
			isRefreshing = false;
		}
	}

	async function onStatusChange() {
		// Navigate with query param to trigger server reload
		const params = new URLSearchParams();
		if (statusFilter) params.set('status', statusFilter);
		await goto(`/app/admin/cases?${params.toString()}`, { invalidateAll: true });
	}


	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			INTAKE: 'Intake',
			ASSESSMENT: 'Assessment',
			IN_PROGRESS: 'In Progress',
			PENDING_EXTERNAL: 'Pending External',
			PENDING_OWNER: 'Pending Owner',
			ON_HOLD: 'On Hold',
			RESOLVED: 'Resolved',
			CLOSED: 'Closed',
			CANCELLED: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			INTAKE: 'preset-filled-primary-500',
			ASSESSMENT: 'preset-filled-secondary-500',
			IN_PROGRESS: 'preset-filled-warning-500',
			PENDING_EXTERNAL: 'preset-filled-tertiary-500',
			PENDING_OWNER: 'preset-filled-error-500',
			ON_HOLD: 'preset-filled-surface-500',
			RESOLVED: 'preset-filled-success-500',
			CLOSED: 'preset-outlined-surface-500',
			CANCELLED: 'preset-outlined-surface-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getPriorityColor(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'preset-outlined-surface-500',
			NORMAL: 'preset-outlined-primary-500',
			HIGH: 'preset-filled-warning-500',
			URGENT: 'preset-filled-error-500',
			EMERGENCY: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-outlined-surface-500';
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	const filteredCases = $derived(
		cases.filter((c) => {
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					c.title.toLowerCase().includes(query) ||
					c.caseNumber.toLowerCase().includes(query)
				);
			}
			return true;
		})
	);

	const statuses = [
		{ value: '', label: 'All Statuses' },
		{ value: ConciergeCaseStatusValues.INTAKE, label: 'Intake' },
		{ value: ActivityEntityTypeValues.ASSESSMENT, label: 'Assessment' },
		{ value: JobStatusValues.IN_PROGRESS, label: 'In Progress' },
		{ value: ConciergeCaseStatusValues.PENDING_EXTERNAL, label: 'Pending External' },
		{ value: ConciergeCaseStatusValues.PENDING_OWNER, label: 'Pending Owner' },
		{ value: JobStatusValues.ON_HOLD, label: 'On Hold' },
		{ value: ViolationStatusValues.RESOLVED, label: 'Resolved' },
		{ value: JobStatusValues.CLOSED, label: 'Closed' }
	];
</script>

<svelte:head>
	<title>Cases | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Cases</h1>
				<p class="mt-1 text-surface-500">All concierge cases across the platform</p>
			</div>
			<button onclick={refresh} class="btn preset-outlined-primary-500" disabled={isRefreshing}>
				{#if isRefreshing}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Refresh
			</button>
		</div>

		<!-- Filters -->
		<div class="mt-6 flex flex-wrap gap-4">
			<div class="flex-1 min-w-[200px]">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search cases..."
						class="input w-full pl-10"
					/>
				</div>
			</div>
			<div>
				<select bind:value={statusFilter} onchange={onStatusChange} class="select">
					{#each statuses as status}
						<option value={status.value}>{status.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="mt-6">
			{#if filteredCases.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No cases found"
						description={searchQuery ? 'Try adjusting your search criteria.' : 'No cases match the selected filters.'}
					>
						{#snippet actions()}
							<button onclick={() => { searchQuery = ''; statusFilter = ''; refresh(); }} class="btn preset-outlined-primary-500">
								Clear Filters
							</button>
						{/snippet}
					</EmptyState>
				</Card>
			{:else}
				<div class="space-y-3">
					{#each filteredCases as caseItem}
						<a
							href="/app/admin/cases/{caseItem.id}"
							class="block rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 transition-all hover:border-primary-500 hover:shadow-md"
						>
							<div class="flex items-start gap-4">
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
									<Briefcase class="h-5 w-5 text-surface-500" />
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="text-xs font-medium text-surface-500">{caseItem.caseNumber}</span>
										<span class="badge {getStatusColor(caseItem.status)} text-xs">
											{getStatusLabel(caseItem.status)}
										</span>
										<span class="badge {getPriorityColor(caseItem.priority)} text-xs">
											{caseItem.priority}
										</span>
									</div>
									<h3 class="mt-1 font-medium">{caseItem.title}</h3>
																		<div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-400">
										<span class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{formatDate(caseItem.createdAt)}
										</span>
										{#if caseItem.assignedConciergeName}
											<span class="flex items-center gap-1">
												<User class="h-3 w-3" />
												{caseItem.assignedConciergeName}
											</span>
										{:else}
											<span class="flex items-center gap-1 text-warning-500">
												<AlertTriangle class="h-3 w-3" />
												Unassigned
											</span>
										{/if}
									</div>
								</div>

								<ChevronRight class="h-5 w-5 flex-shrink-0 text-surface-400" />
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
