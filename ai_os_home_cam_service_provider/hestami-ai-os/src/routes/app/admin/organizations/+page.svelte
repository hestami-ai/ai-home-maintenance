<script lang="ts">
	import {
		Building2,
		Search,
		RefreshCw,
		Loader2,
		Users,
		Briefcase,
		Home,
		CheckCircle,
		XCircle,
		MinusCircle,
		ChevronRight
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { goto } from '$app/navigation';
	import {
		ORGANIZATION_TYPE_LABELS,
		ORGANIZATION_STATUS_LABELS,
		ORGANIZATION_STATUS_BADGE_CLASSES,
		ORGANIZATION_TYPE_BADGE_CLASSES,
		ORGANIZATION_TYPES,
		ORGANIZATION_STATUSES,
		type OrganizationType,
		type OrganizationStatus,
		type OrganizationListItem,
		type OrganizationSummary
	} from '$lib/api/organizationAdmin';

	interface Props {
		data: {
			organizations: OrganizationListItem[];
			summary: OrganizationSummary;
			filters: {
				type: string;
				status: string;
				search: string;
			};
			isPlatformAdmin: boolean;
		};
	}

	let { data }: Props = $props();

	let organizations = $derived(data.organizations);
	let summary = $derived(data.summary);
	let isLoading = $state(false);

	// Filter state - initialized empty, synced via $effect
	let searchQuery = $state('');
	let typeFilter = $state('');
	let statusFilter = $state('');

	// Sync filters when data changes (navigation)
	$effect(() => {
		searchQuery = data.filters.search;
		typeFilter = data.filters.type;
		statusFilter = data.filters.status;
	});

	// Navigate with filter params
	function applyFilters() {
		const params = new URLSearchParams();
		if (typeFilter) params.set('type', typeFilter);
		if (statusFilter) params.set('status', statusFilter);
		if (searchQuery) params.set('search', searchQuery);
		goto(`/app/admin/organizations?${params.toString()}`);
	}

	function clearFilters() {
		searchQuery = '';
		typeFilter = '';
		statusFilter = '';
		goto('/app/admin/organizations');
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		applyFilters();
	}

	function handleFilterChange() {
		applyFilters();
	}

	function refreshPage() {
		window.location.reload();
	}

	// Client-side filtering for search (immediate feedback)
	const filteredOrganizations = $derived(
		organizations.filter((org) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				org.name.toLowerCase().includes(query) ||
				org.slug.toLowerCase().includes(query) ||
				(org.externalContactEmail?.toLowerCase().includes(query) ?? false)
			);
		})
	);

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStatusIcon(status: OrganizationStatus) {
		switch (status) {
			case 'ACTIVE':
				return CheckCircle;
			case 'SUSPENDED':
				return XCircle;
			case 'INACTIVE':
				return MinusCircle;
			default:
				return MinusCircle;
		}
	}

	function getStatusIconClass(status: OrganizationStatus): string {
		switch (status) {
			case 'ACTIVE':
				return 'text-success-500';
			case 'SUSPENDED':
				return 'text-error-500';
			case 'INACTIVE':
				return 'text-surface-500';
			default:
				return 'text-surface-500';
		}
	}
</script>

