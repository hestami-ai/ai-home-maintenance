<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	let { data, form }: { data: PageData; form: { error?: string; created?: string } | null } = $props();
	let showForm = $state(false);
</script>

<svelte:head><title>PWA Library — JPWB</title></svelte:head>

<header class="pagehead">
	<div>
		<div class="eyebrow">Enterprise Repository</div>
		<h1>PWA Library</h1>
		<p class="sub">
			Reusable, versioned <strong>Professional Work Architectures</strong>. A PWA defines PWU Types,
			relationships, assurance policies, and baseline types — it is <em>not</em> a concrete Undertaking.
		</p>
	</div>
	<button class="primary" onclick={() => (showForm = !showForm)}>+ New PWA</button>
</header>

{#if showForm}
	<form method="POST" action="?/create" use:enhance class="createform">
		<input name="name" placeholder="PWA name (e.g. Legal Compliance PWA)" required />
		<input name="domain" placeholder="Domain (e.g. legal)" />
		<button class="primary" type="submit">Create draft</button>
		{#if form?.error}<span class="err">{form.error}</span>{/if}
	</form>
{/if}

<div class="grid">
	{#each data.pwas as pwa (pwa.id)}
		<a class="card" href={`/pwa/${pwa.id}`}>
			<div class="cardtop">
				<div class="cardicon">▤</div>
				<span class="pill" class:pub={pwa.publicationStatus === 'PUBLISHED'}>{pwa.publicationStatus}</span>
			</div>
			<h3>{pwa.name}</h3>
			<p class="desc">{pwa.description}</p>
			<div class="stats">
				<div><span>{pwa.typeCount}</span> PWU Types</div>
				<div><span>{pwa.version}</span> version</div>
			</div>
		</a>
	{/each}
	{#if !data.pwas.length}<p class="empty">No PWAs yet — create one.</p>{/if}
</div>

<style>
	.pagehead {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 22px;
	}
	.eyebrow {
		font-size: 11px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--primary);
		font-weight: 700;
	}
	h1 {
		margin: 6px 0 4px;
		font-size: 30px;
		letter-spacing: -0.02em;
	}
	.sub {
		margin: 0;
		max-width: 640px;
		color: var(--on-variant);
		font-size: 13px;
		line-height: 1.5;
	}
	button.primary {
		background: var(--primary);
		color: #00263f;
		border: none;
		border-radius: 8px;
		padding: 9px 16px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
	}
	.createform {
		display: flex;
		gap: 8px;
		margin-bottom: 18px;
		align-items: center;
	}
	.createform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 9px 12px;
		font-size: 13px;
	}
	.err {
		color: var(--error);
		font-size: 12px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}
	.card {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 18px;
		border-top: 2px solid transparent;
		color: var(--on);
		transition: border-color 0.2s;
	}
	.card:hover {
		border-top-color: var(--primary);
	}
	.cardtop {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.cardicon {
		width: 42px;
		height: 42px;
		border-radius: 9px;
		background: var(--sc-highest);
		color: var(--primary);
		display: grid;
		place-items: center;
		font-size: 20px;
	}
	.pill {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(159, 202, 255, 0.15);
		color: var(--primary);
	}
	.pill.pub {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.card h3 {
		margin: 0 0 6px;
		font-size: 18px;
	}
	.desc {
		margin: 0 0 16px;
		color: var(--on-variant);
		font-size: 12.5px;
		line-height: 1.5;
		min-height: 38px;
	}
	.stats {
		display: flex;
		gap: 20px;
		font-size: 12px;
		color: var(--outline);
		border-top: 1px solid var(--sc);
		padding-top: 12px;
	}
	.stats span {
		color: var(--on);
		font-weight: 700;
	}
	.empty {
		color: var(--outline);
	}
</style>
