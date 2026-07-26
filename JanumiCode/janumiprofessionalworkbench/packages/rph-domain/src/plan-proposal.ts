// Propose-time structural admissibility for an execution plan (JAN-EXECREM WP-6 / SM-4). Pure, deterministic.
//
// WHY THIS MODULE EXISTS. `ProposeExecutionPlan` is the ONLY writer of a plan's `steps[]`/`transitions[]` — the two
// later writes rewrite one existing element — so it is the single decision point for "is this plan structurally
// executable at all?". Yet it ran THREE ad-hoc validators, all transition-scoped, and the one structural validator
// (`validateTransitionGraph`) SHORT-CIRCUITS on `transitions.length === 0`. A LINEAR plan — the shape the reference
// seed and most suites use — therefore received NO step validation whatsoever. What got through:
//
//   F-10 (BLOCKER)  duplicate step ids. `advanceStep` resolves a step by `findIndex`, so the second one is
//                   unaddressable by ANY command: it can never start, never be skipped, never be pruned, and it
//                   blocks plan completion forever.
//   F-09 / F-27     an authored NOT_READY step. DS-004 says steps "rest QUEUED — a convention this design relies on
//                   and ENFORCES", and that was enforced nowhere. No command drives a step OUT of NOT_READY, and
//                   NOT_READY is not terminal, so such a step is a permanent deadlock.
//   F-33            an edge tagged CONDITIONAL with no conditionExpression — a permanently dead BRANCH arm, since
//                   first-match can never select it and propose-time never looked.
//   N-11 (MAJOR)    two steps naming ONE runtimeBindingId. A binding names exactly ONE step (`executionStepId`,
//                   ratified and required), so at most one of them can ever start: RW-3's Start-time SCOPE limb
//                   refuses the other permanently, and its refusal's remedy is INERT — no command rewrites a
//                   step's `runtimeBindingId` after propose, and none rewrites a binding's `executionStepId`
//                   after request. Same harm, verbatim, as the NOT_READY rule two rules below.
//
// The rules are therefore UNCONDITIONAL (L1-L7 run for every plan) and the graph check runs last, where its
// linear-plan short-circuit is harmless because everything structural has already been decided.
//
// ONE CARRIER. The three absorbed validators keep their exact codes and messages, so their existing rejection tests
// pass unedited. That is why a pure domain module names a command in its message text: preserving the caller's
// wording verbatim was worth more than a tidier abstraction, and it keeps the handler a thin mapper.
import { ConditionExpressionSchema, conditionStepRefs } from './condition-grammar.js';
import { validateTransitionGraph, type GateTransition } from './transition-gate.js';

/** The at-rest step state a proposal may declare. See L2 — this is DS-004's stated convention, now enforced. */
export const AT_REST_STEP_STATE = 'QUEUED';

export interface PlanProposalStep {
	readonly id: string;
	readonly stepType?: string;
	readonly stepState?: string;
	readonly executionPlanId?: string;
	/** A BRANCH's recorded decision. Authoring one at propose-time would fabricate a decision never taken. */
	readonly selectedTransitionId?: string;
	/**
	 * The RUNTIME_BINDING this step will execute under. Declared here for L4 (N-11) — until JAN-BINDEXCL this
	 * interface did not mention the field at all, so the one relation the plan asserts about runtime authority was
	 * the one relation propose-time could not see.
	 */
	readonly runtimeBindingId?: string;
}

export interface PlanProposalTransition extends GateTransition {
	readonly executionPlanId?: string;
}

export interface PlanProposalInput {
	readonly executionPlanId: string;
	readonly steps: readonly PlanProposalStep[];
	readonly transitions: readonly PlanProposalTransition[];
}

export interface PlanProposalResult {
	readonly ok: boolean;
	/** The refusal code the caller should surface. Absent when ok. */
	readonly code?: 'RPH_VALIDATION_SEMANTIC_FAILED' | 'RPH_VALIDATION_SCHEMA_FAILED';
	readonly message?: string;
}

const OK: PlanProposalResult = { ok: true };
const semantic = (message: string): PlanProposalResult => ({
	ok: false,
	code: 'RPH_VALIDATION_SEMANTIC_FAILED',
	message
});
const schema = (message: string): PlanProposalResult => ({
	ok: false,
	code: 'RPH_VALIDATION_SCHEMA_FAILED',
	message
});

/** L1 — a plan with no steps cannot execute anything, and completes vacuously. */
function checkStepsPresent(input: PlanProposalInput): PlanProposalResult | undefined {
	if (input.steps.length === 0)
		return semantic(
			`ProposeExecutionPlan blocked: a plan must declare at least one step — a step-less plan cannot execute anything and would complete vacuously.`
		);
	return undefined;
}

