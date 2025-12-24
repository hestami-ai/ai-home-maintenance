<script lang="ts">
	import { Building2, Briefcase } from 'lucide-svelte';
	import { communityOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		communityOnboarding.setStep(0);
	});

	function selectType(type: 'COMMUNITY_ASSOCIATION' | 'MANAGEMENT_COMPANY') {
		communityOnboarding.setOrganizationType(type);
		goto('/onboarding/community/details');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">What type of organization are you setting up?</h2>
		<p class="mt-1 text-sm text-surface-500">This determines the features available to you</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<button
			type="button"
			onclick={() => selectType('COMMUNITY_ASSOCIATION')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{$communityOnboarding.organizationType === 'COMMUNITY_ASSOCIATION'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10">
					<Building2 class="h-6 w-6 text-primary-500" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold">Community Association / HOA</h3>
					<p class="mt-1 text-sm text-surface-500">
						A homeowners association, condo association, or community with shared governance
					</p>
				</div>
			</div>
		</button>

		<button
			type="button"
			onclick={() => selectType('MANAGEMENT_COMPANY')}
			class="group relative block rounded-xl border-2 p-6 text-left transition-all
				{$communityOnboarding.organizationType === 'MANAGEMENT_COMPANY'
					? 'border-primary-500 bg-primary-500/5'
					: 'border-surface-300-700 hover:border-primary-500/50'}"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-500/10">
					<Briefcase class="h-6 w-6 text-secondary-500" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold">Management Company</h3>
					<p class="mt-1 text-sm text-surface-500">
						A professional company that manages multiple communities or associations
					</p>
				</div>
			</div>
		</button>
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding" class="btn preset-tonal-surface">Back</a>
		<div></div>
	</div>
</div>
