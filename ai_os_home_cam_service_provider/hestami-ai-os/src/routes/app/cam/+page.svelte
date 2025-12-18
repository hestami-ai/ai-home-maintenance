<script lang="ts">
	import { AlertTriangle, Wrench, Building2, Home, Users } from 'lucide-svelte';
	import { Card, Skeleton } from '$lib/components/ui';
	import { RequiresActionCard, RiskComplianceCard, FinancialAttentionCard, ReportWidget, UpcomingMeetingsWidget } from '$lib/components/cam/dashboard';
	import { auth, currentAssociation } from '$lib/stores';

	interface DashboardData {
		stats: {
			totalUnits: number;
			totalOwners: number;
			openViolations: number;
			pendingArc: number;
		};
		requiresAction: {
			pendingArc: number;
			escalatedViolations: number;
			overdueWorkOrders: number;
		};
		riskCompliance: {
			violationsBySeverity: {
				critical: number;
				major: number;
				moderate: number;
				minor: number;
			};
			repeatOffenders: Array<{
				id: string;
				name: string;
				unitNumber: string;
				violationCount: number;
			}>;
		};
		financialAttention: {
			overdueAssessmentsCount: number;
			overdueAssessmentsAmount: number;
			budgetExceptionsCount: number;
		};
	}

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

	let isLoading = $state(true);
	let reports = $state<ReportSummary[]>([]);
	let meetings = $state<Meeting[]>([]);
	let dashboardData = $state<DashboardData>({
		stats: { totalUnits: 0, totalOwners: 0, openViolations: 0, pendingArc: 0 },
		requiresAction: { pendingArc: 0, escalatedViolations: 0, overdueWorkOrders: 0 },
		riskCompliance: {
			violationsBySeverity: { critical: 0, major: 0, moderate: 0, minor: 0 },
			repeatOffenders: []
		},
		financialAttention: { overdueAssessmentsCount: 0, overdueAssessmentsAmount: 0, budgetExceptionsCount: 0 }
	});

	async function loadDashboardData(associationId: string) {
		isLoading = true;
		try {
			const [violationsRes, arcRes, workOrdersRes] = await Promise.all([
				fetch(`/api/violation?associationId=${associationId}`).catch(() => null),
				fetch(`/api/arc/request?associationId=${associationId}&status=SUBMITTED`).catch(() => null),
				fetch(`/api/work-order?associationId=${associationId}`).catch(() => null)
			]);

			let stats = { totalUnits: 0, totalOwners: 0, openViolations: 0, pendingArc: 0 };
			let violationsBySeverity = { critical: 0, major: 0, moderate: 0, minor: 0 };
			let escalatedViolations = 0;
			let pendingArc = 0;
			let overdueWorkOrders = 0;

			if (violationsRes?.ok) {
				const data = await violationsRes.json();
				if (data.ok && data.data?.items) {
					const violations = data.data.items;
					violations.forEach((v: { severity: string; status: string }) => {
						if (v.severity === 'CRITICAL') violationsBySeverity.critical++;
						else if (v.severity === 'MAJOR') violationsBySeverity.major++;
						else if (v.severity === 'MODERATE') violationsBySeverity.moderate++;
						else if (v.severity === 'MINOR') violationsBySeverity.minor++;
						if (v.status === 'ESCALATED') escalatedViolations++;
					});
					stats.openViolations = violations.filter((v: { status: string }) =>
						['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'].includes(v.status)
					).length;
				}
			}

			if (arcRes?.ok) {
				const data = await arcRes.json();
				if (data.ok && data.data) {
					pendingArc = data.data.total || data.data.items?.length || 0;
					stats.pendingArc = pendingArc;
				}
			}

			if (workOrdersRes?.ok) {
				const data = await workOrdersRes.json();
				if (data.ok && data.data?.items) {
					const now = new Date();
					overdueWorkOrders = data.data.items.filter((wo: { dueDate?: string; status: string }) => {
						if (!wo.dueDate) return false;
						return new Date(wo.dueDate) < now && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status);
					}).length;
				}
			}

			dashboardData = {
				stats,
				requiresAction: { pendingArc, escalatedViolations, overdueWorkOrders },
				riskCompliance: { violationsBySeverity, repeatOffenders: [] },
				financialAttention: { overdueAssessmentsCount: 0, overdueAssessmentsAmount: 0, budgetExceptionsCount: 0 }
			};

			// Load reports
			const reportsRes = await fetch(`/api/report/definition?associationId=${associationId}`).catch(() => null);
			if (reportsRes?.ok) {
				const data = await reportsRes.json();
				if (data.ok && data.data?.items) {
					reports = data.data.items.slice(0, 5);
				}
			}

			// Load upcoming meetings
			const meetingsRes = await fetch(`/api/governance/meeting?associationId=${associationId}&status=SCHEDULED`).catch(() => null);
			if (meetingsRes?.ok) {
				const data = await meetingsRes.json();
				if (data.ok && data.data?.items) {
					meetings = data.data.items.slice(0, 4);
				}
			}
		} catch (error) {
			console.error('Failed to load dashboard data:', error);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadDashboardData($currentAssociation.id);
		}
	});
