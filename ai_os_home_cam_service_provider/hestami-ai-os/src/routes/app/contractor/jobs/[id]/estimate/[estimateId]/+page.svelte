<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Loader2,
		Save,
		Send,
		Plus,
		Trash2,
		DollarSign,
		FileText,
		CheckCircle2,
		XCircle,
		Book,
		Search,
		X
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { estimateApi, jobApi, type Estimate, type EstimateLine, type Job } from '$lib/api/cam';

	const jobId = $derived($page.params.id ?? '');
	const estimateId = $derived($page.params.estimateId ?? '');

	let job = $state<Job | null>(null);
	let estimate = $state<Estimate | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isSaving = $state(false);
	let isSending = $state(false);

	// New line item form
	let showAddLine = $state(false);
	let newLineDescription = $state('');
	let newLineQuantity = $state(1);
	let newLineUnitPrice = $state(0);
	let newLineTaxable = $state(true);
	let isAddingLine = $state(false);

	// Edit fields
	let editNotes = $state('');
	let editTerms = $state('');

	// Pricebook modal
	let showPricebook = $state(false);
	let pricebookSearch = $state('');
	let pricebookCategory = $state('');

	// Sample pricebook items (would come from API in production)
	const pricebookItems = [
		{ id: '1', name: 'HVAC Service Call', description: 'Standard service call fee', unitPrice: 95, category: 'HVAC', unit: 'each' },
		{ id: '2', name: 'HVAC Filter Replacement', description: 'Replace standard air filter', unitPrice: 45, category: 'HVAC', unit: 'each' },
		{ id: '3', name: 'AC Refrigerant Recharge', description: 'Recharge AC refrigerant (per lb)', unitPrice: 75, category: 'HVAC', unit: 'lb' },
		{ id: '4', name: 'Plumbing Service Call', description: 'Standard service call fee', unitPrice: 85, category: 'Plumbing', unit: 'each' },
		{ id: '5', name: 'Drain Cleaning', description: 'Clear clogged drain', unitPrice: 150, category: 'Plumbing', unit: 'each' },
		{ id: '6', name: 'Water Heater Flush', description: 'Flush and maintain water heater', unitPrice: 125, category: 'Plumbing', unit: 'each' },
		{ id: '7', name: 'Electrical Service Call', description: 'Standard service call fee', unitPrice: 90, category: 'Electrical', unit: 'each' },
		{ id: '8', name: 'Outlet Installation', description: 'Install standard electrical outlet', unitPrice: 175, category: 'Electrical', unit: 'each' },
		{ id: '9', name: 'Labor - Standard Rate', description: 'Standard labor rate', unitPrice: 85, category: 'Labor', unit: 'hour' },
		{ id: '10', name: 'Labor - Emergency Rate', description: 'Emergency/after-hours labor', unitPrice: 125, category: 'Labor', unit: 'hour' }
	];

	const pricebookCategories = ['All', 'HVAC', 'Plumbing', 'Electrical', 'Labor'];

	const filteredPricebookItems = $derived(
		pricebookItems.filter(item => {
			const matchesSearch = !pricebookSearch || 
				item.name.toLowerCase().includes(pricebookSearch.toLowerCase()) ||
				item.description.toLowerCase().includes(pricebookSearch.toLowerCase());
			const matchesCategory = !pricebookCategory || pricebookCategory === 'All' || item.category === pricebookCategory;
			return matchesSearch && matchesCategory;
		})
	);

	function addFromPricebook(item: typeof pricebookItems[0]) {
		newLineDescription = item.name;
		newLineUnitPrice = item.unitPrice;
		newLineQuantity = 1;
		newLineTaxable = true;
		showPricebook = false;
		showAddLine = true;
	}

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		if (!jobId || !estimateId) return;
		isLoading = true;
		error = null;
		try {
			const [jobRes, estimateRes] = await Promise.all([
				jobApi.get(jobId),
				estimateApi.get(estimateId)
			]);

			if (jobRes.ok) {
				job = jobRes.data.job;
			}

			if (!estimateRes.ok) {
				error = 'Failed to load estimate';
				return;
			}
			estimate = estimateRes.data.estimate;
			editNotes = estimate.notes || '';
			editTerms = estimate.terms || '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			isLoading = false;
		}
	}

	async function addLineItem() {
		if (!estimate || !newLineDescription.trim()) return;
		isAddingLine = true;
		try {
			const response = await estimateApi.addLine({
				estimateId: estimate.id,
				description: newLineDescription.trim(),
				quantity: newLineQuantity,
				unitPrice: newLineUnitPrice,
				isTaxable: newLineTaxable,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				estimate = response.data.estimate;
				// Reset form
				newLineDescription = '';
				newLineQuantity = 1;
				newLineUnitPrice = 0;
				newLineTaxable = true;
				showAddLine = false;
			}
		} catch (e) {
			console.error('Failed to add line item:', e);
		} finally {
			isAddingLine = false;
		}
	}

	async function removeLineItem(lineId: string) {
		if (!estimate) return;
		try {
			const response = await estimateApi.removeLine({
				estimateId: estimate.id,
				lineId,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				estimate = response.data.estimate;
			}
		} catch (e) {
			console.error('Failed to remove line item:', e);
		}
	}

	async function saveEstimate() {
		if (!estimate) return;
		isSaving = true;
		try {
			const response = await estimateApi.update({
				id: estimate.id,
				notes: editNotes || undefined,
				terms: editTerms || undefined,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				estimate = response.data.estimate;
			}
		} catch (e) {
			console.error('Failed to save estimate:', e);
		} finally {
			isSaving = false;
		}
	}

	async function sendEstimate() {
		if (!estimate) return;
		isSending = true;
		try {
			const response = await estimateApi.send({
				id: estimate.id,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				estimate = response.data.estimate;
			}
		} catch (e) {
			console.error('Failed to send estimate:', e);
		} finally {
			isSending = false;
		}
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			DRAFT: 'preset-filled-surface-500',
			SENT: 'preset-filled-primary-500',
			VIEWED: 'preset-filled-secondary-500',
			ACCEPTED: 'preset-filled-success-500',
			DECLINED: 'preset-filled-error-500',
			EXPIRED: 'preset-outlined-surface-500',
			REVISED: 'preset-filled-warning-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function formatCurrency(value: string | number): string {
		return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
	}
</script>

<svelte:head>
	<title>{estimate?.estimateNumber || 'Estimate'} | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
		</div>
	{:else if error || !estimate}
		<Card variant="outlined" padding="lg">
			<div class="text-center">
				<p class="text-error-500">{error || 'Estimate not found'}</p>
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
							<span class="text-sm text-surface-500">{estimate.estimateNumber}</span>
							<span class="badge {getStatusColor(estimate.status)}">{estimate.status}</span>
							{#if estimate.version > 1}
								<span class="text-xs text-surface-400">v{estimate.version}</span>
							{/if}
						</div>
						<h1 class="mt-1 text-2xl font-bold">Estimate Builder</h1>
						{#if job}
							<p class="mt-1 text-surface-500">{job.title}</p>
						{/if}
					</div>
				</div>

				<!-- Actions -->
				<div class="flex gap-2">
					{#if estimate.status === 'DRAFT'}
						<button
							onclick={saveEstimate}
							disabled={isSaving}
							class="btn preset-outlined-primary-500"
						>
							{#if isSaving}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Save class="mr-2 h-4 w-4" />
							{/if}
							Save
						</button>
						<button
							onclick={sendEstimate}
							disabled={isSending || !estimate.lines || estimate.lines.length === 0}
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
				</div>
			</div>

			<!-- Line Items -->
			<Card variant="outlined" padding="none">
				<div class="border-b border-surface-300-700 px-6 py-4">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">Line Items</h2>
						{#if estimate.status === 'DRAFT'}
							<div class="flex gap-2">
								<button
									onclick={() => showPricebook = true}
									class="btn btn-sm preset-outlined-primary-500"
								>
									<Book class="mr-2 h-4 w-4" />
									Pricebook
								</button>
								<button
									onclick={() => showAddLine = !showAddLine}
									class="btn btn-sm preset-filled-primary-500"
								>
									<Plus class="mr-2 h-4 w-4" />
									Add Item
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Add Line Form -->
				{#if showAddLine && estimate.status === 'DRAFT'}
					<div class="border-b border-surface-300-700 bg-surface-100-900 p-4">
						<div class="grid gap-4 sm:grid-cols-4">
							<div class="sm:col-span-2">
								<label for="newLineDescription" class="label mb-1 text-xs">Description</label>
								<input
									id="newLineDescription"
									type="text"
									bind:value={newLineDescription}
									placeholder="Item description"
									class="input w-full"
								/>
							</div>
							<div>
								<label for="newLineQuantity" class="label mb-1 text-xs">Quantity</label>
								<input
									id="newLineQuantity"
									type="number"
									bind:value={newLineQuantity}
									min="1"
									step="1"
									class="input w-full"
								/>
							</div>
							<div>
								<label for="newLineUnitPrice" class="label mb-1 text-xs">Unit Price</label>
								<input
									id="newLineUnitPrice"
									type="number"
									bind:value={newLineUnitPrice}
									min="0"
									step="0.01"
									class="input w-full"
								/>
							</div>
						</div>
						<div class="mt-4 flex items-center justify-between">
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={newLineTaxable} class="checkbox" />
								Taxable
							</label>
							<div class="flex gap-2">
								<button
									onclick={() => showAddLine = false}
									class="btn btn-sm preset-outlined-surface-500"
								>
									Cancel
								</button>
								<button
									onclick={addLineItem}
									disabled={!newLineDescription.trim() || isAddingLine}
									class="btn btn-sm preset-filled-primary-500"
								>
									{#if isAddingLine}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{/if}
									Add
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Line Items Table -->
				{#if estimate.lines && estimate.lines.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-surface-100-900 text-xs uppercase text-surface-500">
								<tr>
									<th class="px-6 py-3 text-left">Description</th>
									<th class="px-6 py-3 text-right">Qty</th>
									<th class="px-6 py-3 text-right">Unit Price</th>
									<th class="px-6 py-3 text-right">Total</th>
									{#if estimate.status === 'DRAFT'}
										<th class="px-6 py-3 text-right">Actions</th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-200-800">
								{#each estimate.lines as line}
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
										{#if estimate.status === 'DRAFT'}
											<td class="px-6 py-4 text-right">
												<button
													onclick={() => removeLineItem(line.id)}
													class="btn btn-sm btn-icon preset-outlined-error-500"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="p-6">
						<EmptyState
							title="No line items"
							description="Add line items to build your estimate."
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
							<span>{formatCurrency(estimate.subtotal)}</span>
						</div>
						{#if Number(estimate.taxAmount) > 0}
							<div class="flex justify-between text-sm">
								<span class="text-surface-500">Tax</span>
								<span>{formatCurrency(estimate.taxAmount)}</span>
							</div>
						{/if}
						{#if Number(estimate.discount) > 0}
							<div class="flex justify-between text-sm text-success-500">
								<span>Discount</span>
								<span>-{formatCurrency(estimate.discount)}</span>
							</div>
						{/if}
						<div class="flex justify-between border-t border-surface-300-700 pt-2 text-lg font-bold">
							<span>Total</span>
							<span>{formatCurrency(estimate.totalAmount)}</span>
						</div>
					</div>
				</div>
			</Card>

			<!-- Estimate Options (Good/Better/Best) -->
			{#if estimate.status === 'DRAFT'}
				<Card variant="outlined" padding="md">
					<div class="flex items-center justify-between mb-4">
						<h3 class="font-medium">Estimate Options</h3>
						<span class="text-xs text-surface-400">Optional: Offer multiple pricing tiers</span>
					</div>
					<div class="grid gap-4 md:grid-cols-3">
						<!-- Good Option -->
						<div class="p-4 rounded-lg border-2 border-surface-300-700 hover:border-primary-500 transition-colors">
							<div class="flex items-center justify-between mb-2">
								<span class="font-medium text-primary-500">Good</span>
								<span class="badge preset-outlined-primary-500 text-xs">Basic</span>
							</div>
							<p class="text-xs text-surface-500 mb-3">Essential service with standard materials</p>
							<div class="text-xl font-bold">{formatCurrency(estimate.totalAmount)}</div>
							<p class="text-xs text-surface-400 mt-1">Current estimate total</p>
						</div>

						<!-- Better Option -->
						<div class="p-4 rounded-lg border-2 border-surface-300-700 hover:border-secondary-500 transition-colors bg-surface-100-900">
							<div class="flex items-center justify-between mb-2">
								<span class="font-medium text-secondary-500">Better</span>
								<span class="badge preset-filled-secondary-500 text-xs">Recommended</span>
							</div>
							<p class="text-xs text-surface-500 mb-3">Enhanced service with premium materials</p>
							<div class="text-xl font-bold">{formatCurrency(String(Number(estimate.totalAmount) * 1.25))}</div>
							<p class="text-xs text-surface-400 mt-1">+25% for upgrades</p>
						</div>

						<!-- Best Option -->
						<div class="p-4 rounded-lg border-2 border-surface-300-700 hover:border-success-500 transition-colors">
							<div class="flex items-center justify-between mb-2">
								<span class="font-medium text-success-500">Best</span>
								<span class="badge preset-outlined-success-500 text-xs">Premium</span>
							</div>
							<p class="text-xs text-surface-500 mb-3">Complete solution with top-tier materials & warranty</p>
							<div class="text-xl font-bold">{formatCurrency(String(Number(estimate.totalAmount) * 1.5))}</div>
							<p class="text-xs text-surface-400 mt-1">+50% for premium package</p>
						</div>
					</div>
					<p class="mt-4 text-xs text-surface-400">
						Note: Good/Better/Best options are calculated automatically. Configure custom pricing tiers in contractor settings.
					</p>
				</Card>
			{/if}

			<!-- Notes & Terms -->
			<div class="grid gap-6 lg:grid-cols-2">
				<Card variant="outlined" padding="md">
					<h3 class="font-medium mb-3">Notes</h3>
					{#if estimate.status === 'DRAFT'}
						<textarea
							bind:value={editNotes}
							placeholder="Add notes for the customer..."
							rows="4"
							class="textarea w-full"
						></textarea>
					{:else}
						<p class="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
							{estimate.notes || 'No notes'}
						</p>
					{/if}
				</Card>

				<Card variant="outlined" padding="md">
					<h3 class="font-medium mb-3">Terms & Conditions</h3>
					{#if estimate.status === 'DRAFT'}
						<textarea
							bind:value={editTerms}
							placeholder="Add terms and conditions..."
							rows="4"
							class="textarea w-full"
						></textarea>
					{:else}
						<p class="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
							{estimate.terms || 'No terms specified'}
						</p>
					{/if}
				</Card>
			</div>

			<!-- Status Info -->
			{#if estimate.status !== 'DRAFT'}
				<Card variant="outlined" padding="md">
					<h3 class="font-medium mb-3">Status History</h3>
					<div class="space-y-2 text-sm">
						{#if estimate.sentAt}
							<div class="flex items-center gap-2 text-surface-500">
								<Send class="h-4 w-4" />
								<span>Sent on {new Date(estimate.sentAt).toLocaleString()}</span>
							</div>
						{/if}
						{#if estimate.viewedAt}
							<div class="flex items-center gap-2 text-surface-500">
								<FileText class="h-4 w-4" />
								<span>Viewed on {new Date(estimate.viewedAt).toLocaleString()}</span>
							</div>
						{/if}
						{#if estimate.acceptedAt}
							<div class="flex items-center gap-2 text-success-500">
								<CheckCircle2 class="h-4 w-4" />
								<span>Accepted on {new Date(estimate.acceptedAt).toLocaleString()}</span>
							</div>
						{/if}
						{#if estimate.declinedAt}
							<div class="flex items-center gap-2 text-error-500">
								<XCircle class="h-4 w-4" />
								<span>Declined on {new Date(estimate.declinedAt).toLocaleString()}</span>
							</div>
						{/if}
					</div>
				</Card>
			{/if}
		</div>
	{/if}
</PageContainer>

<!-- Pricebook Modal -->
{#if showPricebook}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={() => showPricebook = false}
		onkeydown={(e) => e.key === 'Escape' && (showPricebook = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="pricebook-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="bg-surface-50-950 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold flex items-center gap-2">
					<Book class="h-5 w-5 text-primary-500" />
					Pricebook
				</h2>
				<button onclick={() => showPricebook = false} class="btn-icon preset-outlined-surface-500">
					<X class="h-4 w-4" />
				</button>
			</div>
			
			<div class="p-4 border-b border-surface-300-700">
				<div class="flex gap-3">
					<div class="relative flex-1">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
						<input
							type="text"
							bind:value={pricebookSearch}
							placeholder="Search items..."
							class="input w-full pl-10"
						/>
					</div>
					<select bind:value={pricebookCategory} class="select w-40">
						{#each pricebookCategories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="overflow-y-auto max-h-[50vh]">
				{#if filteredPricebookItems.length === 0}
					<div class="p-8 text-center text-surface-400">
						No items found matching your search.
					</div>
				{:else}
					<div class="divide-y divide-surface-200-800">
						{#each filteredPricebookItems as item}
							<button
								onclick={() => addFromPricebook(item)}
								class="w-full px-6 py-4 text-left hover:bg-surface-100-900 transition-colors"
							>
								<div class="flex items-center justify-between">
									<div>
										<div class="font-medium">{item.name}</div>
										<div class="text-sm text-surface-500">{item.description}</div>
										<div class="mt-1 text-xs text-surface-400">
											<span class="badge preset-outlined-surface-500">{item.category}</span>
											<span class="ml-2">per {item.unit}</span>
										</div>
									</div>
									<div class="text-right">
										<div class="text-lg font-bold">${item.unitPrice}</div>
										<div class="text-xs text-surface-400">Click to add</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="border-t border-surface-300-700 px-6 py-3 bg-surface-100-900">
				<p class="text-xs text-surface-400">
					Select an item to add it to your estimate. Prices can be adjusted after adding.
				</p>
			</div>
		</div>
	</div>
{/if}
