<script lang="ts">
	import { Scale, Plus } from 'lucide-svelte';
	import DecisionCard from './DecisionCard.svelte';
	import { EmptyState } from '$lib/components/ui';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
		onRecordDecision?: () => void;
	}

	let { caseDetail, onRecordDecision }: Props = $props();

	const decisionNotes = $derived(
		caseDetail.notes.filter((n) => n.noteType === 'DECISION_RATIONALE')
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">
			Decisions & Rationale
		</h3>
		{#if onRecordDecision}
			<button class="btn preset-outlined-primary-500 btn-sm" onclick={onRecordDecision}>
				<Plus size={14} class="mr-1" />
				Record Decision
			</button>
		{/if}
	</div>

	{#if decisionNotes.length === 0}
		<EmptyState
			title="No decisions recorded"
			description="Material decisions and their rationale will appear here."
		>
			{#snippet actions()}
				{#if onRecordDecision}
					<button class="btn preset-filled-primary-500" onclick={onRecordDecision}>
						<Scale size={16} class="mr-2" />
						Record First Decision
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="space-y-4">
			{#each decisionNotes as note}
				<DecisionCard
					title="Decision"
					rationale={note.content}
					decidedAt={note.createdAt}
				/>
			{/each}
		</div>
	{/if}
</div>
