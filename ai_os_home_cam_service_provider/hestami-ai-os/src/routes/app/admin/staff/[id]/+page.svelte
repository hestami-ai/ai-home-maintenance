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
		Briefcase
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { orpc } from '$lib/api';

	interface Staff {
		id: string;
		userId: string;
		displayName: string;
		title: string | null;
		roles: string[];
		pillarAccess: string[];
		status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
		canBeAssignedCases: boolean;
		activatedAt: string | null;
		suspendedAt: string | null;
		deactivatedAt: string | null;
		createdAt: string;
		updatedAt: string;
		user?: {
			email: string;
			name?: string;
		};
	}

	const STAFF_STATUS_LABELS: Record<string, string> = {
		PENDING: 'Pending Activation',
		ACTIVE: 'Active',
		SUSPENDED: 'Suspended',
		DEACTIVATED: 'Deactivated'
	};

	const STAFF_ROLE_LABELS: Record<string, string> = {
		SUPER_ADMIN: 'Super Administrator',
		ADMIN: 'Administrator',
		SUPPORT: 'Support Staff',
		OPERATOR: 'Operator',
		VIEWER: 'Viewer'
	};

	const STAFF_ROLE_DESCRIPTIONS: Record<string, string> = {
		SUPER_ADMIN: 'Full access to all system features and settings',
		ADMIN: 'Can manage most system features except billing',
		SUPPORT: 'Can assist users and manage cases',
		OPERATOR: 'Can perform day-to-day operations',
		VIEWER: 'Read-only access to assigned areas'
	};

	const PILLAR_ACCESS_LABELS: Record<string, string> = {
		CAM: 'Community Management',
		CONCIERGE: 'Concierge Services',
		CONTRACTOR: 'Contractor Portal',
		OWNER: 'Owner Portal',
		ALL: 'All Pillars'
	};

	// Staff API wrapper
	const staffApi = {
		activate: (id: string) => orpc.staff.activate({ staffId: id, idempotencyKey: crypto.randomUUID() }),
		suspend: (id: string, reason: string) => orpc.staff.suspend({ staffId: id, reason, idempotencyKey: crypto.randomUUID() }),
		deactivate: (id: string, reason: string) => orpc.staff.deactivate({ staffId: id, reason, idempotencyKey: crypto.randomUUID() }),
		reactivate: (id: string) => orpc.staff.reactivate({ staffId: id, idempotencyKey: crypto.randomUUID() }),
		regenerateActivationCode: (id: string) => orpc.staff.regenerateActivationCode({ staffId: id, idempotencyKey: crypto.randomUUID() })
	};

	interface Props {
		data: {
			staff: Staff;
		};
	}

	let { data }: Props = $props();

	let staff = $state<Staff | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let actionLoading = $state<string | null>(null);
	let actionError = $state<string | null>(null);

	// Modal state
	let showSuspendModal = $state(false);
	let suspendReason = $state('');
	let showDeactivateModal = $state(false);
	let deactivateReason = $state('');
	let showCodeModal = $state(false);
	let generatedCode = $state('');

	// Synchronize server data to local state
	$effect(() => {
		if (data.staff) {
			staff = data.staff;
		}
	});

	async function loadStaff() {
		// No longer needed for mounting, but keeping as a refresh helper if needed
		// or better, just use invalidateAll()
		window.location.reload();
	}

	async function handleActivate() {
		if (!staff) return;
		actionLoading = 'activate';
		actionError = null;
		try {
			const response = await staffApi.activate(staff.id);
			if (response.ok) {
				staff = response.data.staff as Staff;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to activate staff member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleSuspend() {
		if (!staff || !suspendReason.trim()) return;
		actionLoading = 'suspend';
		actionError = null;
		try {
			const response = await staffApi.suspend(staff.id, suspendReason.trim());
			if (response.ok) {
				staff = response.data.staff as Staff;
				showSuspendModal = false;
				suspendReason = '';
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to suspend staff member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleDeactivate() {
		if (!staff || !deactivateReason.trim()) return;
		actionLoading = 'deactivate';
		actionError = null;
		try {
			const response = await staffApi.deactivate(staff.id, deactivateReason.trim());
			if (response.ok) {
				staff = response.data.staff as Staff;
				showDeactivateModal = false;
				deactivateReason = '';
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to deactivate staff member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleReactivate() {
		if (!staff) return;
		actionLoading = 'reactivate';
		actionError = null;
		try {
			const response = await staffApi.reactivate(staff.id);
			if (response.ok) {
				staff = response.data.staff as Staff;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to reactivate staff member';
		} finally {
			actionLoading = null;
		}
	}

	async function handleRegenerateCode() {
		if (!staff) return;
		actionLoading = 'regenerate';
		actionError = null;
		try {
			const response = await staffApi.regenerateActivationCode(staff.id);
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

	function getStatusIcon(status: string) {
		switch (status) {
			case 'ACTIVE':
				return CheckCircle;
			case 'PENDING':
				return Clock;
			case 'SUSPENDED':
				return AlertTriangle;
			case 'DEACTIVATED':
				return XCircle;
			default:
				return Clock;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'ACTIVE':
				return 'text-success-500';
			case 'PENDING':
				return 'text-warning-500';
			case 'SUSPENDED':
				return 'text-error-500';
			case 'DEACTIVATED':
				return 'text-surface-500';
			default:
				return 'text-surface-500';
		}
	}
</script>

<svelte:head>
	<title>{staff?.displayName || 'Staff Profile'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/admin/staff"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Staff List
			</a>
		</div>

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
		{:else if staff}
			<!-- Profile Header -->
			<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-start gap-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10">
						<User class="h-8 w-8 text-primary-500" />
					</div>
					<div>
						<h1 class="text-2xl font-bold">{staff.displayName}</h1>
						{#if staff.title}
							<p class="text-surface-500">{staff.title}</p>
						{/if}
						<div class="mt-2 flex items-center gap-2">
							{#if staff.status === 'ACTIVE'}
								<CheckCircle class="h-4 w-4 text-success-500" />
							{:else if staff.status === 'PENDING'}
								<Clock class="h-4 w-4 text-warning-500" />
							{:else if staff.status === 'SUSPENDED'}
								<AlertTriangle class="h-4 w-4 text-error-500" />
							{:else}
								<XCircle class="h-4 w-4 text-surface-500" />
							{/if}
							<span class="text-sm font-medium {getStatusColor(staff.status)}">
								{STAFF_STATUS_LABELS[staff.status]}
							</span>
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex flex-wrap gap-2">
					{#if staff.status === 'PENDING'}
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
							class="btn preset-outlined-warning-500"
						>
							{#if actionLoading === 'regenerate'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Regenerate Code
						</button>
					{/if}

					{#if staff.status === 'ACTIVE'}
						<button
							onclick={() => (showSuspendModal = true)}
							disabled={actionLoading !== null}
							class="btn preset-outlined-error-500"
						>
							<AlertTriangle class="mr-2 h-4 w-4" />
							Suspend
						</button>
						<button
							onclick={() => (showDeactivateModal = true)}
							disabled={actionLoading !== null}
							class="btn preset-outlined-surface-500"
						>
							<UserX class="mr-2 h-4 w-4" />
							Deactivate
						</button>
					{/if}

					{#if staff.status === 'SUSPENDED' || staff.status === 'DEACTIVATED'}
						<button
							onclick={handleReactivate}
							disabled={actionLoading !== null}
							class="btn preset-filled-primary-500"
						>
							{#if actionLoading === 'reactivate'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Reactivate
						</button>
					{/if}

					<a href="/app/admin/staff/{staff.id}/edit" class="btn preset-outlined-primary-500">
						<Edit class="mr-2 h-4 w-4" />
						Edit
					</a>
				</div>
			</div>

			{#if actionError}
				<div class="mt-4 rounded-lg bg-error-500/10 p-4 text-error-500">
					{actionError}
				</div>
			{/if}

			<!-- Profile Content -->
			<div class="mt-8 grid gap-6 lg:grid-cols-3">
				<!-- Main Info -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Contact Info -->
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Contact Information</h2>
						<div class="mt-4 space-y-4">
							<div class="flex items-center gap-3">
								<Mail class="h-5 w-5 text-surface-400" />
								<div>
									<p class="text-sm text-surface-500">Email</p>
									<p class="font-medium">{staff.user?.email || 'N/A'}</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<User class="h-5 w-5 text-surface-400" />
								<div>
									<p class="text-sm text-surface-500">User Account</p>
									<p class="font-medium">{staff.user?.name || staff.user?.email || 'N/A'}</p>
								</div>
							</div>
						</div>
					</Card>

					<!-- Roles -->
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Roles</h2>
							<a
								href="/app/admin/staff/{staff.id}/roles"
								class="text-sm text-primary-500 hover:underline"
							>
								Manage Roles
							</a>
						</div>
						<div class="mt-4 space-y-3">
							{#each staff.roles as role}
								<div class="flex items-start gap-3 rounded-lg border border-surface-300-700 p-3">
									<Briefcase class="h-5 w-5 text-primary-500 mt-0.5" />
									<div>
										<p class="font-medium">{STAFF_ROLE_LABELS[role]}</p>
										<p class="text-sm text-surface-500">{STAFF_ROLE_DESCRIPTIONS[role]}</p>
									</div>
								</div>
							{/each}
						</div>
					</Card>

					<!-- Pillar Access -->
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Pillar Access</h2>
							<a
								href="/app/admin/staff/{staff.id}/access"
								class="text-sm text-primary-500 hover:underline"
							>
								Manage Access
							</a>
						</div>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each staff.pillarAccess as pillar}
								<span class="badge preset-filled-primary-500">
									{PILLAR_ACCESS_LABELS[pillar]}
								</span>
							{/each}
						</div>
					</Card>
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Status & Dates -->
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Status & Timeline</h2>
						<div class="mt-4 space-y-4">
							<div class="flex items-center gap-3">
								<Calendar class="h-5 w-5 text-surface-400" />
								<div>
									<p class="text-sm text-surface-500">Created</p>
									<p class="font-medium">
										{new Date(staff.createdAt).toLocaleDateString()}
									</p>
								</div>
							</div>
							{#if staff.activatedAt}
								<div class="flex items-center gap-3">
									<CheckCircle class="h-5 w-5 text-success-500" />
									<div>
										<p class="text-sm text-surface-500">Activated</p>
										<p class="font-medium">
											{new Date(staff.activatedAt).toLocaleDateString()}
										</p>
									</div>
								</div>
							{/if}
							{#if staff.suspendedAt}
								<div class="flex items-center gap-3">
									<AlertTriangle class="h-5 w-5 text-error-500" />
									<div>
										<p class="text-sm text-surface-500">Suspended</p>
										<p class="font-medium">
											{new Date(staff.suspendedAt).toLocaleDateString()}
										</p>
									</div>
								</div>
							{/if}
							{#if staff.deactivatedAt}
								<div class="flex items-center gap-3">
									<XCircle class="h-5 w-5 text-surface-500" />
									<div>
										<p class="text-sm text-surface-500">Deactivated</p>
										<p class="font-medium">
											{new Date(staff.deactivatedAt).toLocaleDateString()}
										</p>
									</div>
								</div>
							{/if}
						</div>
					</Card>

					<!-- Case Assignment -->
					<Card variant="outlined" padding="lg">
						<h2 class="text-lg font-semibold">Case Assignment</h2>
						<div class="mt-4">
							<div class="flex items-center gap-2">
								{#if staff.canBeAssignedCases}
									<CheckCircle class="h-5 w-5 text-success-500" />
									<span class="text-sm">Can be assigned cases</span>
								{:else}
									<XCircle class="h-5 w-5 text-surface-400" />
									<span class="text-sm text-surface-500">Cannot be assigned cases</span>
								{/if}
							</div>
						</div>
					</Card>
				</div>
			</div>
		{/if}
	</div>
</PageContainer>

<!-- Suspend Modal -->
{#if showSuspendModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<h3 class="text-lg font-semibold">Suspend Staff Member</h3>
			<p class="mt-2 text-sm text-surface-500">
				This will immediately revoke access and escalate any assigned cases.
			</p>
			<div class="mt-4">
				<label for="suspendReason" class="label">Reason for suspension *</label>
				<textarea
					id="suspendReason"
					bind:value={suspendReason}
					placeholder="Enter the reason for suspension..."
					rows="3"
					class="textarea w-full"
					required
				></textarea>
			</div>
			<div class="mt-6 flex justify-end gap-3">
				<button
					onclick={() => {
						showSuspendModal = false;
						suspendReason = '';
					}}
					class="btn preset-outlined-surface-500"
				>
					Cancel
				</button>
				<button
					onclick={handleSuspend}
					disabled={!suspendReason.trim() || actionLoading === 'suspend'}
					class="btn preset-filled-error-500"
				>
					{#if actionLoading === 'suspend'}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Suspend
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Deactivate Modal -->
{#if showDeactivateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<h3 class="text-lg font-semibold">Deactivate Staff Member</h3>
			<p class="mt-2 text-sm text-surface-500">
				This staff member must have no active case assignments before deactivation.
			</p>
			<div class="mt-4">
				<label for="deactivateReason" class="label">Reason for deactivation *</label>
				<textarea
					id="deactivateReason"
					bind:value={deactivateReason}
					placeholder="Enter the reason for deactivation..."
					rows="3"
					class="textarea w-full"
					required
				></textarea>
			</div>
			<div class="mt-6 flex justify-end gap-3">
				<button
					onclick={() => {
						showDeactivateModal = false;
						deactivateReason = '';
					}}
					class="btn preset-outlined-surface-500"
				>
					Cancel
				</button>
				<button
					onclick={handleDeactivate}
					disabled={!deactivateReason.trim() || actionLoading === 'deactivate'}
					class="btn preset-filled-surface-500"
				>
					{#if actionLoading === 'deactivate'}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					Deactivate
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Activation Code Modal -->
{#if showCodeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 text-success-600">
					<RefreshCw class="h-6 w-6" />
				</div>
				<h3 class="text-lg font-semibold">New Activation Code</h3>
				<p class="mt-2 text-sm text-surface-500">
					A new activation code has been generated. This code is valid for 8 hours.
				</p>
				
				<div class="mt-6 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-4">
					<div class="flex items-center justify-center gap-2">
						<code class="text-2xl font-mono font-bold tracking-widest">{generatedCode}</code>
					</div>
				</div>

				<div class="mt-6">
					<button
						onclick={() => {
							showCodeModal = false;
							generatedCode = '';
						}}
						class="btn preset-filled-primary-500 w-full"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