<svelte:head>
	<title>Organizations | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Organizations</h1>
				<p class="mt-1 text-surface-500">View and manage customer organizations</p>
			</div>
			<button onclick={refreshPage} class="btn preset-outlined-primary-500" disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Refresh
			</button>
		</div>

		<!-- Summary Stats -->
		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Building2 class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{summary.total}</p>
						<p class="text-sm text-surface-500">Total Organizations</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<CheckCircle class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{summary.byStatus.active}</p>
						<p class="text-sm text-surface-500">Active</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10">
						<XCircle class="h-5 w-5 text-error-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{summary.byStatus.suspended}</p>
						<p class="text-sm text-surface-500">Suspended</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-500/10">
						<MinusCircle class="h-5 w-5 text-surface-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{summary.byStatus.inactive}</p>
						<p class="text-sm text-surface-500">Inactive</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Filters -->
		<div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
			<form onsubmit={handleSearch} class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
				<input
					type="text"
					placeholder="Search by name, slug, or email..."
					bind:value={searchQuery}
					class="input w-full pl-10"
				/>
			</form>
			<div class="flex gap-2">
				<select bind:value={typeFilter} onchange={handleFilterChange} class="select w-48">
					<option value="">All Types</option>
					{#each ORGANIZATION_TYPES as orgType}
						<option value={orgType}>{ORGANIZATION_TYPE_LABELS[orgType]}</option>
					{/each}
				</select>
				<select bind:value={statusFilter} onchange={handleFilterChange} class="select w-36">
					<option value="">All Status</option>
					{#each ORGANIZATION_STATUSES as orgStatus}
						<option value={orgStatus}>{ORGANIZATION_STATUS_LABELS[orgStatus]}</option>
					{/each}
				</select>
				{#if typeFilter || statusFilter || searchQuery}
					<button onclick={clearFilters} class="btn preset-ghost text-sm">Clear</button>
				{/if}
			</div>
		</div>

		<!-- Organizations List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if filteredOrganizations.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No organizations found"
						description={searchQuery || typeFilter || statusFilter
							? 'Try adjusting your filters or search query.'
							: 'No organizations have been created yet.'}
					>
						{#snippet actions()}
							{#if searchQuery || typeFilter || statusFilter}
								<button onclick={clearFilters} class="btn preset-outlined-primary-500">
									Clear Filters
								</button>
							{/if}
						{/snippet}
					</EmptyState>
				</Card>
			{:else}
				<Card variant="outlined" padding="none">
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="border-b border-surface-300-700 bg-surface-50-950">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Organization
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Type
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Members
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Cases
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Created
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-200-800">
								{#each filteredOrganizations as org}
									{@const StatusIcon = getStatusIcon(org.status)}
									<tr class="hover:bg-surface-100-900 transition-colors">
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												<div
													class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10"
												>
													<Building2 class="h-5 w-5 text-primary-500" />
												</div>
												<div>
													<a
														href="/app/admin/organizations/{org.id}"
														class="font-medium hover:text-primary-500"
													>
														{org.name}
													</a>
													<p class="text-sm text-surface-500">{org.slug}</p>
												</div>
											</div>
										</td>
										<td class="px-6 py-4">
											<span class="badge {ORGANIZATION_TYPE_BADGE_CLASSES[org.type]} text-xs">
												{ORGANIZATION_TYPE_LABELS[org.type]}
											</span>
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center gap-2">
												<StatusIcon class="h-4 w-4 {getStatusIconClass(org.status)}" />
												<span class="badge {ORGANIZATION_STATUS_BADGE_CLASSES[org.status]}">
													{ORGANIZATION_STATUS_LABELS[org.status]}
												</span>
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center gap-1 text-sm text-surface-600">
												<Users class="h-4 w-4" />
												<span>{org.memberCount}</span>
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center gap-1 text-sm text-surface-600">
												<Briefcase class="h-4 w-4" />
												<span>{org.activeCaseCount}</span>
											</div>
										</td>
										<td class="px-6 py-4 text-sm text-surface-500">
											{formatDate(org.createdAt)}
										</td>
										<td class="px-6 py-4 text-right">
											<a
												href="/app/admin/organizations/{org.id}"
												class="btn btn-sm preset-outlined-surface-500"
											>
												View
												<ChevronRight class="ml-1 h-4 w-4" />
											</a>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card>
			{/if}
		</div>

		<!-- Type Breakdown (collapsible summary) -->
		<div class="mt-8">
			<h2 class="text-lg font-semibold mb-4">Organizations by Type</h2>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Community Associations</span>
					<span class="font-semibold">{summary.byType.communityAssociation}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Management Companies</span>
					<span class="font-semibold">{summary.byType.managementCompany}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Service Providers</span>
					<span class="font-semibold">{summary.byType.serviceProvider}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Property Owners</span>
					<span class="font-semibold">{summary.byType.individualPropertyOwner}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Trusts / LLCs</span>
					<span class="font-semibold">{summary.byType.trustOrLlc}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Commercial Clients</span>
					<span class="font-semibold">{summary.byType.commercialClient}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">External Vendors</span>
					<span class="font-semibold">{summary.byType.externalServiceProvider}</span>
				</div>
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
					<span class="text-sm text-surface-600">Platform Operators</span>
					<span class="font-semibold">{summary.byType.platformOperator}</span>
				</div>
			</div>
		</div>
	</div>
</PageContainer>
