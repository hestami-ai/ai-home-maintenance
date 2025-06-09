<script lang="ts">
	// Import necessary components
	import { format } from 'date-fns';
	import { Home, ClipboardList, Clock, Plus, Calendar } from 'lucide-svelte';
	import type { ServiceRequest as ServiceRequestType } from '$lib/types';
	
	// Define props using runes syntax
	const { ownerStats, recentRequests } = $props<{
		ownerStats: {
			totalProperties: number;
			activeRequests: number;
			completedServices: number;
			scheduledServices: number;
		};
		recentRequests: (ServiceRequestType & { propertyTitle: string })[];
	}>();
	
	interface QuickAction {
		title: string;
		description: string;
		iconType: 'plus' | 'home' | 'calendar';
		href: string;
		color: string;
	}
	
	// Stats data - use the data passed from the parent
	let stats = $state(ownerStats);
	
	// Update stats when props change
	$effect(() => {
		stats = ownerStats;
	});
	
	// Quick action cards
	const quickActions = $derived<QuickAction[]>([
		{
			title: 'New Service Request',
			description: 'Submit a new service request',
			iconType: 'plus',
			href: '/requests/new',
			color: 'variant-soft-primary'
		},
		{
			title: 'My Properties',
			description: 'Manage your registered properties',
			iconType: 'home',
			href: '/properties',
			color: 'variant-soft-secondary'
		},
		{
			title: 'Upcoming Services',
			description: 'View your scheduled services',
			iconType: 'calendar',
			href: '/requests',
			color: 'variant-soft-tertiary'
		}
	]);
	
	// Loading state - we'll consider it loaded since data is provided by the parent
	let isLoading = $state(false);
	
	// Status badge helper
	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'PENDING':
				return 'variant-soft-warning';
			case 'SCHEDULED':
				return 'variant-soft-secondary';
			case 'IN_PROGRESS':
				return 'variant-soft-orange';
			case 'COMPLETED':
				return 'variant-soft-success';
			case 'CANCELLED':
				return 'variant-soft-error';
			default:
				return 'variant-soft-surface';
		}
	}
</script>

<div class="space-y-8">
	<!-- Stats Overview -->
	{#if isLoading}
		<div class="flex justify-center py-10">
			<div class="loading loading-spinner loading-lg text-primary-500"></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Total Properties -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-primary">
						<Home class="h-6 w-6 text-primary-700 dark:text-primary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">My Properties</h3>
						<p class="text-2xl font-semibold">{stats.totalProperties}</p>
					</div>
				</div>
			</div>
			
			<!-- Active Requests -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-secondary">
						<ClipboardList class="h-6 w-6 text-secondary-700 dark:text-secondary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Active Requests</h3>
						<p class="text-2xl font-semibold">{stats.activeRequests}</p>
					</div>
				</div>
			</div>
			
			<!-- Completed Services -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-tertiary">
						<Clock class="h-6 w-6 text-tertiary-700 dark:text-tertiary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Completed Services</h3>
						<p class="text-2xl font-semibold">{stats.completedServices}</p>
					</div>
				</div>
			</div>
			
			<!-- Scheduled Services -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-success">
						<Calendar class="h-6 w-6 text-success-700 dark:text-success-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Scheduled Services</h3>
						<p class="text-2xl font-semibold">{stats.scheduledServices}</p>
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
							{#if action.iconType === 'plus'}
								<Plus class="h-6 w-6" />
							{:else if action.iconType === 'home'}
								<Home class="h-6 w-6" />
							{:else if action.iconType === 'calendar'}
								<Calendar class="h-6 w-6" />
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
	
	<!-- Recent Requests -->
	<div>
		<h2 class="h3 mb-4">Recent Requests</h2>
		{#if recentRequests.length === 0}
			<div class="card p-6 text-center">
				<ClipboardList class="mx-auto h-12 w-12 text-surface-500 mb-2" />
				<h3 class="h4 mb-2">No Recent Requests</h3>
				<p class="text-surface-600-300-token">You haven't submitted any service requests yet.</p>
				<a href="/dashboard/requests/new" class="btn variant-filled-primary mt-4">Submit Your First Request</a>
			</div>
		{:else}
			<div class="card variant-filled-surface">
				<div class="table-container">
					<table class="table table-hover">
						<thead>
							<tr>
								<th>Title</th>
								<th>Status</th>
								<th>Property</th>
								<th>Date</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each recentRequests as request}
								<tr>
									<td>
										<div class="font-medium">{request.title}</div>
									</td>
									<td>
										<span class="badge {getStatusBadgeClass(request.status)}">{request.status.replace(/_/g, ' ')}</span>
									</td>
									<td>
										<div class="text-sm">{request.propertyTitle}</div>
									</td>
									<td>
										<div class="text-sm">{format(new Date(request.created_at), 'MMM d, yyyy')}</div>
									</td>
									<td class="text-right">
										<a href={`/requests/${request.id}`} class="btn btn-sm variant-ghost-primary">
											View
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>
