<script lang="ts">
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
		FolderOpen,
		Activity
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { orpc } from '$lib/api/orpc';
	import { StaffStatusValues, ConciergeCaseStatusValues, ConciergeCasePriorityValues } from '$lib/api/cam';

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

	// Tab state
	let activeTab = $state<'profile' | 'assignments' | 'activity'>('profile');

	// Assignments state
	interface Assignment {
		id: string;
		caseId: string;
		isPrimary: boolean;
		assignedAt: string;
		unassignedAt: string | null;
		justification: string | null;
		case: {
			caseNumber: string;
			title: string;
			status: string;
			priority: string;
			createdAt: string;
		};
	}
	let assignments = $state<Assignment[]>([]);
	let assignmentsLoading = $state(false);
	let assignmentsError = $state<string | null>(null);
	let showAllAssignments = $state(false);

	// Activity state
	interface ActivityEvent {
		id: string;
		entityType: string;
		entityId: string;
		action: string;
		eventCategory: string;
		summary: string;
		performedAt: string;
	}
	let activityEvents = $state<ActivityEvent[]>([]);
	let activityLoading = $state(false);
	let activityError = $state<string | null>(null);

	// Modal state
	let showSuspendModal = $state(false);
	let suspendReason = $state('');
	let showDeactivateModal = $state(false);
	let deactivateReason = $state('');
	let deactivateActiveCount = $state(0);
	let deactivateLoadingCount = $state(false);
	let showCodeModal = $state(false);
	let generatedCode = $state('');

	// Synchronize server data to local state
	$effect(() => {
		if (!data) return;
		if (data.staff) {
			staff = data.staff;
		}
	});

	async function loadStaff() {
		// No longer needed for mounting, but keeping as a refresh helper if needed
		// or better, just use invalidateAll()
		window.location.reload();
	}

	async function loadAssignments() {
		if (!staff) return;
		assignmentsLoading = true;
		assignmentsError = null;
		try {
			const response = await orpc.staff.getAssignments({
				staffId: staff.id,
				includeUnassigned: showAllAssignments
			});
			if (response.ok) {
				assignments = response.data.assignments as Assignment[];
			}
		} catch (e) {
			assignmentsError = e instanceof Error ? e.message : 'Failed to load assignments';
		} finally {
			assignmentsLoading = false;
		}
	}

	async function loadActivity() {
		if (!staff) return;
		activityLoading = true;
		activityError = null;
		try {
			const response = await orpc.activityEvent.staffList({
				performedById: staff.userId,
				limit: 50
			});
			if (response.ok) {
				activityEvents = response.data.events as ActivityEvent[];
			}
		} catch (e) {
			activityError = e instanceof Error ? e.message : 'Failed to load activity';
		} finally {
			activityLoading = false;
		}
	}

	// Load data when tab changes
	$effect(() => {
		if (activeTab === 'assignments' && assignments.length === 0 && !assignmentsLoading) {
			loadAssignments();
		}
		if (activeTab === 'activity' && activityEvents.length === 0 && !activityLoading) {
			loadActivity();
		}
	});

	// Reload assignments when toggle changes
	$effect(() => {
		if (activeTab === 'assignments' && staff) {
			loadAssignments();
		}
	});

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

	async function openDeactivateModal() {
		if (!staff) return;
		showDeactivateModal = true;
		deactivateLoadingCount = true;
		deactivateActiveCount = 0;
		try {
			const response = await orpc.staff.getAssignments({
				staffId: staff.id,
				includeUnassigned: false
			});
			if (response.ok) {
				deactivateActiveCount = response.data.assignments.length;
			}
		} catch (e) {
			console.error('Failed to fetch active assignments:', e);
		} finally {
			deactivateLoadingCount = false;
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

	function getStatusColor(status: string) {
		switch (status) {
			case StaffStatusValues.ACTIVE:
				return 'text-success-500';
			case StaffStatusValues.PENDING:
				return 'text-warning-500';
			case StaffStatusValues.SUSPENDED:
				return 'text-error-500';
			case StaffStatusValues.DEACTIVATED:
				return 'text-surface-500';
			default:
				return 'text-surface-500';
		}
	}

	function getCaseStatusColor(status: string) {
		const colors: Record<string, string> = {
			[ConciergeCaseStatusValues.INTAKE]: 'preset-filled-secondary-500',
			[ConciergeCaseStatusValues.ASSESSMENT]: 'preset-filled-tertiary-500',
			[ConciergeCaseStatusValues.IN_PROGRESS]: 'preset-filled-warning-500',
			[ConciergeCaseStatusValues.PENDING_EXTERNAL]: 'preset-filled-surface-500',
			[ConciergeCaseStatusValues.PENDING_OWNER]: 'preset-filled-surface-500',
			[ConciergeCaseStatusValues.ON_HOLD]: 'preset-outlined-surface-500',
			[ConciergeCaseStatusValues.RESOLVED]: 'preset-filled-success-500',
			[ConciergeCaseStatusValues.CLOSED]: 'preset-filled-surface-500',
			[ConciergeCaseStatusValues.CANCELLED]: 'preset-outlined-error-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getCasePriorityColor(priority: string) {
		const colors: Record<string, string> = {
			[ConciergeCasePriorityValues.LOW]: 'preset-outlined-surface-500',
			[ConciergeCasePriorityValues.NORMAL]: 'preset-filled-secondary-500',
			[ConciergeCasePriorityValues.HIGH]: 'preset-filled-warning-500',
			[ConciergeCasePriorityValues.URGENT]: 'preset-filled-error-500',
			[ConciergeCasePriorityValues.EMERGENCY]: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-filled-surface-500';
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatDateTime(dateString: string) {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getEventCategoryColor(category: string) {
		const colors: Record<string, string> = {
			INTENT: 'preset-filled-tertiary-500',
			DECISION: 'preset-filled-primary-500',
			EXECUTION: 'preset-filled-success-500',
			SYSTEM: 'preset-outlined-surface-500'
		};
		return colors[category] || 'preset-filled-surface-500';
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
							{#if staff.status === StaffStatusValues.ACTIVE}
								<CheckCircle class="h-4 w-4 text-success-500" />
							{:else if staff.status === StaffStatusValues.PENDING}
								<Clock class="h-4 w-4 text-warning-500" />
							{:else if staff.status === StaffStatusValues.SUSPENDED}
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
					<a
						href="/app/admin/activity?entityType=STAFF&entityId={staff.id}"
						class="btn preset-outlined-primary-500"
					>
						<Activity class="mr-2 h-4 w-4" />
						View Audit Trail
					</a>
					{#if staff.status === StaffStatusValues.PENDING}
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

					{#if staff.status === StaffStatusValues.ACTIVE}
						<button
							onclick={() => (showSuspendModal = true)}
							disabled={actionLoading !== null}
							class="btn preset-outlined-error-500"
						>
							<AlertTriangle class="mr-2 h-4 w-4" />
							Suspend
						</button>
						<button
							onclick={openDeactivateModal}
							disabled={actionLoading !== null}
							class="btn preset-outlined-surface-500"
						>
							<UserX class="mr-2 h-4 w-4" />
							Deactivate
						</button>
					{/if}

					{#if staff.status === StaffStatusValues.SUSPENDED || staff.status === StaffStatusValues.DEACTIVATED}
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

			<!-- Tab Navigation -->
			<div class="mt-6 border-b border-surface-300-700">
				<nav class="-mb-px flex space-x-6">
					<button
						onclick={() => (activeTab = 'profile')}
						class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'profile'
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:border-surface-400 hover:text-surface-700 dark:hover:text-surface-300'}"
					>
						<User class="h-4 w-4" />
						Profile
					</button>
					<button
						onclick={() => (activeTab = 'assignments')}
						class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'assignments'
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:border-surface-400 hover:text-surface-700 dark:hover:text-surface-300'}"
					>
						<FolderOpen class="h-4 w-4" />
						Assignments
						{#if assignments.filter(a => !a.unassignedAt).length > 0}
							<span class="ml-1 rounded-full bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500">
								{assignments.filter(a => !a.unassignedAt).length}
							</span>
						{/if}
					</button>
					<button
						onclick={() => (activeTab = 'activity')}
						class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'activity'
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:border-surface-400 hover:text-surface-700 dark:hover:text-surface-300'}"
					>
						<Activity class="h-4 w-4" />
						Activity
					</button>
				</nav>
			</div>

			<!-- Tab Content -->
			{#if activeTab === 'profile'}
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

			{:else if activeTab === 'assignments'}
				<!-- Assignments Content -->
				<div class="mt-8">
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Case Assignments</h2>
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									bind:checked={showAllAssignments}
									class="checkbox"
								/>
								Show past assignments
							</label>
						</div>

						{#if assignmentsLoading}
							<div class="mt-6 flex items-center justify-center py-8">
								<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
							</div>
						{:else if assignmentsError}
							<div class="mt-4 rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
								{assignmentsError}
							</div>
						{:else if assignments.length === 0}
							<div class="mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300-700 p-8">
								<FolderOpen class="h-12 w-12 text-surface-400" />
								<p class="mt-2 text-sm text-surface-500">No case assignments found</p>
								<p class="text-xs text-surface-400">
									{showAllAssignments ? 'This staff member has never been assigned any cases' : 'This staff member has no active case assignments'}
								</p>
							</div>
						{:else}
							<div class="mt-4 space-y-3">
								{#each assignments as assignment}
									<a
										href="/app/admin/cases/{assignment.caseId}"
										class="block rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
									>
										<div class="flex items-start justify-between gap-4">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 flex-wrap">
													<span class="font-mono text-sm text-surface-500">{assignment.case.caseNumber}</span>
													{#if assignment.isPrimary}
														<span class="badge preset-filled-primary-500 text-xs">Primary</span>
													{/if}
													{#if assignment.unassignedAt}
														<span class="badge preset-outlined-surface-500 text-xs">Past</span>
													{/if}
												</div>
												<p class="mt-1 font-medium truncate">{assignment.case.title}</p>
												<div class="mt-2 flex items-center gap-3 text-xs">
													<span class="badge {getCaseStatusColor(assignment.case.status)}">
														{assignment.case.status}
													</span>
													<span class="badge {getCasePriorityColor(assignment.case.priority)}">
														{assignment.case.priority}
													</span>
												</div>
											</div>
											<div class="text-right text-xs text-surface-500">
												<p>Assigned: {formatDate(assignment.assignedAt)}</p>
												{#if assignment.unassignedAt}
													<p class="mt-1">Unassigned: {formatDate(assignment.unassignedAt)}</p>
												{/if}
											</div>
										</div>
										{#if assignment.justification}
											<p class="mt-2 text-sm text-surface-500 italic">{assignment.justification}</p>
										{/if}
									</a>
								{/each}
							</div>
						{/if}
					</Card>
				</div>

			{:else if activeTab === 'activity'}
				<!-- Activity Content -->
				<div class="mt-8">
					<Card variant="outlined" padding="lg">
						<div class="flex items-center justify-between">
							<h2 class="text-lg font-semibold">Recent Activity</h2>
							<button
								onclick={loadActivity}
								disabled={activityLoading}
								class="btn preset-outlined-surface-500 btn-sm"
							>
								{#if activityLoading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<RefreshCw class="mr-2 h-4 w-4" />
								{/if}
								Refresh
							</button>
						</div>

						{#if activityLoading && activityEvents.length === 0}
							<div class="mt-6 flex items-center justify-center py-8">
								<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
							</div>
						{:else if activityError}
							<div class="mt-4 rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
								{activityError}
							</div>
						{:else if activityEvents.length === 0}
							<div class="mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300-700 p-8">
								<Activity class="h-12 w-12 text-surface-400" />
								<p class="mt-2 text-sm text-surface-500">No activity recorded</p>
								<p class="text-xs text-surface-400">Activity will appear here as this staff member performs actions</p>
							</div>
						{:else}
							<div class="mt-4 space-y-3">
								{#each activityEvents as event}
									<div class="rounded-lg border border-surface-300-700 p-4">
										<div class="flex items-start justify-between gap-4">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 flex-wrap">
													<span class="badge {getEventCategoryColor(event.eventCategory)} text-xs">
														{event.eventCategory}
													</span>
													<span class="font-mono text-xs text-surface-500">{event.action}</span>
												</div>
												<p class="mt-1 text-sm">{event.summary}</p>
												<p class="mt-1 text-xs text-surface-400">
													{event.entityType} • {event.entityId.slice(0, 8)}...
												</p>
											</div>
											<div class="text-right text-xs text-surface-500 whitespace-nowrap">
												{formatDateTime(event.performedAt)}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Card>
				</div>
			{/if}
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

			<!-- SLA Warning (Phase 16+14 Wave 7.2) -->
			<div class="mt-4 rounded-lg border border-warning-300-700 bg-warning-50-950 p-3">
				<div class="flex items-start gap-2">
					<Clock class="h-4 w-4 text-warning-500 flex-shrink-0 mt-0.5" />
					<div class="text-sm">
						<p class="font-medium text-warning-700 dark:text-warning-300">24-Hour Admin Review Required</p>
						<p class="mt-0.5 text-warning-600 dark:text-warning-400">
							Suspensions must be reviewed by a senior administrator within 24 hours.
							An escalation notification will be sent if not reviewed.
						</p>
					</div>
				</div>
			</div>

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

			<!-- Active Case Count Warning -->
			{#if deactivateLoadingCount}
				<div class="mt-4 flex items-center gap-2 rounded-lg bg-surface-100 dark:bg-surface-800 p-3">
					<Loader2 class="h-4 w-4 animate-spin text-surface-500" />
					<span class="text-sm text-surface-500">Checking active assignments...</span>
				</div>
			{:else if deactivateActiveCount > 0}
				<div class="mt-4 rounded-lg bg-error-500/10 border border-error-500/20 p-4">
					<div class="flex items-start gap-3">
						<AlertTriangle class="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
						<div>
							<p class="font-medium text-error-600 dark:text-error-400">
								Cannot Deactivate
							</p>
							<p class="mt-1 text-sm text-error-500">
								This staff member has <strong>{deactivateActiveCount}</strong> active case {deactivateActiveCount === 1 ? 'assignment' : 'assignments'}.
								Please reassign these cases before deactivating.
							</p>
							<a
								href="/app/admin/staff/{staff?.id}"
								onclick={() => {
									showDeactivateModal = false;
									activeTab = 'assignments';
								}}
								class="mt-2 inline-block text-sm text-primary-500 hover:underline"
							>
								View assignments →
							</a>
						</div>
					</div>
				</div>
			{:else}
				<div class="mt-4 rounded-lg bg-success-500/10 border border-success-500/20 p-3">
					<div class="flex items-center gap-2">
						<CheckCircle class="h-4 w-4 text-success-500" />
						<span class="text-sm text-success-600 dark:text-success-400">No active case assignments</span>
					</div>
				</div>
			{/if}

			<div class="mt-4">
				<label for="deactivateReason" class="label">Reason for deactivation *</label>
				<textarea
					id="deactivateReason"
					bind:value={deactivateReason}
					placeholder="Enter the reason for deactivation..."
					rows="3"
					class="textarea w-full"
					required
					disabled={deactivateActiveCount > 0}
				></textarea>
			</div>
			<div class="mt-6 flex justify-end gap-3">
				<button
					onclick={() => {
						showDeactivateModal = false;
						deactivateReason = '';
						deactivateActiveCount = 0;
					}}
					class="btn preset-outlined-surface-500"
				>
					Cancel
				</button>
				<button
					onclick={handleDeactivate}
					disabled={!deactivateReason.trim() || actionLoading === 'deactivate' || deactivateActiveCount > 0 || deactivateLoadingCount}
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
