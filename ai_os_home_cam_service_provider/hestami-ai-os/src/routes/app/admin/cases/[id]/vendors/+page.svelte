<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Plus,
		Search,
		Globe,
		FileText,
		Loader2,
		RefreshCw,
		Phone,
		Mail,
		MapPin,
		CheckCircle,
		XCircle,
		AlertTriangle,
		ExternalLink,
		Sparkles,
		Building2,
		ChevronRight
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { organizationStore } from '$lib/stores';
	import { conciergeCaseApi, type ConciergeCaseDetail } from '$lib/api/cam';
	import {
		vendorCandidateApi,
		STATUS_LABELS,
		STATUS_COLORS,
		getConfidenceBadgeClass,
		formatConfidence,
		generateIdempotencyKey,
		type VendorCandidateListItem,
		type VendorCandidateStatus,
		type ExtractedVendorData
	} from '$lib/api/vendorCandidate';

	const caseId = $derived($page.params.id ?? '');
	const organizationId = $derived($organizationStore.current?.organization.id || '');

	let caseDetail = $state<ConciergeCaseDetail | null>(null);
	let vendors = $state<VendorCandidateListItem[]>([]);
	let isLoading = $state(true);
	let isLoadingVendors = $state(false);
	let error = $state<string | null>(null);

	// Capture form state
	let showCaptureForm = $state(false);
	let sourceUrl = $state('');
	let sourceHtml = $state('');
	let sourcePlainText = $state('');
	let isExtracting = $state(false);
	let extractedData = $state<ExtractedVendorData | null>(null);
	let extractionError = $state<string | null>(null);

	// Manual entry form state
	let showManualForm = $state(false);
	let manualVendorName = $state('');
	let manualContactName = $state('');
	let manualContactEmail = $state('');
	let manualContactPhone = $state('');
	let manualAddress = $state('');
	let manualWebsite = $state('');
	let manualServiceCategories = $state('');
	let manualNotes = $state('');
	let isSubmitting = $state(false);

	onMount(async () => {
		await Promise.all([loadCaseDetail(), loadVendors()]);
	});

	async function loadCaseDetail() {
		if (!caseId) return;
		try {
			const response = await conciergeCaseApi.getDetail(caseId);
			if (response.ok) {
				caseDetail = response.data;
			}
		} catch (err) {
			console.error('Failed to load case:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadVendors() {
		if (!caseId || !organizationId) return;
		isLoadingVendors = true;
		try {
			const response = await vendorCandidateApi.listByCase({ caseId });
			if (response.ok) {
				vendors = response.data.vendorCandidates;
			}
		} catch (err) {
			console.error('Failed to load vendors:', err);
		} finally {
			isLoadingVendors = false;
		}
	}

	async function extractVendorInfo() {
		if (!sourceUrl && !sourceHtml && !sourcePlainText) {
			extractionError = 'Please provide at least one source (URL, HTML, or plain text)';
			return;
		}

		isExtracting = true;
		extractionError = null;
		extractedData = null;

		try {
			const response = await vendorCandidateApi.extract({
					caseId,
					sourceUrl: sourceUrl || undefined,
					sourceHtml: sourceHtml || undefined,
					sourcePlainText: sourcePlainText || undefined
				});

			if (response.ok) {
				extractedData = response.data.extracted;
				if (response.data.multipleVendorsDetected) {
					extractionError = 'Multiple vendors detected. Please refine your source.';
				}
			}
		} catch (err) {
			extractionError = err instanceof Error ? err.message : 'Extraction failed';
		} finally {
			isExtracting = false;
		}
	}

	async function confirmExtractedVendor() {
		if (!extractedData || !extractedData.vendorName) {
			extractionError = 'Vendor name is required';
			return;
		}

		isSubmitting = true;
		try {
			const response = await vendorCandidateApi.create({
					caseId,
					vendorName: extractedData.vendorName,
					vendorContactName: extractedData.vendorContactName || undefined,
					vendorContactEmail: extractedData.vendorContactEmail || undefined,
					vendorContactPhone: extractedData.vendorContactPhone || undefined,
					vendorAddress: extractedData.vendorAddress || undefined,
					vendorWebsite: extractedData.vendorWebsite || undefined,
					serviceCategories: extractedData.serviceCategories,
					coverageArea: extractedData.coverageArea || undefined,
					licensesAndCerts: extractedData.licensesAndCerts,
					sourceUrl: sourceUrl || undefined,
					sourceHtml: sourceHtml || undefined,
					sourcePlainText: sourcePlainText || undefined,
					extractionConfidence: extractedData.confidence,
					extractionMetadata: extractedData.fieldConfidences
				});

			if (response.ok) {
				resetCaptureForm();
				await loadVendors();
			}
		} catch (err) {
			extractionError = err instanceof Error ? err.message : 'Failed to save vendor';
		} finally {
			isSubmitting = false;
		}
	}

	async function submitManualVendor() {
		if (!manualVendorName.trim()) {
			error = 'Vendor name is required';
			return;
		}

		isSubmitting = true;
		error = null;
		try {
			const response = await vendorCandidateApi.create({
					caseId,
					vendorName: manualVendorName.trim(),
					vendorContactName: manualContactName.trim() || undefined,
					vendorContactEmail: manualContactEmail.trim() || undefined,
					vendorContactPhone: manualContactPhone.trim() || undefined,
					vendorAddress: manualAddress.trim() || undefined,
					vendorWebsite: manualWebsite.trim() || undefined,
					serviceCategories: manualServiceCategories
						? manualServiceCategories.split(',').map((s) => s.trim())
						: undefined,
					notes: manualNotes.trim() || undefined
				});

			if (response.ok) {
				resetManualForm();
				await loadVendors();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save vendor';
		} finally {
			isSubmitting = false;
		}
	}

	function resetCaptureForm() {
		showCaptureForm = false;
		sourceUrl = '';
		sourceHtml = '';
		sourcePlainText = '';
		extractedData = null;
		extractionError = null;
	}

	function resetManualForm() {
		showManualForm = false;
		manualVendorName = '';
		manualContactName = '';
		manualContactEmail = '';
		manualContactPhone = '';
		manualAddress = '';
		manualWebsite = '';
		manualServiceCategories = '';
		manualNotes = '';
	}

	function getStatusIcon(status: VendorCandidateStatus) {
		switch (status) {
			case 'SELECTED':
				return CheckCircle;
			case 'REJECTED':
				return XCircle;
			default:
				return Building2;
		}
	}
</script>

<svelte:head>
	<title>Vendor Research | {caseDetail?.case.title || 'Case'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/admin/cases/{caseId}"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Case
			</a>
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else}
			<!-- Header -->
			<div class="mb-6">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 class="text-2xl font-bold">Vendor Research</h1>
						{#if caseDetail}
							<p class="mt-1 text-surface-500">
								{caseDetail.case.caseNumber} — {caseDetail.case.title}
							</p>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							onclick={() => {
								showCaptureForm = true;
								showManualForm = false;
							}}
							class="btn preset-filled-primary-500"
						>
							<Sparkles class="mr-2 h-4 w-4" />
							Extract from Source
						</button>
						<button
							onclick={() => {
								showManualForm = true;
								showCaptureForm = false;
							}}
							class="btn preset-outlined-primary-500"
						>
							<Plus class="mr-2 h-4 w-4" />
							Add Manually
						</button>
					</div>
				</div>
			</div>

			<!-- Context Header -->
			{#if caseDetail}
				<Card variant="outlined" padding="md" class="mb-6">
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
						<div>
							<p class="text-xs font-medium text-surface-500">Property</p>
							<p class="font-medium">{caseDetail.property.name}</p>
							<p class="text-xs text-surface-400">{caseDetail.property.addressLine1}</p>
						</div>
						<div>
							<p class="text-xs font-medium text-surface-500">Service Category</p>
							<p class="text-sm font-medium">{(caseDetail.case as any).serviceCategory || 'General'}</p>
						</div>
						<div>
							<p class="text-xs font-medium text-surface-500">Coverage Area</p>
							<p class="text-sm">{caseDetail.property.city || 'Local'}, {caseDetail.property.state || ''}</p>
						</div>
						<div>
							<p class="text-xs font-medium text-surface-500">Constraints</p>
							<p class="text-sm">{caseDetail.case.priority === 'URGENT' || caseDetail.case.priority === 'EMERGENCY' ? 'Urgent timeline' : 'Standard timeline'}</p>
						</div>
						<div>
							<p class="text-xs font-medium text-surface-500">Vendors Found</p>
							<p class="text-2xl font-bold">{vendors.length}</p>
						</div>
					</div>
				</Card>
			{/if}

			<!-- Capture Form -->
			{#if showCaptureForm}
				<Card variant="outlined" padding="lg" class="mb-6">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<Sparkles class="h-5 w-5 text-primary-500" />
							<h2 class="text-lg font-semibold">Extract Vendor Information</h2>
						</div>
						<button onclick={resetCaptureForm} class="btn preset-outlined-surface-500 btn-sm">
							Cancel
						</button>
					</div>

					<div class="space-y-4">
						<div>
							<label for="sourceUrl" class="block text-sm font-medium mb-1">
								<Globe class="inline h-4 w-4 mr-1" />
								Source URL
							</label>
							<input
								type="url"
								id="sourceUrl"
								bind:value={sourceUrl}
								placeholder="https://example.com/vendor-page"
								class="input w-full"
							/>
						</div>

						<div>
							<label for="sourcePlainText" class="block text-sm font-medium mb-1">
								<FileText class="inline h-4 w-4 mr-1" />
								Plain Text (paste vendor info)
							</label>
							<textarea
								id="sourcePlainText"
								bind:value={sourcePlainText}
								placeholder="Paste vendor information here..."
								class="textarea w-full"
								rows="4"
							></textarea>
						</div>

						<details class="text-sm">
							<summary class="cursor-pointer text-surface-500 hover:text-surface-700">
								Advanced: Paste raw HTML
							</summary>
							<div class="mt-2">
								<textarea
									bind:value={sourceHtml}
									placeholder="Paste raw HTML here..."
									class="textarea w-full font-mono text-xs"
									rows="4"
								></textarea>
							</div>
						</details>

						{#if extractionError}
							<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
								<AlertTriangle class="inline h-4 w-4 mr-1" />
								{extractionError}
							</div>
						{/if}

						<button
							onclick={extractVendorInfo}
							class="btn preset-filled-primary-500"
							disabled={isExtracting || (!sourceUrl && !sourceHtml && !sourcePlainText)}
						>
							{#if isExtracting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Extracting...
							{:else}
								<Search class="mr-2 h-4 w-4" />
								Extract Vendor Information
							{/if}
						</button>
					</div>

					<!-- Extraction Results -->
					{#if extractedData}
						<div class="mt-6 border-t border-surface-300-700 pt-6">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-semibold">Extracted Information</h3>
								<span class="badge {getConfidenceBadgeClass(extractedData.confidence)}">
									Confidence: {formatConfidence(extractedData.confidence)}
								</span>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="extracted-vendor-name" class="block text-xs font-medium text-surface-500 mb-1">Vendor Name</label>
									<input
										id="extracted-vendor-name"
										type="text"
										bind:value={extractedData.vendorName}
										class="input w-full"
										placeholder="Enter vendor name"
									/>
								</div>
								<div>
									<label for="extracted-contact-name" class="block text-xs font-medium text-surface-500 mb-1">Contact Name</label>
									<input
										id="extracted-contact-name"
										type="text"
										bind:value={extractedData.vendorContactName}
										class="input w-full"
									/>
								</div>
								<div>
									<label for="extracted-email" class="block text-xs font-medium text-surface-500 mb-1">Email</label>
									<input
										id="extracted-email"
										type="email"
										bind:value={extractedData.vendorContactEmail}
										class="input w-full"
									/>
								</div>
								<div>
									<label for="extracted-phone" class="block text-xs font-medium text-surface-500 mb-1">Phone</label>
									<input
										id="extracted-phone"
										type="tel"
										bind:value={extractedData.vendorContactPhone}
										class="input w-full"
									/>
								</div>
								<div class="sm:col-span-2">
									<label for="extracted-address" class="block text-xs font-medium text-surface-500 mb-1">Address</label>
									<input
										id="extracted-address"
										type="text"
										bind:value={extractedData.vendorAddress}
										class="input w-full"
									/>
								</div>
								<div>
									<label for="extracted-website" class="block text-xs font-medium text-surface-500 mb-1">Website</label>
									<input
										id="extracted-website"
										type="url"
										bind:value={extractedData.vendorWebsite}
										class="input w-full"
									/>
								</div>
								<div>
									<label for="extracted-coverage" class="block text-xs font-medium text-surface-500 mb-1">Coverage Area</label>
									<input
										id="extracted-coverage"
										type="text"
										bind:value={extractedData.coverageArea}
										class="input w-full"
									/>
								</div>
							</div>

							<div class="mt-4 flex justify-end gap-2">
								<button onclick={resetCaptureForm} class="btn preset-outlined-surface-500">
									Cancel
								</button>
								<button
									onclick={confirmExtractedVendor}
									class="btn preset-filled-primary-500"
									disabled={isSubmitting || !extractedData.vendorName}
								>
									{#if isSubmitting}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<CheckCircle class="mr-2 h-4 w-4" />
									{/if}
									Confirm Vendor Candidate
								</button>
							</div>
						</div>
					{/if}
				</Card>
			{/if}

			<!-- Manual Entry Form -->
			{#if showManualForm}
				<Card variant="outlined" padding="lg" class="mb-6">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<Plus class="h-5 w-5 text-primary-500" />
							<h2 class="text-lg font-semibold">Add Vendor Manually</h2>
						</div>
						<button onclick={resetManualForm} class="btn preset-outlined-surface-500 btn-sm">
							Cancel
						</button>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="vendorName" class="block text-sm font-medium mb-1">
								Vendor Name <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="vendorName"
								bind:value={manualVendorName}
								class="input w-full"
								required
							/>
						</div>
						<div>
							<label for="contactName" class="block text-sm font-medium mb-1">Contact Name</label>
							<input
								type="text"
								id="contactName"
								bind:value={manualContactName}
								class="input w-full"
							/>
						</div>
						<div>
							<label for="contactEmail" class="block text-sm font-medium mb-1">Email</label>
							<input
								type="email"
								id="contactEmail"
								bind:value={manualContactEmail}
								class="input w-full"
							/>
						</div>
						<div>
							<label for="contactPhone" class="block text-sm font-medium mb-1">Phone</label>
							<input
								type="tel"
								id="contactPhone"
								bind:value={manualContactPhone}
								class="input w-full"
							/>
						</div>
						<div class="sm:col-span-2">
							<label for="address" class="block text-sm font-medium mb-1">Address</label>
							<input type="text" id="address" bind:value={manualAddress} class="input w-full" />
						</div>
						<div>
							<label for="website" class="block text-sm font-medium mb-1">Website</label>
							<input type="url" id="website" bind:value={manualWebsite} class="input w-full" />
						</div>
						<div>
							<label for="categories" class="block text-sm font-medium mb-1">
								Service Categories (comma-separated)
							</label>
							<input
								type="text"
								id="categories"
								bind:value={manualServiceCategories}
								placeholder="Plumbing, HVAC, Electrical"
								class="input w-full"
							/>
						</div>
						<div class="sm:col-span-2">
							<label for="notes" class="block text-sm font-medium mb-1">Notes</label>
							<textarea
								id="notes"
								bind:value={manualNotes}
								class="textarea w-full"
								rows="2"
							></textarea>
						</div>
					</div>

					{#if error}
						<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
							<AlertTriangle class="inline h-4 w-4 mr-1" />
							{error}
						</div>
					{/if}

					<div class="mt-4 flex justify-end gap-2">
						<button onclick={resetManualForm} class="btn preset-outlined-surface-500">
							Cancel
						</button>
						<button
							onclick={submitManualVendor}
							class="btn preset-filled-primary-500"
							disabled={isSubmitting || !manualVendorName.trim()}
						>
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Plus class="mr-2 h-4 w-4" />
							{/if}
							Add Vendor
						</button>
					</div>
				</Card>
			{/if}

			<!-- Vendor List -->
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">Vendor Candidates ({vendors.length})</h2>
				<button
					onclick={loadVendors}
					class="btn preset-outlined-surface-500 btn-sm"
					disabled={isLoadingVendors}
				>
					{#if isLoadingVendors}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<RefreshCw class="mr-2 h-4 w-4" />
					{/if}
					Refresh
				</button>
			</div>

			{#if vendors.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No vendors found"
						description="Start by extracting vendor information from a source or adding a vendor manually."
					/>
				</Card>
			{:else}
				<div class="space-y-3">
					{#each vendors as vendor}
						{@const StatusIcon = getStatusIcon(vendor.status)}
						<a
							href="/app/admin/cases/{caseId}/vendors/{vendor.id}"
							class="block rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 transition-all hover:border-primary-500 hover:shadow-md"
						>
							<div class="flex items-start gap-4">
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
									<StatusIcon class="h-5 w-5 text-surface-600 dark:text-surface-400" />
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="badge {STATUS_COLORS[vendor.status]} text-xs">
											{STATUS_LABELS[vendor.status]}
										</span>
										{#if vendor.extractionConfidence !== null}
											<span class="badge {getConfidenceBadgeClass(vendor.extractionConfidence)} text-xs">
												{formatConfidence(vendor.extractionConfidence)} confidence
											</span>
										{/if}
									</div>
									<h3 class="mt-1 font-medium">{vendor.vendorName}</h3>
									<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
										{#if vendor.vendorContactEmail}
											<span class="flex items-center gap-1">
												<Mail class="h-3 w-3" />
												{vendor.vendorContactEmail}
											</span>
										{/if}
										{#if vendor.vendorContactPhone}
											<span class="flex items-center gap-1">
												<Phone class="h-3 w-3" />
												{vendor.vendorContactPhone}
											</span>
										{/if}
										{#if vendor.serviceCategories && vendor.serviceCategories.length > 0}
											<span>{vendor.serviceCategories.join(', ')}</span>
										{/if}
									</div>
								</div>

								<ChevronRight class="h-5 w-5 flex-shrink-0 text-surface-400" />
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</PageContainer>
