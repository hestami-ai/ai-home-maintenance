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
/**
 * A terminal state the machine CAN leave — so a source sitting there has NOT settled (JAN-EXECREM WP-4).
 *
 * Derived from the ExecutionStep.stepState machine, not chosen: FAILED is the ONLY terminal state with an
 * out-arrow (FAILED -> QUEUED, retryExecutionStep). SUCCEEDED, SKIPPED, CANCELLED and SUPERSEDED have none.
 * `transition-gate-disposition.test.ts` pins this against the generated machine, so adding an out-arrow to a
 * terminal state fails a test instead of silently changing what a barrier means.
 */
const REOPENABLE_TERMINAL = new Set<string>(['FAILED']);

/**
 * A terminal state the machine can NEVER leave, and which is not a success — so an edge out of it can never
 * conduct, and its downstream is structurally dead (JAN-EXECREM WP-4 / F-06).
 */
const IRRECOVERABLE_TERMINAL = new Set<string>(['CANCELLED', 'SUPERSEDED']);

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
	/**
	 * For a SETTLED BRANCH: the id of the out-edge it actually selected, recorded at the instant it reached
	 * terminal-success (DWP-09; written by every settling command since JAN-EXECREM WP-10).
	 *
	 * Absent on a settled BRANCH ⇒ UNRESOLVED, never "re-derive it". The gate used to fall back to a fresh
	 * first-match evaluation, which is how an already-settled branch silently re-resolved and ran BOTH arms
	 * (F-15/21/23): the condition subject does not stand still, so a re-derived answer can contradict what the
	 * plan already did. See `branchVerdict`.
	 */
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

/**
 * The four answers to "can this in-edge still conduct?" (JAN-EXECREM WP-10 widened it from three).
 *
 * UNRESOLVED is the honest fourth: the edge leaves a BRANCH that has SETTLED without recording which arm it chose.
 * That is not "not taken" and not "taken" — it is a MISSING FACT, and the previous three-valued type had nowhere to
 * put it, so the gate invented an answer by re-running first-match on every read. `SATISFIED | NEUTRALIZED` are the
 * two answers a DECIDED branch gives; UNRESOLVED is what an undecided one gives, and it fails closed in BOTH
 * directions (see `startStepGate` and `prunableStepIds`).
 */
