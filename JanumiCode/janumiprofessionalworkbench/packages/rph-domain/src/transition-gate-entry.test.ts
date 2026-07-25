// JAN-EXECREM WP-3 — plan-entry edges, ONE entry definition, and the graph-incoherence floor.
// Closes F-03, F-04, F-05 — three BLOCKERs reported by three independent lenses, all one mechanism.
//
// THE MECHANISM. A plan-entry edge (`sourceStepId` absent, `targetStepId` present) is contract-legal and
// explicitly blessed by `checkDanglingIds` ("A missing SOURCE is legitimate: that is a plan-entry edge"). But the
// two planes counted entries differently:
//   propose-time  `buildAdjacency` counted in-degree over BOTH-endpoint edges  -> s1 in-degree 0 -> s1 IS an entry -> VALID
//   runtime       seeded the BFS from `inEdgesOf(...).length === 0`            -> s1 has 1 in-edge -> NOT an entry -> frontier EMPTY
// An empty frontier makes the live set empty, so EVERY source reads not-live, EVERY in-edge NEUTRALIZED, and every
// step simultaneously unstartable AND waiver-free prunable. A contract-legal plan therefore (a) reported its whole
// graph unreachable and (b) turned Prune into a blanket bypass of the mandatory-skip waiver rule.
//
// No test covered it, which is why it shipped. These are those tests.
import { describe, expect, it } from 'vitest';
import {
	entryStepIds,
	prunableStepIds,
	startableStepIds,
	startStepGate,
	validateTransitionGraph,
	type GatePlan,
	type GateStep,
	type GateTransition
} from './transition-gate.js';

const step = (id: string, stepState: string, extra: Partial<GateStep> = {}): GateStep => ({
	id,
	stepState,
	...extra
});
/** An edge; pass `undefined` as the source to author a PLAN-ENTRY edge. */
const edge = (
	sourceStepId: string | undefined,
	targetStepId: string,
	extra: Partial<GateTransition> = {}
): GateTransition => ({ ...(sourceStepId === undefined ? {} : { sourceStepId }), targetStepId, ...extra });

/** s1 -> s2 -> s3, with an explicit PLAN-ENTRY edge into s1. The exact shape the three BLOCKERs describe. */
function entryEdgePlan(states: [string, string, string] = ['QUEUED', 'QUEUED', 'QUEUED']): GatePlan {
	return {
		status: 'ACTIVE',
		steps: [step('s1', states[0]), step('s2', states[1]), step('s3', states[2])],
		transitions: [
			edge(undefined, 's1', { id: 'entry' }),
			edge('s1', 's2', { id: 't12' }),
			edge('s2', 's3', { id: 't23' })
		]
	};
}

describe('WP-3 — a plan-entry edge no longer voids the graph (F-03/F-04/F-05)', () => {
	it('the entry step is STARTABLE (the frontier is seeded, not emptied)', () => {
		expect(startableStepIds(entryEdgePlan())).toEqual(['s1']);
	});

	it('NOTHING is prunable — Prune is not a universal waiver bypass', () => {
		expect(prunableStepIds(entryEdgePlan())).toEqual([]);
	});

	it('startable and prunable are DISJOINT (a step cannot be both runnable and dead)', () => {
		const plan = entryEdgePlan();
		const startable = new Set(startableStepIds(plan));
		for (const id of prunableStepIds(plan)) expect(startable.has(id), `${id} is both`).toBe(false);
	});

	it('the graph still SEQUENCES: s2 waits for s1, then advances', () => {
		expect(startableStepIds(entryEdgePlan(['QUEUED', 'QUEUED', 'QUEUED']))).toEqual(['s1']);
		expect(startableStepIds(entryEdgePlan(['SUCCEEDED', 'QUEUED', 'QUEUED']))).toEqual(['s2']);
		expect(startableStepIds(entryEdgePlan(['SUCCEEDED', 'SUCCEEDED', 'QUEUED']))).toEqual(['s3']);
	});

	it('the start-gate AUTHORITY agrees with the read-model on the entry step', () => {
		expect(startStepGate(entryEdgePlan(), 's1').ok).toBe(true);
		const blocked = startStepGate(entryEdgePlan(), 's2');
		expect(blocked.ok).toBe(false);
		expect(blocked.blockerStepId).toBe('s1'); // blocked by its predecessor, NOT declared unreachable
	});

	it('propose-time validation ACCEPTS the entry-edge plan (it always did — that was half the divergence)', () => {
		const plan = entryEdgePlan();
		expect(validateTransitionGraph(plan.steps, plan.transitions ?? [])).toEqual({ ok: true });
	});
});

describe('WP-3 — ONE entry definition, shared by both planes', () => {
	it('entryStepIds treats a source-less edge as MARKING an entry, not disqualifying one', () => {
		const plan = entryEdgePlan();
		expect(entryStepIds(plan.steps, plan.transitions ?? [])).toEqual(['s1']);
	});

	it('is identical for a graph with NO entry edge (so the change is inert there)', () => {
		const steps = [step('a', 'QUEUED'), step('b', 'QUEUED')];
		const transitions = [edge('a', 'b', { id: 'ab' })];
		expect(entryStepIds(steps, transitions)).toEqual(['a']);
	});

	it('agrees with propose-time validation on the entry COUNT (the drift that caused F-03)', () => {
		// Two entry edges into two different steps = two entries; propose must refuse, and the shared function
		// must be what it refuses on.
		const steps = [step('a', 'QUEUED'), step('b', 'QUEUED')];
		const transitions = [edge(undefined, 'a', { id: 'e1' }), edge(undefined, 'b', { id: 'e2' })];
		expect(entryStepIds(steps, transitions)).toEqual(['a', 'b']);
		const v = validateTransitionGraph(steps, transitions);
		expect(v.ok).toBe(false);
		expect(v.message).toContain('exactly one entry');
	});
});

describe('WP-3 — the graph-incoherence floor FAILS CLOSED', () => {
	/** A cycle with no entry. Propose-time refuses this; it can only arrive as stored history or around the bus. */
	const cyclic: GatePlan = {
		status: 'ACTIVE',
		steps: [step('a', 'QUEUED'), step('b', 'QUEUED')],
		transitions: [edge('a', 'b', { id: 'ab' }), edge('b', 'a', { id: 'ba' })]
	};

	it('offers NOTHING to prune on an entry-less graph (the blanket-bypass case)', () => {
		expect(prunableStepIds(cyclic)).toEqual([]);
	});

	it('offers nothing to START either — it fails closed in both directions', () => {
		expect(startableStepIds(cyclic)).toEqual([]);
	});

	it('the start-gate names INCOHERENCE and does NOT tell the caller to prune', () => {
		const r = startStepGate(cyclic, 'a');
		expect(r.ok).toBe(false);
		expect(r.reason).toContain('no entry step');
		expect(r.reason).toContain('superseded');
		expect(r.reason, 'a plan the gate cannot reason about must not be offered for prune').not.toContain(
			'it should be pruned'
		);
	});

	it('propose-time refuses the same graph, so the floor only ever sees legacy/around-the-bus plans', () => {
		expect(validateTransitionGraph(cyclic.steps, cyclic.transitions ?? []).ok).toBe(false);
	});
});
