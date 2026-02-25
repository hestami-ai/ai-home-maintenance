<script lang="ts">
	import { PropertyTypeValues, UnitTypeValues } from '$lib/api/cam';
	import { ArrowLeft, Home, Loader2, Check } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { Select } from 'flowbite-svelte';
	import { orpc } from '$lib/api';
	import { goto } from '$app/navigation';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Form state
	let name = $state('');
	let propertyType = $state(PropertyTypeValues.SINGLE_FAMILY);
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let usState = $state('');
	let postalCode = $state('');
	let yearBuilt = $state('');
	let squareFeet = $state('');
	let bedrooms = $state('');
	let bathrooms = $state('');

	// HOA state
	let hasHoa = $state(false);
	let hoaName = $state('');
	let hoaContactName = $state('');
	let hoaContactEmail = $state('');
	let hoaContactPhone = $state('');

	const propertyTypes = [
		{ value: PropertyTypeValues.SINGLE_FAMILY, name: 'Single Family Home' },
		{ value: PropertyTypeValues.CONDOMINIUM, name: 'Condominium' },
		{ value: UnitTypeValues.TOWNHOUSE, name: 'Townhouse' },
		{ value: PropertyTypeValues.COOPERATIVE, name: 'Cooperative' },
		{ value: PropertyTypeValues.MIXED_USE, name: 'Mixed Use' },
		{ value: PropertyTypeValues.COMMERCIAL, name: 'Commercial' }
	];

	const usStates = [
		{ value: 'AL', name: 'Alabama' },
		{ value: 'AK', name: 'Alaska' },
		{ value: 'AZ', name: 'Arizona' },
		{ value: 'AR', name: 'Arkansas' },
		{ value: 'CA', name: 'California' },
		{ value: 'CO', name: 'Colorado' },
		{ value: 'CT', name: 'Connecticut' },
		{ value: 'DE', name: 'Delaware' },
		{ value: 'FL', name: 'Florida' },
		{ value: 'GA', name: 'Georgia' },
		{ value: 'HI', name: 'Hawaii' },
		{ value: 'ID', name: 'Idaho' },
		{ value: 'IL', name: 'Illinois' },
		{ value: 'IN', name: 'Indiana' },
		{ value: 'IA', name: 'Iowa' },
		{ value: 'KS', name: 'Kansas' },
		{ value: 'KY', name: 'Kentucky' },
		{ value: 'LA', name: 'Louisiana' },
		{ value: 'ME', name: 'Maine' },
		{ value: 'MD', name: 'Maryland' },
		{ value: 'MA', name: 'Massachusetts' },
		{ value: 'MI', name: 'Michigan' },
		{ value: 'MN', name: 'Minnesota' },
		{ value: 'MS', name: 'Mississippi' },
		{ value: 'MO', name: 'Missouri' },
		{ value: 'MT', name: 'Montana' },
		{ value: 'NE', name: 'Nebraska' },
		{ value: 'NV', name: 'Nevada' },
		{ value: 'NH', name: 'New Hampshire' },
		{ value: 'NJ', name: 'New Jersey' },
		{ value: 'NM', name: 'New Mexico' },
		{ value: 'NY', name: 'New York' },
		{ value: 'NC', name: 'North Carolina' },
		{ value: 'ND', name: 'North Dakota' },
		{ value: 'OH', name: 'Ohio' },
		{ value: 'OK', name: 'Oklahoma' },
		{ value: 'OR', name: 'Oregon' },
		{ value: 'PA', name: 'Pennsylvania' },
		{ value: 'RI', name: 'Rhode Island' },
		{ value: 'SC', name: 'South Carolina' },
		{ value: 'SD', name: 'South Dakota' },
		{ value: 'TN', name: 'Tennessee' },
		{ value: 'TX', name: 'Texas' },
		{ value: 'UT', name: 'Utah' },
		{ value: 'VT', name: 'Vermont' },
		{ value: 'VA', name: 'Virginia' },
		{ value: 'WA', name: 'Washington' },
		{ value: 'WV', name: 'West Virginia' },
		{ value: 'WI', name: 'Wisconsin' },
		{ value: 'WY', name: 'Wyoming' },
		{ value: 'DC', name: 'District of Columbia' }
	];

	const isValid = $derived(
		name.trim() !== '' &&
			addressLine1.trim() !== '' &&
			city.trim() !== '' &&
			usState !== '' &&
			postalCode.trim() !== '' &&
			(!hasHoa || hoaName.trim() !== '')
	);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!isValid || isSubmitting) return;

		isSubmitting = true;
		error = null;

		try {
			// First get or create default portfolio
			const portfolioResult = await orpc.propertyPortfolio.getOrCreateDefault({
				idempotencyKey: crypto.randomUUID()
			});

			const portfolio = portfolioResult.data.portfolio;

			// Create the property
			const result = await orpc.individualProperty.create({
				idempotencyKey: crypto.randomUUID(),
				name: name.trim(),
				propertyType: propertyType as any,
				addressLine1: addressLine1.trim(),
				addressLine2: addressLine2.trim() || undefined,
				city: city.trim(),
				state: usState,
				postalCode: postalCode.trim(),
				yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : undefined,
				squareFeet: squareFeet ? parseInt(squareFeet, 10) : undefined,
				bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
				bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
				portfolioId: portfolio.id,
				externalHoa:
					hasHoa && hoaName.trim()
						? {
								hoaName: hoaName.trim(),
								hoaContactName: hoaContactName.trim() || undefined,
								hoaContactEmail: hoaContactEmail.trim() || undefined,
								hoaContactPhone: hoaContactPhone.trim() || undefined
							}
						: undefined
			});

			// Redirect to the new property
			goto(`/app/concierge/properties/${result.data.property.id}`);
		} catch (err) {
			console.error('Failed to create property:', err);
			error = err instanceof Error ? err.message : 'Failed to create property';
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Add Property | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/concierge/properties"
				class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Properties
			</a>
			<h1 class="text-2xl font-bold">Add Property</h1>
			<p class="mt-1 text-surface-500">Enter the details of your property</p>
		</div>

		{#if error}
			<div class="mb-6 rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="space-y-6">
				<!-- Basic Info -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Basic Information</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<label for="name" class="label mb-1 block">
								Property Name <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="name"
								bind:value={name}
								placeholder="e.g., Main Residence, Beach House"
								class="input w-full"
								required
							/>
						</div>

						<div class="sm:col-span-2">
							<label for="propertyType" class="label mb-1 block">
								Property Type <span class="text-error-500">*</span>
							</label>
							<Select id="propertyType" bind:value={propertyType} items={propertyTypes} size="sm" class="w-full" />
						</div>
					</div>
				</Card>

				<!-- Address -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Address</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<label for="addressLine1" class="label mb-1 block">
								Street Address <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="addressLine1"
								bind:value={addressLine1}
								placeholder="123 Main Street"
								class="input w-full"
								required
							/>
						</div>

						<div class="sm:col-span-2">
							<label for="addressLine2" class="label mb-1 block">
								Apt, Suite, Unit (optional)
							</label>
							<input
								type="text"
								id="addressLine2"
								bind:value={addressLine2}
								placeholder="Apt 4B"
								class="input w-full"
							/>
						</div>

						<div>
							<label for="city" class="label mb-1 block">
								City <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="city"
								bind:value={city}
								placeholder="City"
								class="input w-full"
								required
							/>
						</div>

						<div>
							<label for="state" class="label mb-1 block">
								State <span class="text-error-500">*</span>
							</label>
							<Select id="state" bind:value={usState} size="sm" class="w-full">
								<option value="">Select State</option>
								{#each usStates as st}
									<option value={st.value}>{st.name}</option>
								{/each}
							</Select>
						</div>

						<div>
							<label for="postalCode" class="label mb-1 block">
								ZIP Code <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="postalCode"
								bind:value={postalCode}
								placeholder="12345"
								class="input w-full"
								required
								maxlength="10"
							/>
						</div>
					</div>
				</Card>

				<!-- Property Details -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Property Details (Optional)</h2>
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div>
							<label for="yearBuilt" class="label mb-1 block">Year Built</label>
							<input
								type="number"
								id="yearBuilt"
								bind:value={yearBuilt}
								placeholder="2000"
								class="input w-full"
								min="1800"
								max="2100"
							/>
						</div>

						<div>
							<label for="squareFeet" class="label mb-1 block">Square Feet</label>
							<input
								type="number"
								id="squareFeet"
								bind:value={squareFeet}
								placeholder="2000"
								class="input w-full"
								min="0"
							/>
						</div>

						<div>
							<label for="bedrooms" class="label mb-1 block">Bedrooms</label>
							<input
								type="number"
								id="bedrooms"
								bind:value={bedrooms}
								placeholder="3"
								class="input w-full"
								min="0"
							/>
						</div>

						<div>
							<label for="bathrooms" class="label mb-1 block">Bathrooms</label>
							<input
								type="number"
								id="bathrooms"
								bind:value={bathrooms}
								placeholder="2.5"
								class="input w-full"
								min="0"
								step="0.5"
							/>
						</div>
					</div>
				</Card>

				<!-- HOA Information -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">HOA Information</h2>

					<label class="flex items-center gap-3">
						<input type="checkbox" bind:checked={hasHoa} class="checkbox" />
						<span>This property is part of an HOA</span>
					</label>

					{#if hasHoa}
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="sm:col-span-2">
								<label for="hoaName" class="label mb-1 block">
									HOA Name <span class="text-error-500">*</span>
								</label>
								<input
									type="text"
									id="hoaName"
									bind:value={hoaName}
									placeholder="Sunshine Valley HOA"
									class="input w-full"
									required={hasHoa}
								/>
							</div>

							<div>
								<label for="hoaContactName" class="label mb-1 block">Contact Name</label>
								<input
									type="text"
									id="hoaContactName"
									bind:value={hoaContactName}
									placeholder="John Smith"
									class="input w-full"
								/>
							</div>

							<div>
								<label for="hoaContactPhone" class="label mb-1 block">Contact Phone</label>
								<input
									type="tel"
									id="hoaContactPhone"
									bind:value={hoaContactPhone}
									placeholder="(555) 123-4567"
									class="input w-full"
								/>
							</div>

							<div class="sm:col-span-2">
								<label for="hoaContactEmail" class="label mb-1 block">Contact Email</label>
								<input
									type="email"
									id="hoaContactEmail"
									bind:value={hoaContactEmail}
									placeholder="hoa@example.com"
									class="input w-full"
								/>
							</div>
						</div>
					{/if}
				</Card>

				<!-- Actions -->
				<div class="flex justify-end gap-3">
					<a href="/app/concierge/properties" class="btn preset-tonal-surface">Cancel</a>
					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={!isValid || isSubmitting}
					>
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating...
						{:else}
							<Check class="mr-2 h-4 w-4" />
							Create Property
						{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</PageContainer>
