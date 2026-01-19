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

	// Buffer the data to prevent proxy errors during navigation transitions
	// Initialize with empty/null values, then sync when data is available
	let associations = $state<Association[]>([]);
	let currentAssociation = $state<Association | null>(null);
	let badgeCounts = $state<BadgeCounts>({ violations: 0, arcRequests: 0, workOrders: 0 });

	// Sync buffered state from data prop when available
	// Track data to trigger re-runs on navigation, but guard against undefined
	$effect(() => {
		if (data != null && typeof data === 'object') {
			associations = data.associations ?? [];
			currentAssociation = data.currentAssociation ?? null;
			badgeCounts = data.badgeCounts ?? { violations: 0, arcRequests: 0, workOrders: 0 };
		}
	});

	// Routes that should always render children even without a current association
	const alwaysRenderRoutes = ['/app/cam/associations'];
	const shouldAlwaysRender = $derived(
		alwaysRenderRoutes.some(route => $page.url.pathname.startsWith(route))
	);

	// Make CAM state available to deep children via context if needed to avoid prop drilling
	setContext('cam-state', {
		get currentAssociation() {
			return currentAssociation;
		},
		get associations() {
			return associations;
		},
		get badgeCounts() {
			return badgeCounts;
		}
	});

	// Legacy Support: Sync to camStore for children that haven't been refactored yet
	// TODO: Remove in Phase 5.4 when all children are migrated
	import { camStore } from '$lib/stores';
	import { associationStore } from '$lib/stores/association';
	$effect(() => {
		if (associations.length > 0) {
			camStore.setAssociations(associations);
			// Also sync to associationStore so oRPC client sends correct X-Assoc-Id header
			associationStore.setAssociations(associations as any);
		}
		if (currentAssociation) {
			camStore.setCurrentAssociation(currentAssociation);
			// Also sync to associationStore so oRPC client sends correct X-Assoc-Id header
			associationStore.setCurrent(currentAssociation as any);
		}
		if (badgeCounts) {
			camStore.setBadgeCounts(badgeCounts);
		}
	});
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<CamSidebar badgeCounts={badgeCounts} />

	<div class="flex flex-1 flex-col overflow-hidden">
		{#if !currentAssociation && !shouldAlwaysRender}
			{#if associations.length > 0}
				<!-- Should theoretically not happen if load function defaults correctly, but handle anyway -->
				<div class="flex flex-1 items-center justify-center">
					<div class="max-w-md text-center">
						<h2 class="text-xl font-semibold">Select an Association</h2>
						<p class="mt-2 text-surface-500">Please select an association to continue.</p>
						<div class="mx-auto mt-4 max-w-xs">
							<AssociationSelector
								associations={associations}
								currentAssociation={currentAssociation}
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
							associations={associations}
							currentAssociation={currentAssociation}
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
