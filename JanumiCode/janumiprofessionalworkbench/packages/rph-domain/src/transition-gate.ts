// Transition-graph flow gate (JAN-EXECPLAN-DR-004 DWP-01, Tier 3C-ii). Pure, deterministic predicates over
// lightweight read-models (same idiom as execution.ts / pwuGuards.ts). No I/O, no clock — replay-safe.
//
// EP-CMT-4 (this crosses WORKFLOW-ENGINE SEQUENCING). This is the SINGLE home of the "what may start next" gate,
// consumed by BOTH the read-model (rph-projections execution-view → the UI Start affordance) AND the authority
// (rph-application startExecutionStep precheck → the engine gate). Writing it once is the whole point: the shipped
// Tier-3C code duplicated the linear gate across those two seams, and this DWP unifies them so they cannot diverge
// (DR-004 §19-M2).
//
// The graph GENERALIZES the shipped linear array-index gate: an EMPTY transitions[] runs byte-identical to the
// linear frontier (implicit step[i-1]→step[i] edges). A step is startable when NO in-edge is PENDING and ≥1 is
// SATISFIED — one rule that also covers a diamond/barrier-join. This DWP handles UNCONDITIONAL edges only: a
// CONDITIONAL edge's guard evaluation (first-match) lands in DWP-02/03 (an optional evaluator hook is threaded here
// so those DWPs extend, not rewrite, this module). Exec ≠ assurance (INV-5): reads state, sets nothing.

/** The terminal-SUCCESS step states — a satisfied predecessor. */
const TERMINAL_SUCCESS = new Set<string>(['SUCCEEDED', 'SKIPPED']);
/** The full terminal set of the ExecutionStep.stepState machine. */
const TERMINAL = new Set<string>(['SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED']);
/** The states PruneExecutionStep may be issued FROM (its vocab drivesFrom). The read-model must not offer a prune
 *  outside this set or it tempts a command the engine refuses — the read-model/authority divergence this module
 *  exists to prevent. RUNNING/WAITING are deliberately absent: live work is CANCELLED, never pruned. */
const PRUNABLE_SOURCE_STATES = new Set<string>(['NOT_READY', 'READY', 'QUEUED']);

/** Is this step state a satisfied predecessor (SUCCEEDED/SKIPPED)? */
export function isTerminalSuccessStepState(stepState: string): boolean {
	return TERMINAL_SUCCESS.has(stepState);
}
/** Is this step state terminal (done, one way or another)? */
export function isTerminalStepState(stepState: string): boolean {
	return TERMINAL.has(stepState);
}

/** The minimal step read-model the gate needs. */
export interface GateStep {
	readonly id: string;
	readonly stepState: string;
	/** The node KIND. Load-bearing: exclusive first-match selection belongs to a BRANCH node and nothing else. Absent
	 *  ⇒ treated as non-BRANCH (independent out-edges), the safe default. */
	readonly stepType?: string;
	/** For a RESOLVED BRANCH: the id of the out-edge it actually selected, recorded when the branch reached SUCCEEDED
	 *  (DWP-09). Absent ⇒ not yet resolved, or a plan authored before the field existed; the gate then falls back to
	 *  evaluating first-match. See selectBranchEdge for why a recorded decision must win over a re-derived one. */
	readonly selectedTransitionId?: string;
}

/** The minimal transition (edge) read-model the gate needs. `conditionExpression` is opaque here (DWP-02 evaluates). */
export interface GateTransition {
	/** The persisted edge id. Carried so a BRANCH's RECORDED selection can be matched back to its edge. */
	readonly id?: string;
	readonly sourceStepId?: string;
	readonly targetStepId?: string;
	readonly transitionType?: string;
	readonly conditionExpression?: unknown;
}
/** The minimal plan read-model the gate needs. `transitions` absent ⇒ the linear degenerate. */
export interface GatePlan {
	readonly status: string;
	readonly steps: readonly GateStep[];
	readonly transitions?: readonly GateTransition[];
}

export type InEdgeDisposition = 'SATISFIED' | 'NEUTRALIZED' | 'PENDING';

/**
 * DWP-02 hook: evaluate a CONDITIONAL edge's guard. DWP-01 has no evaluator, so a CONDITIONAL edge is treated
 * conservatively (its guard is NOT satisfied until DWP-02 supplies one) — but no CONDITIONAL edge exists yet
 * (BRANCH lands in DWP-03), so this does not affect any shipped or DWP-01 plan.
 */
export type EdgeGuardEvaluator = (edge: GateTransition, plan: GatePlan) => boolean;

