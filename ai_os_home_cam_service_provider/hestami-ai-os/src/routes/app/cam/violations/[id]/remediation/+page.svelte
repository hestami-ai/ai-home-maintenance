<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Wrench, Building2, DollarSign, FileText } from 'lucide-svelte';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation, refreshBadgeCounts } from '$lib/stores';
	import { violationApi, vendorApi, type Violation, type Vendor } from '$lib/api/cam';

	let violation = $state<Violation | null>(null);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		vendorId: '',
		budgetSource: 'OPERATING',
		estimatedCost: '',
		scope: '',
		notes: ''
	});

	const budgetSources = [
		{ value: 'OPERATING', label: 'Operating Budget' },
		{ value: 'RESERVE', label: 'Reserve Fund' },
		{ value: 'SPECIAL_ASSESSMENT', label: 'Special Assessment' },
		{ value: 'OWNER_CHARGE', label: 'Charge to Owner' }
	];

	const violationId = $derived(($page.params as Record<string, string>).id);

	async function loadData() {
		if (!violationId || !$currentAssociation?.id) return;

		isLoading = true;
		error = null;

		try {
			const [violationRes, vendorsRes] = await Promise.all([
				violationApi.get(violationId),
				vendorApi.list({ status: 'APPROVED' })
			]);

			if (violationRes.ok && violationRes.data?.violation) {
				violation = violationRes.data.violation;
			} else {
				error = 'Violation not found';
			}

			if (vendorsRes.ok && vendorsRes.data?.vendors) {
				vendors = vendorsRes.data.vendors;
			}
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!violation || !formData.vendorId || !formData.scope) {
			error = 'Please fill in all required fields';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await violationApi.authorizeRemediation(violation.id, {
				vendorId: formData.vendorId,
				budgetSource: formData.budgetSource,
				estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
				scope: formData.scope,
				notes: formData.notes || undefined,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await refreshBadgeCounts();
				if (response.data?.workOrderId) {
					goto(`/app/cam/work-orders/${response.data.workOrderId}`);
				} else {
					goto(`/app/cam/violations/${violation.id}`);
				}
			} else {
				error = 'Failed to authorize remediation';
			}
		} catch (e) {
			error = 'Failed to authorize remediation';
			console.error(e);
		} finally {
			isSubmitting = false;
		}
	}

	$effect(() => {
		if (violationId && $currentAssociation?.id) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Authorize Remediation | {violation?.violationNumber || 'Violation'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/violations/${violationId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<div class="flex items-center gap-2">
					<span class="text-sm text-surface-500">{violation?.violationNumber || ''}</span>
				</div>
				<h1 class="text-xl font-semibold">Authorize Remediation</h1>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error && !violation}
			<EmptyState title="Error" description={error} />
		{:else if violation}
			<div class="mx-auto max-w-2xl space-y-6">
				<Card variant="outlined" padding="lg">
					<div class="mb-4 flex items-center gap-2">
						<Wrench class="h-5 w-5 text-primary-500" />
						<h2 class="font-semibold">Violation Details</h2>
					</div>
					<div class="space-y-2 text-sm">
						<p><span class="text-surface-500">Number:</span> {violation.violationNumber}</p>
						<p><span class="text-surface-500">Title:</span> {violation.title}</p>
						<p><span class="text-surface-500">Status:</span> {violation.status.replace(/_/g, ' ')}</p>
					</div>
				</Card>

				<form onsubmit={handleSubmit} class="space-y-6">
					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
							{error}
						</div>
					{/if}

					<Card variant="outlined" padding="lg">
						<div class="mb-4 flex items-center gap-2">
							<Building2 class="h-5 w-5 text-primary-500" />
							<h2 class="font-semibold">Vendor Selection</h2>
						</div>

						<div class="space-y-4">
							<div>
								<label for="vendorId" class="mb-1 block text-sm font-medium">
									Select Vendor <span class="text-error-500">*</span>
								</label>
								<select
									id="vendorId"
									bind:value={formData.vendorId}
									required
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2"
								>
									<option value="">Choose a vendor...</option>
									{#each vendors as vendor}
										<option value={vendor.id}>
											{vendor.name} ({vendor.trades.join(', ')})
										</option>
									{/each}
								</select>
								{#if vendors.length === 0}
									<p class="mt-1 text-xs text-surface-500">
										No approved vendors available. <a href="/app/cam/vendors" class="text-primary-500 hover:underline">Manage vendors</a>
									</p>
								{/if}
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<div class="mb-4 flex items-center gap-2">
							<DollarSign class="h-5 w-5 text-primary-500" />
							<h2 class="font-semibold">Budget & Scope</h2>
						</div>

						<div class="space-y-4">
							<div>
								<label for="budgetSource" class="mb-1 block text-sm font-medium">
									Budget Source <span class="text-error-500">*</span>
								</label>
								<select
									id="budgetSource"
									bind:value={formData.budgetSource}
									required
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2"
								>
									{#each budgetSources as source}
										<option value={source.value}>{source.label}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="estimatedCost" class="mb-1 block text-sm font-medium">
									Estimated Cost
								</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
									<input
										type="number"
										id="estimatedCost"
										bind:value={formData.estimatedCost}
										step="0.01"
										min="0"
										placeholder="0.00"
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-7 pr-3"
									/>
								</div>
							</div>

							<div>
								<label for="scope" class="mb-1 block text-sm font-medium">
									Scope of Work <span class="text-error-500">*</span>
								</label>
								<textarea
									id="scope"
									bind:value={formData.scope}
									required
									rows="4"
									placeholder="Describe the remediation work to be performed..."
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2"
								></textarea>
							</div>

							<div>
								<label for="notes" class="mb-1 block text-sm font-medium">
									Additional Notes
								</label>
								<textarea
									id="notes"
									bind:value={formData.notes}
									rows="2"
									placeholder="Any additional instructions or notes..."
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2"
								></textarea>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<div class="mb-4 flex items-center gap-2">
							<FileText class="h-5 w-5 text-primary-500" />
							<h2 class="font-semibold">What Happens Next</h2>
						</div>
						<ul class="space-y-2 text-sm text-surface-600">
							<li>• A work order will be created and assigned to the selected vendor</li>
							<li>• The violation status will change to "Remediation in Progress"</li>
							<li>• You can track progress from the work order detail page</li>
							<li>• Once work is complete, return to resolve the violation</li>
						</ul>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/violations/${violationId}`)}
							class="btn preset-tonal-surface"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting || !formData.vendorId || !formData.scope}
							class="btn preset-filled-primary-500"
						>
							{#if isSubmitting}
								<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
								Creating Work Order...
							{:else}
								<Wrench class="mr-2 h-4 w-4" />
								Create Work Order
							{/if}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
