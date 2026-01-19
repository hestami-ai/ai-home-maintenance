<script lang="ts">
	import './layout.css';
	import { Header } from '$lib/components/layout';
	import { theme, organizationStore } from '$lib/stores';
	import { logger } from '$lib/logger';
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import type { Organization, Staff } from '$lib/api/cam';

	const log = logger.child({ component: 'Layout' });

	interface Props {
		data: {
			user: { id: string; email: string; name: string | null; emailVerified: boolean; image: string | null } | null;
			session: { id: string; userId: string; token: string; expiresAt: Date } | null;
			organization: Organization | null;
			memberships: Array<{
				organization: Organization;
				role: string;
				isDefault: boolean;
			}>;
			staff: Staff | null;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Navigation tracing for debugging SPA navigation issues
	if (browser) {
		beforeNavigate(({ from, to, type }) => {
			// Use untrack to avoid triggering proxy access during logging
			const currentData = untrack(() => data);
			log.debug('[NAVIGATION-TRACE] beforeNavigate', {
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
			// Use untrack to avoid triggering proxy access during logging
			const currentData = untrack(() => data);
			log.debug('[NAVIGATION-TRACE] afterNavigate', {
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

	// Buffer the data to prevent proxy errors during navigation transitions
	// Initialize with empty/null values, then sync when data is available
	let user = $state<Props['data']['user']>(null);
	let memberships = $state<Props['data']['memberships']>([]);
	let currentOrganization = $state<Props['data']['organization']>(null);
	let staff = $state<Props['data']['staff']>(null);

	// Sync buffered state from data prop when available
	// Track data to trigger re-runs on navigation, but guard against undefined
	$effect(() => {
		if (data != null && typeof data === 'object') {
			user = data.user ?? null;
			memberships = data.memberships ?? [];
			currentOrganization = data.organization ?? null;
			staff = data.staff ?? null;
		}
	});

	// Initialize organization store from SSR data
	// This ensures the oRPC client has access to organization context for API calls
	$effect(() => {
		if (browser && memberships.length > 0) {
			organizationStore.setMemberships(memberships);
			log.debug('Organization store initialized', { 
				membershipsCount: memberships.length,
				currentOrgId: currentOrganization?.id 
			});
		}
	});

	onMount(() => {
		// Initialize theme - this is the ONLY acceptable client-side store
		theme.init();
	});
</script>

<svelte:head>
	<title>Hestami AI</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-surface-50-950">
	<Header 
		user={user} 
		memberships={memberships}
		currentOrganization={currentOrganization}
		staff={staff}
	/>
	<main class="flex-1">
		{@render children()}
	</main>
</div>
