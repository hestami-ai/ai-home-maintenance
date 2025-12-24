<script lang="ts">
	interface Props {
		type: string;
		size?: 'sm' | 'md';
	}

	let { type, size = 'md' }: Props = $props();

	const typeConfig: Record<string, { label: string; class: string }> = {
		INDIVIDUAL_PROPERTY_OWNER: { label: 'Property Owner', class: 'preset-filled-secondary-500' },
		TRUST_OR_LLC: { label: 'Trust/LLC', class: 'preset-filled-secondary-500' },
		COMMUNITY_ASSOCIATION: { label: 'HOA', class: 'preset-filled-primary-500' },
		MANAGEMENT_COMPANY: { label: 'Management Co.', class: 'preset-filled-primary-500' },
		SERVICE_PROVIDER: { label: 'Service Provider', class: 'preset-filled-success-500' },
		EXTERNAL_SERVICE_PROVIDER: { label: 'External Provider', class: 'preset-filled-surface-500' },
		COMMERCIAL_CLIENT: { label: 'Commercial', class: 'preset-filled-warning-500' }
	};

	const config = $derived(typeConfig[type] || { label: type, class: 'preset-filled-surface-500' });
	const sizeClass = $derived(size === 'sm' ? 'badge-sm' : '');
</script>

<span class="badge {config.class} {sizeClass}">
	{config.label}
</span>
