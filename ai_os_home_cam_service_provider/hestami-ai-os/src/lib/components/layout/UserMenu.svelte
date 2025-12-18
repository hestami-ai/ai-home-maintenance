<script lang="ts">
	import { ChevronDown, User, Settings, LogOut } from 'lucide-svelte';
	import { auth, organizationStore } from '$lib/stores';
	import { signOut } from '$lib/auth-client';
	import RoleBadge from '$lib/components/ui/RoleBadge.svelte';
	import { onMount } from 'svelte';

	let isOpen = $state(false);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	async function handleSignOut() {
		closeDropdown();
		await signOut();
		auth.clear();
		organizationStore.clear();
		window.location.href = '/login';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (isOpen && event.key === 'Escape') {
			closeDropdown();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	const userInitial = $derived($auth.user?.name?.charAt(0).toUpperCase() || $auth.user?.email?.charAt(0).toUpperCase() || '?');
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleDropdown}
		class="btn preset-tonal-surface flex items-center gap-2"
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		{#if $auth.user?.image}
			<img src={$auth.user.image} alt="Avatar" class="h-6 w-6 rounded-full" />
		{:else}
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white">
				{userInitial}
			</div>
		{/if}
		<span class="hidden sm:inline max-w-24 truncate text-sm">
			{$auth.user?.name || $auth.user?.email || 'User'}
		</span>
		<ChevronDown class="h-4 w-4 transition-transform {isOpen ? 'rotate-180' : ''}" />
	</button>

	{#if isOpen}
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 z-40"
			onclick={closeDropdown}
			aria-label="Close menu"
		></button>

		<!-- Dropdown -->
		<div
			class="preset-outlined-surface-200-800 absolute right-0 z-50 mt-2 w-64 rounded-lg bg-surface-100-900 shadow-xl"
		>
			<div class="p-2">
				<!-- User Info -->
				<div class="px-3 py-2">
					<p class="font-medium">{$auth.user?.name || 'User'}</p>
					<p class="text-sm text-surface-500">{$auth.user?.email}</p>
					{#if $organizationStore.current}
						<div class="mt-2">
							<RoleBadge role={$organizationStore.current.role} size="sm" />
						</div>
					{/if}
				</div>

				<hr class="my-2 border-surface-300-700" />

				<!-- Menu Items -->
				<a
					href="/app/settings"
					onclick={closeDropdown}
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
				>
					<Settings class="h-4 w-4" />
					<span class="text-sm">Settings</span>
				</a>

				<button
					type="button"
					onclick={handleSignOut}
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-error-500 transition-colors hover:bg-surface-200-800"
				>
					<LogOut class="h-4 w-4" />
					<span class="text-sm">Sign out</span>
				</button>
			</div>
		</div>
	{/if}
</div>
