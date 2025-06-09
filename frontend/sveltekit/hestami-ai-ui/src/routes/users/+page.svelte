<script lang="ts">
	import { page } from '$app/stores';
	import { Search, UserPlus } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { ApiUserResponse } from './+page.server';
	
	// Get data from server using runes syntax
	const data = $props();
	
	// Client-side state
	let users = $state<any[]>([]); // Using any[] to match whatever the API returns
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	
	// Get server users from data with detailed logging
	console.log('Raw data object:', data);
	console.log('Data properties:', Object.keys(data));
	
	// Fix the path to access the users array from the nested structure
	// The API seems to return users inside data.data.users based on the logs
	const serverUsers = data?.data?.users || data?.users || [];
	console.log('Server users type:', typeof serverUsers);
	console.log('Is server users an array?', Array.isArray(serverUsers));
	console.log('Server users length:', serverUsers?.length);
	
	// Simple state for filters
	let searchQuery = $state('');
	let roleFilter = $state('all');
	let statusFilter = $state('all');
	
	// Initialize data from server data only, no fallback to mock data
	// This ensures we're only using real data from the API
	users = serverUsers && serverUsers.length > 0 ? [...serverUsers] : [];

	// Set loading to false since we've initialized the data
	isLoading = false;

	// Add additional logging in onMount for debugging
	onMount(() => {
		// Use a function inside onMount to properly capture the current state
		const currentUsers = $state.snapshot(users);
		console.log('Component mounted, current users:', currentUsers);
		console.log('Users array length:', currentUsers.length);
	});
	
	// Filter users based on current filter settings
	let filteredUsers = $derived(getFilteredUsers());
	
	// Function to filter users based on criteria
	function getFilteredUsers(): any[] {
		// Add debug logging to track filtering using $state.snapshot for reactive variables
		console.log(`Filtering ${users.length} users with criteria:`, { 
			searchQuery: $state.snapshot(searchQuery), 
			roleFilter: $state.snapshot(roleFilter), 
			statusFilter: $state.snapshot(statusFilter) 
		});
		
		// Return filtered users
		return users.filter((user: any) => {
			// Apply search filter - handle potential different field names
			const userName = user.name || user.full_name || user.username || '';
			const userEmail = user.email || '';
			const matchesSearch = searchQuery === '' || 
				(userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
				userEmail.toLowerCase().includes(searchQuery.toLowerCase()));
			
			// Apply role filter - handle potential different field names
			const userRole = user.role || user.user_role || '';
			const matchesRole = roleFilter === 'all' || userRole === roleFilter;
			
			// Apply status filter - handle potential different field names
			const userStatus = user.status || user.is_active ? 'active' : 'inactive';
			const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;
			
			return matchesSearch && matchesRole && matchesStatus;
		});
	}
	
	// Format date for display
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Never';
		
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}
	
	// Format role for display
	function formatRole(role: string): string {
		return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
	
	// Get status badge class
	function getStatusClass(status: string): string {
		return status === 'active' ? 'badge-success' : 'badge-error';
	}
</script>

<div class="container mx-auto p-4 space-y-6">
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h1">Users</h1>
			<p class="text-surface-600-300-token">Manage system users and their permissions</p>
		</div>
		<button class="btn variant-filled-primary">
			<UserPlus class="h-5 w-5 mr-2" />
			Add User
		</button>
	</header>
	
	<!-- Filters -->
	<div class="card p-4">
		<div class="flex flex-col md:flex-row gap-4">
			<!-- Search -->
			<div class="input-group input-group-divider grid-cols-[auto_1fr_auto] w-full md:w-1/3">
				<div class="input-group-shim">
					<Search class="h-4 w-4" />
				</div>
				<input
					type="text"
					placeholder="Search users..."
					bind:value={searchQuery}
					class="input"
				/>
			</div>
			
			<!-- Filter Dropdowns -->
			<div class="flex flex-wrap gap-2">
				<select bind:value={roleFilter} class="select">
					<option value="all">All Roles</option>
					<option value="PROPERTY_OWNER">Property Owner</option>
					<option value="SERVICE_PROVIDER">Service Provider</option>
					<option value="STAFF">Staff</option>
				</select>
				
				<select bind:value={statusFilter} class="select">
					<option value="all">All Statuses</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
			</div>
		</div>
	</div>
	
	<!-- Loading state -->
	{#if isLoading}
		<div class="card p-4 text-center">
			<div class="placeholder-circle animate-pulse mx-auto mb-4"></div>
			<p>Loading users...</p>
		</div>
	
	<!-- Error state -->
	{:else if error}
		<div class="card p-4">
			<div class="alert variant-filled-error">
				<p>Error loading users: {error}</p>
			</div>
			
			<!-- Show fallback data if available -->
			{#if users.length > 0}
				<p class="mt-4 mb-2 text-sm">Showing fallback data:</p>
			{/if}
		</div>
	
	<!-- Users Table -->
	{:else}
		<div class="card">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Role</th>
						<th>Status</th>
						<th>Last Login</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if filteredUsers.length === 0}
						<tr>
							<td colspan="6" class="text-center py-4">
								{users.length === 0 ? 'No users found.' : 'No users match your filters.'}
							</td>
						</tr>
					{:else}
						{#each filteredUsers as user}
							<tr>
								<td>{user.name || user.full_name || user.username || 'Unknown'}</td>
								<td>{user.email || 'No email'}</td>
								<td>{formatRole(user.role || user.user_role || 'unknown')}</td>
								<td>
									<span class="badge {getStatusClass(user.status || (user.is_active ? 'active' : 'inactive'))}">
										{(user.status || (user.is_active ? 'active' : 'inactive')).charAt(0).toUpperCase() + (user.status || (user.is_active ? 'active' : 'inactive')).slice(1)}
									</span>
								</td>
								<td>{formatDate(user.lastLogin || user.last_login)}</td>
								<td class="text-right">
									<div class="flex justify-end gap-2">
										<button class="btn btn-sm variant-soft">Edit</button>
										<button class="btn btn-sm variant-soft-error">Deactivate</button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>
