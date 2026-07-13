<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Decision Center — JPWB</title></svelte:head>
<h1>Decision Center</h1>
<p class="sub">Version-bound governance acts. A decision is authority exercised — recommendation is not approval.</p>

<table>
	<thead><tr><th>Decision</th><th>Type</th><th>Status</th><th>Option</th><th>Rationale</th></tr></thead>
	<tbody>
		{#each data.decisions as d (d.id)}
			<tr><td class="mono">{d.id.slice(0, 16)}…</td><td>{d.type}</td><td><span class="tag" class:eff={d.status === 'EFFECTIVE'}>{d.status}</span></td><td>{d.selectedOption}</td><td>{d.rationale}</td></tr>
		{/each}
		{#if !data.decisions.length}<tr><td colspan="5" class="none">No decisions yet.</td></tr>{/if}
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
	.tag.eff {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.none {
		color: var(--outline);
		text-align: center;
	}
</style>
