<script lang="ts">
	interface Props {
		variant?: 'text' | 'circular' | 'rectangular';
		width?: string;
		height?: string;
		class?: string;
	}

	let { variant = 'text', width, height, class: className = '' }: Props = $props();

	const variantClasses = {
		text: 'h-4 rounded',
		circular: 'rounded-full',
		rectangular: 'rounded-lg'
	};

	const defaultDimensions = {
		text: { width: '100%', height: '1rem' },
		circular: { width: '2.5rem', height: '2.5rem' },
		rectangular: { width: '100%', height: '4rem' }
	};

	const finalWidth = $derived(width || defaultDimensions[variant].width);
	const finalHeight = $derived(height || defaultDimensions[variant].height);
</script>

<div
	class="animate-pulse bg-surface-300-700 {variantClasses[variant]} {className}"
	style="width: {finalWidth}; height: {finalHeight};"
	aria-hidden="true"
></div>
