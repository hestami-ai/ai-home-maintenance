// Execution enforcement — the M11 domain kernel. Pure, deterministic predicates over lightweight read-models
// (same idiom as pwuGuards / decomposition.ts / governance.ts). These make the PROSE-ONLY guards on the
// ExecutionPlan.status / ExecutionStep.stepState / RuntimeBinding.authorizationStatus machines EXECUTABLE, plus
// the retry cap, the exec!=assurance boundary at the execution layer, and restart/idempotency reconciliation.
// No I/O, no clock; depends only on rph-contracts (via string states) and the generic transition matrix.
//
// Load-bearing laws (Canonical §20-22/§35; Contract §15-16/§35.2; Conformance RPH-EXE-*, RPH-PWU-*, RPH-PER-*,
// Property P1/P6):
//   * Plan lifecycle (RPH-EXE-001/002, RPH-PWU-010): one ACTIVE plan per PWU; a SUPERSEDED plan cannot start
//     steps; a BASELINED PWU cannot resume execution in place (needs a successor revision).
//   * Runtime binding (RPH-EXE-003/004): a binding must be AUTHORIZED before a step executes; requested
//     capability is not granted capability; a REVOKED binding cannot back a new attempt.
//   * Step (RPH-EXE-005/006/009): a step cannot run until preconditions hold; success requires an explicit
//     result; malformed model output is untrusted (no authoritative objects).
//   * Retry (RPH-EXE-008): the RetryPolicy cap bounds attempts; on exhaustion the controller must NOT retry
//     again and must pick an alternate control action.
//   * exec!=assurance (Property P1 / RPH-PWU-005/007): execution success alone NEVER implies assurance —
//     the completion path routes into EVIDENCE_PENDING, never SATISFIED (reuses pwuGuards / governance).
//   * Restart/idempotency (RPH-PER-012 / RPH-PER-002 / RPH-EXE-007 / Property P6): an interrupted attempt is
//     CLASSIFIED and reconciled — never blindly retried (a reconciled external status dominates stale local
//     flags); a duplicate command key emits no new events (RPH-PER-002), and a retried side-effecting attempt
//     with the same ATTEMPT key produces no second external effect (RPH-EXE-007, a distinct §28.2 concern).
import { canTransition, isTerminalState } from './stateMachine.js';

// ============================================================================================
// Execution plan lifecycle (RPH-EXE-001, RPH-EXE-002, RPH-PWU-010; §20.2)
// ============================================================================================

export interface Check {
	readonly ok: boolean;
	readonly errorCode?: string;
	readonly reason?: string;
}

export interface PlanActivationInput {
	/** Current status of the plan being activated (must be APPROVED to reach ACTIVE). */
	readonly planStatus: string;
	/** Does the PWU already have a different ACTIVE plan that is NOT being superseded by this activation? */
	readonly otherActivePlanExists: boolean;
}

/**
 * RPH-EXE-001 / §20.2. A PWU may have only ONE active plan at a time: activating a second plan without
 * superseding the first is rejected. Also checks the APPROVED -> ACTIVE transition is legal.
 */
export function canActivatePlan(input: PlanActivationInput): Check {
	if (!canTransition('ExecutionPlan.status', input.planStatus, 'ACTIVE'))
		return { ok: false, reason: `plan in ${input.planStatus} cannot be activated` };
	if (input.otherActivePlanExists)
		return {
			ok: false,
			errorCode: 'RPH_ACTIVE_PLAN_CONFLICT',
			reason: 'the PWU already has an active plan; supersede it before activating another'
		};
	return { ok: true };
}

/** Plan statuses under which a NEW step may begin. Only an ACTIVE plan drives execution; a SUPERSEDED (or
 *  terminal) plan cannot create new attempts (RPH-EXE-002, §35.1 "No superseded execution"). */
export function canStartStepUnderPlan(planStatus: string): Check {
	if (planStatus === 'ACTIVE') return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_PLAN_NOT_ACTIVE',
		reason: `no step may begin under a plan in ${planStatus}`
	};
}

export interface PlanSuccessEvidenceInput {
	/** The cited plan's own `status` (ExecutionPlan.status). */
	readonly planStatus: string;
	/** Its steps' states, in array order. */
	readonly stepStates: readonly string[];
}

export interface PlanSuccessEvidence extends Check {
	/** The step states that broke the allow-list, so a caller can name them rather than say "some step". */
	readonly offendingStepStates: readonly string[];
}

