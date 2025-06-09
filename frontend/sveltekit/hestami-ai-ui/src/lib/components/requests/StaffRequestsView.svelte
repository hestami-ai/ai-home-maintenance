<script lang="ts">
	import { format } from 'date-fns';
	import { Filter, Search, UserPlus, Briefcase } from 'lucide-svelte';
	import type { ServiceRequest, User } from '$lib/types';

	// Define props using runes syntax
	const { serviceRequests, error } = $props<{
		serviceRequests: ServiceRequest[];
		error: string | null;
	}>();

	// Filters
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let categoryFilter = $state('all');
	let ownerFilter = $state('all');

	// Get unique owners from service requests
	// Using a simple state variable to store the owners array to avoid derived function issues
	let ownersArray = $state<User[]>([]);
	
	// Update owners array when service requests change
	$effect(() => {
		// Create a new map each time to avoid duplicates
		const ownersMap = new Map<string, User>();
		
		// Add unique owners to the map
		serviceRequests.forEach((request: ServiceRequest) => {
			if (request.created_by_details && !ownersMap.has(request.created_by_details.id)) {
				ownersMap.set(request.created_by_details.id, request.created_by_details);
			}
		});
		
		// Convert the map to an array and update the state
		ownersArray = Array.from(ownersMap.values());
	});

	// Create a state variable for filtered requests to avoid derived function issues
	let filteredRequestsArray = $state<ServiceRequest[]>([]);
	
	// Update filtered requests when filters or service requests change
	$effect(() => {
		filteredRequestsArray = serviceRequests.filter((request: ServiceRequest) =>
			(searchQuery === '' || 
				request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				request.id.toLowerCase().includes(searchQuery.toLowerCase())
			) &&
			(statusFilter === 'all' || request.status.toLowerCase() === statusFilter.toLowerCase()) &&
			(categoryFilter === 'all' || request.category === categoryFilter) &&
			(ownerFilter === 'all' || request.created_by === ownerFilter)
		);
	});

	// Log for debugging
	$effect.root(() => {
		console.log(`Staff view: ${serviceRequests.length} service requests`);
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
			<p class="text-surface-600-300-token">Manage all service requests across the platform</p>
		</div>
		<div class="flex gap-2">
			<a href="/providers/invite" class="btn variant-soft-secondary">
				<UserPlus class="h-5 w-5 mr-2" />
				Invite Provider
			</a>
			<a href="/requests/research" class="btn variant-filled-primary">
				<Briefcase class="h-5 w-5 mr-2" />
				Research Queue
			</a>
		</div>
	</header>
	
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
					<option value="scheduled">Scheduled</option>
					<option value="in_progress">In Progress</option>
					<option value="completed">Completed</option>
					<option value="cancelled">Cancelled</option>
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
				
				<select bind:value={ownerFilter} class="select">
					<option value="all">All Owners</option>
					{#each ownersArray as owner (owner.id)}
						<option value={owner.id}>{owner.first_name} {owner.last_name}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>
	
	<!-- Service Requests Table -->
	<div class="card">
		<table class="table table-hover">
			<thead>
				<tr>
					<th>ID</th>
					<th>Title</th>
					<th>Status</th>
					<th>Category</th>
					<th>Owner</th>
					<th>Priority</th>
					<th>Date</th>
					<th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if error}
					<tr><td colspan="8" class="text-center text-red-500">{error}</td></tr>
				{:else if serviceRequests.length === 0}
					<tr><td colspan="8" class="text-center">No service requests found in the system.</td></tr>
				{:else}
					{#each filteredRequestsArray as request}
						<tr>
							<td class="font-mono text-xs">{request.id.substring(0, 8)}</td>
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
								<span class="badge {getPriorityClass(request.priority)}">
									{request.priority}
								</span>
							</td>
							<td>{formatDate(request.created_at)}</td>
							<td class="text-right">
								<a href={`/requests/${request.id}`} class="btn btn-sm variant-ghost-primary">
									View
								</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
