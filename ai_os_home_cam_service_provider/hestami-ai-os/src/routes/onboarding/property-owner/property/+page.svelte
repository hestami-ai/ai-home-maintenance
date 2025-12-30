<script lang="ts">
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let propertyName = $state($propertyOwnerOnboarding.property.name);
	let addressLine1 = $state($propertyOwnerOnboarding.property.addressLine1);
	let addressLine2 = $state($propertyOwnerOnboarding.property.addressLine2);
	let city = $state($propertyOwnerOnboarding.property.city);
	let stateCode = $state($propertyOwnerOnboarding.property.state);
	let zipCode = $state($propertyOwnerOnboarding.property.zipCode);
	let propertyType = $state($propertyOwnerOnboarding.property.propertyType);
	let yearBuilt = $state($propertyOwnerOnboarding.property.yearBuilt);
	let squareFootage = $state($propertyOwnerOnboarding.property.squareFootage);

	const propertyTypes = [
		{ value: 'single_family', label: 'Single Family Home' },
		{ value: 'condo', label: 'Condominium' },
		{ value: 'townhouse', label: 'Townhouse' },
		{ value: 'multi_family', label: 'Multi-Family' },
		{ value: 'vacation', label: 'Vacation Home' },
		{ value: 'investment', label: 'Investment Property' },
		{ value: 'other', label: 'Other' }
	];

	const usStates = [
		'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
		'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
		'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
		'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
		'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
	];

	$effect.pre(() => {
		propertyOwnerOnboarding.setStep(2);
	});

	function handleNext() {
		if (!addressLine1.trim() || !city.trim() || !stateCode || !zipCode.trim()) return;

		propertyOwnerOnboarding.setProperty({
			name: propertyName.trim() || `${addressLine1.trim()}, ${city.trim()}`,
			addressLine1: addressLine1.trim(),
			addressLine2: addressLine2.trim(),
			city: city.trim(),
			state: stateCode,
			zipCode: zipCode.trim(),
			propertyType,
			yearBuilt: yearBuilt.trim(),
			squareFootage: squareFootage.trim()
		});

		goto('/onboarding/property-owner/hoa');
	}

	const isValid = $derived(
		addressLine1.trim().length > 0 &&
		city.trim().length > 0 &&
		stateCode.length > 0 &&
		zipCode.trim().length > 0
	);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Your First Property</h2>
		<p class="mt-1 text-sm text-surface-500">Add your property details. You can add more properties later.</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-4">
			<!-- Property Name (optional) -->
			<div>
				<label for="propertyName" class="block text-sm font-medium">Property Name (optional)</label>
				<input
					type="text"
					id="propertyName"
					bind:value={propertyName}
					class="input mt-1 w-full"
					placeholder="Main Residence, Beach House, etc."
				/>
			</div>

			<!-- Address Line 1 -->
			<div>
				<label for="addressLine1" class="block text-sm font-medium">
					Street Address
					<span class="text-error-500">*</span>
				</label>
				<input
					type="text"
					id="addressLine1"
					bind:value={addressLine1}
					class="input mt-1 w-full"
					placeholder="123 Main Street"
					required
				/>
			</div>

			<!-- Address Line 2 -->
			<div>
				<label for="addressLine2" class="block text-sm font-medium">Apt, Suite, Unit (optional)</label>
				<input
					type="text"
					id="addressLine2"
					bind:value={addressLine2}
					class="input mt-1 w-full"
					placeholder="Apt 4B"
				/>
			</div>

			<!-- City, State, Zip -->
			<div class="grid gap-4 sm:grid-cols-6">
				<div class="sm:col-span-3">
					<label for="city" class="block text-sm font-medium">
						City
						<span class="text-error-500">*</span>
					</label>
					<input
						type="text"
						id="city"
						bind:value={city}
						class="input mt-1 w-full"
						placeholder="San Francisco"
						required
					/>
				</div>
				<div class="sm:col-span-1">
					<label for="stateCode" class="block text-sm font-medium">
						State
						<span class="text-error-500">*</span>
					</label>
					<select
						id="stateCode"
						bind:value={stateCode}
						class="select mt-1 w-full"
						required
					>
						<option value="">--</option>
						{#each usStates as st}
							<option value={st}>{st}</option>
						{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="zipCode" class="block text-sm font-medium">
						ZIP Code
						<span class="text-error-500">*</span>
					</label>
					<input
						type="text"
						id="zipCode"
						bind:value={zipCode}
						class="input mt-1 w-full"
						placeholder="94102"
						required
					/>
				</div>
			</div>

			<!-- Property Type -->
			<div>
				<label for="propertyType" class="block text-sm font-medium">Property Type</label>
				<select
					id="propertyType"
					bind:value={propertyType}
					class="select mt-1 w-full"
				>
					<option value="">Select type...</option>
					{#each propertyTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>

			<!-- Year Built & Square Footage -->
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="yearBuilt" class="block text-sm font-medium">Year Built (optional)</label>
					<input
						type="text"
						id="yearBuilt"
						bind:value={yearBuilt}
						class="input mt-1 w-full"
						placeholder="2005"
					/>
				</div>
				<div>
					<label for="squareFootage" class="block text-sm font-medium">Square Footage (optional)</label>
					<input
						type="text"
						id="squareFootage"
						bind:value={squareFootage}
						class="input mt-1 w-full"
						placeholder="2,500"
					/>
				</div>
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/property-owner/details" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button
			type="button"
			onclick={handleNext}
			class="btn preset-filled-primary-500"
			disabled={!isValid}
		>
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
