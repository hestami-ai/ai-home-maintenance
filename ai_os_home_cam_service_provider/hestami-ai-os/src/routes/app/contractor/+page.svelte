<script lang="ts">
	import { Wrench, Users, Calendar, DollarSign, ClipboardList, TrendingUp, AlertCircle, Settings } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import type { operations } from '$lib/api/types.generated';

	// Extract types from OpenAPI spec (avoids importing massive Prisma types)
	type Organization = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];

	const quickActions = [
		{ label: 'View All Jobs', icon: Wrench, href: '/app/contractor/jobs' },
		{ label: 'Create Job', icon: ClipboardList, href: '/app/contractor/jobs/new' },
		{ label: 'Dispatch Board', icon: Calendar, href: '/app/contractor/dispatch' },
		{ label: 'Manage Technicians', icon: Users, href: '/app/contractor/technicians' },
		{ label: 'Invoices', icon: DollarSign, href: '/app/contractor/invoices' },
		{ label: 'Team Management', icon: Settings, href: '/app/contractor/admin/team' }
	];

	// Check if compliance is complete (placeholder)
	const complianceComplete = false;

	interface Props {
		data: {
			user: { id: string; email: string; name: string | null; image: string | null } | null;
			organization: Organization | null;
		};
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Contractor Dashboard | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Compliance Banner -->
		{#if !complianceComplete}
			<div class="mb-6 rounded-lg border border-warning-500/50 bg-warning-500/10 p-4">
				<div class="flex items-start gap-3">
					<AlertCircle class="h-5 w-5 flex-shrink-0 text-warning-500" />
					<div class="flex-1">
						<p class="font-medium text-warning-700 dark:text-warning-300">Complete Your Profile</p>
						<p class="mt-1 text-sm text-warning-600 dark:text-warning-400">
							Add your licenses and insurance to start accepting jobs.
						</p>
					</div>
					<a href="/app/contractor/settings/compliance" class="btn btn-sm preset-filled-warning-500">
						Complete Setup
					</a>
				</div>
			</div>
		{/if}

		<!-- Welcome Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">
					Welcome back, {data?.user?.name?.split(' ')[0] || 'there'}!
				</h1>
				<p class="mt-1 text-surface-500">
					{data?.organization?.name || 'Contractor Dashboard'}
				</p>
			</div>
			<a href="/app/contractor/jobs/new" class="btn preset-filled-primary-500">
				<ClipboardList class="mr-2 h-4 w-4" />
				Create Job
			</a>
		</div>

		<!-- Quick Stats -->
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Wrench class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Active Jobs</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						<Users class="h-5 w-5 text-secondary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Technicians</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Calendar class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Today's Jobs</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<TrendingUp class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">$0</p>
						<p class="text-sm text-surface-500">This Month</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Main Content -->
		<div class="mt-8 grid gap-8 lg:grid-cols-3">
			<!-- Today's Schedule -->
			<div class="lg:col-span-2">
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Today's Schedule</h2>
					</div>
					<div class="p-6">
						<EmptyState
							title="No jobs scheduled"
							description="Jobs scheduled for today will appear here."
						/>
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
							{#each quickActions as action}
								<a
									href={action.href}
									class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-200-800"
								>
									<action.icon class="h-5 w-5 text-surface-500" />
									<span class="text-sm font-medium">{action.label}</span>
								</a>
							{/each}
						</div>
					</div>
				</Card>

				<!-- Pending Invoices -->
				<Card variant="outlined" padding="none" class="mt-4">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Pending Invoices</h2>
					</div>
					<div class="p-6">
						<div class="text-center">
							<p class="text-2xl font-bold">$0</p>
							<p class="text-sm text-surface-500">Outstanding</p>
							<a href="/app/contractor/invoices" class="mt-3 inline-block text-sm text-primary-500 hover:underline">
								View all invoices →
							</a>
						</div>
					</div>
				</Card>
			</div>
		</div>
	</div>
</PageContainer>
