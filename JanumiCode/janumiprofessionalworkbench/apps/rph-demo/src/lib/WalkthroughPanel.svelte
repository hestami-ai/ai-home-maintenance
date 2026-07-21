<!--
  JAN-PWADESIGNER-DR-001 DWP-02 — the per-node walkthrough panel. Five limbs for the node at the current step:
  inputs/producers, outputs/consumers, the INV-2-conditioned assurance floor (via the SHARED floorRailFor — the
  card-adapter logic, NOT the inspector rail which renders the full floor unconditionally), the node-keyed coherence
  finding, and the reused PWU work-lifecycle topology. Presentation only; reads already-loaded data, writes nothing.
-->
<script lang="ts">
	import PwuBehaviorPanel from '$lib/behavior/PwuBehaviorPanel.svelte';
	import { floorRailFor, type PwuTypeNode } from '$lib/pwaFlow';
	import { handoffNeighbors } from '$lib/walkthrough';
	import { assurancePolicyLabel } from '$lib/authoring/pwuType';
	import {
		leafKind,
		leafKindLabel,
		type NodeHandoffFinding,
		type PwuBehaviorProjection
	} from '@janumipwb/rph-projections';

	interface WalkNode extends PwuTypeNode {
		readonly boundaryContract?: {
			readonly counterpartyLabel?: string;
			readonly attestedAssurancePolicyIds?: readonly string[];
			readonly applicabilityNote?: string;
		};
	}

	interface Props {
		node: WalkNode;
		types: readonly PwuTypeNode[];
		behavior: PwuBehaviorProjection;
		finding?: NodeHandoffFinding;
		stepNumber?: number;
	}

	let { node, types, behavior, finding, stepNumber }: Props = $props();

	const neighbors = $derived(handoffNeighbors(node, types));
	const rail = $derived(floorRailFor(node));
	const delegated = $derived(node.executionBoundary === 'DELEGATED_EXTERNAL');
	const declaredPolicies = $derived(node.requiredAssurancePolicyIds ?? []);
</script>

<section class="walkpanel" data-testid="walkthrough-panel">
	<header class="wp-head">
		<h4>
			{#if stepNumber !== undefined}<span
					class="wp-step"
					title="Dependency step — what must be produced before what can be consumed. Not an execution order."
					>Dependency step {stepNumber}</span
				>{/if}
			{node.name}
		</h4>
		<p class="wp-kind">
			<span class={delegated ? 'boundarybadge delegated' : 'boundarybadge internal'}>
				{delegated ? 'DELEGATED · external' : 'INTERNAL'}
			</span>
			<span class="leafkind">{leafKindLabel(leafKind(node))}</span>
		</p>
	</header>

	<div class="wp-limb" data-testid="wp-inputs">
		<span class="flabel">Inputs · producers</span>
		{#if neighbors.inputs.length === 0}
			<p class="fhelp">— (no required inputs)</p>
		{:else}
			<ul>
				{#each neighbors.inputs as link (link.artifact)}
					<li>
						<code>{link.artifact}</code> ←
						{link.counterparts.length ? link.counterparts.join(', ') : 'no producer in this PWA'}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="wp-limb" data-testid="wp-outputs">
		<span class="flabel">Outputs · consumers</span>
		{#if neighbors.outputs.length === 0}
			<p class="fhelp">— (no required outputs)</p>
		{:else}
			<ul>
				{#each neighbors.outputs as link (link.artifact)}
					<li>
						<code>{link.artifact}</code> →
						{link.counterparts.length ? link.counterparts.join(', ') : 'no consumer in this PWA'}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="wp-limb assurancerail" data-testid="wp-floor">
		<span class="flabel">Assurance floor</span>
		<div class="railfloor">
			<div class="raillocked">🔒 Mandatory · non-removable</div>
			{#each rail.labels as label (label)}
				<div class="railitem">{label}</div>
			{/each}
			{#if rail.attestationSubstitute}
				<div class="railitem substitute" data-testid="wp-attestation">
					{rail.attestationSubstitute}
				</div>
			{/if}
		</div>
		{#if declaredPolicies.length}
			<div class="railadd">
				{#each declaredPolicies as pid (pid)}
					<div class="railitem plus">+ {assurancePolicyLabel(pid)}</div>
				{/each}
			</div>
		{/if}
		{#if delegated && node.boundaryContract}
			<p class="fhelp">
				Counterparty: <strong>{node.boundaryContract.counterpartyLabel || '—'}</strong> — attested (their
				claim, not our review):
			</p>
			{#if node.boundaryContract.attestedAssurancePolicyIds?.length}
				<ul>
					{#each node.boundaryContract.attestedAssurancePolicyIds as pid (pid)}
						<li>{assurancePolicyLabel(pid)}</li>
					{/each}
				</ul>
			{:else}
				<p class="fhelp">— (none attested)</p>
			{/if}
		{/if}
	</div>

	{#if finding}
		<div class="wp-limb" data-testid="wp-findings">
			<span class="flabel">Coherence</span>
			<p>
				{leafKindLabel(finding.leafKind)}{#if finding.inCycle}
					· <strong class="warn">in a hand-off cycle</strong>{/if}{#if finding.blocked}
					· <strong class="warn">downstream of a cycle (blocked)</strong>{/if}
			</p>
		</div>
	{/if}

	<div class="wp-limb" data-testid="wp-lifecycle">
		<PwuBehaviorPanel {behavior} title="Declared PWU work-lifecycle topology" />
	</div>

	<p class="fhelp wp-caveat" data-testid="wp-caveat">
		Hand-off <strong>dependency</strong> order — what must be produced before what can be consumed. NOT an
		execution schedule; temporal order belongs to an Execution Plan.
	</p>
</section>

<style>
	.walkpanel {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.wp-head h4 {
		margin: 0;
	}
	.wp-step {
		display: inline-block;
		margin-right: 0.4rem;
		padding: 0.05rem 0.4rem;
		border-radius: 0.5rem;
		background: var(--accent-soft, #e5edff);
		color: var(--accent, #2748b8);
		font-size: 0.72rem;
		font-weight: 600;
	}
	.wp-limb {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.wp-limb ul {
		margin: 0.1rem 0 0;
		padding-left: 1rem;
	}
	.railitem.substitute {
		font-style: italic;
		opacity: 0.85;
	}
	.warn {
		color: var(--warn, #b26a00);
	}
	.wp-caveat {
		border-top: 1px dashed var(--border, #d4d8e0);
		padding-top: 0.4rem;
	}
</style>