export type InEdgeDisposition = 'SATISFIED' | 'NEUTRALIZED' | 'PENDING' | 'UNRESOLVED';

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
	/** The EFFECTIVE disposition of one in-edge (stage 2), memoized on edge identity. */
	dispositionOf(edge: GateTransition): InEdgeDisposition;
	/**
	 * The LOCAL disposition of one edge (stage 1), memoized on edge identity.
	 *
	 * Memoized because it is reached by TWO paths — directly, and again from inside the reachability BFS — so an
	 * un-memoized rung 8 evaluates the caller's guard twice per edge. That doubling was previously invisible: the
	 * only fixture exercising rung 8 went through a BRANCH, whose own `selectionOf` memo absorbed the second call.
	 * WP-10 deleted that memo along with the re-derivation it bounded, which is how the doubling surfaced.
	 */
	localOf(edge: GateTransition): InEdgeDisposition;
	// WP-2 also carried a THIRD memo, `selectionOf`, keyed on the BRANCH source. It bounded the guard-evaluator call
	// count for `selectBranchEdge`, which scanned a source's out-edges calling the evaluator until one matched — so
	// running it once per in-edge of a width-N fan-out was N x N calls. WP-10 DELETED that scan (a settled BRANCH's
	// arm is now READ from its recorded decision, never re-derived), so the memo bounded something that no longer
	// exists. It is removed rather than left as a Map lookup over a `find`: the only guard evaluations remaining on
	// this path are rung 8's, already bounded once per edge by `dispositionOf`.
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
	const localMemo = new Map<GateTransition, InEdgeDisposition>();
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
		localOf: (edge) => {
			let d = localMemo.get(edge);
			if (d === undefined) {
				d = localEdgeDisposition(ctx, edge);
				localMemo.set(edge, d);
			}
			return d;
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
		if (t.sourceStepId !== undefined && t.targetStepId !== undefined)
			hasRealSourceInEdge.add(t.targetStepId);
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
 * Does this step REQUIRE a branch decision — i.e. is it a BRANCH with at least one guarded out-edge?
 *
 * ONE predicate, used by BOTH planes (JAN-EXECREM WP-10 / CANONICAL RULE B2): the WRITE path asks it to decide
 * whether a settling command must take and record a decision, and the READ path (`branchVerdict`) asks it to
 * decide whether a missing decision is a defect or simply not applicable. Two separately-maintained answers to
 * "is this an exclusive branch?" is the shape that produced this family — a node the writer thought ordinary and
 * the reader thought exclusive settles with no decision, and the reader then invents one.
 */
export function branchRequiresDecision(plan: GatePlan, stepId: string): boolean {
	const ctx = gateContext(plan);
	const step = ctx.stepById.get(stepId);
	if (step?.stepType !== 'BRANCH') return false;
	return outEdgesOf(ctx, stepId).some(isConditionalEdge);
}

/**
 * The three-valued answer to "which arm did this BRANCH take?" (CANONICAL RULE B3 — never invent a decision).
 *
 *   NOT_A_BRANCH — the source is not an exclusive branch; its out-edges are independent.
 *   DECIDED      — a recorded selection resolves to one of its out-edges. That is history, not a computation.
 *   UNRESOLVED   — it settled without recording, or the recorded id names no out-edge (an incoherent plan).
 *
 * WHAT THIS DELETES, AND WHY IT MATTERS. The previous form fell back to a FRESH first-match evaluation whenever no
 * decision was recorded, which conflated "decided otherwise" with "never decided" and — worse — made "never
 * decided" produce a *plausible* answer that CHANGES OVER TIME. A step reachable only through a not-taken edge can
 * still change state, and an ATTEMPTS or STEP_STATE guard over it flips; so a BRANCH settled by Skip (which
 * recorded nothing) re-resolved on every read, and both arms ran. Deleting the fallback is what makes the missing
 * fact VISIBLE instead of papered over.
 *
 * After this, the condition grammar is evaluated for a BRANCH at exactly ONE site in the whole system —
 * `resolveBranchSelection`, on the write path, once per branch, at settlement.
 */
type BranchVerdict =
	| { readonly kind: 'NOT_A_BRANCH' }
	| { readonly kind: 'DECIDED'; readonly edge: GateTransition }
	| {
			readonly kind: 'UNRESOLVED';
			readonly why: 'NO_RECORDED_DECISION' | 'RECORDED_EDGE_NOT_FOUND';
	  };

const NOT_A_BRANCH: BranchVerdict = { kind: 'NOT_A_BRANCH' };

/**
 * Is `edge` the arm the branch selected? Compared BY ID, because the decision is recorded as an id.
 *
 * This used to be an object-identity test (`selected === edge`), which made every public entry point that accepts
 * an edge — `inEdgeDisposition(plan, edge, ...)` — silently wrong for a CLONED edge: it would read NEUTRALIZED with
 * no type error and no failure outside a branch fixture. `execution-view.test.ts` carried a test named for exactly
 * that trap. Comparing the recorded id to the edge's own id removes the hazard rather than guarding it.
 *
 * Identity remains the fallback for an edge carrying no id at all, which is the only case where ids cannot answer.
 */
function edgeIsSelected(edge: GateTransition, selected: GateTransition): boolean {
	return edge.id !== undefined && selected.id !== undefined
		? edge.id === selected.id
		: edge === selected;
}

function branchVerdict(
	ctx: GateContext,
	source: GateStep,
	outEdges: readonly GateTransition[]
): BranchVerdict {
	// EXCLUSIVE first-match belongs to a BRANCH node and to nothing else (D2: a BRANCH is a stepType; parallelism is
	// topology). Keying this on "the source has >= 1 conditional out-edge" instead made every node with one guarded
	// arm an exclusive branch, so a PARALLEL_GROUP fan-out mixing a guarded arm with unconditional ones silently lost
	// every arm but the first match.
	if (source.stepType !== 'BRANCH' || !outEdges.some(isConditionalEdge)) return NOT_A_BRANCH;
	const recorded = source.selectedTransitionId;
	if (recorded === undefined) return { kind: 'UNRESOLVED', why: 'NO_RECORDED_DECISION' };
	const edge = outEdges.find((e) => e.id === recorded);
	return edge === undefined
		? { kind: 'UNRESOLVED', why: 'RECORDED_EDGE_NOT_FOUND' }
		: { kind: 'DECIDED', edge };
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
			// The edge carries reachability unless it can NEVER conduct. Using the LOCAL disposition (which does not
			// consult liveness) keeps this a plain O(V+E) walk rather than a mutual recursion.
			//
			// UNRESOLVED deliberately carries reachability (WP-10). The two planes answer an undecided BRANCH
			// ASYMMETRICALLY and that asymmetry is the fail-closed direction: the arm is NOT startable (the barrier
			// needs a SATISFIED edge) but IS still live, so it is NOT prunable. A symmetric "exclude everything"
			// would hand the whole downstream to a waiver-free prune — the §21.1 back door, and the same damage
			// shape as F-03/F-04. A prune may never be justified by a decision that was never taken.
			if (ctx.localOf(e) !== 'NEUTRALIZED') frontier.push(e.targetStepId);
		}
	}
	return live;
}

