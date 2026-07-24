// JAN-CMDPRE DWP-05 — per-site precondition coverage for the execution PLAN-level (7) and pwa-authoring
// publication-lifecycle (4) sites, implemented against JAN-CMDPRE-SPEC-001 §5. Each site now declares the
// source-state set derived from its machine's own in-arrows (ExecutionPlan.status / PWA.publicationStatus),
// established empirically in DWP-05 step 1. This file proves the SPEC §5.1 obligation per command:
//
//  1. Negative (re-issue) kill test: a same-state re-issue is REFUSED with RPH_ILLEGAL_STATE_TRANSITION, appends
//     NO second event, and bumps no revision.
//  2. Positive (widest-in-arrow) test: EACH reachable source in the set is ACCEPTED (two-source Cancel; the three
//     reachable sources of the four-source Supersede — PROPOSED is machine-legal but unreachable via the command
//     pipeline, which creates plans already in UNDER_REVIEW).
//  3. The enumerated obligations: ActivateExecutionPlan's refusal-code CHANGE (RPH_INVARIANT_VIOLATION ->
//     RPH_ILLEGAL_STATE_TRANSITION); the guard-mask corrections (Complete/Validate/Supersede refuse on STATE ahead
//     of a content/successor guard); ApplyTacticalChange as a DECLARED HOLD (ACTIVE->ACTIVE admitted, repeatable).
//
// Mutation red-proof (SPEC §5.3 / CON-000 B7) is performed live during implementation and recorded in the handoff.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-24T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'User' };

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	const d = (commandType: string, id: string, type: string, payload: unknown, by: ActorReference = HUMAN) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: by,
			correlationId: 'dwp05',
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const statusOf = (id: string, field = 'status') => (stateOf(id) as Record<string, string>)?.[field] ?? '';
	const revisionOf = (id: string) => store.loadObject(id)?.revision;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	return { store, engine, d, stateOf, statusOf, revisionOf, eventsOfType };
}

