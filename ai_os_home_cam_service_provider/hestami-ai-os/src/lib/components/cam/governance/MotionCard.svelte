<script lang="ts">
	import { FileText, User, Calendar, CheckCircle, XCircle, Clock, Pause, ArrowRight } from 'lucide-svelte';

	interface Props {
		id: string;
		motionNumber: string;
		title: string;
		status: string;
		category?: string;
		movedBy?: string;
		secondedBy?: string;
		outcome?: string | null;
		decidedAt?: string | null;
		onclick?: () => void;
		selected?: boolean;
	}

	let { 
		id, 
		motionNumber, 
		title, 
		status, 
		category, 
		movedBy, 
		secondedBy, 
		outcome, 
		decidedAt,
		onclick,
		selected = false
	}: Props = $props();

	const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
		PROPOSED: { color: 'variant-soft-secondary', icon: FileText, label: 'Proposed' },
		SECONDED: { color: 'variant-soft-primary', icon: User, label: 'Seconded' },
		UNDER_DISCUSSION: { color: 'variant-soft-warning', icon: Clock, label: 'Under Discussion' },
		UNDER_VOTE: { color: 'variant-soft-tertiary', icon: ArrowRight, label: 'Voting' },
		TABLED: { color: 'variant-soft-surface', icon: Pause, label: 'Tabled' },
		APPROVED: { color: 'variant-filled-success', icon: CheckCircle, label: 'Approved' },
		DENIED: { color: 'variant-filled-error', icon: XCircle, label: 'Denied' },
		WITHDRAWN: { color: 'variant-soft-surface', icon: XCircle, label: 'Withdrawn' }
	};

	const config = $derived(statusConfig[status] || statusConfig.PROPOSED);
	const StatusIcon = $derived(config.icon);
</script>

<button
	type="button"
	class="card p-4 w-full text-left transition-all hover:ring-2 hover:ring-primary-500"
	class:ring-2={selected}
	class:ring-primary-500={selected}
	onclick={onclick}
>
	<div class="flex items-start justify-between gap-3">
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-xs font-mono text-surface-500">{motionNumber}</span>
				{#if category}
					<span class="badge variant-soft text-xs">{category}</span>
				{/if}
			</div>
			<h4 class="font-semibold text-sm line-clamp-2">{title}</h4>
			
			{#if movedBy || secondedBy}
				<div class="flex items-center gap-3 mt-2 text-xs text-surface-500">
					{#if movedBy}
						<span>Moved by: {movedBy}</span>
					{/if}
					{#if secondedBy}
						<span>Seconded by: {secondedBy}</span>
					{/if}
				</div>
			{/if}

			{#if decidedAt}
				<div class="flex items-center gap-1 mt-2 text-xs text-surface-500">
					<Calendar size={12} />
					<span>Decided: {new Date(decidedAt).toLocaleDateString()}</span>
				</div>
			{/if}
		</div>

		<div class="shrink-0">
			<span class="badge {config.color} flex items-center gap-1">
				<svelte:component this={StatusIcon} size={14} />
				{config.label}
			</span>
		</div>
	</div>
</button>