/** L2 — per-step shape: a usable id, the at-rest state, plan coherence, and no pre-authored decision. */
function checkStepShape(input: PlanProposalInput): PlanProposalResult | undefined {
	for (const s of input.steps) {
		if (typeof s.id !== 'string' || s.id.trim() === '')
			return semantic(
				`ProposeExecutionPlan blocked: every step must declare a non-empty id — a step with no id cannot be addressed by any command.`
			);
		if (s.executionPlanId !== undefined && s.executionPlanId !== input.executionPlanId)
			return semantic(
				`ProposeExecutionPlan blocked: step "${s.id}" declares executionPlanId "${s.executionPlanId}", which is not this plan ("${input.executionPlanId}").`
			);
		// F-09/F-27. DS-004 §3 states steps rest QUEUED and that the design ENFORCES it; nothing did. NOT_READY is
		// the machine's initial state but NO command drives a step out of it, and it is not terminal — so an authored
		// NOT_READY step can never start, never reach terminal-success, and permanently blocks plan completion. The
		// same is true of authoring any already-advanced or terminal state: the plan would claim work it never did.
		if (s.stepState !== AT_REST_STEP_STATE)
			return semantic(
				`ProposeExecutionPlan blocked: step "${s.id}" is proposed at stepState "${String(s.stepState)}", but a proposed step must rest at ${AT_REST_STEP_STATE} (DS-004 §3). A plan drives its own steps from ${AT_REST_STEP_STATE}; authoring any other state either claims work the plan has not done, or (NOT_READY/READY) declares a step no command can advance.`
			);
		if (s.selectedTransitionId !== undefined)
			return semantic(
				`ProposeExecutionPlan blocked: step "${s.id}" authors a selectedTransitionId, but a BRANCH selection is a decision RECORDED when the branch resolves — a proposal cannot pre-declare one.`
			);
	}
	return undefined;
}

/** L3 — step-id uniqueness. THE anti-vacuity rule: it must hold for a plan with no transitions at all. */
function checkStepIdUniqueness(input: PlanProposalInput): PlanProposalResult | undefined {
	const seen = new Set<string>();
	for (const s of input.steps) {
		if (seen.has(s.id))
			return semantic(
				`ProposeExecutionPlan blocked: step id "${s.id}" is declared more than once — step ids must be unique, because every command addresses a step by id and would only ever reach the first (the duplicate could never start, be skipped, or be pruned, and would block completion forever).`
			);
		seen.add(s.id);
	}
	return undefined;
}

/**
 * L4 — RUNTIME BINDING EXCLUSIVITY (N-11). At most one step may name any given `runtimeBindingId`.
 *
 * WHY THIS IS DECIDABLE HERE, with nothing but the proposal in hand: `RuntimeBinding.executionStepId` is a
 * ratified, REQUIRED field written once by `RequestRuntimeBinding` — a binding names exactly ONE step. So two steps
 * naming one binding is a contradiction the proposal states about ITSELF, and no store read can rescue it: at most
 * one of the two can match, whichever step the binding turns out to name.
 *
 * AND THE OTHER IS THEN PERMANENTLY UNSTARTABLE. RW-3's Start-time SCOPE limb refuses it — correctly — and the
 * refusal's remedy is INERT: `ProposeExecutionPlan` is the only writer of `steps[]` (`advanceStep` rewrites only
 * `stepState`/`selectedTransitionId`), and `executionStepId` is written once at request. Requesting a new binding,
 * which is what the refusal advises, mints one NO STEP NAMES. The plan can then only be abandoned, or the step
 * skipped past under a REPLAN Decision — the cost being the plan's own account of what it did.
 *
 * That is verbatim the harm L2 already refuses an authored NOT_READY step for ("can never start … permanently
 * blocks plan completion"), reached by a different route. Refusing it HERE — where the author can still edit the
 * proposal — is the whole difference between a defect and a wedge.
 */
function checkBindingExclusivity(input: PlanProposalInput): PlanProposalResult | undefined {
	const claimedBy = new Map<string, string>();
	for (const s of input.steps) {
		const bindingId = s.runtimeBindingId;
		// An absent binding is OUT OF SCOPE, not a violation — the same disposition the Start-time limb takes, and
		// load-bearing for the same reason: the reference seed authors no RuntimeBinding at all. `''` is treated as
		// absent so a step cannot claim exclusivity over the empty string.
		if (typeof bindingId !== 'string' || bindingId === '') continue;
		const first = claimedBy.get(bindingId);
		if (first !== undefined)
			return semantic(
				`ProposeExecutionPlan blocked: steps "${first}" and "${s.id}" both name runtimeBindingId "${bindingId}", but a RuntimeBinding names exactly one executionStepId — so at most one of them could ever start, and the other would be refused permanently by a remedy no command can perform (no command rewrites a step's runtimeBindingId, and none rewrites a binding's executionStepId). Give each step its own binding.`
			);
		claimedBy.set(bindingId, s.id);
	}
	return undefined;
}

