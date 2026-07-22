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
	/** Set when this step reached SKIPPED via PruneExecutionStep rather than a user waiver (DWP-07). The stepState
	 *  machine has no PRUNED state (its 10 values are ratified), and SKIPPED is deliberately terminal-SUCCESS so a
	 *  waived skip lets the plan continue — but a PRUNED step is DEAD, and its out-edges must NOT satisfy anything
	 *  downstream. Without this discriminator the gate cannot tell "waived, carry on" from "excluded, stop", and
	 *  pruning one step resurrects the rest of the arm it belonged to. */
	readonly prunedAsUnreachable?: boolean;
}
/** The minimal transition (edge) read-model the gate needs. `conditionExpression` is opaque here (DWP-02 evaluates). */
export interface GateTransition {
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

const stateOf = (plan: GatePlan, stepId: string | undefined): string | undefined =>
	stepId === undefined ? undefined : plan.steps.find((s) => s.id === stepId)?.stepState;

/** The in-edges of a step = transitions whose targetStepId is this step. */
const inEdgesOf = (plan: GatePlan, stepId: string): readonly GateTransition[] =>
	(plan.transitions ?? []).filter((t) => t.targetStepId === stepId);

/** The out-edges of a step, in authored (array) order — which IS the branch first-match order. A half-edge (a source
 *  with NO target) is excluded: it reaches nothing, so it must not participate in selection. Filtering on source alone
 *  let such an edge win first-match and neutralize every real arm, while validateTransitionGraph's adjacency (which
 *  requires both endpoints) never saw it — the two disagreed and the plan deadlocked. Propose now rejects half-edges
 *  outright; this filter keeps the runtime safe for any that predate that rule. */
const outEdgesOf = (plan: GatePlan, stepId: string): readonly GateTransition[] =>
	(plan.transitions ?? []).filter((t) => t.sourceStepId === stepId && t.targetStepId !== undefined);

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
	outEdges: readonly GateTransition[],
	plan: GatePlan,
	evaluateGuard?: EdgeGuardEvaluator
): GateTransition | undefined {
	for (const e of outEdges) {
		if (!isConditionalEdge(e)) return e; // an unconditional edge (the SEQUENTIAL default) always matches
		if (evaluateGuard?.(e, plan)) return e; // the first true conditional
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
	if (edge.sourceStepId === undefined) return 'SATISFIED'; // a plan-entry edge is always satisfied
	const source = plan.steps.find((s) => s.id === edge.sourceStepId);
	if (source === undefined) return 'PENDING'; // dangling (rejected at propose) — conservative
	const src = source.stepState;
	if (!TERMINAL.has(src)) return 'PENDING'; // source not yet done
	// A PRUNED source is DEAD, not done: it reached SKIPPED only because the plan's own branch logic excluded it, so it
	// satisfies nothing downstream. Checked BEFORE the terminal-success test precisely because SKIPPED is in that set —
	// conflating the two is what let a single prune resurrect the rest of its arm (DWP-07).
	if (source.prunedAsUnreachable === true) return 'NEUTRALIZED';
	// A terminal-non-success source (FAILED/CANCELLED/SUPERSEDED) neutralizes the edge regardless of guard, so a barrier
	// JOIN does not wedge behind a failed arm (D7). NOTE: this is NOT the same as "the plan excluded this path" — see
	// isDeadForPruning, which deliberately does not treat it as grounds to prune.
	if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';
	const outEdges = outEdgesOf(plan, edge.sourceStepId);
	// EXCLUSIVE first-match belongs to a BRANCH node and to nothing else (D2: a BRANCH is a stepType; parallelism is
	// topology). Keying this on "the source has ≥1 conditional out-edge" instead made every node with one guarded arm an
	// exclusive branch — so a PARALLEL_GROUP fan-out mixing a guarded arm with unconditional ones silently lost every arm
	// but the first match, while propose-time validation (keyed on stepType) never looked. The two planes now agree, and
	// validateTransitionGraph additionally REFUSES a conditional out-edge from a non-BRANCH step so they cannot drift.
	if (source.stepType === 'BRANCH' && outEdges.some(isConditionalEdge))
		return selectBranchEdge(outEdges, plan, evaluateGuard) === edge ? 'SATISFIED' : 'NEUTRALIZED';
	// Non-BRANCH source: out-edges are INDEPENDENT. An unconditional edge is taken; a guarded one is taken iff it holds.
	if (!isConditionalEdge(edge)) return 'SATISFIED';
	return evaluateGuard?.(edge, plan) === true ? 'SATISFIED' : 'NEUTRALIZED';
}

/**
 * Is this in-edge dead for PRUNING purposes — i.e. did the plan's own declared logic EXCLUDE this path?
 *
 * Deliberately narrower than `NEUTRALIZED`. The barrier-join treats a FAILED/CANCELLED source as neutralized so a join
 * cannot wedge behind a failed arm, but a FAILED step is RETRYABLE (FAILED→QUEUED): its downstream is not dead, it is
 * waiting on a decision. Pruning on that basis let a transient failure offer the whole downstream for prune-to-SKIPPED
 * — laundering a failed plan into a completable one. Only branch non-selection (or a source that is itself pruned)
 * counts as exclusion.
 */
function isDeadForPruning(
	plan: GatePlan,
	edge: GateTransition,
	evaluateGuard?: EdgeGuardEvaluator
): boolean {
	if (edge.sourceStepId === undefined) return false; // a plan-entry edge is never dead
	const source = plan.steps.find((s) => s.id === edge.sourceStepId);
	if (source === undefined) return false;
	if (source.prunedAsUnreachable === true) return true; // the source was itself excluded
	if (!TERMINAL_SUCCESS.has(source.stepState)) return false; // unfinished, failed or cancelled ⇒ not an exclusion
	return inEdgeDisposition(plan, edge, evaluateGuard) === 'NEUTRALIZED';
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
function barrierState(
	plan: GatePlan,
	inEdges: readonly GateTransition[],
	evaluateGuard?: EdgeGuardEvaluator
): BarrierState {
	let anyPending = false;
	let anySatisfied = false;
	let firstPending: GateTransition | undefined;
	for (const e of inEdges) {
		const d = inEdgeDisposition(plan, e, evaluateGuard);
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
function stepAtFrontier(plan: GatePlan, step: GateStep, evaluateGuard?: EdgeGuardEvaluator): boolean {
	if (TERMINAL.has(step.stepState)) return false; // already done/failed
	const inEdges = inEdgesOf(plan, step.id);
	if (inEdges.length === 0) return true; // entry step
	const b = barrierState(plan, inEdges, evaluateGuard);
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
	return plan.steps.filter((s) => stepAtFrontier(plan, s, evaluateGuard)).map((s) => s.id);
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
	const prunable = new Set<string>();
	let changed = true;
	while (changed) {
		changed = false;
		for (const s of plan.steps) {
			if (prunable.has(s.id) || TERMINAL.has(s.stepState)) continue;
			const inEdges = inEdgesOf(plan, s.id);
			if (inEdges.length === 0) continue; // an entry step is never prunable
			const allDead = inEdges.every(
				(e) =>
					(e.sourceStepId !== undefined && prunable.has(e.sourceStepId)) ||
					isDeadForPruning(plan, e, evaluateGuard)
			);
			if (allDead) {
				prunable.add(s.id);
				changed = true;
			}
		}
	}
	return [...prunable];
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
	const target = plan.steps.find((s) => s.id === stepId);
	if (target === undefined)
		return { ok: false, reason: `step ${stepId} is not declared in this plan` };
	if (TERMINAL.has(target.stepState))
		return { ok: false, blockerStepId: stepId, blockerState: target.stepState, reason: 'the step is already terminal' };
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
	const inEdges = inEdgesOf(plan, stepId);
	if (inEdges.length === 0) return { ok: true }; // entry step
	const b = barrierState(plan, inEdges, evaluateGuard);
	if (b.firstPending)
		return {
			ok: false,
			blockerStepId: b.firstPending.sourceStepId,
			blockerState: stateOf(plan, b.firstPending.sourceStepId),
			reason: 'an in-edge predecessor is not yet terminal'
		};
	if (!b.anySatisfied)
		return { ok: false, reason: 'every in-edge is neutralized — the step is unreachable (it should be pruned)' };
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
	for (const id of stepIds) if ((color.get(id) ?? 0) === 0) {
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
			return invalid(`transition source step "${t.sourceStepId}" is not a declared step in the plan`);
		if (t.targetStepId !== undefined && !idSet.has(t.targetStepId))
			return invalid(`transition target step "${t.targetStepId}" is not a declared step in the plan`);
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

/** In-degree + out-edges over REAL edges (both endpoints present), preserving authored (array) order for out-edges. */
function buildAdjacency(
	stepIds: readonly string[],
	transitions: readonly GateTransition[]
): { inCount: Map<string, number>; outEdges: Map<string, GateTransition[]> } {
	const inCount = new Map<string, number>(stepIds.map((id) => [id, 0]));
	const outEdges = new Map<string, GateTransition[]>(stepIds.map((id) => [id, []]));
	for (const t of transitions) {
		if (t.sourceStepId !== undefined && t.targetStepId !== undefined) {
			inCount.set(t.targetStepId, (inCount.get(t.targetStepId) ?? 0) + 1);
			outEdges.get(t.sourceStepId)!.push(t);
		}
	}
	return { inCount, outEdges };
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
		for (const e of outEdges.get(id) ?? []) if (e.targetStepId !== undefined) stack.push(e.targetStepId);
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

	const { inCount, outEdges } = buildAdjacency(stepIds, transitions);

	const entries = stepIds.filter((id) => (inCount.get(id) ?? 0) === 0);
	if (entries.length !== 1) return invalid(entryCountMessage(entries));

	const unreachable = unreachableFrom(entries[0]!, stepIds, outEdges);
	if (unreachable.length)
		return invalid(`step(s) unreachable from the entry "${entries[0]}": ${unreachable.join(', ')}`);

	const cycle = findCycle(stepIds, outEdges);
	if (cycle) return invalid(`the transition graph must be acyclic; found a cycle at ${cycle}`);

	return checkBranchDefaults(steps, outEdges) ?? { ok: true };
}
