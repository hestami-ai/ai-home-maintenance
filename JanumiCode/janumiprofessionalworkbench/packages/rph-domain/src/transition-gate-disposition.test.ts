// JAN-EXECREM WP-4 — the canonical in-edge disposition. Closes F-06 (BLOCKER), F-16, F-17, F-20, and pins F-38/F-46.
//
// ROOT CAUSE. ONE question — "can this edge still conduct?" — had THREE independently-maintained answers:
// `inEdgeDisposition` (the barrier's), `branchExcludes` (reachability's), and the entry-degree disagreement WP-3
// fixed. Each new way an edge could die was taught to only one of them. `branchExcludes` knew about exactly one
// thing (a resolved BRANCH not selecting an arm) and returned false for everything else, so a CANCELLED source
// left its downstream LIVE forever — and the only exit, a waiver-skip, RESURRECTED the arm. That is F-06, the
// THIRD recurrence of the dead-arm class after DWP-07 and DWP-08 each patched one instance of it.
//
// The fix is one ladder plus one override, so there is no second place left for a case to be missed.
import { describe, expect, it } from 'vitest';
import { STATE_MACHINES } from './transitions.data.js';
import {
	inEdgeDisposition,
	prunableStepIds,
	startableStepIds,
	startStepGate,
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
const edge = (
	sourceStepId: string,
	targetStepId: string,
	extra: Partial<GateTransition> = {}
): GateTransition => ({ sourceStepId, targetStepId, ...extra });

describe('WP-4 — the terminal classifications are DERIVED FROM THE MACHINE, not chosen', () => {
	const machine = STATE_MACHINES['ExecutionStep.stepState']!;
	const outArrowsFrom = (state: string) => machine.transitions.filter((t) => t.from === state).map((t) => t.to);

	it('FAILED is the ONLY terminal state the machine can leave (so it is the only REOPENABLE one)', () => {
		const reopenable = machine.terminalStates.filter((st) => outArrowsFrom(st).length > 0);
		expect(reopenable).toEqual(['FAILED']);
		// Both of FAILED's out-arrows are ways to SETTLE it, which is why an edge out of it reads PENDING until one
		// is taken: QUEUED reopens the attempt (retry), CANCELLED abandons it on the record (WP-5). The second was
		// added by WP-5 and this pin is why that addition had to be a conscious act — it went RED first.
		expect([...outArrowsFrom('FAILED')].sort()).toEqual(['CANCELLED', 'QUEUED']);
	});

	it('CANCELLED and SUPERSEDED have NO out-arrows (so they are irrecoverable)', () => {
		expect(outArrowsFrom('CANCELLED')).toEqual([]);
		expect(outArrowsFrom('SUPERSEDED')).toEqual([]);
	});

	// If someone gives a terminal state a new out-arrow, the disposition ladder's meaning changes silently. This
	// fails instead.
	it('the terminal set itself is what the ladder assumes', () => {
		expect([...machine.terminalStates].sort()).toEqual([
			'CANCELLED',
			'FAILED',
			'SKIPPED',
			'SUCCEEDED',
			'SUPERSEDED'
		]);
	});
});

describe('WP-4 / F-06 — an irrecoverably-terminal source kills its downstream (the third recurrence, closed)', () => {
	/** s1 -> s2 -> s3. s2 is CANCELLED: it can never conduct, so s3 is structurally dead. */
	const cancelledMid = (s3State = 'QUEUED'): GatePlan => ({
		status: 'ACTIVE',
		steps: [step('s1', 'SUCCEEDED'), step('s2', 'CANCELLED'), step('s3', s3State)],
		transitions: [edge('s1', 's2', { id: 't12' }), edge('s2', 's3', { id: 't23' })]
	});

	it('the edge out of a CANCELLED source is NEUTRALIZED (reachability now sees it — it did not before)', () => {
		const p = cancelledMid();
		expect(inEdgeDisposition(p, p.transitions![1]!)).toBe('NEUTRALIZED');
	});

	it('the downstream is DEAD: not startable, and offered for prune', () => {
		const p = cancelledMid();
		expect(startableStepIds(p)).not.toContain('s3');
		expect(prunableStepIds(p)).toEqual(['s3']);
	});

	it('a WAIVER-SKIP cannot RESURRECT the dead arm — this is the exact F-06 harm', () => {
		// The arm is cleared by a waiver-skip rather than a prune, so it is SKIPPED — which is IN terminal-success.
		// Before WP-4 that made its out-edge read "done, carry on" and everything downstream went live again.
		const p: GatePlan = {
			status: 'ACTIVE',
			steps: [
				step('s1', 'SUCCEEDED'),
				step('s2', 'CANCELLED'),
				step('s3', 'SKIPPED'), // waived away on the dead arm
				step('s4', 'QUEUED') // its downstream MUST stay dead
			],
			transitions: [
				edge('s1', 's2', { id: 't12' }),
				edge('s2', 's3', { id: 't23' }),
				edge('s3', 's4', { id: 't34' })
			]
		};
		expect(inEdgeDisposition(p, p.transitions![2]!), 'a SKIPPED-but-dead source satisfies nothing').toBe(
			'NEUTRALIZED'
		);
		expect(startableStepIds(p), 'the arm must not come back to life').not.toContain('s4');
		expect(prunableStepIds(p)).toEqual(['s4']);
	});

	it('SUPERSEDED behaves identically to CANCELLED (both are irrecoverable)', () => {
		const p: GatePlan = {
			status: 'ACTIVE',
			steps: [step('s1', 'SUCCEEDED'), step('s2', 'SUPERSEDED'), step('s3', 'QUEUED')],
			transitions: [edge('s1', 's2', { id: 't12' }), edge('s2', 's3', { id: 't23' })]
		};
		expect(inEdgeDisposition(p, p.transitions![1]!)).toBe('NEUTRALIZED');
		expect(prunableStepIds(p)).toEqual(['s3']);
	});
});

describe('WP-4 / F-16 — a REOPENABLE failure has not settled, so a barrier waits', () => {
	/** A diamond: s1 fans to s2/s3, both rejoin at s4. */
	const diamond = (states: [string, string, string, string]): GatePlan => ({
		status: 'ACTIVE',
		steps: states.map((st, i) => step(`s${i + 1}`, st)),
		transitions: [
			edge('s1', 's2', { id: 'a' }),
			edge('s1', 's3', { id: 'b' }),
			edge('s2', 's4', { id: 'c' }),
			edge('s3', 's4', { id: 'd' })
		]
	});

	it('the join WAITS on a FAILED arm (it may still be retried)', () => {
		expect(startableStepIds(diamond(['SUCCEEDED', 'SUCCEEDED', 'FAILED', 'QUEUED']))).not.toContain('s4');
	});

	it('and RELEASES once that arm settles — by success OR by abandonment', () => {
		expect(startableStepIds(diamond(['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'QUEUED']))).toEqual(['s4']);
		expect(startableStepIds(diamond(['SUCCEEDED', 'SUCCEEDED', 'CANCELLED', 'QUEUED']))).toEqual(['s4']);
	});

	it('a FAILED step is still NOT laundered into a prune (a failure is not an exclusion)', () => {
		const p = diamond(['SUCCEEDED', 'SUCCEEDED', 'FAILED', 'QUEUED']);
		expect(prunableStepIds(p), 'the failed arm itself is not prunable').not.toContain('s3');
		expect(prunableStepIds(p), 'nor is the join, which still has a live in-edge').not.toContain('s4');
	});
});

describe('WP-4 / F-17 + F-20 — the coherence invariant: the gate and the prune read-model cannot contradict', () => {
	const guard: EdgeGuardEvaluator = () => false;

	/** Eight plan shapes covering entry/linear/diamond/branch/dead-arm/irrecoverable/failed/incoherent. */
	const matrix: ReadonlyArray<[string, GatePlan]> = [
		['linear fresh', { status: 'ACTIVE', steps: [step('a', 'QUEUED'), step('b', 'QUEUED')], transitions: [] }],
		[
			'linear advanced',
			{ status: 'ACTIVE', steps: [step('a', 'SUCCEEDED'), step('b', 'QUEUED')], transitions: [] }
		],
		[
			'graph fresh',
			{
				status: 'ACTIVE',
				steps: [step('a', 'QUEUED'), step('b', 'QUEUED')],
				transitions: [edge('a', 'b', { id: 'ab' })]
			}
		],
		[
			'diamond mid',
			{
				status: 'ACTIVE',
				steps: [step('a', 'SUCCEEDED'), step('b', 'SUCCEEDED'), step('c', 'QUEUED'), step('d', 'QUEUED')],
				transitions: [
					edge('a', 'b', { id: '1' }),
					edge('a', 'c', { id: '2' }),
					edge('b', 'd', { id: '3' }),
					edge('c', 'd', { id: '4' })
				]
			}
		],
		[
			'resolved branch with a dead arm',
			{
				status: 'ACTIVE',
				steps: [
					step('a', 'SUCCEEDED', { stepType: 'BRANCH' }),
					step('b', 'QUEUED'),
					step('c', 'QUEUED')
				],
				transitions: [
					edge('a', 'b', { id: 'cond', transitionType: 'CONDITIONAL', conditionExpression: { x: 1 } }),
					edge('a', 'c', { id: 'def' })
				]
			}
		],
		[
			'irrecoverable mid',
			{
				status: 'ACTIVE',
				steps: [step('a', 'SUCCEEDED'), step('b', 'CANCELLED'), step('c', 'QUEUED')],
				transitions: [edge('a', 'b', { id: '1' }), edge('b', 'c', { id: '2' })]
			}
		],
		[
			'failed mid',
			{
				status: 'ACTIVE',
				steps: [step('a', 'SUCCEEDED'), step('b', 'FAILED'), step('c', 'QUEUED')],
				transitions: [edge('a', 'b', { id: '1' }), edge('b', 'c', { id: '2' })]
			}
		],
		[
			'entry-edge graph',
			{
				status: 'ACTIVE',
				steps: [step('a', 'QUEUED'), step('b', 'QUEUED')],
				transitions: [{ id: 'entry', targetStepId: 'a' }, edge('a', 'b', { id: 'ab' })]
			}
		]
	];

	it.each(matrix)('%s: startable and prunable are DISJOINT', (_name, plan) => {
		const startable = new Set(startableStepIds(plan, guard));
		for (const id of prunableStepIds(plan, guard))
			expect(startable.has(id), `${id} is offered BOTH to start and to prune`).toBe(false);
	});

	it.each(matrix)('%s: the AUTHORITY agrees with the read-model on every step', (_name, plan) => {
		const startable = new Set(startableStepIds(plan, guard));
		for (const s of plan.steps)
			expect(startStepGate(plan, s.id, guard).ok, `${s.id}: gate vs read-model`).toBe(startable.has(s.id));
	});

	it.each(matrix)('%s: a step the gate calls UNREACHABLE is offered for prune when its state permits', (_name, plan) => {
		const prunable = new Set(prunableStepIds(plan, guard));
		for (const s of plan.steps) {
			const r = startStepGate(plan, s.id, guard);
			const unreachable = !r.ok && (r.reason ?? '').includes('unreachable');
			if (unreachable && ['NOT_READY', 'READY', 'QUEUED'].includes(s.stepState))
				expect(prunable.has(s.id), `${s.id}: called unreachable but not prunable — F-20's contradiction`).toBe(
					true
				);
		}
	});
});
