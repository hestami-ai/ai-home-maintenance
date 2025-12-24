<script lang="ts">
	import type { Snippet } from 'svelte';
	import { organizationStore } from '$lib/stores';

	interface Props {
		roles?: string[];
		orgTypes?: string[];
		fallback?: Snippet;
		children: Snippet;
	}

	let { roles = [], orgTypes = [], fallback, children }: Props = $props();

	const hasAccess = $derived(() => {
		const current = $organizationStore.current;
		if (!current) return false;

		// Check role if specified
		if (roles.length > 0 && !roles.includes(current.role)) {
			return false;
		}

		// Check org type if specified
		if (orgTypes.length > 0 && !orgTypes.includes(current.organization.type)) {
			return false;
		}

		return true;
	});
</script>

{#if hasAccess()}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
