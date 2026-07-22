// The Execution Plan read-model (JAN-EXECPLAN-DR-001 DWP-01 / DS-001 §5 Tier 1, fork A).
//
// Intent: shape the existing EXECUTION_PLAN aggregate rows into a per-PWU ExecutionPlanView the Undertaking
// Workbench's execution tab renders, and scope those plans to one Undertaking's PWUs (fixing the F-6 global-list
// bug). The aggregate already embeds current step state, so a pure SHAPING is sufficient for Tier 1 — no event-fold
// (a live-progress event-folding projector + attempt history is Tier 3, deferred; DS §7-A divergence).
//
// Boundary (EP-CMT-4 — this crosses WORKFLOW-ENGINE SEMANTICS): the per-step `advanceCommands` set encodes which
// step transitions the domain can actually drive. It is derived ONLY from the FOUR command-backed step transitions
// in the handler registry (StartExecutionStep: QUEUED→RUNNING; CompleteExecutionStep: RUNNING→SUCCEEDED;
// FailExecutionStep: RUNNING→FAILED; RetryExecutionStep: FAILED→QUEUED). The wider StepState machine has ~18 legal
// arrows; the ones that have since GAINED a command handler live in the separate `controlCommands` allowlist below
// (skip/cancel — DR-003 DWP-02/03; wait/resolve — DR-004 DWP-04), and the rest (NOT_READY→READY, →SUPERSEDED …) still
// have NO handler and therefore NO affordance.
//
// Do not change: advanceCommands MUST come from this allowlist, NOT from the machine's legal-transition topology.
//   Deriving affordances from the topology would mint buttons (Supersede-step, NOT_READY→READY …) that dispatch
//   nonexistent commands (JAN-EXECPLAN-DR-001 F-11 / §19 L3-C3). A step below QUEUED (NOT_READY/READY — the domain's
//   own initial state) has NO advance command at all; `belowQueued` surfaces that honestly rather than as an inert
//   row (F-11), parallel to the plan-level no-completion-handler gap (F-9).
//
// Pure + browser-safe (type-only contract imports), like the rest of rph-projections.
import type { StepState } from '@janumipwb/rph-contracts';
import {
	buildConditionSubject,
	ConditionExpressionSchema,
	evaluateCondition,
	inEdgeDisposition,
	isTerminalSuccessStepState,
	prunableStepIds as gatePrunableStepIds,
	startableStepIds as gateStartableStepIds,
	type ConditionExpression,
	type ConditionSubjectEvent,
	type EdgeGuardEvaluator,
	type InEdgeDisposition
} from '@janumipwb/rph-domain';
import { layerHandoff, type HandoffOrder } from './handoff-order.js';
import type { PwaGraphExport } from './pwa-graph.js';

/** The command-backed step transitions — the ONLY affordances the domain can drive (registry handlers). */
export type StepAdvanceCommand = 'start' | 'complete' | 'fail' | 'retry';

/** The command-backed CONTROL actions (off-happy-path, JAN-EXECPLAN-DR-003 DWP-02/03 + DR-004 DWP-04): skip
 *  (READY/QUEUED→SKIPPED), cancel (READY/QUEUED/RUNNING/WAITING→CANCELLED), wait (RUNNING→WAITING) and resolve
 *  (WAITING→RUNNING). Distinct from advanceCommands (forward progress toward a terminal state) — a control action
 *  WAIVES, ABORTS or SUSPENDS a step rather than progressing it. Kept as its own allowlist so the UI never invents a
 *  button from the machine topology (the F-11 discipline); every member here has a registry handler (DWP-04 added the
 *  last two, which is what made WAITING reachable and its resume replayable at all). */
export type StepControlCommand = 'skip' | 'cancel' | 'wait' | 'resolve';

/** A semantic tone for a stepState — the UI maps tone → colour. Kept here (not in the component) so the
 *  every-stepState-has-a-defined-tone totality is unit-tested in the pure layer (EP-TST-5 state-transition). */
export type StepTone = 'positive' | 'active' | 'negative' | 'pending' | 'muted';

/** Pure input: the subset of an ExecutionStep (ExecutionPlan.steps[]) the view needs. The server maps engine
 *  `.state` bags into this (mirroring buildPwaExport), keeping this module engine-free. */
