<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { propertyOwnerOnboarding } from '$lib/stores';

	onMount(() => {
		// Reset and redirect to first step
		propertyOwnerOnboarding.reset();
		propertyOwnerOnboarding.setStep(0);
		goto('/onboarding/property-owner/type');
	});
</script>

<div class="flex items-center justify-center py-12">
	<p class="text-surface-500">Loading...</p>
</div>
