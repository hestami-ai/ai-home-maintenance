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
		Building2
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		activityEventApi,
		ENTITY_TYPE_LABELS,
		ACTION_TYPE_LABELS,
		ACTOR_TYPE_LABELS,
		EVENT_CATEGORY_LABELS,
		EVENT_CATEGORY_COLORS,
		getActionColor,
		type ActivityEvent,
		type ActivityEntityType,
		type ActivityActionType,
		type ActivityEventCategory,
		type ActivityActorType
	} from '$lib/api/activityEvent';

	// Extended event type with organization name for staff view
	interface StaffActivityEvent extends ActivityEvent {
		organizationName?: string | null;
	}

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
	let hasMore = $derived(data.pagination.hasMore);
	let nextCursor = $derived(data.pagination.nextCursor);

	// Filters (initialized with defaults, synced via $effect below)
	let entityTypeFilter = $state<ActivityEntityType | ''>('');
	let actionFilter = $state<ActivityActionType | ''>('');
	let categoryFilter = $state<ActivityEventCategory | ''>('');
	let actorTypeFilter = $state<ActivityActorType | ''>('');
	let startDate = $state('');
	let endDate = $state('');

	// Synchronize server data to local state
	$effect(() => {
		if (data.events) {
			events = [...data.events];
		}
		entityTypeFilter = data.filters.entityType;
		actionFilter = data.filters.action;
		categoryFilter = data.filters.eventCategory;
		actorTypeFilter = data.filters.actorType;
		startDate = data.filters.startDate;
		endDate = data.filters.endDate;
	});

	// Selected event for detail view
	let selectedEvent = $state<StaffActivityEvent | null>(null);

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
				events = [...events, ...response.data.events];
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
			case 'HUMAN':
				return User;
			case 'AI':
				return Bot;
			case 'SYSTEM':
				return Server;
			default:
				return User;
		}
	}

	function getCategoryBadgeClass(category: ActivityEventCategory): string {
		const colorMap: Record<ActivityEventCategory, string> = {
			INTENT: 'preset-outlined-primary-500',
			DECISION: 'preset-outlined-warning-500',
			EXECUTION: 'preset-outlined-success-500',
			SYSTEM: 'preset-outlined-surface-500'
		};
		return colorMap[category] || 'preset-outlined-surface-500';
	}

	function getActionBadgeClass(action: ActivityActionType): string {
		const color = getActionColor(action);
		return `preset-filled-${color}-500`;
	}

	const entityTypes: ActivityEntityType[] = [
		'CONCIERGE_CASE', 'WORK_ORDER', 'VIOLATION', 'ARC_REQUEST',
		'USER', 'ORGANIZATION', 'INDIVIDUAL_PROPERTY', 'ASSOCIATION'
	];

	const actionTypes: ActivityActionType[] = [
		'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'UNASSIGN',
		'APPROVE', 'DENY', 'COMPLETE', 'CLOSE', 'CANCEL', 'ESCALATE'
	];

	const categories: ActivityEventCategory[] = ['INTENT', 'DECISION', 'EXECUTION', 'SYSTEM'];
	const actorTypes: ActivityActorType[] = ['HUMAN', 'AI', 'SYSTEM'];
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
			<button onclick={() => loadEvents()} class="btn preset-outlined-primary-500" disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Refresh
			</button>
		</div>

		<!-- Filters -->
		{#if !urlEntityId}
			<div class="mt-6 rounded-lg border border-surface-300-700 bg-surface-50-950 p-4">
				<div class="flex items-center gap-2 mb-4">
					<Filter class="h-4 w-4 text-surface-400" />
					<span class="text-sm font-medium">Filters</span>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<label for="entityType" class="block text-xs font-medium text-surface-500 mb-1">Entity Type</label>
						<select id="entityType" bind:value={entityTypeFilter} class="select w-full">
							<option value="">All Types</option>
							{#each entityTypes as type}
								<option value={type}>{ENTITY_TYPE_LABELS[type]}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="action" class="block text-xs font-medium text-surface-500 mb-1">Action</label>
						<select id="action" bind:value={actionFilter} class="select w-full">
							<option value="">All Actions</option>
							{#each actionTypes as action}
								<option value={action}>{ACTION_TYPE_LABELS[action]}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="category" class="block text-xs font-medium text-surface-500 mb-1">Category</label>
						<select id="category" bind:value={categoryFilter} class="select w-full">
							<option value="">All Categories</option>
							{#each categories as cat}
								<option value={cat}>{EVENT_CATEGORY_LABELS[cat]}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="actorType" class="block text-xs font-medium text-surface-500 mb-1">Actor Type</label>
						<select id="actorType" bind:value={actorTypeFilter} class="select w-full">
							<option value="">All Actors</option>
							{#each actorTypes as actor}
								<option value={actor}>{ACTOR_TYPE_LABELS[actor]}</option>
							{/each}
						</select>
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
							startDate = '';
							endDate = '';
							loadEvents();
						}}
						class="btn preset-outlined-surface-500"
					>
						Clear
					</button>
				</div>
			</div>
		{/if}

		<!-- Events List -->
		<div class="mt-6">
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
			{:else if events.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No activity events found"
						description="No events match your current filters. Try adjusting your search criteria."
					/>
				</Card>
			{:else}
				<div class="space-y-2">
					{#each events as event}
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

									<!-- Context Links -->
									{#if event.caseId || event.propertyId || event.associationId}
										<div class="mt-4">
											<p class="text-xs font-medium text-surface-500 mb-2">Related Entities</p>
											<div class="flex flex-wrap gap-2">
												{#if event.caseId}
													<a
														href="/app/admin/cases/{event.caseId}"
														class="badge preset-outlined-primary-500 text-xs hover:bg-primary-500/10"
														onclick={(e) => e.stopPropagation()}
													>
														Case: {event.caseId.slice(0, 8)}...
													</a>
												{/if}
												{#if event.propertyId}
													<span class="badge preset-outlined-surface-500 text-xs">
														Property: {event.propertyId.slice(0, 8)}...
													</span>
												{/if}
												{#if event.associationId}
													<span class="badge preset-outlined-surface-500 text-xs">
														Association: {event.associationId.slice(0, 8)}...
													</span>
												{/if}
											</div>
										</div>
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
