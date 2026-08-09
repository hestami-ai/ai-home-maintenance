// REG-F-078 — REJECTING GOVERNED WORK NEEDS BOTH A GOVERNANCE DECISION AND THE FINDING THAT CAUSED IT.
//
// ⚠ MOVED ONTO `RejectPwu` BY JAN-PWUWP W-1 (REG-D-029). Both conjuncts survive intact; only the caller
// changes. Two things get stronger: `rejectionDecisionId` and `blockingObservationIds` are REQUIRED
// payload fields, so the bare case is refused by the CONTRACT rather than the guard; and the axis
// gymnastics below are gone — the old battery had to hold `assuranceState` by hand so
// `rejectUnbackedDisposition` would not fire first, which is exactly the sort of ordering hazard a
// generic four-axis setter creates and a named command does not.
//
// The dissolving re-reading — "REJECTED just mirrors the assurance verdict, so authority was settled upstream" —
// is refuted by the SOURCE of the clause it would reinterpret. DOC-001's provenance file records "Governance
// outside the six: Guide L336", and Guide L336 says both things in one sentence:
//   "Assurance may record a `REJECTED` Assessment disposition under policy; Governance is an authority function
//    outside the six engineering disciplines and alone authorizes waiver, risk acceptance, rejection or
//    abandonment of governed work, and promotion."
// The disposition is carved OUT of the reserved act. Measured before the guard: the work axis could be driven to
// REJECTED with nothing cited while the assurance axis sat at ASSESSING and no assessment existed.
//
// ⚠ THE BATTERY HOLDS THE ASSURANCE AXIS, DELIBERATELY. The natural shape for a real rejection sets BOTH axes
// to REJECTED — and in that shape `rejectUnbackedDisposition` (pwu.ts) refuses FIRST, so a battery written that
// way would be testing the disposition guard while reporting it as this one. Every row below moves ONLY the work
// axis, which is also the point of the finding: declining to touch the assurance axis was exactly how the act
// evaded the one guard that existed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-08-08T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H8100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H8110';
const OTHER_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H8120';
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69H8130';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69H8140';
const OBS = 'obs_01ARZ3NDEKTSV4RRFFQ69H8150';

