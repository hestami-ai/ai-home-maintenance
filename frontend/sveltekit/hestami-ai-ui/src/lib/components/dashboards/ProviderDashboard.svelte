<script lang="ts">
	// Import necessary components
	import { format } from 'date-fns';
	import { Briefcase, ClipboardList, Clock, Calendar, DollarSign } from 'lucide-svelte';
	
	// Define types
	type JobStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
	
	interface ProviderStats {
		activeJobs: number;
		completedJobs: number;
		scheduledJobs: number;
		monthlyEarnings: number;
	}
	
	interface Job {
		id: string;
		title: string;
		status: JobStatus;
		scheduled_date: string;
		client: string;
		property: string;
	}
	
	interface QuickAction {
		title: string;
		description: string;
		iconType: 'clipboard' | 'calendar' | 'dollar';
		href: string;
		color: string;
	}
	
	// Stats data
	let stats = $state<ProviderStats>({
		activeJobs: 0,
		completedJobs: 0,
		scheduledJobs: 0,
		monthlyEarnings: 0
	});
	
	// Quick action cards
	const quickActions = $derived<QuickAction[]>([
		{
			title: 'Available Jobs',
			description: 'Browse open service requests',
			iconType: 'clipboard',
			href: '/dashboard/jobs/available',
			color: 'variant-soft-primary'
		},
		{
			title: 'My Schedule',
			description: 'View your upcoming appointments',
			iconType: 'calendar',
			href: '/dashboard/schedule',
			color: 'variant-soft-secondary'
		},
		{
			title: 'Earnings',
			description: 'Track your payments and invoices',
			iconType: 'dollar',
			href: '/dashboard/earnings',
			color: 'variant-soft-tertiary'
		}
	]);
	
	// Active jobs
	let activeJobs = $state<Job[]>([]);
	
	// Loading state
	let isLoading = $state(true);
	
	// Fetch dashboard data
	async function fetchDashboardData(): Promise<void> {
		try {
			// Simulate API call
			setTimeout(() => {
				stats = {
					activeJobs: 2,
					completedJobs: 15,
					scheduledJobs: 3,
					monthlyEarnings: 3250
				};
				
				activeJobs = [
					{
						id: '1',
						title: 'HVAC Repair',
						status: 'IN_PROGRESS',
						scheduled_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
						client: 'John Doe',
						property: '123 Main St, Boston, MA'
					},
					{
						id: '2',
						title: 'Plumbing Issue',
						status: 'SCHEDULED',
						scheduled_date: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
						client: 'Jane Smith',
						property: '456 Oak Ave, Cambridge, MA'
					}
				];
				
				isLoading = false;
			}, 1000);
			
			// In a real implementation, you would fetch data from an API
			// const response = await fetch('/api/dashboard/provider-stats');
			// const data = await response.json();
			// stats = data;
		} catch (error) {
			console.error('Failed to fetch dashboard data:', error);
		} finally {
			isLoading = false;
		}
	}
	
	// Initialize data on component mount
	$effect(() => {
		fetchDashboardData();
	});
	
	// Status badge helper
	function getStatusBadgeClass(status: JobStatus): string {
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
			<!-- Active Jobs -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-primary">
						<Briefcase class="h-6 w-6 text-primary-700 dark:text-primary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Active Jobs</h3>
						<p class="text-2xl font-semibold">{stats.activeJobs}</p>
					</div>
				</div>
			</div>
			
			<!-- Completed Jobs -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-secondary">
						<Clock class="h-6 w-6 text-secondary-700 dark:text-secondary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Completed Jobs</h3>
						<p class="text-2xl font-semibold">{stats.completedJobs}</p>
					</div>
				</div>
			</div>
			
			<!-- Scheduled Jobs -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-tertiary">
						<Calendar class="h-6 w-6 text-tertiary-700 dark:text-tertiary-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Scheduled Jobs</h3>
						<p class="text-2xl font-semibold">{stats.scheduledJobs}</p>
					</div>
				</div>
			</div>
			
			<!-- Monthly Earnings -->
			<div class="card variant-soft p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0 p-3 rounded-token variant-soft-success">
						<DollarSign class="h-6 w-6 text-success-700 dark:text-success-300" />
					</div>
					<div class="ml-4 flex-1">
						<h3 class="text-sm font-medium text-surface-600-300-token">Monthly Earnings</h3>
						<p class="text-2xl font-semibold">${stats.monthlyEarnings.toLocaleString()}</p>
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
							{#if action.iconType === 'clipboard'}
								<ClipboardList class="h-6 w-6" />
							{:else if action.iconType === 'calendar'}
								<Calendar class="h-6 w-6" />
							{:else if action.iconType === 'dollar'}
								<DollarSign class="h-6 w-6" />
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
	
	<!-- Active Jobs -->
	<div>
		<h2 class="h3 mb-4">Current Jobs</h2>
		{#if activeJobs.length === 0}
			<div class="card p-6 text-center">
				<Briefcase class="mx-auto h-12 w-12 text-surface-500 mb-2" />
				<h3 class="h4 mb-2">No Active Jobs</h3>
				<p class="text-surface-600-300-token">You don't have any active jobs at the moment.</p>
				<a href="/dashboard/jobs/available" class="btn variant-filled-primary mt-4">Browse Available Jobs</a>
			</div>
		{:else}
			<div class="card variant-filled-surface">
				<div class="table-container">
					<table class="table table-hover">
						<thead>
							<tr>
								<th>Job</th>
								<th>Status</th>
								<th>Client</th>
								<th>Location</th>
								<th>Scheduled Date</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each activeJobs as job}
								<tr>
									<td>
										<div class="font-medium">{job.title}</div>
									</td>
									<td>
										<span class="badge {getStatusBadgeClass(job.status)}">{job.status.replace(/_/g, ' ')}</span>
									</td>
									<td>
										<div class="text-sm">{job.client}</div>
									</td>
									<td>
										<div class="text-sm">{job.property}</div>
									</td>
									<td>
										<div class="text-sm">{format(new Date(job.scheduled_date), 'MMM d, yyyy')}</div>
									</td>
									<td class="text-right">
										<a href={`/dashboard/jobs/${job.id}`} class="btn btn-sm variant-ghost-primary">
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
