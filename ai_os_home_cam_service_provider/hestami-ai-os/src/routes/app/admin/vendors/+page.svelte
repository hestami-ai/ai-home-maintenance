<script lang="ts">
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Truck, Plus } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Vendors | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Vendors</h1>
				<p class="mt-1 text-surface-500">Manage vendor candidates and service providers</p>
			</div>
			<button class="btn preset-filled-primary-500" disabled>
				<Plus class="mr-2 h-4 w-4" />
				Add Vendor
			</button>
		</div>

		<div class="mt-6">
			<Card variant="outlined" padding="lg">
				<EmptyState
					title="Vendor Management"
					description="Access vendor candidates through individual case pages. Use the Work Queue to find cases with vendor research needs."
				>
					{#snippet actions()}
						<a href="/app/admin/work-queue" class="btn preset-filled-primary-500">
							Go to Work Queue
						</a>
					{/snippet}
				</EmptyState>
			</Card>
		</div>
	</div>
</PageContainer>
