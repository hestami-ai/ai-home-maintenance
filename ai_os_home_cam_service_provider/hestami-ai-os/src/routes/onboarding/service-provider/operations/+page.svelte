<script lang="ts">
	import { ArrowLeft, ArrowRight, Clock, Users } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { serviceProviderOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let businessHoursStart = $state($serviceProviderOnboarding.operations.businessHoursStart);
	let businessHoursEnd = $state($serviceProviderOnboarding.operations.businessHoursEnd);
	let workDays = $state<string[]>([...$serviceProviderOnboarding.operations.workDays]);
	let emergencyServices = $state($serviceProviderOnboarding.operations.emergencyServices);
	let teamSize = $state($serviceProviderOnboarding.operations.teamSize);

	const daysOfWeek = [
		{ value: 'monday', label: 'Mon' },
		{ value: 'tuesday', label: 'Tue' },
		{ value: 'wednesday', label: 'Wed' },
		{ value: 'thursday', label: 'Thu' },
		{ value: 'friday', label: 'Fri' },
		{ value: 'saturday', label: 'Sat' },
		{ value: 'sunday', label: 'Sun' }
	];

	const teamSizeOptions = [
		{ value: 'solo', label: 'Solo (just me)' },
		{ value: '2-5', label: '2-5 employees' },
		{ value: '6-20', label: '6-20 employees' },
		{ value: '20+', label: '20+ employees' }
	];

	onMount(() => {
		serviceProviderOnboarding.setStep(3);
	});

	function toggleDay(day: string) {
		if (workDays.includes(day)) {
			workDays = workDays.filter((d) => d !== day);
		} else {
			workDays = [...workDays, day];
		}
	}

	function handleNext() {
		serviceProviderOnboarding.setOperations({
			businessHoursStart,
			businessHoursEnd,
			workDays,
			emergencyServices,
			teamSize
		});
		goto('/onboarding/service-provider/review');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Operations</h2>
		<p class="mt-1 text-sm text-surface-500">Set up your business hours and capacity</p>
	</div>

	<Card variant="outlined" padding="lg">
		<div class="space-y-6">
			<div>
				<div class="flex items-center gap-3">
					<Clock class="h-5 w-5 text-primary-500" />
					<h3 class="font-medium">Business Hours</h3>
				</div>
				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					<div>
						<label for="businessHoursStart" class="block text-sm font-medium">Start Time</label>
						<input type="time" id="businessHoursStart" bind:value={businessHoursStart} class="input mt-1 w-full" />
					</div>
					<div>
						<label for="businessHoursEnd" class="block text-sm font-medium">End Time</label>
						<input type="time" id="businessHoursEnd" bind:value={businessHoursEnd} class="input mt-1 w-full" />
					</div>
				</div>
			</div>

			<div>
				<h3 class="font-medium">Work Days</h3>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each daysOfWeek as day}
						<button
							type="button"
							onclick={() => toggleDay(day.value)}
							class="rounded-full px-4 py-2 text-sm transition-colors
								{workDays.includes(day.value)
									? 'bg-primary-500 text-white'
									: 'bg-surface-200-800 hover:bg-surface-300-700'}"
						>
							{day.label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={emergencyServices} class="checkbox" />
					<span class="text-sm font-medium">Available for emergency/after-hours services</span>
				</label>
			</div>

			<hr class="border-surface-300-700" />

			<div>
				<div class="flex items-center gap-3">
					<Users class="h-5 w-5 text-secondary-500" />
					<h3 class="font-medium">Team Size</h3>
				</div>
				<div class="mt-3 space-y-2">
					{#each teamSizeOptions as option}
						<label class="flex items-center gap-2">
							<input type="radio" bind:group={teamSize} value={option.value} class="radio" />
							<span class="text-sm">{option.label}</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</Card>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/service-provider/area" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<button type="button" onclick={handleNext} class="btn preset-filled-primary-500">
			Next
			<ArrowRight class="ml-2 h-4 w-4" />
		</button>
	</div>
</div>
