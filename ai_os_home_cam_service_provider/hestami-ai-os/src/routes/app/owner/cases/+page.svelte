<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Plus, Search, Filter, Briefcase } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { conciergeCaseApi, type ConciergeCase, type ConciergeCaseStatus } from '$lib/api/cam';

	let cases = $state<ConciergeCase[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>($page.url.searchParams.get('status') || '');
	let total = $state(0);
	let currentPage = $state(1);
	let pageSize = $state(20);

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'INTAKE', label: 'New' },
		{ value: 'ASSESSMENT', label: 'Under Review' },
		{ value: 'IN_PROGRESS', label: 'In Progress' },
		{ value: 'PENDING_EXTERNAL', label: 'Waiting on External' },
		{ value: 'PENDING_OWNER', label: 'Needs Your Response' },
		{ value: 'ON_HOLD', label: 'On Hold' },
		{ value: 'RESOLVED', label: 'Resolved' },
		{ value: 'CLOSED', label: 'Closed' },
		{ value: 'CANCELLED', label: 'Cancelled' }
	];

	async function loadCases() {
		isLoading = true;
		try {
			const params: {
				status?: ConciergeCaseStatus;
				page?: number;
				pageSize?: number;
			} = {
				page: currentPage,
				pageSize
			};

			if (statusFilter) {
				params.status = statusFilter as ConciergeCaseStatus;
			}

			const response = await conciergeCaseApi.list(params);
			if (response.ok && response.data) {
				cases = response.data.items;
				total = response.data.total;
			}
		} catch (error) {
			console.error('Failed to load cases:', error);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadCases();
	});

	function getStatusLabel(status: string): string {
		const option = statusOptions.find((o) => o.value === status);
		return option?.label || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			INTAKE: 'bg-blue-500/10 text-blue-500',
			ASSESSMENT: 'bg-purple-500/10 text-purple-500',
			IN_PROGRESS: 'bg-amber-500/10 text-amber-500',
			PENDING_EXTERNAL: 'bg-orange-500/10 text-orange-500',
			PENDING_OWNER: 'bg-red-500/10 text-red-500',
			ON_HOLD: 'bg-gray-500/10 text-gray-500',
			RESOLVED: 'bg-green-500/10 text-green-500',
			CLOSED: 'bg-surface-500/10 text-surface-500',
			CANCELLED: 'bg-surface-500/10 text-surface-500'
		};
		return colors[status] || 'bg-surface-500/10 text-surface-500';
	}

	function getPriorityColor(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'text-surface-500',
			NORMAL: 'text-blue-500',
			HIGH: 'text-amber-500',
			URGENT: 'text-orange-500',
			EMERGENCY: 'text-red-500'
		};
		return colors[priority] || 'text-surface-500';
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function handleStatusChange() {
		currentPage = 1;
		loadCases();
	}
</script>

<svelte:head>
	<title>My Cases | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">My Cases</h1>
				<p class="mt-1 text-surface-500">View and manage your service requests</p>
			</div>
			<a href="/app/owner/cases/new" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				New Request
			</a>
		</div>

		<!-- Filters -->
		<div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
				<input
					type="text"
					placeholder="Search cases..."
					bind:value={searchQuery}
					class="input w-full pl-10"
				/>
			</div>
			<div class="flex items-center gap-2">
				<Filter class="h-4 w-4 text-surface-500" />
				<select
					bind:value={statusFilter}
					onchange={handleStatusChange}
					class="select min-w-[180px]"
				>
					{#each statusOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Cases List -->
		<div class="mt-6">
			<Card variant="outlined" padding="none">
				{#if isLoading}
					<div class="p-8 text-center text-surface-500">Loading cases...</div>
				{:else if cases.length === 0}
					<div class="p-8">
						<EmptyState
							title="No cases found"
							description={statusFilter
								? 'No cases match your current filters. Try adjusting your filters or create a new request.'
								: "You haven't created any service requests yet. Create your first request to get started."}
						>
							{#snippet actions()}
								<a href="/app/owner/cases/new" class="btn preset-filled-primary-500">
									<Plus class="mr-2 h-4 w-4" />
									Create New Request
								</a>
							{/snippet}
						</EmptyState>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="border-b border-surface-300-700 bg-surface-100-900">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Case
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Status
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Priority
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Created
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Updated
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-300-700">
								{#each cases as caseItem}
									<tr
										class="cursor-pointer transition-colors hover:bg-surface-100-900"
										onclick={() => goto(`/app/owner/cases/${caseItem.id}`)}
									>
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
													<Briefcase class="h-5 w-5 text-primary-500" />
												</div>
												<div>
													<p class="font-medium">{caseItem.title}</p>
													<p class="text-sm text-surface-500">{caseItem.caseNumber}</p>
												</div>
											</div>
										</td>
										<td class="px-6 py-4">
											<span
												class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusColor(
													caseItem.status
												)}"
											>
												{getStatusLabel(caseItem.status)}
											</span>
										</td>
										<td class="px-6 py-4">
											<span class="text-sm font-medium {getPriorityColor(caseItem.priority)}">
												{caseItem.priority}
											</span>
										</td>
										<td class="px-6 py-4 text-sm text-surface-500">
											{formatDate(caseItem.createdAt)}
										</td>
										<td class="px-6 py-4 text-sm text-surface-500">
											{formatDate(caseItem.updatedAt)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination -->
					{#if total > pageSize}
						<div class="flex items-center justify-between border-t border-surface-300-700 px-6 py-4">
							<p class="text-sm text-surface-500">
								Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} cases
							</p>
							<div class="flex gap-2">
								<button
									class="btn preset-outlined-surface-500"
									disabled={currentPage === 1}
									onclick={() => {
										currentPage--;
										loadCases();
									}}
								>
									Previous
								</button>
								<button
									class="btn preset-outlined-surface-500"
									disabled={currentPage * pageSize >= total}
									onclick={() => {
										currentPage++;
										loadCases();
									}}
								>
									Next
								</button>
							</div>
						</div>
					{/if}
				{/if}
			</Card>
		</div>
	</div>
</PageContainer>
