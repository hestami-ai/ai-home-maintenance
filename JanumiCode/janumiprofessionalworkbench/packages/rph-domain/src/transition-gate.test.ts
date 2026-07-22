import { describe, expect, it } from 'vitest';
import {
	inEdgeDisposition,
	prunableStepIds,
	startableStepIds,
	startStepGate,
	validateTransitionGraph,
	type EdgeGuardEvaluator,
	type GatePlan,
	type GateStep,
	type GateTransition,
	type GraphValidationStep
} from './transition-gate.js';

// JAN-EXECPLAN-DR-004 DWP-01 (Tier 3C-ii) — the pure transition-graph flow gate. The graph GENERALIZES the shipped
// linear array-index gate: empty transitions[] is byte-identical to the linear frontier; a non-empty graph gates on
// the in-edge barrier (no PENDING, ≥1 SATISFIED), covering a diamond barrier-join. Unconditional edges only (DWP-01).

const step = (id: string, stepState: string, stepType?: string): GateStep & { stepType?: string } =>
	stepType ? { id, stepState, stepType } : { id, stepState };
const edge = (sourceStepId: string, targetStepId: string, extra: Partial<GateTransition> = {}): GateTransition => ({
	sourceStepId,
	targetStepId,
	...extra
});
const plan = (
	steps: readonly (GateStep & { stepType?: string })[],
	transitions: readonly GateTransition[] = [],
	status = 'ACTIVE'
): GatePlan => ({ status, steps, transitions });
const s = (n: number) => `s${n}`;

describe('startableStepIds — empty transitions[] is byte-identical to the shipped linear frontier', () => {
	const linear = (states: string[], status = 'ACTIVE') =>
		startableStepIds(plan(states.map((st, i) => step(s(i + 1), st)), [], status));

	it('fresh multi-step → the first step', () => expect(linear(['QUEUED', 'QUEUED'])).toEqual(['s1']));
	it('advances once the earlier step is SUCCEEDED', () => expect(linear(['SUCCEEDED', 'QUEUED'])).toEqual(['s2']));
	it('SKIPPED counts as terminal-success (advances)', () => expect(linear(['SKIPPED', 'QUEUED'])).toEqual(['s2']));
	it('all terminal-success → empty', () => expect(linear(['SUCCEEDED', 'SKIPPED'])).toEqual([]));
	it('non-ACTIVE plan → empty', () => expect(linear(['QUEUED', 'QUEUED'], 'SUPERSEDED')).toEqual([]));
	it('a FAILED predecessor blocks (empty frontier)', () => expect(linear(['FAILED', 'QUEUED'])).toEqual([]));
	it('returns the RUNNING frontier itself', () => expect(linear(['SUCCEEDED', 'RUNNING', 'QUEUED'])).toEqual(['s2']));
	it('single-step plan', () => expect(linear(['QUEUED'])).toEqual(['s1']));
});

