<script lang="ts">
	import { ChevronDown, Settings, LogOut, Building2, Check, Plus } from 'lucide-svelte';
	import { auth, organizationStore, type OrganizationMembership } from '$lib/stores';
	import { signOut } from '$lib/auth-client';
	import RoleBadge from '$lib/components/ui/RoleBadge.svelte';
	import OrganizationBadge from '$lib/components/ui/OrganizationBadge.svelte';
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

	async function switchOrganization(membership: OrganizationMembership) {
		if (membership.organization.id === $organizationStore.current?.organization.id) {
			closeDropdown();
			return;
		}

		organizationStore.setCurrent(membership);
		closeDropdown();

		// Redirect based on org type
		const orgType = membership.organization.type;
		let redirectPath = '/app';
		if (orgType === 'INDIVIDUAL_PROPERTY_OWNER' || orgType === 'TRUST_OR_LLC') {
			redirectPath = '/app/concierge';
		} else if (orgType === 'COMMUNITY_ASSOCIATION' || orgType === 'MANAGEMENT_COMPANY') {
			redirectPath = '/app/cam';
		} else if (orgType === 'SERVICE_PROVIDER') {
			redirectPath = '/app/contractor';
		}

		window.location.href = redirectPath;
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
	const hasMultipleOrgs = $derived($organizationStore.memberships.length > 1);
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
			class="preset-outlined-surface-200-800 absolute right-0 z-50 mt-2 w-72 rounded-lg bg-surface-100-900 shadow-xl"
		>
			<div class="p-2">
				<!-- User Info -->
				<div class="px-3 py-2">
					<p class="font-medium">{$auth.user?.name || 'User'}</p>
					<p class="text-sm text-surface-500">{$auth.user?.email}</p>
					{#if $organizationStore.current}
						<div class="mt-2 flex items-center gap-2">
							<OrganizationBadge type={$organizationStore.current.organization.type} size="sm" />
							<RoleBadge role={$organizationStore.current.role} size="sm" />
						</div>
					{/if}
				</div>

				<!-- Organizations Section -->
				{#if $organizationStore.memberships.length > 0}
					<hr class="my-2 border-surface-300-700" />

					<p class="px-3 py-1 text-xs font-semibold uppercase text-surface-500">
						{hasMultipleOrgs ? 'Switch Organization' : 'Organization'}
					</p>

					{#each $organizationStore.memberships as membership}
						<button
							type="button"
							onclick={() => switchOrganization(membership)}
							class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
						>
							<Building2 class="h-4 w-4 flex-shrink-0 text-surface-500" />
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-medium">{membership.organization.name}</span>
									{#if membership.organization.id === $organizationStore.current?.organization.id}
										<Check class="h-4 w-4 text-success-500 flex-shrink-0" />
									{/if}
								</div>
							</div>
						</button>
					{/each}

					<a
						href="/onboarding"
						onclick={closeDropdown}
						class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
					>
						<Plus class="h-4 w-4 text-surface-500" />
						<span class="text-sm">Add Organization</span>
					</a>
				{/if}

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