// ── GateContext (JAN-EXECREM WP-2 / SM-1) ───────────────────────────────────────────────────────────────────────
//
// ONE context per PUBLIC entry point, carrying the adjacency indexes and two memos. This is purely a performance
// seam: every predicate below computes exactly what it computed before, from the same inputs, in the same order.
// It lands BEFORE any rule change so that each later diff on this file reads as a rule change rather than a rule
// change tangled with an indexing change.
//
// WHY (F-34). `inEdgeDisposition` called `liveStepIds` afresh for EVERY in-edge — a full BFS per edge — and
// `liveStepIds` in turn called the O(E) `inEdgesOf`/`outEdgesOf` array filters once per node. So `startableStepIds`
// over a fan-out of width N ran N steps x N in-edges x BFS(V·E), i.e. cubic, against this module's own O(V+E)
// header claim, and it re-invoked the CALLER'S guard evaluator once per edge per pass. `prunableStepIds` already
// hoisted its single `liveStepIds` call correctly, which is what proves the cost was accidental, not inherent.
interface GateContext {
	readonly plan: GatePlan;
	readonly evaluateGuard?: EdgeGuardEvaluator;
	readonly stepById: ReadonlyMap<string, GateStep>;
	/** In-edges keyed by targetStepId, authored order. Entry edges (no source) ARE included — they are in-edges. */
	readonly inEdgesById: ReadonlyMap<string, readonly GateTransition[]>;
	/** Out-edges keyed by sourceStepId, authored order (= BRANCH first-match order), half-edges EXCLUDED. */
	readonly outEdgesById: ReadonlyMap<string, readonly GateTransition[]>;
	/** The live set, computed at most ONCE per context. */
	live(): ReadonlySet<string>;
	/** The disposition of one in-edge, memoized on edge identity. */
	dispositionOf(edge: GateTransition): InEdgeDisposition;
	/**
	 * The out-edge a settled BRANCH selected, memoized on SOURCE identity.
	 *
	 * This is the memo that actually bounds the guard-evaluator call count. Memoizing the per-edge disposition is
	 * not enough on its own: `selectBranchEdge` scans a source's out-edges calling the evaluator until one matches,
	 * so running it once per in-edge of a width-N fan-out is still N x N evaluator calls. The selection depends only
	 * on the SOURCE (its out-edges and their guards are fixed within a context), so it is computed once per branch —
	 * which is what makes "at most one evaluation per guarded edge" true.
	 */
	selectionOf(source: GateStep, outEdges: readonly GateTransition[]): GateTransition | undefined;
}

const EMPTY_EDGES: readonly GateTransition[] = [];

function gateContext(plan: GatePlan, evaluateGuard?: EdgeGuardEvaluator): GateContext {
	// FIRST-wins, exactly matching the `plan.steps.find(...)` lookups this replaces. Duplicate step ids are accepted
	// at propose today (F-10, fixed in WP-6), so a last-wins Map would silently change which step every predicate
	// resolves to — a semantic change smuggled in under a "pure refactor".
	const stepById = new Map<string, GateStep>();
	for (const s of plan.steps) if (!stepById.has(s.id)) stepById.set(s.id, s);

	const inEdgesById = new Map<string, GateTransition[]>();
	const outEdgesById = new Map<string, GateTransition[]>();
	// Single pass in authored array order, so both indexes preserve it (load-bearing for BRANCH first-match).
	for (const t of plan.transitions ?? []) {
		if (t.targetStepId === undefined) continue; // a half-edge reaches nothing — see the exclusion note below
		const into = inEdgesById.get(t.targetStepId);
		if (into) into.push(t);
		else inEdgesById.set(t.targetStepId, [t]);
		if (t.sourceStepId !== undefined) {
			const outOf = outEdgesById.get(t.sourceStepId);
			if (outOf) outOf.push(t);
			else outEdgesById.set(t.sourceStepId, [t]);
		}
	}

	let liveMemo: ReadonlySet<string> | undefined;
	const dispositionMemo = new Map<GateTransition, InEdgeDisposition>();
	const selectionMemo = new Map<GateStep, GateTransition | undefined>();
	const ctx: GateContext = {
		plan,
		evaluateGuard,
		stepById,
		inEdgesById,
		outEdgesById,
		live: () => (liveMemo ??= computeLiveStepIds(ctx)),
		dispositionOf: (edge) => {
			let d = dispositionMemo.get(edge);
			if (d === undefined) {
				d = computeInEdgeDisposition(ctx, edge);
				dispositionMemo.set(edge, d);
			}
			return d;
		},
		selectionOf: (source, outEdges) => {
			// `has` rather than a truthy check: `undefined` (a malformed branch with no matching arm and no default)
			// is a REAL, cacheable answer, and re-deriving it would restore the quadratic call count in exactly the
			// case that evaluates every guard.
			if (selectionMemo.has(source)) return selectionMemo.get(source);
			const selected = computeBranchSelection(ctx, outEdges, source);
			selectionMemo.set(source, selected);
			return selected;
		}
	};
	return ctx;
}

