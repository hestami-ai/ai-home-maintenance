<script lang="ts">
	import {
		Users,
		Plus,
		Search,
		MoreVertical,
		UserCheck,
		UserX,
		Shield,
		Loader2,
		Wrench
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		SERVICE_PROVIDER_ROLE_LABELS,
		SERVICE_PROVIDER_STATUS_LABELS,
		type ServiceProviderTeamMemberListItem,
		type ServiceProviderTeamMemberStatus,
		type ServiceProviderRole
	} from '$lib/api/serviceProviderTeam';
	import { StaffStatusValues, ServiceProviderRoleValues } from '$lib/api/cam';

	interface Props {
		data: {
			teamMembers: ServiceProviderTeamMemberListItem[];
			filters: {
				status: ServiceProviderTeamMemberStatus | '';
				role: ServiceProviderRole | '';
			};
		};
	}

	let { data }: Props = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let teamMembers = $state<ServiceProviderTeamMemberListItem[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let statusFilter = $state<ServiceProviderTeamMemberStatus | ''>('');
	let roleFilter = $state<ServiceProviderRole | ''>('');

	// Sync state from server data
	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			teamMembers = data.teamMembers ?? [];
			statusFilter = data.filters?.status ?? '';
			roleFilter = data.filters?.role ?? '';
		}
	});

	function loadTeamMembers() {
		const params = new URLSearchParams();
		if (statusFilter) params.set('status', statusFilter);
		if (roleFilter) params.set('role', roleFilter);
		window.location.href = `/app/contractor/admin/team?${params.toString()}`;
	}

	$effect(() => {
		if (!data) return;
		// Reload when filters change (but only after initial sync)
		if (statusFilter !== '' && statusFilter !== data.filters?.status) {
			loadTeamMembers();
		} else if (roleFilter !== '' && roleFilter !== data.filters?.role) {
			loadTeamMembers();
		}
	});

	const filteredMembers = $derived(
		teamMembers.filter((member) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				member.displayName.toLowerCase().includes(query) ||
				member.user.email.toLowerCase().includes(query) ||
				(member.title?.toLowerCase().includes(query) ?? false)
			);
		})
	);

	function getStatusBadgeClass(status: ServiceProviderTeamMemberStatus): string {
		const colorMap: Record<ServiceProviderTeamMemberStatus, string> = {
			[StaffStatusValues.PENDING]: 'preset-filled-warning-500',
			[StaffStatusValues.ACTIVE]: 'preset-filled-success-500',
			[StaffStatusValues.SUSPENDED]: 'preset-filled-error-500',
			[StaffStatusValues.DEACTIVATED]: 'preset-filled-surface-500'
		};
		return colorMap[status] || 'preset-filled-surface-500';
	}

	function handleFilterChange() {
		loadTeamMembers();
	}
</script>

