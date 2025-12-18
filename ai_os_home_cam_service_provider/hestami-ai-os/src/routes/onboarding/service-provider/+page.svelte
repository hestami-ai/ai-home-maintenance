<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { serviceProviderOnboarding } from '$lib/stores';

	onMount(() => {
		serviceProviderOnboarding.reset();
		serviceProviderOnboarding.setStep(0);
		goto('/onboarding/service-provider/details');
	});
</script>

<div class="flex items-center justify-center py-12">
	<p class="text-surface-500">Loading...</p>
</div>
