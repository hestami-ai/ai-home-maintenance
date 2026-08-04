// JAN-CMDPRE DWP-04 — per-site precondition coverage for the governance (Decision, Baseline) and AssurancePolicy
// families, implemented against JPWB-SPEC-001 §5.2. Each of the six sites now declares the source-state set derived
// from its machine's own in-arrows (the mechanism itself is proven in command-precondition.test.ts). This file
// proves the site-level contract SPEC-001 §5.1 requires, per command:
//
//  1. Negative (re-issue) kill test: a re-issue from the target state — and at least one wrong source that is not
//     the target — is REFUSED with RPH_ILLEGAL_STATE_TRANSITION, appends NO second event, and bumps no revision /
//     grows no accumulative field (INV-2/INV-6).
//  2. Positive (widest-in-arrow) test: EACH state in the authored set is ACCEPTED — a two-source set (Activate,
//     Supersede) exercises BOTH sources (INV-5).
//  3. The enumerated obligations: PromoteBaseline's refusal-code CHANGE (RPH_INVARIANT_VIOLATION →
//     RPH_ILLEGAL_STATE_TRANSITION, INV-7); SupersedeAssurancePolicy's F-4 `tags`-not-compounded assertion (INV-6).
//
// The mutation red-proof (SPEC-001 §5.3 / CON-000 B7) is performed live during implementation and recorded in the
// handoff — weakening a site's set (adding the target) or deleting the precondition must make that site's negative
// kill test go RED. A test that stays green under that mutation is a finding, not a pass.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-07-24T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'dwp04',
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const revisionOf = (id: string) => store.loadObject(id)?.revision;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	return { store, engine, d, stateOf, revisionOf, eventsOfType };
}

// ─────────────────────────────────────── RevokeDecision (Decision.status ← EFFECTIVE) ───────────────────────────
describe('DWP-04 RevokeDecision — fromStates(EFFECTIVE), no decisionType predicate (both kinds revocable)', () => {
	let h: ReturnType<typeof harness>;
	const APPROVAL = 'dec_01ARZ3NDEKTSV4RRFFQ69GD400';
	const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69GD401';
	const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69GD402';
	const statusOf = (id: string) => (h.stateOf(id) as { status?: string })?.status ?? '';

	beforeEach(() => {
		h = harness();
	});

	/** A PROPOSED non-waiver decision (PROMOTE_BASELINE — the seed's own kind, not APPROVAL, to keep the fixture
	 *  honest about why revocation is kind-agnostic). Subjects need not exist (authorizeDecisionEffective is
	 *  authority-scoped). */
	function proposeApproval(id = APPROVAL) {
		expect(
			h.d('ProposeDecision', id, 'DECISION', {
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: [SUBJECT],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: HUMAN,
				consideredObservationIds: []
			}).status
		).toBe('ACCEPTED');
	}

	function approve(id = APPROVAL) {
		return h.d('ApproveDecision', id, 'DECISION', {
			selectedOption: 'promote',
			rationale: 'approved',
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: { [SUBJECT]: 1 }
		});
	}

	/** A PROPOSED WAIVER decision. Requested against a policy id the store has never seen → waiverRules default to
	 *  [] (permissive), so no floor seeding is needed. */
	function requestWaiver(id = WAIVER) {
		expect(
			h.d('RequestWaiver', id, 'DECISION', {
				subjectObjectIds: [SUBJECT],
				scope: 'de minimis assurance floor',
				rationale: 'accepted residual risk',
				duration: 'until superseded',
				affectedObjectIds: [SUBJECT],
				waivedPolicyId: 'pol_absent',
				waivedCriterionId: 'C-01',
				waivedFindingIds: [],
				compensatingControls: ['manual review'],
				reviewConditions: ['revisit next version']
			}).status
		).toBe('ACCEPTED');
	}

	function grant(id = WAIVER) {
		return h.d('GrantWaiver', id, 'DECISION', {
			waiverDecisionId: id,
			duration: 'until superseded'
		});
	}

	const revoke = (id: string) => h.d('RevokeDecision', id, 'DECISION', { revocationRationale: 'withdrawn' });

	it('POSITIVE — revokes an EFFECTIVE APPROVAL-family decision (EFFECTIVE is the authored source)', () => {
		proposeApproval();
		expect(approve().status).toBe('ACCEPTED');
		expect(statusOf(APPROVAL)).toBe('EFFECTIVE');

		const r = revoke(APPROVAL);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(APPROVAL)).toBe('REVOKED');
		expect(h.eventsOfType('DecisionRevoked')).toHaveLength(1);
	});

	it('POSITIVE — revokes an EFFECTIVE WAIVER decision too (the special obligation: NO decisionType predicate)', () => {
		requestWaiver();
		expect(grant().status).toBe('ACCEPTED');
		expect(statusOf(WAIVER)).toBe('EFFECTIVE');

		const r = revoke(WAIVER);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(WAIVER)).toBe('REVOKED');
		expect(h.eventsOfType('DecisionRevoked')).toHaveLength(1);
	});

	it('NEGATIVE (kill) — a re-issue from REVOKED is refused, appends no second DecisionRevoked, bumps no revision', () => {
		proposeApproval();
		approve();
		expect(revoke(APPROVAL).status).toBe('ACCEPTED');
		expect(statusOf(APPROVAL)).toBe('REVOKED');
		const revAfter = h.revisionOf(APPROVAL);

		const again = revoke(APPROVAL);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('DecisionRevoked')).toHaveLength(1);
		expect(h.revisionOf(APPROVAL), 'no silent revision bump').toBe(revAfter);
	});

	it('NEGATIVE (wrong source) — a revoke from PROPOSED is refused with no DecisionRevoked', () => {
		proposeApproval();
		expect(statusOf(APPROVAL)).toBe('PROPOSED');

		const r = revoke(APPROVAL);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(statusOf(APPROVAL)).toBe('PROPOSED');
		expect(h.eventsOfType('DecisionRevoked')).toHaveLength(0);
	});
});

