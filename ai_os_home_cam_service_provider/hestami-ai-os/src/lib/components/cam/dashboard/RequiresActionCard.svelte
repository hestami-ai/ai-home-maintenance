<script lang="ts">
	import { ClipboardCheck, AlertTriangle, Wrench, ChevronRight } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface ActionItem {
		label: string;
		count: number;
		href: string;
		icon: typeof ClipboardCheck;
		color: string;
	}

	interface Props {
		pendingArc: number;
		escalatedViolations: number;
		overdueWorkOrders: number;
	}

	let { pendingArc = 0, escalatedViolations = 0, overdueWorkOrders = 0 }: Props = $props();

	const items: ActionItem[] = $derived([
		{
			label: 'Pending ARC Approvals',
			count: pendingArc,
			href: '/app/cam/arc?status=SUBMITTED',
			icon: ClipboardCheck,
			color: 'text-warning-500 bg-warning-500/10'
		},
		{
			label: 'Escalated Violations',
			count: escalatedViolations,
			href: '/app/cam/violations?status=ESCALATED',
			icon: AlertTriangle,
			color: 'text-error-500 bg-error-500/10'
		},
		{
			label: 'Overdue Work Orders',
			count: overdueWorkOrders,
			href: '/app/cam/work-orders?overdue=true',
			icon: Wrench,
			color: 'text-primary-500 bg-primary-500/10'
		}
	]);

	const totalActions = $derived(pendingArc + escalatedViolations + overdueWorkOrders);
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="font-semibold">Requires Action</h2>
			{#if totalActions > 0}
				<span class="flex h-6 min-w-6 items-center justify-center rounded-full bg-error-500 px-2 text-xs font-semibold text-white">
					{totalActions}
				</span>
			{/if}
		</div>
	</div>
	<div class="divide-y divide-surface-300-700">
		{#each items as item}
			<a
				href={item.href}
				class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {item.color}">
					<item.icon class="h-5 w-5" />
				</div>
				<div class="flex-1">
					<p class="text-sm font-medium">{item.label}</p>
					<p class="text-2xl font-bold">{item.count}</p>
				</div>
				<ChevronRight class="h-5 w-5 text-surface-400" />
			</a>
		{/each}
	</div>
</Card>
