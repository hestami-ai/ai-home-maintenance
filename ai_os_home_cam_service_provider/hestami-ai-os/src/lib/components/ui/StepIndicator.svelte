<script lang="ts">
	import { Check } from 'lucide-svelte';

	interface Step {
		label: string;
		description?: string;
	}

	interface Props {
		steps: Step[];
		currentStep: number;
		orientation?: 'horizontal' | 'vertical';
	}

	let { steps, currentStep, orientation = 'horizontal' }: Props = $props();

	function getStepStatus(index: number): 'completed' | 'current' | 'upcoming' {
		if (index < currentStep) return 'completed';
		if (index === currentStep) return 'current';
		return 'upcoming';
	}
</script>

{#if orientation === 'horizontal'}
	<nav aria-label="Progress" class="w-full">
		<ol class="flex items-center">
			{#each steps as step, index}
				{@const status = getStepStatus(index)}
				<li class="relative {index !== steps.length - 1 ? 'flex-1 pr-8 sm:pr-20' : ''}">
					<div class="flex items-center">
						<!-- Step circle -->
						<div
							class="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
								{status === 'completed' ? 'bg-primary-500 text-white' : ''}
								{status === 'current' ? 'border-2 border-primary-500 bg-surface-100-900 text-primary-500' : ''}
								{status === 'upcoming' ? 'border-2 border-surface-300-700 bg-surface-100-900 text-surface-500' : ''}"
						>
							{#if status === 'completed'}
								<Check class="h-4 w-4" />
							{:else}
								{index + 1}
							{/if}
						</div>

						<!-- Connector line -->
						{#if index !== steps.length - 1}
							<div
								class="absolute left-8 top-4 -ml-px h-0.5 w-full -translate-y-1/2
									{status === 'completed' ? 'bg-primary-500' : 'bg-surface-300-700'}"
							></div>
						{/if}
					</div>

					<!-- Step label -->
					<div class="mt-2">
						<span
							class="text-sm font-medium
								{status === 'current' ? 'text-primary-500' : ''}
								{status === 'upcoming' ? 'text-surface-500' : ''}"
						>
							{step.label}
						</span>
						{#if step.description}
							<p class="text-xs text-surface-500">{step.description}</p>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</nav>
{:else}
	<nav aria-label="Progress" class="w-full">
		<ol class="space-y-4">
			{#each steps as step, index}
				{@const status = getStepStatus(index)}
				<li class="relative flex gap-4">
					<div class="flex flex-col items-center">
						<!-- Step circle -->
						<div
							class="relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
								{status === 'completed' ? 'bg-primary-500 text-white' : ''}
								{status === 'current' ? 'border-2 border-primary-500 bg-surface-100-900 text-primary-500' : ''}
								{status === 'upcoming' ? 'border-2 border-surface-300-700 bg-surface-100-900 text-surface-500' : ''}"
						>
							{#if status === 'completed'}
								<Check class="h-4 w-4" />
							{:else}
								{index + 1}
							{/if}
						</div>

						<!-- Connector line -->
						{#if index !== steps.length - 1}
							<div
								class="mt-2 h-full w-0.5 flex-1
									{status === 'completed' ? 'bg-primary-500' : 'bg-surface-300-700'}"
							></div>
						{/if}
					</div>

					<!-- Step content -->
					<div class="flex-1 pb-4">
						<span
							class="text-sm font-medium
								{status === 'current' ? 'text-primary-500' : ''}
								{status === 'upcoming' ? 'text-surface-500' : ''}"
						>
							{step.label}
						</span>
						{#if step.description}
							<p class="text-xs text-surface-500">{step.description}</p>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</nav>
{/if}
