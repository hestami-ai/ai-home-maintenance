<script lang="ts">
    type SpinnerSize = 'sm' | 'md' | 'lg';
    type SpinnerColor = 'primary' | 'secondary' | 'tertiary' | 'surface' | 'white';
    
    export let size: SpinnerSize = 'md';
    export let color: SpinnerColor = 'primary';
    
    // Size classes
    const sizeClasses: Record<SpinnerSize, string> = {
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-3'
    };
    
    // Color classes
    const colorClasses: Record<SpinnerColor, string> = {
        primary: 'border-primary-500 border-t-transparent',
        secondary: 'border-secondary-500 border-t-transparent',
        tertiary: 'border-tertiary-500 border-t-transparent',
        surface: 'border-surface-500 border-t-transparent',
        white: 'border-white border-t-transparent'
    };
    
    // Combine classes
    $: spinnerClass = `${sizeClasses[size]} ${colorClasses[color]}`;
</script>

<div class="inline-block animate-spin rounded-full {spinnerClass}" role="status" aria-label="Loading">
    <span class="sr-only">Loading...</span>
</div>
