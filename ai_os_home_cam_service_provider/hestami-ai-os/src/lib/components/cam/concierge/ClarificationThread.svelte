<script lang="ts">
	import { HelpCircle, CheckCircle, Clock } from 'lucide-svelte';
	import type { CaseNote } from '$lib/api/cam';

	interface Props {
		notes: CaseNote[];
	}

	let { notes }: Props = $props();

	const clarificationNotes = $derived(
		notes.filter(
			(n) => n.noteType === 'CLARIFICATION_REQUEST' || n.noteType === 'CLARIFICATION_RESPONSE'
		).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
	);

	function formatTimestamp(ts: string): string {
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function hasPendingClarification(): boolean {
		const requests = clarificationNotes.filter((n) => n.noteType === 'CLARIFICATION_REQUEST');
		const responses = clarificationNotes.filter((n) => n.noteType === 'CLARIFICATION_RESPONSE');
		return requests.length > responses.length;
	}
</script>

<div class="space-y-4">
	{#if clarificationNotes.length === 0}
		<div class="text-center py-6 text-surface-500">
			<HelpCircle class="mx-auto h-8 w-8 mb-2 opacity-50" />
			<p class="text-sm">No clarifications requested yet</p>
		</div>
	{:else}
		{#each clarificationNotes as note}
			<div
				class="rounded-lg p-4 {note.noteType === 'CLARIFICATION_REQUEST'
					? 'bg-amber-500/5 border border-amber-500/20'
					: 'bg-green-500/5 border border-green-500/20'}"
			>
				<div class="flex items-start gap-3">
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {note.noteType ===
						'CLARIFICATION_REQUEST'
							? 'bg-amber-500/10 text-amber-500'
							: 'bg-green-500/10 text-green-500'}"
					>
						{#if note.noteType === 'CLARIFICATION_REQUEST'}
							<HelpCircle size={16} />
						{:else}
							<CheckCircle size={16} />
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium">
								{note.noteType === 'CLARIFICATION_REQUEST' ? 'Question from Concierge' : 'Response from Owner'}
							</span>
							<span class="text-xs text-surface-500">{formatTimestamp(note.createdAt)}</span>
						</div>
						<p class="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
					</div>
				</div>
			</div>
		{/each}

		{#if hasPendingClarification()}
			<div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
				<Clock size={14} />
				<span>Waiting for owner response...</span>
			</div>
		{/if}
	{/if}
</div>
