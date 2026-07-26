// JAN-REVREM RW-7 — finding N-8: prune provenance for the NON-BRANCH cut.
//
// THE DEFECT. `pruneProvenance` bailed on any non-BRANCH source, so pruning a step below a CANCELLED predecessor
// produced NO provenance and the emitted `ExecutionStepPruned` carried `{ stepId, stepState: 'SKIPPED' }` — byte-
// identical in CONTENT to a waived skip. That is precisely the conflation DR-004 §19-M1 minted a distinct event type
// to prevent ("do not conflate a system prune with a user waiver"), so the event type was carrying its whole
// justification in its NAME and nothing else.
//
// TWO THINGS MADE IT SURVIVE REVIEW. First, A-3 was recorded CLOSED when it was not. Second, the function's header
// claimed the non-BRANCH cut was "unreachable through an authorable plan" — while a fixture in this very package
// (`transition-gate-disposition.test.ts`, the `cancelledMid` plan) built exactly that plan and asserted the prune IS
// offered. The fixture proving reachability and the comment denying it were in the same directory.
//
// THE FIX WAS THE TYPE, NOT THE WALK (DS-001 §6c R10). `PruneProvenance` was branch-shaped — `branchStepId`,
// `selectedEdgeId` — and a dead-predecessor cut has no branch and no selected arm. The walk was declining to
// fabricate a `branchStepId`, correctly, and then had nothing it was permitted to say.
import { describe, expect, it } from 'vitest';
import {
	pruneProvenance,
	prunableStepIds,
	type GatePlan,
	type GateStep,
	type GateTransition
} from './transition-gate.js';

const step = (id: string, stepState: string, extra: Partial<GateStep> = {}): GateStep => ({
	id,
	stepState,
	...extra
});
const edge = (
	sourceStepId: string,
	targetStepId: string,
	extra: Partial<GateTransition> = {}
): GateTransition => ({ sourceStepId, targetStepId, ...extra });

/** s1 -> s2 -> s3, with s2 in an irrecoverable terminal state: s2 can never conduct, so s3 is structurally dead.
 *  This is the `cancelledMid` fixture from transition-gate-disposition.test.ts — the one that disproved the
 *  "unreachable" claim — reused rather than re-invented, so the two files cannot drift apart about the case. */
const deadMid = (midState: string): GatePlan => ({
	status: 'ACTIVE',
	steps: [step('s1', 'SUCCEEDED'), step('s2', midState), step('s3', 'QUEUED')],
	transitions: [edge('s1', 's2', { id: 't12' }), edge('s2', 's3', { id: 't23' })]
});

describe('RW-7 — the DEAD_PREDECESSOR cut is recorded (N-8, the finding itself)', () => {
	it('a step below a CANCELLED predecessor gets provenance naming the dead step and its state', () => {
		// BEFORE RW-7 THIS WAS `undefined`. That is the whole finding: the gate authorized the prune and could say
		// nothing whatever about why, so the event was indistinguishable from a waiver.
		const p = deadMid('CANCELLED');
		expect(prunableStepIds(p), 'precondition: the gate really does offer this prune').toEqual(['s3']);
		expect(pruneProvenance(p, 's3')).toEqual({
			cause: 'DEAD_PREDECESSOR',
			deadStepId: 's2',
			deadStepState: 'CANCELLED',
			excludedEdgeId: 't23'
		});
	});

	it('reports SUPERSEDED as SUPERSEDED — the state is read, not assumed to be CANCELLED', () => {
		// Both are irrecoverable, and an auditor's next question is WHICH. A single `deadStepId` with no state would
		// force a stream replay to answer it, and the gate holds the answer at the moment it decides.
		expect(pruneProvenance(deadMid('SUPERSEDED'), 's3')).toMatchObject({
			cause: 'DEAD_PREDECESSOR',
			deadStepState: 'SUPERSEDED'
		});
	});

	it('walks TRANSITIVELY: a step two hops below the dead predecessor still gets provenance', () => {
		// The dead subgraph's own in-edges come from other DEAD steps, so reading only immediate in-edges would find
		// provenance for the first step of the arm and nothing for the rest. Ledger mutant WP14-M4 guards this walk.
		const p: GatePlan = {
			status: 'ACTIVE',
			steps: [
				step('s1', 'SUCCEEDED'),
				step('s2', 'CANCELLED'),
				step('s3', 'QUEUED'),
				step('s4', 'QUEUED')
			],
			transitions: [
				edge('s1', 's2', { id: 't12' }),
				edge('s2', 's3', { id: 't23' }),
				edge('s3', 's4', { id: 't34' })
			]
		};
		expect(pruneProvenance(p, 's4')).toMatchObject({
			cause: 'DEAD_PREDECESSOR',
			deadStepId: 's2',
			// The CUT is the edge off the LIVE-to-dead boundary, not the edge adjacent to s4.
			excludedEdgeId: 't23'
		});
	});
});

describe('RW-7 — the BRANCH case is unchanged (R12), and wins the tie', () => {
	/** s1 is a settled BRANCH that selected t-a; s3 hangs off the not-taken t-b. */
	const branchPlan = (branchState = 'SUCCEEDED'): GatePlan => ({
		status: 'ACTIVE',
		steps: [
			step('s1', branchState, { stepType: 'BRANCH', selectedTransitionId: 't-a' }),
			step('s2', 'QUEUED'),
			step('s3', 'QUEUED')
		],
		transitions: [
			edge('s1', 's2', { id: 't-a', conditionExpression: { kind: 'always' } }),
			edge('s1', 's3', { id: 't-b', conditionExpression: { kind: 'always' } })
		]
	});

	it('still reports BRANCH_DECISION with the same three fields it always did', () => {
		expect(pruneProvenance(branchPlan(), 's3')).toEqual({
			cause: 'BRANCH_DECISION',
			branchStepId: 's1',
			selectedEdgeId: 't-a',
			excludedEdgeId: 't-b'
		});
	});

	it('a CANCELLED BRANCH reports BRANCH_DECISION, not DEAD_PREDECESSOR — the ORDER proof', () => {
		// A cancelled branch satisfies BOTH arms' preconditions. BRANCH is checked first because its recorded
		// selection is the more specific fact and the one an auditor can act on; the other order would silently
		// downgrade every branch cut whose branch was later cancelled, losing the selectedEdgeId for good.
		const v = pruneProvenance(branchPlan('CANCELLED'), 's3');
		expect(v?.cause).toBe('BRANCH_DECISION');
		expect(v).toMatchObject({ branchStepId: 's1', selectedEdgeId: 't-a' });
	});
});

describe('RW-7 — no cause is invented where nothing has decided', () => {
	it('a step excluded by a PENDING source gets NO provenance', () => {
		// s2 is FAILED — a REOPENABLE terminal, so its out-edge is PENDING, not NEUTRALIZED: it may yet conduct via a
		// retry. Naming a cause here would assert a decision nobody has made, which is the fabrication R10 exists to
		// prevent. Withholding provenance is correct; withholding it for a CANCELLED source was the bug.
		expect(pruneProvenance(deadMid('FAILED'), 's3')).toBeUndefined();
	});

	it('a still-reachable step gets NO provenance, because nothing cut it off', () => {
		expect(pruneProvenance(deadMid('SUCCEEDED'), 's3')).toBeUndefined();
	});
});
