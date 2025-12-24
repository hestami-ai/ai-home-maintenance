<script lang="ts">
	import { ArrowLeft, ArrowRight, Shield, AlertCircle } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let hasBusinessLicense = $state($serviceProviderOnboarding.compliance.hasBusinessLicense);
	let licenseNumber = $state($serviceProviderOnboarding.compliance.licenseNumber);
	let licenseState = $state($serviceProviderOnboarding.compliance.licenseState);
	let hasGeneralLiability = $state($serviceProviderOnboarding.compliance.hasGeneralLiability);
	let hasWorkersComp = $state($serviceProviderOnboarding.compliance.hasWorkersComp);

	const usStates = [
		'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
		'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
		'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
		'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
		'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
	];

	onMount(() => {
		serviceProviderOnboarding.setStep(1);
	});

	function handleNext() {
		serviceProviderOnboarding.setCompliance({
			hasBusinessLicense,
			licenseNumber: licenseNumber.trim(),
			licenseState,
			hasGeneralLiability,
			hasWorkersComp
		});
		goto('/onboarding/service-provider/area');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Compliance Information</h2>
		<p class="mt-1 text-sm text-surface-500">Tell us about your licenses and insurance</p>
	</div>

	<div class="rounded-lg border border-warning-500/50 bg-warning-500/10 p-4">
		<div class="flex items-start gap-3">
			<AlertCircle class="h-5 w-5 flex-shrink-0 text-warning-500" />
			<div>
				<p class="font-medium text-warning-700 dark:text-warning-300">Complete Later</p>
				<p class="mt-1 text-sm text-warning-600 dark:text-warning-400">
					You can skip this step now and add compliance documents later. However, you'll need valid licenses and insurance to accept jobs.
				</p>
			</div>
		</div>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-6">
			<div>
				<div class="flex items-center gap-3">
					<Shield class="h-5 w-5 text-primary-500" />
					<h3 class="font-medium">Business License</h3>
				</div>
				<div class="mt-3 space-y-3">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={hasBusinessLicense} class="checkbox" />
						<span class="text-sm">I have a valid business license</span>
					</label>
					{#if hasBusinessLicense}
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="licenseNumber" class="block text-sm font-medium">License Number</label>
								<input type="text" id="licenseNumber" bind:value={licenseNumber} class="input mt-1 w-full" placeholder="ABC123456" />
							</div>
							<div>
								<label for="licenseState" class="block text-sm font-medium">State</label>
								<select id="licenseState" bind:value={licenseState} class="select mt-1 w-full">
									<option value="">Select state...</option>
									{#each usStates as st}
										<option value={st}>{st}</option>
									{/each}
								</select>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<hr class="border-surface-300-700" />

			<div>
				<div class="flex items-center gap-3">
					<Shield class="h-5 w-5 text-success-500" />
					<h3 class="font-medium">Insurance</h3>
				</div>
				<div class="mt-3 space-y-3">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={hasGeneralLiability} class="checkbox" />
						<span class="text-sm">General Liability Insurance</span>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={hasWorkersComp} class="checkbox" />
						<span class="text-sm">Workers' Compensation Insurance</span>
					</label>
				</div>
			</div>
		</div>
	</Card>

	<p class="text-xs text-surface-500">
		You'll be able to upload actual license and insurance documents after completing setup.
	</p>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/service-provider/details" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500">
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
