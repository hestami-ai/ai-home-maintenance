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
	const src = stateOf(plan, edge.sourceStepId);
	if (src === undefined) return 'PENDING'; // dangling (rejected at propose) — conservative
	if (!TERMINAL.has(src)) return 'PENDING'; // source not yet done
	// Source is terminal. A terminal-non-success source neutralizes the edge regardless of guard.
	if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';
	// Terminal-success source: an unconditional (SEQUENTIAL / no condition) edge is satisfied; a conditional edge
	// depends on its guard (DWP-02/03). With no evaluator (DWP-01) a guarded edge is NEUTRALIZED.
	const isConditional = edge.conditionExpression !== undefined || edge.transitionType === 'CONDITIONAL';
	if (!isConditional) return 'SATISFIED';
	return evaluateGuard?.(edge, plan) ? 'SATISFIED' : 'NEUTRALIZED';
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
 * graph yields a singleton; a fan-out (diamond) can yield several (the set frontier PARALLEL_GROUP later drives).
 */
export function startableStepIds(plan: GatePlan, evaluateGuard?: EdgeGuardEvaluator): string[] {
	if (plan.status !== 'ACTIVE') return [];
	if ((plan.transitions ?? []).length === 0) {
		const f = linearFrontier(plan);
		return f === undefined ? [] : [f];
	}
	return plan.steps.filter((s) => stepAtFrontier(plan, s, evaluateGuard)).map((s) => s.id);
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

/** (5) A BRANCH step has ≥1 out-edge and its LAST out-edge (array order) is an unconditional SEQUENTIAL default. */
function checkBranchDefaults(
	steps: readonly GraphValidationStep[],
	outEdges: ReadonlyMap<string, readonly GateTransition[]>
): GraphValidationResult | undefined {
	for (const s of steps) {
		if (s.stepType !== 'BRANCH') continue;
		const outs = outEdges.get(s.id) ?? [];
		const last = outs.at(-1);
		if (last === undefined) return invalid(`BRANCH step "${s.id}" has no out-edges`);
		const lastIsDefault = last.conditionExpression === undefined && last.transitionType !== 'CONDITIONAL';
		if (!lastIsDefault)
			return invalid(
				`BRANCH step "${s.id}" must declare an unconditional SEQUENTIAL default as its LAST out-edge (so branch first-match always resolves)`
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