export interface ExecutionStepInput {
	readonly id: string;
	readonly stepType: string;
	readonly purpose: string;
	readonly stepState: string;
	readonly runtimeBindingId?: string;
}

/** Pure input: an ExecutionPlan transition (edge) the flow gate reads (DR-004 DWP-01). `conditionExpression` is opaque
 *  here — DWP-02's evaluator interprets it. Absent ⇒ the plan is linear (the array-index degenerate). */
export interface ExecutionTransitionInput {
	readonly id?: string;
	readonly sourceStepId?: string;
	readonly targetStepId?: string;
	readonly transitionType?: string;
	readonly conditionExpression?: unknown;
}

/** Pure input: the subset of an ExecutionPlan aggregate the view needs. */
export interface ExecutionPlanInput {
	readonly id: string;
	readonly workUnitId: string;
	readonly status: string;
	readonly planVersion?: number;
	readonly steps: readonly ExecutionStepInput[];
	/** The transition graph (DR-004 DWP-01); absent/empty ⇒ linear. */
	readonly transitions?: readonly ExecutionTransitionInput[];
}

export interface ExecutionStepView {
	readonly id: string;
	readonly stepType: string;
	readonly purpose: string;
	readonly stepState: string;
	readonly runtimeBindingId?: string;
	readonly tone: StepTone;
	/** The command-backed affordances legal from this stepState (empty for the commandless/terminal states). */
	readonly advanceCommands: readonly StepAdvanceCommand[];
	/** The command-backed CONTROL actions legal from this stepState (skip/cancel — DWP-02/03; empty for terminal). */
	readonly controlCommands: readonly StepControlCommand[];
	/** Below the domain's driveable floor (NOT_READY/READY — the initial state, no advance command) — F-11. */
	readonly belowQueued: boolean;
}

export interface ExecutionPlanView {
	readonly id: string;
	readonly workUnitId: string;
	readonly status: string;
	readonly planVersion?: number;
	readonly steps: readonly ExecutionStepView[];
	/** The transition graph (DR-004 DWP-01); empty ⇒ linear. Carried so the gate + a future graph view can read it. */
	readonly transitions: readonly ExecutionTransitionInput[];
}

// Record<StepState, …> makes the compiler REQUIRE every one of the 10 StepState values — if a value is added to the
// contract this fails to compile until it is classified here (the state-transition-coverage discipline, EP-TST-5).
const ADVANCE_BY_STEP_STATE: Record<StepState, readonly StepAdvanceCommand[]> = {
	NOT_READY: [],
	READY: [],
	QUEUED: ['start'],
	RUNNING: ['complete', 'fail'], // RUNNING affords BOTH — a single optional field would force an arbitrary pick.
	WAITING: [],
	SUCCEEDED: [],
	FAILED: ['retry'],
	SKIPPED: [],
	CANCELLED: [],
	SUPERSEDED: []
};

// The command-backed CONTROL affordances per stepState (DWP-02/03 + DR-004 DWP-04). Derived from the MACHINE's
// skip/cancel/wait/resume arrows now that every one of them has a command: skip is legal READY|QUEUED→SKIPPED; cancel
// is legal READY|QUEUED|RUNNING|WAITING→CANCELLED (NOT from NOT_READY — the machine has no such arrow); wait is legal
// RUNNING→WAITING; resolve is legal WAITING→RUNNING. Record<StepState, …> forces every value to be classified.
const CONTROL_BY_STEP_STATE: Record<StepState, readonly StepControlCommand[]> = {
	NOT_READY: [], // machine: →CANCELLED only from READY/QUEUED/RUNNING/WAITING; →SKIPPED only from READY/QUEUED
	READY: ['skip', 'cancel'],
	QUEUED: ['skip', 'cancel'],
	RUNNING: ['cancel', 'wait'], // a running step can be cancelled or suspended, but not skipped (machine)
	WAITING: ['cancel', 'resolve'], // resolve is the ONLY way out of WAITING besides cancel (DWP-04)
	SUCCEEDED: [],
	FAILED: [], // terminal — no control action (retry is a progress affordance, not control)
	SKIPPED: [],
	CANCELLED: [],
	SUPERSEDED: []
};

