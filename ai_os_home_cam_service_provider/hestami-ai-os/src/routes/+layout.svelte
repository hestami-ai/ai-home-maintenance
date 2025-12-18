<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Header } from '$lib/components/layout';
	import { theme, auth, organizationStore } from '$lib/stores';
	import { organizationApi } from '$lib/api';
	import { onMount } from 'svelte';

	interface Props {
		data: {
			user: { id: string; email: string; name: string | null; emailVerified: boolean; image: string | null } | null;
			session: { id: string; userId: string; token: string; expiresAt: Date } | null;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	async function loadOrganizations() {
		if (!data.user) {
			organizationStore.clear();
			return;
		}

		organizationStore.setLoading(true);
		const result = await organizationApi.list();

		if (result.ok && result.data) {
			const memberships = result.data.organizations.map((org) => ({
				organization: {
					id: org.id,
					name: org.name,
					slug: org.slug,
					type: org.type,
					status: 'ACTIVE'
				},
				role: org.role,
				isDefault: org.isDefault
			}));
			organizationStore.setMemberships(memberships);
		} else {
			organizationStore.setLoading(false);
		}
	}

	onMount(() => {
		// Initialize theme
		theme.init();

		// Set auth state from server data
		if (data.user) {
			auth.setUser(data.user);
			loadOrganizations();
		} else {
			auth.clear();
			organizationStore.clear();
		}
	});

	// Update auth when data changes
	$effect(() => {
		if (data.user) {
			auth.setUser(data.user);
		} else {
			auth.clear();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Hestami AI</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-surface-50-950">
	<Header />
	<main class="flex-1">
		{@render children()}
	</main>
</div>
