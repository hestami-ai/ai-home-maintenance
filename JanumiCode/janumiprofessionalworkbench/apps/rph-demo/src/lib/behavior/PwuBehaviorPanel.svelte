<script lang="ts">
	import { untrack } from 'svelte';
	import { useMachine } from '@xstate/svelte';
	import type { PwuBehaviorProjection } from '@janumipwb/rph-projections';
	import { compilePwuBehaviorMachine } from './pwuBehaviorMachine.js';

	interface Props {
		behavior: PwuBehaviorProjection;
		title?: string;
	}

	let { behavior, title = 'Declared PWU work-lifecycle topology' }: Props = $props();
	// An XState actor's logic is fixed for its lifetime. A caller that supplies another projection must remount
	// the panel (for example with a keyed block), so intentionally capture the projection once.
	const simulationBehavior = untrack(() => behavior);
	const { snapshot, send } = useMachine(compilePwuBehaviorMachine(simulationBehavior));
	const activeState = $derived(String($snapshot.value));
	const outgoing = $derived(
		simulationBehavior.transitions.filter((transition) => transition.from === activeState)
	);
</script>

<section class="behavior" aria-label={title}>
	<header>
		<div>
			<h3>{title}</h3>
			<p>Derived structural simulation</p>
		</div>
		<span class="scope">non-authoritative</span>
	</header>

	<p class="notice">
		This actor explores the declared <code>PWU.workLifecycleState</code> topology only. It does not evaluate
		eligibility, dispatch a Command, or persist professional state. The execution, assurance, and
		shape-integrity axes remain independent and are not simulated.
	</p>

	<output class="active" aria-live="polite">
		<span>Simulated state</span>
		<strong>{activeState}</strong>
	</output>

	{#if $snapshot.status === 'done'}
		<p class="terminal">Terminal work-lifecycle state reached. Use Restart simulation to begin again.</p>
	{:else if outgoing.length === 0}
		<p class="empty">No outgoing transition is declared from this state.</p>
	{:else}
		<ul aria-label={`Simulation transitions from ${activeState}`}>
			{#each outgoing as transition (transition.id)}
				<li>
					<button
						type="button"
						onclick={() => send({ type: transition.simulationEventType })}
						aria-label={`Simulate ${transition.from} to ${transition.to}`}
					>
						<span class="target">→ {transition.to}</span>
						{#if transition.triggerDescription}
							<span class="annotation">{transition.triggerDescription}</span>
						{/if}
					</button>
					{#if transition.guardDescription}
						<p class="guard">
							<strong>Authoritative check, not evaluated:</strong> {transition.guardDescription}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.behavior {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--outline-faint, #404751);
		border-radius: 10px;
		background: var(--sc, #232324);
		color: var(--on, #e5e2e1);
		font-size: 12px;
	}

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	h3,
	header p,
	.notice,
	.terminal,
	.empty,
	.guard {
		margin: 0;
	}

	h3 {
		font-size: 14px;
	}

	header p {
		margin-top: 2px;
		color: var(--outline, #8a919d);
	}

	.scope {
		padding: 2px 7px;
		border: 1px solid var(--outline-faint, #404751);
		border-radius: 999px;
		color: var(--outline, #8a919d);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.notice,
	.terminal,
	.empty {
		color: var(--outline, #8a919d);
		line-height: 1.45;
	}

	.active {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 7px;
		background: var(--primary-container, #1a3a5c);
		color: var(--primary, #9fcaff);
	}

	.active strong {
		font-size: 12px;
	}

	ul {
		display: grid;
		gap: 7px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 4px;
	}

	button {
		display: grid;
		gap: 2px;
		width: 100%;
		padding: 7px 9px;
		border: 1px solid var(--outline-faint, #404751);
		border-radius: 7px;
		background: var(--sc-highest, #353539);
		color: var(--on-variant, #c0c7d3);
		text-align: left;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--primary, #9fcaff);
		background: var(--primary-container, #1a3a5c);
	}

	button:focus-visible {
		outline: 2px solid var(--focus-ring, #2970ff);
		outline-offset: 2px;
	}

	.target {
		font-weight: 700;
	}

	.annotation,
	.guard {
		color: var(--outline, #8a919d);
		font-size: 11px;
		line-height: 1.35;
	}

	.guard {
		padding: 0 4px;
	}
</style>
