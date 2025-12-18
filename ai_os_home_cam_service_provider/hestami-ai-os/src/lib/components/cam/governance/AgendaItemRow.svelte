<script lang="ts">
	import { FileText, AlertTriangle, Wrench, ScrollText, ChevronRight, Link } from 'lucide-svelte';

	interface LinkedEntity {
		type: 'arc' | 'violation' | 'workOrder' | 'policy';
		id: string;
		label: string;
	}

	interface Props {
		id: string;
		order: number;
		title: string;
		description?: string | null;
		timeAllotment?: number | null;
		linkedEntities?: LinkedEntity[];
		isActive?: boolean;
		onclick?: () => void;
	}

	let { 
		id, 
		order, 
		title, 
		description, 
		timeAllotment,
		linkedEntities = [],
		isActive = false,
		onclick 
	}: Props = $props();

	const entityIcons: Record<string, typeof FileText> = {
		arc: FileText,
		violation: AlertTriangle,
		workOrder: Wrench,
		policy: ScrollText
	};

	const entityColors: Record<string, string> = {
		arc: 'text-blue-500',
		violation: 'text-red-500',
		workOrder: 'text-orange-500',
		policy: 'text-purple-500'
	};

	const entityLabels: Record<string, string> = {
		arc: 'ARC Request',
		violation: 'Violation',
		workOrder: 'Work Order',
		policy: 'Policy'
	};
</script>

<button
	type="button"
	class="w-full text-left p-3 rounded-lg border transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
	class:border-primary-500={isActive}
	class:bg-primary-50={isActive}
	class:dark:bg-primary-900={isActive}
	class:border-gray-200={!isActive}
	class:dark:border-gray-700={!isActive}
	onclick={onclick}
>
	<div class="flex items-start gap-3">
		<div class="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold shrink-0">
			{order}
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center justify-between gap-2">
				<h4 class="font-medium text-sm truncate">{title}</h4>
				{#if timeAllotment}
					<span class="text-xs text-gray-500 shrink-0">{timeAllotment} min</span>
				{/if}
			</div>

			{#if description}
				<p class="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
			{/if}

			{#if linkedEntities.length > 0}
				<div class="flex flex-wrap items-center gap-2 mt-2">
					<Link size={12} class="text-gray-400" />
					{#each linkedEntities as entity (entity.id)}
						{@const Icon = entityIcons[entity.type] || FileText}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 {entityColors[entity.type] || 'text-gray-500'}">
							<Icon size={12} />
							<span class="truncate max-w-24">{entity.label}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<ChevronRight size={16} class="text-gray-400 shrink-0 mt-1" />
	</div>
</button>
