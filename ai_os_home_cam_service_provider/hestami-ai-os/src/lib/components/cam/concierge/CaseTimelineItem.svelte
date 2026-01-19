<script lang="ts">
	import { CaseNoteTypeValues } from '$lib/api/cam';
	import { MessageSquare, HelpCircle, CheckCircle, Settings, FileText, Users, Link } from 'lucide-svelte';
	import type { CaseNoteType } from '$lib/api/cam';

	interface Props {
		type: 'note' | 'status_change' | 'action' | 'attachment' | 'participant';
		noteType?: CaseNoteType;
		title: string;
		content?: string;
		timestamp: string;
		actor?: string;
	}

	let { type, noteType, title, content, timestamp, actor }: Props = $props();

	function getIcon() {
		if (type === 'note' && noteType) {
			switch (noteType) {
				case CaseNoteTypeValues.CLARIFICATION_REQUEST:
					return HelpCircle;
				case CaseNoteTypeValues.CLARIFICATION_RESPONSE:
					return CheckCircle;
				case CaseNoteTypeValues.DECISION_RATIONALE:
					return Settings;
				default:
					return MessageSquare;
			}
		}
		switch (type) {
			case 'status_change':
				return Settings;
			case 'action':
				return Link;
			case 'attachment':
				return FileText;
			case 'participant':
				return Users;
			default:
				return MessageSquare;
		}
	}

	function getIconColor() {
		if (type === 'note' && noteType) {
			switch (noteType) {
				case CaseNoteTypeValues.CLARIFICATION_REQUEST:
					return 'text-amber-500 bg-amber-500/10';
				case CaseNoteTypeValues.CLARIFICATION_RESPONSE:
					return 'text-green-500 bg-green-500/10';
				case CaseNoteTypeValues.DECISION_RATIONALE:
					return 'text-purple-500 bg-purple-500/10';
				default:
					return 'text-blue-500 bg-blue-500/10';
			}
		}
		switch (type) {
			case 'status_change':
				return 'text-purple-500 bg-purple-500/10';
			case 'action':
				return 'text-amber-500 bg-amber-500/10';
			case 'attachment':
				return 'text-green-500 bg-green-500/10';
			case 'participant':
				return 'text-blue-500 bg-blue-500/10';
			default:
				return 'text-surface-500 bg-surface-500/10';
		}
	}

	const Icon = $derived(getIcon());
	const iconColor = $derived(getIconColor());

	function formatTimestamp(ts: string): string {
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="flex gap-3 py-3">
	<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {iconColor}">
		<Icon size={16} />
	</div>
	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2 flex-wrap">
			<span class="text-sm font-medium">{title}</span>
			<span class="text-xs text-surface-500">{formatTimestamp(timestamp)}</span>
			{#if actor}
				<span class="text-xs text-surface-500">by {actor}</span>
			{/if}
		</div>
		{#if content}
			<p class="mt-1 text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{content}</p>
		{/if}
	</div>
</div>
