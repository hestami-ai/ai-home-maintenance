<script lang="ts">
	import AppShell from '$lib/layouts/AppShell.svelte';
	import { page } from '$app/stores';
	
	// User data is available from the server load function
	const userData = $page.data.user || null;
</script>

<AppShell user={userData}>
	<slot></slot>
</AppShell>
