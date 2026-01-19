<script lang="ts">
	import { ARCCategoryValues, PartyTypeValues } from '$lib/api/cam';
	interface Props {
		data: {
			onboardingState: any;
			user: any;
		};
	}

	let { data }: Props = $props();

	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	const businessTypes = [
		{ value: 'sole_proprietor', label: 'Sole Proprietor' },
		{ value: 'llc', label: PartyTypeValues.LLC },
		{ value: 'corporation', label: 'Corporation' },
		{ value: 'partnership', label: 'Partnership' }
	];

	const serviceCategoryOptions = [
		{ value: 'hvac', label: ARCCategoryValues.HVAC },
		{ value: 'plumbing', label: 'Plumbing' },
		{ value: 'electrical', label: 'Electrical' },
		{ value: 'landscaping', label: 'Landscaping' },
		{ value: 'cleaning', label: 'Cleaning' },
		{ value: 'painting', label: 'Painting' },
		{ value: 'roofing', label: 'Roofing' },
		{ value: 'general', label: 'General Contracting' },
		{ value: 'pest_control', label: 'Pest Control' },
		{ value: 'pool', label: 'Pool & Spa' },
		{ value: 'security', label: 'Security' },
		{ value: 'other', label: 'Other' }
	];

	let name = $state($serviceProviderOnboarding.businessDetails.name);
	let slug = $state($serviceProviderOnboarding.businessDetails.slug);
	let businessType = $state($serviceProviderOnboarding.businessDetails.businessType);
	let contactName = $state($serviceProviderOnboarding.businessDetails.contactName);
	let contactEmail = $state($serviceProviderOnboarding.businessDetails.contactEmail);
	let contactPhone = $state($serviceProviderOnboarding.businessDetails.contactPhone);
	let website = $state($serviceProviderOnboarding.businessDetails.website);
	let serviceCategories = $state<string[]>($serviceProviderOnboarding.businessDetails.serviceCategories);

	let slugTouched = $state(false);
	let slugError = $state<string | null>(null);

	// Pre-fill with user data if empty (runs once)
	// Track data to trigger re-runs on navigation, but guard against undefined
	let hasPreFilled = $state(false);
	$effect(() => {
		if (data == null || typeof data !== 'object') return;
		if (!hasPreFilled && data.user) {
			if (!contactName && data.user.name) contactName = data.user.name;
			if (!contactEmail && data.user.email) contactEmail = data.user.email;
			hasPreFilled = true;
		}
	});


	function generateSlug(fromName: string) {
		if (!slugTouched) {
			slug = fromName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
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

	function toggleCategory(category: string) {
		if (serviceCategories.includes(category)) {
			serviceCategories = serviceCategories.filter((c) => c !== category);
		} else {
			serviceCategories = [...serviceCategories, category];
		}
	}

	function handleNext() {
		if (!name.trim() || !slug.trim() || slugError) return;

		serviceProviderOnboarding.setBusinessDetails({
			name: name.trim(),
			slug: slug.trim(),
			businessType,
			contactName: contactName.trim(),
			contactEmail: contactEmail.trim(),
			contactPhone: contactPhone.trim(),
			website: website.trim(),
			serviceCategories
		});

		goto('/onboarding/service-provider/compliance');
	}

	const isValid = $derived(name.trim().length > 0 && slug.trim().length > 0 && !slugError);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Business Details</h2>
		<p class="mt-1 text-sm text-surface-500">Tell us about your service business</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-4">
			<div>
				<label for="name" class="block text-sm font-medium">
					Business Name <span class="text-error-500">*</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					oninput={handleNameChange}
					class="input mt-1 w-full"
					placeholder="ABC Plumbing Services"
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
						placeholder="abc-plumbing"
						required
					/>
				</div>
				{#if slugError}
					<p class="mt-1 text-xs text-error-500">{slugError}</p>
				{/if}
			</div>

			<div>
				<label for="businessType" class="block text-sm font-medium">Business Type</label>
				<select id="businessType" bind:value={businessType} class="select mt-1 w-full">
					<option value="">Select type...</option>
					{#each businessTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="contactName" class="block text-sm font-medium">Contact Name</label>
					<input type="text" id="contactName" bind:value={contactName} class="input mt-1 w-full" placeholder="John Smith" />
				</div>
				<div>
					<label for="contactEmail" class="block text-sm font-medium">Contact Email</label>
					<input type="email" id="contactEmail" bind:value={contactEmail} class="input mt-1 w-full" placeholder="john@example.com" />
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="contactPhone" class="block text-sm font-medium">Contact Phone</label>
					<input type="tel" id="contactPhone" bind:value={contactPhone} class="input mt-1 w-full" placeholder="(555) 123-4567" />
				</div>
				<div>
					<label for="website" class="block text-sm font-medium">Website (optional)</label>
					<input type="url" id="website" bind:value={website} class="input mt-1 w-full" placeholder="https://www.example.com" />
				</div>
			</div>

			<div>
				<p class="text-sm font-medium">Service Categories</p>
				<p class="mt-1 text-xs text-surface-500">Select all services you provide</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each serviceCategoryOptions as option}
						<button
							type="button"
							onclick={() => toggleCategory(option.value)}
							class="rounded-full px-4 py-2 text-sm transition-colors
								{serviceCategories.includes(option.value)
									? 'bg-primary-500 text-white'
									: 'bg-surface-200-800 hover:bg-surface-300-700'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500" disabled={!isValid}>
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