/**
 * The ENTRY steps of a transition graph — the ONE definition, shared by propose-time validation and runtime BFS
 * seeding so the two planes cannot drift (JAN-EXECREM WP-3 / F-03, F-04, F-05).
 *
 * A step is an entry iff it has no in-edge FROM A REAL SOURCE. A plan-entry edge (`sourceStepId` absent,
 * `targetStepId` present) is contract-legal and explicitly blessed — `checkDanglingIds` says so in as many words:
 * "A missing SOURCE is legitimate: that is a plan-entry edge" — and it does not make its target a non-entry; it
 * marks it AS an entry.
 *
 * THE DEFECT THIS CLOSES. Propose-time counted in-degree over edges with BOTH endpoints (`buildAdjacency`), so an
 * entry edge into s1 left s1's in-degree at 0 and the plan validated. The runtime BFS seeded its frontier from
 * `inEdgesOf(...).length === 0`, which INCLUDES source-less edges, so the same s1 had one in-edge and the frontier
 * came out EMPTY. With an empty frontier the live set is empty, so every source reads NOT-live, every in-edge
 * NEUTRALIZED, and every step both unstartable AND waiver-free prunable — i.e. a contract-legal plan turned Prune
 * into a universal bypass of the mandatory-skip waiver rule, and reported the whole graph unreachable. One
 * definition, used by both, is why that cannot recur.
 *
 * Note the `every` is over in-edges FROM A SOURCE, so a step with no in-edges at all is (still) an entry — the
 * pre-existing behaviour for every graph plan that declares no entry edge, which is why this change is inert there.
 */
export function entryStepIds(
	steps: readonly { readonly id: string }[],
	transitions: readonly GateTransition[]
): string[] {
	const hasRealSourceInEdge = new Set<string>();
	for (const t of transitions)
		if (t.sourceStepId !== undefined && t.targetStepId !== undefined) hasRealSourceInEdge.add(t.targetStepId);
	return steps.filter((s) => !hasRealSourceInEdge.has(s.id)).map((s) => s.id);
}

/**
 * Is the graph INCOHERENT — a non-empty transition graph with no entry at all?
 *
 * Propose-time validation refuses this (exactly-one-entry, plus the DAG check), so it can only arrive as stored
 * history from an earlier build or a plan constructed around the command bus. It matters because the failure mode
 * is silent and maximally unsafe: no entry ⇒ empty live set ⇒ EVERY step reads unreachable and therefore prunable.
 * The gate must fail CLOSED here (offer nothing) rather than fail open (offer to prune the entire plan).
 */
function graphIsIncoherent(plan: GatePlan): boolean {
	const transitions = plan.transitions ?? [];
	return (
		transitions.length > 0 &&
		plan.steps.length > 0 &&
		entryStepIds(plan.steps, transitions).length === 0
	);
}

const stepOf = (ctx: GateContext, stepId: string | undefined): GateStep | undefined =>
	stepId === undefined ? undefined : ctx.stepById.get(stepId);

const stateOf = (ctx: GateContext, stepId: string | undefined): string | undefined =>
	stepOf(ctx, stepId)?.stepState;

/** The in-edges of a step = transitions whose targetStepId is this step. */
const inEdgesOf = (ctx: GateContext, stepId: string): readonly GateTransition[] =>
	ctx.inEdgesById.get(stepId) ?? EMPTY_EDGES;

/** The out-edges of a step, in authored (array) order — which IS the branch first-match order. A half-edge (a source
 *  with NO target) is excluded: it reaches nothing, so it must not participate in selection. Filtering on source alone
 *  let such an edge win first-match and neutralize every real arm, while validateTransitionGraph's adjacency (which
 *  requires both endpoints) never saw it — the two disagreed and the plan deadlocked. Propose now rejects half-edges
 *  outright; this exclusion (applied when the index is built) keeps the runtime safe for any that predate that rule. */
const outEdgesOf = (ctx: GateContext, stepId: string): readonly GateTransition[] =>
	ctx.outEdgesById.get(stepId) ?? EMPTY_EDGES;

/** An edge is CONDITIONAL (guarded) if it carries a conditionExpression or is tagged CONDITIONAL. */
const isConditionalEdge = (e: GateTransition): boolean =>
	e.conditionExpression !== undefined || e.transitionType === 'CONDITIONAL';

/**
 * BRANCH first-match (DWP-03/D3): among a source's out-edges (array order) select the FIRST CONDITIONAL edge whose
 * guard is true, else the first unconditional (SEQUENTIAL default) — so exactly ONE arm is ever selected. Returns
 * undefined only if no unconditional default exists and every conditional guard is false (a malformed BRANCH — propose
 * validation forbids it by requiring a SEQUENTIAL default). Evaluated IN the gate so a losing arm is rejected at start
 * regardless of prune timing (closes the double-run window, §10-M-D3).
 */
function selectBranchEdge(
	ctx: GateContext,
	outEdges: readonly GateTransition[],
	source?: GateStep
): GateTransition | undefined {
	// Route through the per-source memo (see GateContext.selectionOf). Without a source there is nothing to key on.
	return source === undefined
		? computeBranchSelection(ctx, outEdges, source)
		: ctx.selectionOf(source, outEdges);
}

/** The first-match computation itself. Called at most once per BRANCH source per context. */
function computeBranchSelection(
	ctx: GateContext,
	outEdges: readonly GateTransition[],
	source?: GateStep
): GateTransition | undefined {
	// A RECORDED decision wins over a re-derived one (DWP-09). A branch is evaluated at a point in time against the
	// plan's then-current condition subject, and that subject does NOT stay still: a step reachable only through a
	// not-taken edge can still change state, and an ATTEMPTS or STEP_STATE guard over it will flip. Re-deriving on
	// every read therefore let an already-settled BRANCH silently re-resolve, making the LOSING arm live and running
	// both. Once the branch has acted, the decision is history, not a computation.
	if (source?.selectedTransitionId !== undefined) {
		const recorded = outEdges.find((e) => e.id === source.selectedTransitionId);
		// If the recorded id no longer matches any out-edge the plan is incoherent; select NOTHING rather than
		// silently falling back to a fresh evaluation that could contradict what the plan already did.
		return recorded;
	}
	for (const e of outEdges) {
		if (!isConditionalEdge(e)) return e; // an unconditional edge (the SEQUENTIAL default) always matches
		if (ctx.evaluateGuard?.(e, ctx.plan)) return e; // the first true conditional
	}
	return undefined;
}