// ─────────────────────────────────── ExecutionPlan.status (7 sites) ──────────────────────────────────────────────
describe('DWP-05 execution plan-level — per-site precondition on ExecutionPlan.status in-arrows', () => {
	let h: ReturnType<typeof harness>;
	const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GE500';
	const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GE510';
	const PWU2 = 'pwu_01ARZ3NDEKTSV4RRFFQ69GE511';
	const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69GE520';
	const SUCC = 'plan_01ARZ3NDEKTSV4RRFFQ69GE530';

	function proposePwu(id: string) {
		expect(
			h.d('ProposePwu', id, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			}).status
		).toBe('ACCEPTED');
	}

	const step = (planId: string, i: number, stepState: string) => ({
		id: `${planId}-s${i}`,
		executionPlanId: planId,
		stepType: 'TRANSFORMATION',
		purpose: 'work',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState
	});

	/** ProposeExecutionPlan creates the plan already in UNDER_REVIEW (the PROPOSED->UNDER_REVIEW trigger fires at
	 *  creation — so PROPOSED is never a runtime-reachable state for a live plan). */
	function proposePlan(planId: string, pwuId: string, stepStates: string[]) {
		expect(
			h.d('ProposeExecutionPlan', planId, 'EXECUTION_PLAN', {
				executionPlanId: planId,
				workUnitId: pwuId,
				steps: stepStates.map((s, i) => step(planId, i, s)),
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}).status
		).toBe('ACCEPTED');
		expect(h.statusOf(planId)).toBe('UNDER_REVIEW');
	}
	const approve = (planId: string) => h.d('ApproveExecutionPlan', planId, 'EXECUTION_PLAN', {});
	const activate = (planId: string) =>
		h.d('ActivateExecutionPlan', planId, 'EXECUTION_PLAN', { authorizedRuntimeBindingIds: [] });
	const cancel = (planId: string) => h.d('CancelExecutionPlan', planId, 'EXECUTION_PLAN', { reason: 'x' });
	const complete = (planId: string) => h.d('CompleteExecutionPlan', planId, 'EXECUTION_PLAN', {});
	const fail = (planId: string) => h.d('FailExecutionPlan', planId, 'EXECUTION_PLAN', { failureReason: 'boom' });
	const supersede = (planId: string, successorId: string) =>
		h.d('SupersedeExecutionPlan', planId, 'EXECUTION_PLAN', { supersedingExecutionPlanId: successorId });
	const tactical = (planId: string) =>
		h.d('ApplyTacticalChange', planId, 'EXECUTION_PLAN', {
			changeType: 'RETRY_TUNING',
			rationale: 'adjust the plan in flight',
			authorizingPolicyId: 'pol_tactical'
		});

	beforeEach(() => {
		h = harness();
		h.d('CaptureIntent', INTENT, 'INTENT', {
			intentId: INTENT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		proposePwu(PWU);
	});

	// ── ApproveExecutionPlan ← UNDER_REVIEW ──
	it('ApproveExecutionPlan — accepts from UNDER_REVIEW; refuses a re-issue from APPROVED (no 2nd event, no rev bump)', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		expect(approve(PLAN).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('APPROVED');
		const rev = h.revisionOf(PLAN);

		const again = approve(PLAN);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionPlanApproved')).toHaveLength(1);
		expect(h.revisionOf(PLAN), 'no silent revision bump').toBe(rev);
	});

	// ── ActivateExecutionPlan ← APPROVED (ENUMERATED CODE CHANGE) ──
	it('ActivateExecutionPlan — a re-issue from ACTIVE refuses RPH_ILLEGAL_STATE_TRANSITION (the code change), NOT the guard\'s RPH_INVARIANT_VIOLATION', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		expect(activate(PLAN).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('ACTIVE');

		// Deleting the precondition makes this go RED: canActivatePlan's canTransition (NOOP-excluding) returns
		// RPH_INVARIANT_VIOLATION for the ACTIVE->ACTIVE re-issue. The precondition, ahead of the guard, refuses on state.
		const again = activate(PLAN);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionPlanActivated')).toHaveLength(1);
	});

	// ── CancelExecutionPlan ← {APPROVED, ACTIVE} (two-source) ──
	it('CancelExecutionPlan — accepts from APPROVED (first source)', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		expect(cancel(PLAN).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('CANCELLED');
	});

	it('CancelExecutionPlan — accepts from ACTIVE (second source, INV-5 two-source)', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		activate(PLAN);
		const r = cancel(PLAN);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('CANCELLED');
	});

	it('CancelExecutionPlan — a re-issue from CANCELLED is refused, one ExecutionTerminated', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		expect(cancel(PLAN).status).toBe('ACCEPTED');
		const rev = h.revisionOf(PLAN);

		const again = cancel(PLAN);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionTerminated')).toHaveLength(1);
		expect(h.revisionOf(PLAN), 'no silent revision bump').toBe(rev);
	});

	// ── CompleteExecutionPlan ← ACTIVE (+ guard-mask correction) ──
	it('CompleteExecutionPlan — a re-issue from COMPLETED is refused, one ExecutionPlanCompleted', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		activate(PLAN);
		expect(complete(PLAN).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('COMPLETED');

		const again = complete(PLAN);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionPlanCompleted')).toHaveLength(1);
	});

	it('CompleteExecutionPlan — a wrong-state (APPROVED) plan with a non-terminal step refuses on STATE (guard-mask fix)', () => {
		// Before DWP-05: the step-success guard fires first for the QUEUED step -> RPH_INVARIANT_VIOLATION, masking the
		// state. The precondition (ahead of the guard) now refuses APPROVED with RPH_ILLEGAL_STATE_TRANSITION.
		proposePlan(PLAN, PWU, ['QUEUED']);
		approve(PLAN); // APPROVED, not ACTIVE; step is non-terminal
		const r = complete(PLAN);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.statusOf(PLAN)).toBe('APPROVED');
	});

	// ── FailExecutionPlan ← ACTIVE ──
	it('FailExecutionPlan — accepts ACTIVE->FAILED; a re-issue from FAILED is refused, one ExecutionPlanFailed', () => {
		proposePlan(PLAN, PWU, ['FAILED']);
		approve(PLAN);
		activate(PLAN);
		expect(fail(PLAN).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('FAILED');

		const again = fail(PLAN);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionPlanFailed')).toHaveLength(1);
	});

	// ── SupersedeExecutionPlan ← {PROPOSED, UNDER_REVIEW, APPROVED, ACTIVE} (3 reachable) ──
	it('SupersedeExecutionPlan — accepts from UNDER_REVIEW (first reachable source)', () => {
		proposePlan(SUCC, PWU, ['QUEUED']); // a valid same-PWU successor
		proposePlan(PLAN, PWU, ['QUEUED']); // stays UNDER_REVIEW
		const r = supersede(PLAN, SUCC);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('SUPERSEDED');
	});

	it('SupersedeExecutionPlan — accepts from APPROVED and from ACTIVE (INV-5 widest-in-arrow, reachable sources)', () => {
		proposePlan(SUCC, PWU, ['QUEUED']);
		// APPROVED source
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		expect(supersede(PLAN, SUCC).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('SUPERSEDED');
		// ACTIVE source (a fresh plan on PWU2 so the successor need not match; use its own successor)
		const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69GE540';
		const SUCC2 = 'plan_01ARZ3NDEKTSV4RRFFQ69GE550';
		proposePwu(PWU2);
		proposePlan(SUCC2, PWU2, ['QUEUED']);
		proposePlan(PLAN2, PWU2, ['SUCCEEDED']);
		approve(PLAN2);
		activate(PLAN2);
		expect(h.statusOf(PLAN2)).toBe('ACTIVE');
		const r = supersede(PLAN2, SUCC2);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(h.statusOf(PLAN2)).toBe('SUPERSEDED');
	});

	it('SupersedeExecutionPlan — a re-issue from SUPERSEDED (naming a nonexistent successor) refuses on STATE, one ExecutionPlanSuperseded (guard-mask fix)', () => {
		proposePlan(SUCC, PWU, ['QUEUED']);
		proposePlan(PLAN, PWU, ['QUEUED']);
		expect(supersede(PLAN, SUCC).status).toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('SUPERSEDED');
		const rev = h.revisionOf(PLAN);

		// The re-issue names a NONEXISTENT successor. Before DWP-05 the successor-validity guard fired first ->
		// RPH_VALIDATION_SEMANTIC_FAILED, masking the state. The precondition (ahead of the guard) now refuses on state.
		const again = supersede(PLAN, 'plan_01ARZ3NDEKTSV4RRFFQ69GEZZZ0');
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('ExecutionPlanSuperseded')).toHaveLength(1);
		expect(h.revisionOf(PLAN), 'no silent revision bump').toBe(rev);
	});

	// ── ApplyTacticalChange ← ACTIVE (DECLARED HOLD) ──
	it('ApplyTacticalChange — the DECLARED HOLD: ACTIVE->ACTIVE is admitted and REPEATABLE (two distinct tactical changes)', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		activate(PLAN);
		expect(tactical(PLAN).status, 'first tactical change on an ACTIVE plan').toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('ACTIVE');
		// A SECOND tactical change is ALSO legitimate — this is a hold, not a NOOP to refuse.
		expect(tactical(PLAN).status, 'a second tactical change is a distinct legitimate act').toBe('ACCEPTED');
		expect(h.statusOf(PLAN)).toBe('ACTIVE');
		expect(h.eventsOfType('TacticalChangeApplied')).toHaveLength(2);
	});

	it('ApplyTacticalChange — refuses on a non-ACTIVE (APPROVED) plan', () => {
		proposePlan(PLAN, PWU, ['SUCCEEDED']);
		approve(PLAN);
		const r = tactical(PLAN);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.statusOf(PLAN)).toBe('APPROVED');
	});
});