/**
 * THE ONE DEFINITION OF EXECUTION SUCCESS (JAN-EXECREM WP-12 / F-01... F-08).
 *
 * A plan EVIDENCES execution success iff its status is ACTIVE or COMPLETED, it has ≥1 step, EVERY step is
 * SUCCEEDED or SKIPPED, and ≥1 step is SUCCEEDED.
 *
 * WHY THIS EXISTS. The rule was written TWICE and the two copies disagreed. `completeExecutionPlan`'s allow-list
 * enforced all three step limbs; `rejectUnbackedExecutionSuccess` — the sole guard on the premise the entire
 * assurance chain rests on — enforced `steps.some(s => s.stepState === 'SUCCEEDED')` and nothing else. So a plan
 * the engine itself REFUSED to call complete could still back its PWU's `executionState = SUCCEEDED` claim: one
 * succeeded step out of five, with the other four QUEUED. And with no status term at all, a SUPERSEDED, CANCELLED
 * or FAILED plan backed it identically to an ACTIVE one — a plan the sponsor explicitly killed, or one the engine
 * records as FAILED, evidencing that execution succeeded. All three were reproduced live.
 *
 * The plan plane's own docstring already claimed the alignment ("so the two planes cannot diverge"). It was
 * one-directional: the plan plane cited the PWU rule, and the PWU rule cited nothing. Now there is one function.
 *
 * WHY `ACTIVE || COMPLETED` AND NOT `COMPLETED` ALONE. The ratified happy path claims PWU success while citing a
 * plan that is still ACTIVE and never issues CompleteExecutionPlan — the reference seed does exactly this. A
 * COMPLETED-only rule would break it. COMPLETED is admitted too, because the natural order (finish every step →
 * CompleteExecutionPlan → claim PWU success) is equally legitimate. The remaining asymmetry is CORRECT and is
 * DECLARED rather than hidden: `completeExecutionPlan` additionally carries `precondition: fromStates('ACTIVE')`,
 * so the plan plane refuses a COMPLETED re-issue on the state fact while the PWU plane accepts a COMPLETED plan as
 * backing. Same predicate, two admissible status sets, one of them narrowed by a precondition.
 *
 * WHY `every`, NOT `some`. `some` is what let 1-of-5 back a full success claim. And why an ALLOW-LIST rather than
 * "terminal ∧ ¬FAILED": the reachable terminal step set includes CANCELLED and SUPERSEDED, which a negation would
 * silently admit as success (§19 L3-2).
 */
export function planEvidencesExecutionSuccess(input: PlanSuccessEvidenceInput): PlanSuccessEvidence {
	if (input.planStatus !== 'ACTIVE' && input.planStatus !== 'COMPLETED')
		return {
			ok: false,
			errorCode: 'RPH_PLAN_NOT_LIVE_FOR_SUCCESS',
			reason: `the plan is ${input.planStatus}; only an ACTIVE or COMPLETED plan evidences execution success (a superseded, cancelled or failed plan evidences the opposite)`,
			offendingStepStates: []
		};
	if (input.stepStates.length === 0)
		return {
			ok: false,
			errorCode: 'RPH_PLAN_EMPTY',
			reason: 'the plan has no steps, so it evidences no work ([].every is vacuously true — §19 L3-1)',
			offendingStepStates: []
		};
	const offendingStepStates = input.stepStates.filter((s) => s !== 'SUCCEEDED' && s !== 'SKIPPED');
	if (offendingStepStates.length > 0)
		return {
			ok: false,
			errorCode: 'RPH_PLAN_STEPS_NOT_TERMINAL_SUCCESS',
			reason: `${offendingStepStates.length} step(s) are not in terminal success (${offendingStepStates.join(', ')}); every step must be SUCCEEDED or SKIPPED (§20.1 success allow-list)`,
			offendingStepStates
		};
	if (!input.stepStates.includes('SUCCEEDED'))
		return {
			ok: false,
			errorCode: 'RPH_PLAN_PRODUCED_NOTHING',
			reason:
				'every step is SKIPPED, so the plan produced nothing to succeed on; at least one step must have SUCCEEDED (§21.1)',
			offendingStepStates: []
		};
	return { ok: true, offendingStepStates: [] };
}

/**
 * RPH-PWU-010 / §8.3. A BASELINED PWU cannot resume execution in place against the same semantic version — a
 * successor revision or successor PWU is required. New execution is only legal when the PWU is not baselined.
 */
export function canResumeExecutionOnPwu(pwuLifecycleState: string): Check {
	if (pwuLifecycleState === 'BASELINED')
		return {
			ok: false,
			errorCode: 'RPH_BASELINED_PWU_NO_RESUME',
			reason: 'a baselined PWU requires a successor revision before new execution'
		};
	// GENERALISED to the machine's OWN terminal set (JAN-EXECREM WP-12 / F-28), not to a hardcoded list:
	// `m2-transitions.json` declares PWU.workLifecycleState.terminalStates = [BASELINED, ABANDONED, SUPERSEDED].
	// Opening execution on an ABANDONED or SUPERSEDED unit of work is at least as wrong as on a baselined one, and
	// deriving the set follows this codebase's own stated preference (`otherActivePlanExistsForPwu`: derive from
	// authoritative state, never from a remembered flag). BASELINED keeps its own ratified code above because
	// RPH-PWU-010 names it specifically and an existing conformance test asserts that code.
	//
	// DISCLOSED as an AUTHORED EXTENSION rather than smuggled: RPH-PWU-010's text names BASELINED only. The
	// generalisation is registered in the divergence record rather than presented as the ratified rule.
	if (isTerminalState('PWU.workLifecycleState', pwuLifecycleState))
		return {
			ok: false,
			errorCode: 'RPH_CLOSED_PWU_NO_NEW_EXECUTION',
			reason: `the PWU is ${pwuLifecycleState}, a terminal workLifecycleState — a closed unit of work opens no new execution`
		};
	return { ok: true };
}

