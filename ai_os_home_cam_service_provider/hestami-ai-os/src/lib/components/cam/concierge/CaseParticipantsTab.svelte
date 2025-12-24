<script lang="ts">
	import { Users, User, Building2, Truck, Plus } from 'lucide-svelte';
	import { EmptyState } from '$lib/components/ui';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();

	function getRoleIcon(role: string) {
		switch (role) {
			case 'OWNER':
				return User;
			case 'HOA':
				return Building2;
			case 'VENDOR':
				return Truck;
			default:
				return Users;
		}
	}

	function getRoleColor(role: string): string {
		switch (role) {
			case 'OWNER':
				return 'text-blue-500 bg-blue-500/10';
			case 'HOA':
				return 'text-purple-500 bg-purple-500/10';
			case 'VENDOR':
				return 'text-amber-500 bg-amber-500/10';
			case 'CONCIERGE':
				return 'text-green-500 bg-green-500/10';
			default:
				return 'text-surface-500 bg-surface-500/10';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">
			Participants
		</h3>
	</div>

	{#if caseDetail.participants.length === 0}
		<EmptyState
			title="No participants"
			description="People involved in this case will be listed here."
		>
			{#snippet actions()}
				<button class="btn preset-outlined-primary-500">
					<Plus size={16} class="mr-2" />
					Add Participant
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="space-y-3">
			{#each caseDetail.participants as participant}
				{@const RoleIcon = getRoleIcon(participant.role)}
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-4">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {getRoleColor(participant.role)}">
							<RoleIcon size={20} />
						</div>
						<div>
							<p class="font-medium">
								{participant.partyName || participant.externalContactName || 'Unknown'}
							</p>
							<p class="text-sm text-surface-500">{participant.role}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