/**
 * The steps still LIVE — reachable from a plan entry along edges the plan's own branch logic has not excluded (DWP-08).
 *
 * This replaces the DWP-07 `prunedAsUnreachable` flag, which keyed deadness on WHICH COMMAND drove a step to SKIPPED.
 * That was the wrong axis and only half-closed the defect it targeted: SkipExecutionStep drives the same
 * READY|QUEUED→SKIPPED arrow, so waiving a step on a not-taken arm left it terminal-SUCCESS and unmarked, and its
 * out-edges went live again — resurrecting exactly the arm the BRANCH excluded. Reachability is a property of the
 * GRAPH, not of the command that happened to terminate a node, so it is computed here and cannot be bypassed by any
 * command, present or future. It also needs no persisted flag, so plans written by earlier builds read correctly.
 *
 * Forward BFS from the entries (the graph is a validated DAG), so this is O(V+E) — the previous nested fixpoint was
 * cubic and re-ran the guard evaluator per edge per pass.
 */
function computeLiveStepIds(ctx: GateContext): ReadonlySet<string> {
	const { plan } = ctx;
	const transitions = plan.transitions ?? [];
	if (transitions.length === 0) return new Set(plan.steps.map((s) => s.id)); // linear plan: everything is reachable
	const live = new Set<string>();
	// The SHARED entry definition (WP-3). Seeding from `inEdgesOf(...).length === 0` counted a source-less
	// plan-entry edge as an in-edge, so a contract-legal entry edge emptied the frontier and voided the live set.
	const frontier = [...entryStepIds(plan.steps, transitions)];
	while (frontier.length) {
		const id = frontier.pop()!;
		if (live.has(id)) continue;
		live.add(id);
		for (const e of outEdgesOf(ctx, id)) {
			if (e.targetStepId === undefined || live.has(e.targetStepId)) continue;
			// The edge carries reachability unless the plan EXCLUDED it — i.e. a resolved BRANCH did not select it.
			if (!branchExcludes(ctx, e)) frontier.push(e.targetStepId);
		}
	}
	return live;
}

/**
 * Did the plan's own declared logic EXCLUDE this edge? True only for a not-taken arm of a RESOLVED BRANCH (or a
 * guarded edge off a settled non-BRANCH source whose guard is false).
 *
 * Deliberately narrow, and deliberately NOT "the source failed": a FAILED step is retryable (FAILED→QUEUED) and a
 * source that has not finished may still take this edge, so neither excludes anything. The barrier-join separately
 * treats a failed source as NEUTRALIZED so a JOIN cannot wedge behind it — that is a different question with a
 * different answer, and conflating them let a transient failure offer a whole downstream for prune-to-SKIPPED.
 */
function branchExcludes(ctx: GateContext, edge: GateTransition): boolean {
	if (edge.sourceStepId === undefined) return false;
	const source = stepOf(ctx, edge.sourceStepId);
	if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false; // unsettled ⇒ excludes nothing
	const outEdges = outEdgesOf(ctx, edge.sourceStepId);
	if (source.stepType === 'BRANCH' && outEdges.some(isConditionalEdge))
		return selectBranchEdge(ctx, outEdges, source) !== edge;
	if (!isConditionalEdge(edge)) return false;
	return ctx.evaluateGuard?.(edge, ctx.plan) !== true;
}
/**
 * The out-edge a BRANCH step selects RIGHT NOW, by first-match — the decision the handler records when the branch
 * reaches SUCCEEDED (DWP-09). Returns undefined for a non-BRANCH step, a step with no guarded out-edge, or a
 * malformed branch where no conditional guard holds and no unconditional default exists (propose-time validation
 * forbids the last case). Deliberately ignores any ALREADY-recorded selection: this is the act of deciding.
 */
export function resolveBranchSelection(
	plan: GatePlan,
	stepId: string,
	evaluateGuard?: EdgeGuardEvaluator
): string | undefined {
	const ctx = gateContext(plan, evaluateGuard);
	const source = stepOf(ctx, stepId);
	if (source?.stepType !== 'BRANCH') return undefined;
	const outEdges = outEdgesOf(ctx, stepId);
	if (!outEdges.some(isConditionalEdge)) return undefined;
	for (const e of outEdges) {
		if (!isConditionalEdge(e)) return e.id;
		if (evaluateGuard?.(e, plan)) return e.id;
	}
	return undefined;
}

