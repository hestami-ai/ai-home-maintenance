<script lang="ts">
	import { format } from 'date-fns';
	import { Filter, Plus, Search } from 'lucide-svelte';
	import type { Property, ServiceRequest } from '$lib/types';

	// Define props using runes syntax
	const { properties, serviceRequests, error } = $props<{
		properties: Property[];
		serviceRequests: ServiceRequest[];
		error: string | null;
	}>();

	// Filters
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let categoryFilter = $state('all');
	let propertyFilter = $state('all');

	// Create a state variable for filtered requests to avoid infinite loops
	let filteredRequestsArray = $state<ServiceRequest[]>([]);
	
	// Update filtered requests when filters or service requests change
	$effect(() => {
		filteredRequestsArray = serviceRequests.filter((request: ServiceRequest) =>
			(searchQuery === '' || 
				request.title.toLowerCase().includes(searchQuery.toLowerCase())
			) &&
			(statusFilter === 'all' || request.status.toLowerCase() === statusFilter.toLowerCase()) &&
			(categoryFilter === 'all' || request.category === categoryFilter) &&
			(propertyFilter === 'all' || request.property === propertyFilter)
		);
	});
	
	// Log for debugging
	$effect.root(() => {
		console.log(`Owner has ${serviceRequests.length} service requests`);
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
</script>

<div class="space-y-6">
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h2">My Service Requests</h1>
			<p class="text-surface-600-300-token">Manage your maintenance and service requests</p>
		</div>
		<a href="/requests/new" class="btn variant-filled-primary">
			<Plus class="h-5 w-5 mr-2" />
			New Request
		</a>
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
				
				<select bind:value={propertyFilter} class="select">
					<option value="all">All Properties</option>
					{#each properties as property}
						<option value={property.id}>{property.title}</option>
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
					<th>Title</th>
					<th>Status</th>
					<th>Category</th>
					<th>Property</th>
					<th>Date</th>
					<th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if error}
					<tr><td colspan="6" class="text-center text-red-500">{error}</td></tr>
				{:else if properties.length === 0}
					<tr><td colspan="6" class="text-center">You have no properties. Add a property to begin creating service requests.</td></tr>
				{:else if serviceRequests.length === 0}
					<tr><td colspan="6" class="text-center">No service requests found for your properties.</td></tr>
				{:else}
					{#each filteredRequestsArray as request}
						<tr>
							<td>{request.title}</td>
							<td>
								<span class="badge {getStatusClass(request.status)}">
									{formatStatus(request.status)}
								</span>
							</td>
							<td>{request.category_display}</td>
							<td>{request.property_details?.title || 'Unknown'}</td>
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
