<script lang="ts">
	import { ArrowLeft, ArrowRight, Building2, X, Search } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let hasHoa = $state<'none' | 'external' | 'platform'>($propertyOwnerOnboarding.hoa.hasHoa);
	let hoaName = $state($propertyOwnerOnboarding.hoa.hoaName);
	let hoaContact = $state($propertyOwnerOnboarding.hoa.hoaContact);

	$effect.pre(() => {
		propertyOwnerOnboarding.setStep(3);
	});

	function handleNext() {
		propertyOwnerOnboarding.setHoa({
			hasHoa,
			hoaName: hoaName.trim(),
			hoaContact: hoaContact.trim()
		});

		goto('/onboarding/property-owner/preferences');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">HOA Information</h2>
		<p class="mt-1 text-sm text-surface-500">Is your property part of a homeowners association?</p>
	</div>

	<div class="space-y-4">
		<!-- No HOA -->
		<button
			type="button"
			onclick={() => (hasHoa = 'none')}
			class="w-full rounded-xl border-2 p-4 text-left transition-all
				{hasHoa === 'none'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-200-800">
					<X class="h-5 w-5 text-surface-500" />
				</div>
				<div>
					<p class="font-medium">No HOA</p>
					<p class="text-sm text-surface-500">My property is not part of an HOA</p>
				</div>
			</div>
		</button>

		<!-- External HOA -->
		<button
			type="button"
			onclick={() => (hasHoa = 'external')}
			class="w-full rounded-xl border-2 p-4 text-left transition-all
				{hasHoa === 'external'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
					<Building2 class="h-5 w-5 text-primary-500" />
				</div>
				<div>
					<p class="font-medium">HOA exists (not on Hestami)</p>
					<p class="text-sm text-surface-500">I'll provide basic HOA contact information</p>
				</div>
			</div>
		</button>

		<!-- Platform HOA (future) -->
		<button
			type="button"
			onclick={() => (hasHoa = 'platform')}
			class="w-full rounded-xl border-2 p-4 text-left opacity-50 transition-all
				{hasHoa === 'platform'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700'}"
			disabled
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-success-500/10">
					<Search class="h-5 w-5 text-success-500" />
				</div>
				<div>
					<p class="font-medium">Find my HOA on Hestami</p>
					<p class="text-sm text-surface-500">Coming soon - Link to an HOA already on the platform</p>
				</div>
			</div>
		</button>
	</div>

	<!-- External HOA Details -->
	{#if hasHoa === 'external'}
		<Card variant="outlined" padding="lg">
			<div class="space-y-4">
				<div>
					<label for="hoaName" class="block text-sm font-medium">HOA Name</label>
					<input
						type="text"
						id="hoaName"
						bind:value={hoaName}
						class="input mt-1 w-full"
						placeholder="Sunset Valley HOA"
					/>
				</div>
				<div>
					<label for="hoaContact" class="block text-sm font-medium">HOA Contact (email or phone)</label>
					<input
						type="text"
						id="hoaContact"
						bind:value={hoaContact}
						class="input mt-1 w-full"
						placeholder="manager@sunsetvalleyhoa.com"
					/>
				</div>
				<p class="text-xs text-surface-500">
					This information helps us coordinate with your HOA when needed for service requests.
				</p>
			</div>
		</Card>
	{/if}

	<div class="flex justify-between pt-4">
		<a href="/onboarding/property-owner/property" class="btn preset-tonal-surface">
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
