<script lang="ts">
	import { PageContainer, StepIndicator } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	const steps = [
		{ label: 'Business' },
		{ label: 'Compliance' },
		{ label: 'Service Area' },
		{ label: 'Operations' },
		{ label: 'Review' }
	];
</script>

<svelte:head>
	<title>Service Provider Setup | Hestami AI</title>
</svelte:head>

<PageContainer maxWidth="lg">
	<div class="py-8">
		<div class="mb-8">
			<h1 class="text-2xl font-bold">Set Up Your Business</h1>
			<p class="mt-1 text-surface-500">Let's get your service provider account ready</p>
		</div>

		<div class="mb-8 hidden sm:block">
			<StepIndicator {steps} currentStep={$serviceProviderOnboarding.step} />
		</div>
		<div class="mb-8 sm:hidden">
			<p class="text-sm text-surface-500">
				Step {$serviceProviderOnboarding.step + 1} of {steps.length}: {steps[$serviceProviderOnboarding.step]?.label}
			</p>
		</div>

		{@render children()}
	</div>
</PageContainer>
