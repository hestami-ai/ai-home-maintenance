<script lang="ts">
	import { CheckCircle, XCircle, Users } from 'lucide-svelte';

	interface Props {
		required: number | null;
		present: number;
		met: boolean;
		showDetails?: boolean;
		size?: 'sm' | 'md' | 'lg';
	}

	let { required, present, met, showDetails = true, size = 'md' }: Props = $props();

	const sizeClasses = {
		sm: 'text-xs gap-1',
		md: 'text-sm gap-2',
		lg: 'text-base gap-2'
	};

	const iconSizes = {
		sm: 14,
		md: 18,
		lg: 22
	};
</script>

<div class="flex items-center {sizeClasses[size]}">
	<div class="flex items-center gap-1">
		<Users size={iconSizes[size]} class="text-surface-500" />
		<span class="font-medium">{present}</span>
		{#if required !== null}
			<span class="text-surface-400">/ {required}</span>
		{/if}
	</div>

	{#if required !== null}
		<div class="flex items-center gap-1" class:text-success-500={met} class:text-error-500={!met}>
			{#if met}
				<CheckCircle size={iconSizes[size]} />
				{#if showDetails}
					<span class="font-medium">Quorum Met</span>
				{/if}
			{:else}
				<XCircle size={iconSizes[size]} />
				{#if showDetails}
					<span class="font-medium">Quorum Not Met</span>
				{/if}
			{/if}
		</div>
	{:else if showDetails}
		<span class="text-surface-400">No quorum required</span>
	{/if}
</div>
