<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: { error?: string; created?: string; deleted?: string; deleteFailedId?: string } | null;
	} = $props();
	let showForm = $state(false);
	// Which card is showing its delete confirmation (only one at a time).
	let confirmingId = $state<string | null>(null);

	/** A status-aware warning shown before deleting — published PWAs get a stronger caution. */
	function deleteWarning(status: string): string {
		if (status === 'PUBLISHED')
			return 'This PWA is PUBLISHED. Deleting removes it from the library. Prefer Deprecate → Retire for versions that were ever in use. (Deletion is blocked if any Undertaking was instantiated from it.)';
		if (status === 'DEPRECATED' || status === 'RETIRED')
			return 'Delete this archived PWA? It will be removed from the library. (Blocked if any Undertaking was instantiated from it.)';
		return 'Delete this draft PWA? This discards it.';
	}
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
		<div class="card">
			<a class="cardlink" href={`/pwa/${pwa.id}`}>
				<div class="cardtop">
					<div class="cardicon">▤</div>
					<span class="pill" class:pub={pwa.publicationStatus === 'PUBLISHED'}
						>{pwa.publicationStatus}</span
					>
				</div>
				<h3>{pwa.name}</h3>
				<p class="desc">{pwa.description}</p>
				<div class="stats">
					<div><span>{pwa.typeCount}</span> PWU Types</div>
					<div><span>{pwa.version}</span> version</div>
				</div>
			</a>
			<div class="cardfoot">
				{#if confirmingId === pwa.id}
					<form
						method="POST"
						action="?/delete"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								confirmingId = null;
							};
						}}
						class="delconfirm"
					>
						<input type="hidden" name="pwaId" value={pwa.id} />
						<p class="delwarn">{deleteWarning(pwa.publicationStatus)}</p>
						{#if form?.deleteFailedId === pwa.id && form?.error}
							<p class="err" role="alert">{form.error}</p>
						{/if}
						<div class="delactions">
							<button class="danger" type="submit">Delete</button>
							<button type="button" class="ghost" onclick={() => (confirmingId = null)}>Cancel</button>
						</div>
					</form>
				{:else}
					<button class="del" onclick={() => (confirmingId = pwa.id)} aria-label={`Delete ${pwa.name}`}
						>Delete</button
					>
				{/if}
			</div>
		</div>
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
		border-top: 2px solid transparent;
		transition: border-color 0.2s;
		display: flex;
		flex-direction: column;
	}
	.card:hover {
		border-top-color: var(--primary);
	}
	.cardlink {
		display: block;
		padding: 18px 18px 10px;
		color: var(--on);
	}
	.cardfoot {
		padding: 0 18px 14px;
		display: flex;
	}
	.del {
		background: transparent;
		border: 1px solid var(--outline-faint);
		color: var(--outline);
		border-radius: 6px;
		padding: 5px 11px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
	}
	.del:hover {
		color: var(--error);
		border-color: rgba(255, 180, 171, 0.4);
	}
	.delconfirm {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}
	.delwarn {
		margin: 0;
		font-size: 11px;
		color: var(--on-variant);
		line-height: 1.45;
	}
	.delactions {
		display: flex;
		gap: 8px;
	}
	.danger {
		background: var(--error);
		color: #3a0906;
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
	}
	.ghost {
		background: var(--sc-highest);
		color: var(--on);
		border: 1px solid var(--outline-faint);
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
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