// ────────────── PromoteBaseline (← APPROVED) + SupersedeBaseline (← AUTHORITATIVE) — Baseline.status ─────────────
describe('DWP-04 Baseline — PromoteBaseline fromStates(APPROVED) + code change; SupersedeBaseline fromStates(AUTHORITATIVE)', () => {
	let h: ReturnType<typeof harness>;
	const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
	const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
	const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V02';
	const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V04';
	const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5V05';
	const statusOf = (id: string) => (h.stateOf(id) as { status?: string })?.status ?? '';

	beforeEach(() => {
		h = harness();
	});

	/** Drive the full intent→pwu→assessment→decision→baseline chain to APPROVED, with an EFFECTIVE PROMOTE_BASELINE
	 *  decision that bound the subject's current version (1). Mirrors baseline-stale-decision-version.test.ts::setup. */
	function driveToApproved() {
		seedPolicy(h.engine, 'pol_arch');
		expect(
			h.d('CaptureIntent', INTENT, 'INTENT', {
				intentId: INTENT,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('ProposePwu', PWU, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('RequestAssuranceAssessment', ASSESS, 'ASSURANCE_ASSESSMENT', {
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('CompleteAssuranceAssessment', ASSESS, 'ASSURANCE_ASSESSMENT', {
				validatorResult: floorValidatorResult({
					assessmentId: ASSESS,
					policyId: 'pol_arch',
					subjectId: PWU,
					subjectSemanticVersion: 1,
					disposition: 'SATISFIED'
				})
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('ProposeDecision', DEC, 'DECISION', {
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: [PWU],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: HUMAN
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('ApproveDecision', DEC, 'DECISION', {
				selectedOption: 'promote',
				rationale: 'ready',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PWU]: 1 }
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('CreateBaseline', BASE, 'BASELINE', {
				baselineType: 'ARCHITECTURE',
				itemObjectIds: [PWU],
				assuranceAssessmentIds: [ASSESS]
			}).status
		).toBe('ACCEPTED');
		expect(h.d('SubmitBaselineForReview', BASE, 'BASELINE', {}).status).toBe('ACCEPTED');
		expect(h.d('ApproveBaseline', BASE, 'BASELINE', {}).status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('APPROVED');
	}

	const promote = () =>
		h.d('PromoteBaseline', BASE, 'BASELINE', {
			promotionDecisionId: DEC,
			expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
			requiredAssessmentIds: [ASSESS]
		});

	const supersede = (supersedingBaselineId = 'base_v2') =>
		h.d('SupersedeBaseline', BASE, 'BASELINE', { supersedingBaselineId });

	it('POSITIVE PromoteBaseline — an APPROVED baseline with an EFFECTIVE promotion decision promotes to AUTHORITATIVE', () => {
		driveToApproved();
		const r = promote();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
		expect(h.eventsOfType('BaselinePromoted')).toHaveLength(1);
	});

	it('NEGATIVE (kill) PromoteBaseline — a re-issue from AUTHORITATIVE is refused RPH_ILLEGAL_STATE_TRANSITION (the enumerated CODE CHANGE, F-2/F-3), not RPH_INVARIANT_VIOLATION, with one BaselinePromoted', () => {
		driveToApproved();
		expect(promote().status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
		const revAfter = h.revisionOf(BASE);

		const again = promote();
		expect(again.status).toBe('REJECTED');
		// The enumerated code change: precondition-before-guard makes this the STATE code, not the guard's
		// RPH_INVARIANT_VIOLATION (ILLEGAL_PROMOTION_TRANSITION). This assertion is the mutation red-proof target —
		// deleting `precondition: fromStates('APPROVED')` makes it go RED (the guard returns INVARIANT_VIOLATION).
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('BaselinePromoted')).toHaveLength(1);
		expect(h.revisionOf(BASE), 'no silent revision bump').toBe(revAfter);
	});

	it('POSITIVE SupersedeBaseline — from AUTHORITATIVE supersedes to SUPERSEDED', () => {
		driveToApproved();
		expect(promote().status).toBe('ACCEPTED');
		const r = supersede();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('SUPERSEDED');
		expect(h.eventsOfType('BaselineSuperseded')).toHaveLength(1);
	});

	it('NEGATIVE (kill) SupersedeBaseline — a re-issue from SUPERSEDED is refused, with one BaselineSuperseded', () => {
		driveToApproved();
		promote();
		expect(supersede().status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('SUPERSEDED');
		const revAfter = h.revisionOf(BASE);

		const again = supersede('base_v3');
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('BaselineSuperseded')).toHaveLength(1);
		expect(h.revisionOf(BASE), 'no silent revision bump').toBe(revAfter);
	});

	it('NEGATIVE (wrong source) SupersedeBaseline — from APPROVED (not yet AUTHORITATIVE) is refused, no BaselineSuperseded', () => {
		driveToApproved();
		expect(statusOf(BASE)).toBe('APPROVED');
		const r = supersede();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(statusOf(BASE)).toBe('APPROVED');
		expect(h.eventsOfType('BaselineSuperseded')).toHaveLength(0);
	});
});

// ─────────── AssurancePolicy — Activate (← DRAFT|SUSPENDED), Suspend (← ACTIVE), Supersede (← ACTIVE|SUSPENDED) ────
describe('DWP-04 AssurancePolicy — the three lifecycle preconditions (UNRATIFIED-AUTHORED from the machine, F-4)', () => {
	let h: ReturnType<typeof harness>;
	const statusOf = (id: string) => (h.stateOf(id) as { status?: string })?.status ?? '';
	const tagsOf = (id: string) => ((h.stateOf(id) as { tags?: string[] })?.tags ?? []) as string[];

	beforeEach(() => {
		h = harness();
	});

	/** Create a REGULAR (non-floor) policy — born DRAFT (DOC-002 §18). Shape copied from assurance-policy.test.ts. */
	function createPolicy(id: string) {
		return h.d('CreateAssurancePolicy', id, 'ASSURANCE_POLICY', {
			policyId: id,
			version: '1.0.0',
			name: 'Test Policy',
			purpose: 'p',
			rationale: 'r',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: ['CORRECTNESS'],
			criteria: [
				{
					id: 'C-01',
					name: 'n',
					description: 's',
					criterionType: 'BOOLEAN',
					evaluationMethod: 'MODEL_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'BLOCKING',
					mayBeNotApplicable: false
				}
			],
			evaluatorRole: 'reviewer',
			independenceRequirement: 'DIFFERENT_AGENT',
			findingDefinitions: [
				{
					code: 'F-01',
					name: 'F 01',
					description: 's',
					defaultSeverity: 'MATERIAL',
					affectedClaimTypes: ['CORRECTNESS'],
					defaultControlActions: ['CLARIFY']
				}
			],
			permittedControlActions: ['CLARIFY']
		});
	}

	const activate = (id: string) => h.d('ActivateAssurancePolicy', id, 'ASSURANCE_POLICY', { policyId: id });
	const suspend = (id: string) => h.d('SuspendAssurancePolicy', id, 'ASSURANCE_POLICY', { policyId: id });
	const supersede = (id: string, supersededByPolicyId?: string) =>
		h.d(
			'SupersedeAssurancePolicy',
			id,
			'ASSURANCE_POLICY',
			supersededByPolicyId ? { policyId: id, supersededByPolicyId } : { policyId: id }
		);

	// ── ActivateAssurancePolicy — fromStates('DRAFT','SUSPENDED') — the mandatory two-source positive fixture ──
	it('POSITIVE ActivateAssurancePolicy — from DRAFT (first source) activates to ACTIVE', () => {
		const P = 'pol_dwp04_act_draft';
		expect(createPolicy(P).status).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('DRAFT');
		expect(activate(P).status).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('ACTIVE');
	});

	it('POSITIVE ActivateAssurancePolicy — from SUSPENDED (second source) re-activates to ACTIVE (INV-5 widest-in-arrow)', () => {
		const P = 'pol_dwp04_act_susp';
		createPolicy(P);
		activate(P);
		expect(suspend(P).status).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('SUSPENDED');
		const r = activate(P);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('ACTIVE');
	});

	it('NEGATIVE (kill) ActivateAssurancePolicy — a re-issue from ACTIVE is refused, with one AssurancePolicyActivated', () => {
		const P = 'pol_dwp04_act_kill';
		createPolicy(P);
		expect(activate(P).status).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('ACTIVE');
		const revAfter = h.revisionOf(P);

		const again = activate(P);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('AssurancePolicyActivated')).toHaveLength(1);
		expect(h.revisionOf(P), 'no silent revision bump').toBe(revAfter);
	});

	// ── SuspendAssurancePolicy — fromStates('ACTIVE') ──
	it('POSITIVE SuspendAssurancePolicy — from ACTIVE suspends to SUSPENDED', () => {
		const P = 'pol_dwp04_susp';
		createPolicy(P);
		activate(P);
		const r = suspend(P);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('SUSPENDED');
		expect(h.eventsOfType('AssurancePolicySuspended')).toHaveLength(1);
	});

	it('NEGATIVE (kill) SuspendAssurancePolicy — a re-issue from SUSPENDED is refused, with one AssurancePolicySuspended', () => {
		const P = 'pol_dwp04_susp_kill';
		createPolicy(P);
		activate(P);
		expect(suspend(P).status).toBe('ACCEPTED');
		const revAfter = h.revisionOf(P);

		const again = suspend(P);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('AssurancePolicySuspended')).toHaveLength(1);
		expect(h.revisionOf(P), 'no silent revision bump').toBe(revAfter);
	});

	it('NEGATIVE (wrong source) SuspendAssurancePolicy — from DRAFT is refused, no AssurancePolicySuspended', () => {
		const P = 'pol_dwp04_susp_wrong';
		createPolicy(P);
		expect(statusOf(P)).toBe('DRAFT');
		const r = suspend(P);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(statusOf(P)).toBe('DRAFT');
		expect(h.eventsOfType('AssurancePolicySuspended')).toHaveLength(0);
	});

	// ── SupersedeAssurancePolicy — fromStates('ACTIVE','SUSPENDED') + the F-4 `tags`-not-compounded obligation ──
	it('POSITIVE SupersedeAssurancePolicy — from ACTIVE supersedes and records ONE superseded-by tag', () => {
		const P = 'pol_dwp04_sup_active';
		createPolicy(P);
		activate(P);
		const r = supersede(P, 'pol_dwp04_sup_active_v2');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('SUPERSEDED');
		expect(tagsOf(P).filter((t) => t.startsWith('superseded-by:'))).toHaveLength(1);
	});

	it('POSITIVE SupersedeAssurancePolicy — from SUSPENDED (second source) supersedes (INV-5 widest-in-arrow)', () => {
		const P = 'pol_dwp04_sup_susp';
		createPolicy(P);
		activate(P);
		suspend(P);
		expect(statusOf(P)).toBe('SUSPENDED');
		const r = supersede(P, 'pol_dwp04_sup_susp_v2');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('SUPERSEDED');
	});

	it('NEGATIVE (kill) + F-4 SupersedeAssurancePolicy — a re-issue from SUPERSEDED is refused, appends no second event, and the `tags` array does NOT grow (INV-6)', () => {
		const P = 'pol_dwp04_sup_kill';
		createPolicy(P);
		activate(P);
		expect(supersede(P, 'succ_one').status).toBe('ACCEPTED');
		expect(statusOf(P)).toBe('SUPERSEDED');
		const tagsAfterFirst = tagsOf(P);
		expect(tagsAfterFirst.filter((t) => t.startsWith('superseded-by:'))).toHaveLength(1);
		const revAfter = h.revisionOf(P);

		// The F-4 case: the re-issue supplies a DIFFERENT successor. If the NOOP were admitted, `tags` (an array
		// PUSH) would append a second `superseded-by:succ_two`. The precondition refuses it before mutate runs.
		const again = supersede(P, 'succ_two');
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(h.eventsOfType('AssurancePolicySuperseded')).toHaveLength(1);
		expect(h.revisionOf(P), 'no silent revision bump').toBe(revAfter);
		// tags unchanged: still exactly one superseded-by, and NOT the second successor.
		expect(tagsOf(P)).toEqual(tagsAfterFirst);
		expect(tagsOf(P).some((t) => t.includes('succ_two'))).toBe(false);
	});
});
