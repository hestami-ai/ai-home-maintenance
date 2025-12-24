<script lang="ts">
	import { CheckCircle, XCircle, MinusCircle } from 'lucide-svelte';
	import { Progressbar } from 'flowbite-svelte';

	interface Props {
		yes: number;
		no: number;
		abstain: number;
		isClosed?: boolean;
		showPercentages?: boolean;
		compact?: boolean;
	}

	let { yes, no, abstain, isClosed = false, showPercentages = true, compact = false }: Props = $props();

	const total = $derived(yes + no + abstain);
	const yesPercent = $derived(total > 0 ? Math.round((yes / total) * 100) : 0);
	const noPercent = $derived(total > 0 ? Math.round((no / total) * 100) : 0);
	const abstainPercent = $derived(total > 0 ? Math.round((abstain / total) * 100) : 0);
	const isPassing = $derived(yes > no);
	const isTied = $derived(yes === no && total > 0);
</script>

<div class="card p-4 space-y-3" class:bg-green-50={isClosed && isPassing} class:bg-red-50={isClosed && !isPassing && !isTied} class:dark:bg-green-900={isClosed && isPassing} class:dark:bg-red-900={isClosed && !isPassing && !isTied}>
	{#if !compact}
		<div class="flex items-center justify-between">
			<h4 class="font-semibold">Vote Tally</h4>
			{#if isClosed}
				<span class="badge px-2 py-1 rounded text-xs font-medium" class:bg-green-500={isPassing} class:text-white={isPassing || (!isPassing && !isTied)} class:bg-red-500={!isPassing && !isTied} class:bg-yellow-500={isTied}>
					{isPassing ? 'Passed' : isTied ? 'Tied' : 'Failed'}
				</span>
			{:else}
				<span class="badge px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Voting Open</span>
			{/if}
		</div>
	{/if}

	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<CheckCircle size={18} class="text-green-500 shrink-0" />
			<span class="w-16 text-sm font-medium">Yes</span>
			<div class="flex-1">
				<Progressbar progress={yesPercent} color="green" size="h-2" />
			</div>
			<span class="w-12 text-right text-sm font-semibold">{yes}</span>
			{#if showPercentages && total > 0}
				<span class="w-12 text-right text-xs text-gray-500">{yesPercent}%</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<XCircle size={18} class="text-red-500 shrink-0" />
			<span class="w-16 text-sm font-medium">No</span>
			<div class="flex-1">
				<Progressbar progress={noPercent} color="red" size="h-2" />
			</div>
			<span class="w-12 text-right text-sm font-semibold">{no}</span>
			{#if showPercentages && total > 0}
				<span class="w-12 text-right text-xs text-gray-500">{noPercent}%</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<MinusCircle size={18} class="text-gray-400 shrink-0" />
			<span class="w-16 text-sm font-medium">Abstain</span>
			<div class="flex-1">
				<Progressbar progress={abstainPercent} color="gray" size="h-2" />
			</div>
			<span class="w-12 text-right text-sm font-semibold">{abstain}</span>
			{#if showPercentages && total > 0}
				<span class="w-12 text-right text-xs text-gray-500">{abstainPercent}%</span>
			{/if}
		</div>
	</div>

	{#if !compact}
		<div class="text-xs text-gray-500 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
			Total ballots cast: {total}
		</div>
	{/if}
</div>
