// M11 conformance: execution model, runtime bindings & restart recovery. Each test binds to a numbered
// conformance test (RPH-EXE-*, RPH-PWU-*, RPH-PER-*) or a named property (P1/P6) from the Executable Invariant
// & Conformance Test Spec, using the canonical Reference Undertaking fixture ids (plan_fsm_arch_001, the
// architecture execution steps) where the scenario is instance-specific.
import { describe, expect, it } from 'vitest';
import {
	assessModelOutput,
	attemptWouldDuplicateSideEffect,
	bindingPermitsExecution,
	canActivatePlan,
	canResumeExecutionOnPwu,
	canReuseBindingForNewAttempt,
	canSkipStep,
	canStartStep,
	canStartStepUnderPlan,
	capabilityAuthorized,
	classifyInterruptedAttempt,
	executionAloneSatisfiesAssurance,
	executionSuccessOutcome,
	mayReexecuteWithoutReconciliation,
	resolveIdempotency,
	retryDecision,
	stepMayBecomeReady,
	validateStepCompletion,
	type StepStartInput
} from './index.js';

describe('M11 execution plan lifecycle (RPH-EXE-001/002, RPH-PWU-010; §20.2)', () => {
	it('RPH-EXE-001: activating a second plan while another is active (without superseding) is rejected', () => {
		expect(canActivatePlan({ planStatus: 'APPROVED', otherActivePlanExists: false }).ok).toBe(true);
		const r = canActivatePlan({ planStatus: 'APPROVED', otherActivePlanExists: true });
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_ACTIVE_PLAN_CONFLICT');
	});

	it('a plan can only be activated from APPROVED', () => {
		expect(canActivatePlan({ planStatus: 'PROPOSED', otherActivePlanExists: false }).ok).toBe(
			false
		);
	});

	it('RPH-EXE-002: no step may begin under a SUPERSEDED (or non-ACTIVE) plan', () => {
		expect(canStartStepUnderPlan('ACTIVE').ok).toBe(true);
		expect(canStartStepUnderPlan('SUPERSEDED').ok).toBe(false);
		expect(canStartStepUnderPlan('COMPLETED').ok).toBe(false);
		expect(canStartStepUnderPlan('APPROVED').ok).toBe(false); // approved != executing
	});

	it('RPH-PWU-010: a BASELINED PWU cannot resume execution in place — a successor is required', () => {
		expect(canResumeExecutionOnPwu('EXECUTING').ok).toBe(true);
		const r = canResumeExecutionOnPwu('BASELINED');
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_BASELINED_PWU_NO_RESUME');
	});
});

describe('M11 runtime binding authorization (RPH-EXE-003/004; §22.1, §8.1)', () => {
	it('RPH-EXE-003: a step cannot execute against a REQUESTED/DENIED/REVOKED binding; AUTHORIZED is required', () => {
		expect(bindingPermitsExecution('AUTHORIZED').ok).toBe(true);
		expect(bindingPermitsExecution('PARTIALLY_AUTHORIZED').ok).toBe(true);
		const r = bindingPermitsExecution('REQUESTED');
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_BINDING_NOT_AUTHORIZED');
		expect(bindingPermitsExecution('REVOKED').ok).toBe(false);
	});

	it('RPH-EXE-004: requested capability is not granted capability — an out-of-grant operation fails authorization', () => {
		// binding requested [file-system, network] but was granted only [file-system]
		const granted = ['file-system'];
		expect(
			capabilityAuthorized({ grantedCapabilities: granted, requiredCapability: 'file-system' }).ok
		).toBe(true);
		const net = capabilityAuthorized({
			grantedCapabilities: granted,
			requiredCapability: 'network'
		});
		expect(net.ok).toBe(false);
		expect(net.errorCode).toBe('RPH_CAPABILITY_NOT_GRANTED');
	});

	it('§22.1: a REVOKED/DENIED binding cannot back a new attempt', () => {
		expect(canReuseBindingForNewAttempt('AUTHORIZED')).toBe(true);
		expect(canReuseBindingForNewAttempt('REVOKED')).toBe(false);
		expect(canReuseBindingForNewAttempt('DENIED')).toBe(false);
	});
});

