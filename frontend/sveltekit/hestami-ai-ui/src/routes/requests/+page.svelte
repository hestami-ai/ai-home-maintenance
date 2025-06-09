<script lang="ts">
	import { page } from '$app/stores';
	import type { ServiceRequest, User } from '$lib/types';
	import OwnerRequestsView from '$lib/components/requests/OwnerRequestsView.svelte';
	import StaffRequestsView from '$lib/components/requests/StaffRequestsView.svelte';
	import ProviderRequestsView from '$lib/components/requests/ProviderRequestsView.svelte';

export let data: {
	properties?: any[];
	serviceRequests?: ServiceRequest[];
	user: User;
	error: string | null;
};

// Determine user role
$: userRole = data.user?.user_role || 'PROPERTY_OWNER';


</script>

<div class="container mx-auto p-4 space-y-6">
	{#if userRole === 'PROPERTY_OWNER'}
		<OwnerRequestsView 
			properties={data.properties || []} 
			serviceRequests={data.serviceRequests || []} 
			error={data.error} 
		/>
	{:else if userRole === 'STAFF'}
		<StaffRequestsView 
			serviceRequests={data.serviceRequests || []} 
			error={data.error} 
		/>
	{:else if userRole === 'SERVICE_PROVIDER'}
		<ProviderRequestsView 
			serviceRequests={data.serviceRequests || []} 
			error={data.error} 
		/>
	{:else}
		<div class="card p-4 text-center">
			<p class="text-error-500">Unknown user role: {userRole}</p>
		</div>
	{/if}
</div>
