<script lang="ts">
	import { ArrowLeft, DollarSign, Search, Filter } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { accountingApi } from '$lib/api/cam';

	interface Assessment {
		id: string;
		unitId: string;
		unitNumber: string;
		ownerName: string;
		type: string;
		amount: number;
		dueDate: string;
		status: string;
		paidAmount: number;
		createdAt: string;
	}

	let assessments = $state<Assessment[]>([]);
	let selectedAssessment = $state<Assessment | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('all');

	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'DUE', label: 'Due' },
		{ value: 'OVERDUE', label: 'Overdue' },
		{ value: 'PARTIAL', label: 'Partial' },
		{ value: 'PAID', label: 'Paid' }
	];

	async function loadAssessments() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await accountingApi.assessments.listCharges({
				status: statusFilter !== 'all' ? statusFilter as any : undefined
			});
			if (response.ok) {
				assessments = response.data.charges as any;
			}
		} catch (e) {
			console.error('Failed to load assessments:', e);
		} finally {
			isLoading = false;
		}
	}

	function selectAssessment(assessment: Assessment) {
		selectedAssessment = assessment;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'PAID': return 'text-success-500 bg-success-500/10';
			case 'DUE': return 'text-warning-500 bg-warning-500/10';
			case 'OVERDUE': return 'text-error-500 bg-error-500/10';
			case 'PARTIAL': return 'text-yellow-600 bg-yellow-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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
			loadAssessments();
		}
	});

	$effect(() => {
		statusFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadAssessments();
		}
	});
</script>

<svelte:head>
	<title>Assessments | Accounting | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/accounting')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Assessments</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<SplitView hasSelection={!!selectedAssessment}>
			{#snippet listPanel()}
				<ListPanel loading={isLoading}>
					{#snippet header()}
						<div class="flex gap-2">
							<div class="relative flex-1">
								<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									type="text"
									placeholder="Search by unit or owner..."
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
						{#if assessments.length === 0}
							<EmptyState
								title="No assessments"
								description="Assessment charges will appear here."
							/>
						{:else}
							{#each assessments as assessment}
								<button
									type="button"
									onclick={() => selectAssessment(assessment)}
									class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedAssessment?.id === assessment.id ? 'bg-primary-500/10' : ''}"
								>
									<div class="flex items-start justify-between">
										<div>
											<p class="font-medium">Unit {assessment.unitNumber}</p>
											<p class="text-sm text-surface-500">{assessment.ownerName}</p>
										</div>
										<div class="text-right">
											<p class="font-medium">{formatCurrency(assessment.amount)}</p>
											<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(assessment.status)}">
												{assessment.status}
											</span>
										</div>
									</div>
									<p class="mt-1 text-xs text-surface-400">
										Due: {formatDate(assessment.dueDate)}
									</p>
								</button>
							{/each}
						{/if}
					{/snippet}
				</ListPanel>
			{/snippet}

			{#snippet detailPanel()}
				{#if selectedAssessment}
					{@const a = selectedAssessment}
					<DetailPanel>
						{#snippet header()}
							<div>
								<p class="text-sm text-surface-500">Unit {a.unitNumber}</p>
								<h2 class="mt-1 text-xl font-semibold">{a.type} Assessment</h2>
							</div>
						{/snippet}

						{#snippet actions()}
							<button class="btn btn-sm preset-filled-primary-500">
								Record Payment
							</button>
						{/snippet}

						{#snippet content()}
							<div class="space-y-6 p-6">
								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Assessment Details</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Amount Due</h4>
											<p class="mt-1 text-xl font-bold">{formatCurrency(a.amount)}</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Amount Paid</h4>
											<p class="mt-1 text-xl font-bold text-success-500">{formatCurrency(a.paidAmount)}</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Balance</h4>
											<p class="mt-1 text-xl font-bold {a.amount - a.paidAmount > 0 ? 'text-error-500' : 'text-success-500'}">
												{formatCurrency(a.amount - a.paidAmount)}
											</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Status</h4>
											<p class="mt-1">
												<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(a.status)}">
													{a.status}
												</span>
											</p>
										</div>
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Owner Information</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Unit</h4>
											<p class="mt-1">
												<a href="/app/cam/units/{a.unitId}" class="text-primary-500 hover:underline">
													Unit {a.unitNumber}
												</a>
											</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Owner</h4>
											<p class="mt-1">{a.ownerName}</p>
										</div>
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Timeline</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Due Date</h4>
											<p class="mt-1">{formatDate(a.dueDate)}</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Created</h4>
											<p class="mt-1">{formatDate(a.createdAt)}</p>
										</div>
									</div>
								</Card>
							</div>
						{/snippet}
					</DetailPanel>
				{/if}
			{/snippet}

			{#snippet emptyDetail()}
				<div class="text-center">
					<DollarSign class="mx-auto h-12 w-12 text-surface-300" />
					<p class="mt-2 text-surface-500">Select an assessment to view details</p>
				</div>
			{/snippet}
		</SplitView>
	</div>
</div>