// ============================================================================================
// Runtime binding authorization (RPH-EXE-003, RPH-EXE-004; §22.1, §8.1)
// ============================================================================================

/** RPH-EXE-003 / §8.1. A step may only execute against an AUTHORIZED (or PARTIALLY_AUTHORIZED, for its granted
 *  scope) binding; starting on a REQUESTED/DENIED/REVOKED binding is rejected. */
export function bindingPermitsExecution(authorizationStatus: string): Check {
	if (authorizationStatus === 'AUTHORIZED' || authorizationStatus === 'PARTIALLY_AUTHORIZED')
		return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_BINDING_NOT_AUTHORIZED',
		reason: `runtime binding is ${authorizationStatus}, not authorized`
	};
}

/**
 * The facts about a step's runtime binding that decide whether it may execute. Resolved by the CALLER — from the
 * store by the command layer, from the projection's input by the read-model — never read here.
 *
 * The id is carried SEPARATELY from `resolves` because two absences mean opposite things (JAN-REVREM DS §6b R9):
 * no id at all is OUT OF SCOPE, while an id that does not resolve is a fail-CLOSED negative fact. A single optional
 * boolean cannot express both, and collapsing them would make every plan in the reference seed — which authors no
 * RuntimeBinding whatsoever — permanently unstartable.
 */
export interface BindingAuthorityFacts {
	/** The step's own `runtimeBindingId`. Absent or empty ⇒ the rule does not apply. */
	readonly bindingId?: string;
	/** Did `bindingId` resolve to a RUNTIME_BINDING? `false` gates; ABSENT means the caller had no information. */
	readonly bindingResolves?: boolean;
	/** The binding's own ratified `executionStepId` — what it says it authorizes. */
	readonly boundStepId?: string;
	/** The binding's `authorizationStatus`, for `bindingPermitsExecution`. */
	readonly authorizationStatus?: string;
}

/** Which of the four checks decided. Carried so a caller can render the RIGHT refusal, and so a test can assert
 *  WHICH limb fired rather than merely that something refused — the distinction S1 and K1–K3 pin in both
 *  directions. */
export type BindingAuthorityLimb =
	| 'PERMITTED'
	| 'OUT_OF_SCOPE'
	| 'UNRESOLVABLE'
	| 'WRONG_STEP'
	| 'NOT_AUTHORIZED';

export interface BindingAuthorityVerdict {
	/** May the step execute? `OUT_OF_SCOPE` is `ok` — the rule's antecedent is unmet, which is not a refusal. */
	readonly ok: boolean;
	readonly limb: BindingAuthorityLimb;
	/** The kernel's label when the STATUS limb decided, for the message the caller composes. */
	readonly errorCode?: string;
	readonly reason?: string;
	/** What the binding said it authorizes, when WRONG_STEP decided — the caller needs it to name the mismatch. */
	readonly boundStepId?: string;
}

/**
 * RPH-EXE-003 / §8.1 — may `stepId` execute against the binding described by `facts`?
 *
 * EXTRACTED HERE (JAN-REVREM RW-6 / DS §6b R8) so the command layer and the READ-MODEL consult ONE declaration.
 * It previously lived inside `rph-application`'s `bindingAuthorityRefusal`, which needs a store and returns a
 * rejection — so the projection could use neither, and the UI went on offering Start on a step the engine refuses
 * (MAJOR #5). Re-deriving the checks in the projection was refused: that is exactly the `CLOSED_PWU_STATES`
 * mistake — a second copy whose comment claims it is derived — and it would duplicate an ORDER that is itself
 * load-bearing.
 *
 * THE ORDER, and why it is a choice rather than an accident of insertion:
 *
 *   1. Is there a binding at all?      — OUT OF SCOPE. The rule says "WITH a runtime binding".
 *   2. Does it resolve?                — fail CLOSED: authority that cannot be READ cannot authorize.
 *   3. Is it THIS step's binding?      — SCOPE (§8.1). A privilege-scope hole, not a status one.
 *   4. Is it AUTHORIZED at all?        — RPH-EXE-003, the ratified rule, via `bindingPermitsExecution`.
 *
 * SCOPE RUNS BEFORE STATUS deliberately: a binding granted for other work is not this step's authority at all, so
 * its status is not the question. Reporting "your binding is REVOKED" for a binding that was never yours names the
 * wrong defect and sends an operator to re-authorize something that would still be refused.
 *
 * STEP 2 IS SKIPPED WHEN THE CALLER SUPPLIED NO RESOLUTION, and that is the disclosed fail-OPEN (R9): a projection
 * that could not resolve the binding gets the pre-RW-6 answer rather than a silently emptied action column. The
 * engine still refuses, so the cost is a rejected click and not an illegal act. `bindingResolves === false` is a
 * different thing entirely — a resolved negative — and it gates.
 */
