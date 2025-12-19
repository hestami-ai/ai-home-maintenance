<script lang="ts">
	import { Settings, MessageSquare, HelpCircle, CheckCircle, User } from 'lucide-svelte';
	import CaseTimelineItem from './CaseTimelineItem.svelte';
	import { EmptyState } from '$lib/components/ui';
	import type { ConciergeCaseDetail, CaseNoteType } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();

	interface TimelineEntry {
		id: string;
		type: 'note' | 'status_change';
		noteType?: CaseNoteType;
		title: string;
		content?: string;
		timestamp: string;
		actor?: string;
	}

	function buildTimeline(): TimelineEntry[] {
		const entries: TimelineEntry[] = [];

		for (const note of caseDetail.notes) {
			entries.push({
				id: `note-${note.id}`,
				type: 'note',
				noteType: note.noteType,
				title: getNoteTypeLabel(note.noteType),
				content: note.content,
				timestamp: note.createdAt
			});
		}

		for (const history of caseDetail.statusHistory) {
			entries.push({
				id: `status-${history.id}`,
				type: 'status_change',
				title: 'Status Changed',
				content: history.fromStatus
					? `${history.fromStatus} → ${history.toStatus}${history.reason ? ` (${history.reason})` : ''}`
					: `Set to ${history.toStatus}`,
				timestamp: history.createdAt
			});
		}

		return entries.sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	}

	function getNoteTypeLabel(noteType: CaseNoteType): string {
		const labels: Record<CaseNoteType, string> = {
			GENERAL: 'Note Added',
			CLARIFICATION_REQUEST: 'Clarification Requested',
			CLARIFICATION_RESPONSE: 'Owner Responded',
			DECISION_RATIONALE: 'Decision Recorded'
		};
		return labels[noteType] || 'Activity';
	}

	const timeline = $derived(buildTimeline());
</script>

<div class="space-y-6">
	<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">
		History & Audit Trail
	</h3>

	{#if timeline.length === 0}
		<EmptyState
			title="No activity yet"
			description="All case activity and status changes will appear here."
		/>
	{:else}
		<div class="divide-y divide-surface-300-700">
			{#each timeline as entry (entry.id)}
				<CaseTimelineItem
					type={entry.type}
					noteType={entry.noteType}
					title={entry.title}
					content={entry.content}
					timestamp={entry.timestamp}
					actor={entry.actor}
				/>
			{/each}
		</div>
	{/if}
</div>
