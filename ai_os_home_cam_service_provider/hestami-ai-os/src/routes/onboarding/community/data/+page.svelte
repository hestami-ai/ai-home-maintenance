<script lang="ts">
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { communityOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let totalUnits = $state($communityOnboarding.initialData.totalUnits);
	let unitTypes = $state<string[]>($communityOnboarding.initialData.unitTypes);

	const unitTypeOptions = [
		{ value: 'single_family', label: 'Single Family Homes' },
		{ value: 'condo', label: 'Condominiums' },
		{ value: 'townhouse', label: 'Townhouses' },
		{ value: 'apartment', label: 'Apartments' },
		{ value: 'mixed', label: 'Mixed Use' }
	];

	onMount(() => {
		communityOnboarding.setStep(3);
	});

	function toggleUnitType(type: string) {
		if (unitTypes.includes(type)) {
			unitTypes = unitTypes.filter((t) => t !== type);
		} else {
			unitTypes = [...unitTypes, type];
		}
	}

	function handleNext() {
		communityOnboarding.setInitialData({
			totalUnits,
			unitTypes
		});
		goto('/onboarding/community/role');
	}

	const isAssociation = $derived($communityOnboarding.organizationType === 'COMMUNITY_ASSOCIATION');
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">
			{#if isAssociation}
				Community Data
			{:else}
				Portfolio Overview
			{/if}
		</h2>
		<p class="mt-1 text-sm text-surface-500">
			{#if isAssociation}
				Tell us about your community's units
			{:else}
				Tell us about the communities you manage
			{/if}
		</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-6">
			<div>
				<label for="totalUnits" class="block text-sm font-medium">
					{#if isAssociation}
						Total Units/Lots
					{:else}
						Total Units Under Management
					{/if}
				</label>
				<input
					type="number"
					id="totalUnits"
					bind:value={totalUnits}
					min="1"
					class="input mt-1 w-full max-w-xs"
					placeholder="100"
				/>
				<p class="mt-1 text-xs text-surface-500">You can add individual units later</p>
			</div>

			{#if isAssociation}
				<div>
					<p class="text-sm font-medium">Unit Types</p>
					<p class="mt-1 text-xs text-surface-500">Select all that apply</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each unitTypeOptions as option}
							<button
								type="button"
								onclick={() => toggleUnitType(option.value)}
								class="rounded-full px-4 py-2 text-sm transition-colors
									{unitTypes.includes(option.value)
										? 'bg-primary-500 text-white'
										: 'bg-surface-200-800 hover:bg-surface-300-700'}"
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/community/governance" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500">
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