/**
 * The LOCAL disposition of one in-edge (JAN-EXECREM WP-4 / SM-1) — stage 1 of the canonical answer to ONE question:
 * **can this edge still conduct?**
 *
 *   SATISFIED   = it HAS conducted, and cannot un-conduct.
 *   PENDING     = it has not conducted and MAY still.
 *   NEUTRALIZED = it has not conducted and NEVER will.
 *
 * "Local" means it reads only the edge, its source's own state, that source's stepType/out-edges, and the guard —
 * never liveness. That restriction is what lets the reachability BFS use it without recursing into itself.
 *
 * WHAT THIS REPLACES, AND WHY (the root cause of F-06/F-16/F-17/F-20/F-38). The same question previously had THREE
 * independently-maintained answers — `inEdgeDisposition` (the barrier's), `branchExcludes` (reachability's), and the
 * entry-degree disagreement fixed in WP-3 — and each new way an edge could die was taught to only one of them.
 * `branchExcludes` in particular knew about exactly ONE thing (a resolved BRANCH not selecting this arm) and
 * returned false for everything else, so:
 *   - a CANCELLED/SUPERSEDED source left its downstream LIVE forever, and the only exit — a waiver-skip — RESURRECTED
 *     the arm (F-06, the THIRD recurrence of that class); and
 *   - the barrier called a FAILED source NEUTRALIZED, so a JOIN released on a failed arm and the plan could reach
 *     COMPLETED with a step that never succeeded (F-16).
 * Both now fall out of one ladder rather than being patched into one of three.
 */
function localEdgeDisposition(ctx: GateContext, edge: GateTransition): InEdgeDisposition {
	// 1. A plan-entry edge: the plan itself grounds it.
	if (edge.sourceStepId === undefined) return 'SATISFIED';
	const source = stepOf(ctx, edge.sourceStepId);
	// 2. Dangling (refused at propose) — conservative: it might yet resolve.
	if (source === undefined) return 'PENDING';
	const src = source.stepState;
	// 3. The source has not finished.
	if (!TERMINAL.has(src)) return 'PENDING';
	// 4. The source is in a terminal state the machine CAN leave (FAILED -> QUEUED). It has not settled, so the edge
	//    has not settled either. This is the F-16 correction: calling it NEUTRALIZED let a JOIN release on a failed
	//    arm. A join now waits until the arm is retried to success or explicitly abandoned (WP-5's Cancel).
	if (REOPENABLE_TERMINAL.has(src)) return 'PENDING';
	// 5. The source is irrecoverably terminal (CANCELLED/SUPERSEDED): the edge can never conduct. This is the F-06
	//    correction — reachability previously ignored this case entirely.
	if (IRRECOVERABLE_TERMINAL.has(src)) return 'NEUTRALIZED';
	// 6. The BRANCH rung — now three-valued (WP-10). A DECIDED branch answers exactly as before; an UNDECIDED one no
	//    longer gets a re-derived answer invented for it.
	const outEdges = outEdgesOf(ctx, edge.sourceStepId);
	const verdict = branchVerdict(ctx, source, outEdges);
	if (verdict.kind === 'DECIDED')
		return edgeIsSelected(edge, verdict.edge) ? 'SATISFIED' : 'NEUTRALIZED';
	if (verdict.kind === 'UNRESOLVED') return 'UNRESOLVED';
	// 7. Non-BRANCH source: out-edges are INDEPENDENT. An unconditional edge is taken.
	if (!isConditionalEdge(edge)) return 'SATISFIED';
	// 8. A guarded edge off a settled non-BRANCH source is taken iff its guard holds.
	return ctx.evaluateGuard?.(edge, ctx.plan) === true ? 'SATISFIED' : 'NEUTRALIZED';
}
/**
 * BRANCH first-match (DWP-03/D3) — THE ACT OF DECIDING, and after WP-10 the ONLY place in the system where the
 * condition grammar is evaluated for a BRANCH.
 *
 * Among the source's out-edges in authored (array) order: the FIRST CONDITIONAL edge whose guard is true, else the
 * first unconditional (SEQUENTIAL default) — so exactly ONE arm is ever selected. Returns undefined for a
 * non-BRANCH step, a step with no guarded out-edge, or a malformed branch where no conditional guard holds and no
 * unconditional default exists (propose-time validation forbids that last case by requiring a default).
 *
 * Deliberately ignores any ALREADY-recorded selection — this function IS the decision; `branchVerdict` is how the
 * decision is later READ. The caller (`advanceStep`) is what refuses to re-decide a branch that already decided.
 * Its `plan` argument must be the SETTLEMENT VIEW (Rule B1): the plan as of the move being made, or the branch
 * cannot see its own result.
 */
