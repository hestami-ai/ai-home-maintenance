<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { logger } from '$lib/logger';
	import { beforeNavigate, afterNavigate } from '$app/navigation';

	const log = logger.child({ component: 'AppLayout' });

	interface Props {
		data: {
			session: any;
			memberships: any[];
			organization: any;
			staff: any;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Navigation tracing for debugging SPA navigation issues
	// Use untrack to avoid proxy errors when data is undefined during navigation
	if (browser) {
		beforeNavigate(({ from, to, type }) => {
			const currentData = untrack(() => data);
			log.debug('[NAVIGATION-TRACE] AppLayout beforeNavigate', {
				from: from?.url?.pathname,
				to: to?.url?.pathname,
				type,
				dataType: typeof currentData,
				dataIsNull: currentData === null,
				dataIsUndefined: currentData === undefined,
				dataKeys: currentData != null && typeof currentData === 'object' ? Object.keys(currentData) : 'N/A'
			});
		});

		afterNavigate(({ from, to, type }) => {
			const currentData = untrack(() => data);
			log.debug('[NAVIGATION-TRACE] AppLayout afterNavigate', {
				from: from?.url?.pathname,
				to: to?.url?.pathname,
				type,
				dataType: typeof currentData,
				dataIsNull: currentData === null,
				dataIsUndefined: currentData === undefined,
				dataKeys: currentData != null && typeof currentData === 'object' ? Object.keys(currentData) : 'N/A'
			});
		});
	}

	// Note: Authentication is enforced server-side in +layout.server.ts
	// Data is passed via SSR - no client-side store loading needed
</script>

{@render children()}
