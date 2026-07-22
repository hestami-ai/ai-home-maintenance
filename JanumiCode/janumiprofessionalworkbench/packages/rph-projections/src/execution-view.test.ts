import { describe, expect, it } from 'vitest';
import {
	advanceCommandsFor,
	conditionEvaluatorFor,
	controlCommandsFor,
	executionPlanView,
	isBelowQueued,
	isTerminalSuccessStep,
	describeCondition,
	plansForPwus,
	prunableStepIds,
	sequenceView,
	startableStepId,
	startableStepIds,
	stepStateTone,
	transitionRows,
	type ExecutionPlanInput,
	type ExecutionStepInput,
	type SequenceInstance,
	type StepState
} from './execution-view.js';
import type { PwaGraphExport, PwaGraphNode } from './pwa-graph.js';

// JAN-EXECPLAN-DR-001 DWP-01. The pure Execution Plan read-model: shape EXECUTION_PLAN aggregates into a per-PWU
// view, scope plans to an Undertaking's PWUs (the F-6 global-list-bug regression), and derive step affordances
// ONLY from the four command-backed transitions (F-11 — never the wider machine topology).

const ALL_STEP_STATES: readonly StepState[] = [
	'NOT_READY',
	'READY',
	'QUEUED',
	'RUNNING',
	'WAITING',
	'SUCCEEDED',
	'FAILED',
	'SKIPPED',
	'CANCELLED',
	'SUPERSEDED'
];

const step = (id: string, stepState: string, extra: Partial<ExecutionStepInput> = {}): ExecutionStepInput => ({
	id,
	stepType: 'TRANSFORMATION',
	purpose: `purpose ${id}`,
	stepState,
	...extra
});

const plan = (id: string, workUnitId: string, steps: ExecutionStepInput[], extra: Partial<ExecutionPlanInput> = {}): ExecutionPlanInput => ({
	id,
	workUnitId,
	status: 'ACTIVE',
	steps,
	...extra
});