describe('startableStepIds — the transition graph (unconditional edges)', () => {
	it('an explicit-linear graph behaves exactly like the array-index linear plan', () => {
		const steps = [step('s1', 'QUEUED'), step('s2', 'QUEUED'), step('s3', 'QUEUED')];
		const t = [edge('s1', 's2'), edge('s2', 's3')];
		expect(startableStepIds(plan(steps, t))).toEqual(['s1']); // only the entry
		const after1 = [step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED')];
		expect(startableStepIds(plan(after1, t))).toEqual(['s2']); // s1 done → s2's in-edge SATISFIED
	});

	it('a diamond fans out then barrier-JOINS (D fires only when BOTH B and C are done)', () => {
		const t = [edge('s1', 's2'), edge('s1', 's3'), edge('s2', 's4'), edge('s3', 's4')];
		const at = (states: string[]) => startableStepIds(plan(states.map((st, i) => step(s(i + 1), st)), t));
		expect(at(['SUCCEEDED', 'QUEUED', 'QUEUED', 'QUEUED']).sort()).toEqual(['s2', 's3']); // fan-out
		expect(at(['SUCCEEDED', 'SUCCEEDED', 'QUEUED', 'QUEUED'])).toEqual(['s3']); // s2 done, s3 pending → NOT s4 yet
		expect(at(['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'QUEUED'])).toEqual(['s4']); // both done → join fires
	});

	it('a NEUTRALIZED (FAILED-source) in-edge does not, by itself, make a join startable', () => {
		// s4 in-edges: s2 SUCCEEDED (SATISFIED), s3 FAILED (NEUTRALIZED). No PENDING, ≥1 SATISFIED → s4 startable
		// (the barrier neutralizes the failed arm rather than wedging — the DWP-05 semantics, correct here too).
		const t = [edge('s1', 's2'), edge('s1', 's3'), edge('s2', 's4'), edge('s3', 's4')];
		const states = ['SUCCEEDED', 'SUCCEEDED', 'FAILED', 'QUEUED'];
		expect(startableStepIds(plan(states.map((st, i) => step(s(i + 1), st)), t))).toEqual(['s4']);
	});
});

// DR-004 DWP-05 (Tier 3C-ii) — PARALLEL_GROUP fan-out + JOIN. No new gate logic: the set frontier and the in-edge
// barrier are DWP-01's, and PARALLEL_GROUP is a node KIND the gate deliberately does not special-case (D2: parallelism
// is TOPOLOGY — ≥2 unconditional out-edges — not an edge type). These prove that under real fan-out widths and the
// prune/branch interaction, rather than assuming it from the binary diamond above.
describe('PARALLEL_GROUP fan-out + barrier JOIN (DWP-05)', () => {
	/** s1 (PARALLEL_GROUP) fans out to `width` arms, each rejoining at the last step. */
	const fan = (width: number) => {
		const armIds = Array.from({ length: width }, (_, i) => s(i + 2));
		const joinId = s(width + 2);
		const transitions = [
			...armIds.map((a) => edge('s1', a)),
			...armIds.map((a) => edge(a, joinId))
		];
		return { armIds, joinId, transitions };
	};
	const at = (states: string[], transitions: readonly GateTransition[]) =>
		startableStepIds(plan(states.map((st, i) => step(s(i + 1), st)), transitions)).sort();

	it('fans out to EVERY arm at once — the frontier is a set, not a scalar (width 3)', () => {
		const { armIds, transitions } = fan(3);
		// s1 SUCCEEDED; s2/s3/s4 QUEUED; s5 (join) QUEUED.
		expect(at(['SUCCEEDED', 'QUEUED', 'QUEUED', 'QUEUED', 'QUEUED'], transitions)).toEqual(armIds);
	});

	it('the JOIN waits for the LAST arm — one arm still RUNNING keeps it PENDING (width 3)', () => {
		const { joinId, transitions } = fan(3);
		expect(at(['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'RUNNING', 'QUEUED'], transitions)).toEqual(['s4']);
		expect(at(['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'QUEUED'], transitions)).toEqual([joinId]);
	});

	it('a concurrently-RUNNING sibling is not re-offered, but does not block its still-QUEUED siblings', () => {
		// Fan-out is independent per arm: starting s2 changes nothing about s3/s4's own barriers. (A RUNNING step is
		// non-terminal so it stays "at the frontier" by the pure rule; the ENGINE refuses to re-start it — DWP-04
		// rejectReentry — so the two layers together offer each arm exactly once.)
		const { transitions } = fan(3);
		expect(at(['SUCCEEDED', 'RUNNING', 'QUEUED', 'QUEUED', 'QUEUED'], transitions)).toEqual(['s2', 's3', 's4']);
	});

	// The parallel × branch interaction the roadmap calls out: a not-taken arm left QUEUED holds a PENDING in-edge on
	// the join FOREVER. That is exactly the wedge prune exists to clear — and why prune drives to SKIPPED (terminal
	// SUCCESS) rather than a terminal-failure state, which would only neutralize the edge, not satisfy it.
	describe('a JOIN behind a resolved BRANCH', () => {
		const guard: EdgeGuardEvaluator = (e) =>
			(e.conditionExpression as { result?: boolean } | undefined)?.result === true;
		// s1 BRANCH → s2 (CONDITIONAL, true) | s3 (SEQUENTIAL default); both → s4 (join).
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 's2', transitionType: 'CONDITIONAL', conditionExpression: { result: true } },
			{ sourceStepId: 's1', targetStepId: 's3', transitionType: 'SEQUENTIAL' },
			edge('s2', 's4'),
			edge('s3', 's4')
		];
		// s1 is the BRANCH node — exclusive first-match belongs to a BRANCH stepType and nothing else (DWP-07), and
		// propose-time validation now REFUSES a CONDITIONAL out-edge from any other kind of step.
		const p = (states: string[]) =>
			plan(states.map((st, i) => step(s(i + 1), st, i === 0 ? 'BRANCH' : undefined)), t);

		it('WEDGES while the not-taken arm sits QUEUED (its in-edge to the join stays PENDING)', () => {
			const wedged = p(['SUCCEEDED', 'SUCCEEDED', 'QUEUED', 'QUEUED']);
			expect(startableStepIds(wedged, guard)).not.toContain('s4');
			expect(startStepGate(wedged, 's4', guard).ok).toBe(false);
			// …and the pure prune read-model names the culprit, so the controller can clear it.
			expect(prunableStepIds(wedged, guard)).toEqual(['s3']);
		});

		it('is RELEASED once the not-taken arm is pruned to SKIPPED (terminal-SUCCESS satisfies the edge)', () => {
			const pruned = p(['SUCCEEDED', 'SUCCEEDED', 'SKIPPED', 'QUEUED']);
			expect(startableStepIds(pruned, guard)).toEqual(['s4']);
			expect(startStepGate(pruned, 's4', guard).ok).toBe(true);
		});

		it('does NOT prune the join itself — it keeps a live in-edge via the TAKEN arm', () => {
			expect(prunableStepIds(p(['SUCCEEDED', 'QUEUED', 'QUEUED', 'QUEUED']), guard)).toEqual(['s3']);
		});
	});
});

describe('startStepGate — the authority mirrors the read-model', () => {
	it('linear: an earlier non-terminal-success step blocks, naming it', () => {
		const p = plan([step('s1', 'QUEUED'), step('s2', 'QUEUED')]);
		expect(startStepGate(p, 's2').ok).toBe(false);
		expect(startStepGate(p, 's2').blockerStepId).toBe('s1');
		expect(startStepGate(p, 's1').ok).toBe(true);
	});

	it('graph: an entry step starts; a step with a PENDING in-edge is blocked (names the source)', () => {
		const t = [edge('s1', 's2')];
		const p = plan([step('s1', 'QUEUED'), step('s2', 'QUEUED')], t);
		expect(startStepGate(p, 's1').ok).toBe(true); // entry
		const g = startStepGate(p, 's2');
		expect(g.ok).toBe(false);
		expect(g.blockerStepId).toBe('s1');
	});

	it('graph + read-model agree: a step is startable IFF startStepGate is ok', () => {
		const t = [edge('s1', 's2'), edge('s1', 's3')];
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED')], t);
		const startable = new Set(startableStepIds(p));
		for (const st of p.steps) expect(startStepGate(p, st.id).ok || !startable.has(st.id)).toBe(true);
		expect(startable).toEqual(new Set(['s2', 's3']));
	});
});

describe('BRANCH first-match + prune (DWP-03)', () => {
	// A test guard: a CONDITIONAL edge carries { result: boolean } and the guard reads it.
	const guard: EdgeGuardEvaluator = (e) => (e.conditionExpression as { result?: boolean } | undefined)?.result === true;
	const cond = (result: boolean): Partial<GateTransition> => ({ transitionType: 'CONDITIONAL', conditionExpression: { result } });
	const seq = (source: string, target: string): GateTransition => ({ sourceStepId: source, targetStepId: target, transitionType: 'SEQUENTIAL' });

	it('first-match selects exactly ONE arm (the first true conditional); the default is not-taken', () => {
		const t: GateTransition[] = [{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) }, seq('s1', 's3')];
		const p = plan([step('s1', 'SUCCEEDED', 'BRANCH'), step('s2', 'QUEUED'), step('s3', 'QUEUED')], t);
		expect(startableStepIds(p, guard)).toEqual(['s2']);
		expect(inEdgeDisposition(p, t[1]!, guard)).toBe('NEUTRALIZED'); // the default arm is not-taken
	});

	it('falls to the SEQUENTIAL default when no conditional guard is true', () => {
		const t: GateTransition[] = [{ sourceStepId: 's1', targetStepId: 's2', ...cond(false) }, seq('s1', 's3')];
		const p = plan([step('s1', 'SUCCEEDED', 'BRANCH'), step('s2', 'QUEUED'), step('s3', 'QUEUED')], t);
		expect(startableStepIds(p, guard)).toEqual(['s3']);
	});

	it('two true conditions → the FIRST (array order) wins, deterministically (closes the double-run window)', () => {
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) },
			{ sourceStepId: 's1', targetStepId: 's3', ...cond(true) },
			seq('s1', 's4')
		];
		const p = plan([step('s1', 'SUCCEEDED', 'BRANCH'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED')], t);
		expect(startableStepIds(p, guard)).toEqual(['s2']); // only the first true conditional
	});

	it('prunableStepIds prunes the not-taken arm + its transitive downstream, but NOT a JOIN reachable via the taken arm', () => {
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) }, // taken
			seq('s1', 's3'), // default — not-taken
			seq('s3', 's5'), // downstream of the not-taken arm
			seq('s2', 's4'),
			seq('s3', 's4') // s4 is a JOIN of taken (s2) + not-taken (s3)
		];
		const p = plan(
			[step('s1', 'SUCCEEDED', 'BRANCH'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED'), step('s5', 'QUEUED')],
			t
		);
		const prunable = new Set(prunableStepIds(p, guard));
		expect(prunable.has('s3')).toBe(true); // not-taken arm
		expect(prunable.has('s5')).toBe(true); // transitive downstream of s3
		expect(prunable.has('s4')).toBe(false); // JOIN — still reachable via the taken arm s2
		expect(prunable.has('s2')).toBe(false); // taken arm
	});

	it('a linear plan never prunes (empty transitions)', () => {
		expect(prunableStepIds(plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')]))).toEqual([]);
	});

	// DWP-06: pruneExecutionStep REJECTS a non-ACTIVE plan, so a read-model that still called the arm prunable would
	// offer a Prune the engine refuses — the read-model/authority divergence this single gate home exists to prevent.
	it('yields NO prunable step under a non-ACTIVE plan, mirroring startableStepIds (authority agreement)', () => {
		const t: GateTransition[] = [{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) }, seq('s1', 's3')];
		const steps = [step('s1', 'SUCCEEDED', 'BRANCH'), step('s2', 'QUEUED'), step('s3', 'QUEUED')];
		expect(prunableStepIds(plan(steps, t, 'ACTIVE'), guard)).toEqual(['s3']);
		for (const status of ['SUPERSEDED', 'CANCELLED', 'COMPLETED', 'APPROVED', 'PROPOSED']) {
			expect(prunableStepIds(plan(steps, t, status), guard), status).toEqual([]);
			expect(startableStepIds(plan(steps, t, status), guard), status).toEqual([]);
		}
	});
});

describe('inEdgeDisposition', () => {
	const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'FAILED'), step('s3', 'QUEUED')]);
	it('SATISFIED for a terminal-success source', () => expect(inEdgeDisposition(p, edge('s1', 'x'))).toBe('SATISFIED'));
	it('NEUTRALIZED for a terminal-non-success source', () => expect(inEdgeDisposition(p, edge('s2', 'x'))).toBe('NEUTRALIZED'));
	it('PENDING for a non-terminal source', () => expect(inEdgeDisposition(p, edge('s3', 'x'))).toBe('PENDING'));
	it('SATISFIED for a plan-entry edge (no source)', () => expect(inEdgeDisposition(p, { targetStepId: 'x' })).toBe('SATISFIED'));
});

describe('validateTransitionGraph — every rejection limb (EP-TST-5)', () => {
	const gsteps = (defs: Array<[string, string?]>): GraphValidationStep[] =>
		defs.map(([id, stepType]) => (stepType ? { id, stepType } : { id }));

	it('a NO-OP for a linear plan (empty transitions)', () => {
		expect(validateTransitionGraph(gsteps([['s1'], ['s2']]), []).ok).toBe(true);
	});

	it('accepts a well-formed diamond', () => {
		const r = validateTransitionGraph(
			gsteps([['s1'], ['s2'], ['s3'], ['s4']]),
			[edge('s1', 's2'), edge('s1', 's3'), edge('s2', 's4'), edge('s3', 's4')]
		);
		expect(r.ok, r.message).toBe(true);
	});

	it('REJECTS a dangling source id', () => {
		const r = validateTransitionGraph(gsteps([['s1'], ['s2']]), [edge('sX', 's2'), edge('s1', 's2')]);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('source');
	});

	it('REJECTS a dangling target id', () => {
		const r = validateTransitionGraph(gsteps([['s1'], ['s2']]), [edge('s1', 'sY')]);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('target');
	});

	it('REJECTS a >1-entry graph', () => {
		// s1 and s2 both have no in-edges → two entries.
		const r = validateTransitionGraph(gsteps([['s1'], ['s2'], ['s3']]), [edge('s1', 's3'), edge('s2', 's3')]);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('exactly one entry');
	});

	it('REJECTS an unreachable step (single entry, disconnected cycle downstream)', () => {
		const r = validateTransitionGraph(
			gsteps([['s1'], ['s2'], ['s3'], ['s4']]),
			[edge('s1', 's2'), edge('s3', 's4'), edge('s4', 's3')]
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('unreachable');
	});

	it('REJECTS a cyclic graph', () => {
		const r = validateTransitionGraph(
			gsteps([['s1'], ['s2'], ['s3']]),
			[edge('s1', 's2'), edge('s2', 's3'), edge('s3', 's2')]
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('cycle');
	});

	it('REJECTS a BRANCH step whose last out-edge is not an unconditional default', () => {
		const r = validateTransitionGraph(
			gsteps([['s1', 'BRANCH'], ['s2'], ['s3']]),
			[edge('s1', 's2', { transitionType: 'CONDITIONAL', conditionExpression: {} }), edge('s1', 's3', { transitionType: 'CONDITIONAL', conditionExpression: {} })]
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('default');
	});

	it('accepts a BRANCH with a SEQUENTIAL default as its LAST out-edge', () => {
		const r = validateTransitionGraph(
			gsteps([['s1', 'BRANCH'], ['s2'], ['s3']]),
			[edge('s1', 's2', { transitionType: 'CONDITIONAL', conditionExpression: {} }), edge('s1', 's3', { transitionType: 'SEQUENTIAL' })]
		);
		expect(r.ok, r.message).toBe(true);
	});
});

// ── DWP-07: adversarial-audit remediation. Each of these reproduces a defect the shipped gate had; each FAILED before
// the fix. They exist because the original DWP-03/05 fixtures were all shaped so the defects could not appear —
// a branch whose not-taken arm was a LEAF, and step lists that happened to be topologically ordered.
describe('DWP-07 — defects found by adversarial audit of the landed increment', () => {
	const guard: EdgeGuardEvaluator = (e) =>
		(e.conditionExpression as { result?: boolean } | undefined)?.result === true;
	const cond = (result: boolean): Partial<GateTransition> => ({
		transitionType: 'CONDITIONAL',
		conditionExpression: { result }
	});

	// BLOCKER 1. Pruning is a MULTI-command operation, so the gate must be correct at every intermediate state — not
	// only if the whole fixpoint were applied atomically, which nothing guarantees.
	describe('a prune must not resurrect the rest of its own arm', () => {
		// s1 BRANCH → s2 (guard FALSE, not taken) → s4 ; and → s3 (default, taken). s4 is INTERIOR to the dead arm.
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 's2', ...cond(false) },
			{ sourceStepId: 's1', targetStepId: 's3', transitionType: 'SEQUENTIAL' },
			edge('s2', 's4')
		];
		const p = (s2State: string, s2Pruned = false) =>
			plan(
				[
					step('s1', 'SUCCEEDED', 'BRANCH'),
					{ id: 's2', stepState: s2State, ...(s2Pruned ? { prunedAsUnreachable: true } : {}) },
					step('s3', 'QUEUED'),
					step('s4', 'QUEUED')
				],
				t
			);

		it('offers the whole dead arm for prune before any of it is pruned', () => {
			expect(prunableStepIds(p('QUEUED'), guard).sort()).toEqual(['s2', 's4']);
			expect(startableStepIds(p('QUEUED'), guard)).toEqual(['s3']);
		});

		it('keeps the arm DEAD after the first prune commits — s4 must not become startable', () => {
			const after = p('SKIPPED', true);
			expect(startableStepIds(after, guard), 's4 must NOT be resurrected').toEqual(['s3']);
			expect(startStepGate(after, 's4', guard).ok).toBe(false);
			expect(prunableStepIds(after, guard), 's4 is still prunable so the arm can be cleared').toEqual(['s4']);
		});

		it('still lets a WAIVED skip (not a prune) satisfy its successors — the two must stay distinguishable', () => {
			// Same shape, but s2 reached SKIPPED by an operator waiver: no prunedAsUnreachable mark.
			expect(startableStepIds(p('SKIPPED', false), guard)).toContain('s4');
		});
	});

	// BLOCKER 2. Exclusive selection belongs to a BRANCH node, not to "any node that happens to have a guarded arm".
	it('a PARALLEL_GROUP with one guarded arm keeps its unconditional arms (independent, not a branch)', () => {
		const withTrue = plan(
			[step('s1', 'SUCCEEDED', 'PARALLEL_GROUP'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED')],
			[{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) }, edge('s1', 's3'), edge('s1', 's4')]
		);
		expect(startableStepIds(withTrue, guard).sort()).toEqual(['s2', 's3', 's4']);
		// …and a FALSE guard removes only its own arm, leaving the unconditional ones untouched.
		const withFalse = plan(
			[step('s1', 'SUCCEEDED', 'PARALLEL_GROUP'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED')],
			[{ sourceStepId: 's1', targetStepId: 's2', ...cond(false) }, edge('s1', 's3'), edge('s1', 's4')]
		);
		expect(startableStepIds(withFalse, guard).sort()).toEqual(['s3', 's4']);
	});

	// BLOCKER 3. A FAILED step is RETRYABLE (FAILED→QUEUED). Its downstream awaits a decision; it is not excluded.
	it('does NOT offer the downstream of a FAILED step for prune (a failure is not an exclusion)', () => {
		const t = [edge('s1', 's2'), edge('s2', 's3')];
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'FAILED'), step('s3', 'QUEUED')], t);
		expect(prunableStepIds(p, guard), 'a retryable failure must not launder into SKIPPED').toEqual([]);
		// The barrier still neutralizes the failed edge so a JOIN cannot wedge — the two rules are deliberately different.
		expect(inEdgeDisposition(p, t[1]!, guard)).toBe('NEUTRALIZED');
	});

	// The MINOR that mattered: the fixpoint was only ever exercised by topologically-ordered fixtures, so a single-pass
	// regression survived the whole suite. DWP-01 made the GRAPH the order, so array order proves nothing.
	it('prunes a transitively-dead chain declared in REVERSE topological order (a true fixpoint, not one pass)', () => {
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 'dead1', ...cond(false) },
			{ sourceStepId: 's1', targetStepId: 'taken', transitionType: 'SEQUENTIAL' },
			edge('dead1', 'dead2'),
			edge('dead2', 'dead3')
		];
		// steps[] deliberately lists the dead chain DEEPEST-FIRST.
		const p = plan(
			[
				step('dead3', 'QUEUED'),
				step('dead2', 'QUEUED'),
				step('dead1', 'QUEUED'),
				step('taken', 'QUEUED'),
				step('s1', 'SUCCEEDED', 'BRANCH')
			],
			t
		);
		expect(prunableStepIds(p, guard).sort()).toEqual(['dead1', 'dead2', 'dead3']);
	});

	// The authority half must exclude everything the read-model half excludes — in BOTH directions.
	it('startStepGate refuses an unknown step and an already-terminal step (mirroring startableStepIds)', () => {
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')], [edge('s1', 's2')]);
		expect(startStepGate(p, 'not_a_step').ok).toBe(false);
		expect(startStepGate(p, 's1').ok, 'already SUCCEEDED').toBe(false);
		const frontier = new Set(startableStepIds(p));
		expect(frontier.has('s1')).toBe(false);
		expect(frontier).toEqual(new Set(['s2']));
	});

	// A half-edge was invisible to every validation limb yet won runtime first-match, deadlocking the plan.
	it('REFUSES a transition that declares no target at propose-time', () => {
		const r = validateTransitionGraph(
			[{ id: 's1', stepType: 'BRANCH' }, { id: 's2' }],
			[{ sourceStepId: 's1' }, { sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' }]
		);
		expect(r.ok).toBe(false);
		expect(r.message).toContain('no targetStepId');
	});

	it('REFUSES a conditional out-edge from a non-BRANCH step, and a BRANCH with two unconditional defaults', () => {
		const nonBranch = validateTransitionGraph(
			[{ id: 's1', stepType: 'TRANSFORMATION' }, { id: 's2' }],
			[{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) }]
		);
		expect(nonBranch.ok).toBe(false);
		expect(nonBranch.message).toContain('not BRANCH');

		const twoDefaults = validateTransitionGraph(
			[{ id: 's1', stepType: 'BRANCH' }, { id: 's2' }, { id: 's3' }],
			[
				{ sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' },
				{ sourceStepId: 's1', targetStepId: 's3', transitionType: 'SEQUENTIAL' }
			]
		);
		expect(twoDefaults.ok).toBe(false);
		expect(twoDefaults.message).toContain('exactly one is permitted');
	});
});
