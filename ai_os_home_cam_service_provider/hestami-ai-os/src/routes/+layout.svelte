<script lang="ts">
	import './layout.css';
	import { Header } from '$lib/components/layout';
	import { theme } from '$lib/stores';
	import { logger } from '$lib/logger';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Organization, Staff } from '../../generated/prisma/client';

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
		user={data.user} 
		memberships={data.memberships}
		currentOrganization={data.organization}
	/>
	<main class="flex-1">
		{@render children()}
	</main>
</div>
