<script lang="ts">
	import { PropertyTypeValues, UnitTypeValues } from '$lib/api/cam';
	import { ArrowLeft, Home, Loader2, Check } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
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
		{ value: PropertyTypeValues.SINGLE_FAMILY, label: 'Single Family Home' },
		{ value: PropertyTypeValues.CONDOMINIUM, label: 'Condominium' },
		{ value: UnitTypeValues.TOWNHOUSE, label: 'Townhouse' },
		{ value: PropertyTypeValues.COOPERATIVE, label: 'Cooperative' },
		{ value: PropertyTypeValues.MIXED_USE, label: 'Mixed Use' },
		{ value: PropertyTypeValues.COMMERCIAL, label: 'Commercial' }
	];

	const usStates = [
		{ value: 'AL', label: 'Alabama' },
		{ value: 'AK', label: 'Alaska' },
		{ value: 'AZ', label: 'Arizona' },
		{ value: 'AR', label: 'Arkansas' },
		{ value: 'CA', label: 'California' },
		{ value: 'CO', label: 'Colorado' },
		{ value: 'CT', label: 'Connecticut' },
		{ value: 'DE', label: 'Delaware' },
		{ value: 'FL', label: 'Florida' },
		{ value: 'GA', label: 'Georgia' },
		{ value: 'HI', label: 'Hawaii' },
		{ value: 'ID', label: 'Idaho' },
		{ value: 'IL', label: 'Illinois' },
		{ value: 'IN', label: 'Indiana' },
		{ value: 'IA', label: 'Iowa' },
		{ value: 'KS', label: 'Kansas' },
		{ value: 'KY', label: 'Kentucky' },
		{ value: 'LA', label: 'Louisiana' },
		{ value: 'ME', label: 'Maine' },
		{ value: 'MD', label: 'Maryland' },
		{ value: 'MA', label: 'Massachusetts' },
		{ value: 'MI', label: 'Michigan' },
		{ value: 'MN', label: 'Minnesota' },
		{ value: 'MS', label: 'Mississippi' },
		{ value: 'MO', label: 'Missouri' },
		{ value: 'MT', label: 'Montana' },
		{ value: 'NE', label: 'Nebraska' },
		{ value: 'NV', label: 'Nevada' },
		{ value: 'NH', label: 'New Hampshire' },
		{ value: 'NJ', label: 'New Jersey' },
		{ value: 'NM', label: 'New Mexico' },
		{ value: 'NY', label: 'New York' },
		{ value: 'NC', label: 'North Carolina' },
		{ value: 'ND', label: 'North Dakota' },
		{ value: 'OH', label: 'Ohio' },
		{ value: 'OK', label: 'Oklahoma' },
		{ value: 'OR', label: 'Oregon' },
		{ value: 'PA', label: 'Pennsylvania' },
		{ value: 'RI', label: 'Rhode Island' },
		{ value: 'SC', label: 'South Carolina' },
		{ value: 'SD', label: 'South Dakota' },
		{ value: 'TN', label: 'Tennessee' },
		{ value: 'TX', label: 'Texas' },
		{ value: 'UT', label: 'Utah' },
		{ value: 'VT', label: 'Vermont' },
		{ value: 'VA', label: 'Virginia' },
		{ value: 'WA', label: 'Washington' },
		{ value: 'WV', label: 'West Virginia' },
		{ value: 'WI', label: 'Wisconsin' },
		{ value: 'WY', label: 'Wyoming' },
		{ value: 'DC', label: 'District of Columbia' }
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
							<select id="propertyType" bind:value={propertyType} class="select w-full">
								{#each propertyTypes as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
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
							<select id="state" bind:value={usState} class="select w-full" required>
								<option value="">Select State</option>
								{#each usStates as st}
									<option value={st.value}>{st.label}</option>
								{/each}
							</select>
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
