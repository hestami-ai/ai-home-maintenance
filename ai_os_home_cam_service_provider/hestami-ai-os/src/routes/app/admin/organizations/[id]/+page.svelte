<script lang="ts">
	import {
		ArrowLeft,
		Building2,
		Users,
		Briefcase,
		Home,
		FileText,
		Clock,
		Mail,
		Phone,
		User,
		Edit,
		Ban,
		CheckCircle,
		XCircle,
		MinusCircle,
		Loader2,
		AlertTriangle
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { invalidateAll } from '$app/navigation';
	import {
		ORGANIZATION_TYPE_LABELS,
		ORGANIZATION_TYPE_DESCRIPTIONS,
		ORGANIZATION_STATUS_LABELS,
		ORGANIZATION_STATUS_BADGE_CLASSES,
		ORGANIZATION_TYPE_BADGE_CLASSES,
		ORGANIZATION_TYPE_TABS,
		TAB_LABELS,
		USER_ROLE_LABELS,
		organizationAdminApi,
		type OrganizationDetail,
		type OrganizationMember,
		type OrganizationType,
		type OrganizationStatus
	} from '$lib/api/organizationAdmin';

	interface Props {
		data: {
			organization: OrganizationDetail;
			members: OrganizationMember[];
			membersHasMore: boolean;
			isPlatformAdmin: boolean;
		};
	}

	let { data }: Props = $props();

	let organization = $derived(data.organization);
	let members = $derived(data.members);
	let isPlatformAdmin = $derived(data.isPlatformAdmin);

	// UI State
	let activeTab = $state('overview');
	let isUpdating = $state(false);
	let updateError = $state<string | null>(null);

	// Modal state
	let showEditModal = $state(false);
	let showStatusModal = $state(false);

	// Edit form state
	let editName = $state('');
	let editContactName = $state('');
	let editContactEmail = $state('');
	let editContactPhone = $state('');

	// Status change state
	let newStatus = $state<OrganizationStatus>('ACTIVE');
	let statusReason = $state('');

	// Get available tabs for this organization type
	const availableTabs = $derived(
		ORGANIZATION_TYPE_TABS[organization.type as OrganizationType] || ['overview', 'members', 'activity']
	);

	function openEditModal() {
		editName = organization.name;
		editContactName = organization.externalContactName || '';
		editContactEmail = organization.externalContactEmail || '';
		editContactPhone = organization.externalContactPhone || '';
		updateError = null;
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
	}

	function openStatusModal() {
		newStatus = organization.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
		statusReason = '';
		updateError = null;
		showStatusModal = true;
	}

	function closeStatusModal() {
		showStatusModal = false;
	}

	async function handleSaveEdit() {
		isUpdating = true;
		updateError = null;

		try {
			const response = await organizationAdminApi.update({
				organizationId: organization.id,
				name: editName !== organization.name ? editName : undefined,
				externalContactName: editContactName || null,
				externalContactEmail: editContactEmail || null,
				externalContactPhone: editContactPhone || null
			});

			if (!response.ok) {
				updateError = 'Failed to update organization';
				return;
			}

			closeEditModal();
			await invalidateAll();
		} catch (err) {
			updateError = err instanceof Error ? err.message : 'Failed to update organization';
		} finally {
			isUpdating = false;
		}
	}

	async function handleStatusChange() {
		if (!statusReason.trim()) {
			updateError = 'Please provide a reason for the status change';
			return;
		}

		isUpdating = true;
		updateError = null;

		try {
			const response = await organizationAdminApi.updateStatus({
				organizationId: organization.id,
				status: newStatus,
				reason: statusReason
			});

			if (!response.ok) {
				updateError = 'Failed to update status';
				return;
			}

			closeStatusModal();
			await invalidateAll();
		} catch (err) {
			updateError = err instanceof Error ? err.message : 'Failed to update status';
		} finally {
			isUpdating = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateString: string): string {
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
	<title>{organization.name} | Organizations | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<a
			href="/app/admin/organizations"
			class="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-primary-500 mb-4"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Organizations
		</a>

		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-start gap-4">
				<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10">
					<Building2 class="h-7 w-7 text-primary-500" />
				</div>
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-2xl font-bold">{organization.name}</h1>
						{#if organization.status === 'ACTIVE'}
							<CheckCircle class="h-5 w-5 text-success-500" />
						{:else if organization.status === 'SUSPENDED'}
							<XCircle class="h-5 w-5 text-error-500" />
						{:else}
							<MinusCircle class="h-5 w-5 text-surface-500" />
						{/if}
					</div>
					<p class="text-surface-500">{organization.slug}</p>
					<div class="flex flex-wrap items-center gap-2 mt-2">
						<span class="badge {ORGANIZATION_TYPE_BADGE_CLASSES[organization.type as OrganizationType]}">
							{ORGANIZATION_TYPE_LABELS[organization.type as OrganizationType]}
						</span>
						<span class="badge {ORGANIZATION_STATUS_BADGE_CLASSES[organization.status as OrganizationStatus]}">
							{ORGANIZATION_STATUS_LABELS[organization.status as OrganizationStatus]}
						</span>
					</div>
				</div>
			</div>

			{#if isPlatformAdmin}
				<div class="flex gap-2">
					<button onclick={openEditModal} class="btn preset-outlined-primary-500">
						<Edit class="mr-2 h-4 w-4" />
						Edit
					</button>
					{#if organization.status === 'ACTIVE'}
						<button onclick={openStatusModal} class="btn preset-outlined-error-500">
							<Ban class="mr-2 h-4 w-4" />
							Suspend
						</button>
					{:else}
						<button onclick={openStatusModal} class="btn preset-outlined-success-500">
							<CheckCircle class="mr-2 h-4 w-4" />
							Activate
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Tabs -->
		<div class="mt-6 border-b border-surface-300-700">
			<nav class="flex gap-4 overflow-x-auto">
				{#each availableTabs as tab}
					<button
						onclick={() => (activeTab = tab)}
						class="px-1 pb-3 text-sm font-medium transition-colors whitespace-nowrap {activeTab ===
						tab
							? 'border-b-2 border-primary-500 text-primary-500'
							: 'text-surface-500 hover:text-surface-700'}"
					>
						{TAB_LABELS[tab] || tab}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Tab Content -->
		<div class="mt-6">
			{#if activeTab === 'overview'}
				<!-- Overview Tab -->
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Stats Cards -->
					<div class="lg:col-span-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
									<Users class="h-5 w-5 text-primary-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{organization.memberCount}</p>
									<p class="text-sm text-surface-500">Members</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
									<Briefcase class="h-5 w-5 text-warning-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{organization.activeCaseCount}</p>
									<p class="text-sm text-surface-500">Active Cases</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
									<Home class="h-5 w-5 text-success-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{organization.propertyCount}</p>
									<p class="text-sm text-surface-500">Properties</p>
								</div>
							</div>
						</Card>
						<Card variant="outlined" padding="md">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
									<FileText class="h-5 w-5 text-secondary-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{organization.workOrderCount}</p>
									<p class="text-sm text-surface-500">Work Orders</p>
								</div>
							</div>
						</Card>
					</div>

					<!-- Organization Info -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold mb-4">Organization Details</h3>
						<dl class="space-y-3">
							<div>
								<dt class="text-sm text-surface-500">Type</dt>
								<dd class="mt-1">
									{ORGANIZATION_TYPE_LABELS[organization.type as OrganizationType]}
								</dd>
								<dd class="text-sm text-surface-400">
									{ORGANIZATION_TYPE_DESCRIPTIONS[organization.type as OrganizationType]}
								</dd>
							</div>
							<div>
								<dt class="text-sm text-surface-500">Status</dt>
								<dd class="mt-1 flex items-center gap-2">
									{#if organization.status === 'ACTIVE'}
										<CheckCircle class="h-4 w-4 text-success-500" />
									{:else if organization.status === 'SUSPENDED'}
										<XCircle class="h-4 w-4 text-error-500" />
									{:else}
										<MinusCircle class="h-4 w-4 text-surface-500" />
									{/if}
									{ORGANIZATION_STATUS_LABELS[organization.status as OrganizationStatus]}
								</dd>
							</div>
							<div>
								<dt class="text-sm text-surface-500">Slug</dt>
								<dd class="mt-1 font-mono text-sm">{organization.slug}</dd>
							</div>
							<div>
								<dt class="text-sm text-surface-500">Created</dt>
								<dd class="mt-1 flex items-center gap-2">
									<Clock class="h-4 w-4 text-surface-400" />
									{formatDate(organization.createdAt)}
								</dd>
							</div>
							<div>
								<dt class="text-sm text-surface-500">Last Updated</dt>
								<dd class="mt-1 flex items-center gap-2">
									<Clock class="h-4 w-4 text-surface-400" />
									{formatDate(organization.updatedAt)}
								</dd>
							</div>
						</dl>
					</Card>

					<!-- Contact Info -->
					<Card variant="outlined" padding="lg">
						<h3 class="text-lg font-semibold mb-4">Contact Information</h3>
						{#if organization.externalContactName || organization.externalContactEmail || organization.externalContactPhone}
							<dl class="space-y-3">
								{#if organization.externalContactName}
									<div>
										<dt class="text-sm text-surface-500">Contact Name</dt>
										<dd class="mt-1 flex items-center gap-2">
											<User class="h-4 w-4 text-surface-400" />
											{organization.externalContactName}
										</dd>
									</div>
								{/if}
								{#if organization.externalContactEmail}
									<div>
										<dt class="text-sm text-surface-500">Email</dt>
										<dd class="mt-1 flex items-center gap-2">
											<Mail class="h-4 w-4 text-surface-400" />
											<a
												href="mailto:{organization.externalContactEmail}"
												class="text-primary-500 hover:underline"
											>
												{organization.externalContactEmail}
											</a>
										</dd>
									</div>
								{/if}
								{#if organization.externalContactPhone}
									<div>
										<dt class="text-sm text-surface-500">Phone</dt>
										<dd class="mt-1 flex items-center gap-2">
											<Phone class="h-4 w-4 text-surface-400" />
											{organization.externalContactPhone}
										</dd>
									</div>
								{/if}
							</dl>
						{:else}
							<p class="text-surface-500 text-sm">No contact information available.</p>
						{/if}
					</Card>

					<!-- Contractor Profile (if applicable) -->
					{#if organization.contractorProfile}
						<Card variant="outlined" padding="lg" class="lg:col-span-2">
							<h3 class="text-lg font-semibold mb-4">Contractor Profile</h3>
							<dl class="grid gap-4 sm:grid-cols-3">
								<div>
									<dt class="text-sm text-surface-500">Legal Name</dt>
									<dd class="mt-1">{organization.contractorProfile.legalName || 'N/A'}</dd>
								</div>
								<div>
									<dt class="text-sm text-surface-500">Profile Status</dt>
									<dd class="mt-1">
										{#if organization.contractorProfile.isActive}
											<span class="badge preset-filled-success-500">Active</span>
										{:else}
											<span class="badge preset-filled-surface-500">Inactive</span>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="text-sm text-surface-500">Profile ID</dt>
									<dd class="mt-1 font-mono text-sm">{organization.contractorProfile.id}</dd>
								</div>
							</dl>
						</Card>
					{/if}
				</div>
			{:else if activeTab === 'members'}
				<!-- Members Tab -->
				<Card variant="outlined" padding="none">
					{#if members.length === 0}
						<div class="p-8 text-center">
							<Users class="mx-auto h-12 w-12 text-surface-300" />
							<p class="mt-2 text-surface-500">No members found.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead class="border-b border-surface-300-700 bg-surface-50-950">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											User
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Role
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Default Org
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
											Joined
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-200-800">
									{#each members as member}
										<tr class="hover:bg-surface-100-900">
											<td class="px-6 py-4">
												<div class="flex items-center gap-3">
													<div class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-200-800">
														<User class="h-4 w-4 text-surface-500" />
													</div>
													<div>
														<p class="font-medium">{member.userName || 'Unknown'}</p>
														<p class="text-sm text-surface-500">{member.userEmail}</p>
													</div>
												</div>
											</td>
											<td class="px-6 py-4">
												<span class="badge preset-outlined-surface-500">
													{USER_ROLE_LABELS[member.role] || member.role}
												</span>
											</td>
											<td class="px-6 py-4">
												{#if member.isDefault}
													<span class="badge preset-filled-success-500">Yes</span>
												{:else}
													<span class="text-surface-400">No</span>
												{/if}
											</td>
											<td class="px-6 py-4 text-sm text-surface-500">
												{formatShortDate(member.joinedAt)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if data.membersHasMore}
							<div class="p-4 text-center border-t border-surface-300-700">
								<p class="text-sm text-surface-500">Showing first 20 members. More members exist.</p>
							</div>
						{/if}
					{/if}
				</Card>
			{:else}
				<!-- Placeholder for other tabs -->
				<Card variant="outlined" padding="lg">
					<div class="text-center py-8">
						<FileText class="mx-auto h-12 w-12 text-surface-300" />
						<h3 class="mt-4 text-lg font-medium">{TAB_LABELS[activeTab] || activeTab}</h3>
						<p class="mt-2 text-surface-500">This tab is coming soon.</p>
					</div>
				</Card>
			{/if}
		</div>
	</div>
</PageContainer>

<!-- Edit Modal -->
{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={closeEditModal}
		onkeydown={(e) => e.key === 'Escape' && closeEditModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-modal-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-surface-50-950 rounded-xl shadow-xl w-full max-w-lg mx-4"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="p-6">
				<h2 id="edit-modal-title" class="text-xl font-semibold mb-4">Edit Organization</h2>

				{#if updateError}
					<div class="mb-4 p-3 rounded-lg bg-error-500/10 text-error-500 flex items-center gap-2">
						<AlertTriangle class="h-4 w-4" />
						{updateError}
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="edit-name" class="block text-sm font-medium mb-1">Organization Name</label>
						<input
							id="edit-name"
							type="text"
							bind:value={editName}
							class="input w-full"
							placeholder="Organization name"
						/>
					</div>
					<div>
						<label for="edit-contact-name" class="block text-sm font-medium mb-1">Contact Name</label>
						<input
							id="edit-contact-name"
							type="text"
							bind:value={editContactName}
							class="input w-full"
							placeholder="Contact name"
						/>
					</div>
					<div>
						<label for="edit-contact-email" class="block text-sm font-medium mb-1">Contact Email</label>
						<input
							id="edit-contact-email"
							type="email"
							bind:value={editContactEmail}
							class="input w-full"
							placeholder="contact@example.com"
						/>
					</div>
					<div>
						<label for="edit-contact-phone" class="block text-sm font-medium mb-1">Contact Phone</label>
						<input
							id="edit-contact-phone"
							type="tel"
							bind:value={editContactPhone}
							class="input w-full"
							placeholder="(555) 123-4567"
						/>
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button onclick={closeEditModal} class="btn preset-outlined-surface-500" disabled={isUpdating}>
						Cancel
					</button>
					<button onclick={handleSaveEdit} class="btn preset-filled-primary-500" disabled={isUpdating}>
						{#if isUpdating}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						Save Changes
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Status Change Modal -->
{#if showStatusModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={closeStatusModal}
		onkeydown={(e) => e.key === 'Escape' && closeStatusModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="status-modal-title"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-surface-50-950 rounded-xl shadow-xl w-full max-w-lg mx-4"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="p-6">
				<h2 id="status-modal-title" class="text-xl font-semibold mb-4">
					{newStatus === 'SUSPENDED' ? 'Suspend Organization' : 'Activate Organization'}
				</h2>

				{#if updateError}
					<div class="mb-4 p-3 rounded-lg bg-error-500/10 text-error-500 flex items-center gap-2">
						<AlertTriangle class="h-4 w-4" />
						{updateError}
					</div>
				{/if}

				<p class="text-surface-600 mb-4">
					{#if newStatus === 'SUSPENDED'}
						Are you sure you want to suspend <strong>{organization.name}</strong>? This will prevent users from accessing the organization.
					{:else}
						Are you sure you want to activate <strong>{organization.name}</strong>? This will restore access for all users.
					{/if}
				</p>

				<div>
					<label for="status-reason" class="block text-sm font-medium mb-1">
						Reason <span class="text-error-500">*</span>
					</label>
					<textarea
						id="status-reason"
						bind:value={statusReason}
						class="textarea w-full"
						rows="3"
						placeholder="Please provide a reason for this status change..."
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button onclick={closeStatusModal} class="btn preset-outlined-surface-500" disabled={isUpdating}>
						Cancel
					</button>
					<button
						onclick={handleStatusChange}
						class="btn {newStatus === 'SUSPENDED' ? 'preset-filled-error-500' : 'preset-filled-success-500'}"
						disabled={isUpdating || !statusReason.trim()}
					>
						{#if isUpdating}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{newStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
