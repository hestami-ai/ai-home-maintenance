<script lang="ts">
	import { UserRoleValues } from '$lib/api/cam';
	import { Shield, Check, X } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { organizationStore } from '$lib/stores';

	interface Permission {
		name: string;
		description: string;
		granted: boolean;
	}

	interface Props {
		title?: string;
		permissions?: Permission[];
	}

	let { title = 'Your Permissions', permissions = [] }: Props = $props();

	// Default permissions based on role
	const defaultPermissions = $derived(() => {
		const role = $organizationStore.current?.role;
		if (!role) return [];

		const perms: Permission[] = [];

		if (role === UserRoleValues.ADMIN) {
			perms.push(
				{ name: 'Manage Organization', description: 'Edit organization settings', granted: true },
				{ name: 'Manage Members', description: 'Add/remove members and change roles', granted: true },
				{ name: 'View All Data', description: 'Access all organization data', granted: true },
				{ name: 'Manage Billing', description: 'View and manage billing', granted: true }
			);
		} else if (role === UserRoleValues.MANAGER) {
			perms.push(
				{ name: 'Manage Organization', description: 'Edit organization settings', granted: false },
				{ name: 'Manage Members', description: 'Add/remove members and change roles', granted: true },
				{ name: 'View All Data', description: 'Access all organization data', granted: true },
				{ name: 'Manage Billing', description: 'View and manage billing', granted: false }
			);
		} else if (role === UserRoleValues.BOARD_MEMBER) {
			perms.push(
				{ name: 'Manage Organization', description: 'Edit organization settings', granted: false },
				{ name: 'Approve Decisions', description: 'Vote on board decisions', granted: true },
				{ name: 'View Reports', description: 'Access financial reports', granted: true },
				{ name: 'Manage Billing', description: 'View and manage billing', granted: false }
			);
		} else {
			perms.push(
				{ name: 'View Dashboard', description: 'Access your dashboard', granted: true },
				{ name: 'Submit Requests', description: 'Create service requests', granted: true },
				{ name: 'View Documents', description: 'Access shared documents', granted: true }
			);
		}

		return perms;
	});

	const displayPermissions = $derived(permissions.length > 0 ? permissions : defaultPermissions());
</script>

<Card variant="outlined" padding="md">
	<div class="flex items-center gap-2 border-b border-surface-300-700 pb-3">
		<Shield class="h-5 w-5 text-primary-500" />
		<h3 class="font-semibold">{title}</h3>
	</div>
	<ul class="mt-3 space-y-2">
		{#each displayPermissions as perm}
			<li class="flex items-start gap-2">
				{#if perm.granted}
					<Check class="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />
				{:else}
					<X class="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-400" />
				{/if}
				<div>
					<p class="text-sm font-medium" class:text-surface-400={!perm.granted}>{perm.name}</p>
					<p class="text-xs text-surface-500">{perm.description}</p>
				</div>
			</li>
		{/each}
	</ul>
</Card>