const TONE_BY_STEP_STATE: Record<StepState, StepTone> = {
	NOT_READY: 'muted',
	READY: 'pending',
	QUEUED: 'pending',
	RUNNING: 'active',
	WAITING: 'pending',
	SUCCEEDED: 'positive',
	FAILED: 'negative',
	SKIPPED: 'muted',
	CANCELLED: 'negative',
	SUPERSEDED: 'muted'
};

/** The command-backed affordances legal from a stepState — the F-11 allowlist. Unknown/off-contract states → []
 *  (never fabricate an affordance). */
export function advanceCommandsFor(stepState: string): readonly StepAdvanceCommand[] {
	return ADVANCE_BY_STEP_STATE[stepState as StepState] ?? [];
}

/** The command-backed CONTROL actions (skip/cancel/wait/resolve) legal from a stepState — the DWP-02/03 + DWP-04
 *  allowlist. Unknown/off-contract states → [] (never fabricate). Plan-level gating is applied by the caller — this is
 *  the per-stepState machine-legal set only. (Caller-side: skip and resolve need an ACTIVE plan; cancel is cleanup and
 *  wait suspends already-running work, so neither does.) */
export function controlCommandsFor(stepState: string): readonly StepControlCommand[] {
	return CONTROL_BY_STEP_STATE[stepState as StepState] ?? [];
}

/** The semantic tone for a stepState — total over the 10 values; unknown → 'muted'. */
export function stepStateTone(stepState: string): StepTone {
	return TONE_BY_STEP_STATE[stepState as StepState] ?? 'muted';
}

/** A stepState below the domain's driveable floor: NOT_READY/READY, the initial state that has no advance command
 *  (distinct from a terminal state like SUCCEEDED/SKIPPED which is legitimately done, not stuck). */
export function isBelowQueued(stepState: string): boolean {
	return stepState === 'NOT_READY' || stepState === 'READY';
}

function stepView(s: ExecutionStepInput): ExecutionStepView {
	const base: ExecutionStepView = {
		id: s.id,
		stepType: s.stepType,
		purpose: s.purpose,
		stepState: s.stepState,
		tone: stepStateTone(s.stepState),
		advanceCommands: advanceCommandsFor(s.stepState),
		controlCommands: controlCommandsFor(s.stepState),
		belowQueued: isBelowQueued(s.stepState)
	};
	// Preserve the optional runtimeBindingId only when present (exactOptionalPropertyTypes-friendly).
	return s.runtimeBindingId === undefined ? base : { ...base, runtimeBindingId: s.runtimeBindingId };
}

/** Shape one ExecutionPlan aggregate row into the view — step order preserved as authored; the transition graph is
 *  carried (DR-004 DWP-01; empty ⇒ linear, the Tier-3C degenerate). */
export function executionPlanView(row: ExecutionPlanInput): ExecutionPlanView {
	const base: ExecutionPlanView = {
		id: row.id,
		workUnitId: row.workUnitId,
		status: row.status,
		steps: row.steps.map(stepView),
		transitions: row.transitions ?? []
	};
	return row.planVersion === undefined ? base : { ...base, planVersion: row.planVersion };
}

// ── The transition-graph flow gate read-model (JAN-EXECPLAN-DR-004 DWP-01, Tier 3C-ii) ──────────────────────────────
//
// Boundary (EP-CMT-4 — this crosses WORKFLOW-ENGINE SEQUENCING): "which steps may start" is derived by the SINGLE pure
// gate in rph-domain (`startableStepIds`), which BOTH this read-model (the UI Start affordance) AND the engine
// authority (`startExecutionStep`'s precheck) call — so display and authority cannot diverge (DR-004 §19-M2). The graph
// GENERALIZES the shipped linear gate: an EMPTY transitions[] is byte-identical to the Tier-3C single array-index
// frontier; a non-empty graph gates on the in-edge barrier (no PENDING in-edge, ≥1 SATISFIED), covering a diamond
// barrier-join and (later) a PARALLEL_GROUP set-frontier. This is the DISPLAY seam only; the engine gate is authority.

/** Is this step state a satisfied predecessor (terminal-success: SUCCEEDED/SKIPPED)? Delegates to the shared rph-domain
 *  gate so the definition lives in exactly one place. */
export function isTerminalSuccessStep(stepState: string): boolean {
	return isTerminalSuccessStepState(stepState);
}

