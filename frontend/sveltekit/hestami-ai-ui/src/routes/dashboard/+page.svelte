<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	// Import role-specific dashboard components
	import StaffDashboard from '$lib/components/dashboards/StaffDashboard.svelte';
	import OwnerDashboard from '$lib/components/dashboards/OwnerDashboard.svelte';
	import ProviderDashboard from '$lib/components/dashboards/ProviderDashboard.svelte';
	
	// Import ServiceRequest type
	import type { ServiceRequest } from '$lib/types';
	
	// Get data from page store
	const user = $page.data.user;
	const properties = $page.data.properties || [];
	const serviceRequests = $page.data.serviceRequests || [];
	
	// Define interfaces for dashboard component props
	interface OwnerStats {
		totalProperties: number;
		activeRequests: number;
		completedServices: number;
		scheduledServices: number;
	}
	
	interface StaffDashboardStats {
		total_users: number;
		active_providers: number;
		pending_requests: number;
	}
	
	// Initialize props with proper typing
	const ownerStats: OwnerStats = $page.data.ownerStats || { 
		totalProperties: 0, 
		activeRequests: 0, 
		completedServices: 0, 
		scheduledServices: 0 
	};
	
	const recentRequests: (ServiceRequest & { propertyTitle: string })[] = $page.data.recentRequests || [];
	
	// Initialize staffStats with proper typing
	// Log the raw data from the API for debugging
	console.log('Raw staffStats from API:', $page.data.staffStats);
	
	const staffStats: StaffDashboardStats = $page.data.staffStats || {
		total_users: 0,
		active_providers: 0,
		pending_requests: 0
	};
	
	// Log the processed staffStats for debugging
	console.log('Processed staffStats:', staffStats);
	
	// For debugging
	let userDebugInfo = $state('');
	
	// Get the user role from the user data
	let userRole = $state('');
	
	// Dynamic title based on role
	const pageTitle = $derived(
		userRole === 'staff' 
			? 'Staff Dashboard'
			: userRole === 'provider'
			? 'Provider Dashboard'
			: 'Dashboard'
	);
	
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
		
	});
	
	// For development/testing purposes
	function switchRole(role: string) {
		userRole = role;
	}
</script>

<svelte:head>
	<title>{pageTitle} - Hestami AI</title>
	<meta name="description" content="Your personalized dashboard" />
</svelte:head>

<div class="container mx-auto space-y-8 pb-8">
	<!-- Welcome Header -->
	<header class="space-y-2">
		<h1 class="h1">Dashboard</h1>
		<p class="text-surface-600-300-token">Welcome to your Hestami AI dashboard.</p>
	</header>
	
	
	<!-- Role-Specific Dashboard Content -->
	{#if userRole === 'staff'}
		<StaffDashboard {staffStats} />
	{:else if userRole === 'owner'}
		<OwnerDashboard {ownerStats} {recentRequests} />
	{:else if userRole === 'provider'}
		<ProviderDashboard /><!-- ProviderDashboard handles its own data fetching internally -->
	{:else}
		<!-- Fallback for unknown roles -->
		<div class="card p-6 text-center">
			<h2 class="h2 mb-4">Unknown User Role</h2>
			<p class="text-surface-600-300-token mb-4">We couldn't determine your user role. Please contact support for assistance.</p>
			<a href="/" class="btn variant-filled-primary">Return to Home</a>
		</div>
	{/if}
</div>
