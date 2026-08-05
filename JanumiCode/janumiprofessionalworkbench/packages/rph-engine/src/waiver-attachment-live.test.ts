// THE WAIVER ATTACHMENT PREDICATE, OVER REAL EVENTS (REG-F-020).
//
// `foldWaiverRequested` (rph-projections/src/assurance-view.ts) attaches a PROPOSED waiver to an assessment only
// when the waiver's `waivedPolicyId` matches the assessment's policy. Its own test asserts exactly that — "a
// waiver for a DIFFERENT policy does NOT attach — no over-reach" — and BUILDS ITS EVENTS BY HAND.
//
// SO THAT TEST CANNOT SEE THE FAILURE THAT MATTERS. The predicate has a deliberate permissive branch,
// `waivedPolicyId === undefined || …`, for a waiver that names no policy. If the HANDLER ever stopped emitting
// `waivedPolicyId`, every real waiver would take that branch and attach to every assessment whose subjects it
// intersects — under ANY policy — and the hand-built test would stay GREEN, because its fixtures supply the field
// the handler no longer does. That is not hypothetical: conforming `WaiverRequested` to its then-declared shape
// would have done precisely this, and the first attempt at REG-F-020 refused the fix for that reason.
//
// This drives a REAL `RequestWaiver` through the command bus and folds the REAL event log, so the projection is
// tested against what the engine actually emits. It is the control the hand-built test cannot be.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { Engine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { buildAssuranceView } from '@janumipwb/rph-projections';
import { beforeEach, describe, expect, it } from 'vitest';

const TS = '2026-08-04T00:00:00Z';
const ACTOR: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Lead' };
const POLICY_A = 'pol_01ARZ3NDEKTSV4RRFFQ69JB100';
const POLICY_B = 'pol_01ARZ3NDEKTSV4RRFFQ69JB200';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69JB300';
const ASSESS_A = 'asm_01ARZ3NDEKTSV4RRFFQ69JB400';
const ASSESS_B = 'asm_01ARZ3NDEKTSV4RRFFQ69JB500';
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69JB600';

describe('REG-F-020: the waiver attachment predicate holds over REAL emitted events', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const cmd = (
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	): DomainCommand => {
		const n = ++seq;
		return {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			issuedBy: ACTOR,
			correlationId: 'reg-f-020-waiver',
			idempotencyKey: `k-${n}`,
			payload
		};
	};

	const ok = (c: DomainCommand): void => {
		const r = engine.dispatch(c);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`${c.commandType} rejected: ${JSON.stringify(r.error)}`);
		}
	};

	const createPolicy = (policyId: string, name: string): void =>
		ok(
			cmd('CreateAssurancePolicy', policyId, 'ASSURANCE_POLICY', {
				policyId,
				version: '1.0.0',
				name,
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'd',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: 'NONE',
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE', 'REQUEST_HUMAN_DECISION', 'RESHAPE_PWU'],
				waiverRules: []
			})
		);

	/** A policy governs an assessment only while ACTIVE (DOC-002 §18), so the seam refuses a DRAFT one. */
	const activatePolicy = (policyId: string): void =>
		ok(cmd('ActivateAssurancePolicy', policyId, 'ASSURANCE_POLICY', { policyId }));

	/** Two assessments over the SAME subject under DIFFERENT policies — the arrangement the predicate discriminates. */
	const requestAssessment = (assessmentId: string, policyId: string): void => {
		ok(
			cmd('RequestAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				assessmentId,
				assurancePolicyId: policyId,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
		// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
		// assessment in READY, so it must be BEGUN before it can be assessed or completed.
		ok(cmd('BeginAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {}));
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
		createPolicy(POLICY_A, 'Policy A');
		createPolicy(POLICY_B, 'Policy B');
		activatePolicy(POLICY_A);
		activatePolicy(POLICY_B);
		requestAssessment(ASSESS_A, POLICY_A);
		requestAssessment(ASSESS_B, POLICY_B);
		ok(
			cmd('RequestWaiver', WAIVER, 'DECISION', {
				subjectObjectIds: [SUBJECT],
				scope: 'CRITERION',
				rationale: 'operational necessity',
				duration: 'P30D',
				affectedObjectIds: [],
				waivedPolicyId: POLICY_A,
				waivedCriterionId: 'C1',
				waivedFindingIds: [],
				compensatingControls: [],
				reviewConditions: []
			})
		);
	});

	const view = () => buildAssuranceView(store.readAllEvents());

	it('the waiver attaches to the assessment under the policy it names', () => {
		const a = view().assessments[ASSESS_A];
		expect(a, 'the assessment must be in the view for the assertion to mean anything').toBeDefined();
		expect(a?.waivers.map((w) => w.waiverDecisionId)).toEqual([WAIVER]);
		// The §38 content the projection reads off this event, all of it sourced from the real payload.
		expect(a?.waivers[0]?.waivedPolicyId).toBe(POLICY_A);
		expect(a?.waivers[0]?.waivedCriterionId).toBe('C1');
		expect(a?.waivers[0]?.status).toBe('PROPOSED');
	});

	// THE ONE THAT MATTERS. Stop emitting `waivedPolicyId` and this reddens while the hand-built projection test
	// stays green — because that test supplies the field the handler would no longer send.
	it('CONTROL: it does NOT attach to an assessment under a DIFFERENT policy', () => {
		const b = view().assessments[ASSESS_B];
		expect(b, 'the other assessment must exist, or the non-attachment is vacuous').toBeDefined();
		expect(
			b?.waivers,
			'a waiver naming POLICY_A must not attach to an assessment under POLICY_B — the permissive ' +
				'`waivedPolicyId === undefined` branch must not be reachable from a real dispatch'
		).toEqual([]);
	});

	// And the field is genuinely present on the wire, not merely defaulted somewhere downstream.
	it('the emitted WaiverRequested payload carries the attachment key', () => {
		const emitted = store
			.readAllEvents()
			.filter((e) => e.eventType === 'WaiverRequested')
			.map((e) => e.payload as { waivedPolicyId?: string });
		expect(emitted).toHaveLength(1);
		expect(emitted[0]?.waivedPolicyId).toBe(POLICY_A);
	});
});