// ─────────────────────────────── PWA.publicationStatus (4 sites) ─────────────────────────────────────────────────
describe('DWP-05 pwa-authoring publication — per-site precondition on PWA.publicationStatus in-arrows', () => {
	let h: ReturnType<typeof harness>;
	const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69GE600';
	const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69GE610';
	const pub = (id = PWA) => h.statusOf(id, 'publicationStatus');

	beforeEach(() => {
		h = harness();
	});

	/** A human-authored PWA with a single-root graph. A purely human-authored, never-assessed PWA passes the publish
	 *  floor (§8.4), so no floor drive is needed to reach PUBLISHED. */
	function createDraftWithRoot(pwaId = PWA, rootId = ROOT) {
		expect(
			h.d('CreatePwa', pwaId, 'PROFESSIONAL_WORK_ARCHITECTURE', {
				pwaId,
				name: 'Human-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('DefinePwuType', rootId, 'PWU_TYPE', {
				pwuTypeId: rootId,
				pwaId,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			}).status
		).toBe('ACCEPTED');
	}
	const submit = (id = PWA) => h.d('SubmitPwaForReview', id, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
	const validate = (id = PWA) => h.d('ValidatePwa', id, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
	const publish = (id = PWA, rootId = ROOT) =>
		h.d('PublishPwa', id, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: rootId });
	const deprecate = (id = PWA) => h.d('DeprecatePwa', id, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
	const retire = (id = PWA) => h.d('RetirePwa', id, 'PROFESSIONAL_WORK_ARCHITECTURE', {});

	/** Drive a human-authored PWA all the way to PUBLISHED. */
	function published() {
		createDraftWithRoot();
		expect(submit().status).toBe('ACCEPTED');
		expect(validate().status).toBe('ACCEPTED');
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pub()).toBe('PUBLISHED');
	}

	// ── SubmitPwaForReview ← DRAFT ──
	it('SubmitPwaForReview — accepts DRAFT->UNDER_REVIEW; a re-issue from UNDER_REVIEW is refused, one PwaSubmittedForReview', () => {
		createDraftWithRoot();
		expect(submit().status).toBe('ACCEPTED');
		expect(pub()).toBe('UNDER_REVIEW');
		const rev = h.revisionOf(PWA);

		const again = submit();
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('PwaSubmittedForReview')).toHaveLength(1);
		expect(h.revisionOf(PWA), 'no silent revision bump').toBe(rev);
	});

	// ── ValidatePwa ← UNDER_REVIEW (+ guard-mask / PILOT-002 ordering fix) ──
	it('ValidatePwa — accepts UNDER_REVIEW->VALIDATED; a re-issue from VALIDATED is refused, one PwaValidated', () => {
		createDraftWithRoot();
		submit();
		expect(validate().status).toBe('ACCEPTED');
		expect(pub()).toBe('VALIDATED');

		const again = validate();
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('PwaValidated')).toHaveLength(1);
	});

	it('ValidatePwa — a wrong-state (DRAFT) PWA with an INVALID graph refuses on STATE, not the composition guard (PILOT-002 mask fix)', () => {
		// A PWA whose only type is NON-root -> no single root -> pwaCompositionGate would reject RPH_INVARIANT_VIOLATION.
		// Kept DRAFT (not submitted). Before DWP-05 the composition gate fired first (guard before checkTransition),
		// masking the state; the precondition (ahead of the guard) now refuses DRAFT with RPH_ILLEGAL_STATE_TRANSITION.
		expect(
			h.d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
				pwaId: PWA,
				name: 'no-root',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('DefinePwuType', ROOT, 'PWU_TYPE', {
				pwuTypeId: ROOT,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'notroot',
				purpose: 'x',
				isRoot: false
			}).status
		).toBe('ACCEPTED');
		expect(pub()).toBe('DRAFT');

		const r = validate();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(pub()).toBe('DRAFT');
	});

	// ── DeprecatePwa ← PUBLISHED ──
	it('DeprecatePwa — accepts PUBLISHED->DEPRECATED; a re-issue from DEPRECATED is refused, one PwaDeprecated', () => {
		published();
		expect(deprecate().status).toBe('ACCEPTED');
		expect(pub()).toBe('DEPRECATED');
		const rev = h.revisionOf(PWA);

		const again = deprecate();
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('PwaDeprecated')).toHaveLength(1);
		expect(h.revisionOf(PWA), 'no silent revision bump').toBe(rev);
	});

	// ── RetirePwa ← DEPRECATED ──
	it('RetirePwa — accepts DEPRECATED->RETIRED; a re-issue from RETIRED is refused, one PwaRetired', () => {
		published();
		expect(deprecate().status).toBe('ACCEPTED');
		expect(retire().status).toBe('ACCEPTED');
		expect(pub()).toBe('RETIRED');

		const again = retire();
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('PwaRetired')).toHaveLength(1);
	});
});
