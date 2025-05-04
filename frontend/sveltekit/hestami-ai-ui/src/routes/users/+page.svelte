<script lang="ts">
	import { page } from '$app/stores';
	import { Plus, Search, UserPlus } from 'lucide-svelte';
	
	// Mock user data
	interface User {
		id: string;
		name: string;
		email: string;
		role: string;
		status: 'active' | 'inactive';
		lastLogin: string;
	}
	
	// Sample data
	let users = $state<User[]>([
		{
			id: '1',
			name: 'John Doe',
			email: 'john.doe@example.com',
			role: 'PROPERTY_OWNER',
			status: 'active',
			lastLogin: '2025-04-30T10:15:00Z'
		},
		{
			id: '2',
			name: 'Jane Smith',
			email: 'jane.smith@example.com',
			role: 'SERVICE_PROVIDER',
			status: 'active',
			lastLogin: '2025-04-29T14:30:00Z'
		},
		{
			id: '3',
			name: 'Robert Johnson',
			email: 'robert.johnson@example.com',
			role: 'STAFF',
			status: 'active',
			lastLogin: '2025-04-30T09:45:00Z'
		},
		{
			id: '4',
			name: 'Emily Davis',
			email: 'emily.davis@example.com',
			role: 'PROPERTY_OWNER',
			status: 'inactive',
			lastLogin: '2025-04-15T11:20:00Z'
		}
	]);
	
	// Filter state
	let searchQuery = $state('');
	let roleFilter = $state('all');
	let statusFilter = $state('all');
	
	// Format date for display
	function formatDate(dateString: string): string {
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
	
	<!-- Users Table -->
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
				{#each users as user}
					<tr>
						<td>{user.name}</td>
						<td>{user.email}</td>
						<td>{formatRole(user.role)}</td>
						<td>
							<span class="badge {getStatusClass(user.status)}">
								{user.status.charAt(0).toUpperCase() + user.status.slice(1)}
							</span>
						</td>
						<td>{formatDate(user.lastLogin)}</td>
						<td class="text-right">
							<div class="flex justify-end gap-2">
								<button class="btn btn-sm variant-soft">Edit</button>
								<button class="btn btn-sm variant-soft-error">Deactivate</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
