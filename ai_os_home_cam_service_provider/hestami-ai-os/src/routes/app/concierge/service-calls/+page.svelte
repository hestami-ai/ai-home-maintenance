<script lang="ts">
	import { Wrench, ArrowLeft, Home, Droplets, Zap, Wind, Hammer, Bug, Leaf, Shield } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { goto } from '$app/navigation';

	const serviceCategories = [
		{ id: 'plumbing', label: 'Plumbing', icon: Droplets, description: 'Leaks, clogs, water heater, fixtures' },
		{ id: 'electrical', label: 'Electrical', icon: Zap, description: 'Outlets, wiring, lighting, panels' },
		{ id: 'hvac', label: 'HVAC', icon: Wind, description: 'Heating, cooling, ventilation' },
		{ id: 'general', label: 'General Repairs', icon: Hammer, description: 'Doors, windows, drywall, painting' },
		{ id: 'pest', label: 'Pest Control', icon: Bug, description: 'Insects, rodents, wildlife' },
		{ id: 'landscaping', label: 'Landscaping', icon: Leaf, description: 'Lawn, trees, irrigation' },
		{ id: 'security', label: 'Security', icon: Shield, description: 'Locks, alarms, cameras' },
		{ id: 'other', label: 'Other', icon: Wrench, description: 'Other maintenance needs' }
	];

	let selectedCategory = $state<string | null>(null);

	function selectCategory(categoryId: string) {
		selectedCategory = categoryId;
		goto(`/app/concierge/service-calls/new?category=${categoryId}`);
	}
</script>

<svelte:head>
	<title>New Service Call | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-8">
			<a href="/app/concierge" class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700">
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Dashboard
			</a>
			<h1 class="text-2xl font-bold">New Service Call</h1>
			<p class="mt-1 text-surface-500">
				Select a service category to get started
			</p>
		</div>

		<!-- Service Categories Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each serviceCategories as category}
				<button
					type="button"
					onclick={() => selectCategory(category.id)}
					class="group text-left"
				>
					<Card 
						variant="outlined" 
						padding="md"
						class="h-full transition-all hover:border-primary-500 hover:shadow-md {selectedCategory === category.id ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}"
					>
						<div class="flex flex-col items-center text-center">
							<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10 transition-colors group-hover:bg-primary-500/20">
								<category.icon class="h-6 w-6 text-primary-500" />
							</div>
							<h3 class="mt-3 font-semibold">{category.label}</h3>
							<p class="mt-1 text-sm text-surface-500">{category.description}</p>
						</div>
					</Card>
				</button>
			{/each}
		</div>

		<!-- Skip category selection option -->
		<div class="mt-8 text-center">
			<p class="text-surface-500">Not sure which category?</p>
			<a href="/app/concierge/service-calls/new" class="btn preset-tonal-primary mt-2">
				Skip to Form
			</a>
		</div>
	</div>
</PageContainer>
