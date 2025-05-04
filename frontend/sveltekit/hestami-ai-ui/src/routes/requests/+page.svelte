<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { format } from 'date-fns';
	import { Filter, Plus, Search } from 'lucide-svelte';
	import AddRequestDialog from '$lib/components/requests/AddRequestDialog.svelte';
	import type { Property, ServiceRequest } from '$lib/types';

export let data: { properties: Property[]; error: string | null };

let isAddDialogOpen = false;

// Make these reactive to data changes using $: syntax
$: error = data.error;
$: properties = data.properties;
$: serviceRequests = properties.flatMap((property) =>
    (property.service_requests || []).map((sr) => ({ ...sr, propertyTitle: property.title }))
);

// Filters
let searchQuery = '';
let statusFilter = 'all';
let categoryFilter = 'all';
let propertyFilter = 'all';


	function formatDate(dateString: string): string {
		return format(new Date(dateString), 'MMM d, yyyy');
	}

	function getStatusClass(status: string): string {
		switch (status) {
			case 'pending': return 'badge-warning';
			case 'in_progress': return 'badge-primary';
			case 'completed': return 'badge-success';
			case 'cancelled': return 'badge-error';
			default: return 'badge-surface';
		}
	}

	function formatStatus(status: string): string {
		return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
</script>

<div class="container mx-auto p-4 space-y-6">
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h1">Service Requests</h1>
			<p class="text-surface-600-300-token">Manage your maintenance and service requests</p>
		</div>
		<button class="btn variant-filled-primary" onclick={() => isAddDialogOpen = true}>
			<Plus class="h-5 w-5 mr-2" />
			New Request
		</button>
		
		<!-- Add Request Dialog -->
		<AddRequestDialog 
			isOpen={isAddDialogOpen} 
			onClose={() => isAddDialogOpen = false}
			properties={properties}
		/>
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
					<option value="in_progress">In Progress</option>
					<option value="completed">Completed</option>
					<option value="cancelled">Cancelled</option>
				</select>
				
				<select bind:value={categoryFilter} class="select">
					<option value="all">All Categories</option>
					<option value="Plumbing">Plumbing</option>
					<option value="Electrical">Electrical</option>
					<option value="HVAC">HVAC</option>
					<option value="Appliance">Appliance</option>
					<option value="Structural">Structural</option>
					<option value="Landscaping">Landscaping</option>
					<option value="Other">Other</option>
				</select>
				
				<select bind:value={propertyFilter} class="select">
					<option value="all">All Properties</option>
					{#each properties as property}
						<option value={property.title}>{property.title}</option>
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
					<th>Address</th>
					<th>Date</th>
					<th class="text-right">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if error}
					<tr><td colspan="7" class="text-center text-red-500">{error}</td></tr>
				{:else if properties.length === 0}
					<tr><td colspan="7" class="text-center">You have no properties. Add a property to begin creating service requests.</td></tr>
				{:else if serviceRequests.length === 0}
					<tr><td colspan="7" class="text-center">No service requests found for your properties.</td></tr>
				{:else}
					{#each serviceRequests
						.filter(request =>
							(searchQuery === '' || request.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
							(statusFilter === 'all' || request.status === statusFilter) &&
							(categoryFilter === 'all' || request.category === categoryFilter) &&
							(propertyFilter === 'all' || request.propertyTitle === propertyFilter)
						)
					 as request}
						<tr>
							<td>{request.title}</td>
							<td>
								<span class="badge {getStatusClass(request.status)}">
									{formatStatus(request.status)}
								</span>
							</td>
							<td>{request.category}</td>
							<td>{request.propertyTitle}</td>
							<td>{request.property_details.address}</td>
							<td>{formatDate(request.created_at)}</td>
							<td class="text-right">
								<a href="/requests/{request.id}" class="btn btn-sm variant-soft">View</a>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