/**
 * The SET of steps a plan may currently START — the transition-graph flow gate (DR-004 DWP-01), delegating to the pure
 * rph-domain predicate the engine also uses. Empty transitions[] ⇒ the single linear frontier (byte-identical to
 * Tier-3C); a graph ⇒ every step whose in-edge barrier is satisfied (a linear/single-path plan still yields a
 * singleton; a fan-out can yield several). The UI shows Start on a step iff it is in this set AND its advanceCommands
 * include 'start' (so a RUNNING frontier shows Complete/Fail, a READY/NOT_READY one the belowQueued note).
 */
export function startableStepIds(plan: ExecutionPlanView, evaluateGuard?: EdgeGuardEvaluator): string[] {
	return gateStartableStepIds(plan, evaluateGuard);
}

/** The set of steps that are now UNREACHABLE and should be pruned to SKIPPED (a resolved BRANCH's not-taken arm + its
 *  transitive downstream) — DWP-03. Delegates to the shared rph-domain fixpoint. The UI surfaces these for a Prune
 *  action; a linear plan yields none. */
export function prunableStepIds(plan: ExecutionPlanView, evaluateGuard?: EdgeGuardEvaluator): string[] {
	return gatePrunableStepIds(plan, evaluateGuard);
}

/**
 * Build the CONDITIONAL-edge guard evaluator for a plan (DWP-02/03) — a closure over the plan's committed subject
 * (folded from its steps + this plan's own event log). Passed to startableStepIds/prunableStepIds so the read-model's
 * BRANCH first-match matches the engine authority exactly. Pure/browser-safe (the subject fold + evaluator are
 * rph-domain; the schema parse is Zod, already in the browser bundle). Reuse for both calls so the fold happens once.
 */
export function conditionEvaluatorFor(
	plan: ExecutionPlanView,
	events: readonly ConditionSubjectEvent[]
): EdgeGuardEvaluator {
	const subject = buildConditionSubject(plan.steps, events, plan.id);
	return (edge) => {
		const parsed = ConditionExpressionSchema.safeParse(edge.conditionExpression);
		return parsed.success && evaluateCondition(parsed.data, subject);
	};
}

/** The single startable step — back-compat with the Tier-3C scalar frontier: the first of `startableStepIds`, or
 *  undefined. A linear plan yields exactly one; `startableStepIds` is the graph-general (set) API the UI consumes. */
export function startableStepId(plan: ExecutionPlanView): string | undefined {
	return startableStepIds(plan)[0];
}

// ── The transitions view (DWP-06). A READ-ONLY rendering of the plan's immutable graph. ──────────────────────────────
//
// Boundary (EP-CMT-4): this is the EDGE plane of the execution view. It renders what the interpreter already decided;
// it is NOT a second source of affordances. Every button on the execution tab still comes from advanceCommands /
// controlCommands / startableStepIds / prunableStepIds (the F-11 discipline) — a transition row drives nothing.
// Transitions are immutable post-propose (DS-004 F-4), so there is deliberately no edit affordance here.

/** One rendered transition (edge) row. `disposition` is the interpreter's own verdict, not a re-derivation. */
export interface TransitionRow {
	/** Stable row key. The persisted edge id when present; else a positional fallback (the projections input type
	 *  makes `id` optional, and a Svelte keyed each-block may not key on undefined). */
	readonly key: string;
	readonly sourceStepId?: string;
	readonly targetStepId?: string;
	/** Human labels — the step's purpose when it resolves, else an honest marker. Never a fabricated name. */
	readonly sourceLabel: string;
	readonly targetLabel: string;
	/** SEQUENTIAL | CONDITIONAL — the authored edge role. Absent in the input type, so it is defaulted honestly. */
	readonly role: string;
	/** A human summary of the guard, or undefined for an unconditional edge. */
	readonly conditionText?: string;
	/** SATISFIED (this edge is live/taken) · NEUTRALIZED (not-taken arm, or a failed source) · PENDING (source unfinished). */
	readonly disposition: InEdgeDisposition;
}

/** A one-line human summary of a condition expression. Exhaustive over the grammar's 8 ops — a new op fails to compile
 *  here rather than silently rendering as blank. An expression that does not PARSE renders as an explicit marker: the
 *  UI must never present an uninterpretable guard as though it were understood, nor as `[object Object]`. */
