<script lang="ts">
	import { OrganizationTypeValues } from '$lib/api/cam';
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let name = $state($propertyOwnerOnboarding.organizationDetails.name);
	let slug = $state($propertyOwnerOnboarding.organizationDetails.slug);
	let contactEmail = $state($propertyOwnerOnboarding.organizationDetails.contactEmail);
	let contactPhone = $state($propertyOwnerOnboarding.organizationDetails.contactPhone);

	let slugTouched = $state(false);
	let slugError = $state<string | null>(null);

	// Set step and pre-fill on component init
	$effect.pre(() => {
		propertyOwnerOnboarding.setStep(1);
	});

	// Pre-fill with user data if empty (runs once)
	// Track data to trigger re-runs on navigation, but guard against undefined
	let hasPreFilled = $state(false);
	$effect(() => {
		if (data == null || typeof data !== 'object') return;
		if (!hasPreFilled && data.user) {
			if (!name && data.user.name) {
				name = data.user.name;
				generateSlug(name);
			}
			if (!contactEmail && data.user.email) {
				contactEmail = data.user.email;
			}
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
		// Validate slug format
		if (!/^[a-z0-9-]+$/.test(slug)) {
			slugError = 'Slug can only contain lowercase letters, numbers, and hyphens';
		} else {
			slugError = null;
		}
	}

	function handleNext() {
		if (!name.trim()) return;
		if (!slug.trim() || slugError) return;

		propertyOwnerOnboarding.setOrganizationDetails({
			name: name.trim(),
			slug: slug.trim(),
			contactEmail: contactEmail.trim(),
			contactPhone: contactPhone.trim()
		});

		goto('/onboarding/property-owner/property');
	}

	const isValid = $derived(name.trim().length > 0 && slug.trim().length > 0 && !slugError);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Organization Details</h2>
		<p class="mt-1 text-sm text-surface-500">
			{#if $propertyOwnerOnboarding.organizationType === OrganizationTypeValues.TRUST_OR_LLC}
				Enter your trust or LLC information
			{:else}
				We'll use your name for your property account
			{/if}
		</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-4">
			<!-- Name -->
			<div>
				<label for="name" class="block text-sm font-medium">
					{#if $propertyOwnerOnboarding.organizationType === OrganizationTypeValues.TRUST_OR_LLC}
						Entity Name
					{:else}
						Your Name
					{/if}
					<span class="text-error-500">*</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					oninput={handleNameChange}
					class="input mt-1 w-full"
					placeholder={$propertyOwnerOnboarding.organizationType === OrganizationTypeValues.TRUST_OR_LLC
						? 'Smith Family Trust'
						: 'John Smith'}
					required
				/>
			</div>

			<!-- Slug -->
			<div>
				<label for="slug" class="block text-sm font-medium">
					Account URL
					<span class="text-error-500">*</span>
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
						placeholder="john-smith"
						required
					/>
				</div>
				{#if slugError}
					<p class="mt-1 text-xs text-error-500">{slugError}</p>
				{:else}
					<p class="mt-1 text-xs text-surface-500">This will be your unique account identifier</p>
				{/if}
			</div>

			<!-- Contact Email -->
			<div>
				<label for="contactEmail" class="block text-sm font-medium">Contact Email</label>
				<input
					type="email"
					id="contactEmail"
					bind:value={contactEmail}
					class="input mt-1 w-full"
					placeholder="john@example.com"
				/>
			</div>

			<!-- Contact Phone -->
			<div>
				<label for="contactPhone" class="block text-sm font-medium">Contact Phone</label>
				<input
					type="tel"
					id="contactPhone"
					bind:value={contactPhone}
					class="input mt-1 w-full"
					placeholder="(555) 123-4567"
				/>
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/property-owner/type" class="btn preset-tonal-surface">
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
