<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { theme } from '$lib/stores';

	function toggleTheme() {
		theme.toggle();
	}
</script>

<button
	type="button"
	onclick={toggleTheme}
	class="btn btn-sm preset-tonal-surface"
	aria-label="Toggle theme"
>
	{#if $theme === 'light'}
		<Moon class="h-5 w-5" />
	{:else}
		<Sun class="h-5 w-5" />
	{/if}
</button>
