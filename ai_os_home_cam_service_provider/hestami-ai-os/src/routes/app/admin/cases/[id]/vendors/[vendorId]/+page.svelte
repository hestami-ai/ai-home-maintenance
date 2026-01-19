<script lang="ts">
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Building2,
		Phone,
		Mail,
		MapPin,
		Globe,
		Star,
		Clock,
		FileText,
		AlertTriangle,
		CheckCircle,
		XCircle,
		Loader2,
		Edit,
		Trash2,
		DollarSign,
		Calendar,
		Shield,
		Award
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		vendorCandidateApi,
		STATUS_LABELS,
		STATUS_COLORS,
		type VendorCandidate
	} from '$lib/api/vendorCandidate';
	import { vendorBidApi, formatCurrency, formatDuration, type VendorBidListItem } from '$lib/api/vendorBid';
	import { VendorCandidateStatusValues, BidStatusValues } from '$lib/api/cam';

	const caseId = $derived(page.params.id ?? '');
	const vendorId = $derived(page.params.vendorId ?? '');

	interface Props {
		data: {
			vendorCandidate: VendorCandidate;
			bids: VendorBidListItem[];
		};
	}

	let { data }: Props = $props();

	let vendor = $state<VendorCandidate | null>(null);
	let bids = $state<VendorBidListItem[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Synchronize server data
	$effect(() => {
		if (!data) return;
		if (data.vendorCandidate) vendor = data.vendorCandidate;
		if (data.bids) bids = data.bids;
	});

	async function loadVendor() {
		// Just refresh the page to get latest data
		window.location.reload();
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case VendorCandidateStatusValues.SELECTED:
				return CheckCircle;
			case VendorCandidateStatusValues.REJECTED:
				return XCircle;
			case VendorCandidateStatusValues.QUOTED:
				return DollarSign;
			default:
				return Building2;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{vendor?.vendorName || 'Vendor Profile'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/admin/cases/{caseId}/vendors"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Vendor Research
			</a>
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else if error || !vendor}
			<Card variant="outlined" padding="lg">
				<EmptyState
					title="Unable to load vendor"
					description={error || 'The vendor could not be found.'}
				>
					{#snippet actions()}
						<a href="/app/admin/cases/{caseId}/vendors" class="btn preset-filled-primary-500">
							Return to Vendors
						</a>
					{/snippet}
				</EmptyState>
			</Card>
		{:else}
			<!-- Header -->
			<div class="mb-6">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div class="flex items-start gap-4">
						<div class="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-500/10">
							<Building2 class="h-8 w-8 text-primary-500" />
						</div>
						<div>
							<div class="flex items-center gap-3">
								<h1 class="text-2xl font-bold">{vendor.vendorName}</h1>
								<span class="badge {STATUS_COLORS[vendor.status]}">
									{STATUS_LABELS[vendor.status]}
								</span>
							</div>
							{#if vendor.vendorWebsite}
								<a
									href={vendor.vendorWebsite}
									target="_blank"
									rel="noopener noreferrer"
									class="mt-1 inline-flex items-center gap-1 text-sm text-primary-500 hover:underline"
								>
									<Globe class="h-3 w-3" />
									{vendor.vendorWebsite}
								</a>
							{/if}
						</div>
					</div>
					<div class="flex flex-wrap gap-2">
						<button class="btn preset-outlined-surface-500">
							<Edit class="mr-2 h-4 w-4" />
							Edit
						</button>
					</div>
				</div>
			</div>

			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Contact Information -->
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Contact Information</h2>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							{#if vendor.vendorContactName}
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<Building2 class="h-5 w-5 text-surface-500" />
									</div>
									<div>
										<p class="text-sm text-surface-500">Contact Name</p>
										<p class="font-medium">{vendor.vendorContactName}</p>
									</div>
								</div>
							{/if}
							{#if vendor.vendorContactEmail}
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<Mail class="h-5 w-5 text-surface-500" />
									</div>
									<div>
										<p class="text-sm text-surface-500">Email</p>
										<a href="mailto:{vendor.vendorContactEmail}" class="font-medium text-primary-500 hover:underline">
											{vendor.vendorContactEmail}
										</a>
									</div>
								</div>
							{/if}
							{#if vendor.vendorContactPhone}
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<Phone class="h-5 w-5 text-surface-500" />
									</div>
									<div>
										<p class="text-sm text-surface-500">Phone</p>
										<a href="tel:{vendor.vendorContactPhone}" class="font-medium text-primary-500 hover:underline">
											{vendor.vendorContactPhone}
										</a>
									</div>
								</div>
							{/if}
							{#if vendor.vendorAddress}
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<MapPin class="h-5 w-5 text-surface-500" />
									</div>
									<div>
										<p class="text-sm text-surface-500">Address</p>
										<p class="font-medium">{vendor.vendorAddress}</p>
									</div>
								</div>
							{/if}
						</div>
					</Card>

					<!-- Service Categories -->
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Service Categories</h2>
						<div class="mt-4">
							{#if vendor.serviceCategories && Array.isArray(vendor.serviceCategories) && vendor.serviceCategories.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each vendor.serviceCategories as category}
										<span class="badge preset-outlined-primary-500">{category}</span>
									{/each}
								</div>
							{:else}
								<p class="text-surface-500">No service categories specified</p>
							{/if}
						</div>
						{#if vendor.coverageArea}
							<div class="mt-4 pt-4 border-t border-surface-300-700">
								<p class="text-sm text-surface-500">Coverage Area</p>
								<p class="mt-1 font-medium">{vendor.coverageArea}</p>
							</div>
						{/if}
					</Card>

					<!-- Credentials -->
					<Card variant="outlined" padding="lg">
						<div class="flex items-center gap-2">
							<Award class="h-5 w-5 text-primary-500" />
							<h2 class="text-lg font-semibold">Licenses & Certifications</h2>
						</div>
						<div class="mt-4">
							{#if vendor.licensesAndCerts && Array.isArray(vendor.licensesAndCerts) && vendor.licensesAndCerts.length > 0}
								<div class="space-y-2">
									{#each vendor.licensesAndCerts as cert}
										<div class="flex items-center gap-2 rounded-lg bg-surface-100-900 p-3">
											<Shield class="h-4 w-4 text-success-500" />
											<span>{cert}</span>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-surface-500">No licenses or certifications on file</p>
							{/if}
						</div>
					</Card>

					<!-- Bids -->
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Bids & Quotes</h2>
							<span class="badge preset-outlined-surface-500">{bids.length} bid(s)</span>
						</div>
						<div class="mt-4">
							{#if bids.length > 0}
								<div class="space-y-3">
									{#each bids as bid}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start justify-between">
												<div>
													<p class="text-2xl font-bold">{formatCurrency(bid.amount)}</p>
													{#if bid.estimatedDuration}
														<p class="text-sm text-surface-500">
															Est. duration: {formatDuration(bid.estimatedDuration)}
														</p>
													{/if}
												</div>
												<span class="badge {bid.status === BidStatusValues.ACCEPTED ? 'preset-filled-success-500' : bid.status === BidStatusValues.REJECTED ? 'preset-filled-error-500' : 'preset-outlined-warning-500'}">
													{bid.status}
												</span>
											</div>
											<p class="mt-2 text-xs text-surface-400">
												Received: {formatDate(bid.receivedAt)}
												{#if bid.validUntil}
													• Valid until: {formatDate(bid.validUntil)}
												{/if}
											</p>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-surface-500">No bids received from this vendor yet</p>
							{/if}
						</div>
					</Card>

					<!-- Notes -->
					{#if vendor.notes}
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Notes</h2>
							<p class="mt-4 text-surface-600 dark:text-surface-400 whitespace-pre-wrap">
								{vendor.notes}
							</p>
						</Card>
					{/if}

					<!-- Risk Flags -->
					{#if vendor.riskFlags && Array.isArray(vendor.riskFlags) && vendor.riskFlags.length > 0}
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<AlertTriangle class="h-5 w-5 text-warning-500" />
								<h2 class="text-lg font-semibold">Risk Flags</h2>
							</div>
							<div class="mt-4 space-y-2">
								{#each vendor.riskFlags as flag}
									<div class="flex items-center gap-2 rounded-lg bg-warning-500/10 p-3 text-warning-700 dark:text-warning-300">
										<AlertTriangle class="h-4 w-4" />
										<span>{flag}</span>
									</div>
								{/each}
							</div>
						</Card>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Status Card -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Vendor Status</h3>
						<div class="mt-4 flex items-center gap-3">
							<div class="flex h-12 w-12 items-center justify-center rounded-full {vendor.status === VendorCandidateStatusValues.SELECTED ? 'bg-success-500/10' : vendor.status === VendorCandidateStatusValues.REJECTED ? 'bg-error-500/10' : 'bg-surface-200-800'}">
								{#if vendor.status === VendorCandidateStatusValues.SELECTED}
									<CheckCircle class="h-6 w-6 text-success-500" />
								{:else if vendor.status === VendorCandidateStatusValues.REJECTED}
									<XCircle class="h-6 w-6 text-error-500" />
								{:else}
									<Building2 class="h-6 w-6 text-surface-500" />
								{/if}
							</div>
							<div>
								<p class="font-medium">{STATUS_LABELS[vendor.status]}</p>
								{#if vendor.statusChangedAt}
									<p class="text-sm text-surface-500">
										Since {formatDate(vendor.statusChangedAt)}
									</p>
								{/if}
							</div>
						</div>
					</Card>

					<!-- Provenance -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Source Information</h3>
						<div class="mt-4 space-y-3 text-sm">
							{#if vendor.sourceUrl}
								<div>
									<p class="text-surface-500">Source URL</p>
									<a
										href={vendor.sourceUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary-500 hover:underline break-all"
									>
										{vendor.sourceUrl}
									</a>
								</div>
							{/if}
							{#if vendor.extractedAt}
								<div>
									<p class="text-surface-500">Extracted</p>
									<p>{formatDate(vendor.extractedAt)}</p>
								</div>
							{/if}
							{#if vendor.extractionConfidence !== null && vendor.extractionConfidence !== undefined}
								<div>
									<p class="text-surface-500">Extraction Confidence</p>
									<p>{Math.round(vendor.extractionConfidence * 100)}%</p>
								</div>
							{/if}
							<div>
								<p class="text-surface-500">Added</p>
								<p>{formatDate(vendor.createdAt)}</p>
							</div>
						</div>
					</Card>

					<!-- Quick Actions -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Actions</h3>
						<div class="mt-4 space-y-2">
							{#if vendor.status === VendorCandidateStatusValues.IDENTIFIED || vendor.status === VendorCandidateStatusValues.CONTACTED}
								<button class="btn preset-filled-success-500 w-full justify-start">
									<CheckCircle class="mr-2 h-4 w-4" />
									Select Vendor
								</button>
							{/if}
							{#if vendor.status !== VendorCandidateStatusValues.REJECTED}
								<button class="btn preset-outlined-error-500 w-full justify-start">
									<XCircle class="mr-2 h-4 w-4" />
									Reject Vendor
								</button>
							{/if}
							<button class="btn preset-outlined-surface-500 w-full justify-start">
								<DollarSign class="mr-2 h-4 w-4" />
								Add Bid
							</button>
						</div>
					</Card>
				</div>
			</div>
		{/if}
	</div>
</PageContainer>
