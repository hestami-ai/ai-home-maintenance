<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { 
		Activity, 
		AlertCircle, 
		CheckCircle2, 
		Clock, 
		FileText, 
		RefreshCw, 
		Search, 
		Settings, 
		ShieldAlert, 
		Trash2, 
		Upload,
		MoreVertical,
		ExternalLink,
		ChevronRight,
		Filter
	} from 'lucide-svelte';
	import { 
		PageContainer, 
		Card, 
		Alert, 
		LoadingSpinner,
		EmptyState
	} from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import TabbedContent from '$lib/components/cam/TabbedContent.svelte';
	import ListPanel from '$lib/components/cam/ListPanel.svelte';
	import DocumentStatusBadge from '$lib/components/cam/documents/DocumentStatusBadge.svelte';
	import DPQSettingsModal from './DPQSettingsModal.svelte';
	import { formatDistanceToNow, format } from 'date-fns';

	let { data } = $props();

	// State for metrics and settings
	let stats = $state(untrack(() => data.stats) || []);
	let settings = $state(untrack(() => data.settings) || {});
	let showSettings = $state(false);
	let isLoading = $state(false);
	let lastUpdated = $state(new Date());

	// State for queue items
	let queueItems = $state(untrack(() => data.initialQueue) || []);
	let activeTab = $state('processing');
	let pagination = $state(untrack(() => data.pagination) || { nextCursor: null, hasMore: false });
	let selectedIds = $state(new Set<string>());

	// Sync local state if props change (e.g. on navigation)
	$effect(() => {
		stats = data.stats || [];
		settings = data.settings || {};
		queueItems = data.initialQueue || [];
		pagination = data.pagination || { nextCursor: null, hasMore: false };
	});

	// Polling for updates
	let pollInterval: any;

	onMount(() => {
		// Refresh metrics every 30 seconds as per requirements
		pollInterval = setInterval(refreshData, 30000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	async function refreshData() {
		try {
			const [statsRes, queueRes] = await Promise.all([
				orpc.documentProcessing.getQueueStats(),
				orpc.documentProcessing.listQueue({ 
					view: activeTab as any,
					limit: 50 
				})
			]);
			
			if (statsRes.ok) stats = statsRes.data;
			if (queueRes.ok) {
				queueItems = queueRes.data.documents;
				pagination = queueRes.data.pagination;
			}
			lastUpdated = new Date();
		} catch (error) {
			console.error('Failed to refresh DPQ data:', error);
		}
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
		selectedIds = new Set();
		refreshData();
	}

	// Helper to get specific metric value
	function getMetric(name: string): number {
		const m = stats.find((s: any) => s.metric_name === name);
		return m ? m.metric_value : 0;
	}

	// Actions
	async function retryDocument(id: string) {
		try {
			const res = await orpc.documentProcessing.retryDocument({ documentId: id });
			if (res.ok) {
				// Success toast would go here
				refreshData();
			}
		} catch (error) {
			console.error('Retry failed:', error);
		}
	}

	// Derived metrics for UI
	const processingCount = $derived(getMetric('currently_processing'));
	const awaitingRetryCount = $derived(getMetric('failed_awaiting_retry'));
	const needsAttentionCount = $derived(getMetric('failed_needs_attention'));
	const infectedCount = $derived(getMetric('infected_quarantined'));
	const processedToday = $derived(getMetric('processed_today'));

	// Mocking success rate as it might not be in the raw stats yet
	const successRate = $derived(getMetric('success_rate_24h') || 0);

	// Tabs definition
	const tabs = $derived([
		{ id: 'processing', label: 'Processing', content: ProcessingTab, badge: processingCount },
		{ id: 'auto-retry', label: 'Auto-Retry', content: AutoRetryTab, badge: awaitingRetryCount },
		{ id: 'needs-attention', label: 'Needs Attention', content: NeedsAttentionTab, badge: needsAttentionCount },
		{ id: 'infected', label: 'Infected', content: InfectedTab, badge: infectedCount },
		{ id: 'history', label: 'History', content: HistoryTab }
	]);
</script>

{#snippet MetricCard(title: string, value: string | number, icon: any, color: string, description?: string)}
	<div class="rounded-xl border border-surface-300-700 bg-surface-50-950 p-5 shadow-sm">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-surface-500">{title}</p>
				<p class="mt-1 text-2xl font-bold {color}">{value}</p>
			</div>
			<div class="rounded-lg bg-surface-100-900 p-2 text-surface-500">
				{@render icon()}
			</div>
		</div>
		{#if description}
			<p class="mt-3 text-xs text-surface-400">{description}</p>
		{/if}
	</div>
{/snippet}

{#snippet ProcessingTab()}
	<ListPanel 
		items={QueueTable}
		loading={isLoading}
		emptyTitle="No documents processing"
		emptyDescription="There are currently no documents being processed by the worker."
	/>
{/snippet}

{#snippet AutoRetryTab()}
	<ListPanel 
		items={QueueTable}
		loading={isLoading}
		emptyTitle="No documents awaiting retry"
		emptyDescription="Systems are healthy. No documents are currently in the auto-retry queue."
	/>
{/snippet}

{#snippet NeedsAttentionTab()}
	<ListPanel 
		items={QueueTable}
		loading={isLoading}
		bulkSelection={true}
		totalCount={queueItems.length}
		selectedCount={selectedIds.size}
		onSelectAll={() => selectedIds = new Set(queueItems.map((i: any) => i.id))}
		onDeselectAll={() => selectedIds = new Set()}
		emptyTitle="No issues detected"
		emptyDescription="Great job! No documents currently require manual intervention."
	/>
{/snippet}

{#snippet InfectedTab()}
	<ListPanel 
		items={QueueTable}
		loading={isLoading}
		emptyTitle="No security threats"
		emptyDescription="No infected files have been detected in the last 30 days."
	/>
{/snippet}

{#snippet HistoryTab()}
	<ListPanel 
		items={QueueTable}
		loading={isLoading}
		emptyTitle="No history yet"
		emptyDescription="Processing history will appear here once documents are completed."
	/>
{/snippet}

{#snippet QueueTable()}
	<div class="min-w-full overflow-x-auto">
		<table class="min-w-full divide-y divide-surface-200-800">
			<thead>
				<tr class="bg-surface-50-950/50">
					{#if activeTab === 'needs-attention'}
						<th class="px-6 py-3 text-left">
							<div class="h-4 w-4"></div>
						</th>
					{/if}
					<th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Document</th>
					<th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Organization</th>
					<th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Info</th>
					<th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Status</th>
					<th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-200-800 bg-surface-50-950">
				{#each queueItems as item}
					<tr class="transition-colors hover:bg-surface-100-900/50">
						{#if activeTab === 'needs-attention'}
							<td class="px-6 py-4">
								<input 
									type="checkbox" 
									checked={selectedIds.has(item.id)}
									onchange={(e) => {
										if (e.currentTarget.checked) selectedIds.add(item.id);
										else selectedIds.delete(item.id);
									}}
									class="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
								/>
							</td>
						{/if}
						<td class="px-6 py-4">
							<div class="flex flex-col">
								<span class="font-medium text-surface-900 dark:text-surface-100">{item.file_name || 'Untitled'}</span>
								<span class="text-xs text-surface-500">ID: {item.id.slice(0, 8)}...</span>
							</div>
						</td>
						<td class="px-6 py-4">
							<span class="text-sm text-surface-600 dark:text-surface-400">{item.organization_name || 'Unknown Org'}</span>
						</td>
						<td class="px-6 py-4">
							<div class="flex flex-col text-xs text-surface-500">
								{#if activeTab === 'processing'}
									<span>Started: {item.processing_started_at ? formatDistanceToNow(new Date(item.processing_started_at), { addSuffix: true }) : 'N/A'}</span>
								{:else if activeTab === 'auto-retry'}
									<span class="text-amber-500">Attempt {item.processing_attempt_count}/3</span>
									<span>Next: {item.processing_next_retry_at ? formatDistanceToNow(new Date(item.processing_next_retry_at), { addSuffix: true }) : 'Pending'}</span>
								{:else if activeTab === 'needs-attention'}
									<span class="font-medium text-red-500">{item.processing_error_type}</span>
									<span class="truncate max-w-[200px]">{item.processing_error_message}</span>
								{:else if activeTab === 'infected'}
									<span class="font-medium text-red-500">Threat: {item.malware_scan_status || 'Detected'}</span>
									<span>Detected: {item.created_at ? format(new Date(item.created_at), 'MMM d, HH:mm') : 'N/A'}</span>
								{:else}
									<span>Completed: {item.processing_completed_at ? format(new Date(item.processing_completed_at), 'MMM d, HH:mm') : 'N/A'}</span>
								{/if}
							</div>
						</td>
						<td class="px-6 py-4">
							<DocumentStatusBadge 
								status={item.status} 
								processingAttemptCount={item.processing_attempt_count}
								processingErrorType={item.processing_error_type}
								size="sm"
							/>
						</td>
						<td class="px-6 py-4 text-right">
							<div class="flex items-center justify-end gap-2">
								{#if activeTab === 'needs-attention' || activeTab === 'auto-retry'}
									<button 
										type="button"
										onclick={() => retryDocument(item.id)}
										class="rounded p-1 text-surface-400 hover:bg-surface-200-800 hover:text-primary-500"
										title="Retry Now"
									>
										<RefreshCw class="h-4 w-4" />
									</button>
								{/if}
								<button 
									type="button"
									class="rounded p-1 text-surface-400 hover:bg-surface-200-800 hover:text-surface-600"
									title="View Details"
								>
									<ExternalLink class="h-4 w-4" />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<PageContainer>
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100">Document Processing Queue</h1>
			<p class="text-sm text-surface-500">Monitor and manage the document ingestion pipeline</p>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-xs text-surface-400">
				Last updated: {format(lastUpdated, 'HH:mm:ss')}
			</span>
			<button 
				type="button"
				onclick={refreshData}
				class="flex items-center gap-2 rounded-lg bg-surface-100-900 px-3 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
			>
				<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
				Refresh
			</button>
			<button 
				type="button"
				onclick={() => showSettings = true}
				class="flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 shadow-sm"
			>
				<Settings class="h-4 w-4" />
				Settings
			</button>
		</div>
	</div>

	<!-- Dashboard Metrics -->
	<div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
		{@render MetricCard('Processing', processingCount, () => Activity, 'text-blue-500', 'Active worker jobs')}
		{@render MetricCard('Auto-Retry', awaitingRetryCount, () => Clock, 'text-amber-500', 'Scheduled for retry')}
		{@render MetricCard('Attention', needsAttentionCount, () => AlertCircle, 'text-red-500', 'Needs intervention')}
		{@render MetricCard('Infected', infectedCount, () => ShieldAlert, 'text-red-600', 'Quarantined files')}
		{@render MetricCard('Processed', processedToday, () => CheckCircle2, 'text-green-500', 'Successfully today')}
		{@render MetricCard('Success Rate', `${successRate}%`, () => Activity, 'text-primary-500', 'Last 24 hours')}
	</div>

	{#if needsAttentionCount > 0}
		<div class="mb-8">
			<Alert variant="warning" title="{needsAttentionCount} documents require manual intervention">
				<div class="flex items-center justify-between">
					<span>Most common error: TRANSIENT_EXHAUSTED</span>
					<div class="flex gap-4">
						<button 
							type="button" 
							onclick={() => handleTabChange('needs-attention')}
							class="text-sm font-bold underline"
						>
							View Details
						</button>
						<button 
							type="button" 
							class="text-sm font-bold underline"
						>
							Bulk Retry All
						</button>
					</div>
				</div>
			</Alert>
		</div>
	{/if}

	<!-- Queue Management -->
	<div class="rounded-xl border border-surface-300-700 bg-surface-50-950 shadow-sm overflow-hidden min-h-[500px]">
		<TabbedContent 
			tabs={tabs} 
			activeTab={activeTab} 
			onTabChange={handleTabChange}
		/>
	</div>
</PageContainer>

<DPQSettingsModal 
	open={showSettings} 
	settings={settings} 
	onClose={() => showSettings = false} 
	onSave={(newSettings) => {
		settings = newSettings;
		refreshData();
	}}
/>

<style>
	/* Custom styles for the table to ensure it looks premium */
	table {
		border-collapse: separate;
		border-spacing: 0;
	}
	
	th {
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: rgb(var(--color-surface-50));
	}
	
	:global(.dark) th {
		background-color: rgb(var(--color-surface-950));
	}
</style>