<svelte:head>
	<title>Team Management | Contractor Portal</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Team Management</h1>
				<p class="mt-1 text-surface-500">Manage your organization's team members and their roles</p>
			</div>
			<a href="/app/contractor/admin/team/new" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				Add Team Member
			</a>
		</div>

		<!-- Filters -->
		<div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
				<input
					type="text"
					placeholder="Search by name, email, or title..."
					bind:value={searchQuery}
					class="input w-full pl-10"
				/>
			</div>
			<div class="flex gap-2">
				<select bind:value={statusFilter} onchange={handleFilterChange} class="select w-40">
					<option value="">All Status</option>
					<option value={StaffStatusValues.PENDING}>Pending</option>
					<option value={StaffStatusValues.ACTIVE}>Active</option>
					<option value={StaffStatusValues.SUSPENDED}>Suspended</option>
					<option value={StaffStatusValues.DEACTIVATED}>Deactivated</option>
				</select>
				<select bind:value={roleFilter} onchange={handleFilterChange} class="select w-48">
					<option value="">All Roles</option>
					<option value={ServiceProviderRoleValues.OWNER}>Owner</option>
					<option value={ServiceProviderRoleValues.ADMIN}>Administrator</option>
					<option value={ServiceProviderRoleValues.OFFICE_MANAGER}>Office Manager</option>
					<option value={ServiceProviderRoleValues.DISPATCHER}>Dispatcher</option>
					<option value={ServiceProviderRoleValues.ESTIMATOR}>Estimator</option>
					<option value={ServiceProviderRoleValues.BOOKKEEPER}>Bookkeeper</option>
					<option value={ServiceProviderRoleValues.TECHNICIAN}>Technician</option>
				</select>
			</div>
		</div>

		<!-- Team Members List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="lg">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={loadTeamMembers} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if filteredMembers.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No team members found"
						description={searchQuery || statusFilter || roleFilter
							? 'Try adjusting your filters or search query.'
							: 'Get started by adding your first team member.'}
					>
						{#snippet actions()}
							{#if !searchQuery && !statusFilter && !roleFilter}
								<a href="/app/contractor/admin/team/new" class="btn preset-filled-primary-500">
									<Plus class="mr-2 h-4 w-4" />
									Add Team Member
								</a>
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
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Team Member
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Roles
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Status
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
										Joined
									</th>
									<th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-200-800">
								{#each filteredMembers as member}
									<tr class="hover:bg-surface-100-900 transition-colors">
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
													{#if member.technicianId}
														<Wrench class="h-5 w-5 text-primary-500" />
													{:else}
														<Users class="h-5 w-5 text-primary-500" />
													{/if}
												</div>
												<div>
													<a
														href="/app/contractor/admin/team/{member.id}"
														class="font-medium hover:text-primary-500"
													>
														{member.displayName}
													</a>
													<p class="text-sm text-surface-500">{member.user.email}</p>
													{#if member.title}
														<p class="text-xs text-surface-400">{member.title}</p>
													{/if}
												</div>
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="flex flex-wrap gap-1">
												{#each member.roles.slice(0, 2) as role}
													<span class="badge preset-outlined-surface-500 text-xs">
														{SERVICE_PROVIDER_ROLE_LABELS[role]}
													</span>
												{/each}
												{#if member.roles.length > 2}
													<span class="badge preset-outlined-surface-500 text-xs">
														+{member.roles.length - 2}
													</span>
												{/if}
											</div>
										</td>
										<td class="px-6 py-4">
											<span class="badge {getStatusBadgeClass(member.status)}">
												{SERVICE_PROVIDER_STATUS_LABELS[member.status]}
											</span>
										</td>
										<td class="px-6 py-4 text-sm text-surface-500">
											{new Date(member.createdAt).toLocaleDateString()}
										</td>
										<td class="px-6 py-4 text-right">
											<div class="flex items-center justify-end gap-2">
												<a
													href="/app/contractor/admin/team/{member.id}"
													class="btn btn-sm preset-outlined-surface-500"
												>
													View
												</a>
												<button class="btn btn-sm preset-ghost">
													<MoreVertical class="h-4 w-4" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card>
			{/if}
		</div>

		<!-- Stats Summary -->
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Users class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{teamMembers.length}</p>
						<p class="text-sm text-surface-500">Total Members</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<UserCheck class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{teamMembers.filter((m) => m.status === StaffStatusValues.ACTIVE).length}
						</p>
						<p class="text-sm text-surface-500">Active</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Shield class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{teamMembers.filter((m) => m.status === StaffStatusValues.PENDING).length}
						</p>
						<p class="text-sm text-surface-500">Pending</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10">
						<UserX class="h-5 w-5 text-error-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{teamMembers.filter((m) => m.status === StaffStatusValues.SUSPENDED).length}
						</p>
						<p class="text-sm text-surface-500">Suspended</p>
					</div>
				</div>
			</Card>
		</div>
	</div>
</PageContainer>
