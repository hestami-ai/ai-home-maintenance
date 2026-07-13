<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Undertaking Portfolio — JPWB</title></svelte:head>

<header class="pagehead">
	<div>
		<div class="eyebrow">Concrete Professional Work</div>
		<h1>Undertaking Portfolio</h1>
		<p class="sub">
			Each <strong>Undertaking</strong> is bound to one PWA version and owns a Professional Work Graph. The
			Undertaking is not the product it produces.
		</p>
	</div>
</header>

<div class="list">
	{#each data.undertakings as u (u.id)}
		<a class="row" href={`/undertakings/${u.id}`}>
			<div class="rowmain">
				<div class="rowicon">◈</div>
				<div>
					<h3>{u.name}</h3>
					<p class="obj">{u.objective}</p>
					<p class="product">→ produces: <em>{u.intendedOutputProduct}</em></p>
				</div>
			</div>
			<div class="rowmeta">
				<span class="binding">Instantiated from<br /><strong>{u.pwaName} v{u.pwaVersion}</strong></span>
				<span class="pill">{u.status}</span>
				<span class="count">{u.pwuCount} PWUs</span>
			</div>
		</a>
	{/each}
	{#if !data.undertakings.length}<p class="empty">No Undertakings yet.</p>{/if}
</div>

<style>
	.eyebrow {
		font-size: 11px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--tertiary);
		font-weight: 700;
	}
	h1 {
		margin: 6px 0 4px;
		font-size: 30px;
	}
	.sub {
		margin: 0 0 22px;
		max-width: 640px;
		color: var(--on-variant);
		font-size: 13px;
		line-height: 1.5;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.row {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 18px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--on);
		border-left: 3px solid var(--tertiary);
	}
	.rowmain {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.rowicon {
		width: 42px;
		height: 42px;
		border-radius: 9px;
		background: var(--sc-highest);
		color: var(--tertiary);
		display: grid;
		place-items: center;
		font-size: 20px;
	}
	.row h3 {
		margin: 0 0 4px;
		font-size: 18px;
	}
	.obj {
		margin: 0 0 3px;
		color: var(--on-variant);
		font-size: 13px;
	}
	.product {
		margin: 0;
		font-size: 12px;
		color: var(--outline);
	}
	.rowmeta {
		display: flex;
		gap: 18px;
		align-items: center;
		text-align: right;
	}
	.binding {
		font-size: 11px;
		color: var(--outline);
		line-height: 1.4;
	}
	.binding strong {
		color: var(--primary);
	}
	.pill {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.count {
		font-size: 12px;
		color: var(--on-variant);
	}
	.empty {
		color: var(--outline);
	}
</style>
