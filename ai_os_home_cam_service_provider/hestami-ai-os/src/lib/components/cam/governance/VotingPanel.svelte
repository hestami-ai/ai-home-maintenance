<script lang="ts">
	import { CheckCircle, XCircle, MinusCircle, AlertTriangle } from 'lucide-svelte';
	import VoteTallyCard from './VoteTallyCard.svelte';

	interface Props {
		voteId: string;
		question: string;
		motionTitle?: string;
		tally: {
			yes: number;
			no: number;
			abstain: number;
		};
		isClosed: boolean;
		hasVoted: boolean;
		canVote: boolean;
		onVote?: (choice: 'YES' | 'NO' | 'ABSTAIN', hasConflict: boolean, conflictNotes?: string) => void;
	}

	let { 
		voteId, 
		question, 
		motionTitle, 
		tally, 
		isClosed, 
		hasVoted, 
		canVote,
		onVote 
	}: Props = $props();

	let selectedChoice: 'YES' | 'NO' | 'ABSTAIN' | null = $state(null);
	let hasConflictOfInterest = $state(false);
	let conflictNotes = $state('');
	let showConfirmation = $state(false);

	function selectChoice(choice: 'YES' | 'NO' | 'ABSTAIN') {
		if (isClosed || hasVoted || !canVote) return;
		selectedChoice = choice;
		showConfirmation = true;
	}

	function confirmVote() {
		if (selectedChoice && onVote) {
			onVote(selectedChoice, hasConflictOfInterest, hasConflictOfInterest ? conflictNotes : undefined);
		}
		showConfirmation = false;
	}

	function cancelVote() {
		selectedChoice = null;
		showConfirmation = false;
		hasConflictOfInterest = false;
		conflictNotes = '';
	}
</script>

<div class="card p-4 space-y-4">
	<div class="space-y-1">
		{#if motionTitle}
			<p class="text-xs text-surface-500">Motion</p>
			<h4 class="font-semibold">{motionTitle}</h4>
		{/if}
		<p class="text-sm">{question}</p>
	</div>

	<VoteTallyCard 
		yes={tally.yes} 
		no={tally.no} 
		abstain={tally.abstain} 
		{isClosed}
		compact={true}
	/>

	{#if !isClosed && canVote && !hasVoted}
		<div class="border-t border-surface-300-600-token pt-4">
			<p class="text-sm font-medium mb-3">Cast Your Vote</p>
			
			<div class="grid grid-cols-3 gap-2">
				<button
					type="button"
					class="btn variant-ghost-success flex flex-col items-center gap-1 py-3"
					class:variant-filled-success={selectedChoice === 'YES'}
					onclick={() => selectChoice('YES')}
				>
					<CheckCircle size={24} />
					<span class="text-sm font-medium">Yes</span>
				</button>
				
				<button
					type="button"
					class="btn variant-ghost-error flex flex-col items-center gap-1 py-3"
					class:variant-filled-error={selectedChoice === 'NO'}
					onclick={() => selectChoice('NO')}
				>
					<XCircle size={24} />
					<span class="text-sm font-medium">No</span>
				</button>
				
				<button
					type="button"
					class="btn variant-ghost flex flex-col items-center gap-1 py-3"
					class:variant-filled={selectedChoice === 'ABSTAIN'}
					onclick={() => selectChoice('ABSTAIN')}
				>
					<MinusCircle size={24} />
					<span class="text-sm font-medium">Abstain</span>
				</button>
			</div>
		</div>
	{:else if hasVoted}
		<div class="text-center py-2">
			<span class="badge variant-soft-success">Your vote has been recorded</span>
		</div>
	{:else if isClosed}
		<div class="text-center py-2">
			<span class="badge variant-soft-surface">Voting is closed</span>
		</div>
	{:else if !canVote}
		<div class="text-center py-2">
			<span class="badge variant-soft-warning">You are not eligible to vote</span>
		</div>
	{/if}
</div>

{#if showConfirmation}
	<div class="fixed inset-0 bg-surface-backdrop-token z-50 flex items-center justify-center p-4">
		<div class="card p-6 max-w-md w-full space-y-4">
			<h3 class="h4">Confirm Your Vote</h3>
			
			<p class="text-sm">
				You are voting <strong class:text-success-500={selectedChoice === 'YES'} class:text-error-500={selectedChoice === 'NO'}>{selectedChoice}</strong> on this motion.
			</p>

			<div class="space-y-2">
				<label class="flex items-center gap-2">
					<input type="checkbox" class="checkbox" bind:checked={hasConflictOfInterest} />
					<span class="text-sm">I have a conflict of interest</span>
				</label>

				{#if hasConflictOfInterest}
					<textarea
						class="textarea text-sm"
						placeholder="Describe your conflict of interest..."
						rows="2"
						bind:value={conflictNotes}
					></textarea>
				{/if}
			</div>

			<div class="flex items-center gap-2 p-3 rounded-container-token variant-soft-warning">
				<AlertTriangle size={18} class="shrink-0" />
				<p class="text-xs">Your vote cannot be changed after submission.</p>
			</div>

			<div class="flex justify-end gap-2">
				<button type="button" class="btn variant-ghost" onclick={cancelVote}>
					Cancel
				</button>
				<button type="button" class="btn variant-filled-primary" onclick={confirmVote}>
					Confirm Vote
				</button>
			</div>
		</div>
	</div>
{/if}