/** L5 — per-transition shape, including the CONDITIONAL <-> conditionExpression biconditional (F-33). */
function checkTransitionShape(input: PlanProposalInput): PlanProposalResult | undefined {
	for (const t of input.transitions) {
		if (t.executionPlanId !== undefined && t.executionPlanId !== input.executionPlanId)
			return semantic(
				`ProposeExecutionPlan blocked: transition "${t.id ?? '(unnamed)'}" declares executionPlanId "${t.executionPlanId}", which is not this plan ("${input.executionPlanId}").`
			);
		// F-33: a CONDITIONAL edge with no expression can never be selected by first-match, so it is a permanently
		// dead arm the author plainly intended to be live. The converse (an expression on a SEQUENTIAL edge) is the
		// same drift from the other side: the runtime treats it as guarded while the label says it is not.
		if (t.transitionType === 'CONDITIONAL' && t.conditionExpression === undefined)
			return semantic(
				`ProposeExecutionPlan blocked: transition "${t.id ?? '(unnamed)'}" is tagged CONDITIONAL but declares no conditionExpression — first-match can never select it, so the arm would be permanently dead (DR-004 DWP-02).`
			);
		if (t.conditionExpression !== undefined && t.transitionType !== 'CONDITIONAL')
			return semantic(
				`ProposeExecutionPlan blocked: transition "${t.id ?? '(unnamed)'}" declares a conditionExpression but its transitionType is "${String(t.transitionType)}", not CONDITIONAL — the label and the runtime behaviour must agree.`
			);
	}
	return undefined;
}

/** L6 — transition-id uniqueness. ABSORBED VERBATIM (code + message preserved). */
function checkTransitionIdUniqueness(input: PlanProposalInput): PlanProposalResult | undefined {
	const edgeIds = new Set<string>();
	for (const t of input.transitions) {
		const id = t.id;
		if (id === undefined) continue;
		if (edgeIds.has(id))
			return semantic(
				`ProposeExecutionPlan blocked: transition id "${id}" is declared more than once — transition ids must be unique (a BRANCH records its decision by transition id).`
			);
		edgeIds.add(id);
	}
	return undefined;
}

/** L7 — the condition grammar parses and every stepId it references resolves. ABSORBED VERBATIM. */
function checkConditions(input: PlanProposalInput): PlanProposalResult | undefined {
	const declaredStepIds = new Set(input.steps.map((s) => s.id));
	for (const t of input.transitions) {
		if (t.conditionExpression === undefined) continue;
		const parsed = ConditionExpressionSchema.safeParse(t.conditionExpression);
		if (!parsed.success)
			return schema(
				`ProposeExecutionPlan blocked: a transition conditionExpression is malformed (DR-004 DWP-02): ${parsed.error.issues[0]?.message ?? 'invalid'}.`
			);
		const badRef = conditionStepRefs(parsed.data).find((id) => !declaredStepIds.has(id));
		if (badRef)
			return semantic(
				`ProposeExecutionPlan blocked: a transition condition references step "${badRef}", which is not a declared step in the plan (DR-004 DWP-02).`
			);
	}
	return undefined;
}

/** L8 — the transition GRAPH itself. ABSORBED VERBATIM; still a no-op for a linear plan, now harmlessly so. */
function checkGraph(input: PlanProposalInput): PlanProposalResult | undefined {
	const graph = validateTransitionGraph(
		input.steps.map((s) => ({ id: s.id, stepType: s.stepType })),
		input.transitions.map((t) => ({
			sourceStepId: t.sourceStepId,
			targetStepId: t.targetStepId,
			transitionType: t.transitionType,
			conditionExpression: t.conditionExpression
		}))
	);
	if (!graph.ok)
		return semantic(
			`ProposeExecutionPlan blocked: malformed transition graph — ${graph.message} (DR-004 DWP-01).`
		);
	return undefined;
}

/**
 * Validate a proposed plan's structural admissibility. Returns the FIRST failure, or `{ok: true}`.
 *
 * The order is deliberate: the step set is decided before the transition set, because a plan whose steps are
 * unaddressable is malformed no matter what its edges say — and because the graph check is the one rule that does
 * not apply to every plan.
 */
export function validateProposedPlan(input: PlanProposalInput): PlanProposalResult {
	return (
		checkStepsPresent(input) ??
		checkStepShape(input) ??
		checkStepIdUniqueness(input) ??
		checkBindingExclusivity(input) ??
		checkTransitionShape(input) ??
		checkTransitionIdUniqueness(input) ??
		checkConditions(input) ??
		checkGraph(input) ??
		OK
	);
}
