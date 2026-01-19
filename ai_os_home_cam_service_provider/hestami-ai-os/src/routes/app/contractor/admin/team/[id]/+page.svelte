<script lang="ts">
	import { page } from '$app/stores';
	import {
		ArrowLeft,
		Loader2,
		User,
		Mail,
		Calendar,
		CheckCircle,
		Clock,
		AlertTriangle,
		XCircle,
		UserCheck,
		UserX,
		RefreshCw,
		Edit,
		Briefcase,
		Wrench,
		Link,
		Unlink
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import {
		serviceProviderTeamApi,
		SERVICE_PROVIDER_ROLE_LABELS,
		SERVICE_PROVIDER_ROLE_DESCRIPTIONS,
		SERVICE_PROVIDER_STATUS_LABELS,
		type ServiceProviderTeamMember,
		type ServiceProviderTeamMemberStatus,
		type ServiceProviderRole
	} from '$lib/api/serviceProviderTeam';
	import { ServiceProviderTeamMemberStatusValues, ServiceProviderRoleValues } from '$lib/api/cam';

	interface Props {
		data: {
			teamMember: ServiceProviderTeamMember | null;
			error: string | null;
		};
	}

	let { data }: Props = $props();

	let teamMember = $state<ServiceProviderTeamMember | null>(null);
	let error = $state<string | null>(null);

	// Initialize from props
	$effect(() => {
		if (!data) return;
		if (data.teamMember !== undefined) teamMember = data.teamMember;
		if (data.error !== undefined) error = data.error;
	});
	let actionLoading = $state<string | null>(null);
	let actionError = $state<string | null>(null);

	// Modal state
	let showSuspendModal = $state(false);
	let suspendReason = $state('');
	let showDeactivateModal = $state(false);
	let deactivateReason = $state('');
	let showCodeModal = $state(false);
	let generatedCode = $state('');

	const teamMemberId = $derived($page.params.id ?? '');

	// Sync with server data when it changes (after navigation)
	$effect(() => {
		if (!data) return;
		if (data.teamMember !== teamMember) teamMember = data.teamMember;
		if (data.error !== error) error = data.error;
	});

	async function handleActivate() {
		if (!teamMember) return;
		actionLoading = 'activate';
		actionError = null;
		try {
			const response = await serviceProviderTeamApi.activate(teamMember.id);
			if (response.ok) {
				teamMember = response.data.teamMember as ServiceProviderTeamMember;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to activate team member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleSuspend() {
		if (!teamMember || !suspendReason.trim()) return;
		actionLoading = 'suspend';
		actionError = null;
		try {
			const response = await serviceProviderTeamApi.suspend(teamMember.id, suspendReason.trim());
			if (response.ok) {
				teamMember = response.data.teamMember as ServiceProviderTeamMember;
				showSuspendModal = false;
				suspendReason = '';
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to suspend team member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleDeactivate() {
		if (!teamMember || !deactivateReason.trim()) return;
		actionLoading = 'deactivate';
		actionError = null;
		try {
			const response = await serviceProviderTeamApi.deactivate(teamMember.id, deactivateReason.trim());
			if (response.ok) {
				teamMember = response.data.teamMember as ServiceProviderTeamMember;
				showDeactivateModal = false;
				deactivateReason = '';
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to deactivate team member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleReactivate() {
		if (!teamMember) return;
		actionLoading = 'reactivate';
		actionError = null;
		try {
			const response = await serviceProviderTeamApi.reactivate(teamMember.id);
			if (response.ok) {
				teamMember = response.data.teamMember as ServiceProviderTeamMember;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to reactivate team member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleRegenerateCode() {
		if (!teamMember) return;
		actionLoading = 'regenerate';
		actionError = null;
		try {
			const response = await serviceProviderTeamApi.regenerateActivationCode(teamMember.id);
			if (response.ok) {
				generatedCode = response.data.activationCode;
				showCodeModal = true;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to regenerate activation code';
		} finally {
			actionLoading = null;
		}
	}

	function getStatusIcon(status: ServiceProviderTeamMemberStatus) {
		switch (status) {
			case ServiceProviderTeamMemberStatusValues.ACTIVE:
				return CheckCircle;
			case ServiceProviderTeamMemberStatusValues.PENDING:
				return Clock;
			case ServiceProviderTeamMemberStatusValues.SUSPENDED:
				return AlertTriangle;
			case ServiceProviderTeamMemberStatusValues.DEACTIVATED:
				return XCircle;
			default:
				return Clock;
		}
	}

	function getStatusColor(status: ServiceProviderTeamMemberStatus): string {
		switch (status) {
			case ServiceProviderTeamMemberStatusValues.ACTIVE:
				return 'text-success-500';
			case ServiceProviderTeamMemberStatusValues.PENDING:
				return 'text-warning-500';
			case ServiceProviderTeamMemberStatusValues.SUSPENDED:
				return 'text-error-500';
			case ServiceProviderTeamMemberStatusValues.DEACTIVATED:
				return 'text-surface-500';
			default:
				return 'text-surface-500';
		}
	}
</script>

<svelte:head>
	<title>{teamMember?.displayName ?? 'Team Member'} | Contractor Portal</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<a href="/app/contractor/admin/team" class="inline-flex items-center text-sm text-surface-500 hover:text-primary-500 mb-4">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Team
		</a>

		{#if error}
			<Card variant="outlined" padding="lg">
				<div class="text-center text-error-500">
					<p>{error}</p>
					<a href="/app/contractor/admin/team" class="btn preset-outlined-primary-500 mt-4">
						Back to Team
					</a>
				</div>
			</Card>
		{:else if teamMember}
			<!-- Header -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-start gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10">
						{#if teamMember.technicianId}
							<Wrench class="h-8 w-8 text-primary-500" />
						{:else}
							<User class="h-8 w-8 text-primary-500" />
						{/if}
					</div>
					<div>
						<h1 class="text-2xl font-bold">{teamMember.displayName}</h1>
						{#if teamMember.title}
							<p class="text-surface-500">{teamMember.title}</p>
						{/if}
						<div class="mt-2 flex items-center gap-2">
							{#if teamMember.status === ServiceProviderTeamMemberStatusValues.ACTIVE}
								<CheckCircle class="h-4 w-4 text-success-500" />
							{:else if teamMember.status === ServiceProviderTeamMemberStatusValues.PENDING}
								<Clock class="h-4 w-4 text-warning-500" />
							{:else if teamMember.status === ServiceProviderTeamMemberStatusValues.SUSPENDED}
								<AlertTriangle class="h-4 w-4 text-error-500" />
							{:else}
								<XCircle class="h-4 w-4 text-surface-500" />
							{/if}
							<span class="{getStatusColor(teamMember.status)} font-medium">
								{SERVICE_PROVIDER_STATUS_LABELS[teamMember.status]}
							</span>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex flex-wrap gap-2">
					{#if teamMember.status === ServiceProviderTeamMemberStatusValues.PENDING}
						<button
							onclick={handleActivate}
							disabled={actionLoading !== null}
							class="btn preset-filled-success-500"
						>
							{#if actionLoading === 'activate'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<UserCheck class="mr-2 h-4 w-4" />
							{/if}
							Activate
						</button>
						<button
							onclick={handleRegenerateCode}
							disabled={actionLoading !== null}
							class="btn preset-outlined-primary-500"
						>
							{#if actionLoading === 'regenerate'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Regenerate Code
						</button>
					{/if}

					{#if teamMember.status === ServiceProviderTeamMemberStatusValues.ACTIVE}
						<button
							onclick={() => (showSuspendModal = true)}
							disabled={actionLoading !== null}
							class="btn preset-outlined-warning-500"
						>
							<AlertTriangle class="mr-2 h-4 w-4" />
							Suspend
						</button>
						<button
							onclick={() => (showDeactivateModal = true)}
							disabled={actionLoading !== null}
							class="btn preset-outlined-error-500"
						>
							<UserX class="mr-2 h-4 w-4" />
							Deactivate
						</button>
					{/if}

					{#if teamMember.status === ServiceProviderTeamMemberStatusValues.SUSPENDED || teamMember.status === ServiceProviderTeamMemberStatusValues.DEACTIVATED}
						<button
							onclick={handleReactivate}
							disabled={actionLoading !== null}
							class="btn preset-filled-success-500"
						>
							{#if actionLoading === 'reactivate'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Reactivate
						</button>
					{/if}

					<a href="/app/contractor/admin/team/{teamMember.id}/roles" class="btn preset-outlined-surface-500">
						<Edit class="mr-2 h-4 w-4" />
						Manage Roles
					</a>
				</div>
			</div>

			{#if actionError}
				<div class="mt-4 rounded-lg bg-error-500/10 p-4 text-error-500">
					{actionError}
				</div>
			{/if}

			<!-- Details Grid -->
			<div class="mt-8 grid gap-6 lg:grid-cols-2">
				<!-- Contact Information -->
				<Card variant="outlined" padding="lg">
					<h2 class="text-lg font-semibold mb-4">Contact Information</h2>
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<Mail class="h-5 w-5 text-surface-400" />
							<div>
								<p class="text-sm text-surface-500">Email</p>
								<p class="font-medium">{teamMember.user?.email ?? 'N/A'}</p>
							</div>
						</div>
						{#if teamMember.user?.name}
							<div class="flex items-center gap-3">
								<User class="h-5 w-5 text-surface-400" />
								<div>
									<p class="text-sm text-surface-500">Account Name</p>
									<p class="font-medium">{teamMember.user.name}</p>
								</div>
							</div>
						{/if}
					</div>
				</Card>

				<!-- Roles -->
				<Card variant="outlined" padding="lg">
					<h2 class="text-lg font-semibold mb-4">Assigned Roles</h2>
					<div class="space-y-3">
						{#each teamMember.roles as role}
							<div class="flex items-start gap-3 p-3 rounded-lg bg-surface-100-900">
								<Briefcase class="h-5 w-5 text-primary-500 mt-0.5" />
								<div>
									<p class="font-medium">{SERVICE_PROVIDER_ROLE_LABELS[role]}</p>
									<p class="text-sm text-surface-500">{SERVICE_PROVIDER_ROLE_DESCRIPTIONS[role]}</p>
								</div>
							</div>
						{/each}
					</div>
				</Card>

				<!-- Technician Link -->
				<Card variant="outlined" padding="lg">
					<h2 class="text-lg font-semibold mb-4">Technician Profile</h2>
					{#if teamMember.technician}
						<div class="flex items-center justify-between p-3 rounded-lg bg-surface-100-900">
							<div class="flex items-center gap-3">
								<Wrench class="h-5 w-5 text-primary-500" />
								<div>
									<p class="font-medium">{teamMember.technician.firstName} {teamMember.technician.lastName}</p>
									<p class="text-sm text-surface-500">Linked Technician</p>
								</div>
							</div>
							<a href="/app/contractor/technicians?id={teamMember.technicianId}" class="btn btn-sm preset-outlined-primary-500">
								View Profile
							</a>
						</div>
					{:else}
						<div class="text-center py-6 text-surface-500">
							<Unlink class="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No technician profile linked</p>
							{#if teamMember.roles.includes(ServiceProviderRoleValues.TECHNICIAN)}
								<p class="text-sm mt-1">This team member has the Technician role but no linked profile.</p>
							{/if}
						</div>
					{/if}
				</Card>

				<!-- Timeline -->
				<Card variant="outlined" padding="lg">
					<h2 class="text-lg font-semibold mb-4">Timeline</h2>
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<Calendar class="h-5 w-5 text-surface-400" />
							<div>
								<p class="text-sm text-surface-500">Created</p>
								<p class="font-medium">{new Date(teamMember.createdAt).toLocaleString()}</p>
							</div>
						</div>
						{#if teamMember.activatedAt}
							<div class="flex items-center gap-3">
								<CheckCircle class="h-5 w-5 text-success-500" />
								<div>
									<p class="text-sm text-surface-500">Activated</p>
									<p class="font-medium">{new Date(teamMember.activatedAt).toLocaleString()}</p>
								</div>
							</div>
						{/if}
						{#if teamMember.suspendedAt}
							<div class="flex items-center gap-3">
								<AlertTriangle class="h-5 w-5 text-warning-500" />
								<div>
									<p class="text-sm text-surface-500">Suspended</p>
									<p class="font-medium">{new Date(teamMember.suspendedAt).toLocaleString()}</p>
								</div>
							</div>
						{/if}
						{#if teamMember.deactivatedAt}
							<div class="flex items-center gap-3">
								<XCircle class="h-5 w-5 text-error-500" />
								<div>
									<p class="text-sm text-surface-500">Deactivated</p>
									<p class="font-medium">{new Date(teamMember.deactivatedAt).toLocaleString()}</p>
								</div>
							</div>
						{/if}
					</div>
				</Card>
			</div>
		{/if}
	</div>
</PageContainer>

<!-- Suspend Modal -->
{#if showSuspendModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="outlined" padding="lg" class="w-full max-w-md">
			<h3 class="text-lg font-semibold mb-4">Suspend Team Member</h3>
			<p class="text-surface-500 mb-4">
				Please provide a reason for suspending this team member. They will lose access immediately.
			</p>
			<textarea
				bind:value={suspendReason}
				placeholder="Enter suspension reason..."
				class="textarea w-full mb-4"
				rows="3"
			></textarea>
			<div class="flex justify-end gap-2">
				<button onclick={() => (showSuspendModal = false)} class="btn preset-outlined-surface-500">
					Cancel
				</button>
				<button
					onclick={handleSuspend}
					disabled={!suspendReason.trim() || actionLoading === 'suspend'}
					class="btn preset-filled-warning-500"
				>
					{#if actionLoading === 'suspend'}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Suspend
				</button>
			</div>
		</Card>
	</div>
{/if}

<!-- Deactivate Modal -->
{#if showDeactivateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="outlined" padding="lg" class="w-full max-w-md">
			<h3 class="text-lg font-semibold mb-4">Deactivate Team Member</h3>
			<p class="text-surface-500 mb-4">
				Please provide a reason for deactivating this team member. This action is typically used when someone leaves the organization.
			</p>
			<textarea
				bind:value={deactivateReason}
				placeholder="Enter deactivation reason..."
				class="textarea w-full mb-4"
				rows="3"
			></textarea>
			<div class="flex justify-end gap-2">
				<button onclick={() => (showDeactivateModal = false)} class="btn preset-outlined-surface-500">
					Cancel
				</button>
				<button
					onclick={handleDeactivate}
					disabled={!deactivateReason.trim() || actionLoading === 'deactivate'}
					class="btn preset-filled-error-500"
				>
					{#if actionLoading === 'deactivate'}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Deactivate
				</button>
			</div>
		</Card>
	</div>
{/if}

<!-- Activation Code Modal -->
{#if showCodeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card variant="outlined" padding="lg" class="w-full max-w-md">
			<h3 class="text-lg font-semibold mb-4">New Activation Code</h3>
			<p class="text-surface-500 mb-4">
				Share this code with the team member. It will expire in 8 hours.
			</p>
			<div class="bg-surface-100-900 p-4 rounded-lg text-center mb-4">
				<p class="text-2xl font-mono font-bold tracking-wider">{generatedCode}</p>
			</div>
			<div class="flex justify-end">
				<button onclick={() => (showCodeModal = false)} class="btn preset-filled-primary-500">
					Done
				</button>
			</div>
		</Card>
	</div>
{/if}
