<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { format } from 'date-fns';
	import { Search, Filter, Bell, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { ServiceRequest, QueueData } from '$lib/types';

	// Get data from page load
	const { data } = $props<{ data: any }>();
	
	// Reactive state for filters
	let searchQuery = $state(data.filters.search || '');
	let statusFilter = $state(data.filters.status || 'all');
	let priorityFilter = $state(data.filters.priority || 'all');
	let assignedToFilter = $state(data.filters.assigned_to || 'all');
	
	// Saved filters in localStorage
	let savedFilters = $state<{ name: string; filters: any }[]>([]);
	let showSaveFilterModal = $state(false);
	let newFilterName = $state('');
	
	// Load saved filters from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('staff_saved_filters');
			if (saved) {
				savedFilters = JSON.parse(saved);
			}
		}
	});
	
	// Apply filters to URL
	function applyFilters() {
		const params = new URLSearchParams();
		
		if (searchQuery) params.set('search', searchQuery);
		if (statusFilter !== 'all') params.set('status', statusFilter);
		if (priorityFilter !== 'all') params.set('priority', priorityFilter);
		if (assignedToFilter !== 'all') params.set('assigned_to', assignedToFilter);
		
		goto(`/staff/requests?${params.toString()}`);
	}
	
	// Save current filter set
	function saveCurrentFilters() {
		if (!newFilterName.trim()) return;
		
		const filterSet = {
			name: newFilterName,
			filters: {
				search: searchQuery,
				status: statusFilter,
				priority: priorityFilter,
				assigned_to: assignedToFilter
			}
		};
		
		savedFilters = [...savedFilters, filterSet];
		localStorage.setItem('staff_saved_filters', JSON.stringify(savedFilters));
		
		newFilterName = '';
		showSaveFilterModal = false;
	}
	
	// Load saved filter
	function loadSavedFilter(filterSet: any) {
		searchQuery = filterSet.filters.search || '';
		statusFilter = filterSet.filters.status || 'all';
		priorityFilter = filterSet.filters.priority || 'all';
		assignedToFilter = filterSet.filters.assigned_to || 'all';
		applyFilters();
	}
	
	// Delete saved filter
	function deleteSavedFilter(index: number) {
		savedFilters = savedFilters.filter((_, i) => i !== index);
		localStorage.setItem('staff_saved_filters', JSON.stringify(savedFilters));
	}
	
	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		statusFilter = 'all';
		priorityFilter = 'all';
		assignedToFilter = 'all';
		goto('/staff/requests');
	}
	
	// Pagination
	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/staff/requests?${params.toString()}`);
	}
	
	// Format helpers
	function formatDate(dateString: string): string {
		return format(new Date(dateString), 'MMM d, yyyy');
	}
	
	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
	
	function getStatusClass(status: string): string {
		switch (status.toLowerCase()) {
			case 'pending': return 'badge variant-soft-warning';
			case 'in_research': return 'badge variant-soft-secondary';
			case 'bidding': return 'badge variant-soft-primary';
			case 'accepted': return 'badge variant-soft-success';
			case 'scheduled': return 'badge variant-soft-tertiary';
			case 'in_progress': return 'badge variant-soft-tertiary';
			case 'completed': return 'badge variant-soft-success';
			case 'cancelled': return 'badge variant-soft-error';
			default: return 'badge variant-soft-surface';
		}
	}
	
	function getPriorityClass(priority: string): string {
		switch (priority.toLowerCase()) {
			case 'urgent': return 'badge variant-filled-error';
			case 'high': return 'badge variant-filled-warning';
			case 'medium': return 'badge variant-soft-secondary';
			case 'low': return 'badge variant-soft-surface';
			default: return 'badge variant-soft-surface';
		}
	}
	
	function getPriorityEmoji(priority: string): string {
		switch (priority.toLowerCase()) {
			case 'urgent': return '🔴';
			case 'high': return '🟠';
			case 'medium': return '🟢';
			case 'low': return '⚪';
			default: return '';
		}
	}
</script>

<svelte:head>
	<title>Service Queue - Hestami AI</title>
	<meta name="description" content="Manage service requests queue" />
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Header -->
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h2">Service Queue</h1>
			<p class="text-surface-600-300-token">Manage and triage service requests</p>
		</div>
		<div class="flex gap-2">
			<button class="btn variant-ghost-surface" onclick={() => (showSaveFilterModal = true)}>
				Save Current Filters
			</button>
		</div>
	</header>
	
	<!-- Queue Stats -->
	{#if data.queueStats}
		<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold">{data.queueStats.queue_counts?.total || 0}</div>
				<div class="text-sm text-surface-600-300-token">Total</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-warning-500">{data.queueStats.queue_counts?.pending || 0}</div>
				<div class="text-sm text-surface-600-300-token">Pending</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-secondary-500">{data.queueStats.queue_counts?.in_research || 0}</div>
				<div class="text-sm text-surface-600-300-token">In Research</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-primary-500">{data.queueStats.queue_counts?.bidding || 0}</div>
				<div class="text-sm text-surface-600-300-token">Bidding</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-success-500">{data.queueStats.queue_counts?.accepted || 0}</div>
				<div class="text-sm text-surface-600-300-token">Accepted</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-tertiary-500">{data.queueStats.queue_counts?.scheduled || 0}</div>
				<div class="text-sm text-surface-600-300-token">Scheduled</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-error-500">{data.queueStats.sla_indicators?.overdue || 0}</div>
				<div class="text-sm text-surface-600-300-token">Overdue</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-warning-500">{data.queueStats.sla_indicators?.approaching_deadline || 0}</div>
				<div class="text-sm text-surface-600-300-token">Due Soon</div>
			</div>
		</div>
	{/if}
	
	<!-- Filters -->
	<div class="card p-4">
		<div class="space-y-4">
			<!-- Search -->
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
				<div class="input-group-shim flex items-center justify-center">
					<Search class="h-4 w-4" />
				</div>
				<input
					type="text"
					placeholder="Search by request title, property, or customer..."
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Enter' && applyFilters()}
					class="input"
				/>
			</div>
			
			<!-- Filter Dropdowns -->
			<div class="flex flex-wrap gap-2">
				<select bind:value={statusFilter} onchange={applyFilters} class="select">
					<option value="all">All Statuses</option>
					<option value="PENDING">Pending</option>
					<option value="IN_RESEARCH">In Research</option>
					<option value="BIDDING">Bidding</option>
					<option value="ACCEPTED">Accepted</option>
					<option value="SCHEDULED">Scheduled</option>
					<option value="IN_PROGRESS">In Progress</option>
					<option value="COMPLETED">Completed</option>
					<option value="CANCELLED">Cancelled</option>
				</select>
				
				<select bind:value={priorityFilter} onchange={applyFilters} class="select">
					<option value="all">All Priorities</option>
					<option value="URGENT">Urgent</option>
					<option value="HIGH">High</option>
					<option value="MEDIUM">Medium</option>
					<option value="LOW">Low</option>
				</select>
				
				<select bind:value={assignedToFilter} onchange={applyFilters} class="select">
					<option value="all">All Assignments</option>
					<option value="me">My Queue</option>
					<option value="unassigned">Unassigned</option>
				</select>
				
				{#if searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || assignedToFilter !== 'all'}
					<button class="btn variant-ghost-surface" onclick={clearFilters}>
						Clear Filters
					</button>
				{/if}
			</div>
			
			<!-- Saved Filters -->
			{#if savedFilters.length > 0}
				<div class="flex flex-wrap gap-2">
					<span class="text-sm font-semibold">Saved Filters:</span>
					{#each savedFilters as filter, i}
						<div class="chip variant-soft-primary flex items-center gap-2">
							<button
								class="flex-1"
								onclick={() => loadSavedFilter(filter)}
							>
								{filter.name}
							</button>
							<span
								class="cursor-pointer text-error-500 hover:text-error-600"
								onclick={(e) => {
									e.stopPropagation();
									deleteSavedFilter(i);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.stopPropagation();
										deleteSavedFilter(i);
									}
								}}
								role="button"
								tabindex="0"
							>
								×
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	
	<!-- Service Requests Table -->
	<div class="card">
		<div class="table-container">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>Priority</th>
						<th>Request Title</th>
						<th>Property / Owner</th>
						<th>Status</th>
						<th>Assigned To</th>
						<th>Created</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if data.serviceRequests.length === 0}
						<tr>
							<td colspan="7" class="text-center py-8">
								No service requests found matching your filters.
							</td>
						</tr>
					{:else}
						{#each data.serviceRequests as request}
							<tr>
								<td>
									<span class="{getPriorityClass(request.priority)}">
										{getPriorityEmoji(request.priority)} {request.priority}
									</span>
								</td>
								<td>
									<div class="font-semibold">{request.title}</div>
									<div class="text-xs text-surface-600-300-token">{request.category_display}</div>
								</td>
								<td>
									<div class="font-medium">
										{request.property_details.address}
									</div>
									<div class="text-xs text-surface-600-300-token">
										{request.created_by_details.first_name} {request.created_by_details.last_name}
									</div>
								</td>
								<td>
									<span class="{getStatusClass(request.status)}">
										{formatStatus(request.status)}
									</span>
								</td>
								<td>
									{#if request.assigned_to_details}
										<div class="text-sm">
											{request.assigned_to_details.first_name} {request.assigned_to_details.last_name}
										</div>
									{:else}
										<span class="text-surface-500-400-token text-sm">Unassigned</span>
									{/if}
								</td>
								<td class="text-sm">{formatDate(request.created_at)}</td>
								<td class="text-right">
									<a href="/staff/requests/{request.id}" class="btn btn-sm variant-ghost-primary">
										View
									</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
		
		<!-- Pagination -->
		{#if data.pagination.count > 0}
			<div class="p-4 flex justify-between items-center border-t border-surface-300-600-token">
				<div class="text-sm text-surface-600-300-token">
					Showing page {data.pagination.currentPage} of {Math.ceil(data.pagination.count / 20)}
					({data.pagination.count} total requests)
				</div>
				<div class="flex gap-2">
					<button
						class="btn btn-sm variant-ghost-surface"
						disabled={!data.pagination.previous}
						onclick={() => goToPage(data.pagination.currentPage - 1)}
					>
						<ChevronLeft class="h-4 w-4" />
						Previous
					</button>
					<button
						class="btn btn-sm variant-ghost-surface"
						disabled={!data.pagination.next}
						onclick={() => goToPage(data.pagination.currentPage + 1)}
					>
						Next
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Save Filter Modal -->
{#if showSaveFilterModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-backdrop" role="presentation" onclick={() => (showSaveFilterModal = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal card p-6 w-full max-w-md" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="h3 mb-4">Save Current Filters</h3>
			<input
				type="text"
				placeholder="Filter name (e.g., 'Urgent Unassigned')"
				bind:value={newFilterName}
				class="input mb-4"
			/>
			<div class="flex gap-2 justify-end">
				<button class="btn variant-ghost-surface" onclick={() => (showSaveFilterModal = false)}>
					Cancel
				</button>
				<button class="btn variant-filled-primary" onclick={saveCurrentFilters}>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	
	.modal {
		max-height: 90vh;
		overflow-y: auto;
	}
</style>
