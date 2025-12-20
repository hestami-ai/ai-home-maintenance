<script lang="ts">
	import { Menu, X } from 'lucide-svelte';
	import Logo from '$lib/components/ui/Logo.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import UserMenu from './UserMenu.svelte';
	import { auth } from '$lib/stores';

	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<header class="preset-filled-surface-100-900 sticky top-0 z-50 border-b border-surface-300-700">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Left: Logo -->
			<div class="flex items-center">
				<Logo size="md" />
			</div>

			<!-- Right: Desktop Navigation -->
			<div class="hidden items-center gap-3 md:flex">
				<ThemeToggle />

				{#if $auth.isAuthenticated}
					<UserMenu />
				{:else if !$auth.isLoading}
					<a href="/login" class="btn btn-sm preset-tonal-surface">Log in</a>
					<a href="/register" class="btn btn-sm preset-filled-primary-500">Sign up</a>
				{/if}
			</div>

			<!-- Mobile menu button -->
			<div class="flex items-center gap-2 md:hidden">
				<ThemeToggle />
				<button
					type="button"
					onclick={toggleMobileMenu}
					class="btn btn-sm preset-tonal-surface"
					aria-label="Toggle menu"
				>
					{#if mobileMenuOpen}
						<X class="h-5 w-5" />
					{:else}
						<Menu class="h-5 w-5" />
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if mobileMenuOpen}
		<div class="border-t border-surface-300-700 md:hidden">
			<div class="space-y-2 px-4 py-4">
				{#if $auth.isAuthenticated}
					<!-- User Menu handles everything on mobile too -->
					<UserMenu />
				{:else if !$auth.isLoading}
					<a
						href="/login"
						onclick={closeMobileMenu}
						class="block rounded-md px-3 py-2 text-sm hover:bg-surface-200-800"
					>
						Log in
					</a>
					<a
						href="/register"
						onclick={closeMobileMenu}
						class="block rounded-md bg-primary-500 px-3 py-2 text-center text-sm font-medium text-white"
					>
						Sign up
					</a>
				{/if}
			</div>
		</div>
	{/if}
</header>
