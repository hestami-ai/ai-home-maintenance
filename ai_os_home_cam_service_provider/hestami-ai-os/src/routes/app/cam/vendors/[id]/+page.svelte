<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Users, FileText, Clock, Phone, Mail, MapPin } from 'lucide-svelte';
	import { TabbedContent, DecisionButton, VendorApprovalModal, UploadComplianceDocModal } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { vendorApi, documentApi, activityEventApi, type Vendor, type Document } from '$lib/api/cam';

	interface VendorHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		createdAt: string;
	}

	let vendor = $state<Vendor | null>(null);
	let documents = $state<Document[]>([]);
	let history = $state<VendorHistoryEvent[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let showApprovalModal = $state(false);
	let approvalAction = $state<'APPROVE' | 'REJECT' | 'REQUEST_INFO' | null>(null);
	let isActionLoading = $state(false);
	let showUploadDocModal = $state(false);
	let isUploadingDoc = $state(false);

	const vendorId = $derived(($page.params as Record<string, string>).id);

	async function loadVendor() {
		if (!vendorId) return;

		isLoading = true;
		error = null;

		try {
			const response = await vendorApi.get(vendorId);
			if (response.ok && response.data?.vendor) {
				vendor = response.data.vendor as Vendor;
			} else {
				error = 'Vendor not found';
			}
		} catch (e) {
			error = 'Failed to load vendor';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocuments() {
		if (!vendorId) return;
		try {
			const response = await documentApi.list({ contextType: 'VENDOR', contextId: vendorId });
			if (response.ok && response.data?.documents) {
				documents = response.data.documents;
			}
		} catch (e) {
			console.error('Failed to load documents:', e);
		}
	}

	async function loadHistory() {
		if (!vendorId) return;
		try {
			const response = await activityEventApi.list({ entityType: 'VENDOR', entityId: vendorId });
			if (response.ok && response.data?.events) {
				history = response.data.events.map(e => ({
					id: e.id,
					action: e.action,
					description: e.summary,
					performedBy: e.performedBy,
					createdAt: e.createdAt
				}));
			}
		} catch (e) {
			console.error('Failed to load history:', e);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'APPROVED': return 'text-success-500 bg-success-500/10';
			case 'PENDING': return 'text-warning-500 bg-warning-500/10';
			case 'SUSPENDED': return 'text-error-500 bg-error-500/10';
			case 'INACTIVE': return 'text-surface-500 bg-surface-500/10';
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

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function openApprovalModal(action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') {
		approvalAction = action;
		showApprovalModal = true;
	}

	async function handleApprovalConfirm(data: { action: string; notes: string; expirationDate?: string }) {
		if (!vendor) return;

		isActionLoading = true;
		try {
			const response = await vendorApi.updateStatus(vendor.id, {
				status: data.action,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadVendor();
				await loadHistory();
				showApprovalModal = false;
				approvalAction = null;
			}
		} catch (e) {
			console.error('Failed to update vendor status:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleUploadDocument(data: { documentType: string; file: File; expirationDate?: string; notes?: string }) {
		if (!vendor) return;

		isUploadingDoc = true;
		try {
			// TODO: Document upload requires FormData - keep as fetch for now
			const formData = new FormData();
			formData.append('file', data.file);
			formData.append('documentType', data.documentType);
			formData.append('vendorId', vendor.id);
			if (data.expirationDate) formData.append('expirationDate', data.expirationDate);
			if (data.notes) formData.append('notes', data.notes);

			const response = await fetch(`/api/vendor/${vendor.id}/document`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await loadDocuments();
				showUploadDocModal = false;
			}
		} catch (e) {
			console.error('Failed to upload document:', e);
		} finally {
			isUploadingDoc = false;
		}
	}

	$effect(() => {
		if (vendorId) {
			loadVendor();
			loadDocuments();
			loadHistory();
		}
	});
</script>

<svelte:head>
	<title>{vendor?.name || 'Vendor'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/vendors')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if vendor}
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(vendor.status)}">
							{vendor.status}
						</span>
					</div>
					<h1 class="mt-1 text-xl font-semibold">{vendor.name}</h1>
				</div>

				<div class="flex gap-2">
					<a href="/app/cam/vendors/{vendor.id}/edit" class="btn btn-sm preset-tonal-surface">
						Edit
					</a>
					{#if vendor.status === 'PENDING'}
						<DecisionButton variant="approve" onclick={() => openApprovalModal('APPROVE')}>
							Approve
						</DecisionButton>
						<DecisionButton variant="deny" onclick={() => openApprovalModal('REJECT')}>
							Reject
						</DecisionButton>
						<DecisionButton variant="default" onclick={() => openApprovalModal('REQUEST_INFO')}>
							Request Info
						</DecisionButton>
					{:else if vendor.status === 'APPROVED'}
						<DecisionButton variant="deny" onclick={() => openApprovalModal('REJECT')}>
							Suspend
						</DecisionButton>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex h-64 items-center justify-center">
				<EmptyState title="Error" description={error} />
			</div>
		{:else if vendor}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'documents', label: 'Documents', content: documentsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if vendor}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Vendor Information</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Company Name</h4>
						<p class="mt-1">{vendor.name}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Status</h4>
						<p class="mt-1">
							<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(vendor.status)}">
								{vendor.status}
							</span>
						</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Trades</h4>
						<p class="mt-1">{vendor.trades.join(', ')}</p>
					</div>
					{#if vendor.licenseNumber}
						<div>
							<h4 class="text-sm font-medium text-surface-500">License Number</h4>
							<p class="mt-1">{vendor.licenseNumber}</p>
						</div>
					{/if}
					{#if vendor.insuranceExpiry}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Insurance Expiry</h4>
							<p class="mt-1">{formatDate(vendor.insuranceExpiry)}</p>
						</div>
					{/if}
					{#if vendor.rating !== undefined}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Rating</h4>
							<p class="mt-1">{vendor.rating.toFixed(1)} / 5.0</p>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Contact Information</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					{#if vendor.contactName}
						<div class="flex items-start gap-3">
							<Users class="mt-0.5 h-5 w-5 text-surface-400" />
							<div>
								<h4 class="text-sm font-medium text-surface-500">Contact Person</h4>
								<p class="mt-1">{vendor.contactName}</p>
							</div>
						</div>
					{/if}
					{#if vendor.email}
						<div class="flex items-start gap-3">
							<Mail class="mt-0.5 h-5 w-5 text-surface-400" />
							<div>
								<h4 class="text-sm font-medium text-surface-500">Email</h4>
								<p class="mt-1">
									<a href="mailto:{vendor.email}" class="text-primary-500 hover:underline">
										{vendor.email}
									</a>
								</p>
							</div>
						</div>
					{/if}
					{#if vendor.phone}
						<div class="flex items-start gap-3">
							<Phone class="mt-0.5 h-5 w-5 text-surface-400" />
							<div>
								<h4 class="text-sm font-medium text-surface-500">Phone</h4>
								<p class="mt-1">
									<a href="tel:{vendor.phone}" class="text-primary-500 hover:underline">
										{vendor.phone}
									</a>
								</p>
							</div>
						</div>
					{/if}
					{#if vendor.address}
						<div class="flex items-start gap-3">
							<MapPin class="mt-0.5 h-5 w-5 text-surface-400" />
							<div>
								<h4 class="text-sm font-medium text-surface-500">Address</h4>
								<p class="mt-1">{vendor.address}</p>
							</div>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Work Order History</h3>
				<div class="text-center py-4">
					<a href="/app/cam/work-orders?vendorId={vendor.id}" class="text-primary-500 hover:underline">
						View all work orders for this vendor →
					</a>
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Compliance Documents</h3>
			<button
				type="button"
				onclick={() => showUploadDocModal = true}
				class="btn btn-sm preset-filled-primary-500"
			>
				Upload
			</button>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="Insurance certificates, licenses, and contracts will appear here."
			/>
		{:else}
			<div class="divide-y divide-surface-300-700">
				{#each documents as doc}
					<div class="flex items-center gap-3 py-3">
						<FileText class="h-5 w-5 text-surface-400" />
						<div class="flex-1">
							<p class="font-medium">{doc.name}</p>
							<p class="text-sm text-surface-500">{doc.category} · {formatDate(doc.createdAt)}</p>
						</div>
						<a href="/api/document/{doc.id}/download" class="btn btn-sm preset-tonal-surface">
							Download
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

{#snippet historyTab()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Activity History</h3>

		{#if history.length === 0}
			<EmptyState
				title="No history"
				description="Approval changes and activity will appear here."
			/>
		{:else}
			<div class="space-y-4">
				{#each history as event}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-200-800">
							<Clock class="h-4 w-4 text-surface-500" />
						</div>
						<div class="flex-1">
							<p class="font-medium">{event.action}</p>
							<p class="text-sm text-surface-500">{event.description}</p>
							<p class="mt-1 text-xs text-surface-400">
								{event.performedBy} · {formatDateTime(event.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

<VendorApprovalModal
	open={showApprovalModal}
	vendorName={vendor?.name}
	action={approvalAction}
	loading={isActionLoading}
	onConfirm={handleApprovalConfirm}
	onCancel={() => {
		showApprovalModal = false;
		approvalAction = null;
	}}
/>

<UploadComplianceDocModal
	open={showUploadDocModal}
	vendorName={vendor?.name}
	loading={isUploadingDoc}
	onConfirm={handleUploadDocument}
	onCancel={() => showUploadDocModal = false}
/>
