<script lang="ts">
	import { Home, Plus, FileText, Wrench, Bell } from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { auth, organizationStore } from '$lib/stores';

	const quickActions = [
		{ label: 'Request Service', icon: Wrench, href: '/app/concierge/service-request' },
		{ label: 'View Documents', icon: FileText, href: '/app/concierge/documents' },
		{ label: 'Manage Properties', icon: Home, href: '/app/concierge/properties' }
	];
</script>

<svelte:head>
	<title>Concierge Dashboard | Hestami AI</title>
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
			<a href="/app/concierge/service-request" class="btn preset-filled-primary-500">
				<Plus class="mr-2 h-4 w-4" />
				Request Service
			</a>
		</div>

		<!-- Quick Stats -->
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Home class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Properties</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Wrench class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Active Requests</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<FileText class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Documents</p>
					</div>
				</div>
			</Card>
			<Card variant="outlined" padding="md">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						<Bell class="h-5 w-5 text-secondary-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">0</p>
						<p class="text-sm text-surface-500">Notifications</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Main Content -->
		<div class="mt-8 grid gap-8 lg:grid-cols-3">
			<!-- Recent Activity -->
			<div class="lg:col-span-2">
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h2 class="font-semibold">Recent Activity</h2>
					</div>
					<div class="p-6">
						<EmptyState
							title="No recent activity"
							description="Your recent service requests and updates will appear here."
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
			</div>
		</div>
	</div>
</PageContainer>