</script>

<svelte:head>
	<title>CAM Dashboard | Hestami AI</title>
</svelte:head>

<div class="p-6">
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

	<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card variant="outlined" padding="md">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
					<Home class="h-5 w-5 text-primary-500" />
				</div>
				<div>
					{#if isLoading}
						<Skeleton class="h-8 w-12" />
					{:else}
						<p class="text-2xl font-bold">{dashboardData.stats.totalUnits}</p>
					{/if}
					<p class="text-sm text-surface-500">Total Units</p>
				</div>
			</div>
		</Card>
		<Card variant="outlined" padding="md">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
					<Users class="h-5 w-5 text-secondary-500" />
				</div>
				<div>
					{#if isLoading}
						<Skeleton class="h-8 w-12" />
					{:else}
						<p class="text-2xl font-bold">{dashboardData.stats.totalOwners}</p>
					{/if}
					<p class="text-sm text-surface-500">Owners</p>
				</div>
			</div>
		</Card>
		<Card variant="outlined" padding="md">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10">
					<AlertTriangle class="h-5 w-5 text-error-500" />
				</div>
				<div>
					{#if isLoading}
						<Skeleton class="h-8 w-12" />
					{:else}
						<p class="text-2xl font-bold">{dashboardData.stats.openViolations}</p>
					{/if}
					<p class="text-sm text-surface-500">Open Violations</p>
				</div>
			</div>
		</Card>
		<Card variant="outlined" padding="md">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
					<Building2 class="h-5 w-5 text-warning-500" />
				</div>
				<div>
					{#if isLoading}
						<Skeleton class="h-8 w-12" />
					{:else}
						<p class="text-2xl font-bold">{dashboardData.stats.pendingArc}</p>
					{/if}
					<p class="text-sm text-surface-500">Pending ARC</p>
				</div>
			</div>
		</Card>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="lg:col-span-1">
			<RequiresActionCard
				pendingArc={dashboardData.requiresAction.pendingArc}
				escalatedViolations={dashboardData.requiresAction.escalatedViolations}
				overdueWorkOrders={dashboardData.requiresAction.overdueWorkOrders}
			/>
		</div>

		<div class="lg:col-span-1">
			<RiskComplianceCard
				violationsBySeverity={dashboardData.riskCompliance.violationsBySeverity}
				repeatOffenders={dashboardData.riskCompliance.repeatOffenders}
			/>
		</div>

		<div class="lg:col-span-1">
			<FinancialAttentionCard
				overdueAssessmentsCount={dashboardData.financialAttention.overdueAssessmentsCount}
				overdueAssessmentsAmount={dashboardData.financialAttention.overdueAssessmentsAmount}
				budgetExceptionsCount={dashboardData.financialAttention.budgetExceptionsCount}
			/>
		</div>
	</div>

	<div class="mt-6 grid gap-6 lg:grid-cols-2">
		<ReportWidget {reports} loading={isLoading} />
		<UpcomingMeetingsWidget {meetings} loading={isLoading} />
	</div>
</div>
