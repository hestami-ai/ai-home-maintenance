<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/app/admin/work-queue');
	});
</script>

<div class="flex h-full items-center justify-center">
	<p class="text-surface-500">Redirecting to Work Queue...</p>
</div>