export function bindingAuthorityVerdict(
	stepId: string,
	facts: BindingAuthorityFacts
): BindingAuthorityVerdict {
	if (facts.bindingId === undefined || facts.bindingId === '')
		return { ok: true, limb: 'OUT_OF_SCOPE' };

	if (facts.bindingResolves === false) return { ok: false, limb: 'UNRESOLVABLE' };

	// Only when the caller actually told us. An unset `boundStepId` alongside `bindingResolves: true` is a caller
	// that resolved the object but not this field, so it cannot be read as "authorized for no step" — which would
	// refuse every step, the over-refusal S2 exists to catch.
	if (facts.boundStepId !== undefined && facts.boundStepId !== stepId)
		return { ok: false, limb: 'WRONG_STEP', boundStepId: facts.boundStepId };

	if (facts.authorizationStatus === undefined) return { ok: true, limb: 'PERMITTED' };
	const check = bindingPermitsExecution(facts.authorizationStatus);
	if (check.ok) return { ok: true, limb: 'PERMITTED' };
	return {
		ok: false,
		limb: 'NOT_AUTHORIZED',
		...(check.errorCode === undefined ? {} : { errorCode: check.errorCode }),
		...(check.reason === undefined ? {} : { reason: check.reason })
	};
}

export interface CapabilityCheckInput {
	readonly grantedCapabilities: readonly string[];
	readonly requiredCapability: string;
}

/**
 * RPH-EXE-004 / §22.1. Requested capability is NOT granted capability: an operation is authorized only when its
 * required capability is in the binding's explicitly granted set. A binding that requested file-system + network
 * but was granted only file-system fails authorization for network operations.
 */
export function capabilityAuthorized(input: CapabilityCheckInput): Check {
	if (input.grantedCapabilities.includes(input.requiredCapability)) return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_CAPABILITY_NOT_GRANTED',
		reason: `capability '${input.requiredCapability}' is not in the granted scope`
	};
}

/**
 * §22.1 — is every GRANTED capability one that was actually REQUESTED (JAN-CAPBIND WP-1, closing N-4)?
 *
 * THE RULE THIS ENFORCES, verbatim from §22.1's runtime invariants: *"Requested capability is not granted
 * capability"* and *"Privilege expansion requires a new authorization event."* Granting a capability nobody asked
 * for IS expansion — and doing it inside an authorization of something else is expansion **without its own event**,
 * which is precisely what the second sentence forbids.
 *
 * A SEPARATE PREDICATE FROM `capabilityAuthorized`, deliberately, and the distinction is easy to lose. That one
 * asks *"may this ONE operation proceed against the granted set?"* — single-operation containment, `granted
 * .includes(required)`. This asks *"is the granted SET within the requested SET?"* — a different question with a
 * different failure mode. Reusing `capabilityAuthorized` here would be the wrong predicate wearing the right name,
 * and it would also give it a production caller, tripping the enforcement register's call-site census for a rule
 * (RPH-EXE-004) that would still be unenforced.
 *
 * NAMED PARAMETERS, and that is load-bearing rather than stylistic. With `scope` deliberately not authored,
 * `CapabilityRequest` and `CapabilityGrant` are STRUCTURALLY IDENTICAL — `{ capability: string }` — so TypeScript
 * cannot tell one from the other and positional operands could be swapped silently, inverting the rule into
 * "requested is within granted". Padding one type with an extra optional field would not help: shapes differing
 * only by optional members stay mutually assignable. A named record makes a swap require a deliberate edit.
 *
 * SUBSET, NOT EQUALITY. A grant NARROWER than the request is legal and expected — it is exactly RPH-EXE-004's
 * example ("requests file-system and network access but only file-system is granted") and the reason the ratified
 * machine has a PARTIALLY_AUTHORIZED state at all. Refusing a partial grant would strand every legitimate
 * least-privilege authorization, which is the over-refusal half this rule is most at risk of.
 */
export function grantedWithinRequest(input: {
	readonly requested: readonly string[];
	readonly granted: readonly string[];
}): Check {
	const requested = new Set(input.requested);
	const excess = input.granted.filter((c) => !requested.has(c));
	if (excess.length === 0) return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_CAPABILITY_NOT_REQUESTED',
		reason: `granted capabilities [${excess.join(', ')}] were never requested — privilege expansion requires a new authorization event (§22.1)`
	};
}

/** §22.1. A REVOKED binding cannot back a new attempt (privilege expansion needs a NEW authorization event). */
export function canReuseBindingForNewAttempt(authorizationStatus: string): boolean {
	return authorizationStatus !== 'REVOKED' && authorizationStatus !== 'DENIED';
}