/**
 * The disposition of ONE in-edge. SATISFIED: source terminal-success (or a plan-entry edge with no source) AND the
 * edge guard holds. NEUTRALIZED: source terminal-non-success (FAILED/CANCELLED/SUPERSEDED), or a CONDITIONAL edge
 * whose guard is false off a terminal source. PENDING: source non-terminal. The guard defaults to TRUE for a
 * SEQUENTIAL/unconditional edge; a CONDITIONAL edge with no evaluator supplied is NOT satisfied (DWP-01 has none).
 */
export function inEdgeDisposition(
	plan: GatePlan,
	edge: GateTransition,
	evaluateGuard?: EdgeGuardEvaluator
): InEdgeDisposition {
	return gateContext(plan, evaluateGuard).dispositionOf(edge);
}

/** The body of `inEdgeDisposition`, over a context so the live set and sibling edges are computed once. */
function computeInEdgeDisposition(ctx: GateContext, edge: GateTransition): InEdgeDisposition {
	if (edge.sourceStepId === undefined) return 'SATISFIED'; // a plan-entry edge is always satisfied
	const source = stepOf(ctx, edge.sourceStepId);
	if (source === undefined) return 'PENDING'; // dangling (rejected at propose) — conservative
	const src = source.stepState;
	if (!TERMINAL.has(src)) return 'PENDING'; // source not yet done
	// An UNREACHABLE source satisfies nothing, however it reached its terminal state (DWP-08). Checked BEFORE the
	// terminal-success test precisely because SKIPPED is IN that set: a step on a not-taken arm is terminal-success
	// whether it was pruned OR waived away, and treating that as "done, carry on" resurrected the excluded arm.
	if (!ctx.live().has(source.id)) return 'NEUTRALIZED';
	// A terminal-non-success source (FAILED/CANCELLED/SUPERSEDED) neutralizes the edge regardless of guard, so a barrier
	// JOIN does not wedge behind a failed arm (D7). NOTE: this is NOT the same as "the plan excluded this path" — see
	// isDeadForPruning, which deliberately does not treat it as grounds to prune.
	if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';
	const outEdges = outEdgesOf(ctx, edge.sourceStepId);
	// EXCLUSIVE first-match belongs to a BRANCH node and to nothing else (D2: a BRANCH is a stepType; parallelism is
	// topology). Keying this on "the source has ≥1 conditional out-edge" instead made every node with one guarded arm an
	// exclusive branch — so a PARALLEL_GROUP fan-out mixing a guarded arm with unconditional ones silently lost every arm
	// but the first match, while propose-time validation (keyed on stepType) never looked. The two planes now agree, and
	// validateTransitionGraph additionally REFUSES a conditional out-edge from a non-BRANCH step so they cannot drift.
	if (source.stepType === 'BRANCH' && outEdges.some(isConditionalEdge))
		return selectBranchEdge(ctx, outEdges, source) === edge ? 'SATISFIED' : 'NEUTRALIZED';
	// Non-BRANCH source: out-edges are INDEPENDENT. An unconditional edge is taken; a guarded one is taken iff it holds.
	if (!isConditionalEdge(edge)) return 'SATISFIED';
	return ctx.evaluateGuard?.(edge, ctx.plan) === true ? 'SATISFIED' : 'NEUTRALIZED';
}

/**
 * The linear frontier (empty transitions[] degenerate) — byte-identical to the shipped startableStepId: the first
 * non-terminal step in array order, iff every earlier step is terminal-success and the plan is ACTIVE.
 */
function linearFrontier(plan: GatePlan): string | undefined {
	if (plan.status !== 'ACTIVE') return undefined;
	for (const s of plan.steps) {
		if (TERMINAL_SUCCESS.has(s.stepState)) continue;
		return TERMINAL.has(s.stepState) ? undefined : s.id;
	}
	return undefined;
}

/** The barrier state of a step's in-edges: is any PENDING, is any SATISFIED, and the first PENDING edge (for the
 *  gate's blocker message). One pass — shared by the frontier read-model and the gate authority (no divergence). */
interface BarrierState {
	readonly anyPending: boolean;
	readonly anySatisfied: boolean;
	readonly firstPending?: GateTransition;
}
function barrierState(ctx: GateContext, inEdges: readonly GateTransition[]): BarrierState {
	let anyPending = false;
	let anySatisfied = false;
	let firstPending: GateTransition | undefined;
	for (const e of inEdges) {
		const d = ctx.dispositionOf(e);
		if (d === 'PENDING') {
			anyPending = true;
			firstPending ??= e;
		} else if (d === 'SATISFIED') {
			anySatisfied = true;
		}
	}
	return { anyPending, anySatisfied, firstPending };
}

/** Is a non-terminal step at the startable frontier? Entry (no in-edges) ⇒ yes; else the barrier: no PENDING, ≥1 SATISFIED. */
function stepAtFrontier(ctx: GateContext, step: GateStep): boolean {
	if (TERMINAL.has(step.stepState)) return false; // already done/failed
	const inEdges = inEdgesOf(ctx, step.id);
	if (inEdges.length === 0) return true; // entry step
	const b = barrierState(ctx, inEdges);
	return !b.anyPending && b.anySatisfied;
}

