<script lang="ts">
	import { ArrowLeft, ArrowRight, Sparkles, Wrench } from 'lucide-svelte';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let mode = $state<'concierge' | 'diy'>($propertyOwnerOnboarding.preferences.mode);

	$effect.pre(() => {
		propertyOwnerOnboarding.setStep(4);
	});

	function handleNext() {
		propertyOwnerOnboarding.setPreferences({ mode });
		goto('/onboarding/property-owner/review');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">How would you like to manage your property?</h2>
		<p class="mt-1 text-sm text-surface-500">You can change this preference anytime</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<!-- Concierge Mode -->
		<button
			type="button"
			onclick={() => (mode = 'concierge')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{mode === 'concierge'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex flex-col items-center text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500">
					<Sparkles class="h-8 w-8 text-white" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">Concierge Mode</h3>
				<p class="mt-2 text-sm text-surface-500">
					Let us handle everything. We'll find providers, schedule services, and manage your property maintenance.
				</p>
				<ul class="mt-4 space-y-1 text-left text-xs text-surface-500">
					<li>✓ AI-powered service matching</li>
					<li>✓ Automated scheduling</li>
					<li>✓ Proactive maintenance reminders</li>
					<li>✓ Vendor vetting & management</li>
				</ul>
				{#if mode === 'concierge'}
					<span class="mt-4 inline-block rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white">
						Recommended
					</span>
				{/if}
			</div>
		</button>

		<!-- DIY Mode -->
		<button
			type="button"
			onclick={() => (mode = 'diy')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{mode === 'diy'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex flex-col items-center text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-200-800">
					<Wrench class="h-8 w-8 text-surface-500" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">DIY Mode</h3>
				<p class="mt-2 text-sm text-surface-500">
					Take control yourself. Use our tools to find providers and manage your own service requests.
				</p>
				<ul class="mt-4 space-y-1 text-left text-xs text-surface-500">
					<li>✓ Search provider directory</li>
					<li>✓ Self-service scheduling</li>
					<li>✓ Document storage</li>
					<li>✓ Maintenance tracking</li>
				</ul>
			</div>
		</button>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/property-owner/hoa" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button
			type="button"
			onclick={handleNext}
			class="btn preset-filled-primary-500"
		>
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
