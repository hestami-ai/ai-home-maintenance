<script lang="ts">
	// The PWU Type custom node for the PWA Designer graph. Renders a rich card: header (name · ROOT · kind ·
	// N/L badge · collapse chevron), a cardinality summary of its permitted children, and the §11.7.4 ASSURANCE
	// RAIL — the locked de-minimis floor (always shown, even collapsed) plus any declared additive policies.
	// Clicking the card body selects it (Svelte Flow's onnodeclick); the chevron toggles collapse without selecting.
	import { Handle, Position } from '@xyflow/svelte';
	import { getContext } from 'svelte';
	import type { PwuCardData } from '$lib/pwaFlow';
	import { WALKTHROUGH_CONTEXT_KEY, type WalkthroughContext } from '$lib/walkthrough';

	// `selected` is Svelte Flow's native per-node selection flag — clicking a node sets it without re-laying-out.
	let { data, selected = false }: { data: PwuCardData; selected?: boolean } = $props();

	// Walkthrough badge/dim come from CONTEXT (not node.data), so the route's layout $effect that owns `nodes` is
	// never a second writer — no re-layout on step change, no reactive self-loop. Undefined when not in a walkthrough.
	const walk = getContext<WalkthroughContext | undefined>(WALKTHROUGH_CONTEXT_KEY);
	const stepNumber = $derived(walk?.stepOf(data.id));
	const dimmed = $derived(walk?.isDimmed(data.id) ?? false);

	function onChevron(e: MouseEvent) {
		e.stopPropagation(); // toggle collapse without selecting the node
		data.onToggleCollapse();
	}

	function onRailKeyDown(event: KeyboardEvent) {
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.stopPropagation();
		}
	}
</script>

<div class="card" class:selected class:root={data.isRoot} class:dimmed>
	<Handle type="target" position={data.layoutDirection === 'RIGHT' ? Position.Left : Position.Top} />
	<header class="head">
		<div class="titles">
			<div class="name">
				{data.name}{#if data.isRoot}<span class="rootbadge">ROOT</span>{/if}
			</div>
			<div class="kind">{data.pwuKind}</div>
		</div>
		<div class="marks">
			{#if stepNumber !== undefined}
				<span
					class="stepbadge"
					data-testid="step-badge"
					title="Dependency step — what must be produced before what can be consumed. Not an execution order."
					>{stepNumber}</span
				>
			{/if}
			<span class="nl" title={data.isLeaf ? 'Leaf PWU Type' : 'Non-leaf PWU Type'}
				>{data.isLeaf ? 'L' : 'N'}</span
			>
			{#if !data.isLeaf}
				<button
					class="chevron"
					onclick={onChevron}
					aria-label={data.collapsed ? 'Expand subtree' : 'Collapse subtree'}
					title={data.collapsed ? 'Expand subtree' : 'Collapse subtree'}
				>{data.collapsed ? '▸' : '▾'}</button>
			{/if}
		</div>
	</header>

	<div class="meta">
		{#if data.isLeaf}
			<span>leaf</span>
		{:else}
			<span>{data.childCount} child{data.childCount === 1 ? '' : 'ren'}{#if data.collapsed} · collapsed{/if}</span>
			{#if data.cardinalitySummary}<span class="cards">{data.cardinalitySummary}</span>{/if}
		{/if}
		{#if data.orphan}<span class="warn" title="No permitted parent">⚠ no parent</span>{/if}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A labelled focusable scroll region keeps long assurance lists keyboard-readable without clipping graph handles.) -->
	<div
		class="rail"
		role="region"
		tabindex="0"
		aria-label={`Assurance policies for ${data.name}`}
		data-canvas-move-ignore
		onkeydown={onRailKeyDown}
	>
		<div class="locked">🔒 de minimis floor</div>
		{#each data.floorLabels as label (label)}
			<div class="floor">{label}</div>
		{/each}
		{#if data.attestationSubstitute}
			<div
				class="attestation"
				title="External work — Reasoning Review is discharged by the counterparty's attestation, not our floor (INV-2)"
			>
				{data.attestationSubstitute}
			</div>
		{/if}
		{#each data.policyLabels as label (label)}
			<div class="plus">+ {label}</div>
		{/each}
	</div>

	<Handle
		type="source"
		position={data.layoutDirection === 'RIGHT' ? Position.Right : Position.Bottom}
	/>
</div>

<style>
	.card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: visible;
		background: var(--graph-node-background);
		color: var(--graph-node-text);
		border: 1px solid var(--graph-node-border);
		border-radius: 10px;
		padding: 8px 10px;
		font:
			12px/1.4 'Inter',
			system-ui,
			sans-serif;
		text-align: left;
		cursor: pointer;
	}
	.card.root {
		border-color: var(--graph-node-root);
	}
	.card.selected {
		border-color: var(--graph-node-selected);
		box-shadow: 0 0 0 1px var(--graph-node-selected);
	}
	.card.dimmed {
		opacity: 0.32;
	}
	.stepbadge {
		font-family: 'Source Code Pro', monospace;
		font-size: 9.5px;
		font-weight: 700;
		color: var(--graph-step-badge-text);
		background: var(--graph-node-selected);
		border-radius: 4px;
		padding: 0 5px;
	}
	.head {
		display: flex;
		flex: 0 0 auto;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
	}
	.name {
		font-weight: 600;
		font-size: 12.5px;
		line-height: 1.25;
	}
	.rootbadge {
		font-size: 8.5px;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--graph-node-selected);
		border: 1px solid var(--graph-node-border);
		border-radius: 4px;
		padding: 0 3px;
		margin-left: 5px;
		vertical-align: middle;
	}
	.kind {
		font-family: 'Source Code Pro', monospace;
		font-size: 9.5px;
		color: var(--graph-node-muted);
		margin-top: 2px;
	}
	.marks {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 0 0 auto;
	}
	.nl {
		font-family: 'Source Code Pro', monospace;
		font-size: 9.5px;
		font-weight: 700;
		color: var(--graph-node-secondary);
		border: 1px solid var(--graph-node-border);
		border-radius: 4px;
		padding: 0 4px;
	}
	.chevron {
		background: none;
		border: none;
		color: var(--graph-node-secondary);
		font-size: 11px;
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
	}
	.meta {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 10px;
		color: var(--graph-node-muted);
		margin: 4px 0 6px;
	}
	.meta .cards {
		font-family: 'Source Code Pro', monospace;
		color: var(--graph-node-selected);
	}
	.meta .warn {
		color: var(--graph-warning);
	}
	.rail {
		flex: 1 1 auto;
		min-height: 0;
		border-top: 1px solid var(--graph-node-divider);
		padding-top: 5px;
		overflow-y: auto;
	}
	.rail:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.locked {
		font-size: 9.5px;
		font-weight: 700;
		color: var(--graph-assurance);
		margin-bottom: 2px;
	}
	.floor {
		font-size: 10px;
		color: var(--graph-node-secondary);
		line-height: 1.45;
	}
	.plus {
		font-size: 10px;
		color: var(--graph-edge-dataflow);
		line-height: 1.45;
	}
	.attestation {
		font-size: 9.5px;
		font-style: italic;
		color: var(--graph-attestation);
		line-height: 1.4;
		margin-top: 1px;
	}
</style>
