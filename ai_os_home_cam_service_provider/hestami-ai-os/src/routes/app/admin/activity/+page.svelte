<script lang="ts">
	import { page } from '$app/stores';
	import {
		Activity,
		Filter,
		RefreshCw,
		Loader2,
		User,
		Bot,
		Server,
		ChevronRight,
		Calendar,
		Clock,
		Search,
		FileText,
		AlertTriangle,
		CheckCircle,
		XCircle,
		ArrowRight,
		Building2,
		Eye,
		Scale,
		Users,
		AlertOctagon,
		Download
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Select } from 'flowbite-svelte';
	import {
		activityEventApi,
		ENTITY_TYPE_LABELS,
		ACTION_TYPE_LABELS,
		ACTOR_TYPE_LABELS,
		EVENT_CATEGORY_LABELS,
		EVENT_CATEGORY_COLORS,
		getActionColor,
		type ActivityEntityType,
		type ActivityActionType,
		type ActivityEventCategory,
		type ActivityActorType
	} from '$lib/api/activityEvent';
	import {
		ActivityEntityTypeValues,
		ActivityActionTypeValues,
		ActivityActorTypeValues,
		ActivityEventCategoryValues
	} from '$lib/api/cam';
	import type { operations } from '$lib/api/types.generated';

	// Use the actual type from staffList response which includes organizationName
	type StaffActivityEvent = operations['activityEvent.staffList']['responses']['200']['content']['application/json']['data']['events'][number];

	// URL params for filtering
	const urlEntityType = $derived($page.url.searchParams.get('entityType') as ActivityEntityType | null);
	const urlEntityId = $derived($page.url.searchParams.get('entityId'));

	interface Props {
		data: {
			events: StaffActivityEvent[];
			pagination: { total: number; hasMore: boolean; nextCursor: string | null };
			filters: {
				entityType: ActivityEntityType | '';
				entityId: string;
				action: ActivityActionType | '';
				eventCategory: ActivityEventCategory | '';
				actorType: ActivityActorType | '';
				startDate: string;
				endDate: string;
			};
		};
	}

	let { data }: Props = $props();

	let events = $state<StaffActivityEvent[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	// Use $state instead of $derived to avoid proxy errors during navigation
	let hasMore = $state(false);
	let nextCursor = $state<string | null>(null);

	// Pillar definitions for filtering
	type Pillar = 'CAM' | 'CONTRACTOR' | 'CONCIERGE' | 'ADMIN';
	const PILLAR_ENTITY_TYPES: Record<Pillar, ActivityEntityType[]> = {
		CAM: [
			ActivityEntityTypeValues.ASSOCIATION,
			ActivityEntityTypeValues.UNIT,
			ActivityEntityTypeValues.VIOLATION,
			ActivityEntityTypeValues.ARC_REQUEST,
			ActivityEntityTypeValues.MEETING,
			ActivityEntityTypeValues.RESOLUTION,
			ActivityEntityTypeValues.ASSESSMENT,
			ActivityEntityTypeValues.GOVERNING_DOCUMENT,
			ActivityEntityTypeValues.BOARD_ACTION
		],
		CONTRACTOR: [
			ActivityEntityTypeValues.JOB,
			ActivityEntityTypeValues.WORK_ORDER,
			ActivityEntityTypeValues.ESTIMATE,
			ActivityEntityTypeValues.INVOICE,
			ActivityEntityTypeValues.TECHNICIAN,
			ActivityEntityTypeValues.CONTRACTOR
		],
		CONCIERGE: [
			ActivityEntityTypeValues.CONCIERGE_CASE,
			ActivityEntityTypeValues.CONCIERGE_ACTION,
			ActivityEntityTypeValues.OWNER_INTENT,
			ActivityEntityTypeValues.INDIVIDUAL_PROPERTY,
			ActivityEntityTypeValues.VENDOR_CANDIDATE,
			ActivityEntityTypeValues.VENDOR_BID
		],
		ADMIN: [
			ActivityEntityTypeValues.USER,
			ActivityEntityTypeValues.ORGANIZATION,
			ActivityEntityTypeValues.STAFF,
			ActivityEntityTypeValues.STAFF_ASSIGNMENT,
			ActivityEntityTypeValues.DOCUMENT
		]
	};

	const PILLAR_LABELS: Record<Pillar, string> = {
		CAM: 'Community Association',
		CONTRACTOR: 'Contractor',
		CONCIERGE: 'Concierge',
		ADMIN: 'Administration'
	};

	// =============================================================================
	// Forensic Lenses - Filter events by analytical perspective
	// =============================================================================
	type ForensicLens = 'DECISION' | 'AUTHORITY' | 'EXTERNAL' | 'DISPUTE' | null;

	const FORENSIC_LENS_CONFIG: Record<NonNullable<ForensicLens>, {
		label: string;
		description: string;
		icon: typeof Eye;
		filter: (event: StaffActivityEvent) => boolean;
	}> = {
		DECISION: {
			label: 'Decision Lens',
			description: 'Only decisions and approvals',
			icon: Scale,
			filter: (event) => {
				// Show DECISION category events or approval/denial actions
				const decisionActions = [
					ActivityActionTypeValues.APPROVE,
					ActivityActionTypeValues.DENY,
					ActivityActionTypeValues.SUBMIT,
					ActivityActionTypeValues.CLOSE
				];
				return event.eventCategory === ActivityEventCategoryValues.DECISION ||
					(decisionActions as string[]).includes(event.action);
			}
		},
		AUTHORITY: {
			label: 'Authority Lens',
			description: 'Board, manager, and delegated authority actions',
			icon: Users,
			filter: (event) => {
				// Show events from users with authority roles
				const meta = event.metadata as Record<string, unknown> | null;
				const actorContext = meta?.actorContext as { orgRole?: string | null; staffRoles?: string[] } | undefined;
				const authoritySource = meta?.authoritySource as { type?: string } | undefined;

				// Check for authority indicators
				const authorityRoles = ['OWNER', 'MANAGER', 'ADMIN', 'BOARD', 'PRESIDENT', 'TREASURER', 'SECRETARY'];
				const hasAuthorityRole = actorContext?.orgRole &&
					authorityRoles.some(r => actorContext.orgRole?.toUpperCase().includes(r));
				const hasAuthorityStaffRole = actorContext?.staffRoles?.some(r =>
					['OPERATIONS_COORDINATOR', 'PLATFORM_ADMIN'].includes(r));
				const hasAuthoritySource = authoritySource?.type &&
					['POLICY', 'RESOLUTION', 'DELEGATION'].includes(authoritySource.type);

				return !!(hasAuthorityRole || hasAuthorityStaffRole || hasAuthoritySource);
			}
		},
		EXTERNAL: {
			label: 'External Lens',
			description: 'HOA, vendor, and third-party actions',
			icon: Building2,
			filter: (event) => {
				// Show events from external parties
				const meta = event.metadata as Record<string, unknown> | null;
				const isExternal = meta?.isExternalAction === true || meta?.externalParty != null;

				// Also include vendor and external HOA entity types
				const externalEntityTypes = [
					ActivityEntityTypeValues.VENDOR_CANDIDATE,
					ActivityEntityTypeValues.VENDOR_BID
				];

				return isExternal || (externalEntityTypes as string[]).includes(event.entityType);
			}
		},
		DISPUTE: {
			label: 'Dispute Lens',
			description: 'Escalations, overrides, and conflicts',
			icon: AlertOctagon,
			filter: (event) => {
				// Show escalations, cancellations, status changes that indicate disputes
				const disputeActions = [
					ActivityActionTypeValues.ESCALATE,
					ActivityActionTypeValues.CANCEL,
					ActivityActionTypeValues.DENY
				];

				// Check metadata for dispute indicators
				const meta = event.metadata as Record<string, unknown> | null;
				const hasDisputeTag = meta?.isDispute === true ||
					meta?.escalationReason != null ||
					meta?.overrideReason != null;

				// Check summary for dispute keywords
				const disputeKeywords = ['escalat', 'override', 'dispute', 'appeal', 'reject', 'denied'];
				const summaryHasDispute = disputeKeywords.some(kw =>
					event.summary.toLowerCase().includes(kw));

				return (disputeActions as string[]).includes(event.action) ||
					hasDisputeTag ||
					summaryHasDispute;
			}
		}
	};

	// Active forensic lens
	let activeLens = $state<ForensicLens>(null);

	// Filters (initialized with defaults, synced via $effect below)
	let entityTypeFilter = $state<ActivityEntityType | ''>('');
	let actionFilter = $state<ActivityActionType | ''>('');
	let categoryFilter = $state<ActivityEventCategory | ''>('');
	let actorTypeFilter = $state<ActivityActorType | ''>('');
	let pillarFilter = $state<Pillar | ''>('');
	let startDate = $state('');
	let endDate = $state('');

	// Synchronize server data to local state
	// Track data to trigger re-runs on navigation, but guard against undefined
	$effect(() => {
		if (data == null || typeof data !== 'object') return;
		if (data.events) {
			events = [...data.events];
		}
		hasMore = data.pagination?.hasMore ?? false;
		nextCursor = data.pagination?.nextCursor ?? null;
		entityTypeFilter = data.filters?.entityType ?? '';
		actionFilter = data.filters?.action ?? '';
		categoryFilter = data.filters?.eventCategory ?? '';
		actorTypeFilter = data.filters?.actorType ?? '';
		startDate = data.filters?.startDate ?? '';
		endDate = data.filters?.endDate ?? '';
	});

	// Selected event for detail view
	let selectedEvent = $state<StaffActivityEvent | null>(null);

	// Client-side filtering (pillar + forensic lens)
	const filteredEvents = $derived(() => {
		let result = events;

		// Apply pillar filter
		if (pillarFilter) {
			const pillarEntityTypes = PILLAR_ENTITY_TYPES[pillarFilter];
			result = result.filter(e => pillarEntityTypes.includes(e.entityType as ActivityEntityType));
		}

		// Apply forensic lens filter
		if (activeLens) {
			const lensConfig = FORENSIC_LENS_CONFIG[activeLens];
			result = result.filter(lensConfig.filter);
		}

		return result;
	});

	// Helper to get pillar label for an entity type
	function getPillarForEntityType(entityType: ActivityEntityType): string | null {
		for (const [pillar, types] of Object.entries(PILLAR_ENTITY_TYPES)) {
			if (types.includes(entityType)) {
				return PILLAR_LABELS[pillar as Pillar];
			}
		}
		return null;
	}

	async function loadEvents(append = false) {
		if (!append) {
			// Update URL for filtering
			const params = new URLSearchParams();
			if (entityTypeFilter) params.set('entityType', entityTypeFilter);
			if (actionFilter) params.set('action', actionFilter);
			if (categoryFilter) params.set('eventCategory', categoryFilter);
			if (actorTypeFilter) params.set('actorType', actorTypeFilter);
			if (startDate) params.set('startDate', startDate);
			if (endDate) params.set('endDate', endDate);
			
			window.location.href = `/app/admin/activity?${params.toString()}`;
			return;
		}

		// Pagination still needs client-side fetch if we want to stay on page
		isLoading = true;
		error = null;

		try {
			const response = await activityEventApi.staffList({
				entityType: entityTypeFilter || undefined,
				action: actionFilter || undefined,
				eventCategory: categoryFilter || undefined,
				performedByType: actorTypeFilter || undefined,
				startDate: startDate ? new Date(startDate).toISOString() : undefined,
				endDate: endDate ? new Date(endDate).toISOString() : undefined,
				limit: 50,
				cursor: nextCursor || undefined
			});
			if (response.ok) {
				events = [...events, ...response.data.events] as StaffActivityEvent[];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load more activity events';
		} finally {
			isLoading = false;
		}
	}


	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatShortDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getActorIcon(actorType: ActivityActorType) {
		switch (actorType) {
			case ActivityActorTypeValues.HUMAN:
				return User;
			case ActivityActorTypeValues.AI:
				return Bot;
			case ActivityActorTypeValues.SYSTEM:
				return Server;
			default:
				return User;
		}
	}

	function getCategoryBadgeClass(category: ActivityEventCategory): string {
		const colorMap: Record<ActivityEventCategory, string> = {
			[ActivityEventCategoryValues.INTENT]: 'preset-outlined-primary-500',
			[ActivityEventCategoryValues.DECISION]: 'preset-outlined-warning-500',
			[ActivityEventCategoryValues.EXECUTION]: 'preset-outlined-success-500',
			[ActivityEventCategoryValues.SYSTEM]: 'preset-outlined-surface-500'
		};
		return colorMap[category] || 'preset-outlined-surface-500';
	}

	function getActionBadgeClass(action: ActivityActionType): string {
		const color = getActionColor(action);
		return `preset-filled-${color}-500`;
	}

	const entityTypes: ActivityEntityType[] = [
		ActivityEntityTypeValues.CONCIERGE_CASE,
		ActivityEntityTypeValues.CONCIERGE_ACTION,
		ActivityEntityTypeValues.WORK_ORDER,
		ActivityEntityTypeValues.VIOLATION,
		ActivityEntityTypeValues.ARC_REQUEST,
		ActivityEntityTypeValues.USER,
		ActivityEntityTypeValues.STAFF,
		ActivityEntityTypeValues.STAFF_ASSIGNMENT,
		ActivityEntityTypeValues.ORGANIZATION,
		ActivityEntityTypeValues.INDIVIDUAL_PROPERTY,
		ActivityEntityTypeValues.ASSOCIATION,
		ActivityEntityTypeValues.MEETING,
		ActivityEntityTypeValues.RESOLUTION,
		ActivityEntityTypeValues.VENDOR_CANDIDATE,
		ActivityEntityTypeValues.VENDOR_BID,
		ActivityEntityTypeValues.DOCUMENT
	];

	const actionTypes: ActivityActionType[] = [
		ActivityActionTypeValues.CREATE,
		ActivityActionTypeValues.UPDATE,
		ActivityActionTypeValues.DELETE,
		ActivityActionTypeValues.STATUS_CHANGE,
		ActivityActionTypeValues.ASSIGN,
		ActivityActionTypeValues.UNASSIGN,
		ActivityActionTypeValues.APPROVE,
		ActivityActionTypeValues.DENY,
		ActivityActionTypeValues.SUBMIT,
		ActivityActionTypeValues.COMPLETE,
		ActivityActionTypeValues.CLOSE,
		ActivityActionTypeValues.CANCEL,
		ActivityActionTypeValues.ESCALATE,
		ActivityActionTypeValues.SCHEDULE,
		ActivityActionTypeValues.DISPATCH,
		ActivityActionTypeValues.ARCHIVE,
		ActivityActionTypeValues.LOGIN,
		ActivityActionTypeValues.LOGOUT
	];

	const categories: ActivityEventCategory[] = [
		ActivityEventCategoryValues.INTENT,
		ActivityEventCategoryValues.DECISION,
		ActivityEventCategoryValues.EXECUTION,
		ActivityEventCategoryValues.SYSTEM
	];
	const actorTypes: ActivityActorType[] = [
		ActivityActorTypeValues.HUMAN,
		ActivityActorTypeValues.AI,
		ActivityActorTypeValues.SYSTEM
	];

	// =============================================================================
	// Export Modal
	// =============================================================================
	let showExportModal = $state(false);
	let exportFormat = $state<'json' | 'csv'>('json');
	let exportStartDate = $state('');
	let exportEndDate = $state('');
	let exportIncludeMetadata = $state(false);
	let exportIncludeStateChanges = $state(false);
	let isExporting = $state(false);
	let exportError = $state<string | null>(null);

	// Set default export dates to last 30 days
	$effect(() => {
		if (!exportStartDate) {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			exportStartDate = thirtyDaysAgo.toISOString().split('T')[0];
		}
		if (!exportEndDate) {
			exportEndDate = new Date().toISOString().split('T')[0];
		}
	});

	async function handleExport() {
		if (!exportStartDate || !exportEndDate) {
			exportError = 'Please select start and end dates';
			return;
		}

		isExporting = true;
		exportError = null;

		try {
			const response = await activityEventApi.staffExport({
				format: exportFormat,
				startDate: new Date(exportStartDate).toISOString(),
				endDate: new Date(exportEndDate + 'T23:59:59').toISOString(),
				entityType: entityTypeFilter || undefined,
				includeMetadata: exportIncludeMetadata,
				includeStateChanges: exportIncludeStateChanges
			});

			if (response.ok) {
				// Create a blob and download
				const blob = new Blob(
					[response.data.content],
					{ type: exportFormat === 'csv' ? 'text/csv' : 'application/json' }
				);
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = response.data.filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				showExportModal = false;
			} else {
				exportError = 'Export failed. Please try again.';
			}
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'Export failed';
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Activity Log | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Activity Log</h1>
				<p class="mt-1 text-surface-500">
					{#if urlEntityType && urlEntityId}
						Audit trail for {ENTITY_TYPE_LABELS[urlEntityType]} {urlEntityId.slice(0, 8)}...
					{:else}
						Complete audit trail of all platform activity
					{/if}
				</p>
			</div>
			<div class="flex gap-2">
				<button onclick={() => showExportModal = true} class="btn preset-outlined-surface-500">
					<Download class="mr-2 h-4 w-4" />
					Export
				</button>
				<button onclick={() => loadEvents()} class="btn preset-outlined-primary-500" disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<RefreshCw class="mr-2 h-4 w-4" />
					{/if}
					Refresh
				</button>
			</div>
		</div>

		<!-- Filters -->
		{#if !urlEntityId}
			<div class="mt-6 rounded-lg border border-surface-300-700 bg-surface-50-950 p-4">
				<div class="flex items-center gap-2 mb-4">
					<Filter class="h-4 w-4 text-surface-400" />
					<span class="text-sm font-medium">Filters</span>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<div>
						<label for="pillar" class="block text-xs font-medium text-surface-500 mb-1">Pillar</label>
						<Select id="pillar" bind:value={pillarFilter} size="sm">
							<option value="">All Pillars</option>
							<option value="CAM">{PILLAR_LABELS.CAM}</option>
							<option value="CONTRACTOR">{PILLAR_LABELS.CONTRACTOR}</option>
							<option value="CONCIERGE">{PILLAR_LABELS.CONCIERGE}</option>
							<option value="ADMIN">{PILLAR_LABELS.ADMIN}</option>
						</Select>
					</div>
					<div>
						<label for="entityType" class="block text-xs font-medium text-surface-500 mb-1">Entity Type</label>
						<Select id="entityType" bind:value={entityTypeFilter} size="sm">
							<option value="">All Types</option>
							{#each entityTypes as type}
								<option value={type}>{ENTITY_TYPE_LABELS[type]}</option>
							{/each}
						</Select>
					</div>
					<div>
						<label for="action" class="block text-xs font-medium text-surface-500 mb-1">Action</label>
						<Select id="action" bind:value={actionFilter} size="sm">
							<option value="">All Actions</option>
							{#each actionTypes as action}
								<option value={action}>{ACTION_TYPE_LABELS[action]}</option>
							{/each}
						</Select>
					</div>
					<div>
						<label for="category" class="block text-xs font-medium text-surface-500 mb-1">Category</label>
						<Select id="category" bind:value={categoryFilter} size="sm">
							<option value="">All Categories</option>
							{#each categories as cat}
								<option value={cat}>{EVENT_CATEGORY_LABELS[cat]}</option>
							{/each}
						</Select>
					</div>
					<div>
						<label for="actorType" class="block text-xs font-medium text-surface-500 mb-1">Actor Type</label>
						<Select id="actorType" bind:value={actorTypeFilter} size="sm">
							<option value="">All Actors</option>
							{#each actorTypes as actor}
								<option value={actor}>{ACTOR_TYPE_LABELS[actor]}</option>
							{/each}
						</Select>
					</div>
				</div>
				<div class="mt-4 flex flex-wrap items-end gap-4">
					<div>
						<label for="startDate" class="block text-xs font-medium text-surface-500 mb-1">Start Date</label>
						<input type="date" id="startDate" bind:value={startDate} class="input" />
					</div>
					<div>
						<label for="endDate" class="block text-xs font-medium text-surface-500 mb-1">End Date</label>
						<input type="date" id="endDate" bind:value={endDate} class="input" />
					</div>
					<button onclick={() => loadEvents()} class="btn preset-filled-primary-500">
						<Search class="mr-2 h-4 w-4" />
						Apply Filters
					</button>
					<button
						onclick={() => {
							entityTypeFilter = '';
							actionFilter = '';
							categoryFilter = '';
							actorTypeFilter = '';
							pillarFilter = '';
							startDate = '';
							endDate = '';
							activeLens = null;
							loadEvents();
						}}
						class="btn preset-outlined-surface-500"
					>
						Clear
					</button>
				</div>

				<!-- Forensic Lenses -->
				<div class="mt-6 border-t border-surface-300-700 pt-4">
					<div class="flex items-center gap-2 mb-3">
						<Eye class="h-4 w-4 text-surface-400" />
						<span class="text-sm font-medium">Forensic Lenses</span>
						<span class="text-xs text-surface-500">(Filter by analytical perspective)</span>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each Object.entries(FORENSIC_LENS_CONFIG) as [lensKey, config]}
							{@const LensIcon = config.icon}
							<button
								onclick={() => activeLens = activeLens === lensKey ? null : lensKey as ForensicLens}
								class="btn btn-sm {activeLens === lensKey ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
								title={config.description}
							>
								<LensIcon class="mr-1 h-3 w-3" />
								{config.label}
							</button>
						{/each}
					</div>
					{#if activeLens}
						<p class="mt-2 text-xs text-surface-500 italic">
							<Eye class="inline h-3 w-3 mr-1" />
							{FORENSIC_LENS_CONFIG[activeLens].description}
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Events List -->
		<div class="mt-6">
			<!-- Filter Summary -->
			{#if activeLens || pillarFilter}
				<div class="mb-4 flex flex-wrap items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
					<span>Showing {filteredEvents().length} of {events.length} events</span>
					{#if activeLens}
						<span class="badge preset-filled-primary-500 text-xs">
							<Eye class="mr-1 h-3 w-3" />
							{FORENSIC_LENS_CONFIG[activeLens].label}
						</span>
					{/if}
					{#if pillarFilter}
						<span class="badge preset-tonal-surface text-xs">{PILLAR_LABELS[pillarFilter]}</span>
					{/if}
				</div>
			{/if}

			{#if isLoading && events.length === 0}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="lg">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={() => loadEvents()} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if filteredEvents().length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No activity events found"
						description="No events match your current filters. Try adjusting your search criteria."
					/>
				</Card>
			{:else}
				<div class="space-y-2">
					{#each filteredEvents() as event}
						{@const ActorIcon = getActorIcon(event.performedByType)}
						<button
							onclick={() => selectedEvent = selectedEvent?.id === event.id ? null : event}
							class="w-full text-left rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 transition-all hover:border-primary-500 {selectedEvent?.id === event.id ? 'border-primary-500 ring-1 ring-primary-500' : ''}"
						>
							<div class="flex items-start gap-4">
								<!-- Actor Icon -->
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-200-800">
									<ActorIcon class="h-5 w-5 text-surface-600 dark:text-surface-400" />
								</div>

								<!-- Content -->
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										{#if getPillarForEntityType(event.entityType as ActivityEntityType)}
											<span class="badge preset-tonal-surface text-xs">{getPillarForEntityType(event.entityType as ActivityEntityType)}</span>
										{/if}
										<span class="badge {getCategoryBadgeClass(event.eventCategory)} text-xs">
											{EVENT_CATEGORY_LABELS[event.eventCategory]}
										</span>
										<span class="badge {getActionBadgeClass(event.action)} text-xs">
											{ACTION_TYPE_LABELS[event.action]}
										</span>
										<span class="badge preset-outlined-surface-500 text-xs">
											{ENTITY_TYPE_LABELS[event.entityType]}
										</span>
									</div>
									<p class="mt-2 font-medium">{event.summary}</p>
									<div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-500">
										<span class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{formatShortDate(event.performedAt)}
										</span>
										<span class="flex items-center gap-1">
											<ActorIcon class="h-3 w-3" />
											{ACTOR_TYPE_LABELS[event.performedByType]}
										</span>
										{#if event.organizationName}
											<span class="flex items-center gap-1">
												<Building2 class="h-3 w-3" />
												{event.organizationName}
											</span>
										{/if}
										{#if event.entityId}
											<span class="font-mono">
												{event.entityId.slice(0, 8)}...
											</span>
										{/if}
									</div>
								</div>

								<!-- Expand indicator -->
								<ChevronRight class="h-5 w-5 flex-shrink-0 text-surface-400 transition-transform {selectedEvent?.id === event.id ? 'rotate-90' : ''}" />
							</div>

							<!-- Expanded Detail -->
							{#if selectedEvent?.id === event.id}
								<div class="mt-4 border-t border-surface-300-700 pt-4">
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<p class="text-xs font-medium text-surface-500">Event ID</p>
											<p class="font-mono text-sm">{event.id}</p>
										</div>
										<div>
											<p class="text-xs font-medium text-surface-500">Entity ID</p>
											<p class="font-mono text-sm">{event.entityId}</p>
										</div>
										<div>
											<p class="text-xs font-medium text-surface-500">Performed At</p>
											<p class="text-sm">{formatDate(event.performedAt)}</p>
										</div>
										{#if event.performedById}
											<div>
												<p class="text-xs font-medium text-surface-500">Performed By</p>
												<p class="font-mono text-sm">{event.performedById}</p>
											</div>
										{/if}
									</div>

									<!-- Context Links & Cross-Entity Navigation -->
									{#if event.caseId || event.propertyId || event.associationId || event.entityId}
										<div class="mt-4">
											<p class="text-xs font-medium text-surface-500 mb-2">Related Entities & Audit Trails</p>
											<div class="flex flex-wrap gap-2">
												<!-- Primary entity audit link -->
												<a
													href="/app/admin/activity?entityType={event.entityType}&entityId={event.entityId}"
													class="badge preset-filled-tertiary-500 text-xs hover:opacity-80"
													onclick={(e) => e.stopPropagation()}
													title="View all events for this {ENTITY_TYPE_LABELS[event.entityType]}"
												>
													<Activity class="mr-1 h-3 w-3" />
													{ENTITY_TYPE_LABELS[event.entityType]} History
												</a>

												{#if event.caseId}
													<a
														href="/app/admin/cases/{event.caseId}"
														class="badge preset-outlined-primary-500 text-xs hover:bg-primary-500/10"
														onclick={(e) => e.stopPropagation()}
													>
														Case: {event.caseId.slice(0, 8)}...
													</a>
													{#if event.caseId !== event.entityId}
														<a
															href="/app/admin/activity?entityType=CONCIERGE_CASE&entityId={event.caseId}"
															class="badge preset-tonal-primary text-xs hover:opacity-80"
															onclick={(e) => e.stopPropagation()}
															title="View case audit trail"
														>
															<Activity class="mr-1 h-3 w-3" />
															Case Audit
														</a>
													{/if}
												{/if}
												{#if event.propertyId}
													<span class="badge preset-outlined-surface-500 text-xs">
														Property: {event.propertyId.slice(0, 8)}...
													</span>
													<a
														href="/app/admin/activity?entityType=INDIVIDUAL_PROPERTY&entityId={event.propertyId}"
														class="badge preset-tonal-surface text-xs hover:opacity-80"
														onclick={(e) => e.stopPropagation()}
														title="View property audit trail"
													>
														<Activity class="mr-1 h-3 w-3" />
														Property Audit
													</a>
												{/if}
												{#if event.associationId}
													<span class="badge preset-outlined-surface-500 text-xs">
														Association: {event.associationId.slice(0, 8)}...
													</span>
													<a
														href="/app/admin/activity?entityType=ASSOCIATION&entityId={event.associationId}"
														class="badge preset-tonal-surface text-xs hover:opacity-80"
														onclick={(e) => e.stopPropagation()}
														title="View association audit trail"
													>
														<Activity class="mr-1 h-3 w-3" />
														Association Audit
													</a>
												{/if}
											</div>
										</div>

										<!-- Cross-Entity Correlation Links -->
										{#if event.metadata && typeof event.metadata === 'object'}
											{@const meta = event.metadata as Record<string, unknown>}
											{#if meta.originIntentId || meta.parentEventId || meta.relatedEventIds}
												<div class="mt-3">
													<p class="text-xs font-medium text-surface-500 mb-2">Event Correlation</p>
													<div class="flex flex-wrap gap-2">
														{#if meta.originIntentId && typeof meta.originIntentId === 'string'}
															<a
																href="/app/admin/activity?entityType=OWNER_INTENT&entityId={meta.originIntentId}"
																class="badge preset-outlined-warning-500 text-xs hover:bg-warning-500/10"
																onclick={(e) => e.stopPropagation()}
																title="View originating intent"
															>
																<ArrowRight class="mr-1 h-3 w-3 rotate-180" />
																Originating Intent
															</a>
														{/if}
														{#if meta.parentEventId && typeof meta.parentEventId === 'string'}
															<a
																href="/app/admin/activity?entityId={meta.parentEventId}"
																class="badge preset-outlined-surface-500 text-xs hover:bg-surface-500/10"
																onclick={(e) => e.stopPropagation()}
																title="View parent event"
															>
																<ArrowRight class="mr-1 h-3 w-3 rotate-180" />
																Parent Event
															</a>
														{/if}
														{#if Array.isArray(meta.relatedEventIds) && meta.relatedEventIds.length > 0}
															<span class="badge preset-tonal-surface text-xs">
																{meta.relatedEventIds.length} related event(s)
															</span>
														{/if}
													</div>
												</div>
											{/if}
										{/if}
									{/if}

									<!-- State Changes -->
									{#if event.previousState || event.newState}
										<div class="mt-4">
											<p class="text-xs font-medium text-surface-500 mb-2">State Changes</p>
											<div class="flex items-start gap-4">
												{#if event.previousState}
													<div class="flex-1 rounded bg-surface-100-900 p-2">
														<p class="text-xs text-surface-500 mb-1">Previous</p>
														<pre class="text-xs overflow-auto">{JSON.stringify(event.previousState, null, 2)}</pre>
													</div>
												{/if}
												{#if event.previousState && event.newState}
													<ArrowRight class="h-5 w-5 text-surface-400 mt-4 flex-shrink-0" />
												{/if}
												{#if event.newState}
													<div class="flex-1 rounded bg-surface-100-900 p-2">
														<p class="text-xs text-surface-500 mb-1">New</p>
														<pre class="text-xs overflow-auto">{JSON.stringify(event.newState, null, 2)}</pre>
													</div>
												{/if}
											</div>
										</div>
									{/if}

									<!-- Actor Context Section (Role at time of action) -->
									{#if event.metadata && typeof event.metadata === 'object'}
										{@const meta = event.metadata as Record<string, unknown>}
										{@const actorContext = meta.actorContext as { orgRole?: string | null; isStaff?: boolean; staffRoles?: string[]; pillarAccess?: string[] } | undefined}
										{#if actorContext}
											<div class="mt-4 rounded-lg border border-tertiary-300-700 bg-tertiary-50-950 p-3">
												<p class="text-xs font-medium text-tertiary-700 dark:text-tertiary-300 mb-2">Actor Role (at time of action)</p>
												<div class="flex flex-wrap gap-2 text-sm">
													{#if actorContext.orgRole}
														<span class="badge preset-filled-tertiary-500 text-xs">{actorContext.orgRole}</span>
													{/if}
													{#if actorContext.isStaff}
														<span class="badge preset-filled-warning-500 text-xs">Platform Staff</span>
													{/if}
													{#if actorContext.staffRoles?.length}
														{#each actorContext.staffRoles as staffRole}
															<span class="badge preset-outlined-warning-500 text-xs">{staffRole}</span>
														{/each}
													{/if}
													{#if actorContext.pillarAccess?.length}
														{#each actorContext.pillarAccess as pillar}
															<span class="badge preset-tonal-surface text-xs">{pillar}</span>
														{/each}
													{/if}
												</div>
											</div>
										{/if}

										<!-- Authority & Policy Section -->
										{@const authoritySource = meta.authoritySource as { type?: string; reference?: string; description?: string } | undefined}
										{#if authoritySource || meta.policyId || meta.resolutionId}
											<div class="mt-4 rounded-lg border border-warning-300-700 bg-warning-50-950 p-3">
												<p class="text-xs font-medium text-warning-700 dark:text-warning-300 mb-2">Authority & Policy</p>
												<div class="space-y-1 text-sm">
													{#if authoritySource}
														<div class="flex items-center gap-2">
															<span class="text-surface-500">Authority Source:</span>
															<span class="badge preset-outlined-warning-500 text-xs">{authoritySource.type}</span>
															{#if authoritySource.reference}
																<span class="text-surface-600 dark:text-surface-400">{authoritySource.reference}</span>
															{/if}
														</div>
														{#if authoritySource.description}
															<p class="text-surface-600 dark:text-surface-400 text-xs mt-1">{authoritySource.description}</p>
														{/if}
													{/if}
													{#if meta.policyId}
														<p><span class="text-surface-500">Policy:</span> {meta.policyId}</p>
													{/if}
													{#if meta.resolutionId}
														<p><span class="text-surface-500">Resolution:</span> {meta.resolutionId}</p>
													{/if}
												</div>
											</div>
										{/if}

										<!-- Evidence & Documents Section -->
										{#if meta.documents || meta.attachments || meta.evidenceUrls}
											<div class="mt-4 rounded-lg border border-primary-300-700 bg-primary-50-950 p-3">
												<p class="text-xs font-medium text-primary-700 dark:text-primary-300 mb-2">Evidence & Documents</p>
												<div class="space-y-1 text-sm">
													{#if Array.isArray(meta.documents)}
														{#each meta.documents as doc}
															<p class="text-surface-600 dark:text-surface-400">{typeof doc === 'string' ? doc : JSON.stringify(doc)}</p>
														{/each}
													{/if}
													{#if Array.isArray(meta.attachments)}
														{#each meta.attachments as att}
															<p class="text-surface-600 dark:text-surface-400">{typeof att === 'string' ? att : JSON.stringify(att)}</p>
														{/each}
													{/if}
												</div>
											</div>
										{/if}
									{/if}

									<!-- External Party Indicator -->
									{#if event.performedByType === 'SYSTEM' || (event.metadata && typeof event.metadata === 'object' && ((event.metadata as Record<string, unknown>).isExternalAction || (event.metadata as Record<string, unknown>).externalParty))}
										<div class="mt-4 flex items-center gap-2 rounded-lg border border-surface-300-700 bg-surface-100-900 p-2">
											<Building2 class="h-4 w-4 text-surface-500" />
											<span class="text-xs text-surface-600 dark:text-surface-400">
												{#if event.performedByType === 'SYSTEM'}
													Automated system action
												{:else}
													External party action
												{/if}
											</span>
										</div>
									{/if}
								</div>
							{/if}
						</button>
					{/each}
				</div>

				<!-- Load More -->
				{#if hasMore}
					<div class="mt-6 text-center">
						<button
							onclick={() => loadEvents(true)}
							class="btn preset-outlined-primary-500"
							disabled={isLoading}
						>
							{#if isLoading}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{/if}
							Load More
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</PageContainer>

<!-- Export Modal -->
{#if showExportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => showExportModal = false}>
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center gap-2 mb-4">
				<Download class="h-5 w-5 text-primary-500" />
				<h3 class="text-lg font-semibold">Export Audit Trail</h3>
			</div>

			<div class="space-y-4">
				<!-- Date Range -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="exportStartDate" class="block text-sm font-medium mb-1">Start Date</label>
						<input
							type="date"
							id="exportStartDate"
							bind:value={exportStartDate}
							class="input w-full"
						/>
					</div>
					<div>
						<label for="exportEndDate" class="block text-sm font-medium mb-1">End Date</label>
						<input
							type="date"
							id="exportEndDate"
							bind:value={exportEndDate}
							class="input w-full"
						/>
					</div>
				</div>

				<!-- Format Selection -->
				<div>
					<label class="block text-sm font-medium mb-2">Export Format</label>
					<div class="flex gap-4">
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								bind:group={exportFormat}
								value="json"
								class="radio"
							/>
							<span class="text-sm">JSON</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								bind:group={exportFormat}
								value="csv"
								class="radio"
							/>
							<span class="text-sm">CSV</span>
						</label>
					</div>
				</div>

				<!-- Options -->
				<div class="space-y-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={exportIncludeMetadata}
							class="checkbox"
						/>
						<span class="text-sm">Include metadata (actor context, authority source)</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={exportIncludeStateChanges}
							class="checkbox"
						/>
						<span class="text-sm">Include state changes (previous/new state)</span>
					</label>
				</div>

				<!-- Current Filters Note -->
				{#if entityTypeFilter || activeLens || pillarFilter}
					<div class="rounded-lg bg-surface-100-900 p-3 text-sm">
						<p class="font-medium mb-1">Current filters will be applied:</p>
						<div class="flex flex-wrap gap-1">
							{#if entityTypeFilter}
								<span class="badge preset-outlined-surface-500 text-xs">{ENTITY_TYPE_LABELS[entityTypeFilter]}</span>
							{/if}
							{#if activeLens}
								<span class="badge preset-filled-primary-500 text-xs">{FORENSIC_LENS_CONFIG[activeLens].label}</span>
							{/if}
							{#if pillarFilter}
								<span class="badge preset-tonal-surface text-xs">{PILLAR_LABELS[pillarFilter]}</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if exportError}
					<div class="rounded-lg bg-error-100 dark:bg-error-900 p-3 text-sm text-error-700 dark:text-error-300">
						{exportError}
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex justify-end gap-2 pt-4 border-t border-surface-300-700">
					<button
						onclick={() => showExportModal = false}
						class="btn preset-outlined-surface-500"
						disabled={isExporting}
					>
						Cancel
					</button>
					<button
						onclick={handleExport}
						class="btn preset-filled-primary-500"
						disabled={isExporting || !exportStartDate || !exportEndDate}
					>
						{#if isExporting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Exporting...
						{:else}
							<Download class="mr-2 h-4 w-4" />
							Export {exportFormat.toUpperCase()}
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
