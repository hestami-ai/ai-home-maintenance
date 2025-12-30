<script lang="ts">
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Home, Search } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Properties | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Properties</h1>
				<p class="mt-1 text-surface-500">View and manage customer properties</p>
			</div>
		</div>

		<div class="mt-6">
			<Card variant="outlined" padding="lg">
				<EmptyState
					title="Property Directory"
					description="Property management features for staff are currently under development. Properties are currently accessible through individual case context in the Work Queue."
				/>
			</Card>
		</div>
	</div>
</PageContainer>
