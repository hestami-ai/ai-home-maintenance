<script lang="ts">
	import { auth, organizationStore } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		// Wait for auth to load, then check if authenticated
		const checkAuth = () => {
			if (!$auth.isLoading && !$auth.isAuthenticated) {
				goto('/login');
			}
		};

		// Check immediately and also when auth state changes
		checkAuth();
	});

	// Redirect to onboarding if no organizations
	$effect(() => {
		if (!$auth.isLoading && $auth.isAuthenticated && !$organizationStore.isLoading) {
			if ($organizationStore.memberships.length === 0) {
				goto('/onboarding');
			}
		}
	});
</script>

{#if $auth.isLoading || $organizationStore.isLoading}
	<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
		<div class="text-center">
			<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary-500" />
			<p class="mt-2 text-sm text-surface-500">Loading...</p>
		</div>
	</div>
{:else if $auth.isAuthenticated}
	{@render children()}
{/if}
