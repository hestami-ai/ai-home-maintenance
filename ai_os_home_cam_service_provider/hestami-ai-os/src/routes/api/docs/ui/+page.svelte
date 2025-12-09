<script lang="ts">
	import { onMount } from 'svelte';
	import 'swagger-ui-dist/swagger-ui.css';

	onMount(async () => {
		const SwaggerUI = (await import('swagger-ui-dist')).default;
		SwaggerUI({
			dom_id: '#swagger-ui',
			url: '/api/docs',
			deepLinking: true,
			presets: [SwaggerUI.presets.apis, SwaggerUI.SwaggerUIStandalonePreset],
			layout: 'StandaloneLayout'
		});
	});
</script>

<svelte:head>
	<title>Hestami API Documentation</title>
</svelte:head>

<div id="swagger-ui"></div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
	#swagger-ui {
		min-height: 100vh;
	}
</style>
