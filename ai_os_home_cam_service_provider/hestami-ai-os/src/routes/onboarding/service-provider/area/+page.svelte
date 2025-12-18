<script lang="ts">
	import { ArrowLeft, ArrowRight, MapPin, X } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let zipCodes = $state<string[]>([...$serviceProviderOnboarding.serviceArea.zipCodes]);
	let serviceRadius = $state($serviceProviderOnboarding.serviceArea.serviceRadius);
	let states = $state<string[]>([...$serviceProviderOnboarding.serviceArea.states]);
	let newZipCode = $state('');

	const usStates = [
		{ code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
		{ code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
		{ code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
		{ code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
		{ code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
		{ code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
		{ code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
		{ code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
		{ code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
		{ code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
		{ code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
		{ code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
		{ code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
		{ code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
		{ code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
		{ code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
		{ code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
	];

	onMount(() => {
		serviceProviderOnboarding.setStep(2);
	});

	function addZipCode() {
		const zip = newZipCode.trim();
		if (zip && /^\d{5}$/.test(zip) && !zipCodes.includes(zip)) {
			zipCodes = [...zipCodes, zip];
			newZipCode = '';
		}
	}

	function removeZipCode(zip: string) {
		zipCodes = zipCodes.filter((z) => z !== zip);
	}

	function toggleState(stateCode: string) {
		if (states.includes(stateCode)) {
			states = states.filter((s) => s !== stateCode);
		} else {
			states = [...states, stateCode];
		}
	}

	function handleNext() {
		serviceProviderOnboarding.setServiceArea({
			zipCodes,
			serviceRadius,
			states
		});
		goto('/onboarding/service-provider/operations');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Service Area</h2>
		<p class="mt-1 text-sm text-surface-500">Define where you provide services</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-6">
			<div>
				<div class="flex items-center gap-3">
					<MapPin class="h-5 w-5 text-primary-500" />
					<h3 class="font-medium">Primary ZIP Codes</h3>
				</div>
				<p class="mt-1 text-xs text-surface-500">Add the ZIP codes where you primarily operate</p>
				<div class="mt-3 flex gap-2">
					<input
						type="text"
						bind:value={newZipCode}
						class="input w-32"
						placeholder="12345"
						maxlength="5"
						onkeydown={(e) => e.key === 'Enter' && addZipCode()}
					/>
					<button type="button" onclick={addZipCode} class="btn preset-tonal-primary">Add</button>
				</div>
				{#if zipCodes.length > 0}
					<div class="mt-3 flex flex-wrap gap-2">
						{#each zipCodes as zip}
							<span class="inline-flex items-center gap-1 rounded-full bg-surface-200-800 px-3 py-1 text-sm">
								{zip}
								<button type="button" onclick={() => removeZipCode(zip)} class="hover:text-error-500">
									<X class="h-3 w-3" />
								</button>
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<div>
				<label for="serviceRadius" class="block text-sm font-medium">Service Radius (miles)</label>
				<input
					type="range"
					id="serviceRadius"
					bind:value={serviceRadius}
					min="5"
					max="100"
					step="5"
					class="mt-2 w-full"
				/>
				<div class="mt-1 flex justify-between text-xs text-surface-500">
					<span>5 mi</span>
					<span class="font-medium text-primary-500">{serviceRadius} miles</span>
					<span>100 mi</span>
				</div>
			</div>

			<div>
				<h3 class="font-medium">States Served</h3>
				<p class="mt-1 text-xs text-surface-500">Select all states where you're licensed to operate</p>
				<div class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
					{#each usStates as st}
						<button
							type="button"
							onclick={() => toggleState(st.code)}
							class="rounded px-2 py-1 text-sm transition-colors
								{states.includes(st.code)
									? 'bg-primary-500 text-white'
									: 'bg-surface-200-800 hover:bg-surface-300-700'}"
							title={st.name}
						>
							{st.code}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/service-provider/compliance" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500">
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