// ============================================================================================
// Execution step lifecycle (RPH-EXE-005, RPH-EXE-006, RPH-EXE-009; §21.1)
// ============================================================================================

/** RPH-EXE-005 / §21.1. A step may become READY (and thus be scheduled/run) only when ALL preconditions are
 *  satisfied. A step with an absent required input stays NOT_READY and NO model/tool invocation occurs. */
export function stepMayBecomeReady(preconditionsSatisfied: boolean): Check {
	if (preconditionsSatisfied) return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_PRECONDITION_UNSATISFIED',
		reason: 'step preconditions are not satisfied; step remains NOT_READY'
	};
}

export interface StepStartInput {
	readonly planStatus: string;
	readonly stepState: string;
	readonly bindingAuthorizationStatus: string;
	readonly preconditionsSatisfied: boolean;
}

/**
 * The composite gate for starting a step: the owning plan is ACTIVE (RPH-EXE-002), the runtime binding is
 * authorized (RPH-EXE-003), the preconditions hold (RPH-EXE-005), and the step is in a state from which
 * RUNNING is legal (QUEUED/WAITING — a step is scheduled through NOT_READY->READY->QUEUED before it runs).
 * Returns the first failing check (or ok).
 */
export function canStartStep(input: StepStartInput): Check {
	const plan = canStartStepUnderPlan(input.planStatus);
	if (!plan.ok) return plan;
	const binding = bindingPermitsExecution(input.bindingAuthorizationStatus);
	if (!binding.ok) return binding;
	const pre = stepMayBecomeReady(input.preconditionsSatisfied);
	if (!pre.ok) return pre;
	if (!canTransition('ExecutionStep.stepState', input.stepState, 'RUNNING'))
		return { ok: false, reason: `step in ${input.stepState} cannot transition to RUNNING` };
	return { ok: true };
}

export interface StepCompletionInput {
	/** Whether the step recorded at least one output artifact. */
	readonly hasOutput: boolean;
	/**
	 * Whether the caller ASSERTED an explicit "no output" result (distinct from silently missing output).
	 *
	 * JAN-EXECREM WP-11 / F-01: this must be INDEPENDENT of `hasOutput`. The application layer used to pass
	 * `explicitNoOutput: !hasOutput`, so the disjunction below evaluated `b || !b` — a tautology, and RPH-EXE-006
	 * was enforced nowhere in the running engine. The kernel was never wrong; the caller supplied one fact twice
	 * because the CONTRACT had no field for the second one. WP-1 added `CompleteExecutionStepPayload.noOutputResult`,
	 * so the two facts can now DISAGREE and this is a real decision (§2.6: state is explicit, never inferred from
	 * absent output).
	 */
	readonly explicitNoOutput: boolean;
	/**
	 * Is the asserted no-output REASON compatible with reaching SUCCEEDED? Absent/undefined = yes.
	 *
	 * `TIMEOUT` and `NO_CANDIDATE_OUTPUT` are failure-shaped: a timed-out attempt is a FailExecutionStep, not a
	 * success with an excuse. SUCCEEDED credit is what backs the PWU's execution-success claim, so admitting a
	 * timeout as SUCCEEDED would let a non-result back it.
	 */
	readonly noOutputReasonIsSuccessCompatible?: boolean;
	/**
	 * Does the STEP ITSELF declare `outputBindings` (i.e. the authored plan says this step produces something)?
	 *
	 * The state-derived corroboration limb. Without it, `noOutputResult` is a FREE CALLER ASSERTION — structurally
	 * the same shape as the `!!waiverOrRevisionId` booleans this program is elsewhere removing: nothing in recorded
	 * state can disagree with it. This limb is the one thing state CAN say: a step whose own plan declares outputs
	 * may not be completed by asserting it produced none. Free for every legitimate caller (the reference seed and
	 * the demo both author `outputBindings: []`).
	 */
	readonly declaresOutputBindings?: boolean;
}

/**
 * RPH-EXE-006 / §21.1. A succeeded step MUST record outputs or an explicit no-output result.
 *
 * The four cells over (`hasOutput`, `explicitNoOutput`), then two refinements of the asserted case:
 *
 * | hasOutput | explicitNoOutput | verdict                                                              |
 * |-----------|------------------|----------------------------------------------------------------------|
 * | true      | false            | OK — the completion names a result                                    |
 * | false     | true             | OK *if* the reason is success-shaped and the step declares no outputs |
 * | false     | false            | `RPH_STEP_RESULT_MISSING` — the invariant's own case                  |
 * | true      | true             | `RPH_STEP_RESULT_CONTRADICTORY` — it cannot both produce and not      |
 *
 * The contradictory cell is checked FIRST and deliberately: it is the cell the old derived form made
 * unrepresentable, and it is the one that would otherwise be silently absorbed by the "has output" arm.
 */
