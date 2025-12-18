<script lang="ts">
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { communityOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let boardSeats = $state($communityOnboarding.governance.boardSeats);
	let fiscalYearStart = $state($communityOnboarding.governance.fiscalYearStart);
	let annualMeetingMonth = $state($communityOnboarding.governance.annualMeetingMonth);
	let hasCcrs = $state($communityOnboarding.governance.hasCcrs);
	let hasBylaws = $state($communityOnboarding.governance.hasBylaws);
	let hasRules = $state($communityOnboarding.governance.hasRules);

	const months = [
		{ value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
		{ value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
		{ value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
		{ value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
	];

	onMount(() => {
		communityOnboarding.setStep(2);
	});

	function handleNext() {
		communityOnboarding.setGovernance({
			boardSeats,
			fiscalYearStart,
			annualMeetingMonth,
			hasCcrs,
			hasBylaws,
			hasRules
		});
		goto('/onboarding/community/data');
	}

	const isAssociation = $derived($communityOnboarding.organizationType === 'COMMUNITY_ASSOCIATION');
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">
			{#if isAssociation}
				Governance Structure
			{:else}
				Company Details
			{/if}
		</h2>
		<p class="mt-1 text-sm text-surface-500">
			{#if isAssociation}
				Tell us about your community's governance
			{:else}
				Tell us about your management company
			{/if}
		</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-6">
			{#if isAssociation}
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<label for="boardSeats" class="block text-sm font-medium">Board Seats</label>
						<input
							type="number"
							id="boardSeats"
							bind:value={boardSeats}
							min="1"
							max="15"
							class="input mt-1 w-full"
						/>
					</div>
					<div>
						<label for="fiscalYearStart" class="block text-sm font-medium">Fiscal Year Starts</label>
						<select id="fiscalYearStart" bind:value={fiscalYearStart} class="select mt-1 w-full">
							{#each months as month}
								<option value={month.value}>{month.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="annualMeetingMonth" class="block text-sm font-medium">Annual Meeting</label>
						<select id="annualMeetingMonth" bind:value={annualMeetingMonth} class="select mt-1 w-full">
							{#each months as month}
								<option value={month.value}>{month.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div>
					<p class="text-sm font-medium">Governing Documents</p>
					<p class="mt-1 text-xs text-surface-500">Select the documents your community has (you can upload them later)</p>
					<div class="mt-3 space-y-2">
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={hasCcrs} class="checkbox" />
							<span class="text-sm">CC&Rs (Covenants, Conditions & Restrictions)</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={hasBylaws} class="checkbox" />
							<span class="text-sm">Bylaws</span>
						</label>
						<label class="flex items-center gap-2">
							<input type="checkbox" bind:checked={hasRules} class="checkbox" />
							<span class="text-sm">Rules & Regulations</span>
						</label>
					</div>
				</div>
			{:else}
				<div class="text-center py-8">
					<p class="text-surface-500">Management company governance settings will be configured after setup.</p>
				</div>
			{/if}
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/community/details" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500">
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
