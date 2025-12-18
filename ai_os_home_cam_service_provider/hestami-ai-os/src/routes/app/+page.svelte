<script lang="ts">
	import { organizationStore } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect to appropriate dashboard based on organization type
	onMount(() => {
		const current = $organizationStore.current;
		if (!current) {
			goto('/onboarding');
			return;
		}

		const orgType = current.organization.type;
		if (orgType === 'INDIVIDUAL_PROPERTY_OWNER' || orgType === 'TRUST_OR_LLC') {
			goto('/app/concierge');
		} else if (orgType === 'COMMUNITY_ASSOCIATION' || orgType === 'MANAGEMENT_COMPANY') {
			goto('/app/cam');
		} else if (orgType === 'SERVICE_PROVIDER') {
			goto('/app/contractor');
		} else {
			// Default to concierge for unknown types
			goto('/app/concierge');
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
	<p class="text-surface-500">Redirecting...</p>
</div>