export function validateStepCompletion(input: StepCompletionInput): Check {
	if (input.hasOutput && input.explicitNoOutput)
		return {
			ok: false,
			errorCode: 'RPH_STEP_RESULT_CONTRADICTORY',
			reason:
				'step completion names a result AND asserts an explicit no-output result; exactly one of the two is true'
		};
	if (!input.hasOutput && !input.explicitNoOutput)
		return {
			ok: false,
			errorCode: 'RPH_STEP_RESULT_MISSING',
			reason: 'step completion requires recorded output or an explicit no-output result'
		};
	if (input.explicitNoOutput && input.noOutputReasonIsSuccessCompatible === false)
		return {
			ok: false,
			errorCode: 'RPH_STEP_RESULT_NOT_SUCCESS_SHAPED',
			reason:
				'a timed-out or candidate-less attempt is a FAILURE — use FailExecutionStep; SUCCEEDED credit is what backs the PWU execution-success claim'
		};
	if (input.explicitNoOutput && input.declaresOutputBindings === true)
		return {
			ok: false,
			errorCode: 'RPH_STEP_RESULT_CONTRADICTS_PLAN',
			reason:
				'the step declares outputBindings, so its own plan says it produces a result; asserting no-output contradicts the authored step'
		};
	return { ok: true };
}

export interface StepSkipInput {
	/** Is the step mandatory (vs optional/conditional)? */
	readonly mandatory: boolean;
	/** Does an authorized plan revision or waiver cover skipping this step? */
	readonly hasAuthorizedWaiverOrRevision: boolean;
}

/**
 * §21.1. A MANDATORY step may be SKIPPED only under an authorized plan revision or waiver; skipping a mandatory
 * step without one is rejected (an optional step may be skipped freely).
 */
export function canSkipStep(input: StepSkipInput): Check {
	if (!input.mandatory || input.hasAuthorizedWaiverOrRevision) return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_MANDATORY_SKIP_NEEDS_WAIVER',
		reason: 'skipping a mandatory step requires an authorized plan revision or waiver'
	};
}

export interface ModelOutputView {
	/** Did the raw output pass boundary (schema) validation? */
	readonly boundaryValid: boolean;
}

export interface ModelOutputAdmissibility {
	readonly admissible: boolean;
	/** RPH-EXE-009: even when inadmissible, the raw output is retained for diagnostics. */
	readonly retainRawForDiagnostics: true;
	readonly mayCreateAuthoritativeObjects: boolean;
	readonly mayTriggerRetryOrAlternate: boolean;
}

/**
 * RPH-EXE-009 / §21.1. Model output is untrusted external input: a malformed structured result fails boundary
 * validation, does NOT create authoritative objects, retains raw output for diagnostics, and may trigger a
 * retry/alternate strategy.
 */
export function assessModelOutput(o: ModelOutputView): ModelOutputAdmissibility {
	return {
		admissible: o.boundaryValid,
		retainRawForDiagnostics: true,
		mayCreateAuthoritativeObjects: o.boundaryValid,
		mayTriggerRetryOrAlternate: !o.boundaryValid
	};
}

// ============================================================================================
// Retry cap & exhaustion (RPH-EXE-008; §36.2, §37)
// ============================================================================================

/** The control actions the controller may select once retries are exhausted (RPH-EXE-008). */
export const RETRY_EXHAUSTION_ACTIONS = [
	'CHANGE_TACTIC',
	'REPLAN_EXECUTION',
	'ESCALATE',
	'REJECT',
	'ABANDON'
] as const;

export interface RetryInput {
	/** Number of attempts already made (1-based: 1 after the first attempt). */
	readonly attemptsMade: number;
	/** The RetryPolicy cap — the maximum number of attempts permitted. Read from the plan's RetryPolicy, never
	 *  hardcoded (the doc's "maximum three attempts" is a fixture policy value). */
	readonly maxAttempts: number;
	/** Did the latest attempt fail (a retry is only considered after a failure)? */
	readonly lastAttemptFailed: boolean;
}

export interface RetryDecision {
	readonly mayRetry: boolean;
	/** True when the cap is reached and the controller must pick an alternate control action instead. */
	readonly mustSelectAlternateAction: boolean;
	readonly permittedControlActions: readonly string[];
}

/**
 * RPH-EXE-008 / §36.2. A failed step may retry only while attempts remain under the RetryPolicy cap; once the
 * cap is reached the controller MUST NOT retry again and must instead select an alternate control action from
 * {CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE, REJECT, ABANDON}. (Cap interpreted as MAX TOTAL ATTEMPTS; the
 * docs conflate "attempts" and "retries" — see OPEN-QUESTIONS.)
 */
export function retryDecision(input: RetryInput): RetryDecision {
	if (!input.lastAttemptFailed)
		return { mayRetry: false, mustSelectAlternateAction: false, permittedControlActions: [] };
	const mayRetry = input.attemptsMade < input.maxAttempts;
	return {
		mayRetry,
		mustSelectAlternateAction: !mayRetry,
		permittedControlActions: mayRetry ? [] : [...RETRY_EXHAUSTION_ACTIONS]
	};
}

