<script lang="ts">
	import { page } from '$app/stores';
	import {
		ArrowLeft,
		Clock,
		FileText,
		Users,
		Home,
		Settings,
		Play,
		MessageSquare,
		Scale,
		User,
		CheckCircle,
		AlertTriangle,
		Activity,
		Shield,
		Loader2,
		RefreshCw,
		ChevronRight,
		Calendar,
		MapPin,
		Phone,
		Mail,
		ExternalLink
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { invalidate } from '$app/navigation';

	// Get data from server load function
	let { data } = $props();
	const caseDetail = $derived(data.caseDetail);

	let activeTab = $state<string>('overview');
	let isRefreshing = $state(false);

	async function refresh() {
		isRefreshing = true;
		try {
			await invalidate('data');
		} finally {
			isRefreshing = false;
		}
	}

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			INTAKE: 'Intake',
			ASSESSMENT: 'Assessment',
			IN_PROGRESS: 'In Progress',
			PENDING_EXTERNAL: 'Pending External',
			PENDING_OWNER: 'Pending Owner',
			ON_HOLD: 'On Hold',
			RESOLVED: 'Resolved',
			CLOSED: 'Closed',
			CANCELLED: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			INTAKE: 'preset-filled-primary-500',
			ASSESSMENT: 'preset-filled-secondary-500',
			IN_PROGRESS: 'preset-filled-warning-500',
			PENDING_EXTERNAL: 'preset-filled-tertiary-500',
			PENDING_OWNER: 'preset-filled-error-500',
			ON_HOLD: 'preset-filled-surface-500',
			RESOLVED: 'preset-filled-success-500',
			CLOSED: 'preset-outlined-surface-500',
			CANCELLED: 'preset-outlined-surface-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getPriorityBadgeClass(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'preset-outlined-surface-500',
			NORMAL: 'preset-outlined-primary-500',
			HIGH: 'preset-filled-warning-500',
			URGENT: 'preset-filled-error-500',
			EMERGENCY: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-outlined-surface-500';
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
			day: 'numeric'
		});
	}

	function getTimeInState(updatedAt: string): string {
		const ms = Date.now() - new Date(updatedAt).getTime();
		const hours = Math.floor(ms / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h`;
		return 'Just now';
	}

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Home },
		{ id: 'context', label: 'Context', icon: MapPin },
		{ id: 'scope', label: 'Scope', icon: Settings },
		{ id: 'tasks', label: 'Tasks', icon: CheckCircle },
		{ id: 'vendors', label: 'Vendors', icon: Users },
		{ id: 'communications', label: 'Comms', icon: MessageSquare },
		{ id: 'timeline', label: 'Timeline', icon: Clock },
		{ id: 'review', label: 'Review', icon: FileText },
		{ id: 'audit', label: 'Audit', icon: Shield }
	];
</script>

<svelte:head>
	<title>{caseDetail?.case.title || 'Case Details'} | Staff View | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/admin/work-queue"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Work Queue
			</a>
		</div>


			<!-- Header -->
			<div class="mb-6">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div class="flex flex-wrap items-center gap-3">
							<span class="text-sm font-medium text-surface-500">{caseDetail.case.caseNumber}</span>
							<span class="badge {getStatusColor(caseDetail.case.status)}">
								{getStatusLabel(caseDetail.case.status)}
							</span>
							<span class="badge {getPriorityBadgeClass(caseDetail.case.priority)}">
								{caseDetail.case.priority}
							</span>
						</div>
						<h1 class="mt-2 text-2xl font-bold">{caseDetail.case.title}</h1>
						<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
							<span class="flex items-center gap-1">
								<Calendar class="h-4 w-4" />
								Created {formatShortDate(caseDetail.case.createdAt)}
							</span>
							<span class="flex items-center gap-1">
								<Clock class="h-4 w-4" />
								In state: {getTimeInState(caseDetail.case.updatedAt)}
							</span>
							{#if caseDetail.case.assignedConciergeName}
								<span class="flex items-center gap-1">
									<User class="h-4 w-4" />
									{caseDetail.case.assignedConciergeName}
								</span>
							{:else}
								<span class="flex items-center gap-1 text-warning-500">
									<AlertTriangle class="h-4 w-4" />
									Unassigned
								</span>
							{/if}
						</div>
					</div>
					<div class="flex flex-wrap gap-2">
						<button onclick={refresh} class="btn preset-outlined-surface-500" disabled={isRefreshing}>
							{#if isRefreshing}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Refresh
						</button>
					</div>
				</div>
			</div>

			<!-- Tabs -->
			<div class="mb-6 border-b border-surface-300-700">
				<nav class="-mb-px flex gap-4 overflow-x-auto">
					{#each tabs as tab}
						<button
							class="flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === tab.id
								? 'border-primary-500 text-primary-500'
								: 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 dark:hover:text-surface-300'}"
							onclick={() => (activeTab = tab.id)}
						>
							<tab.icon class="h-4 w-4" />
							{tab.label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Tab Content -->
			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="lg:col-span-2 space-y-6">
					{#if activeTab === 'overview'}
						<!-- Overview Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Case Summary</h2>
							<p class="mt-4 text-surface-600 dark:text-surface-400">
								{caseDetail.case.description}
							</p>
						</Card>

						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Property Information</h2>
							<div class="mt-4 space-y-3">
								<div class="flex items-start gap-3">
									<Home class="h-5 w-5 text-surface-400 mt-0.5" />
									<div>
										<p class="font-medium">{caseDetail.property.name}</p>
										<p class="text-sm text-surface-500">{caseDetail.property.addressLine1}</p>
									</div>
								</div>
							</div>
						</Card>

						<!-- Status History -->
						{#if caseDetail.statusHistory && caseDetail.statusHistory.length > 0}
							<Card variant="outlined" padding="lg">
								<h2 class="text-lg font-semibold">Status History</h2>
								<div class="mt-4 space-y-3">
									{#each caseDetail.statusHistory.slice(0, 5) as history}
										<div class="flex items-start gap-3 border-l-2 border-surface-300-700 pl-4">
											<div class="flex-1">
												<div class="flex items-center gap-2">
													{#if history.fromStatus}
														<span class="text-sm text-surface-500">{getStatusLabel(history.fromStatus)}</span>
														<ChevronRight class="h-4 w-4 text-surface-400" />
													{/if}
													<span class="text-sm font-medium">{getStatusLabel(history.toStatus)}</span>
												</div>
												{#if history.reason}
													<p class="mt-1 text-sm text-surface-500">{history.reason}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(history.createdAt)}</p>
											</div>
										</div>
									{/each}
								</div>
							</Card>
						{/if}

					{:else if activeTab === 'context'}
						<!-- Context Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Property Context</h2>
							<div class="mt-4 space-y-4">
								<div>
									<h3 class="text-sm font-medium text-surface-500">Property</h3>
									<p class="mt-1">{caseDetail.property.name}</p>
									<p class="text-sm text-surface-500">{caseDetail.property.addressLine1}</p>
								</div>
							</div>
						</Card>

						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Issue Description</h2>
							<p class="mt-4 text-surface-600 dark:text-surface-400">
								{caseDetail.case.description}
							</p>
						</Card>

					{:else if activeTab === 'scope'}
						<!-- Scope Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Work Scope</h2>
							<p class="mt-4 text-surface-500">
								Work scope details will be displayed here once defined.
							</p>
						</Card>

					{:else if activeTab === 'tasks'}
						<!-- Tasks Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Tasks & Actions</h2>
							{#if caseDetail.actions && caseDetail.actions.length > 0}
								<div class="mt-4 space-y-3">
									{#each caseDetail.actions as action}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start justify-between">
												<div>
													<p class="font-medium">{action.actionType}</p>
													{#if action.description}
														<p class="mt-1 text-sm text-surface-500">{action.description}</p>
													{/if}
												</div>
												<span class="badge preset-outlined-surface-500 text-xs">
													{action.status}
												</span>
											</div>
											<p class="mt-2 text-xs text-surface-400">{formatDate(action.createdAt)}</p>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-surface-500">No actions recorded yet.</p>
							{/if}
						</Card>

					{:else if activeTab === 'vendors'}
						<!-- Vendors Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Vendor Candidates</h2>
								<a
									href="/app/admin/cases/{caseDetail.case.id}/vendors"
									class="btn preset-filled-primary-500"
								>
									<Users class="mr-2 h-4 w-4" />
									Open Vendor Research
								</a>
							</div>
							<p class="mt-4 text-surface-500">
								Use the Vendor Research workspace to discover, extract, and manage vendor candidates for this case.
							</p>
						</Card>

					{:else if activeTab === 'communications'}
						<!-- Communications Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Notes & Communications</h2>
							{#if caseDetail.notes && caseDetail.notes.length > 0}
								<div class="mt-4 space-y-3">
									{#each caseDetail.notes as note}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start gap-3">
												<MessageSquare class="h-5 w-5 text-surface-400 mt-0.5" />
												<div class="flex-1">
													<div class="flex items-center gap-2">
														<span class="badge preset-outlined-surface-500 text-xs">{note.noteType}</span>
														{#if note.isInternal}
															<span class="badge preset-filled-warning-500 text-xs">Internal</span>
														{/if}
													</div>
													<p class="mt-2 text-sm">{note.content}</p>
													<p class="mt-2 text-xs text-surface-400">
														{formatDate(note.createdAt)}
													</p>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-surface-500">No notes or communications recorded yet.</p>
							{/if}
						</Card>

					{:else if activeTab === 'timeline'}
						<!-- Timeline Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Activity Timeline</h2>
							<p class="mt-1 text-sm text-surface-500">Complete chronological history of all case events</p>
							
							<div class="mt-6 space-y-4">
								<!-- Status changes -->
								{#if caseDetail.statusHistory}
									{#each caseDetail.statusHistory as history}
										<div class="flex gap-4">
											<div class="flex flex-col items-center">
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10">
													<Activity class="h-4 w-4 text-primary-500" />
												</div>
												<div class="flex-1 w-px bg-surface-300-700"></div>
											</div>
											<div class="flex-1 pb-4">
												<p class="font-medium">
													Status changed to {getStatusLabel(history.toStatus)}
												</p>
												{#if history.fromStatus}
													<p class="text-sm text-surface-500">From: {getStatusLabel(history.fromStatus)}</p>
												{/if}
												{#if history.reason}
													<p class="mt-1 text-sm text-surface-500">{history.reason}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(history.createdAt)}</p>
											</div>
										</div>
									{/each}
								{/if}

								<!-- Notes -->
								{#if caseDetail.notes}
									{#each caseDetail.notes as note}
										<div class="flex gap-4">
											<div class="flex flex-col items-center">
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500/10">
													<MessageSquare class="h-4 w-4 text-secondary-500" />
												</div>
												<div class="flex-1 w-px bg-surface-300-700"></div>
											</div>
											<div class="flex-1 pb-4">
												<p class="font-medium">{note.noteType} added</p>
												<p class="mt-1 text-sm text-surface-500 line-clamp-2">{note.content}</p>
												<p class="mt-2 text-xs text-surface-400">
													{formatDate(note.createdAt)}
												</p>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</Card>

					{:else if activeTab === 'review'}
						<!-- Review Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<FileText class="h-5 w-5 text-primary-500" />
									<h2 class="text-lg font-semibold">Case Review</h2>
								</div>
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Post-completion review for institutional knowledge
							</p>

							<div class="mt-6 rounded-lg bg-surface-100-900 p-4">
								<p class="text-sm text-surface-500">
									Case reviews capture outcome summaries, vendor performance notes, issues encountered, and reusability flags.
									Reviews can be created once a case is resolved or closed.
								</p>
								{#if caseDetail.case.status === 'RESOLVED' || caseDetail.case.status === 'CLOSED'}
									<p class="mt-2 text-sm text-success-500">
										This case is eligible for review.
									</p>
								{:else}
									<p class="mt-2 text-sm text-warning-500">
										Case must be resolved or closed before creating a review.
									</p>
								{/if}
							</div>
						</Card>

					{:else if activeTab === 'audit'}
						<!-- Audit Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<Shield class="h-5 w-5 text-primary-500" />
								<h2 class="text-lg font-semibold">Audit Trail</h2>
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Complete audit log of all actions taken on this case
							</p>

							<div class="mt-6">
								<div class="rounded-lg bg-surface-100-900 p-4">
									<p class="text-sm text-surface-500">
										Audit trail data is available via the Activity Events API.
										This view will display all recorded ActivityEvents for this case entity.
									</p>
									<a
										href="/app/admin/activity?entityType=CONCIERGE_CASE&entityId={caseDetail.case.id}"
										class="btn preset-outlined-primary-500 mt-4"
									>
										<Activity class="mr-2 h-4 w-4" />
										View Full Audit Log
									</a>
								</div>
							</div>

							<!-- Quick audit summary -->
							<div class="mt-6 space-y-4">
								<h3 class="font-medium">Quick Summary</h3>
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Created</p>
										<p class="font-medium">{formatDate(caseDetail.case.createdAt)}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Last Updated</p>
										<p class="font-medium">{formatDate(caseDetail.case.updatedAt)}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Status Changes</p>
										<p class="font-medium">{caseDetail.statusHistory?.length || 0}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Notes Added</p>
										<p class="font-medium">{caseDetail.notes?.length || 0}</p>
									</div>
								</div>
							</div>
						</Card>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Quick Actions -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Quick Actions</h3>
						<div class="mt-4 space-y-2">
							<button class="btn preset-outlined-surface-500 w-full justify-start">
								<User class="mr-2 h-4 w-4" />
								Reassign Case
							</button>
							<button class="btn preset-outlined-surface-500 w-full justify-start">
								<Settings class="mr-2 h-4 w-4" />
								Change Status
							</button>
							<button class="btn preset-outlined-surface-500 w-full justify-start">
								<MessageSquare class="mr-2 h-4 w-4" />
								Add Note
							</button>
						</div>
					</Card>

					<!-- Assignment Info -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Assignment</h3>
						<div class="mt-4">
							{#if caseDetail.case.assignedConciergeName}
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
										<User class="h-5 w-5 text-primary-500" />
									</div>
									<div>
										<p class="font-medium">{caseDetail.case.assignedConciergeName}</p>
										<p class="text-sm text-surface-500">Assigned Concierge</p>
									</div>
								</div>
							{:else}
								<div class="flex items-center gap-3 text-warning-500">
									<AlertTriangle class="h-5 w-5" />
									<span>No one assigned</span>
								</div>
							{/if}
						</div>
					</Card>

					<!-- Case Metadata -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Case Details</h3>
						<div class="mt-4 space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-surface-500">Case ID</span>
								<span class="font-mono text-xs">{caseDetail.case.id.slice(0, 8)}...</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Case Number</span>
								<span>{caseDetail.case.caseNumber}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Status</span>
								<span>{getStatusLabel(caseDetail.case.status)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Priority</span>
								<span>{caseDetail.case.priority}</span>
							</div>
							{#if caseDetail.case.resolvedAt}
								<div class="flex justify-between">
									<span class="text-surface-500">Resolved</span>
									<span>{formatShortDate(caseDetail.case.resolvedAt)}</span>
								</div>
							{/if}
							{#if caseDetail.case.closedAt}
								<div class="flex justify-between">
									<span class="text-surface-500">Closed</span>
									<span>{formatShortDate(caseDetail.case.closedAt)}</span>
								</div>
							{/if}
						</div>
					</Card>
				</div>
			</div>
	</div>
</PageContainer>

