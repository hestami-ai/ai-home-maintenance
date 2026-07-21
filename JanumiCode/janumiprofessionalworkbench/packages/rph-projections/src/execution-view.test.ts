import { describe, expect, it } from 'vitest';
import {
	advanceCommandsFor,
	executionPlanView,
	isBelowQueued,
	plansForPwus,
	sequenceView,
	stepStateTone,
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