describe('M11 execution step lifecycle (RPH-EXE-005/006/009; §21.1)', () => {
	it('RPH-EXE-005: a step with unsatisfied preconditions stays NOT_READY (no invocation)', () => {
		expect(stepMayBecomeReady(true).ok).toBe(true);
		const r = stepMayBecomeReady(false);
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_PRECONDITION_UNSATISFIED');
	});

	it('canStartStep composes plan-active + binding-authorized + preconditions + legal transition, returning the first failure', () => {
		const ready: StepStartInput = {
			planStatus: 'ACTIVE',
			stepState: 'QUEUED', // a step is scheduled (NOT_READY->READY->QUEUED) before it may run
			bindingAuthorizationStatus: 'AUTHORIZED',
			preconditionsSatisfied: true
		};
		expect(canStartStep(ready).ok).toBe(true);
		expect(canStartStep({ ...ready, planStatus: 'SUPERSEDED' }).errorCode).toBe(
			'RPH_PLAN_NOT_ACTIVE'
		);
		expect(canStartStep({ ...ready, bindingAuthorizationStatus: 'REQUESTED' }).errorCode).toBe(
			'RPH_BINDING_NOT_AUTHORIZED'
		);
		expect(canStartStep({ ...ready, preconditionsSatisfied: false }).errorCode).toBe(
			'RPH_PRECONDITION_UNSATISFIED'
		);
		// NOT_READY -> RUNNING is an illegal step transition even if everything else holds
		expect(canStartStep({ ...ready, stepState: 'NOT_READY' }).ok).toBe(false);
	});

	it('RPH-EXE-006: completing a step without output or an explicit no-output result is rejected', () => {
		expect(validateStepCompletion({ hasOutput: true, explicitNoOutput: false }).ok).toBe(true);
		expect(validateStepCompletion({ hasOutput: false, explicitNoOutput: true }).ok).toBe(true);
		const r = validateStepCompletion({ hasOutput: false, explicitNoOutput: false });
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_STEP_RESULT_MISSING');
	});

	it('§21.1: skipping a MANDATORY step needs an authorized waiver/revision; an optional step may be skipped freely', () => {
		expect(canSkipStep({ mandatory: false, hasAuthorizedWaiverOrRevision: false }).ok).toBe(true);
		expect(canSkipStep({ mandatory: true, hasAuthorizedWaiverOrRevision: true }).ok).toBe(true);
		const r = canSkipStep({ mandatory: true, hasAuthorizedWaiverOrRevision: false });
		expect(r.ok).toBe(false);
		expect(r.errorCode).toBe('RPH_MANDATORY_SKIP_NEEDS_WAIVER');
	});

	it('RPH-EXE-009: malformed model output is inadmissible — no authoritative objects, retain raw, may retry', () => {
		const bad = assessModelOutput({ boundaryValid: false });
		expect(bad.admissible).toBe(false);
		expect(bad.mayCreateAuthoritativeObjects).toBe(false);
		expect(bad.retainRawForDiagnostics).toBe(true);
		expect(bad.mayTriggerRetryOrAlternate).toBe(true);
		expect(assessModelOutput({ boundaryValid: true }).mayCreateAuthoritativeObjects).toBe(true);
	});
});

describe('M11 retry cap & exhaustion (RPH-EXE-008; §36.2, §37)', () => {
	it('RPH-EXE-008: retries are permitted under the cap; at the cap the controller must pick an alternate action', () => {
		// maxAttempts = 3: after the 1st and 2nd failed attempts a retry is allowed
		expect(
			retryDecision({ attemptsMade: 1, maxAttempts: 3, lastAttemptFailed: true }).mayRetry
		).toBe(true);
		expect(
			retryDecision({ attemptsMade: 2, maxAttempts: 3, lastAttemptFailed: true }).mayRetry
		).toBe(true);
		// after the 3rd (cap) attempt fails, NO fourth retry — must select an alternate control action
		const exhausted = retryDecision({ attemptsMade: 3, maxAttempts: 3, lastAttemptFailed: true });
		expect(exhausted.mayRetry).toBe(false);
		expect(exhausted.mustSelectAlternateAction).toBe(true);
		expect(exhausted.permittedControlActions).toEqual([
			'CHANGE_TACTIC',
			'REPLAN_EXECUTION',
			'ESCALATE',
			'REJECT',
			'ABANDON'
		]);
	});

	it('a non-failed attempt does not trigger a retry decision', () => {
		expect(
			retryDecision({ attemptsMade: 1, maxAttempts: 3, lastAttemptFailed: false }).mayRetry
		).toBe(false);
	});
});

