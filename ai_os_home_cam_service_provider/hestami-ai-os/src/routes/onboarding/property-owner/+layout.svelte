<script lang="ts">
	import { PageContainer, StepIndicator } from '$lib/components/ui';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { onMount } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	const steps = [
		{ label: 'Type' },
		{ label: 'Details' },
		{ label: 'Property' },
		{ label: 'HOA' },
		{ label: 'Preferences' },
		{ label: 'Review' }
	];

	onMount(() => {
		// Reset wizard state when entering
		// propertyOwnerOnboarding.reset();
	});
</script>

<svelte:head>
	<title>Property Owner Setup | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="lg">
	<div class="py-8">
		<div class="mb-8">
			<h1 class="text-2xl font-bold">Set Up Your Property</h1>
			<p class="mt-1 text-surface-500">Let's get your property management account ready</p>
		</div>

		<!-- Step Indicator -->
		<div class="mb-8 hidden sm:block">
			<StepIndicator {steps} currentStep={$propertyOwnerOnboarding.step} />
		</div>
		<div class="mb-8 sm:hidden">
			<p class="text-sm text-surface-500">
				Step {$propertyOwnerOnboarding.step + 1} of {steps.length}: {steps[$propertyOwnerOnboarding.step]?.label}
			</p>
		</div>

		{@render children()}
	</div>
</PageContainer>
