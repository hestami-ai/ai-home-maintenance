<script lang="ts">
	interface Props {
		role: string;
		size?: 'sm' | 'md';
	}

	let { role, size = 'md' }: Props = $props();

	const roleConfig: Record<string, { label: string; class: string }> = {
		ADMIN: { label: 'Admin', class: 'preset-filled-error-500' },
		MANAGER: { label: 'Manager', class: 'preset-filled-warning-500' },
		BOARD_MEMBER: { label: 'Board Member', class: 'preset-filled-primary-500' },
		OWNER: { label: 'Owner', class: 'preset-filled-success-500' },
		TENANT: { label: 'Tenant', class: 'preset-filled-surface-500' },
		VENDOR: { label: 'Vendor', class: 'preset-filled-secondary-500' }
	};

	const config = $derived(roleConfig[role] || { label: role, class: 'preset-filled-surface-500' });
	const sizeClass = $derived(size === 'sm' ? 'badge-sm' : '');
</script>

<span class="badge {config.class} {sizeClass}">
	{config.label}
</span>
