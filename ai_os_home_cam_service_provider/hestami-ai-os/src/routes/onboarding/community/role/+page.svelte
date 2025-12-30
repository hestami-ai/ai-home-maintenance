<script lang="ts">
	import { ArrowLeft, ArrowRight, Shield, Users, Award } from 'lucide-svelte';
	import { communityOnboarding } from '$lib/stores';
	import { goto } from '$app/navigation';

	let selectedRole = $state<'ADMIN' | 'MANAGER' | 'BOARD_MEMBER'>($communityOnboarding.userRole);

	const roles = [
		{
			value: 'ADMIN' as const,
			label: 'Administrator',
			description: 'Full access to all features and settings',
			icon: Shield,
			color: 'text-error-500',
			bgColor: 'bg-error-500/10'
		},
		{
			value: 'MANAGER' as const,
			label: 'Community Manager',
			description: 'Manage day-to-day operations, units, and work orders',
			icon: Users,
			color: 'text-warning-500',
			bgColor: 'bg-warning-500/10'
		},
		{
			value: 'BOARD_MEMBER' as const,
			label: 'Board Member',
			description: 'Review and approve decisions, access reports',
			icon: Award,
			color: 'text-primary-500',
			bgColor: 'bg-primary-500/10'
		}
	];

	$effect.pre(() => {
		communityOnboarding.setStep(4);
	});

	function selectRole(role: 'ADMIN' | 'MANAGER' | 'BOARD_MEMBER') {
		selectedRole = role;
		communityOnboarding.setUserRole(role);
		goto('/onboarding/community/review');
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Your Role</h2>
		<p class="mt-1 text-sm text-surface-500">What is your role in this organization?</p>
	</div>

	<div class="space-y-4">
		{#each roles as role}
			<button
				type="button"
				onclick={() => selectRole(role.value)}
				class="w-full rounded-xl border-2 p-4 text-left transition-all
					{selectedRole === role.value
						? 'border-primary-500 bg-primary-500/5'
						: 'border-surface-300-700 hover:border-primary-500/50'}"
			>
				<div class="flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-full {role.bgColor}">
						<role.icon class="h-6 w-6 {role.color}" />
					</div>
					<div class="flex-1">
						<h3 class="font-semibold">{role.label}</h3>
						<p class="text-sm text-surface-500">{role.description}</p>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<div class="flex justify-between pt-4">
		<a href="/onboarding/community/data" class="btn preset-tonal-surface">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</a>
		<div></div>
	</div>
</div>