/**
 * The set of steps a plan may currently START (the frontier) — the graph gate GENERALIZING the shipped scalar
 * startableStepId. Empty transitions[] ⇒ [linearFrontier] (byte-identical). Non-empty ⇒ every non-terminal step
 * whose in-edge barrier is satisfied (or that is an entry). [] when the plan is not ACTIVE. A single-path/linear
 * graph yields a singleton; a fan-out yields several — this IS the PARALLEL_GROUP mechanism (DWP-05): parallelism is
 * TOPOLOGY (a node with ≥2 unconditional out-edges), never an edge type, so the gate does not special-case the
 * stepType. Each member of the set is started by its OWN StartExecutionStep; those commands serialize on the plan
 * aggregate's revision, so N concurrent arms are N independent stepStates in one aggregate with no lost update.
 * A RUNNING step remains in this set (it is non-terminal); the ENGINE refuses to re-start it (rejectReentry), so the
 * two layers together offer each arm exactly once.
 */
export function startableStepIds(plan: GatePlan, evaluateGuard?: EdgeGuardEvaluator): string[] {
	if (plan.status !== 'ACTIVE') return [];
	if ((plan.transitions ?? []).length === 0) {
		const f = linearFrontier(plan);
		return f === undefined ? [] : [f];
	}
	const ctx = gateContext(plan, evaluateGuard);
	return plan.steps.filter((s) => stepAtFrontier(ctx, s)).map((s) => s.id);
}

/**
 * The set of steps that are now UNREACHABLE and should be pruned to SKIPPED (DWP-03/D5) — the not-taken arm(s) of a
 * resolved BRANCH plus their transitively-unreachable downstream. A non-terminal, non-entry step is prunable when every
 * in-edge is either NEUTRALIZED (a not-taken/failed arm) OR comes from an already-prunable step (transitivity — a
 * fixpoint, so a whole exclusive subtree prunes, while a JOIN reachable via the TAKEN path keeps a SATISFIED in-edge and
 * is NOT pruned). Pure; the controller issues PruneExecutionStep for each (idempotent — a re-computed already-terminal
 * step drops out). Empty transitions[] ⇒ [] (a linear plan never prunes).
 *
 * [] when the plan is not ACTIVE, mirroring startableStepIds (DWP-06). This is not cosmetic symmetry: pruneExecutionStep
 * REJECTS a non-ACTIVE plan ("a prune is within-execution branch resolution"), so without this gate the read-model
 * offered a Prune the engine would refuse — precisely the read-model/authority divergence this single gate home exists
 * to prevent (DR-004 §19-M2), and an F-11 violation the moment a UI renders from it.
 */
export function prunableStepIds(plan: GatePlan, evaluateGuard?: EdgeGuardEvaluator): string[] {
	if (plan.status !== 'ACTIVE') return [];
	// FAIL CLOSED on an incoherent graph (WP-3). With no entry the live set is empty, which would otherwise mark
	// EVERY step unreachable and therefore prunable — turning Prune into a blanket bypass of the mandatory-skip
	// waiver rule on a plan the gate cannot actually reason about. Offer nothing instead.
	if (graphIsIncoherent(plan)) return [];
	const live = gateContext(plan, evaluateGuard).live();
	return plan.steps
		.filter(
			(s) =>
				!live.has(s.id) && // the plan's own branch logic excluded it
				!TERMINAL.has(s.stepState) && // already done, one way or another — nothing to prune
				PRUNABLE_SOURCE_STATES.has(s.stepState) // and the engine will actually accept the command
		)
		.map((s) => s.id);
}

/** The result of the start-gate authority: startable, or the blocking predecessor + why. */
export interface StartGateResult {
	readonly ok: boolean;
	readonly blockerStepId?: string;
	readonly blockerState?: string;
	readonly reason?: string;
}

/**
 * The start-gate AUTHORITY: may `stepId` start? (Plan-ACTIVE is checked by the caller, mirroring the shipped
 * precheck.) Empty transitions[] ⇒ the shipped linear rule (the first earlier array-index step not terminal-success
 * blocks). Non-empty ⇒ the in-edge barrier (a PENDING in-edge blocks, naming its source; an all-NEUTRALIZED
 * non-entry step is unreachable and blocked — it should be pruned, DWP-03). Mirrors startableStepIds so the UI
 * affordance and the engine gate cannot diverge.
 */
