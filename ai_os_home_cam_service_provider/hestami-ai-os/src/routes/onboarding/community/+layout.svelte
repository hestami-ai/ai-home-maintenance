<script lang="ts">
	import { PageContainer, StepIndicator } from '$lib/components/ui';
	import { communityOnboarding } from '$lib/stores';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	const steps = [
		{ label: 'Type' },
		{ label: 'Details' },
		{ label: 'Governance' },
		{ label: 'Data' },
		{ label: 'Role' },
		{ label: 'Review' }
	];
</script>

<svelte:head>
	<title>Community Setup | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="lg">
	<div class="py-8">
		<div class="mb-8">
			<h1 class="text-2xl font-bold">Set Up Your Community</h1>
			<p class="mt-1 text-surface-500">Let's get your community management account ready</p>
		</div>

		<div class="mb-8 hidden sm:block">
			<StepIndicator {steps} currentStep={$communityOnboarding.step} />
		</div>
		<div class="mb-8 sm:hidden">
			<p class="text-sm text-surface-500">
				Step {$communityOnboarding.step + 1} of {steps.length}: {steps[$communityOnboarding.step]?.label}
			</p>
		</div>

		{@render children()}
	</div>
</PageContainer>
