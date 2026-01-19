<script lang="ts">
	import { Users, Plus, Search } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { VendorApprovalStatusValues, type Vendor, vendorApi } from '$lib/api/cam';

	interface VendorListItem extends Vendor {
		licenseExpiry?: string;
		createdAt?: string;
	}

	let vendors = $state<Vendor[]>([]);
	let selectedVendor = $state<Vendor | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('');

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: VendorApprovalStatusValues.APPROVED, label: 'Approved' },
		{ value: VendorApprovalStatusValues.PENDING, label: 'Pending' },
		{ value: VendorApprovalStatusValues.SUSPENDED, label: 'Suspended' }
	];

	async function loadVendors() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { status?: string; search?: string } = {};
			if (statusFilter) params.status = statusFilter;
			if (searchQuery) params.search = searchQuery;

			const response = await vendorApi.list(params as any);
			if (response.ok) {
				vendors = response.data.vendors as VendorListItem[];
			}
		} catch (error) {
			console.error('Failed to load vendors:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectVendor(vendor: Vendor) {
		selectedVendor = vendor;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case VendorApprovalStatusValues.APPROVED: return 'text-success-500 bg-success-500/10';
			case VendorApprovalStatusValues.PENDING: return 'text-warning-500 bg-warning-500/10';
			case VendorApprovalStatusValues.SUSPENDED: return 'text-error-500 bg-error-500/10';
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

	const filteredVendors = $derived(
		vendors.filter((v: any) =>
			v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(v.trades || []).some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadVendors();
		}
	});

	$effect(() => {
		loadVendors();
	});
</script>

<svelte:head>
	<title>Vendors | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedVendor}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Vendors</h1>
						<a href="/app/cam/vendors/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							Add
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search vendors..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<select
						bind:value={statusFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredVendors.length === 0}
					<div class="p-6">
						<EmptyState
							title="No vendors found"
							description={searchQuery || statusFilter
								? 'Try adjusting your filters.'
								: 'No approved vendors yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredVendors as vendor}
							<button
								type="button"
								onclick={() => selectVendor(vendor)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedVendor?.id === vendor.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="font-medium">{vendor.name}</p>
										<p class="mt-0.5 text-sm text-surface-500">
											{(vendor as any).trades?.join(', ') || ''}
										</p>
									</div>
									<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor((vendor as any).status || 'ACTIVE')}">
										{(vendor as any).status || 'Active'}
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedVendor}
			<DetailPanel>
				{#snippet header()}
					{@const v = selectedVendor!}
					<div>
						<div class="flex items-center gap-2">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor((v as any).status || 'ACTIVE')}">
								{(v as any).status || 'Active'}
							</span>
						</div>
						<h2 class="mt-1 text-xl font-semibold">{v.name}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const v = selectedVendor!}
					<a href="/app/cam/vendors/{v.id}/edit" class="btn btn-sm preset-tonal-surface">
						Edit
					</a>
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{ id: 'overview', label: 'Overview', content: overviewTab },
							{ id: 'documents', label: 'Documents', content: documentsTab },
							{ id: 'history', label: 'History', content: historyTab }
						]}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<Users class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a vendor to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedVendor}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Company Name</h3>
					<p class="mt-1">{selectedVendor.name}</p>
				</div>
				{#if selectedVendor.contactName}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Contact</h3>
						<p class="mt-1">{selectedVendor.contactName}</p>
					</div>
				{/if}
				{#if selectedVendor.email}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Email</h3>
						<p class="mt-1">
							<a href="mailto:{selectedVendor.email}" class="text-primary-500 hover:underline">
								{selectedVendor.email}
							</a>
						</p>
					</div>
				{/if}
				{#if selectedVendor.phone}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Phone</h3>
						<p class="mt-1">{selectedVendor.phone}</p>
					</div>
				{/if}
				<div class="sm:col-span-2">
					<h3 class="text-sm font-medium text-surface-500">Trades</h3>
					<div class="mt-1 flex flex-wrap gap-1">
						{#each (selectedVendor as any).trades || [] as trade}
							<span class="rounded bg-surface-200-800 px-2 py-0.5 text-sm">{trade}</span>
						{/each}
					</div>
				</div>
				{#if (selectedVendor as any).insuranceExpiry}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Insurance Expiry</h3>
						<p class="mt-1">{formatDate((selectedVendor as any).insuranceExpiry)}</p>
					</div>
				{/if}
				{#if (selectedVendor as any).licenseExpiry}
					<div>
						<h3 class="text-sm font-medium text-surface-500">License Expiry</h3>
						<p class="mt-1">{formatDate((selectedVendor as any).licenseExpiry)}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Insurance, licenses, and contracts will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Work order history and performance will appear here."
	/>
{/snippet}
