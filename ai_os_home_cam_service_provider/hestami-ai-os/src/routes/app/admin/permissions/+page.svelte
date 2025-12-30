<script lang="ts">
	import {
		Shield,
		Users,
		Building2,
		Clock,
		Activity,
		ChevronRight,
		Loader2,
		Search,
		Filter,
		ExternalLink,
		RefreshCw
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		permissionsAdminApi,
		ORGANIZATION_TYPE_LABELS,
		USER_ROLE_LABELS,
		AUDIT_ACTION_LABELS,
		type PermissionStats,
		type OrganizationListItem,
		type RecentChange,
		type OrganizationType,
		type OrganizationStatus
	} from '$lib/api/permissionsAdmin';

	// Tab state
	type TabId = 'overview' | 'organizations' | 'roles' | 'audit';
	interface Props {
		data: {
			stats: PermissionStats | null;
			organizations: OrganizationListItem[];
			recentChanges: RecentChange[];
			filters: {
				orgSearch: string;
				orgType: OrganizationType | '';
				orgStatus: OrganizationStatus | '';
			};
		};
	}

	let { data }: Props = $props();

	// Tab state
	let activeTab = $state<TabId>('overview');


	// Data state
	let stats = $derived(data.stats);
	let organizations = $state<OrganizationListItem[]>([]);
	let recentChanges = $derived(data.recentChanges);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Organization filters (initialized with defaults, synced via $effect)
	let orgSearch = $state('');
	let orgTypeFilter = $state<OrganizationType | ''>('');
	let orgStatusFilter = $state<OrganizationStatus | ''>('');

	// Synchronize server data to local state
	$effect(() => {
		if (data.organizations) {
			organizations = [...data.organizations];
		}
		orgSearch = data.filters.orgSearch;
		orgTypeFilter = data.filters.orgType;
		orgStatusFilter = data.filters.orgStatus;
	});

	const tabs = [
		{ id: 'overview' as TabId, label: 'Overview', icon: Activity },
		{ id: 'organizations' as TabId, label: 'Organization Roles', icon: Building2 },
		{ id: 'roles' as TabId, label: 'Role Definitions', icon: Shield },
		{ id: 'audit' as TabId, label: 'Audit Log', icon: Clock }
	];

	async function loadData() {
		// Full refresh via window location
		window.location.reload();
	}

	async function loadOrganizations() {
		// Update URL for org filtering
		const params = new URLSearchParams();
		if (orgSearch) params.set('orgSearch', orgSearch);
		if (orgTypeFilter) params.set('orgType', orgTypeFilter);
		if (orgStatusFilter) params.set('orgStatus', orgStatusFilter);
		
		window.location.href = `/app/admin/permissions?${params.toString()}`;
	}


	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Permissions | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Permissions Management</h1>
				<p class="mt-1 text-surface-500">
					View role assignments and permission audit across all organizations
				</p>
			</div>
			<div class="flex gap-2">
				<a href="/app/admin/staff" class="btn preset-outlined-primary-500">
					<Users class="mr-2 h-4 w-4" />
					Staff Management
				</a>
				<button onclick={loadData} class="btn preset-outlined-surface-500" disabled={isLoading}>
					<RefreshCw class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
					Refresh
				</button>
			</div>
		</div>

		<!-- Tabs -->
		<div class="mt-6 border-b border-surface-300-700">
			<nav class="flex gap-4">
				{#each tabs as tab}
					<button
						onclick={() => (activeTab = tab.id)}
						class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === tab.id
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}"
					>
						<tab.icon class="h-4 w-4" />
						{tab.label}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Content -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="lg">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={loadData} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if activeTab === 'overview'}
				<!-- Overview Dashboard -->
				<div class="space-y-6">
					<!-- Stats Cards -->
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
									<Building2 class="h-5 w-5 text-primary-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{stats?.totalOrganizations ?? 0}</p>
									<p class="text-sm text-surface-500">Organizations</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
									<Building2 class="h-5 w-5 text-success-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{stats?.activeOrganizations ?? 0}</p>
									<p class="text-sm text-surface-500">Active Orgs</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
									<Users class="h-5 w-5 text-warning-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
									<p class="text-sm text-surface-500">Total Users</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
									<Shield class="h-5 w-5 text-secondary-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{stats?.totalMemberships ?? 0}</p>
									<p class="text-sm text-surface-500">Role Assignments</p>
								</div>
							</div>
						</Card>
					</div>

					<!-- Role Distribution & Recent Changes -->
					<div class="grid gap-6 lg:grid-cols-2">
						<!-- Role Distribution -->
						<Card variant="outlined" padding="lg">
							<h3 class="text-lg font-semibold">Role Distribution</h3>
							<div class="mt-4 space-y-3">
								{#if stats?.roleDistribution && stats.roleDistribution.length > 0}
									{#each stats.roleDistribution as role}
										<div class="flex items-center justify-between">
											<span class="text-sm">{USER_ROLE_LABELS[role.role] ?? role.role}</span>
											<div class="flex items-center gap-2">
												<div class="h-2 w-24 rounded-full bg-surface-200 dark:bg-surface-700">
													<div
														class="h-2 rounded-full bg-primary-500"
														style="width: {Math.min((role.count / (stats?.totalMemberships || 1)) * 100, 100)}%"
													></div>
												</div>
												<span class="text-sm font-medium w-12 text-right">{role.count}</span>
											</div>
										</div>
									{/each}
								{:else}
									<p class="text-sm text-surface-500">No role data available</p>
								{/if}
							</div>
						</Card>

						<!-- Recent Changes -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h3 class="text-lg font-semibold">Recent Permission Changes</h3>
								<button
									onclick={() => (activeTab = 'audit')}
									class="text-sm text-primary-500 hover:underline"
								>
									View All
								</button>
							</div>
							<div class="mt-4 space-y-3">
								{#if recentChanges.length > 0}
									{#each recentChanges.slice(0, 5) as change}
										<div class="flex items-start gap-3 rounded-lg border border-surface-200-800 p-3">
											<div class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100-900">
												<Activity class="h-4 w-4 text-surface-500" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="text-sm font-medium truncate">{change.summary}</p>
												<div class="mt-1 flex items-center gap-2 text-xs text-surface-500">
													<span>{change.actorName ?? 'System'}</span>
													<span>•</span>
													<span>{formatShortDate(change.timestamp)}</span>
												</div>
											</div>
										</div>
									{/each}
								{:else}
									<p class="text-sm text-surface-500">No recent changes</p>
								{/if}
							</div>
						</Card>
					</div>

					<!-- Organization Type Distribution -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold">Organization Types</h3>
						<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#if stats?.organizationTypeDistribution && stats.organizationTypeDistribution.length > 0}
								{#each stats.organizationTypeDistribution as orgType}
									<div class="rounded-lg border border-surface-200-800 p-4">
										<p class="text-2xl font-bold">{orgType.count}</p>
										<p class="text-sm text-surface-500">
											{ORGANIZATION_TYPE_LABELS[orgType.type] ?? orgType.type}
										</p>
									</div>
								{/each}
							{:else}
								<p class="text-sm text-surface-500">No organization data available</p>
							{/if}
						</div>
					</Card>
				</div>

			{:else if activeTab === 'organizations'}
				<!-- Organization Roles List -->
				<div class="space-y-4">
					<!-- Filters -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
						<div class="relative flex-1">
							<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
							<input
								type="text"
								placeholder="Search organizations..."
								bind:value={orgSearch}
								onkeyup={(e) => e.key === 'Enter' && loadOrganizations()}
								class="input w-full pl-10"
							/>
						</div>
						<div class="flex gap-2">
							<select bind:value={orgTypeFilter} onchange={loadOrganizations} class="select w-48">
								<option value="">All Types</option>
								{#each Object.entries(ORGANIZATION_TYPE_LABELS) as [value, label]}
									<option {value}>{label}</option>
								{/each}
							</select>
							<select bind:value={orgStatusFilter} onchange={loadOrganizations} class="select w-32">
								<option value="">All Status</option>
								<option value="ACTIVE">Active</option>
								<option value="SUSPENDED">Suspended</option>
								<option value="INACTIVE">Inactive</option>
							</select>
						</div>
					</div>

					<!-- Organizations Table -->
					<Card variant="outlined" padding="none">
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead class="border-b border-surface-300-700 bg-surface-50-950">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Organization
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Type
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Members
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Admins
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Status
										</th>
										<th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">
											Actions
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-200-800">
									{#each organizations as org}
										<tr class="hover:bg-surface-100-900 transition-colors">
											<td class="px-6 py-4">
												<div>
													<p class="font-medium">{org.name}</p>
													<p class="text-xs text-surface-500">{org.slug}</p>
												</div>
											</td>
											<td class="px-6 py-4 text-sm">
												{ORGANIZATION_TYPE_LABELS[org.type] ?? org.type}
											</td>
											<td class="px-6 py-4 text-sm font-medium">
												{org.memberCount}
											</td>
											<td class="px-6 py-4 text-sm">
												{org.adminCount}
											</td>
											<td class="px-6 py-4">
												<span class="badge {org.status === 'ACTIVE' ? 'preset-filled-success-500' : 'preset-filled-surface-500'}">
													{org.status}
												</span>
											</td>
											<td class="px-6 py-4 text-right">
												<a
													href="/app/admin/permissions/org/{org.id}"
													class="btn btn-sm preset-outlined-primary-500"
												>
													View Details
												</a>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="6" class="px-6 py-12 text-center text-surface-500">
												No organizations found
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</Card>
				</div>

			{:else if activeTab === 'roles'}
				<!-- Role Definitions (Placeholder) -->
				<Card variant="outlined" padding="lg">
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10">
							<Shield class="h-10 w-10 text-primary-500" />
						</div>
						<h2 class="text-xl font-semibold">Role Definitions</h2>
						<p class="mt-2 max-w-md text-surface-500">
							This view will display what each role can do, derived from Cerbos policies.
							Coming in Phase 22.2.
						</p>
					</div>
				</Card>

			{:else if activeTab === 'audit'}
				<!-- Audit Log (Basic) -->
				<Card variant="outlined" padding="lg">
					<h3 class="text-lg font-semibold mb-4">Permission Audit Log</h3>
					<div class="space-y-3">
						{#if recentChanges.length > 0}
							{#each recentChanges as change}
								<div class="flex items-start gap-4 rounded-lg border border-surface-200-800 p-4">
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100-900">
										<Activity class="h-5 w-5 text-surface-500" />
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-4">
											<div>
												<p class="font-medium">{change.summary}</p>
												<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-surface-500">
													<span class="badge preset-outlined-surface-500 text-xs">
														{AUDIT_ACTION_LABELS[change.action] ?? change.action}
													</span>
													<span class="badge preset-outlined-surface-500 text-xs">
														{change.entityType}
													</span>
													{#if change.organizationName}
														<span>in {change.organizationName}</span>
													{/if}
												</div>
											</div>
											<div class="text-right text-sm text-surface-500 whitespace-nowrap">
												<p>{change.actorName ?? 'System'}</p>
												<p class="text-xs">{formatDate(change.timestamp)}</p>
											</div>
										</div>
									</div>
								</div>
							{/each}
						{:else}
							<p class="text-center text-surface-500 py-8">No audit events found</p>
						{/if}
					</div>
					<p class="mt-4 text-sm text-surface-500">
						Advanced filtering and export coming in Phase 22.2.
					</p>
				</Card>
			{/if}
		</div>
	</div>
</PageContainer>
