<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { communityOnboarding } from '$lib/stores';

	onMount(() => {
		communityOnboarding.reset();
		communityOnboarding.setStep(0);
		goto('/onboarding/community/type');
	});
</script>

<div class="flex items-center justify-center py-12">
	<p class="text-surface-500">Loading...</p>
</div>
