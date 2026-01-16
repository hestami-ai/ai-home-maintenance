<script lang="ts">
	import { ArrowLeft, Check, Loader2, Wrench, Shield, MapPin, Clock } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';
	import { orpc } from '$lib/api';
	import { goto } from '$app/navigation';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	$effect.pre(() => {
		serviceProviderOnboarding.setStep(4);
	});

	async function handleSubmit() {
		isSubmitting = true;
		error = null;

		try {
			// Type-safe oRPC call
			const result = await orpc.organization.create({
				idempotencyKey: crypto.randomUUID(),
				name: $serviceProviderOnboarding.businessDetails.name,
				slug: $serviceProviderOnboarding.businessDetails.slug,
				type: 'SERVICE_PROVIDER'
			});

			const org = result.data.organization;
			await orpc.organization.setDefault({ idempotencyKey: crypto.randomUUID(), organizationId: org.id });

			// Store update removed

			// TODO: Create ContractorProfile via API
			// TODO: Create ContractorBranch via API

			serviceProviderOnboarding.reset();
			goto('/app/contractor');
		} catch (err) {
			error = 'An unexpected error occurred. Please try again.';
			isSubmitting = false;
		}
	}

	const complianceStatus = $derived(() => {
		const c = $serviceProviderOnboarding.compliance;
		const items = [];
		if (c.hasBusinessLicense) items.push('Business License');
		if (c.hasGeneralLiability) items.push('General Liability');
		if (c.hasWorkersComp) items.push("Workers' Comp");
		return items.length > 0 ? items.join(', ') : 'Not yet provided';
	});

	const serviceAreaSummary = $derived(() => {
		const a = $serviceProviderOnboarding.serviceArea;
		const parts = [];
		if (a.zipCodes.length > 0) parts.push(`${a.zipCodes.length} ZIP codes`);
		if (a.states.length > 0) parts.push(`${a.states.length} states`);
		parts.push(`${a.serviceRadius} mi radius`);
		return parts.join(' • ');
	});

	const operationsSummary = $derived(() => {
		const o = $serviceProviderOnboarding.operations;
		return `${o.businessHoursStart} - ${o.businessHoursEnd}, ${o.workDays.length} days/week`;
	});
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Review Your Information</h2>
		<p class="mt-1 text-sm text-surface-500">Please confirm everything looks correct</p>
	</div>

	{#if error}
		<div class="rounded-lg bg-error-500/10 p-4 text-sm text-error-500">{error}</div>
	{/if}

	<div class="space-y-4">
		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
						<Wrench class="h-5 w-5 text-success-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Business</p>
						<p class="font-semibold">{$serviceProviderOnboarding.businessDetails.name}</p>
						<p class="text-sm text-surface-500">
							{$serviceProviderOnboarding.businessDetails.serviceCategories.length} service categories
						</p>
						<p class="text-xs text-surface-500">hestami.ai/{$serviceProviderOnboarding.businessDetails.slug}</p>
					</div>
				</div>
				<a href="/onboarding/service-provider/details" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Shield class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Compliance</p>
						<p class="font-semibold">{complianceStatus()}</p>
					</div>
				</div>
				<a href="/onboarding/service-provider/compliance" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
						<MapPin class="h-5 w-5 text-secondary-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Service Area</p>
						<p class="font-semibold">{serviceAreaSummary()}</p>
					</div>
				</div>
				<a href="/onboarding/service-provider/area" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Clock class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Operations</p>
						<p class="font-semibold">{operationsSummary()}</p>
						{#if $serviceProviderOnboarding.operations.emergencyServices}
							<p class="text-sm text-success-500">Emergency services available</p>
						{/if}
					</div>
				</div>
				<a href="/onboarding/service-provider/operations" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/service-provider/operations" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleSubmit} class="btn preset-filled-primary-500" disabled={isSubmitting}>
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
