<script lang="ts">
	import {
		Users,
		Plus,
		Search,
		Filter,
		MoreVertical,
		UserCheck,
		UserX,
		Shield,
		Loader2
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		staffApi,
		STAFF_ROLE_LABELS,
		STAFF_STATUS_LABELS,
		STAFF_STATUS_COLORS,
		type StaffListItem,
		type StaffStatus,
		type StaffRole
	} from '$lib/api/staff';

	interface Props {
		data: {
			staffList: StaffListItem[];
			filters: {
				status: StaffStatus | '';
				role: StaffRole | '';
			};
		};
	}

	let { data }: Props = $props();

	let staffList = $derived(data.staffList);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let statusFilter = $state<StaffStatus | ''>('');
	let roleFilter = $state<StaffRole | ''>('');

	// Sync filters from server data
	$effect(() => {
		statusFilter = data.filters.status;
		roleFilter = data.filters.role;
	});

	async function loadStaff() {
		const params = new URLSearchParams();
		if (statusFilter) params.set('status', statusFilter);
		if (roleFilter) params.set('role', roleFilter);
		window.location.href = `/app/admin/staff?${params.toString()}`;
	}

	$effect(() => {
		// Reload when filters change (but only after initial sync)
		if (statusFilter !== '' && statusFilter !== data.filters.status) {
			loadStaff();
		} else if (roleFilter !== '' && roleFilter !== data.filters.role) {
			loadStaff();
		}
	});


	const filteredStaff = $derived(
		staffList.filter((staff) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				staff.displayName.toLowerCase().includes(query) ||
				staff.user.email.toLowerCase().includes(query) ||
				(staff.title?.toLowerCase().includes(query) ?? false)
			);
		})
	);

	function getStatusBadgeClass(status: StaffStatus): string {
		const colorMap: Record<StaffStatus, string> = {
			PENDING: 'preset-filled-warning-500',
			ACTIVE: 'preset-filled-success-500',
			SUSPENDED: 'preset-filled-error-500',
			DEACTIVATED: 'preset-filled-surface-500'
		};
		return colorMap[status] || 'preset-filled-surface-500';
	}
</script>

<svelte:head>
	<title>Staff Management | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Staff Management</h1>
				<p class="mt-1 text-surface-500">Manage Hestami platform staff members</p>
			</div>
			<a href="/app/admin/staff/new" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				Add Staff Member
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
				<select bind:value={statusFilter} class="select w-40">
					<option value="">All Status</option>
					<option value="PENDING">Pending</option>
					<option value="ACTIVE">Active</option>
					<option value="SUSPENDED">Suspended</option>
					<option value="DEACTIVATED">Deactivated</option>
				</select>
				<select bind:value={roleFilter} class="select w-48">
					<option value="">All Roles</option>
					<option value="CONCIERGE_OPERATOR">Concierge Operator</option>
					<option value="OPERATIONS_COORDINATOR">Operations Coordinator</option>
					<option value="CAM_SPECIALIST">CAM Specialist</option>
					<option value="VENDOR_LIAISON">Vendor Liaison</option>
					<option value="PLATFORM_ADMIN">Platform Admin</option>
				</select>
			</div>
		</div>

		<!-- Staff List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="lg">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={loadStaff} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if filteredStaff.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No staff members found"
						description={searchQuery || statusFilter || roleFilter
							? 'Try adjusting your filters or search query.'
							: 'Get started by adding your first staff member.'}
					>
						{#snippet actions()}
							{#if !searchQuery && !statusFilter && !roleFilter}
								<a href="/app/admin/staff/new" class="btn preset-filled-primary-500">
									<Plus class="mr-2 h-4 w-4" />
									Add Staff Member
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
										Staff Member
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
								{#each filteredStaff as staff}
									<tr class="hover:bg-surface-100-900 transition-colors">
										<td class="px-6 py-4">
											<div class="flex items-center gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
													<Users class="h-5 w-5 text-primary-500" />
												</div>
												<div>
													<a
														href="/app/admin/staff/{staff.id}"
														class="font-medium hover:text-primary-500"
													>
														{staff.displayName}
													</a>
													<p class="text-sm text-surface-500">{staff.user.email}</p>
													{#if staff.title}
														<p class="text-xs text-surface-400">{staff.title}</p>
													{/if}
												</div>
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="flex flex-wrap gap-1">
												{#each staff.roles.slice(0, 2) as role}
													<span class="badge preset-outlined-surface-500 text-xs">
														{STAFF_ROLE_LABELS[role]}
													</span>
												{/each}
												{#if staff.roles.length > 2}
													<span class="badge preset-outlined-surface-500 text-xs">
														+{staff.roles.length - 2}
													</span>
												{/if}
											</div>
										</td>
										<td class="px-6 py-4">
											<span class="badge {getStatusBadgeClass(staff.status)}">
												{STAFF_STATUS_LABELS[staff.status]}
											</span>
										</td>
										<td class="px-6 py-4 text-sm text-surface-500">
											{new Date(staff.createdAt).toLocaleDateString()}
										</td>
										<td class="px-6 py-4 text-right">
											<div class="flex items-center justify-end gap-2">
												<a
													href="/app/admin/staff/{staff.id}"
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
						<p class="text-2xl font-bold">{staffList.length}</p>
						<p class="text-sm text-surface-500">Total Staff</p>
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
							{staffList.filter((s) => s.status === 'ACTIVE').length}
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
							{staffList.filter((s) => s.status === 'PENDING').length}
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
							{staffList.filter((s) => s.status === 'SUSPENDED').length}
						</p>
						<p class="text-sm text-surface-500">Suspended</p>
					</div>
				</div>
			</Card>
		</div>
	</div>
</PageContainer>
