<script lang="ts">
	import { ChevronDown, Building2, Plus, Check } from 'lucide-svelte';
	import { organizationStore, type OrganizationMembership } from '$lib/stores';
	import OrganizationBadge from '$lib/components/ui/OrganizationBadge.svelte';
	import RoleBadge from '$lib/components/ui/RoleBadge.svelte';
	import { onMount } from 'svelte';

	let isOpen = $state(false);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	async function switchOrganization(membership: OrganizationMembership) {
		if (membership.organization.id === $organizationStore.current?.organization.id) {
			closeDropdown();
			return;
		}

		// TODO: Call API to set default organization
		// TODO: Show confirmation modal
		// TODO: Record activity event
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
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleDropdown}
		class="btn preset-tonal-surface flex items-center gap-2"
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		<Building2 class="h-4 w-4" />
		<span class="max-w-32 truncate text-sm font-medium">
			{$organizationStore.current?.organization.name || 'Select Organization'}
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
				<p class="px-3 py-2 text-xs font-semibold uppercase text-surface-500">Your Organizations</p>

				{#each $organizationStore.memberships as membership}
					<button
						type="button"
						onclick={() => switchOrganization(membership)}
						class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
					>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="truncate font-medium">{membership.organization.name}</span>
								{#if membership.organization.id === $organizationStore.current?.organization.id}
									<Check class="h-4 w-4 text-success-500 flex-shrink-0" />
								{/if}
							</div>
							<div class="mt-1 flex items-center gap-2">
								<OrganizationBadge type={membership.organization.type} size="sm" />
								<RoleBadge role={membership.role} size="sm" />
							</div>
						</div>
					</button>
				{/each}

				{#if $organizationStore.memberships.length === 0}
					<p class="px-3 py-4 text-center text-sm text-surface-500">No organizations yet</p>
				{/if}

				<hr class="my-2 border-surface-300-700" />

				<a
					href="/onboarding"
					onclick={closeDropdown}
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
				>
					<Plus class="h-4 w-4" />
					<span class="text-sm font-medium">Add Organization</span>
				</a>
			</div>
		</div>
	{/if}
</div>
