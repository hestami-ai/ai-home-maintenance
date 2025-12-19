<script lang="ts">
	import { User, Building2, Truck, Clock } from 'lucide-svelte';
	import type { ConciergeCaseStatus } from '$lib/api/cam';

	interface Props {
		status: ConciergeCaseStatus;
		size?: 'sm' | 'md';
	}

	let { status, size = 'md' }: Props = $props();

	type WaitingOn = 'owner' | 'external' | 'concierge' | 'none';

	function getWaitingOn(status: ConciergeCaseStatus): WaitingOn {
		switch (status) {
			case 'PENDING_OWNER':
				return 'owner';
			case 'PENDING_EXTERNAL':
				return 'external';
			case 'INTAKE':
			case 'ASSESSMENT':
			case 'IN_PROGRESS':
				return 'concierge';
			default:
				return 'none';
		}
	}

	const waitingOnConfig: Record<WaitingOn, { label: string; color: string; icon: typeof User }> = {
		owner: { label: 'Waiting on Owner', color: 'text-red-500 bg-red-500/10', icon: User },
		external: { label: 'Waiting on External', color: 'text-orange-500 bg-orange-500/10', icon: Building2 },
		concierge: { label: 'With Concierge', color: 'text-blue-500 bg-blue-500/10', icon: Clock },
		none: { label: '', color: '', icon: Clock }
	};

	const waitingOn = $derived(getWaitingOn(status));
	const config = $derived(waitingOnConfig[waitingOn]);
	const WaitingIcon = $derived(config.icon);

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs gap-1',
		md: 'px-2.5 py-1 text-sm gap-1.5'
	};

	const iconSizes = {
		sm: 12,
		md: 14
	};
</script>

{#if waitingOn !== 'none'}
	<span class="inline-flex items-center rounded-full font-medium {config.color} {sizeClasses[size]}">
		<WaitingIcon size={iconSizes[size]} />
		{config.label}
	</span>
{/if}