export function describeCondition(expression: unknown): string {
	const parsed = ConditionExpressionSchema.safeParse(expression);
	if (!parsed.success) return 'unparseable condition';
	return renderCondition(parsed.data);
}

function renderCondition(c: ConditionExpression): string {
	switch (c.op) {
		case 'STEP_STATE':
			return `step ${shortId(c.stepId)} is ${c.state}`;
		case 'STEP_SUCCEEDED':
			return `step ${shortId(c.stepId)} succeeded`;
		case 'OUTPUT_COUNT':
			return `step ${shortId(c.stepId)} outputs ${c.cmp} ${c.value}`;
		case 'ATTEMPTS':
			return `step ${shortId(c.stepId)} attempts ${c.cmp} ${c.value}`;
		case 'RESULT_EQUALS':
			return `step ${shortId(c.stepId)} result.${c.path} = ${String(c.value)}`;
		case 'ALL':
			return c.operands.length ? `all of (${c.operands.map(renderCondition).join('; ')})` : 'all of ()';
		case 'ANY':
			return c.operands.length ? `any of (${c.operands.map(renderCondition).join('; ')})` : 'any of ()';
		case 'NOT':
			return `not (${renderCondition(c.operand)})`;
	}
}

/** Ids are ULIDs; render a readable prefix rather than 30 characters of entropy. */
const shortId = (id: string): string => (id.length > 12 ? `${id.slice(0, 12)}…` : id);

/**
 * The plan's transition graph as renderable rows (DWP-06).
 *
 * CRITICAL — the edge objects are passed to `inEdgeDisposition` BY REFERENCE, straight out of `plan.transitions`.
 * The BRANCH first-match in rph-domain decides "is this the selected arm?" by OBJECT IDENTITY against the elements of
 * that same array (`selectBranchEdge(...) === edge`). Cloning or normalizing an edge before asking would make every
 * CONDITIONAL edge report NEUTRALIZED, with no type error and no test failure outside a branch fixture. Do not map
 * over `plan.transitions` before this call.
 */
export function transitionRows(
	plan: ExecutionPlanView,
	evaluateGuard?: EdgeGuardEvaluator
): TransitionRow[] {
	const labelOf = (stepId: string | undefined, absent: string): string => {
		if (stepId === undefined) return absent;
		const step = plan.steps.find((s) => s.id === stepId);
		return step ? step.purpose : `unknown step ${shortId(stepId)}`;
	};
	return plan.transitions.map((edge, i) => ({
		key: edge.id ?? `${plan.id}-edge-${i}`,
		...(edge.sourceStepId !== undefined ? { sourceStepId: edge.sourceStepId } : {}),
		...(edge.targetStepId !== undefined ? { targetStepId: edge.targetStepId } : {}),
		// An edge may legitimately have no source (a plan-entry edge) — the contract marks both endpoints optional.
		sourceLabel: labelOf(edge.sourceStepId, '(plan entry)'),
		targetLabel: labelOf(edge.targetStepId, '(plan exit)'),
		role: edge.transitionType ?? (edge.conditionExpression !== undefined ? 'CONDITIONAL' : 'SEQUENTIAL'),
		...(edge.conditionExpression !== undefined
			? { conditionText: describeCondition(edge.conditionExpression) }
			: {}),
		disposition: inEdgeDisposition(plan, edge, evaluateGuard)
	}));
}

/**
 * Scope plans to an Undertaking's PWUs and shape them (the F-6 fix). `pwuIds` is derived two-hop by the caller:
 * PWU.undertakingId == the route's Undertaking → the PWU's id → this set. A plan is included IFF its `workUnitId`
 * is in that set — there is no `undertakingId` on a plan (F-1), so this PWU-membership test is the only correct
 * scope. A plan whose PWU lives in a different Undertaking (or whose PWU has no undertakingId, hence never appears
 * in `listPwus(engine, undertakingId)`) has a workUnitId absent from the set and is EXCLUDED — never the global list.
 */
export function plansForPwus(
	rows: readonly ExecutionPlanInput[],
	pwuIds: Iterable<string>
): ExecutionPlanView[] {
	const scope = pwuIds instanceof Set ? pwuIds : new Set(pwuIds);
	return rows.filter((r) => scope.has(r.workUnitId)).map(executionPlanView);
}

