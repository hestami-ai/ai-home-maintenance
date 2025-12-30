<script lang="ts">
	interface Props {
		data: {
			onboardingState: any;
		};
	}

	let { data }: Props = $props();

	import { User, Building } from 'lucide-svelte';
	import { propertyOwnerOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	function selectType(type: 'INDIVIDUAL_PROPERTY_OWNER' | 'TRUST_OR_LLC') {
		propertyOwnerOnboarding.setOrganizationType(type);
		goto('/onboarding/property-owner/details');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">How do you own your property?</h2>
		<p class="mt-1 text-sm text-surface-500">This helps us set up your account correctly</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<button
			type="button"
			onclick={() => selectType('INDIVIDUAL_PROPERTY_OWNER')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{$propertyOwnerOnboarding.organizationType === 'INDIVIDUAL_PROPERTY_OWNER'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500/10">
					<User class="h-6 w-6 text-secondary-500" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold">Individual</h3>
					<p class="mt-1 text-sm text-surface-500">
						I own property in my personal name
					</p>
				</div>
			</div>
		</button>

		<button
			type="button"
			onclick={() => selectType('TRUST_OR_LLC')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{$propertyOwnerOnboarding.organizationType === 'TRUST_OR_LLC'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
					<Building class="h-6 w-6 text-primary-500" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold">Trust, LLC, or Entity</h3>
					<p class="mt-1 text-sm text-surface-500">
						Property is owned by a trust, LLC, or other legal entity
					</p>
				</div>
			</div>
		</button>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding" class="btn preset-tonal-surface">
			Back
		</a>
		<div></div>
	</div>
</div>
