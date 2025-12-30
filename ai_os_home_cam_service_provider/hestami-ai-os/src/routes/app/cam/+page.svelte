<script lang="ts">
	import { AlertTriangle, Wrench, RefreshCw } from 'lucide-svelte';
	import { Skeleton } from '$lib/components/ui';
	import { 
		RequiresActionCard, 
		RiskComplianceCard, 
		FinancialAttentionCard, 
		RecentGovernanceCard,
		ReportWidget, 
		UpcomingMeetingsWidget 
	} from '$lib/components/cam/dashboard';
	import { auth, currentAssociation } from '$lib/stores';
    import { invalidateAll } from '$app/navigation';
	import { dashboardApi, type DashboardData, type DashboardEventType } from '$lib/api/cam'; // kept for recordView only

	interface ReportSummary {
		id: string;
		name: string;
		lastRun?: string;
		category: string;
	}

	interface Meeting {
		id: string;
		title: string;
		type: string;
		date: string;
		time: string;
		location?: string;
	}

    let { data } = $props();

	let isLoading = $state(false); // No client loading
	let error = $state<string | null>(null);
    
    // Derived state from props
	let reports = $derived(data.reports as ReportSummary[]);
	let meetings = $derived(data.meetings as Meeting[]);
	let dashboardData = $derived(data.dashboardData as DashboardData | null);
	
    let hasRecordedView = $state(false);

	// Record audit event for dashboard interactions (fire-and-forget)
	function recordDashboardEvent(
		eventType: DashboardEventType,
		options?: { section?: string; card?: string; targetUrl?: string }
	) {
		dashboardApi.recordView({
			eventType,
			...options
		}).catch(err => {
			// Silently fail - audit logging should not block user experience
			console.debug('Failed to record dashboard event:', err);
		});
	}

    // Handlers
    async function handleRefresh() {
        isLoading = true;
        await invalidateAll();
        isLoading = false;
    }

	$effect(() => {
		if (dashboardData && !hasRecordedView) {
            recordDashboardEvent('DASHBOARD_VIEWED');
            hasRecordedView = true;
        }
	});
</script>

<svelte:head>
	<title>CAM Dashboard | Hestami AI</title>
</svelte:head>

<div class="p-6">
	<!-- Header -->
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">
				Welcome back, {$auth.user?.name?.split(' ')[0] || 'there'}!
			</h1>
			<p class="mt-1 text-surface-500">
				{$currentAssociation?.name || 'Community Dashboard'}
			</p>
		</div>
		<div class="flex gap-2">
			<button 
				onclick={handleRefresh} 
				class="btn preset-tonal-surface"
				disabled={isLoading}
			>
				<RefreshCw class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
				Refresh
			</button>
			<a href="/app/cam/violations/new" class="btn preset-tonal-surface">
				<AlertTriangle class="mr-2 h-4 w-4" />
				Report Violation
			</a>
			<a href="/app/cam/work-orders/new" class="btn preset-filled-primary-500">
				<Wrench class="mr-2 h-4 w-4" />
				Create Work Order
			</a>
		</div>
	</div>

	<!-- Error State -->
	{#if error}
		<div class="mb-6 rounded-lg bg-error-500/10 p-4 text-error-500">
			<p>{error}</p>
			<button onclick={handleRefresh} class="mt-2 text-sm underline">
				Try again
			</button>
		</div>
	{/if}

	<!-- Loading State -->
	{#if isLoading}
		<div class="grid gap-6 lg:grid-cols-2">
			<div class="space-y-4">
				<Skeleton class="h-64 w-full rounded-lg" />
				<Skeleton class="h-64 w-full rounded-lg" />
			</div>
			<div class="space-y-4">
				<Skeleton class="h-64 w-full rounded-lg" />
				<Skeleton class="h-64 w-full rounded-lg" />
			</div>
		</div>
	{:else if dashboardData}
		<!-- Section 1: Requires Action + Section 2: Risk & Compliance -->
		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<RequiresActionCard data={dashboardData.requiresAction} />
			<RiskComplianceCard data={dashboardData.riskCompliance} />
		</div>

		<!-- Section 3: Financial Attention + Section 4: Recent Governance -->
		<div class="mb-6 grid gap-6 lg:grid-cols-2">
			<FinancialAttentionCard data={dashboardData.financialAttention} />
			<RecentGovernanceCard data={dashboardData.recentGovernance} />
		</div>

		<!-- Additional Widgets: Reports & Meetings -->
		<div class="grid gap-6 lg:grid-cols-2">
			<ReportWidget {reports} loading={isLoading} />
			<UpcomingMeetingsWidget {meetings} loading={isLoading} />
		</div>

		<!-- Last Updated -->
		{#if dashboardData.lastUpdated}
			<p class="mt-4 text-center text-xs text-surface-500">
				Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
			</p>
		{/if}
	{/if}
</div>
