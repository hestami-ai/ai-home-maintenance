<script lang="ts">
	import { Home, Plus, Briefcase, Bell, Clock } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { auth, organizationStore } from '$lib/stores';
	import { conciergeCaseApi, type ConciergeCase } from '$lib/api/cam';

	let cases = $state<ConciergeCase[]>([]);
	let isLoading = $state(true);
	let activeCaseCount = $state(0);
	let pendingClarificationCount = $state(0);

	async function loadDashboardData() {
		isLoading = true;
		try {
			const response = await conciergeCaseApi.list({ pageSize: 5 });
			if (response.ok && response.data?.items) {
				cases = response.data.items;
				activeCaseCount = response.data.items.filter(
					(c) => !['CLOSED', 'CANCELLED', 'RESOLVED'].includes(c.status)
				).length;
				pendingClarificationCount = response.data.items.filter(
					(c) => c.status === 'PENDING_OWNER'
				).length;
			}
		} catch (error) {
			console.error('Failed to load dashboard data:', error);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadDashboardData();
	});

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			INTAKE: 'New',
			ASSESSMENT: 'Under Review',
			IN_PROGRESS: 'In Progress',
			PENDING_EXTERNAL: 'Waiting on External',
			PENDING_OWNER: 'Needs Your Response',
			ON_HOLD: 'On Hold',
			RESOLVED: 'Resolved',
			CLOSED: 'Closed',
			CANCELLED: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			INTAKE: 'bg-blue-500/10 text-blue-500',
			ASSESSMENT: 'bg-purple-500/10 text-purple-500',
			IN_PROGRESS: 'bg-amber-500/10 text-amber-500',
			PENDING_EXTERNAL: 'bg-orange-500/10 text-orange-500',
			PENDING_OWNER: 'bg-red-500/10 text-red-500',
			ON_HOLD: 'bg-gray-500/10 text-gray-500',
			RESOLVED: 'bg-green-500/10 text-green-500',
			CLOSED: 'bg-surface-500/10 text-surface-500',
			CANCELLED: 'bg-surface-500/10 text-surface-500'
		};
		return colors[status] || 'bg-surface-500/10 text-surface-500';
	}
</script>

<svelte:head>
	<title>Owner Dashboard | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Welcome Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">
					Welcome back, {$auth.user?.name?.split(' ')[0] || 'there'}!
				</h1>
				<p class="mt-1 text-surface-500">
					{$organizationStore.current?.organization.name || 'Your Property Dashboard'}
				</p>
			</div>
			<a href="/app/owner/cases/new" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				New Request
			</a>
		</div>

		<!-- Quick Stats -->
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Briefcase class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{activeCaseCount}</p>
						<p class="text-sm text-surface-500">Active Cases</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Bell class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{pendingClarificationCount}</p>
						<p class="text-sm text-surface-500">Need Response</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<Home class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Properties</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						<Clock class="h-5 w-5 text-secondary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{cases.length}</p>
						<p class="text-sm text-surface-500">Total Cases</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Main Content -->
		<div class="mt-8 grid gap-8 lg:grid-cols-3">
			<!-- Recent Cases -->
			<div class="lg:col-span-2">
				<Card variant="outlined" padding="none">
					<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Recent Cases</h2>
						<a href="/app/owner/cases" class="text-sm text-primary-500 hover:underline">
							View All
						</a>
					</div>
					<div class="divide-y divide-surface-300-700">
						{#if isLoading}
							<div class="p-6 text-center text-surface-500">Loading...</div>
						{:else if cases.length === 0}
							<div class="p-6">
								<EmptyState
									title="No cases yet"
									description="Create a new request to get started with your property management needs."
								/>
							</div>
						{:else}
							{#each cases.slice(0, 5) as caseItem}
								<a
									href="/app/owner/cases/{caseItem.id}"
									class="block px-6 py-4 transition-colors hover:bg-surface-100-900"
								>
									<div class="flex items-start justify-between gap-4">
										<div class="min-w-0 flex-1">
											<p class="truncate font-medium">{caseItem.title}</p>
											<p class="mt-1 truncate text-sm text-surface-500">
												{caseItem.caseNumber}
											</p>
										</div>
										<span
											class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusColor(
												caseItem.status
											)}"
										>
											{getStatusLabel(caseItem.status)}
										</span>
									</div>
								</a>
							{/each}
						{/if}
					</div>
				</Card>
			</div>

			<!-- Quick Actions -->
			<div>
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Quick Actions</h2>
					</div>
					<div class="p-4">
						<div class="space-y-2">
							<a
								href="/app/owner/cases/new"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-200-800"
							>
								<Plus class="h-5 w-5 text-surface-500" />
								<span class="text-sm font-medium">Create New Request</span>
							</a>
							<a
								href="/app/owner/cases?status=PENDING_OWNER"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-200-800"
							>
								<Bell class="h-5 w-5 text-surface-500" />
								<span class="text-sm font-medium">View Pending Responses</span>
							</a>
							<a
								href="/app/owner/cases"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-200-800"
							>
								<Briefcase class="h-5 w-5 text-surface-500" />
								<span class="text-sm font-medium">View All Cases</span>
							</a>
						</div>
					</div>
				</Card>
			</div>
		</div>
	</div>
</PageContainer>
