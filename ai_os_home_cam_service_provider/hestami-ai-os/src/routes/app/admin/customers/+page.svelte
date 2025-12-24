<script lang="ts">
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Users } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Customers | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Customers</h1>
				<p class="mt-1 text-surface-500">View and manage customer accounts</p>
			</div>
		</div>

		<div class="mt-6">
			<Card variant="outlined" padding="lg">
				<EmptyState
					title="Customer Directory"
					description="Customer management features are coming soon. Customer information is currently accessible through case details."
				>
					{#snippet actions()}
						<a href="/app/admin/work-queue" class="btn preset-outlined-primary-500">
							Go to Work Queue
						</a>
					{/snippet}
				</EmptyState>
			</Card>
		</div>
	</div>
</PageContainer>