/**
 * The retry cap when the plan's RetryPolicy carries no usable `maxAttempts` (the Conformance §12 fixture value).
 *
 * MOVED HERE FROM `rph-application` BY JAN-RETRYCAP (N-12), and the move is the point rather than tidiness.
 * `retryDecision` is only as shared as its INPUTS: while the default and the validity rules lived privately in the
 * command handler, any second caller — the read-model, a report, a future controller — had to re-derive "what is
 * this plan's cap", and would have been free to derive it differently. A shared decision fed by a re-derived fact
 * is not one declaration; it is two, with a function in between making them look like one.
 */
export const DEFAULT_RETRY_CAP = 3;

/**
 * RPH-EXE-008's cap for a plan, read as a CONVENTION on the Source-TBD RetryPolicy bag.
 *
 * `RetryPolicy` has no ratified field list (it is one of the deliberately-opaque helpers — see JAN-CAPBIND
 * DS-001), so only a conventional `maxAttempts` key is read, and every degenerate value (absent, NaN, 0, negative,
 * non-integer) falls back to the default rather than producing a cap of zero or a NaN comparison. Fail-SAFE rather
 * than fail-open: a malformed policy yields the conventional cap, not an unbounded one.
 */
export function retryCapFrom(retryPolicy: unknown): number {
	const raw = (retryPolicy as { maxAttempts?: unknown } | undefined)?.maxAttempts;
	return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : DEFAULT_RETRY_CAP;
}

/** The minimum an event must expose for `attemptsMadeFrom` to count it. Structural, so both an engine's stored
 *  event and a projection's input satisfy it without either package importing the other's types. */
export interface AttemptCountableEvent {
	readonly eventType: string;
	readonly aggregateId: string;
	readonly payload?: unknown;
}

/**
 * Attempts made for a step = count of `ExecutionStepStarted` for that step on that plan.
 *
 * ONE DERIVATION, AND IT USED TO BE TWO THAT SAID SO. The engine counted these events inline in
 * `retryExecutionStep`, under a comment reading *"Mirrors the execution-attempts projection's attempt_number"* —
 * a second copy whose comment claims it is derived, which is verbatim the `CLOSED_PWU_STATES` shape JAN-REVREM RW-3
 * had to correct. They agreed, and nothing made them agree. Threading the count out to the read-model for N-12
 * would have made it THREE, so the count moved here first.
 *
 * EACH `Started` IS ONE ATTEMPT (§19 L3-3): one QUEUED→RUNNING episode. `ExecutionStepRetried` is a re-queue
 * MARKER and is NOT counted — counting it would double-count every retry, and the next `Started` after a retry is
 * what opens attempt n+1. A wait/resume cycle emits no `Started`, so it continues the SAME attempt and does not
 * consume the cap.
 *
 * Counted from the event log rather than from step state so it is REPLAY-STABLE: the answer is a function of the
 * stream, identical on every rebuild, and independent of whatever the aggregate happens to have been folded to.
 */
export function attemptsMadeFrom(
	events: Iterable<AttemptCountableEvent>,
	planId: string,
	stepId: string
): number {
	let n = 0;
	for (const e of events)
		if (
			e.eventType === 'ExecutionStepStarted' &&
			e.aggregateId === planId &&
			(e.payload as { stepId?: string } | undefined)?.stepId === stepId
		)
			n += 1;
	return n;
}

// ============================================================================================
// Exec != assurance at the execution layer (Property P1 / RPH-PWU-005/007; Contract §35.2)
// ============================================================================================

export interface ExecutionCompletionOutcome {
	readonly executionState: 'SUCCEEDED';
	/** Success routes the PWU into EVIDENCE_PENDING — NEVER SATISFIED. Satisfaction requires a separate
	 *  assurance pass (pwuGuards.satisfiesP1 / governance.controllerMarksPwuSatisfied). */
	readonly workLifecycleState: 'EVIDENCE_PENDING';
	readonly assuranceAutoSatisfied: false;
}

/**
 * RPH-PWU-005 / Contract §35.2. When a PWU's active plan succeeds, execution state becomes SUCCEEDED and the
 * lifecycle becomes EVIDENCE_PENDING — assurance is NOT automatically SATISFIED. The completion path can never
 * route directly to SATISFIED.
 */
export function executionSuccessOutcome(): ExecutionCompletionOutcome {
	return {
		executionState: 'SUCCEEDED',
		workLifecycleState: 'EVIDENCE_PENDING',
		assuranceAutoSatisfied: false
	};
}

/**
 * Property P1 ("Execution never implies assurance"). executionState = SUCCEEDED must NEVER on its own cause
 * assuranceState = SATISFIED. This predicate is intentionally constant-false: there is no execution-only path
 * to assurance satisfaction. (RPH-PWU-007: a rejected assurance still blocks satisfaction after success.)
 */
