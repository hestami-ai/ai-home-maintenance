<script lang="ts">
	import { ArrowLeft, Check, Loader2, Home, User, Building2, Sparkles, Wrench } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { propertyOwnerOnboarding, organizationStore } from '$lib/stores';
	import { organizationApi } from '$lib/api';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		propertyOwnerOnboarding.setStep(5);
	});

	async function handleSubmit() {
		isSubmitting = true;
		error = null;

		try {
			// 1. Create Organization
			const orgResult = await organizationApi.create({
				name: $propertyOwnerOnboarding.organizationDetails.name,
				slug: $propertyOwnerOnboarding.organizationDetails.slug,
				type: $propertyOwnerOnboarding.organizationType!
			});

			if (!orgResult.ok || !orgResult.data) {
				error = orgResult.error?.message || 'Failed to create organization';
				isSubmitting = false;
				return;
			}

			const org = orgResult.data.organization;

			// 2. Set as default organization
			await organizationApi.setDefault(org.id);

			// 3. Update local store
			organizationStore.addMembership({
				organization: {
					id: org.id,
					name: org.name,
					slug: org.slug,
					type: org.type,
					status: org.status
				},
				role: 'ADMIN',
				isDefault: true
			});

			// TODO: Create PropertyPortfolio via API
			// TODO: Create IndividualProperty via API
			// TODO: Create ExternalHOAContext if applicable

			// 4. Reset wizard and redirect
			propertyOwnerOnboarding.reset();
			goto('/app/concierge');
		} catch (err) {
			error = 'An unexpected error occurred. Please try again.';
			isSubmitting = false;
		}
	}

	const orgTypeLabel = $derived(
		$propertyOwnerOnboarding.organizationType === 'TRUST_OR_LLC'
			? 'Trust / LLC'
			: 'Individual'
	);

	const hoaLabel = $derived(
		$propertyOwnerOnboarding.hoa.hasHoa === 'none'
			? 'No HOA'
			: $propertyOwnerOnboarding.hoa.hasHoa === 'external'
				? $propertyOwnerOnboarding.hoa.hoaName || 'External HOA'
				: 'Platform HOA'
	);

	const modeLabel = $derived(
		$propertyOwnerOnboarding.preferences.mode === 'concierge'
			? 'Concierge Mode'
			: 'DIY Mode'
	);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Review Your Information</h2>
		<p class="mt-1 text-sm text-surface-500">Please confirm everything looks correct</p>
	</div>

	{#if error}
		<div class="rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
			{error}
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Organization -->
		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						{#if $propertyOwnerOnboarding.organizationType === 'TRUST_OR_LLC'}
							<Building2 class="h-5 w-5 text-secondary-500" />
						{:else}
							<User class="h-5 w-5 text-secondary-500" />
						{/if}
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Organization</p>
						<p class="font-semibold">{$propertyOwnerOnboarding.organizationDetails.name}</p>
						<p class="text-sm text-surface-500">{orgTypeLabel}</p>
						<p class="text-xs text-surface-500">hestami.ai/{$propertyOwnerOnboarding.organizationDetails.slug}</p>
					</div>
				</div>
				<a href="/onboarding/property-owner/details" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<!-- Property -->
		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Home class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Property</p>
						<p class="font-semibold">{$propertyOwnerOnboarding.property.name || 'Primary Property'}</p>
						<p class="text-sm text-surface-500">
							{$propertyOwnerOnboarding.property.addressLine1}
							{#if $propertyOwnerOnboarding.property.addressLine2}
								, {$propertyOwnerOnboarding.property.addressLine2}
							{/if}
						</p>
						<p class="text-sm text-surface-500">
							{$propertyOwnerOnboarding.property.city}, {$propertyOwnerOnboarding.property.state} {$propertyOwnerOnboarding.property.zipCode}
						</p>
					</div>
				</div>
				<a href="/onboarding/property-owner/property" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<!-- HOA -->
		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Building2 class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">HOA</p>
						<p class="font-semibold">{hoaLabel}</p>
						{#if $propertyOwnerOnboarding.hoa.hasHoa === 'external' && $propertyOwnerOnboarding.hoa.hoaContact}
							<p class="text-sm text-surface-500">{$propertyOwnerOnboarding.hoa.hoaContact}</p>
						{/if}
					</div>
				</div>
				<a href="/onboarding/property-owner/hoa" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<!-- Preferences -->
		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						{#if $propertyOwnerOnboarding.preferences.mode === 'concierge'}
							<Sparkles class="h-5 w-5 text-success-500" />
						{:else}
							<Wrench class="h-5 w-5 text-success-500" />
						{/if}
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Management Style</p>
						<p class="font-semibold">{modeLabel}</p>
						<p class="text-sm text-surface-500">
							{#if $propertyOwnerOnboarding.preferences.mode === 'concierge'}
								We'll help manage your property services
							{:else}
								You'll manage services yourself
							{/if}
						</p>
					</div>
				</div>
				<a href="/onboarding/property-owner/preferences" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/property-owner/preferences" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button
			type="button"
			onclick={handleSubmit}
			class="btn preset-filled-primary-500"
			disabled={isSubmitting}
		>
			{#if isSubmitting}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Creating...
			{:else}
				<Check class="mr-2 h-4 w-4" />
				Create Organization
			{/if}
		</button>
	</div>
</div>
