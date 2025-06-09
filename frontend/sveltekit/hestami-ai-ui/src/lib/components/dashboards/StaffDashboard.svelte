<script lang="ts">
	// Import necessary components
	import { format } from 'date-fns';
	import { Users, Briefcase, BarChart, ClipboardList } from 'lucide-svelte';
	
	// Define types
	interface StaffDashboardStats {
		total_users: number;
		active_providers: number;
		pending_requests: number;
	}
	
	interface QuickAction {
		title: string;
		description: string;
		iconType: 'users' | 'clipboard' | 'chart';
		href: string;
		color: string;
	}
	
	// Import data from page props
	const { staffStats = null } = $props<{ staffStats: StaffDashboardStats | null }>();
	
	// Quick action cards
	const quickActions = $derived<QuickAction[]>([
		{
			title: 'Manage Users',
			description: 'View and manage user accounts',
			iconType: 'users',
			href: '/users',
			color: 'variant-soft-primary'
		},
		{
			title: 'Service Requests',
			description: 'Review and manage service requests',
			iconType: 'clipboard',
			href: '/requests',
			color: 'variant-soft-secondary'
		}
	]);
	
	// Loading state
	let isLoading = $derived(!staffStats);
</script>

<div class="space-y-8">
	<!-- Stats Overview -->
	{#if isLoading}
		<div class="flex justify-center py-10">
			<div class="loading loading-spinner loading-lg text-primary-500"></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Total Users -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-primary">
						<Users class="h-6 w-6 text-primary-700 dark:text-primary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Total Users</h3>
						<p class="text-2xl font-semibold">{staffStats?.total_users || 0}</p>
					</div>
				</div>
			</div>
			
			<!-- Active Providers -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-secondary">
						<Briefcase class="h-6 w-6 text-secondary-700 dark:text-secondary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Active Providers</h3>
						<p class="text-2xl font-semibold">{staffStats?.active_providers || 0}</p>
					</div>
				</div>
			</div>
			
			<!-- Pending Requests -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-tertiary">
						<ClipboardList class="h-6 w-6 text-tertiary-700 dark:text-tertiary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Pending Requests</h3>
						<p class="text-2xl font-semibold">{staffStats?.pending_requests || 0}</p>
					</div>
				</div>
			</div>
			
			<!-- Total Revenue -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-success">
						<BarChart class="h-6 w-6 text-success-700 dark:text-success-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Total Revenue</h3>
						<p class="text-2xl font-semibold">N/A</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Quick Actions -->
	<div>
		<h2 class="h3 mb-4">Quick Actions</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each quickActions as action}
				<a href={action.href} class="card p-4 hover:variant-soft-hover transition-all duration-200">
					<div class="flex items-center">
						<div class="flex-shrink-0 p-3 rounded-token {action.color}">
							{#if action.iconType === 'users'}
								<Users class="h-6 w-6" />
							{:else if action.iconType === 'clipboard'}
								<ClipboardList class="h-6 w-6" />
							{:else if action.iconType === 'chart'}
								<BarChart class="h-6 w-6" />
							{/if}
						</div>
						<div class="ml-4">
							<h3 class="font-semibold">{action.title}</h3>
							<p class="text-sm text-surface-600-300-token">{action.description}</p>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</div>
