<script lang="ts">
	import {
		Users,
		Plus,
		Search,
		Mail,
		Shield,
		ShieldCheck,
		Activity,
		UserX,
		UserCheck,
		Clock,
		ExternalLink,
		Loader2,
		Briefcase,
		Check
	} from 'lucide-svelte';
	import {
		SplitView,
		ListPanel,
		DetailPanel,
		InviteStaffModal
	} from '$lib/components/cam';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ActivityEntityTypeValues, StaffStatusValues, orgStaffApi, type OrgStaffDetail, type OrgStaffListItem } from '$lib/api/cam';
	import { activityEventApi } from '$lib/api/cam';
	import { nanoid } from 'nanoid';

	let { data } = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let staffMembers = $state<OrgStaffListItem[]>([]);
	let selectedStaffSummary = $state<OrgStaffListItem | null>(null);
	let selectedStaffDetail = $state<OrgStaffDetail | null>(null);
	let isLoadingDetail = $state(false);
	let isInviteModalOpen = $state(false);

	// Filters - use $state instead of $derived for safe navigation
	let searchQuery = $state('');
	let statusFilter = $state('');
	let roleFilter = $state('');

	// Sync state when data changes (e.g., URL params, navigation)
	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			staffMembers = (data.staffMembers ?? []) as OrgStaffListItem[];
			searchQuery = data.filters?.search ?? '';
			statusFilter = data.filters?.status ?? '';
			roleFilter = data.filters?.role ?? '';
		}
	});

	// Activity Data
	let activityEvents = $state<any[]>([]);
	let isLoadingActivity = $state(false);

	// Tabs
	let activeTab = $state('overview');

	async function loadStaffDetail(staff: OrgStaffListItem) {
		selectedStaffSummary = staff;
		isLoadingDetail = true;
		selectedStaffDetail = null;
		activityEvents = [];

		try {
			const [detailRes, activityRes] = await Promise.all([
				orgStaffApi.get(staff.id),
				activityEventApi.getByEntity({
					entityType: ActivityEntityTypeValues.STAFF,
					entityId: staff.id,
					limit: 10
				})
			]);

			if (detailRes.ok) {
				selectedStaffDetail = detailRes.data.staff;
			}
			if (activityRes.ok) {
				activityEvents = activityRes.data.events;
			}
		} catch (error) {
			console.error('Failed to load staff detail:', error);
		} finally {
			isLoadingDetail = false;
		}
	}

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchQuery) params.set('search', searchQuery);
		else params.delete('search');

		if (statusFilter) params.set('status', statusFilter);
		else params.delete('status');

		if (roleFilter) params.set('role', roleFilter);
		else params.delete('role');

		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	async function toggleStatus() {
		if (!selectedStaffDetail) return;

		const staffId = selectedStaffDetail.id;
		const isDeactivating = selectedStaffDetail.status !== StaffStatusValues.DEACTIVATED;

		if (isDeactivating && !confirm('Are you sure you want to deactivate this staff member?')) return;

		isLoadingDetail = true;
		try {
			let res;
			if (isDeactivating) {
				res = await orgStaffApi.deactivate({
					staffId,
					reason: 'Deactivated via management portal',
					idempotencyKey: nanoid()
				});
			} else {
				res = await orgStaffApi.activate({
					staffId,
					idempotencyKey: nanoid()
				});
			}

			if (res.ok) {
				// Refresh the page to get updated list, then reload detail if staff has user info
				await goto($page.url.pathname, { invalidateAll: true });
				// Find the updated staff in the refreshed list
				const updatedStaff = staffMembers.find(s => s.id === staffId);
				if (updatedStaff) {
					await loadStaffDetail(updatedStaff);
				}
			}
		} catch (error) {
			console.error('Failed to update status:', error);
		} finally {
			isLoadingDetail = false;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case StaffStatusValues.ACTIVE:
				return 'text-success-500 bg-success-500/10';
			case StaffStatusValues.PENDING:
				return 'text-warning-500 bg-warning-500/10';
			case StaffStatusValues.SUSPENDED:
				return 'text-error-500 bg-error-500/10';
			case StaffStatusValues.DEACTIVATED:
				return 'text-surface-500 bg-surface-500/10';
			default:
				return 'text-surface-500 bg-surface-500/10';
		}
	}

	function selectTab(tabId: string) {
		activeTab = tabId;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Page Header -->
	<header class="flex items-center justify-between border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
				<Users class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-xl font-bold">Staff & Roles</h1>
				<p class="text-sm text-surface-500">Manage organization staff members and their access levels.</p>
			</div>
		</div>
		<button
			type="button"
			onclick={() => (isInviteModalOpen = true)}
			class="btn variant-filled-primary flex items-center gap-2"
		>
			<Plus class="h-4 w-4" />
			<span>Invite Staff</span>
		</button>
	</header>

	<SplitView
		hasSelection={!!selectedStaffSummary}
		{listPanel}
		{detailPanel}
	/>
</div>

{#snippet listPanel()}
	<ListPanel {header} {items} />
{/snippet}

{#snippet header()}
	<div class="space-y-3">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
			<input
				type="text"
				placeholder="Search staff..."
				bind:value={searchQuery}
				oninput={handleSearch}
				class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			/>
		</div>
		<div class="flex gap-2">
			<select
				bind:value={statusFilter}
				onchange={handleSearch}
				class="flex-1 rounded-lg border border-surface-300-700 bg-surface-100-900 py-1.5 px-3 text-xs focus:ring-primary-500"
			>
				<option value="">All Statuses</option>
				<option value=StaffStatusValues.ACTIVE>Active</option>
				<option value=StaffStatusValues.PENDING>Pending</option>
				<option value=StaffStatusValues.DEACTIVATED>Deactivated</option>
			</select>
			<select
				bind:value={roleFilter}
				onchange={handleSearch}
				class="flex-1 rounded-lg border border-surface-300-700 bg-surface-100-900 py-1.5 px-3 text-xs focus:ring-primary-500"
			>
				<option value="">All Roles</option>
				<option value="ADMIN">Admin</option>
				<option value="MANAGER">Manager</option>
				<option value="COORDINATOR">Coordinator</option>
			</select>
		</div>
	</div>
{/snippet}

{#snippet items()}
	{#if staffMembers.length === 0}
		<div class="flex flex-col items-center justify-center p-12 text-surface-500">
			<Users class="mb-4 h-12 w-12 opacity-20" />
			<p>No staff members found.</p>
			<button 
				class="mt-4 text-sm text-primary-500 hover:underline"
				onclick={() => (isInviteModalOpen = true)}
			>
				Invite your first staff member
			</button>
		</div>
	{:else}
		{#each staffMembers as staff}
			<button
				type="button"
				onclick={() => loadStaffDetail(staff)}
				class="flex w-full items-center gap-4 border-b border-surface-300-700 p-4 text-left transition-colors hover:bg-surface-200-800 {selectedStaffSummary?.id === staff.id ? 'bg-primary-500/5 ring-inset ring-2 ring-primary-500' : ''}"
			>
				<div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-300-700">
					<div class="flex h-full w-full items-center justify-center text-lg font-bold text-white">
						{staff.displayName.charAt(0)}
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center justify-between gap-2">
						<p class="truncate font-semibold">{staff.displayName}</p>
						<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase {getStatusColor(staff.status)}">
							{staff.status}
						</span>
					</div>
					<p class="truncate text-xs text-surface-500">{staff.title || 'No Title'}</p>
					<p class="truncate text-xs text-surface-400 mt-1">{staff.user.email}</p>
				</div>
			</button>
		{/each}
	{/if}
{/snippet}

{#snippet detailPanel()}
	<DetailPanel {content} />
{/snippet}

{#snippet content()}
	{#if !selectedStaffSummary}
		<div class="flex h-full flex-col items-center justify-center text-surface-500">
			<div class="relative mb-6">
				<div class="absolute inset-0 animate-ping rounded-full bg-primary-500/20"></div>
				<div class="relative rounded-full bg-surface-200-800 p-8">
					<Users class="h-16 w-16 opacity-30" />
				</div>
			</div>
			<h3 class="text-xl font-bold text-surface-700-300">Select a staff member</h3>
			<p class="mt-2 max-w-xs text-center">Select someone from the list to view their details, permissions, and history.</p>
		</div>
	{:else}
		<div class="flex h-full flex-col">
			<!-- Detail Header -->
			<div class="border-b border-surface-300-700 bg-surface-100-900 p-6">
				<div class="flex items-start justify-between">
					<div class="flex gap-6">
						<div class="h-20 w-20 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-500">
							<span class="text-3xl font-bold">{selectedStaffSummary.displayName.charAt(0)}</span>
						</div>
						<div>
							<h2 class="text-2xl font-bold">{selectedStaffSummary.displayName}</h2>
							<p class="text-surface-500">{selectedStaffSummary.title || 'No Title'}</p>
							<div class="mt-3 flex items-center gap-4">
								<div class="flex items-center gap-1.5 text-sm text-surface-500">
									<Mail class="h-4 w-4" />
									<span>{selectedStaffSummary.user.email}</span>
								</div>
								<div class="flex items-center gap-1.5 text-sm text-surface-500">
									<Shield class="h-4 w-4" />
									<span>{selectedStaffSummary.roles.join(', ')}</span>
								</div>
							</div>
						</div>
					</div>
					<div class="flex flex-col items-end gap-3">
						<span class="rounded-full px-3 py-1 text-xs font-bold uppercase {getStatusColor(selectedStaffSummary.status)}">
							{selectedStaffSummary.status}
						</span>
						<button 
							onclick={toggleStatus}
							disabled={isLoadingDetail}
							class="btn btn-sm {selectedStaffSummary.status === StaffStatusValues.DEACTIVATED ? 'variant-soft-success' : 'variant-soft-error'} flex items-center gap-2"
						>
							{#if isLoadingDetail}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else if selectedStaffSummary.status === StaffStatusValues.DEACTIVATED}
								<UserCheck class="h-4 w-4" />
								<span>Reactivate Account</span>
							{:else}
								<UserX class="h-4 w-4" />
								<span>Deactivate Account</span>
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Custom Tabs (not using TabbedContent since it expects content in tab objects) -->
			<div class="flex-1 bg-surface-50-950 overflow-hidden flex flex-col">
				<div class="flex-shrink-0 border-b border-surface-300-700">
					<nav class="-mb-px flex space-x-4 px-6" aria-label="Tabs">
						<button
							type="button"
							onclick={() => selectTab('overview')}
							class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors flex items-center gap-2"
							class:border-primary-500={activeTab === 'overview'}
							class:text-primary-500={activeTab === 'overview'}
							class:border-transparent={activeTab !== 'overview'}
							class:text-surface-500={activeTab !== 'overview'}
						>
							<Users class="h-4 w-4" />
							Overview
						</button>
						<button
							type="button"
							onclick={() => selectTab('activity')}
							class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors flex items-center gap-2"
							class:border-primary-500={activeTab === 'activity'}
							class:text-primary-500={activeTab === 'activity'}
							class:border-transparent={activeTab !== 'activity'}
							class:text-surface-500={activeTab !== 'activity'}
						>
							<Activity class="h-4 w-4" />
							Activity
						</button>
						<button
							type="button"
							onclick={() => selectTab('permissions')}
							class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors flex items-center gap-2"
							class:border-primary-500={activeTab === 'permissions'}
							class:text-primary-500={activeTab === 'permissions'}
							class:border-transparent={activeTab !== 'permissions'}
							class:text-surface-500={activeTab !== 'permissions'}
						>
							<ShieldCheck class="h-4 w-4" />
							Permissions
						</button>
					</nav>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					{#if activeTab === 'overview'}
						<div class="grid grid-cols-2 gap-6">
							<div class="col-span-2 sm:col-span-1 rounded-xl bg-surface-100-900 p-5 border border-surface-300-700">
								<h4 class="text-sm font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-2 mb-4">
									<Clock class="h-4 w-4" /> Account History
								</h4>
								<div class="space-y-4">
									<div>
										<p class="text-xs text-surface-400">Created</p>
										<p class="text-sm font-medium">{new Date(selectedStaffSummary.createdAt).toLocaleDateString()}</p>
									</div>
									{#if selectedStaffDetail?.activatedAt}
										<div>
											<p class="text-xs text-surface-400">Activated</p>
											<p class="text-sm font-medium">{new Date(selectedStaffDetail.activatedAt).toLocaleDateString()}</p>
										</div>
									{/if}
									{#if selectedStaffDetail?.deactivatedAt}
										<div>
											<p class="text-xs text-error-500">Deactivated</p>
											<p class="text-sm font-medium text-error-500">{new Date(selectedStaffDetail.deactivatedAt).toLocaleDateString()}</p>
										</div>
									{/if}
								</div>
							</div>

							<div class="col-span-2 sm:col-span-1 rounded-xl bg-surface-100-900 p-5 border border-surface-300-700">
								<h4 class="text-sm font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-2 mb-4">
									<Briefcase class="h-4 w-4" /> Assignments
								</h4>
								<div class="space-y-4">
									<div class="flex items-center justify-between">
										<p class="text-sm">Can be assigned cases</p>
										<span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase {selectedStaffSummary.canBeAssignedCases ? 'bg-success-500/10 text-success-500' : 'bg-surface-500/10 text-surface-500'}">
											{selectedStaffSummary.canBeAssignedCases ? 'Yes' : 'No'}
										</span>
									</div>
									<div class="pt-2">
										<button class="text-xs text-primary-500 hover:underline flex items-center gap-1">
											View Active Cases <ExternalLink class="h-3 w-3" />
										</button>
									</div>
								</div>
							</div>
						</div>
					{:else if activeTab === 'activity'}
						<div class="space-y-6">
							<div class="flex items-center justify-between">
								<h4 class="font-semibold">Recent Activity</h4>
								<button 
									class="text-xs text-primary-500 hover:underline"
									onclick={() => selectedStaffSummary && loadStaffDetail(selectedStaffSummary)}
								>
									Refresh
								</button>
							</div>
							
							{#if isLoadingActivity}
								<div class="flex justify-center p-8">
									<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
								</div>
							{:else if activityEvents.length === 0}
								<div class="text-center p-12 text-surface-500 italic">
									No recent activity found.
								</div>
							{:else}
								<div class="relative space-y-8 pl-8 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-surface-300-700">
									{#each activityEvents as event}
										<div class="relative">
											<div class="absolute -left-8 top-1 h-6 w-6 rounded-full border-2 border-surface-50-950 bg-primary-500 flex items-center justify-center text-white">
												<Check class="h-3 w-3" />
											</div>
											<div>
												<p class="text-sm font-medium">{event.summary}</p>
												<p class="text-xs text-surface-500 mt-1">
													{new Date(event.createdAt).toLocaleString()}
												</p>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{:else if activeTab === 'permissions'}
						<div class="space-y-6">
							<div>
								<h4 class="font-semibold mb-4">Pillar Access</h4>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{#each selectedStaffSummary.pillarAccess as pillar}
										<div class="flex items-center gap-3 rounded-lg border border-primary-500/30 bg-primary-500/5 p-4">
											<ShieldCheck class="h-6 w-6 text-primary-500" />
											<div>
												<p class="font-bold text-primary-500">{pillar}</p>
												<p class="text-xs text-surface-500">Full access to this administrative pillar</p>
											</div>
										</div>
									{/each}
								</div>
							</div>

							<hr class="border-surface-300-700" />

							<div>
								<h4 class="font-semibold mb-4 text-surface-400 italic">Granular Roles (Locked)</h4>
								<div class="space-y-2 opacity-60">
									{#each selectedStaffSummary.roles as role}
										<div class="flex items-center justify-between p-2 border-b border-surface-300-700 text-sm">
											<span>{role}</span>
											<Shield class="h-4 w-4" />
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{/snippet}

<InviteStaffModal
	bind:open={isInviteModalOpen}
	orgType={data?.organization?.type || ''}
	onClose={() => {}}
	onSuccess={async () => {
		await goto($page.url.pathname, { invalidateAll: true });
	}}
/>
