<script lang="ts">
	import { OrganizationTypeValues } from '$lib/api/cam';
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { communityOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let name = $state($communityOnboarding.organizationDetails.name);
	let slug = $state($communityOnboarding.organizationDetails.slug);
	let addressLine1 = $state($communityOnboarding.organizationDetails.addressLine1);
	let city = $state($communityOnboarding.organizationDetails.city);
	let stateCode = $state($communityOnboarding.organizationDetails.state);
	let zipCode = $state($communityOnboarding.organizationDetails.zipCode);
	let contactEmail = $state($communityOnboarding.organizationDetails.contactEmail);
	let contactPhone = $state($communityOnboarding.organizationDetails.contactPhone);
	let website = $state($communityOnboarding.organizationDetails.website);

	let slugTouched = $state(false);
	let slugError = $state<string | null>(null);

	const usStates = [
		'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
		'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
		'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
		'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
		'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
	];

	$effect.pre(() => {
		communityOnboarding.setStep(1);
	});

	// Pre-fill contact email from auth (once)
	// Track data to trigger re-runs on navigation, but guard against undefined
	let hasPreFilled = $state(false);
	$effect(() => {
		if (data == null || typeof data !== 'object') return;
		if (!hasPreFilled && data.user?.email && !contactEmail) {
			contactEmail = data.user.email;
			hasPreFilled = true;
		}
	});

	function generateSlug(fromName: string) {
		if (!slugTouched) {
			slug = fromName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.substring(0, 50);
		}
	}

	function handleNameChange() {
		generateSlug(name);
	}

	function handleSlugChange() {
		slugTouched = true;
		if (!/^[a-z0-9-]+$/.test(slug)) {
			slugError = 'Slug can only contain lowercase letters, numbers, and hyphens';
		} else {
			slugError = null;
		}
	}

	function handleNext() {
		if (!name.trim() || !slug.trim() || slugError) return;

		communityOnboarding.setOrganizationDetails({
			name: name.trim(),
			slug: slug.trim(),
			addressLine1: addressLine1.trim(),
			city: city.trim(),
			state: stateCode,
			zipCode: zipCode.trim(),
			contactEmail: contactEmail.trim(),
			contactPhone: contactPhone.trim(),
			website: website.trim()
		});

		goto('/onboarding/community/governance');
	}

	const isValid = $derived(name.trim().length > 0 && slug.trim().length > 0 && !slugError);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Organization Details</h2>
		<p class="mt-1 text-sm text-surface-500">
			{#if $communityOnboarding.organizationType === OrganizationTypeValues.MANAGEMENT_COMPANY}
				Enter your management company information
			{:else}
				Enter your community association information
			{/if}
		</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-4">
			<div>
				<label for="name" class="block text-sm font-medium">
					Organization Name <span class="text-error-500">*</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					oninput={handleNameChange}
					class="input mt-1 w-full"
					placeholder={$communityOnboarding.organizationType === OrganizationTypeValues.MANAGEMENT_COMPANY
						? 'ABC Property Management'
						: 'Sunset Valley HOA'}
					required
				/>
			</div>

			<div>
				<label for="slug" class="block text-sm font-medium">
					Account URL <span class="text-error-500">*</span>
				</label>
				<div class="mt-1 flex rounded-md">
					<span class="inline-flex items-center rounded-l-md border border-r-0 border-surface-300-700 bg-surface-200-800 px-3 text-sm text-surface-500">
						hestami.ai/
					</span>
					<input
						type="text"
						id="slug"
						bind:value={slug}
						oninput={handleSlugChange}
						class="input flex-1 rounded-l-none"
						placeholder="sunset-valley-hoa"
						required
					/>
				</div>
				{#if slugError}
					<p class="mt-1 text-xs text-error-500">{slugError}</p>
				{/if}
			</div>

			<div>
				<label for="addressLine1" class="block text-sm font-medium">Address</label>
				<input
					type="text"
					id="addressLine1"
					bind:value={addressLine1}
					class="input mt-1 w-full"
					placeholder="123 Community Drive"
				/>
			</div>

			<div class="grid gap-4 sm:grid-cols-6">
				<div class="sm:col-span-3">
					<label for="city" class="block text-sm font-medium">City</label>
					<input type="text" id="city" bind:value={city} class="input mt-1 w-full" placeholder="San Francisco" />
				</div>
				<div class="sm:col-span-1">
					<label for="stateCode" class="block text-sm font-medium">State</label>
					<select id="stateCode" bind:value={stateCode} class="select mt-1 w-full">
						<option value="">--</option>
						{#each usStates as st}
							<option value={st}>{st}</option>
						{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="zipCode" class="block text-sm font-medium">ZIP</label>
					<input type="text" id="zipCode" bind:value={zipCode} class="input mt-1 w-full" placeholder="94102" />
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="contactEmail" class="block text-sm font-medium">Contact Email</label>
					<input type="email" id="contactEmail" bind:value={contactEmail} class="input mt-1 w-full" placeholder="info@example.com" />
				</div>
				<div>
					<label for="contactPhone" class="block text-sm font-medium">Contact Phone</label>
					<input type="tel" id="contactPhone" bind:value={contactPhone} class="input mt-1 w-full" placeholder="(555) 123-4567" />
				</div>
			</div>

			<div>
				<label for="website" class="block text-sm font-medium">Website (optional)</label>
				<input type="url" id="website" bind:value={website} class="input mt-1 w-full" placeholder="https://www.example.com" />
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/community/type" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500" disabled={!isValid}>
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