describe('REG-F-078 — rejecting governed work requires an authorized decision AND the finding', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'regf078',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const proposePwu = (id: string) =>
		dispatch(
			'ProposePwu',
			{
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: {
					inScope: ['the governed work under test'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: `out_${id}`, kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			},
			id,
			'PROFESSIONAL_WORK_UNIT'
		);

	/** The act, through the command that owns it. The caller NAMES a decision and the findings; the handler
	 *  derives whether either qualifies (JAN-PWUWP R1 derive-on-read). */
	const rejectWork = (decisionId: string, observationIds: string[], id = PWU) =>
		dispatch(
			'RejectPwu',
			{
				rejectionDecisionId: decisionId,
				blockingObservationIds: observationIds,
				reasonCode: 'CONTROLLER'
			},
			id,
			'PROFESSIONAL_WORK_UNIT'
		);

	/** An EFFECTIVE decision of `decisionType` over `subjects`, pinned at their current versions. */
	const decision = (decisionType: string, subjects: string[], approve = true): string => {
		const id = `dec_01ARZ3NDEKTSV4RRFFQ69H8${(200 + seq).toString().padStart(3, '0')}`;
		const pins = Object.fromEntries(
			subjects.map((sid) => [sid, store.loadObject(sid)?.semanticVersion ?? 1])
		);
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType,
					subjectObjectIds: subjects,
					selectedOption: 'reject',
					rationale: 'the blocking finding stands',
					authority: actor,
					consideredEvidenceIds: [],
					consideredObservationIds: []
				},
				id,
				'DECISION'
			),
			`propose ${decisionType}`
		);
		if (approve)
			ok(
				dispatch(
					'ApproveDecision',
					{
						selectedOption: 'reject',
						rationale: 'the blocking finding stands',
						consideredEvidenceIds: [],
						consideredObservationIds: [],
						subjectSemanticVersions: pins
					},
					id,
					'DECISION'
				),
				`approve ${decisionType}`
			);
		return id;
	};

	/** A real AssuranceObservation about `subject`, at `severity`, via a real policy and assessment. */
	const observation = (obsId: string, subject: string, severity: string): string => {
		// A ULID is fixed-length; appending a counter makes an id the contract refuses.
		const assessmentId = ASSESSMENT.slice(0, -2) + String(seq).padStart(2, '0');
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: POLICY,
					policyVersion: '1.0.0',
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: store.loadObject(subject)?.semanticVersion ?? 1 },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			),
			'request assessment'
		);
		ok(dispatch('BeginAssuranceAssessment', {}, assessmentId, 'ASSURANCE_ASSESSMENT'), 'begin');
		ok(
			dispatch(
				'RecordAssuranceObservation',
				{
					assessmentId,
					observationType: 'FINDING',
					findingCode: 'UNFIT',
					severity,
					statement: 'the work does not meet its approved need'
				},
				obsId,
				'ASSURANCE_OBSERVATION'
			),
			`record ${severity} observation`
		);
		// The observation's subject is DERIVED from the assessment, not caller-supplied — assert the arrangement
		// actually took, because an empty `subjectObjectIds` would make the fact conjunct unsatisfiable and every
		// reject row below would pass for the wrong reason.
		expect(
			(store.loadObject(obsId)!.state as { subjectObjectIds?: string[] }).subjectObjectIds,
			'the observation must be ABOUT the subject'
		).toContain(subject);
		return obsId;
	};

	const refusedByTheRejectGuard = (
		r: { status: string; error?: { code?: string; message?: string } },
		because: string
	) => {
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal must come from the rejection guard').toContain(
			'JPWB-DOC-001 §5.2'
		);
		expect(r.error?.message, 'and from RejectPwu, not from some earlier gate').toContain('RejectPwu');
		expect(r.error?.message, because).toContain(because);
	};

	const lifecycle = (id = PWU) =>
		(store.loadObject(id)!.state as { workLifecycleState: string }).workLifecycleState;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'intent'
		);
		ok(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT'), 'discovery');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT'), 'provisional');
		ok(proposePwu(PWU), 'pwu');
		ok(proposePwu(OTHER_PWU), 'other pwu');
		ok(
			dispatch(
				'CreateAssurancePolicy',
				{
					policyId: POLICY,
					version: '1.0.0',
					name: 'Fitness',
					purpose: 'Assess the subject against its approved need.',
					rationale: 'Seeded for the REG-F-078 battery.',
					applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
					evaluatedClaimTypes: ['FITNESS'],
					criteria: [
						{
							id: 'C1',
							name: 'Fit',
							description: 'The subject is fit for its approved need.',
							criterionType: 'QUALITATIVE',
							evaluationMethod: 'HUMAN_JUDGMENT',
							requiredEvidenceIds: [],
							severityIfNotMet: 'BLOCKING',
							mayBeNotApplicable: false
						}
					],
					evaluatorRole: 'REVIEWER',
					independenceRequirement: 'NONE',
					findingDefinitions: [
						{
							code: 'UNFIT',
							name: 'Unfit',
							description: 'Not fit for the approved need.',
							defaultSeverity: 'CRITICAL',
							affectedClaimTypes: ['FITNESS'],
							defaultControlActions: ['CONTINUE']
						}
					],
					permittedControlActions: ['CONTINUE']
				},
				POLICY,
				'ASSURANCE_POLICY'
			),
			'policy'
		);
		ok(dispatch('ActivateAssurancePolicy', { policyId: POLICY }, POLICY, 'ASSURANCE_POLICY'), 'activate');
		// ARRANGEMENT, NOT THE THING UNDER TEST. UNDER_ASSURANCE has exactly one in-arrow, from EVIDENCE_PENDING,
		// which is itself gated on a cited EXECUTION_PLAN with a succeeded step. Building that chain here would
		// make the fixture's own execution guard the subject. The named escape hatch validates the patched
		// aggregate against the ratified schema AND the state against the ratified machine before writing, so it
		// cannot arrange a shape the contract forbids — which is why it is named, and used sparingly.
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'UNDER_ASSURANCE');
		seedPwuWorkLifecycleState_FIXTURE(store, OTHER_PWU, 'UNDER_ASSURANCE');
	});

	// ── THE ACCEPT CASE ───────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS with an EFFECTIVE REJECTION decision AND a blocking observation about this PWU', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		const dec = decision('REJECTION', [PWU]);
		ok(rejectWork(dec, [obs]), 'authorized, evidenced rejection');
		expect(lifecycle()).toBe('REJECTED');
	});

	// ── ONE REJECT PER CONJUNCT ───────────────────────────────────────────────────────────────────────────────
	it('REJECTS with nothing named — now refused by the CONTRACT, which is stronger than the guard', () => {
		// Both citations are REQUIRED fields of RejectPwuPayload, so the bare case never reaches either conjunct.
		// The hole this file was written for — the work axis driven to REJECTED with nothing cited at all — is
		// now unrepresentable rather than merely refused.
		const r = dispatch('RejectPwu', { reasonCode: 'CONTROLLER' }, PWU, 'PROFESSIONAL_WORK_UNIT');
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(lifecycle(), 'a refused rejection must not have moved the PWU').toBe('UNDER_ASSURANCE');
	});

	it('REJECTS a decision WITHOUT a finding — authority alone does not reject work', () => {
		const dec = decision('REJECTION', [PWU]);
		refusedByTheRejectGuard(rejectWork(dec, []), 'is a BLOCKING or CRITICAL AssuranceObservation');
	});

	it('REJECTS a finding WITHOUT a decision — the finding is the trigger, not the authority', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		refusedByTheRejectGuard(rejectWork('dec_does_not_exist', [obs]), 'names no recorded object');
	});

	it('REJECTS an APPROVAL standing in for a REJECTION decision', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		const dec = decision('APPROVAL', [PWU]);
		refusedByTheRejectGuard(rejectWork(dec, [obs]), 'requires decisionType=REJECTION');
	});

	it('REJECTS a PROPOSED (unapproved) REJECTION decision', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		const dec = decision('REJECTION', [PWU], false);
		refusedByTheRejectGuard(rejectWork(dec, [obs]), 'not EFFECTIVE');
	});

	it('REJECTS a decision scoped to a DIFFERENT PWU (RPH-GOV-005)', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		const dec = decision('REJECTION', [OTHER_PWU]);
		refusedByTheRejectGuard(rejectWork(dec, [obs]), 'does not bleed to another object');
	});

	it('REJECTS an ADVISORY observation — severity is read off the stored object, not asserted', () => {
		const obs = observation(OBS, PWU, 'ADVISORY');
		const dec = decision('REJECTION', [PWU]);
		refusedByTheRejectGuard(rejectWork(dec, [obs]), 'is a BLOCKING or CRITICAL AssuranceObservation');
	});

	it('REJECTS a blocking observation about a DIFFERENT PWU', () => {
		const obs = observation(OBS, OTHER_PWU, 'BLOCKING');
		const dec = decision('REJECTION', [PWU]);
		refusedByTheRejectGuard(rejectWork(dec, [obs]), 'is a BLOCKING or CRITICAL AssuranceObservation');
	});

	// ── CONTROL 1: THE OWNERSHIP CONJUNCT LANDED IN THIS SAME COMMIT ────────────────────────────────────────
	// W-1 moves the guard OFF `ChangePwuState`. Had the ownership row not landed with it, the setter would still
	// perform `-> REJECTED` with nothing checking authority — re-opening this file's own finding. Predicted red
	// for the mutant deleting `REJECTED` from `PWU_SEMANTIC_LIFECYCLE_COMMANDS`, and only for it.
	it('CONTROL — the generic setter refuses the arrow outright and names the command', () => {
		const r = dispatch(
			'ChangePwuState',
			{
				previousState: 'UNDER_ASSURANCE',
				newState: 'REJECTED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message, 'the setter must redirect, not adjudicate').toContain(
			'Dispatch RejectPwu instead'
		);
		expect(lifecycle()).toBe('UNDER_ASSURANCE');
	});

	// ── CONTROL 2: BOTH CITATIONS ARE THE ONLY DIFFERENCE ───────────────────────────────────────────────────
	// Proves the command DECIDES rather than refusing everything: same dispatch, same PWU, same state, differing
	// only in what is named. A refusal from the schema, the machine or an earlier gate could not be cured by
	// naming a valid decision and a real blocking finding.
	it('CONTROL — the identical dispatch is refused on a bad decision and accepted on a good one', () => {
		const obs = observation(OBS, PWU, 'BLOCKING');
		expect(rejectWork('dec_does_not_exist', [obs]).status).toBe('REJECTED');
		expect(lifecycle()).toBe('UNDER_ASSURANCE');
		const dec = decision('REJECTION', [PWU]);
		ok(rejectWork(dec, [obs]), 'the same dispatch, now authorized and evidenced');
		expect(lifecycle()).toBe('REJECTED');
	});
});