export function startStepGate(
	plan: GatePlan,
	stepId: string,
	evaluateGuard?: EdgeGuardEvaluator
): StartGateResult {
	// Mirror startableStepIds' own preconditions FIRST (DWP-07). The read-model half excludes an unknown step and a
	// TERMINAL one (stepAtFrontier opens with exactly that test); the authority half used to check neither, so on the
	// graph path an entry step returned ok unconditionally and on the linear path an unknown id produced an empty
	// predecessor slice and also returned ok. "The two halves cannot diverge" has to hold in BOTH directions.
	const ctx = gateContext(plan, evaluateGuard);
	const target = stepOf(ctx, stepId);
	if (target === undefined)
		return { ok: false, reason: `step ${stepId} is not declared in this plan` };
	if (TERMINAL.has(target.stepState))
		return {
			ok: false,
			blockerStepId: stepId,
			blockerState: target.stepState,
			reason: 'the step is already terminal'
		};
	if ((plan.transitions ?? []).length === 0) {
		const idx = plan.steps.findIndex((s) => s.id === stepId);
		const blocker = plan.steps
			.slice(0, Math.max(0, idx))
			.find((s) => !TERMINAL_SUCCESS.has(s.stepState));
		return blocker
			? {
					ok: false,
					blockerStepId: blocker.id,
					blockerState: blocker.stepState,
					reason: 'an earlier step is not terminal-success (linear order)'
				}
			: { ok: true };
	}
	// FAIL CLOSED before the barrier (WP-3). With no entry the live set is empty, so reachability is undefined for
	// EVERY step; naming a per-edge blocker here would be a guess, and saying "it should be pruned" would actively
	// mislead — the remedy for an incoherent plan is supersession, not pruning it step by step.
	if (graphIsIncoherent(plan))
		return {
			ok: false,
			reason:
				'the transition graph has no entry step, so reachability cannot be determined — the plan is incoherent and no step may start (it must be superseded, NOT pruned)'
		};
	const inEdges = inEdgesOf(ctx, stepId);
	if (inEdges.length === 0) return { ok: true }; // entry step
	const b = barrierState(ctx, inEdges);
	if (b.firstPending)
		return {
			ok: false,
			blockerStepId: b.firstPending.sourceStepId,
			blockerState: stateOf(ctx, b.firstPending.sourceStepId),
			reason: 'an in-edge predecessor is not yet terminal'
		};
	if (!b.anySatisfied)
		return {
			ok: false,
			reason: 'every in-edge is neutralized — the step is unreachable (it should be pruned)'
		};
	return { ok: true };
}

// ── Propose-time graph well-formedness (DWP-01). A malformed transition graph must never reach ACTIVE. ──────────────

/** The minimal step read-model graph validation needs (id + stepType, for the BRANCH-default rule). */
export interface GraphValidationStep {
	readonly id: string;
	readonly stepType?: string;
}
export interface GraphValidationResult {
	readonly ok: boolean;
	readonly code?: string;
	readonly message?: string;
}

const invalid = (message: string): GraphValidationResult => ({
	ok: false,
	code: 'RPH_VALIDATION_SEMANTIC_FAILED',
	message
});

/** Depth-first cycle detection (white/gray/black colouring). Returns the offending edge `a→b`, or undefined for a DAG. */
function findCycle(
	stepIds: readonly string[],
	outEdges: ReadonlyMap<string, readonly GateTransition[]>
): string | undefined {
	const color = new Map<string, 0 | 1 | 2>(stepIds.map((id) => [id, 0]));
	const walk = (id: string): string | undefined => {
		color.set(id, 1);
		for (const e of outEdges.get(id) ?? []) {
			const t = e.targetStepId;
			if (t === undefined) continue;
			const c = color.get(t) ?? 0;
			if (c === 1) return `${id}→${t}`;
			if (c === 0) {
				const found = walk(t);
				if (found) return found;
			}
		}
		color.set(id, 2);
		return undefined;
	};
	for (const id of stepIds)
		if ((color.get(id) ?? 0) === 0) {
			const found = walk(id);
			if (found) return found;
		}
	return undefined;
}

/** (1) Every present source/target stepId resolves to a declared step (else dangling). */
function checkDanglingIds(
	transitions: readonly GateTransition[],
	idSet: ReadonlySet<string>
): GraphValidationResult | undefined {
	for (const t of transitions) {
		if (t.sourceStepId !== undefined && !idSet.has(t.sourceStepId))
			return invalid(
				`transition source step "${t.sourceStepId}" is not a declared step in the plan`
			);
		if (t.targetStepId !== undefined && !idSet.has(t.targetStepId))
			return invalid(
				`transition target step "${t.targetStepId}" is not a declared step in the plan`
			);
		// A HALF-EDGE (a source that reaches nothing) is contract-legal — the persisted shape makes both endpoints
		// optional — but meaningless, and it was INVISIBLE to every other limb here (adjacency requires both endpoints)
		// while still participating in runtime out-edge selection. Reject it rather than let the two planes disagree.
		// A missing SOURCE is legitimate: that is a plan-entry edge.
		if (t.targetStepId === undefined)
			return invalid(
				`transition from "${t.sourceStepId ?? '(entry)'}" declares no targetStepId — an edge that reaches no step is not a transition`
			);
	}
	return undefined;
}

/** Out-edges over REAL edges (both endpoints present), preserving authored (array) order.
 *  In-degree is no longer computed here: entries come from the shared `entryStepIds` (WP-3), so there is exactly
 *  one definition of "entry" in this module and the two planes cannot drift again. */
function buildAdjacency(
	stepIds: readonly string[],
	transitions: readonly GateTransition[]
): { outEdges: Map<string, GateTransition[]> } {
	const outEdges = new Map<string, GateTransition[]>(stepIds.map((id) => [id, []]));
	for (const t of transitions)
		if (t.sourceStepId !== undefined && t.targetStepId !== undefined)
			outEdges.get(t.sourceStepId)!.push(t);
	return { outEdges };
}

