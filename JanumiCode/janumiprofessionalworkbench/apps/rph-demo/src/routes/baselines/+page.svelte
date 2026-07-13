<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Baseline Manager — JPWB</title></svelte:head>
<h1>Baseline Manager</h1>
<p class="sub">Promoted, immutable item sets. An authoritative baseline is frozen — changes create a successor. A repository commit is not a baseline.</p>

<table>
	<thead><tr><th>Baseline</th><th>Type</th><th>Status</th><th>Items</th><th>Purpose</th></tr></thead>
	<tbody>
		{#each data.baselines as b (b.id)}
			<tr><td class="mono">{b.id.slice(0, 16)}…</td><td>{b.type}</td><td><span class="tag" class:auth={b.status === 'AUTHORITATIVE'}>{b.status}</span></td><td>{b.items}</td><td>{b.purpose}</td></tr>
		{/each}
		{#if !data.baselines.length}<tr><td colspan="5" class="none">No baselines yet.</td></tr>{/if}
	</tbody>
</table>

<style>
	h1 {
		margin: 0 0 4px;
		font-size: 28px;
	}
	.sub {
		margin: 0 0 20px;
		color: var(--on-variant);
		font-size: 13px;
		max-width: 680px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
		background: var(--surface-low);
		border-radius: 12px;
		overflow: hidden;
	}
	th {
		text-align: left;
		color: var(--outline);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 12px;
	}
	td {
		padding: 11px 12px;
		border-top: 1px solid var(--sc);
		color: var(--on-variant);
	}
	.mono {
		font-family: 'Source Code Pro', monospace;
		color: var(--outline);
	}
	.tag {
		font-size: 10px;
		background: var(--sc-highest);
		padding: 2px 7px;
		border-radius: 4px;
		color: var(--on);
	}
	.tag.auth {
		background: rgba(154, 140, 255, 0.2);
		color: var(--indigo);
	}
	.none {
		color: var(--outline);
		text-align: center;
	}
</style>
