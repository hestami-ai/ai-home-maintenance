<script lang="ts">
	import AppShell from '$lib/layouts/AppShell.svelte';
	import { page } from '$app/stores';
	import type { User } from '$lib/types';
	
	// User data is available from the server load function
	// Use the centralized User type from $lib/types.ts
	const userData: User | null = $page.data.user || null;
</script>

<AppShell user={userData}>
	<slot></slot>
</AppShell>