/** Steps NOT reachable from `entry` by forward edge-connectivity. */
function unreachableFrom(
	entry: string,
	stepIds: readonly string[],
	outEdges: ReadonlyMap<string, readonly GateTransition[]>
): string[] {
	const reachable = new Set<string>();
	const stack = [entry];
	while (stack.length) {
		const id = stack.pop()!;
		if (reachable.has(id)) continue;
		reachable.add(id);
		for (const e of outEdges.get(id) ?? [])
			if (e.targetStepId !== undefined) stack.push(e.targetStepId);
	}
	return stepIds.filter((id) => !reachable.has(id));
}

/**
 * (5) The BRANCH rules, which exist so that propose-time validation and the runtime gate cannot disagree about which
 * node is exclusive (DWP-07 — they did, and a PARALLEL_GROUP silently lost its arms):
 *   a. A CONDITIONAL out-edge may leave ONLY a BRANCH step. Guarded arms on a non-BRANCH node are independent filters
 *      at runtime, which is a different semantics; forbidding the mix keeps one meaning per shape.
 *   b. A BRANCH step has ≥1 out-edge and EXACTLY ONE unconditional edge, which must be LAST. First-match returns on the
 *      first unconditional edge it meets, so an earlier default would make every later conditional arm dead — which the
 *      old "last edge is unconditional" test permitted.
 */
function checkBranchDefaults(
	steps: readonly GraphValidationStep[],
	outEdges: ReadonlyMap<string, readonly GateTransition[]>
): GraphValidationResult | undefined {
	const isDefaultEdge = (e: GateTransition): boolean =>
		e.conditionExpression === undefined && e.transitionType !== 'CONDITIONAL';
	for (const s of steps) {
		const outs = outEdges.get(s.id) ?? [];
		if (s.stepType !== 'BRANCH') {
			if (outs.some(isConditionalEdge))
				return invalid(
					`step "${s.id}" declares a CONDITIONAL out-edge but its stepType is "${s.stepType ?? 'unset'}", not BRANCH — exclusive guarded selection belongs to a BRANCH step (retype the step, or make the edge SEQUENTIAL)`
				);
			continue;
		}
		if (outs.length === 0) return invalid(`BRANCH step "${s.id}" has no out-edges`);
		const defaults = outs.filter(isDefaultEdge);
		if (defaults.length === 0)
			return invalid(
				`BRANCH step "${s.id}" must declare an unconditional SEQUENTIAL default as its LAST out-edge (so branch first-match always resolves)`
			);
		if (defaults.length > 1)
			return invalid(
				`BRANCH step "${s.id}" declares ${defaults.length} unconditional out-edges; exactly one is permitted (first-match returns on the first, so the rest would be unreachable)`
			);
		if (!isDefaultEdge(outs.at(-1)!))
			return invalid(
				`BRANCH step "${s.id}" must declare its unconditional SEQUENTIAL default as its LAST out-edge (an earlier default makes every conditional arm after it unreachable)`
			);
	}
	return undefined;
}

/** The exactly-one-entry message, built without a nested template. */
function entryCountMessage(entries: readonly string[]): string {
	const detail = entries.length ? `: ${entries.join(', ')}` : '';
	return `a transition graph must have exactly one entry step (a step with no in-edges); found ${entries.length}${detail}`;
}

/**
 * Validate a plan's transition graph at propose-time (DWP-01). A NO-OP for the linear plan (empty transitions[]).
 * For a graph plan every limb is enforced (EP-TST-5 — each has a rejection test): (1) dangling source/target ids;
 * (2) exactly ONE entry (a step with no in-edges); (3) every step reachable from the entry by edge-connectivity
 * (conditional/branch targets pass — edge-reachable even if only conditionally taken); (4) the graph is a DAG (no
 * cycle — else the frontier is empty forever); (5) a BRANCH step has an unconditional SEQUENTIAL default as its LAST
 * out-edge (so first-match always resolves — DWP-03/D3). Pure.
 */
export function validateTransitionGraph(
	steps: readonly GraphValidationStep[],
	transitions: readonly GateTransition[]
): GraphValidationResult {
	if (transitions.length === 0) return { ok: true }; // linear plan — no graph to validate
	const stepIds = steps.map((s) => s.id);

	const dangling = checkDanglingIds(transitions, new Set(stepIds));
	if (dangling) return dangling;

	const { outEdges } = buildAdjacency(stepIds, transitions);

	// The SAME `entryStepIds` the runtime BFS seeds from (WP-3) — previously this plane counted in-degree over
	// both-endpoint edges while the runtime counted every in-edge, and a plan-entry edge fell into the gap.
	const entries = entryStepIds(steps, transitions);
	if (entries.length !== 1) return invalid(entryCountMessage(entries));

	const unreachable = unreachableFrom(entries[0]!, stepIds, outEdges);
	if (unreachable.length)
		return invalid(`step(s) unreachable from the entry "${entries[0]}": ${unreachable.join(', ')}`);

	const cycle = findCycle(stepIds, outEdges);
	if (cycle) return invalid(`the transition graph must be acyclic; found a cycle at ${cycle}`);

	return checkBranchDefaults(steps, outEdges) ?? { ok: true };
}
