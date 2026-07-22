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
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED')], t);
		expect(startableStepIds(p, guard)).toEqual(['s2']);
		expect(inEdgeDisposition(p, t[1]!, guard)).toBe('NEUTRALIZED'); // the default arm is not-taken
	});

	it('falls to the SEQUENTIAL default when no conditional guard is true', () => {
		const t: GateTransition[] = [{ sourceStepId: 's1', targetStepId: 's2', ...cond(false) }, seq('s1', 's3')];
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED')], t);
		expect(startableStepIds(p, guard)).toEqual(['s3']);
	});

	it('two true conditions → the FIRST (array order) wins, deterministically (closes the double-run window)', () => {
		const t: GateTransition[] = [
			{ sourceStepId: 's1', targetStepId: 's2', ...cond(true) },
			{ sourceStepId: 's1', targetStepId: 's3', ...cond(true) },
			seq('s1', 's4')
		];
		const p = plan([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED')], t);
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
			[step('s1', 'SUCCEEDED'), step('s2', 'QUEUED'), step('s3', 'QUEUED'), step('s4', 'QUEUED'), step('s5', 'QUEUED')],
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
