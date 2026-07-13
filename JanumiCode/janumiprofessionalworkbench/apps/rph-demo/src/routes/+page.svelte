<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { toFlow } from '$lib/toFlow';
	import type { PageData } from './$types';

	// `data.graph` is produced LIVE server-side: the engine drove the Reference Undertaking through real commands
	// and projected the current Professional Work Graph (see +page.server.ts).
	let { data }: { data: PageData } = $props();
	const flow = toFlow(data.graph);
	let nodes = $state(flow.nodes);
	let edges = $state(flow.edges);
</script>

<svelte:head>
	<title>RPH Demo — Reference Undertaking (live)</title>
</svelte:head>

<header>
	<h1>Janumi Professional Workbench — Recursive Professional Harness</h1>
	<p>
		The <strong>Reference Undertaking</strong> (a multi-tenant field-service SaaS) as a live Professional
		Work Graph, <strong>driven server-side by real engine commands</strong> — not a static fixture. Each
		node shows its four independent state axes. A node is <strong>green</strong> only when execution SUCCEEDED
		<em>and</em> assurance is SATISFIED — <strong>no green without assurance</strong> (the flagship invariant).
		Amber = execution succeeded but assurance not yet satisfied. The indigo border marks a node frozen into
		an <strong>authoritative baseline</strong>.
	</p>
	{#if flow.openResiduals.length}
		<p class="residual">⚠ Open residual (stays visible): {flow.openResiduals.join('; ')}</p>
	{/if}
</header>

<div class="flow">
	<SvelteFlow bind:nodes bind:edges fitView>
		<Background />
		<Controls />
		<MiniMap />
	</SvelteFlow>
</div>

<style>
	:global(body) {
		margin: 0;
	}
	header {
		padding: 12px 20px;
		font: 14px/1.5 system-ui, sans-serif;
		border-bottom: 1px solid #e2e5e9;
	}
	h1 {
		font-size: 18px;
		margin: 0 0 6px;
	}
	header p {
		margin: 4px 0;
		max-width: 1100px;
		color: #3c4043;
	}
	.residual {
		color: #8a5a00;
		font-weight: 600;
	}
	.flow {
		height: calc(100vh - 150px);
		width: 100%;
	}
</style>
