<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Plus, Search, Filter, Briefcase, User, AlertCircle } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import {
		conciergeCaseApi,
		type ConciergeCase,
		type ConciergeCaseStatus,
		type ConciergeCaseDetail
	} from '$lib/api/cam';

	let cases = $state<ConciergeCase[]>([]);
	let selectedCase = $state<ConciergeCase | null>(null);
	let selectedCaseDetail = $state<ConciergeCaseDetail | null>(null);
	let isLoading = $state(true);
	let isLoadingDetail = $state(false);
	let searchQuery = $state('');
	let statusFilter = $state<string>($page.url.searchParams.get('status') || '');
	let total = $state(0);
	let currentPage = $state(1);
	let pageSize = $state(20);

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'INTAKE', label: 'Intake' },
		{ value: 'ASSESSMENT', label: 'Assessment' },
		{ value: 'IN_PROGRESS', label: 'In Progress' },
		{ value: 'PENDING_EXTERNAL', label: 'Pending External' },
		{ value: 'PENDING_OWNER', label: 'Pending Owner' },
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

				if (cases.length > 0 && !selectedCase) {
					selectCase(cases[0]);
				}
			}
		} catch (error) {
			console.error('Failed to load cases:', error);
		} finally {
			isLoading = false;
		}
	}

	async function selectCase(caseItem: ConciergeCase) {
		selectedCase = caseItem;
		isLoadingDetail = true;

		try {
			const response = await conciergeCaseApi.getDetail(caseItem.id);
			if (response.ok && response.data) {
				selectedCaseDetail = response.data;
			}
		} catch (error) {
			console.error('Failed to load case detail:', error);
		} finally {
			isLoadingDetail = false;
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
			INTAKE: 'bg-blue-500',
			ASSESSMENT: 'bg-purple-500',
			IN_PROGRESS: 'bg-amber-500',
			PENDING_EXTERNAL: 'bg-orange-500',
			PENDING_OWNER: 'bg-red-500',
			ON_HOLD: 'bg-gray-500',
			RESOLVED: 'bg-green-500',
			CLOSED: 'bg-surface-500',
			CANCELLED: 'bg-surface-400'
		};
		return colors[status] || 'bg-surface-500';
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
			day: 'numeric'
		});
	}

	function handleStatusChange() {
		currentPage = 1;
		loadCases();
	}

	function needsAttention(caseItem: ConciergeCase): boolean {
		return caseItem.status === 'INTAKE' || caseItem.status === 'PENDING_OWNER';
	}
</script>

