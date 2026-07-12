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
import { canTransition } from './stateMachine.js';

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
	/** Whether the step recorded an EXPLICIT "no output" result (distinct from silently missing output). */
	readonly explicitNoOutput: boolean;
}

/**
 * RPH-EXE-006 / §21.1. A succeeded step MUST record outputs or an explicit no-output result; completing a
 * running step with neither is rejected (state is explicit, never inferred from absent output, §2.6).
 */
export function validateStepCompletion(input: StepCompletionInput): Check {
	if (input.hasOutput || input.explicitNoOutput) return { ok: true };
	return {
		ok: false,
		errorCode: 'RPH_STEP_RESULT_MISSING',
		reason: 'step completion requires recorded output or an explicit no-output result'
	};
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
