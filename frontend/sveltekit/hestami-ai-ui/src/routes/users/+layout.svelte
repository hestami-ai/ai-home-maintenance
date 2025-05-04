<script lang="ts">
	import AppShell from '$lib/layouts/AppShell.svelte';
	import { page } from '$app/stores';
	
	// Define user data interface to match AppShell's expectations
	interface UserData {
		first_name?: string;
		last_name?: string;
		user_role?: string;
		[key: string]: any;
	}
	
	// User data is available from the server load function
	// Ensure it's properly typed as UserData | null
	const userData: UserData | null = $page.data.user || null;
</script>

<AppShell user={userData}>
	<slot></slot>
</AppShell>
