<script lang="ts">
	import { setContext } from 'svelte';
	import { page } from '$app/stores';
	import { CamSidebar, AssociationSelector } from '$lib/components/cam';
	import { Loader2 } from 'lucide-svelte';

	interface Association {
		id: string;
		name: string;
		legalName?: string;
		status: string;
		fiscalYearEnd: number;
	}

	interface BadgeCounts {
		violations: number;
		arcRequests: number;
		workOrders: number;
	}

	interface Props {
		data: {
			associations: Association[];
			currentAssociation: Association | null;
			badgeCounts: BadgeCounts;
		};
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	// Routes that should always render children even without a current association
	const alwaysRenderRoutes = ['/app/cam/associations'];
	const shouldAlwaysRender = $derived(
		alwaysRenderRoutes.some(route => $page.url.pathname.startsWith(route))
	);

	// Make CAM state available to deep children via context if needed to avoid prop drilling
	setContext('cam-state', {
		get currentAssociation() {
			return data.currentAssociation;
		},
		get associations() {
			return data.associations;
		},
		get badgeCounts() {
			return data.badgeCounts;
		}
	});

	// Legacy Support: Sync to camStore for children that haven't been refactored yet
	// TODO: Remove in Phase 5.4 when all children are migrated
	import { camStore } from '$lib/stores';
	$effect(() => {
		if (data.associations) {
			camStore.setAssociations(data.associations);
		}
		if (data.currentAssociation) {
			camStore.setCurrentAssociation(data.currentAssociation);
		}
		if (data.badgeCounts) {
			camStore.setBadgeCounts(data.badgeCounts);
		}
	});
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<CamSidebar badgeCounts={data.badgeCounts} />

	<div class="flex flex-1 flex-col overflow-hidden">
		{#if !data.currentAssociation && !shouldAlwaysRender}
			{#if data.associations.length > 0}
				<!-- Should theoretically not happen if load function defaults correctly, but handle anyway -->
				<div class="flex flex-1 items-center justify-center">
					<div class="max-w-md text-center">
						<h2 class="text-xl font-semibold">Select an Association</h2>
						<p class="mt-2 text-surface-500">Please select an association to continue.</p>
						<div class="mx-auto mt-4 max-w-xs">
							<AssociationSelector
								associations={data.associations}
								currentAssociation={data.currentAssociation}
							/>
						</div>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<div class="max-w-md text-center">
						<h2 class="text-xl font-semibold">No Associations Found</h2>
						<p class="mt-2 text-surface-500">
							You don't have access to any associations yet.
						</p>
					</div>
				</div>
			{/if}
		{:else}
			<div class="border-b border-surface-300-700 bg-surface-50-950 px-4 py-3">
				<div class="flex items-center justify-between">
					<div class="max-w-xs">
						<AssociationSelector
							associations={data.associations}
							currentAssociation={data.currentAssociation}
						/>
					</div>
				</div>
			</div>

			<main class="flex-1 overflow-auto bg-surface-100-900">
				{@render children()}
			</main>
		{/if}
	</div>
</div>