<svelte:head>
	<title>Concierge Cases | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedCase}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading} emptyTitle="No cases found" emptyDescription="No cases match your current filters.">
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Cases</h1>
						<a href="/app/concierge/cases/new" class="btn preset-filled-primary-500 btn-sm">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
						<input
							type="text"
							placeholder="Search cases..."
							bind:value={searchQuery}
							class="input w-full pl-10 text-sm"
						/>
					</div>

					<select
						bind:value={statusFilter}
						onchange={handleStatusChange}
						class="select w-full text-sm"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if cases.length === 0}
					<div class="p-4">
						<EmptyState title="No cases found" description="No cases match your current filters." />
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each cases as caseItem}
							<button
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-100-900 {selectedCase?.id ===
								caseItem.id
									? 'bg-primary-500/10'
									: ''}"
								onclick={() => selectCase(caseItem)}
							>
								<div class="flex items-start gap-3">
									<div class="relative mt-1">
										<div class="h-2 w-2 rounded-full {getStatusColor(caseItem.status)}"></div>
										{#if needsAttention(caseItem)}
											<div class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center justify-between gap-2">
											<p class="truncate font-medium text-sm">{caseItem.title}</p>
											<span class="shrink-0 text-xs text-surface-500">
												{formatDate(caseItem.createdAt)}
											</span>
										</div>
										<p class="mt-0.5 text-xs text-surface-500">{caseItem.caseNumber}</p>
										<div class="mt-1 flex items-center gap-2">
											<span
												class="inline-flex items-center rounded px-1.5 py-0.5 text-xs {getStatusColor(
													caseItem.status
												)}/10"
											>
												{getStatusLabel(caseItem.status)}
											</span>
											<span class="text-xs {getPriorityColor(caseItem.priority)}">
												{caseItem.priority}
											</span>
										</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		<DetailPanel>
			{#snippet header()}
				{#if selectedCaseDetail}
					<div>
						<h2 class="text-lg font-bold truncate">{selectedCaseDetail.case.title}</h2>
						<p class="text-sm text-surface-500">{selectedCaseDetail.case.caseNumber}</p>
					</div>
				{/if}
			{/snippet}

			{#snippet actions()}
				{#if selectedCaseDetail}
					<a
						href="/app/concierge/cases/{selectedCaseDetail.case.id}"
						class="btn preset-outlined-primary-500 btn-sm"
					>
						Open Full View
					</a>
				{/if}
			{/snippet}

			{#snippet content()}
				{#if !selectedCase}
					<div class="flex h-full items-center justify-center p-6">
						<EmptyState
							title="Select a case"
							description="Choose a case from the list to view details."
						/>
					</div>
				{:else if isLoadingDetail}
					<div class="flex h-full items-center justify-center">
						<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
					</div>
				{:else if selectedCaseDetail}
					<div class="p-6 space-y-6">
						<!-- Status & Priority -->
						<div class="flex flex-wrap items-center gap-3">
							<span
								class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {getStatusColor(
									selectedCaseDetail.case.status
								)}/10"
							>
								{getStatusLabel(selectedCaseDetail.case.status)}
							</span>
							<span class="text-sm {getPriorityColor(selectedCaseDetail.case.priority)}">
								{selectedCaseDetail.case.priority} Priority
							</span>
							{#if selectedCaseDetail.case.assignedConciergeName}
								<span class="flex items-center gap-1 text-sm text-surface-500">
									<User class="h-4 w-4" />
									{selectedCaseDetail.case.assignedConciergeName}
								</span>
							{/if}
						</div>

						<!-- Property Info -->
						<div>
							<h3 class="text-sm font-medium text-surface-500">Property</h3>
							<p class="mt-1 font-medium">{selectedCaseDetail.property.name}</p>
							<p class="text-sm text-surface-500">{selectedCaseDetail.property.addressLine1}</p>
						</div>

						<!-- Description -->
						<div>
							<h3 class="text-sm font-medium text-surface-500">Description</h3>
							<p class="mt-1 whitespace-pre-wrap text-sm">{selectedCaseDetail.case.description}</p>
						</div>

						<!-- Pending Owner Response Alert -->
						{#if selectedCaseDetail.case.status === 'PENDING_OWNER'}
							<div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
								<div class="flex items-center gap-3">
									<AlertCircle class="h-5 w-5 text-amber-500" />
									<div>
										<p class="font-medium text-amber-600 dark:text-amber-400">
											Waiting for Owner Response
										</p>
										<p class="text-sm text-surface-500">
											A clarification request has been sent to the owner.
										</p>
									</div>
								</div>
							</div>
						{/if}

						<!-- Recent Notes -->
						{#if selectedCaseDetail.notes.length > 0}
							<div>
								<h3 class="text-sm font-medium text-surface-500">Recent Activity</h3>
								<div class="mt-2 space-y-3">
									{#each selectedCaseDetail.notes.slice(0, 3) as note}
										<div class="rounded-lg bg-surface-100-900 p-3">
											<div class="flex items-center justify-between">
												<span class="text-xs font-medium text-surface-500">
													{note.noteType === 'CLARIFICATION_REQUEST'
														? 'Clarification Request'
														: note.noteType === 'CLARIFICATION_RESPONSE'
															? 'Owner Response'
															: 'Note'}
												</span>
												<span class="text-xs text-surface-500">
													{formatDate(note.createdAt)}
												</span>
											</div>
											<p class="mt-1 text-sm">{note.content}</p>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Quick Actions -->
						<div class="pt-4 border-t border-surface-300-700">
							<a
								href="/app/concierge/cases/{selectedCaseDetail.case.id}"
								class="btn preset-filled-primary-500 w-full"
							>
								Manage Case
							</a>
						</div>
					</div>
				{/if}
			{/snippet}
		</DetailPanel>
	{/snippet}
</SplitView>