// ── Tier 2: the Undertaking execution SEQUENCE + the layerHandoff advisory constraint-checker (DWP-04, fork C) ──────
//
// Intent: arrange an Undertaking's PWU INSTANCES by their TYPES' hand-off dependency (reuse layerHandoff over the
// bound PWA's PWU-Type graph — F-10 discipline, do NOT re-derive), and raise a coherence ADVISORY when a consumer
// instance has begun before its producer produced the artifact. The simulator's dependency order acting as the
// execution view's constraint-checker.
//
// Boundary (EP-CMT-4 — crosses the PWA≠ExecutionWorkflow cut): this joins the type-level hand-off plane to the
// instance-level execution plane. The join is DELIBERATELY type-level (nothing links a step's bindings to its type's
// hand-off, F-10), so the advisory is a type-level approximation, disclosed as advisory-only.
//
// Do not change: SequenceView / HandoffAdvisory are DISPLAY-ONLY. This value MUST NEVER be an input to a command
//   dispatch or a valid/coherent verdict — it gates NOTHING (fork C, mirroring handoff-order.ts's isolation of
//   analyzePwaGraph.valid). The advisory predicate reads ONLY executionState (single axis) — never
//   workLifecycleState (EXECUTING is a workLifecycleState value, SUCCEEDED an executionState value; mixing them was
//   the JAN-EXECPLAN §19 L3-C1 defect). Crossing the architectural cut is permitted ONLY advisorily.

/** executionState values that mean the instance HAS BEGUN — SINGLE AXIS (executionState), never workLifecycleState. */
const BEGUN_EXECUTION_STATES = new Set<string>(['QUEUED', 'RUNNING', 'WAITING', 'RETRYING', 'SUCCEEDED']);

export interface SequenceInstance {
	readonly id: string;
	readonly title: string;
	/** The PWU's executionState axis value (the ONLY axis the advisory reads). */
	readonly executionState: string;
	readonly pwuTypeId?: string;
	readonly typeName?: string;
}

export interface SequenceLayer {
	readonly index: number;
	readonly instances: SequenceInstance[];
}

/** Why an instance is shown but NOT placed in a dependency layer. */
export type UnplacedReason = 'no-type' | 'off-graph' | 'no-dependency-position';

export interface UnplacedInstance extends SequenceInstance {
	readonly reason: UnplacedReason;
}

/** A single-axis coherence advisory — NEVER a gate. */
export interface HandoffAdvisory {
	readonly consumerInstanceId: string;
	readonly consumerTitle: string;
	readonly consumerTypeId: string;
	readonly producerTypeId: string;
	readonly producerTypeName: string;
	readonly artifact: string;
	readonly detail: string;
}

export interface SequenceView {
	/** Instances placed by their TYPE's Kahn dependency layer (shared within a layer — a partial order). */
	readonly layers: SequenceLayer[];
	/** Instances shown but not dependency-placed: no pwuTypeId, an off-graph type (e.g. a stale/other-version type
	 *  filtered out of the bound-version graph), or a type with no definite dependency position (in a hand-off cycle). */
	readonly unplaced: UnplacedInstance[];
	/** Consumer-began-before-producer-produced advisories (single-axis, M+-aware). Advisory-only — gates nothing. */
	readonly advisories: HandoffAdvisory[];
}

/**
 * The Undertaking execution sequence over instances + the single-axis hand-off advisory (DWP-04, fork C).
 *
 * `ex` MUST already be scoped to the instances' bound (pwaId, pwaVersion) — the caller builds it via the version-
 * scoped buildPwaExport, so a type from another version of the same PWA is simply absent from `ex.nodes` and its
 * instances fall to `unplaced` as 'off-graph' (the version-skew safety net, JAN-EXECPLAN §19 L3-C2).
 *
 * The advisory is M+-aware: a producer TYPE with N instances is satisfied by ANY ONE succeeded instance (the
 * hand-off is type-level — nothing binds a specific producer instance to a specific consumer instance, F-10); it
 * fires only when NO producer-type instance has SUCCEEDED and a consumer instance HAS BEGUN. Evaluated per consumer
 * instance (consumer M+). Reads executionState ONLY.
 */
