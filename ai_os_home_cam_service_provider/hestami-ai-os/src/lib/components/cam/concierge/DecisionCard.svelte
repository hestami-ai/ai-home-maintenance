<script lang="ts">
	import { Scale, User, Calendar, CheckCircle, XCircle, Clock } from 'lucide-svelte';

	interface Props {
		title: string;
		description?: string;
		outcome?: 'APPROVED' | 'DENIED' | 'DEFERRED' | 'PENDING';
		rationale?: string;
		decidedBy?: string;
		decidedAt?: string;
		authoritySource?: string;
	}

	let { title, description, outcome, rationale, decidedBy, decidedAt, authoritySource }: Props = $props();

	const outcomeConfig = {
		APPROVED: { label: 'Approved', color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: CheckCircle },
		DENIED: { label: 'Denied', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
		DEFERRED: { label: 'Deferred', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: Clock },
		PENDING: { label: 'Pending', color: 'text-surface-500 bg-surface-500/10 border-surface-500/20', icon: Clock }
	};

	const config = $derived(outcome ? outcomeConfig[outcome] : outcomeConfig.PENDING);
	const OutcomeIcon = $derived(config.icon);

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="rounded-lg border border-surface-300-700 p-4">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
				<Scale class="h-5 w-5 text-purple-500" />
			</div>
			<div>
				<h4 class="font-medium">{title}</h4>
				{#if description}
					<p class="mt-1 text-sm text-surface-500">{description}</p>
				{/if}
			</div>
		</div>
		{#if outcome}
			<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium {config.color}">
				<OutcomeIcon size={14} />
				{config.label}
			</span>
		{/if}
	</div>

	{#if rationale}
		<div class="mt-4 rounded-lg bg-surface-100-900 p-3">
			<p class="text-xs font-medium text-surface-500 uppercase tracking-wide">Rationale</p>
			<p class="mt-1 text-sm">{rationale}</p>
		</div>
	{/if}

	<div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-surface-500">
		{#if decidedBy}
			<span class="flex items-center gap-1">
				<User size={12} />
				{decidedBy}
			</span>
		{/if}
		{#if decidedAt}
			<span class="flex items-center gap-1">
				<Calendar size={12} />
				{formatDate(decidedAt)}
			</span>
		{/if}
		{#if authoritySource}
			<span class="flex items-center gap-1">
				<Scale size={12} />
				{authoritySource}
			</span>
		{/if}
	</div>
</div>
