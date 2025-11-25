<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	
	// Function to redirect to login page
	function goToLogin() {
		goto(`/login?returnUrl=${encodeURIComponent('/properties')}`);
	}
</script>

<div class="flex flex-col min-h-screen">
	<!-- App Bar -->
	<AppBar background="bg-surface-100-800-token" border="border-b border-surface-300-600-token">
		{#snippet lead()}
			<a href="/" class="flex items-center gap-2">
				<img src="/logo.svg" alt="Logo" class="w-8 h-8" />
				<h1 class="h3">Hestami AI</h1>
			</a>
		{/snippet}
	</AppBar>
	
	<!-- Error Content -->
	<div class="flex-1 container mx-auto flex items-center justify-center p-4">
		<div class="card p-8 w-full max-w-md bg-surface-50-900-token text-center">
			<header class="mb-8">
				<h2 class="h2">Error {$page.status}</h2>
				<p class="text-surface-600-300-token">
					{#if $page.status === 401 || $page.error?.message?.includes('Authentication')}
						You need to be logged in to view your properties
					{:else}
						{$page.error?.message || 'An error occurred while loading properties'}
					{/if}
				</p>
			</header>
			
			<div class="space-y-4">
				{#if $page.status === 401 || $page.error?.message?.includes('Authentication')}
					<button class="btn preset-filled-primary w-full" onclick={goToLogin}>
						Log In
					</button>
				{:else}
					<button class="btn preset-filled-secondary w-full" onclick={() => window.location.reload()}>
						Try Again
					</button>
				{/if}
				
				<a href="/" class="btn preset-outline w-full">
					Return to Home
				</a>
			</div>
		</div>
	</div>
	
	<!-- Footer -->
	<footer class="py-4 text-center text-surface-600-300-token">
		<p>© 2025 Hestami AI. All rights reserved.</p>
	</footer>
</div>