describe('M11 exec != assurance (Property P1 / RPH-PWU-005/007; Contract §35.2)', () => {
	it('RPH-PWU-005: plan success routes to EVIDENCE_PENDING, never SATISFIED, and does not auto-satisfy assurance', () => {
		const o = executionSuccessOutcome();
		expect(o.executionState).toBe('SUCCEEDED');
		expect(o.workLifecycleState).toBe('EVIDENCE_PENDING');
		expect(o.assuranceAutoSatisfied).toBe(false);
	});

	it('Property P1: execution success alone never implies assurance satisfaction', () => {
		expect(executionAloneSatisfiesAssurance()).toBe(false);
	});
});

describe('M11 restart recovery & idempotency (RPH-PER-012, RPH-PER-002 / Property P6; §35)', () => {
	it('RPH-PER-012: classifies each interrupted attempt and never blindly retries an uncertain side effect', () => {
		expect(
			classifyInterruptedAttempt({
				started: false,
				localResultRecorded: false,
				localErrorRecorded: false
			})
		).toBe('DEFINITELY_NOT_STARTED');
		expect(
			classifyInterruptedAttempt({
				started: true,
				localErrorRecorded: true,
				localResultRecorded: false
			})
		).toBe('FAILED');
		expect(
			classifyInterruptedAttempt({
				started: true,
				localResultRecorded: true,
				localErrorRecorded: false
			})
		).toBe('SUCCEEDED_UNRECORDED');
		expect(
			classifyInterruptedAttempt({
				started: true,
				externalOperationId: 'ext-1',
				externalStatus: 'RUNNING',
				localResultRecorded: false,
				localErrorRecorded: false
			})
		).toBe('RUNNING_WITH_EXTERNAL_ID');
		// started, no external handle, nothing recorded => completion uncertain (must reconcile, never blind-retry)
		expect(
			classifyInterruptedAttempt({
				started: true,
				localResultRecorded: false,
				localErrorRecorded: false
			})
		).toBe('COMPLETION_UNCERTAIN');
	});

	it('only not-started or confirmed-failed attempts may be re-executed without reconciliation', () => {
		expect(mayReexecuteWithoutReconciliation('DEFINITELY_NOT_STARTED')).toBe(true);
		expect(mayReexecuteWithoutReconciliation('FAILED')).toBe(true);
		expect(mayReexecuteWithoutReconciliation('COMPLETION_UNCERTAIN')).toBe(false);
		expect(mayReexecuteWithoutReconciliation('SUCCEEDED_UNRECORDED')).toBe(false);
		expect(mayReexecuteWithoutReconciliation('RUNNING_WITH_EXTERNAL_ID')).toBe(false);
	});

	it('a reconciled external status is authoritative over stale local flags; a conflict is COMPLETION_UNCERTAIN', () => {
		// lost-response timeout: a local error was recorded, but the op actually committed => external SUCCEEDED
		// wins and, conflicting with the local error, resolves to COMPLETION_UNCERTAIN (reconcile, never blind-retry)
		const conflict = classifyInterruptedAttempt({
			started: true,
			externalOperationId: 'ext-9',
			externalStatus: 'SUCCEEDED',
			localErrorRecorded: true,
			localResultRecorded: false
		});
		expect(conflict).toBe('COMPLETION_UNCERTAIN');
		expect(mayReexecuteWithoutReconciliation(conflict)).toBe(false); // never re-execute a possibly-committed effect
		// external SUCCEEDED with no conflicting local flag => SUCCEEDED_UNRECORDED (still not re-executable)
		expect(
			classifyInterruptedAttempt({
				started: true,
				externalStatus: 'SUCCEEDED',
				localErrorRecorded: false,
				localResultRecorded: false
			})
		).toBe('SUCCEEDED_UNRECORDED');
	});

	it('RPH-PER-002 / P6: a duplicate command idempotency key returns the prior result and emits no new events', () => {
		const prior = new Map([['cmd-key-1', { status: 'ACCEPTED', eventId: 'evt-1' }]]);
		const dup = resolveIdempotency('cmd-key-1', prior);
		expect(dup.duplicate).toBe(true);
		expect(dup.priorResult).toEqual({ status: 'ACCEPTED', eventId: 'evt-1' });
		expect(resolveIdempotency('cmd-key-2', prior).duplicate).toBe(false);
	});

	it('RPH-EXE-007: a retried side-effecting ATTEMPT with the same attempt idempotency key produces no second external effect', () => {
		const committed = new Set(['attempt-commit-abc']); // an attempt that already made a source-control commit
		expect(attemptWouldDuplicateSideEffect('attempt-commit-abc', committed)).toBe(true); // retry => suppress the duplicate
		expect(attemptWouldDuplicateSideEffect('attempt-commit-xyz', committed)).toBe(false); // fresh attempt key => new effect ok
	});
});
