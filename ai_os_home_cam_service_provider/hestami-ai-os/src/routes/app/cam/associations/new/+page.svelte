<script lang="ts">
	import { ArrowLeft, Building2, Calculator, FileText, Save, Info } from 'lucide-svelte';
	import { associationApi, type AssociationCreateInput } from '$lib/api/cam';

	let { data } = $props();

	// Use $state with $effect to avoid proxy errors during navigation
	let coaTemplates = $state<any[]>([]);

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			coaTemplates = data.coaTemplates ?? [];
		}
	});

	// Form state (reactive)
	let formData = $state({
		name: '',
		legalName: '',
		taxId: '',
		fiscalYearEnd: 12,
		coaTemplateId: 'STANDARD_HOA' as AssociationCreateInput['coaTemplateId'],
		contractNumber: '',
		contractStartDate: new Date().toISOString().split('T')[0] // Today's date as default
	});

	// UI state
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSubmitting = true;
		errorMessage = null;
		fieldErrors = {};

		try {
			// Build the oRPC input from form data
			const input: AssociationCreateInput = {
				idempotencyKey: crypto.randomUUID(),
				name: formData.name,
				legalName: formData.legalName || null,
				taxId: formData.taxId || null,
				fiscalYearEnd: formData.fiscalYearEnd,
				coaTemplateId: formData.coaTemplateId,
				contractData: {
					contractNumber: formData.contractNumber || null,
					startDate: formData.contractStartDate
				}
			};

			const result = await associationApi.create(input);

			if (result.ok) {
				// Success - full page navigation to ensure associations list refreshes
				window.location.href = '/app/cam/associations';
				return; // Prevent further execution
			}
		} catch (err: unknown) {
			// Handle oRPC errors with proper type checking
			if (err && typeof err === 'object' && 'defined' in err) {
				const orpcError = err as { defined: boolean; code: string; message: string; status: number };
				errorMessage = orpcError.message || `Error: ${orpcError.code}`;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An unexpected error occurred';
			}
			console.error('Failed to create association:', err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Association | CAM | Hestami AI</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a href="/app/cam/associations" class="btn btn-sm preset-tonal-surface">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<h1 class="text-2xl font-bold">New Association</h1>
			<p class="text-surface-500">Add a new community association under management.</p>
		</div>
	</div>

	{#if errorMessage}
		<div class="alert variant-filled-error">
			<div class="alert-message">
				<p>{errorMessage}</p>
			</div>
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="space-y-8">
		<!-- Section 1: Association Profile -->
		<section class="card overflow-hidden">
			<header class="bg-surface-100-900 p-4 border-b border-surface-200-800 flex items-center gap-3">
				<Building2 class="h-5 w-5 text-primary-500" />
				<h2 class="font-semibold text-lg">Association Profile</h2>
			</header>
			<div class="p-4 space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<label class="label">
						<span>Display Name <span class="text-error-500">*</span></span>
						<input
							name="name"
							type="text"
							placeholder="e.g. Sunset Heights HOA"
							class="input"
							bind:value={formData.name}
							required
							minlength={1}
							maxlength={255}
						/>
						{#if fieldErrors.name}<span class="text-xs text-error-500">{fieldErrors.name}</span>{/if}
					</label>

					<label class="label">
						<span>Legal Name (if different)</span>
						<input
							name="legalName"
							type="text"
							placeholder="e.g. Sunset Heights Community Association, Inc."
							class="input"
							bind:value={formData.legalName}
							maxlength={255}
						/>
						{#if fieldErrors.legalName}<span class="text-xs text-error-500">{fieldErrors.legalName}</span>{/if}
					</label>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<label class="label">
						<span>Tax ID / EIN</span>
						<input
							name="taxId"
							type="text"
							placeholder="e.g. 12-3456789"
							class="input"
							bind:value={formData.taxId}
							maxlength={50}
						/>
						{#if fieldErrors.taxId}<span class="text-xs text-error-500">{fieldErrors.taxId}</span>{/if}
					</label>

					<label class="label">
						<span>Fiscal Year End Month</span>
						<select name="fiscalYearEnd" class="select" bind:value={formData.fiscalYearEnd}>
							<option value={1}>January</option>
							<option value={2}>February</option>
							<option value={3}>March</option>
							<option value={4}>April</option>
							<option value={5}>May</option>
							<option value={6}>June</option>
							<option value={7}>July</option>
							<option value={8}>August</option>
							<option value={9}>September</option>
							<option value={10}>October</option>
							<option value={11}>November</option>
							<option value={12}>December</option>
						</select>
						{#if fieldErrors.fiscalYearEnd}<span class="text-xs text-error-500">{fieldErrors.fiscalYearEnd}</span>{/if}
					</label>
				</div>
			</div>
		</section>

		<!-- Section 2: Accounting Setup -->
		<section class="card overflow-hidden">
			<header class="bg-surface-100-900 p-4 border-b border-surface-200-800 flex items-center gap-3">
				<Calculator class="h-5 w-5 text-primary-500" />
				<h2 class="font-semibold text-lg">Accounting Setup</h2>
			</header>
			<div class="p-4">
				<div class="label mb-2" id="coa-template-label">
					<span>Chart of Accounts Template <span class="text-error-500">*</span></span>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-labelledby="coa-template-label">
					{#each coaTemplates as template}
						<label 
							for="coa-{template.id}"
							class="flex flex-col gap-2 rounded-lg border p-4 cursor-pointer transition-colors {formData.coaTemplateId === template.id ? 'border-primary-500 bg-primary-500/5' : 'border-surface-200-800 hover:bg-surface-50-950'}"
						>
							<div class="flex items-center justify-between">
								<span class="font-medium">{template.label}</span>
								<input 
									id="coa-{template.id}"
									type="radio" 
									name="coaTemplateId" 
									value={template.id} 
									bind:group={formData.coaTemplateId}
									class="radio"
								/>
							</div>
							<p class="text-xs text-surface-500">{template.description}</p>
						</label>
					{/each}
				</div>
				{#if fieldErrors.coaTemplateId}<span class="text-xs text-error-500">{fieldErrors.coaTemplateId}</span>{/if}
				
				<div class="mt-4 flex items-start gap-2 text-xs text-surface-500 italic">
					<Info class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
					<p>Choosing a template will automatically seed the initial chart of accounts. You can customize accounts once the association is created.</p>
				</div>
			</div>
		</section>

		<!-- Section 3: Management Contract -->
		<section class="card overflow-hidden">
			<header class="bg-surface-100-900 p-4 border-b border-surface-200-800 flex items-center gap-3">
				<FileText class="h-5 w-5 text-primary-500" />
				<h2 class="font-semibold text-lg">Management Contract</h2>
			</header>
			<div class="p-4 space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<label class="label">
						<span>Contract Number</span>
						<input
							name="contractNumber"
							type="text"
							placeholder="e.g. MC-2024-001"
							class="input"
							bind:value={formData.contractNumber}
							maxlength={100}
						/>
						{#if fieldErrors.contractNumber}<span class="text-xs text-error-500">{fieldErrors.contractNumber}</span>{/if}
					</label>

					<label class="label">
						<span>Contract Start Date <span class="text-error-500">*</span></span>
						<input
							name="contractStartDate"
							type="date"
							class="input"
							bind:value={formData.contractStartDate}
							required
						/>
						{#if fieldErrors.contractStartDate}<span class="text-xs text-error-500">{fieldErrors.contractStartDate}</span>{/if}
					</label>
				</div>
                <div class="flex items-start gap-2 text-xs text-surface-500">
					<Info class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
					<p>Providing these details will automatically link this association to your management company.</p>
				</div>
			</div>
		</section>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-surface-200-800">
			<a href="/app/cam/associations" class="btn preset-tonal-surface">Cancel</a>
			<button type="submit" class="btn preset-filled-primary-500" disabled={isSubmitting}>
				{#if isSubmitting}
					<span class="animate-pulse">Processing...</span>
				{:else}
					<Save class="mr-2 h-4 w-4" />
					Create Association
				{/if}
			</button>
		</div>
	</form>
</div>
