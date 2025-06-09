<script lang="ts">
	import { format } from 'date-fns';
	import { Filter, Search, Briefcase, CalendarClock } from 'lucide-svelte';
	import type { ServiceRequest } from '$lib/types';

	// Define props using runes syntax
	const { serviceRequests, error } = $props<{
		serviceRequests: ServiceRequest[];
		error: string | null;
	}>();

	// Filters
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let categoryFilter = $state('all');

	// Tabs for different request types
	let activeTab = $state('assigned');

	// Computed properties using derived values
	// We'll use $derived for read-only computed values to avoid circular dependencies
	const assignedRequests = $derived(serviceRequests.filter((req: ServiceRequest) => 
		req.provider && 
		['SCHEDULED', 'IN_PROGRESS', 'ACCEPTED'].includes(req.status)
	));

	const availableRequests = $derived(serviceRequests.filter((req: ServiceRequest) => 
		!req.provider && 
		['BIDDING', 'PENDING', 'IN_RESEARCH'].includes(req.status)
	));

	const completedRequests = $derived(serviceRequests.filter((req: ServiceRequest) => 
		req.provider && 
		['COMPLETED'].includes(req.status)
	));

	// Get active requests based on the current tab
	const activeRequests = $derived(() => {
		switch (activeTab) {
			case 'assigned': return assignedRequests;
			case 'available': return availableRequests;
			case 'completed': return completedRequests;
			default: return assignedRequests;
		}
	});

	// Filter active requests based on search and filters
	const filteredRequests = $derived(() => {
		return activeRequests().filter((request: ServiceRequest) =>
			(searchQuery === '' || 
				request.title.toLowerCase().includes(searchQuery.toLowerCase())
			) &&
			(statusFilter === 'all' || request.status.toLowerCase() === statusFilter.toLowerCase()) &&
			(categoryFilter === 'all' || request.category === categoryFilter)
		);
	});

	// Log for debugging - using a one-time effect to avoid infinite loops
	$effect.root(() => {
		console.log(`Provider view: ${serviceRequests.length} service requests`);
		console.log(`Assigned: ${assignedRequests.length}, Available: ${availableRequests.length}, Completed: ${completedRequests.length}`);
	});

	function formatDate(dateString: string): string {
		return format(new Date(dateString), 'MMM d, yyyy');
	}

	function getStatusClass(status: string): string {
		switch (status.toLowerCase()) {
			case 'pending': return 'badge-warning';
			case 'in_research': return 'badge-secondary';
			case 'bidding': return 'badge-primary';
			case 'in_progress': return 'badge-tertiary';
			case 'scheduled': return 'badge-blue';
			case 'completed': return 'badge-success';
			case 'cancelled': return 'badge-error';
			case 'accepted': return 'badge-success-500';
			default: return 'badge-surface';
		}
	}

	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}

	function getPriorityClass(priority: string): string {
		switch (priority.toLowerCase()) {
			case 'urgent': return 'badge-error';
			case 'high': return 'badge-warning';
			case 'medium': return 'badge-secondary';
			case 'low': return 'badge-surface';
			default: return 'badge-surface';
		}
	}
</script>

<div class="space-y-6">
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h2">Service Requests</h1>
			<p class="text-surface-600-300-token">Manage your service jobs and find new opportunities</p>
		</div>
		<div class="flex gap-2">
			<a href="/schedule" class="btn variant-filled-primary">
				<CalendarClock class="h-5 w-5 mr-2" />
				My Schedule
			</a>
		</div>
	</header>
	
	<!-- Request Type Tabs -->
	<div class="flex border-b border-surface-300-600-token">
		<button 
			class="px-4 py-2 font-medium {activeTab === 'assigned' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token'}"
			onclick={() => activeTab = 'assigned'}
		>
			My Jobs ({assignedRequests.length})
		</button>
		<button 
			class="px-4 py-2 font-medium {activeTab === 'available' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token'}"
			onclick={() => activeTab = 'available'}
		>
			Available Jobs ({availableRequests.length})
		</button>
		<button 
			class="px-4 py-2 font-medium {activeTab === 'completed' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token'}"
			onclick={() => activeTab = 'completed'}
		>
			Completed Jobs ({completedRequests.length})
		</button>
	</div>
	
	<!-- Filters -->
	<div class="card p-4">
		<div class="flex flex-col md:flex-row gap-4 items-start">
			<!-- Search -->
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto] w-full md:w-1/3 h-auto">
				<div class="input-group-shim flex items-center justify-center h-10">
					<Search class="h-4 w-4" />
				</div>
				<input
					type="text"
					placeholder="Search requests..."
					bind:value={searchQuery}
					class="input h-10"
				/>
			</div>
			
			<!-- Filter Dropdowns -->
			<div class="flex flex-wrap gap-2">
				<select bind:value={statusFilter} class="select">
					<option value="all">All Statuses</option>
					<option value="pending">Pending</option>
					<option value="in_research">In Research</option>
					<option value="bidding">Bidding</option>
					<option value="accepted">Accepted</option>
					<option value="scheduled">Scheduled</option>
					<option value="in_progress">In Progress</option>
					<option value="completed">Completed</option>
				</select>
				
				<select bind:value={categoryFilter} class="select">
					<option value="all">All Categories</option>
					<option value="PLUMBING">Plumbing</option>
					<option value="ELECTRICAL">Electrical</option>
					<option value="HVAC">HVAC</option>
					<option value="GENERAL_MAINTENANCE">General Maintenance</option>
					<option value="LANDSCAPING">Landscaping</option>
					<option value="CLEANING">Cleaning</option>
					<option value="PEST_CONTROL">Pest Control</option>
					<option value="ROOFING">Roofing</option>
					<option value="REMODELING">Remodeling</option>
					<option value="OTHER">Other</option>
				</select>
			</div>
		</div>
	</div>
	
	<!-- Service Requests Table -->
	<div class="card">
		<table class="table table-hover">
			<thead>
				<tr>
					<th>Title</th>
					<th>Status</th>
					<th>Category</th>
					<th>Client</th>
					<th>Location</th>
					<th>Priority</th>
					<th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if error}
					<tr><td colspan="7" class="text-center text-red-500">{error}</td></tr>
				{:else if activeRequests().length === 0}
					<tr><td colspan="7" class="text-center">
						{#if activeTab === 'assigned'}
							You don't have any assigned jobs at the moment.
						{:else if activeTab === 'available'}
							There are no available jobs matching your criteria at the moment.
						{:else}
							You don't have any completed jobs yet.
						{/if}
					</td></tr>
				{:else}
					{#each filteredRequests() as request}
						<tr>
							<td>{request.title}</td>
							<td>
								<span class="badge {getStatusClass(request.status)}">
									{formatStatus(request.status)}
								</span>
							</td>
							<td>{request.category_display}</td>
							<td>
								{#if request.created_by_details}
									{request.created_by_details.first_name} {request.created_by_details.last_name}
								{:else}
									Unknown
								{/if}
							</td>
							<td>
								{#if request.property_details}
									{request.property_details.city}, {request.property_details.state}
								{:else}
									Unknown
								{/if}
							</td>
							<td>
								<span class="badge {getPriorityClass(request.priority)}">
									{request.priority}
								</span>
							</td>
							<td class="text-right">
								<a href={`/requests/${request.id}`} class="btn btn-sm variant-ghost-primary">
									{#if activeTab === 'available'}
										Bid
									{:else}
										View
									{/if}
								</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
