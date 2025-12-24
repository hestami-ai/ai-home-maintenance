<script lang="ts">
	import { Check, X, UserMinus, UserCheck } from 'lucide-svelte';

	interface Attendee {
		partyId: string;
		name: string | null;
		status: string;
		proxyFor?: string | null;
	}

	interface Props {
		attendees: Attendee[];
		editable?: boolean;
		onStatusChange?: (partyId: string, status: string) => void;
	}

	let { attendees, editable = false, onStatusChange }: Props = $props();

	const statusConfig: Record<string, { color: string; icon: typeof Check; label: string }> = {
		PRESENT: { color: 'text-success-500', icon: UserCheck, label: 'Present' },
		ABSENT: { color: 'text-error-500', icon: UserMinus, label: 'Absent' },
		EXCUSED: { color: 'text-warning-500', icon: X, label: 'Excused' }
	};

	const presentCount = $derived(attendees.filter(a => a.status !== 'ABSENT').length);
	const totalCount = $derived(attendees.length);

	function handleStatusChange(partyId: string, newStatus: string) {
		if (onStatusChange) {
			onStatusChange(partyId, newStatus);
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium">Attendance</span>
		<span class="text-surface-500">{presentCount} / {totalCount} present</span>
	</div>

	<div class="divide-y divide-surface-300-600-token">
		{#each attendees as attendee (attendee.partyId)}
			{@const config = statusConfig[attendee.status] || statusConfig.ABSENT}
			{@const StatusIcon = config.icon}
			
			<div class="flex items-center justify-between py-2 gap-2">
				<div class="flex items-center gap-2 min-w-0">
					<span class="{config.color}">
						<StatusIcon size={16} />
					</span>
					<span class="text-sm truncate">{attendee.name || 'Unknown'}</span>
					{#if attendee.proxyFor}
						<span class="text-xs text-surface-500">(proxy)</span>
					{/if}
				</div>

				{#if editable}
					<div class="flex items-center gap-1">
						<button
							type="button"
							class="btn btn-sm"
							class:variant-filled-success={attendee.status === 'PRESENT'}
							class:variant-ghost={attendee.status !== 'PRESENT'}
							onclick={() => handleStatusChange(attendee.partyId, 'PRESENT')}
							title="Present"
						>
							<Check size={14} />
						</button>
						<button
							type="button"
							class="btn btn-sm"
							class:variant-filled-error={attendee.status === 'ABSENT'}
							class:variant-ghost={attendee.status !== 'ABSENT'}
							onclick={() => handleStatusChange(attendee.partyId, 'ABSENT')}
							title="Absent"
						>
							<X size={14} />
						</button>
						<button
							type="button"
							class="btn btn-sm"
							class:variant-filled-warning={attendee.status === 'EXCUSED'}
							class:variant-ghost={attendee.status !== 'EXCUSED'}
							onclick={() => handleStatusChange(attendee.partyId, 'EXCUSED')}
							title="Excused"
						>
							<UserMinus size={14} />
						</button>
					</div>
				{:else}
					<span class="badge {config.color} variant-soft text-xs">{config.label}</span>
				{/if}
			</div>
		{/each}
	</div>

	{#if attendees.length === 0}
		<p class="text-sm text-surface-500 text-center py-4">No attendees recorded</p>
	{/if}
</div>
