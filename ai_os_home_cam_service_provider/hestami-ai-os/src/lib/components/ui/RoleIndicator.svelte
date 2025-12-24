<script lang="ts">
	import { Shield, Users, Award, User, Home, Wrench } from 'lucide-svelte';
	import { organizationStore } from '$lib/stores';
	import RoleBadge from './RoleBadge.svelte';
	import OrganizationBadge from './OrganizationBadge.svelte';

	interface Props {
		showOrgType?: boolean;
		size?: 'sm' | 'md';
	}

	let { showOrgType = true, size = 'md' }: Props = $props();

	const roleIcons: Record<string, typeof Shield> = {
		ADMIN: Shield,
		MANAGER: Users,
		BOARD_MEMBER: Award,
		OWNER: Home,
		TENANT: User,
		VENDOR: Wrench
	};

	const currentRole = $derived($organizationStore.current?.role || '');
	const currentOrgType = $derived($organizationStore.current?.organization.type || '');
	const RoleIcon = $derived(roleIcons[currentRole] || User);

	const sizeClasses = {
		sm: 'text-xs gap-1',
		md: 'text-sm gap-2',
		lg: 'text-base gap-2'
	};

	const iconSizes = {
		sm: 'h-3 w-3',
		md: 'h-4 w-4',
		lg: 'h-5 w-5'
	};
</script>

{#if $organizationStore.current}
	<div class="flex items-center {sizeClasses[size]}">
		<RoleIcon class="{iconSizes[size]} text-surface-500" />
		<RoleBadge role={currentRole} {size} />
		{#if showOrgType}
			<span class="text-surface-400">in</span>
			<OrganizationBadge type={currentOrgType} {size} />
		{/if}
	</div>
{/if}
