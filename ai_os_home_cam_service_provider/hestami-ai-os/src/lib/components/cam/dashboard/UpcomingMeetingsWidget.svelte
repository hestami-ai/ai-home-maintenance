<script lang="ts">
	import { FundTypeValues, MeetingTypeValues } from '$lib/api/cam';
	import { Calendar, Clock, MapPin } from 'lucide-svelte';

	interface Meeting {
		id: string;
		title: string;
		type: string;
		date: string;
		time: string;
		location?: string;
	}

	interface Props {
		meetings?: Meeting[];
		loading?: boolean;
	}

	let { meetings = [], loading = false }: Props = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return 'Tomorrow';
		}
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function getTypeColor(type: string): string {
		switch (type) {
			case MeetingTypeValues.BOARD: return 'bg-primary-500';
			case MeetingTypeValues.ANNUAL: return 'bg-success-500';
			case FundTypeValues.SPECIAL: return 'bg-warning-500';
			case 'COMMITTEE': return 'bg-secondary-500';
			default: return 'bg-surface-500';
		}
	}
</script>

<div class="rounded-lg border border-surface-300-700 bg-surface-100-900">
	<div class="flex items-center justify-between border-b border-surface-300-700 px-4 py-3">
		<div class="flex items-center gap-2">
			<Calendar class="h-5 w-5 text-primary-500" />
			<h3 class="font-semibold">Upcoming Meetings</h3>
		</div>
		<a
			href="/app/cam/governance/meetings"
			class="text-sm text-primary-500 hover:text-primary-600"
		>
			View All
		</a>
	</div>

	<div class="p-4">
		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<div class="h-16 animate-pulse rounded bg-surface-200-800"></div>
				{/each}
			</div>
		{:else if meetings.length === 0}
			<div class="py-4 text-center text-sm text-surface-500">
				No upcoming meetings
			</div>
		{:else}
			<div class="space-y-3">
				{#each meetings.slice(0, 4) as meeting}
					<a
						href="/app/cam/governance/meetings?id={meeting.id}"
						class="block rounded-lg border border-surface-300-700 p-3 transition-colors hover:bg-surface-200-800"
					>
						<div class="flex items-start gap-3">
							<div class="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded bg-surface-200-800 text-center">
								<span class="text-xs font-medium text-surface-500">
									{new Date(meeting.date).toLocaleDateString('en-US', { month: 'short' })}
								</span>
								<span class="text-lg font-bold leading-none">
									{new Date(meeting.date).getDate()}
								</span>
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="h-2 w-2 rounded-full {getTypeColor(meeting.type)}"></span>
									<p class="truncate font-medium">{meeting.title}</p>
								</div>
								<div class="mt-1 flex items-center gap-3 text-xs text-surface-500">
									<span class="flex items-center gap-1">
										<Clock class="h-3 w-3" />
										{meeting.time}
									</span>
									{#if meeting.location}
										<span class="flex items-center gap-1 truncate">
											<MapPin class="h-3 w-3" />
											{meeting.location}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
