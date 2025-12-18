<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { AlertTriangle, Plus, Search, Filter, X, TrendingUp } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent, DecisionButton, RationaleModal } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { violationApi, type Violation } from '$lib/api/cam';
	import type { Snippet } from 'svelte';

	interface ViolationListItem extends Violation {
		unitNumber?: string;
		responsiblePartyName?: string;
		violationTypeName?: string;
	}

	let violations = $state<ViolationListItem[]>([]);
	let selectedViolation = $state<Violation | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('');
	let severityFilter = $state<string>('');
	let escalatedOnly = $state(false);
	let sortBy = $state<'date' | 'daysOpen'>('date');

	let showRationaleModal = $state(false);
	let rationaleAction = $state<{ type: string; label: string; variant: 'approve' | 'deny' | 'escalate' | 'default' } | null>(null);
	let isActionLoading = $state(false);
	let bulkAction = $state<string | null>(null);

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'DETECTED', label: 'Detected' },
		{ value: 'UNDER_REVIEW', label: 'Under Review' },
		{ value: 'NOTICE_SENT', label: 'Notice Sent' },
		{ value: 'OWNER_RESPONSE_PENDING', label: 'Response Pending' },
		{ value: 'CURE_PERIOD', label: 'Cure Period' },
		{ value: 'ESCALATED', label: 'Escalated' },
		{ value: 'HEARING_SCHEDULED', label: 'Hearing Scheduled' },
		{ value: 'REMEDIATION_IN_PROGRESS', label: 'Remediation' },
		{ value: 'RESOLVED', label: 'Resolved' },
		{ value: 'CLOSED', label: 'Closed' }
	];

	const severityOptions = [
		{ value: '', label: 'All Severities' },
		{ value: 'CRITICAL', label: 'Critical' },
		{ value: 'MAJOR', label: 'Major' },
		{ value: 'MODERATE', label: 'Moderate' },
		{ value: 'MINOR', label: 'Minor' }
	];

	async function loadViolations() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { status?: string; severity?: string; search?: string } = {};
			if (statusFilter) params.status = statusFilter;
			if (severityFilter) params.severity = severityFilter;
			if (searchQuery) params.search = searchQuery;

			const response = await violationApi.list(params);
			if (response.ok && response.data?.violations) {
				violations = response.data.violations;
			}
		} catch (error) {
			console.error('Failed to load violations:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectViolation(violation: Violation) {
		selectedViolation = violation;
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'CRITICAL': return 'bg-error-500 text-white';
			case 'MAJOR': return 'bg-warning-500 text-white';
			case 'MODERATE': return 'bg-yellow-500 text-black';
			case 'MINOR': return 'bg-surface-400 text-white';
			default: return 'bg-surface-300 text-surface-700';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'DETECTED': return 'text-blue-500 bg-blue-500/10';
			case 'UNDER_REVIEW': return 'text-indigo-500 bg-indigo-500/10';
			case 'NOTICE_SENT': return 'text-warning-500 bg-warning-500/10';
			case 'OWNER_RESPONSE_PENDING': return 'text-orange-500 bg-orange-500/10';
			case 'CURE_PERIOD': return 'text-yellow-600 bg-yellow-500/10';
			case 'ESCALATED': return 'text-error-600 bg-error-500/20';
			case 'HEARING_SCHEDULED': return 'text-primary-500 bg-primary-500/10';
			case 'REMEDIATION_IN_PROGRESS': return 'text-cyan-500 bg-cyan-500/10';
			case 'RESOLVED': return 'text-success-500 bg-success-500/10';
			case 'CLOSED': return 'text-surface-500 bg-surface-500/10';
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

	function getDaysOpen(dateString: string): number {
		const created = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - created.getTime());
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}

	function getDaysOpenColor(days: number): string {
		if (days <= 7) return 'text-success-500';
		if (days <= 30) return 'text-warning-500';
		return 'text-error-500';
	}

	function isEscalated(violation: Violation): boolean {
		return violation.status === 'ESCALATED' || 
			violation.status === 'HEARING_SCHEDULED' || 
			violation.status === 'HEARING_HELD';
	}

	function openRationaleModal(type: string, label: string, variant: 'approve' | 'deny' | 'escalate' | 'default') {
		rationaleAction = { type, label, variant };
		showRationaleModal = true;
	}

	async function handleRationaleConfirm(rationale: string) {
		if (!rationaleAction) return;

		isActionLoading = true;
		try {
			if (bulkAction && selectedIds.size > 0) {
				// Bulk action
				const promises = Array.from(selectedIds).map(id =>
					violationApi.recordAction(id, {
						action: rationaleAction!.type,
						notes: rationale,
						idempotencyKey: crypto.randomUUID()
					})
				);
				await Promise.all(promises);
				selectedIds = new Set();
				bulkAction = null;
			} else if (selectedViolation) {
				// Single action
				await violationApi.recordAction(selectedViolation.id, {
					action: rationaleAction.type,
					notes: rationale,
					idempotencyKey: crypto.randomUUID()
				});
			}

			await loadViolations();
			showRationaleModal = false;
			rationaleAction = null;
		} catch (error) {
			console.error('Failed to perform action:', error);
		} finally {
			isActionLoading = false;
		}
	}

	function toggleSelection(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(filteredViolations.map(v => v.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function openBulkAction(action: string, label: string, variant: 'approve' | 'deny' | 'escalate' | 'default') {
		bulkAction = action;
		rationaleAction = { type: action, label, variant };
		showRationaleModal = true;
	}

	const filteredViolations = $derived.by(() => {
		let result = violations.filter((v) => {
			// Text search
			const matchesSearch = !searchQuery || 
				v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				v.violationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(v.unitNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
			
			// Escalation filter
			const matchesEscalation = !escalatedOnly || isEscalated(v);
			
			return matchesSearch && matchesEscalation;
		});

		// Sort
		if (sortBy === 'daysOpen') {
			result = [...result].sort((a, b) => {
				const daysA = getDaysOpen(a.createdAt || a.observedDate);
				const daysB = getDaysOpen(b.createdAt || b.observedDate);
				return daysB - daysA; // Most days open first
			});
		} else {
			result = [...result].sort((a, b) => {
				const dateA = new Date(a.createdAt || a.observedDate).getTime();
				const dateB = new Date(b.createdAt || b.observedDate).getTime();
				return dateB - dateA; // Most recent first
			});
		}

		return result;
	});

	$effect(() => {
		if ($currentAssociation?.id) {
			loadViolations();
		}
	});

	$effect(() => {
		loadViolations();
	});
</script>

<svelte:head>
	<title>Violations | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedViolation}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Violations</h1>
						<a href="/app/cam/violations/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search violations..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div class="flex gap-2">
						<select
							bind:value={statusFilter}
							class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
						<select
							bind:value={severityFilter}
							class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each severityOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<div class="flex items-center justify-between gap-2">
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								bind:checked={escalatedOnly}
								class="h-4 w-4 rounded border-surface-300-700 text-error-500 focus:ring-error-500"
							/>
							<span class="flex items-center gap-1 text-surface-600">
								<TrendingUp class="h-3 w-3 text-error-500" />
								Escalated only
							</span>
						</label>
						<select
							bind:value={sortBy}
							class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="date">Sort: Recent</option>
							<option value="daysOpen">Sort: Days Open</option>
						</select>
					</div>

					{#if selectedIds.size > 0}
						<div class="flex items-center justify-between rounded-lg bg-primary-500/10 px-3 py-2">
							<span class="text-sm font-medium text-primary-700 dark:text-primary-300">
								{selectedIds.size} selected
							</span>
							<div class="flex gap-2">
								<button
									type="button"
									class="btn btn-sm preset-tonal-surface"
									onclick={deselectAll}
								>
									Clear
								</button>
								<button
									type="button"
									class="btn btn-sm preset-tonal-warning"
									onclick={() => openBulkAction('ESCALATE', `Escalate ${selectedIds.size} Violations`, 'escalate')}
								>
									Escalate
								</button>
								<button
									type="button"
									class="btn btn-sm preset-tonal-primary"
									onclick={() => openBulkAction('RESOLVE', `Resolve ${selectedIds.size} Violations`, 'approve')}
								>
									Resolve
								</button>
							</div>
						</div>
					{:else}
						<div class="flex items-center justify-between text-xs text-surface-500">
							<button type="button" class="hover:text-primary-500" onclick={selectAll}>
								Select all ({filteredViolations.length})
							</button>
						</div>
					{/if}
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredViolations.length === 0}
					<div class="p-6">
						<EmptyState
							title="No violations found"
							description={searchQuery || statusFilter || severityFilter
								? 'Try adjusting your filters.'
								: 'No violations have been reported yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredViolations as violation}
							{@const daysOpen = getDaysOpen(violation.createdAt || violation.observedDate)}
							{@const isSelected = selectedIds.has(violation.id)}
							<div class="flex items-start gap-2 px-4 py-3 transition-colors hover:bg-surface-200-800 {selectedViolation?.id === violation.id ? 'bg-primary-500/10' : ''} {isSelected ? 'bg-primary-500/5' : ''}">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleSelection(violation.id)}
									onclick={(e) => e.stopPropagation()}
									class="mt-1 h-4 w-4 rounded border-surface-300-700 text-primary-500 focus:ring-primary-500"
								/>
								<button
									type="button"
									onclick={() => selectViolation(violation)}
									class="min-w-0 flex-1 text-left"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="text-xs font-medium text-surface-500">
													{violation.violationNumber}
												</span>
												<span class="rounded px-1.5 py-0.5 text-xs font-medium {getSeverityColor(violation.severity)}">
													{violation.severity}
												</span>
												{#if isEscalated(violation)}
													<span class="flex items-center gap-0.5 text-error-500" title="Escalated">
														<TrendingUp class="h-3 w-3" />
													</span>
												{/if}
											</div>
											<p class="mt-1 truncate font-medium">{violation.title}</p>
											<p class="mt-0.5 text-sm text-surface-500">
												Unit {violation.unitNumber} · {violation.responsiblePartyName}
												{#if violation.violationTypeName}
													<span 
														class="cursor-help text-surface-400 underline decoration-dotted" 
														title="Violation Type: {violation.violationTypeName}"
													>· {violation.violationTypeName}</span>
												{/if}
											</p>
										</div>
										<div class="flex flex-col items-end gap-1">
											<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(violation.status)}">
												{violation.status.replace(/_/g, ' ')}
											</span>
											{#if !['RESOLVED', 'CLOSED'].includes(violation.status)}
												<span class="text-xs font-medium {getDaysOpenColor(daysOpen)}" title="Days open">
													{daysOpen}d
												</span>
											{/if}
										</div>
									</div>
									<p class="mt-1 text-xs text-surface-400">
										{violation.createdAt ? formatDate(violation.createdAt) : formatDate(violation.observedDate)}
									</p>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedViolation}
			<DetailPanel>
				{#snippet header()}
					{@const v = selectedViolation!}
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm text-surface-500">{v.violationNumber}</span>
							<span class="rounded px-1.5 py-0.5 text-xs font-medium {getSeverityColor(v.severity)}">
								{v.severity}
							</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(v.status)}">
								{v.status.replace(/_/g, ' ')}
							</span>
						</div>
						<h2 class="mt-1 text-xl font-semibold">{v.title}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const v = selectedViolation!}
					{#if v.status === 'OPEN'}
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openRationaleModal('SEND_NOTICE', 'Send Notice', 'default')}
						>
							Send Notice
						</DecisionButton>
					{/if}
					{#if ['OPEN', 'NOTICE_SENT', 'CURE_PERIOD'].includes(v.status)}
						<DecisionButton
							variant="escalate"
							requiresRationale
							onclick={() => openRationaleModal('ESCALATE', 'Escalate', 'escalate')}
						>
							Escalate
						</DecisionButton>
					{/if}
					{#if !['RESOLVED', 'CLOSED'].includes(v.status)}
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openRationaleModal('RESOLVE', 'Resolve', 'approve')}
						>
							Resolve
						</DecisionButton>
					{/if}
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{
								id: 'overview',
								label: 'Overview',
								content: overviewTab
							},
							{
								id: 'documents',
								label: 'Documents',
								content: documentsTab
							},
							{
								id: 'history',
								label: 'History',
								content: historyTab
							}
						]}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<AlertTriangle class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a violation to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedViolation}
		<div class="space-y-6">
			<div>
				<h3 class="text-sm font-medium text-surface-500">Description</h3>
				<p class="mt-1">{selectedViolation.description || 'No description provided.'}</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Unit</h3>
					<p class="mt-1">
						<a href="/app/cam/units/{selectedViolation.unitId}" class="text-primary-500 hover:underline">
							Unit {selectedViolation.unitNumber}
						</a>
					</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Responsible Party</h3>
					<p class="mt-1">{selectedViolation.responsiblePartyName}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Created</h3>
					<p class="mt-1">{selectedViolation.createdAt ? formatDate(selectedViolation.createdAt) : '-'}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Last Updated</h3>
					<p class="mt-1">{selectedViolation.updatedAt ? formatDate(selectedViolation.updatedAt) : '-'}</p>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Evidence and notices will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Status changes and activity will appear here."
	/>
{/snippet}

<RationaleModal
	open={showRationaleModal}
	title={rationaleAction?.label || 'Confirm Action'}
	actionLabel={rationaleAction?.label || 'Confirm'}
	actionVariant={rationaleAction?.variant || 'default'}
	loading={isActionLoading}
	onConfirm={handleRationaleConfirm}
	onCancel={() => {
		showRationaleModal = false;
		rationaleAction = null;
	}}
/>