/** The join state of one instance against the version-scoped type graph — placed at a layer, or an unplaced reason. */
function classifyInstance(
	inst: SequenceInstance,
	nodeIds: ReadonlySet<string>,
	layerOf: ReadonlyMap<string, number>
): { layer: number } | { reason: UnplacedReason } {
	if (!inst.pwuTypeId) return { reason: 'no-type' };
	if (!nodeIds.has(inst.pwuTypeId)) return { reason: 'off-graph' };
	const li = layerOf.get(inst.pwuTypeId);
	// In the graph but in a hand-off cycle / downstream of one / unordered — no definite dependency position.
	return li === undefined ? { reason: 'no-dependency-position' } : { layer: li };
}

function placeInstances(
	instances: readonly SequenceInstance[],
	nodeIds: ReadonlySet<string>,
	nameOf: ReadonlyMap<string, string>,
	layerOf: ReadonlyMap<string, number>
): { layers: SequenceLayer[]; unplaced: UnplacedInstance[] } {
	const layerBuckets = new Map<number, SequenceInstance[]>();
	const unplaced: UnplacedInstance[] = [];
	for (const inst of instances) {
		const c = classifyInstance(inst, nodeIds, layerOf);
		if ('reason' in c) {
			unplaced.push({ ...inst, reason: c.reason });
			continue;
		}
		const placed: SequenceInstance = { ...inst, typeName: inst.typeName ?? nameOf.get(inst.pwuTypeId ?? '') };
		layerBuckets.set(c.layer, [...(layerBuckets.get(c.layer) ?? []), placed]);
	}
	const layers = [...layerBuckets.keys()]
		.sort((a, b) => a - b)
		.map((index) => ({
			index,
			instances: [...(layerBuckets.get(index) ?? [])].sort((a, b) => a.id.localeCompare(b.id))
		}));
	return { layers, unplaced };
}

/** Group instances by their pwuTypeId (drops instances with no type — they cannot participate in a type hand-off). */
function groupByType(instances: readonly SequenceInstance[]): Map<string, SequenceInstance[]> {
	const byType = new Map<string, SequenceInstance[]>();
	for (const inst of instances)
		if (inst.pwuTypeId) byType.set(inst.pwuTypeId, [...(byType.get(inst.pwuTypeId) ?? []), inst]);
	return byType;
}

function computeAdvisories(
	ex: PwaGraphExport,
	instancesByType: ReadonlyMap<string, SequenceInstance[]>,
	nameOf: ReadonlyMap<string, string>
): HandoffAdvisory[] {
	const producerSucceeded = (typeId: string): boolean =>
		(instancesByType.get(typeId) ?? []).some((i) => i.executionState === 'SUCCEEDED');
	const advisories: HandoffAdvisory[] = [];
	for (const edge of ex.dataFlow) {
		if (producerSucceeded(edge.producer)) continue; // any succeeded producer instance satisfies the hand-off (M+)
		const producerName = nameOf.get(edge.producer) ?? edge.producer;
		for (const consumer of instancesByType.get(edge.consumer) ?? []) {
			if (!BEGUN_EXECUTION_STATES.has(consumer.executionState)) continue; // single-axis: executionState only
			advisories.push({
				consumerInstanceId: consumer.id,
				consumerTitle: consumer.title,
				consumerTypeId: edge.consumer,
				producerTypeId: edge.producer,
				producerTypeName: producerName,
				artifact: edge.artifact,
				detail: `Consumer has begun (executionState=${consumer.executionState}) but no “${producerName}” instance has produced “${edge.artifact}” (executionState=SUCCEEDED).`
			});
		}
	}
	return advisories;
}

export function sequenceView(
	ex: PwaGraphExport,
	instances: readonly SequenceInstance[],
	order: HandoffOrder = layerHandoff(ex)
): SequenceView {
	const nodeIds = new Set(ex.nodes.map((n) => n.id));
	const nameOf = new Map(ex.nodes.map((n) => [n.id, n.name] as const));
	const layerOf = new Map<string, number>();
	order.layers.forEach((layer, i) => layer.forEach((id) => layerOf.set(id, i)));

	const { layers, unplaced } = placeInstances(instances, nodeIds, nameOf, layerOf);
	const advisories = computeAdvisories(ex, groupByType(instances), nameOf);
	return { layers, unplaced, advisories };
}

// Re-export the contract enum types so consumers (the route load(), the panel) can type against the same source.
export type { ExecutionPlanStatus, ExecutionState, StepState } from '@janumipwb/rph-contracts';
