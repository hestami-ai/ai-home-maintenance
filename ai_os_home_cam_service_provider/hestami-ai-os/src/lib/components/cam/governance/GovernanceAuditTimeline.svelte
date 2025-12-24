<script lang="ts">
	import { 
		Calendar, 
		User, 
		FileText, 
		Vote, 
		CheckCircle, 
		XCircle, 
		Clock, 
		Users,
		Gavel,
		ScrollText
	} from 'lucide-svelte';

	interface AuditEvent {
		id: string;
		type: string;
		action: string;
		actor: string;
		actorRole?: string;
		timestamp: string;
		details?: Record<string, unknown>;
	}

	interface Props {
		events: AuditEvent[];
		loading?: boolean;
	}

	let { events, loading = false }: Props = $props();

	const eventConfig: Record<string, { icon: typeof Calendar; color: string; label: string }> = {
		'MEETING:CREATE': { icon: Calendar, color: 'text-blue-500', label: 'Meeting Created' },
		'MEETING:PUBLISH': { icon: Calendar, color: 'text-blue-500', label: 'Agenda Published' },
		'MEETING:START_SESSION': { icon: Users, color: 'text-green-500', label: 'Session Started' },
		'MEETING:ADJOURN': { icon: Clock, color: 'text-orange-500', label: 'Meeting Adjourned' },
		'MEETING:APPROVE_MINUTES': { icon: FileText, color: 'text-green-500', label: 'Minutes Approved' },
		'MEETING:ARCHIVE': { icon: FileText, color: 'text-gray-500', label: 'Meeting Archived' },
		'MOTION:PROPOSE': { icon: Gavel, color: 'text-blue-500', label: 'Motion Proposed' },
		'MOTION:SECOND': { icon: User, color: 'text-blue-500', label: 'Motion Seconded' },
		'MOTION:OPEN_VOTING': { icon: Vote, color: 'text-purple-500', label: 'Voting Opened' },
		'MOTION:DECIDE': { icon: Gavel, color: 'text-green-500', label: 'Motion Decided' },
		'MOTION:TABLE': { icon: Clock, color: 'text-orange-500', label: 'Motion Tabled' },
		'MOTION:WITHDRAW': { icon: XCircle, color: 'text-gray-500', label: 'Motion Withdrawn' },
		'VOTE:CAST': { icon: Vote, color: 'text-purple-500', label: 'Vote Cast' },
		'VOTE:CLOSE': { icon: CheckCircle, color: 'text-green-500', label: 'Voting Closed' },
		'RESOLUTION:ADOPT': { icon: ScrollText, color: 'text-green-500', label: 'Resolution Adopted' },
		'RESOLUTION:SUPERSEDE': { icon: ScrollText, color: 'text-orange-500', label: 'Resolution Superseded' },
		'ATTENDANCE:RECORD': { icon: Users, color: 'text-blue-500', label: 'Attendance Recorded' }
	};

	function getEventConfig(type: string) {
		return eventConfig[type] || { icon: FileText, color: 'text-gray-500', label: type };
	}

	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	function formatRelativeTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}
</script>

<div class="space-y-1">
	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
		</div>
	{:else if events.length === 0}
		<div class="text-center py-8 text-gray-500">
			<Clock size={32} class="mx-auto mb-2 opacity-50" />
			<p class="text-sm">No activity recorded yet</p>
		</div>
	{:else}
		<div class="relative">
			<div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

			{#each events as event, index (event.id)}
				{@const config = getEventConfig(event.type)}
				{@const Icon = config.icon}
				
				<div class="relative flex items-start gap-4 pb-4" class:pb-0={index === events.length - 1}>
					<div class="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 {config.color}">
						<Icon size={14} />
					</div>

					<div class="flex-1 min-w-0 pt-0.5">
						<div class="flex items-center justify-between gap-2">
							<p class="text-sm font-medium">{config.label}</p>
							<span class="text-xs text-gray-500 shrink-0" title={formatTimestamp(event.timestamp)}>
								{formatRelativeTime(event.timestamp)}
							</span>
						</div>

						<div class="flex items-center gap-2 mt-0.5">
							<span class="text-xs text-gray-500">by {event.actor}</span>
							{#if event.actorRole}
								<span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
									{event.actorRole}
								</span>
							{/if}
						</div>

						{#if event.details && Object.keys(event.details).length > 0}
							<div class="mt-1 text-xs text-gray-500">
								{#each Object.entries(event.details) as [key, value]}
									{#if value}
										<span class="mr-2">{key}: <strong>{value}</strong></span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
