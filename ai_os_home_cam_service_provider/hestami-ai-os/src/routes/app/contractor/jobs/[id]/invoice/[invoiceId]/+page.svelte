<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
		ArrowLeft,
		Loader2,
		Send,
		DollarSign,
		Receipt,
		CheckCircle2,
		XCircle,
		Clock,
		CreditCard,
		Plus
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { invoiceApi, jobApi, type JobInvoice, type Job } from '$lib/api/cam';

	const jobId = $derived($page.params.id ?? '');
	const invoiceId = $derived($page.params.invoiceId ?? '');
	const actionParam = $derived($page.url.searchParams.get('action'));

	let job = $state<Job | null>(null);
	let invoice = $state<JobInvoice | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isSending = $state(false);

	// Payment form
	let showPaymentForm = $state(false);
	let paymentAmount = $state(0);
	let paymentMethod = $state('');
	let paymentReference = $state('');
	let paymentNotes = $state('');
	let isRecordingPayment = $state(false);

	onMount(async () => {
		await loadData();
		// Auto-show payment form if action=payment in URL
		if (actionParam === 'payment') {
			showPaymentForm = true;
		}
	});

	async function loadData() {
		if (!jobId || !invoiceId) return;
		isLoading = true;
		error = null;
		try {
			const [jobRes, invoiceRes] = await Promise.all([
				jobApi.get(jobId),
				invoiceApi.get(invoiceId)
			]);

			if (jobRes.ok && jobRes.data) {
				job = jobRes.data.job;
			}

			if (!invoiceRes.ok) {
				error = 'Failed to load invoice';
				return;
			}
			invoice = invoiceRes.data.invoice;
			paymentAmount = Number(invoice.balanceDue);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			isLoading = false;
		}
	}

	async function sendInvoice() {
		if (!invoice) return;
		isSending = true;
		try {
			const response = await invoiceApi.send({
				id: invoice.id,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				invoice = response.data.invoice;
			}
		} catch (e) {
			console.error('Failed to send invoice:', e);
		} finally {
			isSending = false;
		}
	}

	async function recordPayment() {
		if (!invoice || paymentAmount <= 0) return;
		isRecordingPayment = true;
		try {
			const response = await invoiceApi.recordPayment({
				id: invoice.id,
				amount: paymentAmount,
				paymentMethod: paymentMethod || undefined,
				referenceNumber: paymentReference || undefined,
				notes: paymentNotes || undefined,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				invoice = response.data.invoice;
				showPaymentForm = false;
				paymentAmount = Number(invoice.balanceDue);
				paymentMethod = '';
				paymentReference = '';
				paymentNotes = '';
			}
		} catch (e) {
			console.error('Failed to record payment:', e);
		} finally {
			isRecordingPayment = false;
		}
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			DRAFT: 'preset-filled-surface-500',
			SENT: 'preset-filled-primary-500',
			VIEWED: 'preset-filled-secondary-500',
			PARTIAL: 'preset-filled-warning-500',
			PAID: 'preset-filled-success-500',
			OVERDUE: 'preset-filled-error-500',
			VOID: 'preset-outlined-surface-500',
			REFUNDED: 'preset-outlined-error-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function formatCurrency(value: string | number): string {
		return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const paymentMethods = [
		{ value: 'CASH', label: 'Cash' },
		{ value: 'CHECK', label: 'Check' },
		{ value: 'CREDIT_CARD', label: 'Credit Card' },
		{ value: 'DEBIT_CARD', label: 'Debit Card' },
		{ value: 'BANK_TRANSFER', label: 'Bank Transfer' },
		{ value: 'OTHER', label: 'Other' }
	];
</script>

<svelte:head>
	<title>{invoice?.invoiceNumber || 'Invoice'} | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
		</div>
	{:else if error || !invoice}
		<Card variant="outlined" padding="lg">
			<div class="text-center">
				<p class="text-error-500">{error || 'Invoice not found'}</p>
				<a href="/app/contractor/jobs/{jobId}" class="btn preset-outlined-primary-500 mt-4">
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back to Job
				</a>
			</div>
		</Card>
	{:else}
		<div class="space-y-6">
			<!-- Header -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-start gap-4">
					<a href="/app/contractor/jobs/{jobId}" class="btn btn-icon preset-outlined-surface-500 mt-1">
						<ArrowLeft class="h-4 w-4" />
					</a>
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm text-surface-500">{invoice.invoiceNumber}</span>
							<span class="badge {getStatusColor(invoice.status)}">{invoice.status}</span>
						</div>
						<h1 class="mt-1 text-2xl font-bold">Invoice</h1>
						{#if job}
							<p class="mt-1 text-surface-500">{job.title}</p>
						{/if}
					</div>
				</div>

				<!-- Actions -->
				<div class="flex gap-2">
					{#if invoice.status === 'DRAFT'}
						<button
							onclick={sendInvoice}
							disabled={isSending}
							class="btn preset-filled-primary-500"
						>
							{#if isSending}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Send class="mr-2 h-4 w-4" />
							{/if}
							Send to Customer
						</button>
					{/if}
					{#if ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'].includes(invoice.status) && Number(invoice.balanceDue) > 0}
						<button
							onclick={() => showPaymentForm = !showPaymentForm}
							class="btn preset-filled-success-500"
						>
							<CreditCard class="mr-2 h-4 w-4" />
							Record Payment
						</button>
					{/if}
				</div>
			</div>

			<!-- Payment Form -->
			{#if showPaymentForm}
				<Card variant="outlined" padding="md" class="border-success-500">
					<h3 class="font-medium mb-4">Record Payment</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="paymentAmount" class="label mb-1 text-sm">Amount</label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
								<input
									id="paymentAmount"
									type="number"
									bind:value={paymentAmount}
									min="0.01"
									max={Number(invoice.balanceDue)}
									step="0.01"
									class="input w-full pl-7"
								/>
							</div>
							<p class="text-xs text-surface-400 mt-1">Balance due: {formatCurrency(invoice.balanceDue)}</p>
						</div>
						<div>
							<label for="paymentMethod" class="label mb-1 text-sm">Payment Method</label>
							<select id="paymentMethod" bind:value={paymentMethod} class="select w-full">
								<option value="">Select method...</option>
								{#each paymentMethods as method}
									<option value={method.value}>{method.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="paymentReference" class="label mb-1 text-sm">Reference Number</label>
							<input
								id="paymentReference"
								type="text"
								bind:value={paymentReference}
								placeholder="Check #, transaction ID, etc."
								class="input w-full"
							/>
						</div>
						<div>
							<label for="paymentNotes" class="label mb-1 text-sm">Notes</label>
							<input
								id="paymentNotes"
								type="text"
								bind:value={paymentNotes}
								placeholder="Optional notes"
								class="input w-full"
							/>
						</div>
					</div>
					<div class="mt-4 flex justify-end gap-2">
						<button onclick={() => showPaymentForm = false} class="btn preset-outlined-surface-500">
							Cancel
						</button>
						<button
							onclick={recordPayment}
							disabled={paymentAmount <= 0 || isRecordingPayment}
							class="btn preset-filled-success-500"
						>
							{#if isRecordingPayment}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<CheckCircle2 class="mr-2 h-4 w-4" />
							{/if}
							Record Payment
						</button>
					</div>
				</Card>
			{/if}

			<!-- Summary Cards -->
			<div class="grid gap-4 sm:grid-cols-3">
				<Card variant="outlined" padding="md">
					<div class="text-sm text-surface-500">Total Amount</div>
					<div class="text-2xl font-bold">{formatCurrency(invoice.totalAmount)}</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="text-sm text-surface-500">Amount Paid</div>
					<div class="text-2xl font-bold text-success-500">{formatCurrency(invoice.amountPaid)}</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="text-sm text-surface-500">Balance Due</div>
					<div class="text-2xl font-bold {Number(invoice.balanceDue) > 0 ? 'text-warning-500' : 'text-success-500'}">
						{formatCurrency(invoice.balanceDue)}
					</div>
				</Card>
			</div>

			<!-- Line Items -->
			<Card variant="outlined" padding="none">
				<div class="border-b border-surface-300-700 px-6 py-4">
					<h2 class="font-semibold">Line Items</h2>
				</div>

				{#if invoice.lines && invoice.lines.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-surface-100-900 text-xs uppercase text-surface-500">
								<tr>
									<th class="px-6 py-3 text-left">Description</th>
									<th class="px-6 py-3 text-right">Qty</th>
									<th class="px-6 py-3 text-right">Unit Price</th>
									<th class="px-6 py-3 text-right">Total</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-200-800">
								{#each invoice.lines as line}
									<tr>
										<td class="px-6 py-4">
											<div class="font-medium">{line.description}</div>
											{#if line.isTaxable}
												<span class="text-xs text-surface-400">Taxable</span>
											{/if}
										</td>
										<td class="px-6 py-4 text-right">{line.quantity}</td>
										<td class="px-6 py-4 text-right">{formatCurrency(line.unitPrice)}</td>
										<td class="px-6 py-4 text-right font-medium">{formatCurrency(line.lineTotal)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="p-6">
						<EmptyState
							title="No line items"
							description="This invoice has no line items."
						/>
					</div>
				{/if}
			</Card>

			<!-- Totals -->
			<Card variant="outlined" padding="md">
				<div class="flex justify-end">
					<div class="w-full max-w-xs space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-surface-500">Subtotal</span>
							<span>{formatCurrency(invoice.subtotal)}</span>
						</div>
						{#if Number(invoice.taxAmount) > 0}
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Tax</span>
								<span>{formatCurrency(invoice.taxAmount)}</span>
							</div>
						{/if}
						{#if Number(invoice.discount) > 0}
							<div class="flex justify-between text-sm text-success-500">
								<span>Discount</span>
								<span>-{formatCurrency(invoice.discount)}</span>
							</div>
						{/if}
						<div class="flex justify-between border-t border-surface-300-700 pt-2 text-lg font-bold">
							<span>Total</span>
							<span>{formatCurrency(invoice.totalAmount)}</span>
						</div>
						<div class="flex justify-between text-sm text-success-500">
							<span>Paid</span>
							<span>-{formatCurrency(invoice.amountPaid)}</span>
						</div>
						<div class="flex justify-between border-t border-surface-300-700 pt-2 text-lg font-bold {Number(invoice.balanceDue) > 0 ? 'text-warning-500' : 'text-success-500'}">
							<span>Balance Due</span>
							<span>{formatCurrency(invoice.balanceDue)}</span>
						</div>
					</div>
				</div>
			</Card>

			<!-- Invoice Details -->
			<div class="grid gap-6 lg:grid-cols-2">
				<Card variant="outlined" padding="md">
					<h3 class="font-medium mb-3">Invoice Details</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-surface-500">Invoice Number</dt>
							<dd class="font-medium">{invoice.invoiceNumber}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-surface-500">Status</dt>
							<dd><span class="badge {getStatusColor(invoice.status)} text-xs">{invoice.status}</span></dd>
						</div>
						{#if invoice.dueDate}
							<div class="flex justify-between">
								<dt class="text-surface-500">Due Date</dt>
								<dd class="font-medium">{formatDate(invoice.dueDate)}</dd>
							</div>
						{/if}
						<div class="flex justify-between">
							<dt class="text-surface-500">Created</dt>
							<dd>{formatDate(invoice.createdAt)}</dd>
						</div>
					</dl>
				</Card>

				<Card variant="outlined" padding="md">
					<h3 class="font-medium mb-3">Status History</h3>
					<div class="space-y-2 text-sm">
						{#if invoice.sentAt}
							<div class="flex items-center gap-2 text-surface-500">
								<Send class="h-4 w-4" />
								<span>Sent on {formatDate(invoice.sentAt)}</span>
							</div>
						{/if}
						{#if invoice.viewedAt}
							<div class="flex items-center gap-2 text-surface-500">
								<Receipt class="h-4 w-4" />
								<span>Viewed on {formatDate(invoice.viewedAt)}</span>
							</div>
						{/if}
						{#if invoice.paidAt}
							<div class="flex items-center gap-2 text-success-500">
								<CheckCircle2 class="h-4 w-4" />
								<span>Paid in full on {formatDate(invoice.paidAt)}</span>
							</div>
						{/if}
						{#if !invoice.sentAt && !invoice.viewedAt && !invoice.paidAt}
							<p class="text-surface-400">No status changes yet.</p>
						{/if}
					</div>
				</Card>
			</div>

			<!-- Notes & Terms -->
			{#if invoice.notes || invoice.terms}
				<div class="grid gap-6 lg:grid-cols-2">
					{#if invoice.notes}
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-3">Notes</h3>
							<p class="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
								{invoice.notes}
							</p>
						</Card>
					{/if}
					{#if invoice.terms}
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-3">Terms & Conditions</h3>
							<p class="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
								{invoice.terms}
							</p>
						</Card>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</PageContainer>