export function resolveBranchSelection(
	plan: GatePlan,
	stepId: string,
	evaluateGuard?: EdgeGuardEvaluator
): string | undefined {
	if (!branchRequiresDecision(plan, stepId)) return undefined;
	const ctx = gateContext(plan, evaluateGuard);
	for (const e of outEdgesOf(ctx, stepId)) {
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

/**
 * The EFFECTIVE disposition (stage 2) = the local answer, overridden to NEUTRALIZED when the source is
 * STRUCTURALLY DEAD — unreachable from any entry, however it reached its own state.
 *
 * The override matters because SKIPPED is in TERMINAL_SUCCESS: a step on a not-taken arm is terminal-success
 * whether it was PRUNED or WAIVED away, so without this a waiver-skip on a dead arm reads "done, carry on" and
 * resurrects the arm. That is the defect class DWP-07 and DWP-08 each tried to close; keeping the override here,
 * one layer above a local ladder that cannot see liveness, is what makes it structural rather than command-keyed.
 */
function computeInEdgeDisposition(ctx: GateContext, edge: GateTransition): InEdgeDisposition {
	const local = ctx.localOf(edge);
	if (edge.sourceStepId === undefined) return local; // an entry edge has no source to be dead
	const source = stepOf(ctx, edge.sourceStepId);
	if (source === undefined) return local;
	// The override applies only to a source that has SETTLED. A structurally-dead source that is still non-terminal
	// keeps its PENDING answer ON PURPOSE: the join then WEDGES until the dead arm is explicitly pruned, which is the
	// governed workflow (the prune read-model names the arm, the controller clears it, the join releases). Silently
	// releasing the join around a dead-but-unfinished arm would let a plan complete while a step it declared is left
	// in limbo, with nothing in the record saying the arm was abandoned.
	//
	// For a source that HAS settled, deadness wins however it got there — which is the whole point. SKIPPED is in
	// TERMINAL_SUCCESS, so a step on a not-taken arm is terminal-success whether it was PRUNED or WAIVED away; without
	// this override a waiver-skip reads "done, carry on" and RESURRECTS the arm. That is the class DWP-07 and DWP-08
	// each tried to close by keying on which command drove the step; keying on structure instead is what makes it
	// closed. It also stops a dead FAILED arm wedging a join forever: FAILED is PENDING while live, NEUTRALIZED once
	// the arm is structurally dead.
	if (!TERMINAL.has(source.stepState)) return local;
	return ctx.live().has(edge.sourceStepId) ? local : 'NEUTRALIZED';
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
	/** The first in-edge off an UNDECIDED settled BRANCH (WP-10), so the gate can name the real blocker. */
	readonly firstUnresolved?: GateTransition;
}
function barrierState(ctx: GateContext, inEdges: readonly GateTransition[]): BarrierState {
	let anyPending = false;
	let anySatisfied = false;
	let firstPending: GateTransition | undefined;
	let firstUnresolved: GateTransition | undefined;
	for (const e of inEdges) {
		const d = ctx.dispositionOf(e);
		if (d === 'PENDING') {
			anyPending = true;
			firstPending ??= e;
		} else if (d === 'SATISFIED') {
			anySatisfied = true;
		} else if (d === 'UNRESOLVED') {
			// Neither pending nor satisfied — so `stepAtFrontier`'s `!anyPending && anySatisfied` already returns
			// false and the arm is correctly NOT startable. This field exists only so the AUTHORITY can say WHY.
			firstUnresolved ??= e;
		}
	}
	return { anyPending, anySatisfied, firstPending, firstUnresolved };
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
	// FAIL CLOSED on an incoherent graph — the floor its two siblings (`prunableStepIds`, `startStepGate`) have
	// always had, and which this function was missing.
	//
	// JAN-REVREM RW-4. The previous work package DECLINED to add this, arguing the guard could never change the
	// answer: no entry ⇒ empty live set ⇒ every real-source edge NEUTRALIZED ⇒ no step SATISFIED. That argument
	// was WRONG, and the error was one variable. A source-less (plan-entry) edge returns SATISFIED unconditionally
	// — it never consults liveness — so a step needs only ONE such edge plus no PENDING real-source edge. And a
	// real-source edge off a CANCELLED or SUPERSEDED step is IRRECOVERABLE_TERMINAL ⇒ NEUTRALIZED, which is not
	// PENDING and therefore does not block the barrier.
	//
	//   steps [s1 QUEUED, s2 CANCELLED]; edges [(→s1), (s2→s1), (s1→s2)]
	//   ⇒ entryStepIds [] (incoherent) · startableStepIds ['s1'] · startStepGate(s1) REFUSES
	//
	// The read-model offered a Start the engine rejects: the F-29 / F-11 invariant, in the sibling function the
	// affordance work never reached. Reachable in stored history (propose-time refuses these graphs, which is why
	// the floor exists at all) by cancelling one arm — Cancel is CLEANUP_EXEMPT, so it is accepted on any plan.
	if (graphIsIncoherent(plan)) return [];
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

/**
 * Which BRANCH decision excluded a step, which arm it TOOK, and which arm was CUT.
 *
 * Three distinct facts, and the event declares a field for each. `selectedEdgeId` is the arm the branch chose
 * (DS-004 D5: "pruned: BRANCH <stepId> selected edge <edgeId>"); `excludedEdgeId` is the arm this step hangs off,
 * which is what actually cut it. On a two-armed branch they are complementary; on a wider one they are not, and
 * an auditor needs both to reconstruct the decision from the stream alone.
 */
export interface BranchDecisionProvenance {
	/** WHY: a settled BRANCH's recorded decision excluded this step. */
	readonly cause: 'BRANCH_DECISION';
	/** The settled BRANCH whose recorded decision cut this step off. */
	readonly branchStepId: string;
	/** The out-edge that BRANCH actually selected — its recorded decision. */
	readonly selectedEdgeId?: string;
	/** The not-taken out-edge on whose subgraph this step sits — the CUT. */
	readonly excludedEdgeId?: string;
}

/**
 * WHY: a predecessor reached an IRRECOVERABLE terminal state and can therefore never conduct, so everything below it
 * is structurally dead (JAN-REVREM RW-7 / finding N-8).
 *
 * THIS ARM DID NOT EXIST, and its absence was the finding. `pruneProvenance` bailed on any non-BRANCH source, so
 * pruning a step below a CANCELLED predecessor emitted `{ stepId, stepState: 'SKIPPED' }` and nothing else —
 * byte-identical in CONTENT to a waived skip, which is exactly the conflation DR-004 §19-M1 minted a distinct event
 * to prevent. The walk was not wrong; the vocabulary it had to speak in could not express what happened.
 *
 * The header claim that this case is "unreachable through an authorable plan" was FALSE:
 * `transition-gate-disposition.test.ts` builds `s1 → s2(CANCELLED) → s3` and asserts the prune IS offered. The
 * fixture proving reachability and the comment denying it were in the same package.
 */
export interface DeadPredecessorProvenance {
	readonly cause: 'DEAD_PREDECESSOR';
	/** The predecessor that can never conduct — CANCELLED or SUPERSEDED. */
	readonly deadStepId: string;
	/** WHICH irrecoverable terminal state killed the arm. Carried because it is the auditor's next question, and the
	 *  gate holds it at the moment it decides — recovering it later means replaying the stream to find out. */
	readonly deadStepState: string;
	/** The in-edge off that dead predecessor — the CUT. */
	readonly excludedEdgeId?: string;
}

/**
 * DISCRIMINATED BY CAUSE (RW-7 / DS-001 §6c R10), because the two cuts are not the same fact wearing different
 * fields. A branch cut has a decision and a taken arm; a dead-predecessor cut has neither — it has a step that can
 * never conduct.
 *
 * REUSING `branchStepId` FOR THE DEAD PREDECESSOR WAS REJECTED, and that is the whole ruling. It is the cheap fix
 * and it makes the record LIE: a field named for a branch, read by every consumer as a branch, holding a step that
 * is not one. That is the `CLOSED_PWU_STATES` failure in record form — a name asserting something the value does not
 * honour — and it is worse here, because an event stream IS the audit trail and a misnamed field in it is
 * undetectable after the fact.
 */
export type PruneProvenance = BranchDecisionProvenance | DeadPredecessorProvenance;

/** The optional `excludedEdgeId` fragment shared by both provenance shapes — the in-edge off the cut, when it has an id. */
function excludedEdgeFragment(edge: GateTransition): { readonly excludedEdgeId?: string } {
	return edge.id === undefined ? {} : { excludedEdgeId: edge.id };
}

/** Build the BRANCH_DECISION provenance for a live BRANCH source whose recorded decision cut `edge`. */
function branchCutProvenance(
	source: string,
	step: GateStep,
	edge: GateTransition
): BranchDecisionProvenance {
	return {
		cause: 'BRANCH_DECISION',
		branchStepId: source,
		...(step.selectedTransitionId === undefined
			? {}
			: { selectedEdgeId: step.selectedTransitionId }),
		...excludedEdgeFragment(edge)
	};
}

/** Build the DEAD_PREDECESSOR provenance for a non-BRANCH source in an irrecoverable terminal state. */
function deadPredecessorCutProvenance(
	source: string,
	step: GateStep,
	edge: GateTransition
): DeadPredecessorProvenance {
	return {
		cause: 'DEAD_PREDECESSOR',
		deadStepId: source,
		deadStepState: step.stepState,
		...excludedEdgeFragment(edge)
	};
}

/**
 * What the `pruneProvenance` BFS must do with ONE in-edge of the current node:
 *   - `return`  — this edge IS the cut; stop the whole walk and emit its provenance.
 *   - `skip`    — this edge names no cause (next edge, the original `continue`).
 *   - `walk`    — the source is itself dead; keep walking back through the dead subgraph via `source`.
 */
type PruneEdgeAction =
	| { readonly kind: 'return'; readonly provenance: PruneProvenance }
	| { readonly kind: 'skip' }
	| { readonly kind: 'walk'; readonly source: string };

const PRUNE_EDGE_SKIP: PruneEdgeAction = { kind: 'skip' };

/**
 * Classify one in-edge of the node under inspection, PRESERVING the exact `continue` vs enqueue-source vs return
 * semantics of the original inline loop body.
 *
 * A live source with a dead target means this edge is a CUT. Attribute it only when the source actually DECIDED — a
 * PENDING source has excluded nothing yet, so naming a cause here would be a fabrication.
 *
 * BRANCH IS CHECKED FIRST, deliberately (RW-7): a CANCELLED **branch** still reports BRANCH_DECISION with its
 * recorded selection, because that is the more specific fact and the one an auditor can act on. Ordering it the other
 * way would silently downgrade every branch cut whose branch was later cancelled.
 *
 * THE STATE CHECK (`IRRECOVERABLE_TERMINAL`) IS NOT REDUNDANT with `localOf === 'NEUTRALIZED'`. `localOf` returning
 * NEUTRALIZED says the edge is DEAD; it does not say WHICH of two reasons killed it. Off a non-BRANCH source a
 * guard-false CONDITIONAL edge is ALSO neutralized — and that case must yield NO provenance, because off a non-BRANCH
 * step out-edges are INDEPENDENT filters rather than exclusive arms: the step is unreachable, but no DECISION
 * excluded it, and inventing one puts a false justification into the governed stream.
 * `transition-gate-prune-provenance.test.ts` pins exactly that. So the two questions are genuinely distinct and both
 * must be asked: `localOf` decides whether the edge can still conduct, and the state decides whether a step that can
 * never conduct is what killed it. That is one question each, not one question twice.
 */
function classifyPruneInEdge(
	ctx: GateContext,
	live: ReadonlySet<string>,
	edge: GateTransition
): PruneEdgeAction {
	const source = edge.sourceStepId;
	if (source === undefined) return PRUNE_EDGE_SKIP; // a plan-entry edge cuts nothing
	if (!live.has(source)) return { kind: 'walk', source }; // dead source — keep walking back through the dead subgraph
	if (ctx.localOf(edge) !== 'NEUTRALIZED') return PRUNE_EDGE_SKIP;
	const step = stepOf(ctx, source);
	if (step === undefined) return PRUNE_EDGE_SKIP;
	if (step.stepType === 'BRANCH')
		return { kind: 'return', provenance: branchCutProvenance(source, step, edge) };
	// THE ARM RW-7 ADDED (N-8). A non-BRANCH source whose edge is NEUTRALIZED reached an irrecoverable terminal state
	// — the ONLY way `localOf` returns NEUTRALIZED for a non-branch real source — so the subgraph below it is
	// structurally dead. This used to `continue`, walk off the end of the frontier and return undefined, leaving the
	// emitted event indistinguishable from a waived skip.
	if (IRRECOVERABLE_TERMINAL.has(step.stepState))
		return { kind: 'return', provenance: deadPredecessorCutProvenance(source, step, edge) };
	return PRUNE_EDGE_SKIP;
}

/**
 * WHY is `stepId` prunable — which branch decision excluded it, and through which edge (JAN-EXECREM WP-14 / F-37)?
 *
 * DERIVED from the same graph that AUTHORIZED the prune, never read from a caller. That is the whole point: the
 * event's prune-provenance is the sole justification DR-004 §19-M1 gave for minting `ExecutionStepPruned` instead
 * of reusing the waived-skip event ("do not conflate a system prune with a user waiver"), and it was never
 * populated by any producer — so the two events differed only by TYPE, not by CONTENT, and an auditor replaying
 * the stream could not tell which decision excluded the step.
 *
 * IT WALKS THE DEAD SUBGRAPH TO THE CUT, rather than reading the step's own in-edges. A pruned step is frequently
 * NOT adjacent to the branch: the not-taken arm's whole downstream prunes transitively, and those steps' in-edges
 * come from other DEAD steps, not from the BRANCH. Reading only the immediate in-edges would find provenance for
 * the first step of a dead arm and nothing for the rest.
 *
 * THE CUT is the first edge, walking back, that leaves a LIVE source and is NEUTRALIZED. Requiring the source to
 * be live is what stops a JOIN — still reachable via the taken arm — being mis-attributed as the cut.
 */
export function pruneProvenance(
	plan: GatePlan,
	stepId: string,
	evaluateGuard?: EdgeGuardEvaluator
): PruneProvenance | undefined {
	const ctx = gateContext(plan, evaluateGuard);
	const live = ctx.live();
	if (live.has(stepId)) return undefined; // still reachable — nothing cut it off
	const seen = new Set<string>([stepId]);
	const frontier = [stepId];
	while (frontier.length) {
		const id = frontier.shift()!;
		for (const edge of inEdgesOf(ctx, id)) {
			const action = classifyPruneInEdge(ctx, live, edge);
			if (action.kind === 'return') return action.provenance;
			if (action.kind === 'walk' && !seen.has(action.source)) {
				seen.add(action.source);
				frontier.push(action.source); // keep walking back through the dead subgraph
			}
		}
	}
	return undefined;
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
	// An UNRESOLVED in-edge is checked BEFORE the all-neutralized case, because the two demand opposite remedies and
	// the generic message would actively mislead: "it should be pruned" is exactly what must NOT happen here. This
	// arm is neither live nor prunable — §21.1 forbids a waiver-free prune justified by a decision nobody took.
	if (b.firstUnresolved)
		return {
			ok: false,
			blockerStepId: b.firstUnresolved.sourceStepId,
			blockerState: stateOf(ctx, b.firstUnresolved.sourceStepId),
			reason: `the BRANCH ${b.firstUnresolved.sourceStepId} reached terminal-success without recording which arm it selected — its arms are neither live nor prunable. Resolve it with an authorized plan revision or a waivered Skip (§21.1); the gate will not re-derive a decision that was never taken`
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
