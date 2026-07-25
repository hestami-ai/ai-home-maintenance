// JAN-EXECREM WP-14 / F-37 — the PURE half of prune provenance.
//
// The live half (execrem-wp14-provenance.test.ts) drives real commands and proves the handler DERIVES the fact.
// This file exercises the predicate directly, because two of its rules are unreachable through an authorable
// plan and would otherwise be untestable guards:
//   • the BRANCH requirement — propose-time validation refuses a CONDITIONAL out-edge from a non-BRANCH step, so
//     a live source with a NEUTRALIZED out-edge is ALWAYS a branch in any plan the system will accept; and
//   • the live-source requirement, whose failure mode (mis-attributing a JOIN) needs a shape the live fixture
//     does not naturally produce.
// `pruneProvenance` is pure and exported, so these need a plan literal rather than a seeding seam — which is why
// they are closed here instead of disclosed.
import { describe, expect, it } from 'vitest';
import {
	pruneProvenance,
	type EdgeGuardEvaluator,
	type GatePlan,
	type GateStep,
	type GateTransition
} from './transition-gate.js';

const step = (id: string, stepState: string, extra: Partial<GateStep> = {}): GateStep => ({
	id,
	stepState,
	...extra
});
const cond = (id: string, from: string, to: string): GateTransition => ({
	id,
	sourceStepId: from,
	targetStepId: to,
	transitionType: 'CONDITIONAL',
	conditionExpression: { always: false }
});
const seq = (id: string, from: string, to: string): GateTransition => ({
	id,
	sourceStepId: from,
	targetStepId: to,
	transitionType: 'SEQUENTIAL'
});
/** Every guard false, so a CONDITIONAL edge off a settled source is NEUTRALIZED. */
const guardFalse: EdgeGuardEvaluator = () => false;

/** s1 (SETTLED, decided for the default arm t13) -> s2 via the CUT t12 -> s4; and -> s3 via the taken t13. */
const branchPlan = (sourceType = 'BRANCH'): GatePlan => ({
	status: 'ACTIVE',
	steps: [
		step('s1', 'SUCCEEDED', { stepType: sourceType, selectedTransitionId: 't13' }),
		step('s2', 'QUEUED'),
		step('s3', 'QUEUED'),
		step('s4', 'QUEUED')
	],
	transitions: [cond('t12', 's1', 's2'), seq('t13', 's1', 's3'), seq('t24', 's2', 's4')]
});

describe('WP-14 / F-37 — pruneProvenance derives the cut, and refuses to guess', () => {
	it('names the branch, the arm it TOOK, and the arm that was CUT', () => {
		expect(pruneProvenance(branchPlan(), 's2', guardFalse)).toEqual({
			branchStepId: 's1',
			selectedEdgeId: 't13',
			excludedEdgeId: 't12'
		});
	});

	it('TRANSITIVE: a step deeper in the dead arm gets the SAME cut, not its own in-edge', () => {
		// s4's only in-edge comes from s2 — another DEAD step, not from the branch. Reading immediate in-edges
		// would find provenance for the first step of a dead arm and nothing for the rest of it.
		expect(pruneProvenance(branchPlan(), 's4', guardFalse)).toEqual({
			branchStepId: 's1',
			selectedEdgeId: 't13',
			excludedEdgeId: 't12'
		});
	});

	it('a LIVE step has no provenance — nothing cut it off', () => {
		expect(pruneProvenance(branchPlan(), 's3', guardFalse)).toBeUndefined();
		expect(pruneProvenance(branchPlan(), 's1', guardFalse)).toBeUndefined();
	});

	it('THE BRANCH REQUIREMENT: a non-BRANCH source is never attributed as the cut', () => {
		// Unreachable through an authorable plan (propose refuses a CONDITIONAL edge off a non-BRANCH step), and
		// therefore exactly the kind of guard that rots untested. Off a non-BRANCH source out-edges are INDEPENDENT
		// filters, not exclusive arms — the step is unreachable, but no DECISION excluded it, and inventing one
		// would put a false justification into the governed stream.
		expect(pruneProvenance(branchPlan('TRANSFORMATION'), 's2', guardFalse)).toBeUndefined();
	});

	it('THE LIVE-SOURCE REQUIREMENT: a JOIN still reachable via the taken arm is not mis-attributed', () => {
		// s4 joins the dead arm (s2) AND the taken arm (s3), so it is LIVE. Without the live-source term the walk
		// would reach s4 through its dead in-edge and report it as cut — attributing a prune to a step that is
		// still perfectly reachable.
		const joined: GatePlan = {
			...branchPlan(),
			transitions: [...branchPlan().transitions!, seq('t34', 's3', 's4')]
		};
		expect(pruneProvenance(joined, 's4', guardFalse)).toBeUndefined();
		// …while the genuinely dead arm still resolves.
		expect(pruneProvenance(joined, 's2', guardFalse)?.excludedEdgeId).toBe('t12');
	});

	it('an UNDECIDED branch cuts nothing — an unresolved arm is not a pruned one (WP-10 Rule B3)', () => {
		const undecided: GatePlan = {
			...branchPlan(),
			steps: [step('s1', 'SUCCEEDED', { stepType: 'BRANCH' }), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED')]
		};
		// Both arms read UNRESOLVED, so neither is live and neither is prunable — and no provenance is invented.
		expect(pruneProvenance(undecided, 's2', guardFalse)).toBeUndefined();
	});

	it('a linear plan (no transitions) has no provenance to derive', () => {
		expect(
			pruneProvenance({ status: 'ACTIVE', steps: [step('s1', 'QUEUED')], transitions: [] }, 's1')
		).toBeUndefined();
	});
});
