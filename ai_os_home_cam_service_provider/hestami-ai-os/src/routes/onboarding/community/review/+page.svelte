<script lang="ts">
	import { ArrowLeft, Check, Loader2, Building2, Users, FileText } from 'lucide-svelte';
	import { Card, RoleBadge } from '$lib/components/ui';
	import { communityOnboarding } from '$lib/stores';
	import { orpc } from '$lib/api';
	import { goto } from '$app/navigation';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	$effect.pre(() => {
		communityOnboarding.setStep(5);
	});

	async function handleSubmit() {
		isSubmitting = true;
		error = null;

		try {
			// Build association config for self-managed HOAs
			const associationConfig = $communityOnboarding.organizationType === 'COMMUNITY_ASSOCIATION'
				? {
					boardSeats: $communityOnboarding.governance.boardSeats,
					totalUnits: $communityOnboarding.initialData.totalUnits || undefined,
					// Fiscal year end is the month before fiscal year start (or December if start is January)
					fiscalYearEndMonth: $communityOnboarding.governance.fiscalYearStart > 1
						? $communityOnboarding.governance.fiscalYearStart - 1
						: 12
				}
				: undefined;

			// Type-safe oRPC call
			const result = await orpc.organization.create({
				idempotencyKey: crypto.randomUUID(),
				name: $communityOnboarding.organizationDetails.name,
				slug: $communityOnboarding.organizationDetails.slug,
				type: $communityOnboarding.organizationType!,
				associationConfig
			});

			const org = result.data.organization;
			await orpc.organization.setDefault({ idempotencyKey: crypto.randomUUID(), organizationId: org.id });

			// Client-side store removed - server data will refresh on redirect
			
			communityOnboarding.reset();
			goto('/app/cam');
		} catch (err) {
			error = 'An unexpected error occurred. Please try again.';
			isSubmitting = false;
		}
	}

	const orgTypeLabel = $derived(
		$communityOnboarding.organizationType === 'MANAGEMENT_COMPANY'
			? 'Management Company'
			: 'Community Association'
	);

	const roleLabel = $derived({
		ADMIN: 'Administrator',
		MANAGER: 'Community Manager',
		BOARD_MEMBER: 'Board Member'
	}[$communityOnboarding.userRole]);
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
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
						<Building2 class="h-5 w-5 text-primary-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Organization</p>
						<p class="font-semibold">{$communityOnboarding.organizationDetails.name}</p>
						<p class="text-sm text-surface-500">{orgTypeLabel}</p>
						<p class="text-xs text-surface-500">hestami.ai/{$communityOnboarding.organizationDetails.slug}</p>
					</div>
				</div>
				<a href="/onboarding/community/details" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>

		{#if $communityOnboarding.organizationType === 'COMMUNITY_ASSOCIATION'}
			<Card variant="outlined" padding="md">
				<div class="flex items-start justify-between">
					<div class="flex items-start gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
							<FileText class="h-5 w-5 text-secondary-500" />
						</div>
						<div>
							<p class="text-xs font-medium uppercase text-surface-500">Governance</p>
							<p class="font-semibold">{$communityOnboarding.governance.boardSeats} Board Seats</p>
							<p class="text-sm text-surface-500">
								{$communityOnboarding.initialData.totalUnits || 0} units
							</p>
						</div>
					</div>
					<a href="/onboarding/community/governance" class="text-sm text-primary-500 hover:underline">Edit</a>
				</div>
			</Card>
		{/if}

		<Card variant="outlined" padding="md">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
						<Users class="h-5 w-5 text-warning-500" />
					</div>
					<div>
						<p class="text-xs font-medium uppercase text-surface-500">Your Role</p>
						<p class="font-semibold">{roleLabel}</p>
						<div class="mt-1">
							<RoleBadge role={$communityOnboarding.userRole} size="sm" />
						</div>
					</div>
				</div>
				<a href="/onboarding/community/role" class="text-sm text-primary-500 hover:underline">Edit</a>
			</div>
		</Card>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/community/role" class="btn preset-tonal-surface">
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