export function executionAloneSatisfiesAssurance(): false {
	return false;
}

// ============================================================================================
// Restart recovery & idempotency (RPH-PER-012, RPH-PER-002; Property P6; Persistence §35)
// ============================================================================================

/** Reconciliation classes for a nonterminal execution attempt found on restart (Persistence §35). The docs
 *  leave reconciliation_state free-text; M11 defines this enum (see OPEN-QUESTIONS). */
export type ReconciliationClass =
	| 'DEFINITELY_NOT_STARTED'
	| 'RUNNING_WITH_EXTERNAL_ID'
	| 'SUCCEEDED_UNRECORDED'
	| 'FAILED'
	| 'COMPLETION_UNCERTAIN';

export interface InterruptedAttemptView {
	/** Did the attempt begin executing (any side-effecting call issued)? */
	readonly started: boolean;
	/** An observable external operation id, if the side effect exposed one (enables reconciliation). */
	readonly externalOperationId?: string;
	/** The provider's status for the external operation, if reconciled: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'UNKNOWN'. */
	readonly externalStatus?: string;
	/** Whether our own store already recorded a terminal result/error for the attempt. */
	readonly localResultRecorded: boolean;
	readonly localErrorRecorded: boolean;
}

/**
 * RPH-PER-012 / Persistence §35. Classify a nonterminal attempt discovered on restart. A RECONCILED terminal
 * external status is AUTHORITATIVE over local optimistic flags (the local error/result may be stale — e.g. a
 * lost-response timeout recorded a local error while the side effect actually committed). When the reconciled
 * external status CONFLICTS with a local flag, the attempt is COMPLETION_UNCERTAIN (reconcile, never blindly
 * retry). Local flags are consulted only when there is no authoritative external signal.
 */
export function classifyInterruptedAttempt(a: InterruptedAttemptView): ReconciliationClass {
	if (!a.started) return 'DEFINITELY_NOT_STARTED';

	// Reconciled external status wins over local optimistic flags; a disagreement is uncertain, not terminal.
	if (a.externalStatus === 'SUCCEEDED')
		return a.localErrorRecorded ? 'COMPLETION_UNCERTAIN' : 'SUCCEEDED_UNRECORDED';
	if (a.externalStatus === 'FAILED')
		return a.localResultRecorded ? 'COMPLETION_UNCERTAIN' : 'FAILED';
	if (a.externalOperationId && a.externalStatus === 'RUNNING') return 'RUNNING_WITH_EXTERNAL_ID';

	// No authoritative external signal — fall back to what we locally recorded; contradictory/absent = uncertain.
	if (a.localResultRecorded && !a.localErrorRecorded) return 'SUCCEEDED_UNRECORDED';
	if (a.localErrorRecorded && !a.localResultRecorded) return 'FAILED';
	return 'COMPLETION_UNCERTAIN';
}

/**
 * Whether an interrupted attempt is SAFE to (re-)execute without reconciliation. Only a definitely-not-started
 * attempt (no side effect issued) or a confirmed FAILED attempt may be retried blindly; anything that might
 * have produced an external side effect must be reconciled first (RPH-PER-012 — "never blindly retry").
 */
export function mayReexecuteWithoutReconciliation(c: ReconciliationClass): boolean {
	return c === 'DEFINITELY_NOT_STARTED' || c === 'FAILED';
}

export interface IdempotencyResolution<T = unknown> {
	readonly duplicate: boolean;
	/** For a duplicate, the prior result is returned and NO new domain events are emitted (Property P6). */
	readonly priorResult?: T;
}

/**
 * RPH-PER-002 / Property P6. A command carrying an idempotency key already present in the receipts store is a
 * duplicate: it emits no new domain events and returns the original result. (The command bus enforces this via
 * command_receipts; this predicate is the pure decision.)
 */
export function resolveIdempotency<T>(
	idempotencyKey: string,
	priorResults: ReadonlyMap<string, T>
): IdempotencyResolution<T> {
	if (priorResults.has(idempotencyKey))
		return { duplicate: true, priorResult: priorResults.get(idempotencyKey) };
	return { duplicate: false };
}

/**
 * RPH-EXE-007 / §28.2. Attempt-level (external-side-effect) idempotency — a DISTINCT concern from command-level
 * idempotency (resolveIdempotency / RPH-PER-002): §28.2 separately requires that a side-effecting attempt (e.g.
 * a source-control commit) retried with the SAME attempt idempotency key produces NO second external effect
 * (execution_attempts.idempotency_key is uniquely constrained). Returns true when re-issuing this attempt would
 * duplicate an already-committed external side effect — the caller must suppress the side effect and reuse the
 * prior external operation result instead.
 */
export function attemptWouldDuplicateSideEffect(
	attemptIdempotencyKey: string,
	committedAttemptKeys: ReadonlySet<string>
): boolean {
	return committedAttemptKeys.has(attemptIdempotencyKey);
}
