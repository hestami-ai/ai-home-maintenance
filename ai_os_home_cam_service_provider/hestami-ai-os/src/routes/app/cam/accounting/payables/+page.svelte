<script lang="ts">
	import { ArrowLeft, TrendingUp, Search, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { accountingApi, InvoiceStatusValues } from '$lib/api/cam';

	interface Payable {
		id: string;
		vendorId: string;
		vendorName: string;
		invoiceNumber: string;
		description: string;
		amount: number;
		dueDate: string;
		status: string;
		createdAt: string;
	}

	let payables = $state<Payable[]>([]);
	let selectedPayable = $state<Payable | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('all');

	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: InvoiceStatusValues.PENDING_APPROVAL, label: 'Pending Approval' },
		{ value: InvoiceStatusValues.APPROVED, label: 'Approved' },
		{ value: InvoiceStatusValues.PARTIALLY_PAID, label: 'Partially Paid' },
		{ value: InvoiceStatusValues.PAID, label: 'Paid' }
	];

	async function loadPayables() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await accountingApi.apInvoices.list({
				status: statusFilter !== 'all' ? statusFilter as any : undefined
			});
			if (response.ok) {
				payables = response.data.invoices as any;
			}
		} catch (e) {
			console.error('Failed to load payables:', e);
		} finally {
			isLoading = false;
		}
	}

	function selectPayable(payable: Payable) {
		selectedPayable = payable;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case InvoiceStatusValues.PAID: return 'text-success-500 bg-success-500/10';
			case InvoiceStatusValues.PENDING_APPROVAL: return 'text-warning-500 bg-warning-500/10';
			case InvoiceStatusValues.APPROVED: return 'text-primary-500 bg-primary-500/10';
			case InvoiceStatusValues.PARTIALLY_PAID: return 'text-warning-500 bg-warning-500/10';
			case InvoiceStatusValues.VOIDED: return 'text-error-500 bg-error-500/10';
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
			loadPayables();
		}
	});

	$effect(() => {
		statusFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadPayables();
		}
	});
</script>

<svelte:head>
	<title>Payables | Accounting | CAM | Hestami AI</title>
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
				<h1 class="text-xl font-semibold">Accounts Payable</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button class="btn btn-sm preset-filled-primary-500">
				<Plus class="mr-1 h-4 w-4" />
				New Invoice
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<SplitView hasSelection={!!selectedPayable}>
			{#snippet listPanel()}
				<ListPanel loading={isLoading}>
					{#snippet header()}
						<div class="flex gap-2">
							<div class="relative flex-1">
								<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									type="text"
									placeholder="Search vendor or invoice..."
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
						{#if payables.length === 0}
							<EmptyState
								title="No invoices"
								description="AP invoices will appear here."
							/>
						{:else}
							{#each payables as payable}
								<button
									type="button"
									onclick={() => selectPayable(payable)}
									class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedPayable?.id === payable.id ? 'bg-primary-500/10' : ''}"
								>
									<div class="flex items-start justify-between">
										<div>
											<p class="font-medium">{payable.vendorName}</p>
											<p class="text-sm text-surface-500">#{payable.invoiceNumber}</p>
										</div>
										<div class="text-right">
											<p class="font-medium">{formatCurrency(payable.amount)}</p>
											<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(payable.status)}">
												{payable.status}
											</span>
										</div>
									</div>
									<p class="mt-1 text-xs text-surface-400">
										Due: {formatDate(payable.dueDate)}
									</p>
								</button>
							{/each}
						{/if}
					{/snippet}
				</ListPanel>
			{/snippet}

			{#snippet detailPanel()}
				{#if selectedPayable}
					{@const p = selectedPayable}
					<DetailPanel>
						{#snippet header()}
							<div>
								<p class="text-sm text-surface-500">Invoice #{p.invoiceNumber}</p>
								<h2 class="mt-1 text-xl font-semibold">{p.vendorName}</h2>
							</div>
						{/snippet}

						{#snippet actions()}
							{#if p.status === InvoiceStatusValues.PENDING_APPROVAL}
								<button class="btn btn-sm preset-filled-primary-500">
									Approve
								</button>
							{/if}
							{#if p.status === InvoiceStatusValues.APPROVED}
								<button class="btn btn-sm preset-filled-success-500">
									Mark Paid
								</button>
							{/if}
						{/snippet}

						{#snippet content()}
							<div class="space-y-6 p-6">
								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Invoice Details</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Amount</h4>
											<p class="mt-1 text-xl font-bold">{formatCurrency(p.amount)}</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Status</h4>
											<p class="mt-1">
												<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(p.status)}">
													{p.status}
												</span>
											</p>
										</div>
										<div class="sm:col-span-2">
											<h4 class="text-sm font-medium text-surface-500">Description</h4>
											<p class="mt-1">{p.description}</p>
										</div>
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Vendor</h3>
									<div>
										<h4 class="text-sm font-medium text-surface-500">Vendor Name</h4>
										<p class="mt-1">
											<a href="/app/cam/vendors/{p.vendorId}" class="text-primary-500 hover:underline">
												{p.vendorName}
											</a>
										</p>
									</div>
								</Card>

								<Card variant="outlined" padding="lg">
									<h3 class="mb-4 font-semibold">Timeline</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-sm font-medium text-surface-500">Due Date</h4>
											<p class="mt-1">{formatDate(p.dueDate)}</p>
										</div>
										<div>
											<h4 class="text-sm font-medium text-surface-500">Invoice Date</h4>
											<p class="mt-1">{formatDate(p.createdAt)}</p>
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
					<TrendingUp class="mx-auto h-12 w-12 text-surface-300" />
					<p class="mt-2 text-surface-500">Select an invoice to view details</p>
				</div>
			{/snippet}
		</SplitView>
	</div>
</div>
