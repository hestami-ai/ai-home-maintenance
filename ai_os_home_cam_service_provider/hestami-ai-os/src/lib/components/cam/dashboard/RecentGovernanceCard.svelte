<script lang="ts">
	import { 
		ClipboardCheck, 
		AlertTriangle, 
		Gavel, 
		FileText, 
		Scale,
		ChevronRight,
		Clock
	} from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import type { DashboardRecentGovernance, DashboardRecentGovernanceItem } from '$lib/api/cam';

	interface Props {
		data: DashboardRecentGovernance;
	}

	let { data }: Props = $props();

	function getIcon(type: DashboardRecentGovernanceItem['type']) {
		switch (type) {
			case 'ARC_APPROVED':
				return ClipboardCheck;
			case 'VIOLATION_CLOSED':
				return AlertTriangle;
			case 'MOTION_APPROVED':
				return Gavel;
			case 'POLICY_CREATED':
				return FileText;
			case 'RESOLUTION_ADOPTED':
				return Scale;
			default:
				return FileText;
		}
	}

	function getIconColor(type: DashboardRecentGovernanceItem['type']) {
		switch (type) {
			case 'ARC_APPROVED':
				return 'text-success-500 bg-success-500/10';
			case 'VIOLATION_CLOSED':
				return 'text-warning-500 bg-warning-500/10';
			case 'MOTION_APPROVED':
				return 'text-primary-500 bg-primary-500/10';
			case 'POLICY_CREATED':
				return 'text-secondary-500 bg-secondary-500/10';
			case 'RESOLUTION_ADOPTED':
				return 'text-tertiary-500 bg-tertiary-500/10';
			default:
				return 'text-surface-500 bg-surface-500/10';
		}
	}

	function getTypeLabel(type: DashboardRecentGovernanceItem['type']) {
		switch (type) {
			case 'ARC_APPROVED':
				return 'ARC Approved';
			case 'VIOLATION_CLOSED':
				return 'Violation Closed';
			case 'MOTION_APPROVED':
				return 'Motion Approved';
			case 'POLICY_CREATED':
				return 'Policy Created';
			case 'RESOLUTION_ADOPTED':
				return 'Resolution Adopted';
			default:
				return type;
		}
	}

	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 60) {
			return `${diffMinutes}m ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		} else if (diffDays === 1) {
			return 'Yesterday';
		} else if (diffDays < 7) {
			return `${diffDays}d ago`;
		} else {
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
	}
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="font-semibold">Recent Governance Activity</h2>
			<a 
				href="/app/cam/governance/activity" 
				class="text-sm text-primary-500 hover:underline"
			>
				View all
			</a>
		</div>
	</div>

	{#if data.items.length === 0}
		<div class="p-6 text-center text-surface-500">
			<Clock class="mx-auto h-8 w-8 mb-2 opacity-50" />
			<p class="text-sm">No recent governance activity</p>
		</div>
	{:else}
		<div class="divide-y divide-surface-300-700">
			{#each data.items as item}
				{@const Icon = getIcon(item.type)}
				<a
					href={item.deepLink}
					class="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-surface-200-800"
				>
					<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg {getIconColor(item.type)}">
						<Icon class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{item.title}</p>
						<div class="mt-1 flex items-center gap-2 text-xs text-surface-500">
							<span class="rounded bg-surface-200-800 px-1.5 py-0.5">{getTypeLabel(item.type)}</span>
							<span>·</span>
							<span>{item.actorRole}</span>
							<span>·</span>
							<span>{formatRelativeTime(item.occurredAt)}</span>
						</div>
					</div>
					<ChevronRight class="h-4 w-4 flex-shrink-0 text-surface-400" />
				</a>
			{/each}
		</div>
	{/if}
</Card>