describe('executionPlanView — shaping one aggregate row', () => {
	it('maps plan fields and preserves step order as authored (flat list, fork B)', () => {
		const v = executionPlanView(
			plan('plan_1', 'pwu_a', [step('s1', 'SUCCEEDED'), step('s2', 'RUNNING'), step('s3', 'QUEUED')], {
				planVersion: 2
			})
		);
		expect(v.id).toBe('plan_1');
		expect(v.workUnitId).toBe('pwu_a');
		expect(v.status).toBe('ACTIVE');
		expect(v.planVersion).toBe(2);
		expect(v.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3']); // order preserved, not sorted
	});

	it('omits planVersion when absent (does not fabricate a version)', () => {
		const v = executionPlanView(plan('plan_1', 'pwu_a', [step('s1', 'QUEUED')]));
		expect('planVersion' in v).toBe(false);
	});

	it('carries runtimeBindingId only when present', () => {
		const v = executionPlanView(
			plan('plan_1', 'pwu_a', [step('s1', 'RUNNING', { runtimeBindingId: 'rb_1' }), step('s2', 'QUEUED')])
		);
		expect(v.steps[0]?.runtimeBindingId).toBe('rb_1');
		expect(v.steps[1]?.runtimeBindingId).toBeUndefined();
	});
});

describe('advanceCommandsFor — the F-11 command-backed allowlist (never the machine topology)', () => {
	it('maps ONLY the four command-backed transitions', () => {
		expect(advanceCommandsFor('QUEUED')).toEqual(['start']);
		expect(advanceCommandsFor('RUNNING')).toEqual(['complete', 'fail']); // RUNNING affords BOTH
		expect(advanceCommandsFor('FAILED')).toEqual(['retry']);
	});

	it('yields NO affordance for every commandless / terminal stepState (F-11 — no fabricated buttons)', () => {
		for (const s of ['NOT_READY', 'READY', 'WAITING', 'SUCCEEDED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED']) {
			expect(advanceCommandsFor(s)).toEqual([]);
		}
	});

	it('yields NO affordance for an unknown / off-contract state (never fabricate)', () => {
		expect(advanceCommandsFor('NONSENSE')).toEqual([]);
	});

	it('is defined for every one of the 10 StepState values (state-transition totality, EP-TST-5)', () => {
		for (const s of ALL_STEP_STATES) expect(Array.isArray(advanceCommandsFor(s))).toBe(true);
		expect(ALL_STEP_STATES).toHaveLength(10);
	});
});

describe('controlCommandsFor — the skip/cancel/wait/resolve allowlist (DWP-02/03 + DWP-04; machine-legal set, EP-TST-5)', () => {
	it('offers skip+cancel from READY/QUEUED (both →SKIPPED and →CANCELLED are legal there)', () => {
		expect(controlCommandsFor('READY')).toEqual(['skip', 'cancel']);
		expect(controlCommandsFor('QUEUED')).toEqual(['skip', 'cancel']);
	});

	it('offers cancel+wait from RUNNING (a running step cancels or suspends, but does not skip — machine)', () => {
		expect(controlCommandsFor('RUNNING')).toEqual(['cancel', 'wait']);
	});

	it('offers cancel+resolve from WAITING — resume is the only non-terminating exit (DWP-04)', () => {
		expect(controlCommandsFor('WAITING')).toEqual(['cancel', 'resolve']);
	});

	it('never offers resolve outside WAITING, nor wait outside RUNNING (the arrows exist nowhere else)', () => {
		for (const s of ALL_STEP_STATES) {
			if (s !== 'WAITING') expect(controlCommandsFor(s)).not.toContain('resolve');
			if (s !== 'RUNNING') expect(controlCommandsFor(s)).not.toContain('wait');
		}
	});

	it('offers NO control action from NOT_READY (machine has no →CANCELLED/→SKIPPED from there) or any terminal state', () => {
		for (const s of ['NOT_READY', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED'])
			expect(controlCommandsFor(s)).toEqual([]);
	});

	it('yields NO control action for an unknown / off-contract state (never fabricate)', () => {
		expect(controlCommandsFor('NONSENSE')).toEqual([]);
	});

	it('is defined for every one of the 10 StepState values (state-transition totality, EP-TST-5)', () => {
		for (const s of ALL_STEP_STATES) expect(Array.isArray(controlCommandsFor(s))).toBe(true);
	});

	it('is surfaced on the step view', () => {
		const v = executionPlanView(plan('plan_1', 'pwu_a', [step('s1', 'QUEUED'), step('s2', 'RUNNING')]));
		expect(v.steps[0]?.controlCommands).toEqual(['skip', 'cancel']); // QUEUED
		expect(v.steps[1]?.controlCommands).toEqual(['cancel', 'wait']); // RUNNING
	});
});

describe('stepStateTone — every stepState maps to a defined tone (EP-TST-5 / DWP-02 colour totality)', () => {
	it('classifies the load-bearing states', () => {
		expect(stepStateTone('SUCCEEDED')).toBe('positive');
		expect(stepStateTone('RUNNING')).toBe('active');
		expect(stepStateTone('FAILED')).toBe('negative');
		expect(stepStateTone('QUEUED')).toBe('pending');
	});

	it('defines a tone for all 10 values and defaults unknowns to muted (no undefined)', () => {
		const tones = new Set<string>();
		for (const s of ALL_STEP_STATES) {
			const t = stepStateTone(s);
			expect(t).toBeTruthy();
			tones.add(t);
		}
		expect(stepStateTone('NONSENSE')).toBe('muted');
	});
});

describe('isBelowQueued — the honest F-11 signal', () => {
	it('is true ONLY for the undriveable initial states (NOT_READY/READY), not terminal states', () => {
		expect(isBelowQueued('NOT_READY')).toBe(true);
		expect(isBelowQueued('READY')).toBe(true);
		expect(isBelowQueued('QUEUED')).toBe(false);
		expect(isBelowQueued('SUCCEEDED')).toBe(false); // terminal, legitimately done — NOT "stuck below queued"
		expect(isBelowQueued('SKIPPED')).toBe(false);
	});

	it('is surfaced on the step view', () => {
		const v = executionPlanView(plan('plan_1', 'pwu_a', [step('s1', 'NOT_READY'), step('s2', 'RUNNING')]));
		expect(v.steps[0]?.belowQueued).toBe(true);
		expect(v.steps[0]?.advanceCommands).toEqual([]); // no button; the panel shows the honest note instead
		expect(v.steps[1]?.belowQueued).toBe(false);
	});
});

describe('plansForPwus — undertaking scoping (the F-6 global-list-bug regression)', () => {
	// The two-hop scope: PWU.undertakingId == the route Undertaking → the PWU id → this set → plan.workUnitId ∈ set.
	const rows: ExecutionPlanInput[] = [
		plan('plan_in', 'pwu_in_scope', [step('s1', 'QUEUED')]),
		plan('plan_other', 'pwu_other_undertaking', [step('s1', 'QUEUED')]),
		plan('plan_orphan', 'pwu_no_undertaking', [step('s1', 'QUEUED')])
	];

	it('includes a plan whose PWU is in the Undertaking; excludes one whose PWU is in a different Undertaking', () => {
		// pwuIds = the ids listPwus(engine, undertakingId) returns — only in-scope PWUs. 'pwu_other_undertaking' is
		// NOT among them (it belongs to another Undertaking), so its plan must not leak in.
		const scoped = plansForPwus(rows, new Set(['pwu_in_scope']));
		expect(scoped.map((p) => p.id)).toEqual(['plan_in']);
	});

	it('excludes a plan whose PWU lacks an undertakingId (never appears in the scoped PWU set) — asserted, not a silent drop of an in-scope plan', () => {
		// A PWU with no undertakingId is never returned by listPwus(engine, undertakingId), so its id is absent from
		// the set; its plan is excluded. This asserts the exclusion is by MEMBERSHIP, not accidental.
		const scoped = plansForPwus(rows, new Set(['pwu_in_scope']));
		expect(scoped.some((p) => p.id === 'plan_orphan')).toBe(false);
	});

	it('never returns the global list (empty scope → no plans)', () => {
		expect(plansForPwus(rows, new Set())).toEqual([]);
	});

	it('accepts any iterable of pwu ids (array or Set)', () => {
		expect(plansForPwus(rows, ['pwu_in_scope']).map((p) => p.id)).toEqual(['plan_in']);
	});

	it('shapes each included plan (a no-plan PWU simply yields nothing)', () => {
		const scoped = plansForPwus(rows, new Set(['pwu_in_scope', 'pwu_with_no_plan']));
		expect(scoped).toHaveLength(1);
		expect(scoped[0]?.steps[0]?.advanceCommands).toEqual(['start']); // QUEUED → start
	});
});

// DWP-01 (DR-003) — the Tier-3C linear start-gate read-model. `startableStepId` names the single step a plan may
// currently start (the frontier); the identical predecessor rule is enforced authoritatively at startExecutionStep.
describe('startableStepId — the linear start-gate frontier (Tier 3C-i, fork B→start-gate / F)', () => {
	const ex = (states: string[], status = 'ACTIVE') =>
		executionPlanView(plan('plan_seq', 'pwu_a', states.map((s, i) => step(`s${i + 1}`, s)), { status }));

	it('is the FIRST step when nothing has run yet (a fresh multi-step plan)', () => {
		expect(startableStepId(ex(['QUEUED', 'QUEUED']))).toBe('s1');
	});

	it('advances to the next step once the earlier one is SUCCEEDED', () => {
		expect(startableStepId(ex(['SUCCEEDED', 'QUEUED']))).toBe('s2');
	});

	it('treats a SKIPPED predecessor as terminal-success (skipping advances the frontier — no deadlock, L3-M6)', () => {
		expect(startableStepId(ex(['SKIPPED', 'QUEUED']))).toBe('s2');
	});

	it('is undefined when every step is terminal-success (the plan is completable, nothing to start)', () => {
		expect(startableStepId(ex(['SUCCEEDED', 'SKIPPED']))).toBeUndefined();
	});

	it('is undefined when the plan is NOT ACTIVE (no start under a non-ACTIVE plan — RPH-EXE-002)', () => {
		expect(startableStepId(ex(['QUEUED', 'QUEUED'], 'SUPERSEDED'))).toBeUndefined();
		expect(startableStepId(ex(['QUEUED'], 'APPROVED'))).toBeUndefined();
	});

	it('is undefined when a terminal-NON-success predecessor blocks the sequence (FAILED before a QUEUED step)', () => {
		// A FAILED step is terminal but NOT success — nothing after it may start until it is retried/addressed.
		expect(startableStepId(ex(['FAILED', 'QUEUED']))).toBeUndefined();
		expect(startableStepId(ex(['SUCCEEDED', 'CANCELLED', 'QUEUED']))).toBeUndefined();
	});

	it('returns the RUNNING frontier itself (not the QUEUED step behind it) — the UI shows Complete/Fail there, not Start', () => {
		// The frontier is the first non-terminal-success step; a RUNNING one is the current step. The Start button is
		// gated on id===startable AND advanceCommands (QUEUED only), so a RUNNING frontier never offers Start, and the
		// QUEUED step behind it is not the frontier → also no Start. Exactly one step is ever "current".
		expect(startableStepId(ex(['SUCCEEDED', 'RUNNING', 'QUEUED']))).toBe('s2');
	});

	it('is the sole step for a single-step plan (back-compat — the reference/demo drive is unchanged)', () => {
		expect(startableStepId(ex(['QUEUED']))).toBe('s1');
	});

	it('classifies terminal-success (SUCCEEDED/SKIPPED) exactly — FAILED/CANCELLED/SUPERSEDED are not success', () => {
		expect(isTerminalSuccessStep('SUCCEEDED')).toBe(true);
		expect(isTerminalSuccessStep('SKIPPED')).toBe(true);
		for (const s of ['FAILED', 'CANCELLED', 'SUPERSEDED', 'QUEUED', 'RUNNING', 'NOT_READY', 'READY', 'WAITING'])
			expect(isTerminalSuccessStep(s)).toBe(false);
	});
});

// DWP-04 — the Tier-2 sequence + the single-axis layerHandoff advisory (fork C, advisory-only).
const gnode = (id: string, name: string): PwaGraphNode => ({
	id,
	name,
	pwuKind: 'K',
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: []
});
/** A minimal version-scoped type graph: named type nodes + hand-off edges [producer, consumer, artifact]. */
const mkGraph = (nodes: Array<[string, string]>, flows: Array<[string, string, string]>): PwaGraphExport => ({
	pwa: { id: 'p', name: 'p', domain: 'd', version: '1', publicationStatus: 'DRAFT' },
	nodes: nodes.map(([id, name]) => gnode(id, name)),
	permits: [],
	dataFlow: flows.map(([producer, consumer, artifact]) => ({ producer, consumer, artifact })),
	artifacts: [],
	roots: []
});
const inst = (id: string, executionState: string, pwuTypeId?: string): SequenceInstance => ({
	id,
	title: `T ${id}`,
	executionState,
	...(pwuTypeId ? { pwuTypeId } : {})
});
// Producer type P (produces 'a') → Consumer type C (consumes 'a').
const PC = mkGraph(
	[
		['P', 'Producer'],
		['C', 'Consumer']
	],
	[['P', 'C', 'a']]
);

describe('sequenceView — placement by the type’s dependency layer', () => {
	it('places instances at their TYPE’s Kahn layer (P before C)', () => {
		const v = sequenceView(PC, [inst('i_p', 'NOT_PLANNED', 'P'), inst('i_c', 'NOT_PLANNED', 'C')]);
		expect(v.layers.map((l) => l.index)).toEqual([0, 1]);
		expect(v.layers[0]?.instances.map((x) => x.id)).toEqual(['i_p']);
		expect(v.layers[1]?.instances.map((x) => x.id)).toEqual(['i_c']);
		expect(v.unplaced).toEqual([]);
	});

	it('shows an instance with NO pwuTypeId, not placed (reason no-type)', () => {
		const v = sequenceView(PC, [inst('i_x', 'NOT_PLANNED')]);
		expect(v.layers).toEqual([]);
		expect(v.unplaced).toEqual([expect.objectContaining({ id: 'i_x', reason: 'no-type' })]);
	});

	it('shows an OFF-GRAPH instance (type absent from the bound-version graph), not placed — the version-skew safety net', () => {
		// A type filtered out of the (pwaId, pwaVersion)-scoped graph (e.g. a stale/other-version type) looks exactly
		// like an off-graph type here: shown, never dropped, never mis-placed among the bound-version nodes (L3-C2).
		const v = sequenceView(PC, [inst('i_old', 'RUNNING', 'OTHER_VERSION_TYPE')]);
		expect(v.unplaced).toEqual([expect.objectContaining({ id: 'i_old', reason: 'off-graph' })]);
	});

	it('shows a cycle/unordered-type instance with no definite dependency position, not placed', () => {
		const cyclic = mkGraph(
			[
				['A', 'A'],
				['B', 'B']
			],
			[
				['A', 'B', 'x'],
				['B', 'A', 'y']
			]
		);
		const v = sequenceView(cyclic, [inst('i_a', 'NOT_PLANNED', 'A')]);
		expect(v.unplaced).toEqual([
			expect.objectContaining({ id: 'i_a', reason: 'no-dependency-position' })
		]);
	});
});

describe('sequenceView — the single-axis hand-off advisory (executionState ONLY)', () => {
	it('FIRES when a consumer has begun and no producer instance has SUCCEEDED', () => {
		const v = sequenceView(PC, [inst('i_p', 'NOT_PLANNED', 'P'), inst('i_c', 'RUNNING', 'C')]);
		expect(v.advisories).toHaveLength(1);
		expect(v.advisories[0]).toEqual(
			expect.objectContaining({ consumerInstanceId: 'i_c', producerTypeId: 'P', artifact: 'a' })
		);
	});

	it('is SILENT when the consumer has NOT begun (NOT_PLANNED/PLANNED are not begun)', () => {
		expect(sequenceView(PC, [inst('i_p', 'NOT_PLANNED', 'P'), inst('i_c', 'PLANNED', 'C')]).advisories).toEqual([]);
	});

	it('is SILENT when a producer instance has SUCCEEDED', () => {
		expect(sequenceView(PC, [inst('i_p', 'SUCCEEDED', 'P'), inst('i_c', 'RUNNING', 'C')]).advisories).toEqual([]);
	});

	it('reads executionState ONLY — a value from the OTHER axis (workLifecycleState EXECUTING) never fires it', () => {
		// EXECUTING is a workLifecycleState value, NOT an executionState value (canonical-vocabulary.json). If it were
		// (mistakenly) placed in the executionState slot, the predicate must NOT treat it as begun — proving the check
		// is single-axis (the JAN-EXECPLAN §19 L3-C1 defect was mixing the two axes).
		expect(sequenceView(PC, [inst('i_p', 'NOT_PLANNED', 'P'), inst('i_c', 'EXECUTING', 'C')]).advisories).toEqual([]);
	});
});

describe('sequenceView — M+ cardinality (type-level hand-off)', () => {
	it('is SILENT if ANY producer-type instance has SUCCEEDED (a succeeded producer satisfies the hand-off)', () => {
		const v = sequenceView(PC, [
			inst('i_p1', 'FAILED', 'P'),
			inst('i_p2', 'SUCCEEDED', 'P'), // one of the two producers succeeded → satisfied
			inst('i_c', 'RUNNING', 'C')
		]);
		expect(v.advisories).toEqual([]);
	});

	it('FIRES per consumer instance when NO producer-type instance has SUCCEEDED', () => {
		const v = sequenceView(PC, [
			inst('i_p1', 'FAILED', 'P'),
			inst('i_p2', 'RUNNING', 'P'), // neither producer SUCCEEDED
			inst('i_c1', 'RUNNING', 'C'),
			inst('i_c2', 'QUEUED', 'C')
		]);
		expect(v.advisories.map((a) => a.consumerInstanceId).sort()).toEqual(['i_c1', 'i_c2']);
	});
});

// DR-004 DWP-05 (Tier 3C-ii) — the read-model's frontier surface. These wrappers had NO direct coverage: the set
// frontier and prune set are thin delegations to the single rph-domain gate (deliberately — one home, DR-004 §19-M2),
// but `conditionEvaluatorFor` is NOT thin. It folds the plan's condition subject from the event log and is the exact
// seam where the UI's BRANCH first-match could drift from the engine authority's, which is the divergence the whole
// single-gate design exists to prevent. Tested here at the seam, not only end-to-end through the browser.
describe('startableStepIds / prunableStepIds — the graph frontier surfaced to the UI (DWP-05)', () => {
	const gplan = (steps: ExecutionStepInput[], transitions: ExecutionPlanInput['transitions']) =>
		executionPlanView(plan('plan_g', 'pwu_a', steps, { transitions }));
	const e = (sourceStepId: string, targetStepId: string) => ({
		sourceStepId,
		targetStepId,
		transitionType: 'SEQUENTIAL'
	});

	it('surfaces the SET of startable steps for a PARALLEL fan-out (not a scalar)', () => {
		const v = gplan(
			[step('s1', 'SUCCEEDED', { stepType: 'PARALLEL_GROUP' }), step('s2', 'QUEUED'), step('s3', 'QUEUED')],
			[e('s1', 's2'), e('s1', 's3')]
		);
		expect(startableStepIds(v).sort()).toEqual(['s2', 's3']);
		// The Tier-3C scalar back-compat accessor takes the first — it is NOT the graph API the UI consumes.
		expect(startableStepId(v)).toBe('s2');
	});

	it('holds the JOIN until every arm is terminal-success', () => {
		const t = [e('s1', 's2'), e('s1', 's3'), e('s2', 's4'), e('s3', 's4')];
		const states = (a: string, b: string) =>
			gplan(
				[step('s1', 'SUCCEEDED'), step('s2', a), step('s3', b), step('s4', 'QUEUED')],
				t
			);
		expect(startableStepIds(states('SUCCEEDED', 'RUNNING'))).not.toContain('s4');
		expect(startableStepIds(states('SUCCEEDED', 'SUCCEEDED'))).toEqual(['s4']);
	});

	it('an empty transitions[] keeps the shipped linear scalar frontier (the D1 degenerate)', () => {
		const v = executionPlanView(plan('plan_l', 'pwu_a', [step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')]));
		expect(startableStepIds(v)).toEqual(['s2']);
		expect(prunableStepIds(v)).toEqual([]); // a linear plan never prunes
	});

	it('conditionEvaluatorFor folds the event log so the UI first-match MATCHES the engine authority', () => {
		// s1 BRANCH → s2 (CONDITIONAL: s1 succeeded) | s3 (SEQUENTIAL default). With s1 SUCCEEDED the guard holds, so
		// s2 is the selected arm and s3 becomes prunable — the same verdict startExecutionStep's precheck reaches.
		const v = gplan(
			[step('s1', 'SUCCEEDED', { stepType: 'BRANCH' }), step('s2', 'QUEUED'), step('s3', 'QUEUED')],
			[
				{
					sourceStepId: 's1',
					targetStepId: 's2',
					transitionType: 'CONDITIONAL',
					conditionExpression: { op: 'STEP_SUCCEEDED', stepId: 's1' }
				},
				e('s1', 's3')
			]
		);
		const evalGuard = conditionEvaluatorFor(v, []);
		expect(startableStepIds(v, evalGuard)).toEqual(['s2']);
		expect(prunableStepIds(v, evalGuard)).toEqual(['s3']);
		// WITHOUT the evaluator a conditional edge is never satisfied — so the default arm wins instead. This is why
		// the server must pass the evaluator: omitting it silently changes which arm the UI offers.
		expect(startableStepIds(v)).toEqual(['s3']);
	});

	it('a malformed conditionExpression evaluates FALSE rather than throwing (the UI must not crash)', () => {
		const v = gplan(
			[step('s1', 'SUCCEEDED', { stepType: 'BRANCH' }), step('s2', 'QUEUED'), step('s3', 'QUEUED')],
			[
				{ sourceStepId: 's1', targetStepId: 's2', transitionType: 'CONDITIONAL', conditionExpression: { op: 'NONSENSE' } },
				e('s1', 's3')
			]
		);
		expect(startableStepIds(v, conditionEvaluatorFor(v, []))).toEqual(['s3']); // falls to the default
	});
});

// DR-004 DWP-06 (Tier 3C-ii) — the transitions view. A READ-ONLY rendering of the immutable graph (DS-004 F-4): it
// reports what the interpreter decided and drives nothing (F-11 — buttons come from the affordance allowlists only).
describe('describeCondition — a human summary of the guard, total over the grammar (DWP-06)', () => {
	const S = 'step_01ARZ3NDEKTSV4RRFFQ69G5K00';

	it('renders each leaf op with its operands', () => {
		expect(describeCondition({ op: 'STEP_SUCCEEDED', stepId: S })).toMatch(/^step step_01ARZ3N… succeeded$/);
		expect(describeCondition({ op: 'STEP_STATE', stepId: S, state: 'FAILED' })).toContain('is FAILED');
		expect(describeCondition({ op: 'OUTPUT_COUNT', stepId: S, cmp: '>=', value: 2 })).toContain('outputs >= 2');
		expect(describeCondition({ op: 'ATTEMPTS', stepId: S, cmp: '>', value: 1 })).toContain('attempts > 1');
		expect(describeCondition({ op: 'RESULT_EQUALS', stepId: S, path: 'a.b', value: true })).toContain('result.a.b = true');
	});

	it('renders the nested combinators', () => {
		const leaf = { op: 'STEP_SUCCEEDED', stepId: S };
		expect(describeCondition({ op: 'NOT', operand: leaf })).toMatch(/^not \(/);
		expect(describeCondition({ op: 'ALL', operands: [leaf, leaf] })).toMatch(/^all of \(.*;.*\)$/);
		expect(describeCondition({ op: 'ANY', operands: [leaf] })).toMatch(/^any of \(/);
	});

	it('renders an UNPARSEABLE expression as an explicit marker — never as understood, never [object Object]', () => {
		for (const bad of [{ op: 'NONSENSE' }, {}, null, undefined, 'true', 42, { op: 'ALL' }]) {
			const text = describeCondition(bad);
			expect(text).toBe('unparseable condition');
			expect(text).not.toContain('[object');
		}
	});

	it('truncates ULIDs rather than dumping 30 characters of entropy', () => {
		expect(describeCondition({ op: 'STEP_SUCCEEDED', stepId: S })).toContain('…');
		expect(describeCondition({ op: 'STEP_SUCCEEDED', stepId: 's1' })).toContain('s1');
	});
});

describe('transitionRows — the edge plane of the execution view (DWP-06)', () => {
	const seq = (sourceStepId: string, targetStepId: string, id?: string) => ({
		...(id ? { id } : {}),
		sourceStepId,
		targetStepId,
		transitionType: 'SEQUENTIAL'
	});
	const gview = (steps: ExecutionStepInput[], transitions: ExecutionPlanInput['transitions']) =>
		executionPlanView(plan('plan_g', 'pwu_a', steps, { transitions }));

	it('renders one row per edge with resolved step labels, role and disposition', () => {
		const v = gview(
			[step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')],
			[seq('s1', 's2', 'edge_1')]
		);
		const rows = transitionRows(v);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			key: 'edge_1',
			sourceStepId: 's1',
			targetStepId: 's2',
			sourceLabel: 'purpose s1',
			targetLabel: 'purpose s2',
			role: 'SEQUENTIAL',
			disposition: 'SATISFIED'
		});
		expect(rows[0]?.conditionText).toBeUndefined(); // unconditional edge → no guard text
	});

	it('is empty for a linear plan — the D1 degenerate renders no graph at all', () => {
		expect(transitionRows(executionPlanView(plan('p', 'pwu_a', [step('s1', 'QUEUED')])))).toEqual([]);
	});

	it('reports PENDING while the source is unfinished', () => {
		const v = gview([step('s1', 'RUNNING'), step('s2', 'QUEUED')], [seq('s1', 's2')]);
		expect(transitionRows(v)[0]?.disposition).toBe('PENDING');
	});

	// THE IDENTITY TRAP: rph-domain's BRANCH first-match decides "is this the selected arm?" by OBJECT IDENTITY against
	// the elements of plan.transitions. If transitionRows ever cloned an edge before asking, every CONDITIONAL edge
	// would silently read NEUTRALIZED — no type error, no failure outside a branch fixture. This is that fixture.
	it('reports the SELECTED branch arm as SATISFIED and the not-taken arm as NEUTRALIZED (by-reference guard)', () => {
		const v = gview(
			[step('s1', 'SUCCEEDED', { stepType: 'BRANCH' }), step('s2', 'QUEUED'), step('s3', 'QUEUED')],
			[
				{
					id: 'edge_cond',
					sourceStepId: 's1',
					targetStepId: 's2',
					transitionType: 'CONDITIONAL',
					conditionExpression: { op: 'STEP_SUCCEEDED', stepId: 's1' }
				},
				seq('s1', 's3', 'edge_default')
			]
		);
		const rows = transitionRows(v, conditionEvaluatorFor(v, []));
		expect(rows.find((r) => r.key === 'edge_cond')).toMatchObject({
			role: 'CONDITIONAL',
			conditionText: 'step s1 succeeded',
			disposition: 'SATISFIED'
		});
		expect(rows.find((r) => r.key === 'edge_default')?.disposition).toBe('NEUTRALIZED');
		// And the rows agree with the frontier the SAME evaluator produces — one interpreter, two renderings.
		expect(startableStepIds(v, conditionEvaluatorFor(v, []))).toEqual(['s2']);
	});

	it('labels a plan-entry edge honestly instead of rendering an empty source', () => {
		const v = gview([step('s1', 'QUEUED')], [{ targetStepId: 's1', transitionType: 'SEQUENTIAL' }]);
		const rows = transitionRows(v);
		expect(rows[0]?.sourceLabel).toBe('(plan entry)');
		expect(rows[0]?.sourceStepId).toBeUndefined();
		expect(rows[0]?.disposition).toBe('SATISFIED');
	});

	it('names an unresolvable step id rather than rendering a blank row', () => {
		const v = gview([step('s1', 'SUCCEEDED')], [seq('s1', 'ghost')]);
		expect(transitionRows(v)[0]?.targetLabel).toContain('unknown step');
	});

	it('synthesizes a stable key when the edge carries no id (a keyed each-block cannot key on undefined)', () => {
		const v = gview([step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')], [seq('s1', 's2'), seq('s1', 's2')]);
		const keys = transitionRows(v).map((r) => r.key);
		expect(new Set(keys).size).toBe(2);
		for (const k of keys) expect(typeof k).toBe('string');
	});

	it('infers the role from the presence of a guard when transitionType is absent', () => {
		const v = gview(
			[step('s1', 'SUCCEEDED'), step('s2', 'QUEUED')],
			[{ sourceStepId: 's1', targetStepId: 's2', conditionExpression: { op: 'STEP_SUCCEEDED', stepId: 's1' } }]
		);
		expect(transitionRows(v)[0]?.role).toBe('CONDITIONAL');
	});
});
