<script lang="ts">
	import { organizationStore } from '$lib/stores';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// Note: Authentication is enforced server-side in +layout.server.ts
	// This layout only needs to wait for organization data to load
</script>

{#if $organizationStore.isLoading}
	<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
		<div class="text-center">
			<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary-500" />
			<p class="mt-2 text-sm text-surface-500">Loading...</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
