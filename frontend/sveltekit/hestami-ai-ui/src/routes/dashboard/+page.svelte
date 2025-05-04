<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	// Import role-specific dashboard components
	import StaffDashboard from '$lib/components/dashboards/StaffDashboard.svelte';
	import OwnerDashboard from '$lib/components/dashboards/OwnerDashboard.svelte';
	import ProviderDashboard from '$lib/components/dashboards/ProviderDashboard.svelte';
	
	// Get user data from page store
	const user = $page.data.user;
	
	// For debugging
	let userDebugInfo = $state('');
	
	// Get the user role from the user data
	let userRole = $state('');
	
	// Map backend role to frontend role
	function mapUserRole(backendRole: string): string {
		const roleMap: Record<string, string> = {
			'PROPERTY_OWNER': 'owner',
			'SERVICE_PROVIDER': 'provider',
			'STAFF': 'staff'
		};
		
		return roleMap[backendRole] || 'unknown';
	}
	
	// Initialize role if user data is available
	if (user?.user_role) {
		userRole = mapUserRole(user.user_role);
	}
	
	// Process user role on mount for additional logging and debugging
	onMount(() => {
		console.log('User data:', user);
		
		if (user) {
			userDebugInfo = `User data found: ${JSON.stringify(user)}`;
			
			// Check if user_role exists
			if (user.user_role) {
				// Map the role using our helper function
				const mappedRole = mapUserRole(user.user_role);
				
				userDebugInfo += `\nRole mapping: ${user.user_role} -> ${mappedRole}`;
				
				// Update the role if needed
				if (mappedRole !== 'unknown') {
					userRole = mappedRole;
					userDebugInfo += `\nValid role found: ${mappedRole}`;
				} else {
					userDebugInfo += `\nInvalid role found: ${user.user_role}`;
				}
			} else {
				userDebugInfo += '\nNo user_role property found';
			}
		} else {
			userDebugInfo = 'No user data found';
		}
		
		console.log('Determined user role:', userRole);
	});
	
	// For development/testing purposes
	function switchRole(role: string) {
		userRole = role;
		console.log('Manually switched role to:', role);
	}
</script>

<div class="container mx-auto space-y-8 pb-8">
	<!-- Welcome Header -->
	<header class="space-y-2">
		<h1 class="h1">Dashboard</h1>
		<p class="text-surface-600-300-token">Welcome to your Hestami AI dashboard.</p>
	</header>
	
	<!-- Development Mode Toggle (only visible in development) -->
	{#if import.meta.env.DEV}
		<div class="card p-4 variant-soft-warning">
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h3 class="font-semibold">Development Mode</h3>
					<p class="text-sm">Current role: <span class="badge variant-filled">{userRole}</span></p>
					<details class="mt-2">
						<summary class="cursor-pointer text-sm font-medium">Debug Info</summary>
						<pre class="p-2 mt-2 bg-surface-900 text-white rounded-container-token text-xs whitespace-pre-wrap">{userDebugInfo}</pre>
					</details>
				</div>
				<div class="flex gap-2">
					<button 
						class="btn btn-sm {userRole === 'staff' ? 'variant-filled-primary' : 'variant-ghost-primary'}" 
						onclick={() => switchRole('staff')}
					>
						Staff
					</button>
					<button 
						class="btn btn-sm {userRole === 'owner' ? 'variant-filled-secondary' : 'variant-ghost-secondary'}" 
						onclick={() => switchRole('owner')}
					>
						Owner
					</button>
					<button 
						class="btn btn-sm {userRole === 'provider' ? 'variant-filled-tertiary' : 'variant-ghost-tertiary'}" 
						onclick={() => switchRole('provider')}
					>
						Provider
					</button>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Role-Specific Dashboard Content -->
	{#if userRole === 'staff'}
		<StaffDashboard />
	{:else if userRole === 'owner'}
		<OwnerDashboard />
	{:else if userRole === 'provider'}
		<ProviderDashboard />
	{:else}
		<!-- Fallback for unknown roles -->
		<div class="card p-6 text-center">
			<h2 class="h2 mb-4">Unknown User Role</h2>
			<p class="text-surface-600-300-token mb-4">We couldn't determine your user role. Please contact support for assistance.</p>
			<a href="/" class="btn variant-filled-primary">Return to Home</a>
		</div>
	{/if}
</div>
