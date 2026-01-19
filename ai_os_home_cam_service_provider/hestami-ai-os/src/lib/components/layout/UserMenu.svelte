<script lang="ts">
	import { ChevronDown, Settings, LogOut, Building2, Check, Plus } from 'lucide-svelte';
	import { signOut } from '$lib/auth-client';
	import RoleBadge from '$lib/components/ui/RoleBadge.svelte';
	import OrganizationBadge from '$lib/components/ui/OrganizationBadge.svelte';
	import { onMount } from 'svelte';
	import type { operations } from '$lib/api/types.generated';

	// Extract types from OpenAPI spec (avoids importing massive Prisma types)
	type Organization = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];

	interface OrganizationMembership {
		organization: any;
		role: string;
		isDefault: boolean;
	}

	interface Props {
		user: { id: string; email: string; name: string | null; image: string | null } | null;
		currentOrganization: OrganizationMembership | null;
		memberships: OrganizationMembership[];
	}

	let {
		user,
		currentOrganization,
		memberships = []
	}: Props = $props();

	// Safe memberships access for navigation transitions
	const safeMemberships = $derived(Array.isArray(memberships) ? memberships : []);

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

	const userInitial = $derived(user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?');
	const hasMultipleOrgs = $derived(safeMemberships.length > 1);
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleDropdown}
		class="btn preset-tonal-surface flex items-center gap-2"
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		{#if user?.image}
			<img src={user.image} alt="Avatar" class="h-6 w-6 rounded-full" />
		{:else}
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white">
			{userInitial}
		</div>
		{/if}
		<span class="hidden sm:inline max-w-24 truncate text-sm">
			{user?.name || user?.email || 'User'}
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
					<p class="font-medium">{user?.name || 'User'}</p>
					<p class="text-sm text-surface-500">{user?.email}</p>

					{#if currentOrganization}
						<div class="mt-2 flex items-center gap-2">
							<OrganizationBadge type={currentOrganization.organization.type} size="sm" />
							<RoleBadge role={currentOrganization.role} size="sm" />
						</div>
					{/if}
				</div>

				<!-- Organizations Section -->
				{#if safeMemberships.length > 0}
					<hr class="my-2 border-surface-300-700" />

					<p class="px-3 py-1 text-xs font-semibold uppercase text-surface-500">
						{hasMultipleOrgs ? 'Switch Organization' : 'Organization'}
					</p>

					{#each safeMemberships as membership}
						<form action="/api/organization/switch" method="POST" class="w-full">
							<input type="hidden" name="organizationId" value={membership.organization.id} />
							<button
								type="submit"
								disabled={membership.organization.id === currentOrganization?.organization.id}
								class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800 disabled:opacity-50 disabled:cursor-default"
							>
								<Building2 class="h-4 w-4 flex-shrink-0 text-surface-500" />
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="truncate text-sm font-medium">{membership.organization.name}</span>
										{#if membership.organization.id === currentOrganization?.organization.id}
											<Check class="h-4 w-4 text-success-500 flex-shrink-0" />
										{/if}
									</div>
								</div>
							</button>
						</form>
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
