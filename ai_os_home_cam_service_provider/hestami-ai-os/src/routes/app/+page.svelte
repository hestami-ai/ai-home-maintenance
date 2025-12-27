<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
</script>

<!-- 
	This page should never render - the +page.server.ts handles all redirects.
	This is just a fallback loading state in case of any edge cases.
-->
<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
	<div class="text-center">
		<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary-500" />
		<p class="mt-2 text-sm text-surface-500">Redirecting...</p>
	</div>
</div>
