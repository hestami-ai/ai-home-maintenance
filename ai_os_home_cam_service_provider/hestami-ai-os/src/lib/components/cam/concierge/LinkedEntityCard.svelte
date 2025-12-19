<script lang="ts">
	import { Link, FileText, Wrench, Home, Briefcase, ExternalLink } from 'lucide-svelte';

	interface Props {
		type: 'arc' | 'work_order' | 'unit' | 'job';
		id: string;
		title?: string;
		status?: string;
		href?: string;
	}

	let { type, id, title, status, href }: Props = $props();

	const typeConfig = {
		arc: { label: 'ARC Request', icon: FileText, color: 'text-blue-500 bg-blue-500/10' },
		work_order: { label: 'Work Order', icon: Wrench, color: 'text-amber-500 bg-amber-500/10' },
		unit: { label: 'HOA Unit', icon: Home, color: 'text-green-500 bg-green-500/10' },
		job: { label: 'Contractor Job', icon: Briefcase, color: 'text-purple-500 bg-purple-500/10' }
	};

	const config = $derived(typeConfig[type]);
	const TypeIcon = $derived(config.icon);
</script>

<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
	<div class="flex items-center gap-3">
		<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {config.color}">
			<TypeIcon size={20} />
		</div>
		<div>
			<p class="text-xs font-medium text-surface-500">{config.label}</p>
			<p class="font-medium">{title || id}</p>
			{#if status}
				<p class="text-xs text-surface-500">{status}</p>
			{/if}
		</div>
	</div>
	{#if href}
		<a
			{href}
			class="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600"
		>
			View
			<ExternalLink size={14} />
		</a>
	{/if}
</div>
