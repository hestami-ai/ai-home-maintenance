<script lang="ts">
	import { onMount } from 'svelte';
	import { Loader2 } from 'lucide-svelte';
	import { CamSidebar, AssociationSelector } from '$lib/components/cam';
	import { camStore, isCamLoading, currentAssociation, organizationStore, registerBadgeCountRefresh } from '$lib/stores';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	onMount(async () => {
		// Register the badge count refresh function so it can be called from anywhere
		registerBadgeCountRefresh(loadBadgeCounts);
		await loadAssociations();
	});

	async function loadAssociations() {
		camStore.setLoading(true);
		try {
			const orgId = $organizationStore.current?.organization.id;
			if (!orgId) return;

			const response = await fetch(`/api/association?organizationId=${orgId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data) {
					camStore.setAssociations(data.data.items || []);
				}
			}
		} catch (error) {
			console.error('Failed to load associations:', error);
		} finally {
			camStore.setLoading(false);
		}

		await loadBadgeCounts();
	}

	async function loadBadgeCounts() {
		try {
			const associationId = $currentAssociation?.id;
			if (!associationId) return;

			const [violationsRes, arcRes, workOrdersRes] = await Promise.all([
				fetch(`/api/violation?associationId=${associationId}&status=OPEN&limit=0`),
				fetch(`/api/arc/request?associationId=${associationId}&status=SUBMITTED&limit=0`),
				fetch(`/api/work-order?associationId=${associationId}&status=IN_PROGRESS&limit=0`)
			]);

			const counts = { violations: 0, arcRequests: 0, workOrders: 0 };

			if (violationsRes.ok) {
				const data = await violationsRes.json();
				counts.violations = data.data?.total || 0;
			}
			if (arcRes.ok) {
				const data = await arcRes.json();
				counts.arcRequests = data.data?.total || 0;
			}
			if (workOrdersRes.ok) {
				const data = await workOrdersRes.json();
				counts.workOrders = data.data?.total || 0;
			}

			camStore.setBadgeCounts(counts);
		} catch (error) {
			console.error('Failed to load badge counts:', error);
		}
	}

	$effect(() => {
		if ($currentAssociation) {
			loadBadgeCounts();
		}
	});
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<CamSidebar />

	<div class="flex flex-1 flex-col overflow-hidden">
		{#if $isCamLoading}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-center">
					<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary-500" />
					<p class="mt-2 text-sm text-surface-500">Loading CAM data...</p>
				</div>
			</div>
		{:else if !$currentAssociation}
			<div class="flex flex-1 items-center justify-center">
				<div class="max-w-md text-center">
					<h2 class="text-xl font-semibold">No Association Selected</h2>
					<p class="mt-2 text-surface-500">
						Please select an association to continue.
					</p>
					<div class="mx-auto mt-4 max-w-xs">
						<AssociationSelector />
					</div>
				</div>
			</div>
		{:else}
			<div class="border-b border-surface-300-700 bg-surface-50-950 px-4 py-3">
				<div class="flex items-center justify-between">
					<div class="max-w-xs">
						<AssociationSelector />
					</div>
				</div>
			</div>

			<main class="flex-1 overflow-auto bg-surface-100-900">
				{@render children()}
			</main>
		{/if}
	</div>
</div>
