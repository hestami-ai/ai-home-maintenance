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
import { expectPwuReplayEquivalence } from './__tests__/pwu-fixtures.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-08-08T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H8100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H8110';
const OTHER_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H8120';
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69H8130';
const ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69H8140';
const OBS = 'obs_01ARZ3NDEKTSV4RRFFQ69H8150';
const OBS_B = 'obs_01ARZ3NDEKTSV4RRFFQ69H8160';
const OBS_ADVISORY = 'obs_01ARZ3NDEKTSV4RRFFQ69H8170';
const OBS_ELSEWHERE = 'obs_01ARZ3NDEKTSV4RRFFQ69H8180';
const OBS_UNRECORDED = 'obs_01ARZ3NDEKTSV4RRFFQ69H8190';

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

	/**
	 * The same act, with the OPTIONAL generic bag ALSO supplied.
	 *
	 * `supportingObjectIds` is a declared field of `RejectPwuPayloadSchema` — `z.array(z.string()).optional()`
	 * on a `strictObject` — so every dispatch below is a contract-valid command any caller can issue. That is
	 * what makes the substitution under test a LIVE hole and not a dead arm: nothing upstream of the handler has
	 * to be forced, and the rows below assert `RPH_INVARIANT_VIOLATION` rather than `VALIDATION_FAILED`, which
	 * is the contract admitting the field inside the assertion itself.
	 */
	const rejectWorkAlsoCiting = (
		decisionId: string,
		blockingObservationIds: string[],
		supportingObjectIds: string[],
		id = PWU
	) =>
		dispatch(
			'RejectPwu',
			{
				rejectionDecisionId: decisionId,
				blockingObservationIds,
				supportingObjectIds,
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
		// REG-F-084: a fold entry is load-bearing only where a test EMITS the event. This is the one place in
		// the repository that emits `PwuRejected` — the reference undertaking never rejects — so without this line
		// `pwu-replay.ts` could drop the case and stay green, which is exactly what W-5's mutant proved.
		expectPwuReplayEquivalence(store, PWU);
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

	// ── JAN-PFA S3.3 — THE DEDICATED CITATION DISCHARGES THE FACT LIMB; THE GENERIC BAG NEVER STANDS IN ──────
	//
	// THE PROMISE. The arrow's own VERBATIM trigger is "Blocking finding", and DOC-001 §6 requires a governance
	// disposition to be "version-bound, evidence-backed". `rejectPwu` discharges that against ONE field —
	// `blockingObservationIds`, which `RejectPwuPayloadSchema` makes REQUIRED. `supportingObjectIds` is an
	// OPTIONAL field of the same payload that THIS handler reads nowhere, and the two are not interchangeable:
	// the required one is the citation an auditor reads back off `PwuRejected`, the optional one is the §37
	// controller's free-form bag that four OTHER guards in `pwu.ts` read for their own, different purposes.
	//
	// ⚠ WHAT THE ROWS ABOVE ASSERT AND WHAT THEY DO NOT. Every one of them proves the fact limb REFUSES — no
	// finding, an ADVISORY finding, a finding about another PWU. Not one supplies `supportingObjectIds` at all,
	// so the suite is blind to WHICH field the guard read: widen the read to
	// `p.supportingObjectIds ?? p.blockingObservationIds` and every row above stays green, because in every one
	// of them the bag is `undefined` and the `??` falls through to the field the guard was supposed to read
	// anyway. The hole that opens is exact: a caller who leaves the required citation empty — or fills it with
	// anything at all — and drops a real blocking finding into the generic bag rejects governed work, and
	// `PwuRejected` then records a `blockingObservationIds` that nothing ever checked.
	//
	// SO THE PROMISE IS ASSERTED OVER THE WHOLE SET of ways the dedicated field can fail, not over one member of
	// it: the previous increment's floor-lock test pinned ONE of three ids and a mutant narrowing the lock to
	// exactly that id passed it. Here a substitution has to survive FIVE dedicated-field failures.
	it('REJECTS however the DEDICATED citation fails, even when the bag names a real blocking finding', () => {
		// The genuine article — a BLOCKING observation whose subjectObjectIds include THIS PWU. It is the only
		// thing that can discharge the fact limb, and it is put ONLY in the bag.
		const real = observation(OBS, PWU, 'BLOCKING');
		const advisory = observation(OBS_ADVISORY, PWU, 'ADVISORY');
		const elsewhere = observation(OBS_ELSEWHERE, OTHER_PWU, 'BLOCKING');
		const dec = decision('REJECTION', [PWU]);

		// Every way the REQUIRED field can fail to name a blocking finding about this PWU.
		const failsTheFactLimb: ReadonlyArray<readonly [string, readonly string[]]> = [
			['naming nothing at all', []],
			['naming an ADVISORY observation about this PWU', [advisory]],
			['naming a BLOCKING observation about a DIFFERENT PWU', [elsewhere]],
			['naming an id that records no object', [OBS_UNRECORDED]],
			['naming an object that is not an observation at all', [OTHER_PWU]]
		];

		for (const [how, cited] of failsTheFactLimb) {
			const r = rejectWorkAlsoCiting(dec, [...cited], [real]);
			expect(
				r.status,
				`blockingObservationIds ${how}, with ${real} sitting in supportingObjectIds: the generic bag ` +
					`discharged the fact limb, so governed work was REJECTED on a citation the guard never read`
			).toBe('REJECTED');
			expect(
				r.error?.code,
				`blockingObservationIds ${how}: the CONTRACT must admit supportingObjectIds and the GUARD must be ` +
					`what refuses — a VALIDATION_FAILED here would mean this arrangement is unreachable, not refused`
			).toBe('RPH_INVARIANT_VIOLATION');
			expect(
				r.error?.message,
				`blockingObservationIds ${how}: the refusal must come from the fact limb`
			).toContain('is a BLOCKING or CRITICAL AssuranceObservation');
			// The refusal ENUMERATES what the caller put in the DEDICATED field. Were `real` to appear here, the
			// guard would be reporting the bag it read — the message is the only place the two are told apart.
			expect(
				r.error?.message,
				`blockingObservationIds ${how}: the refusal enumerates the bag, so the guard read the bag`
			).not.toContain(real);
			expect(
				lifecycle(),
				`blockingObservationIds ${how}: a refused rejection must not have moved the PWU`
			).toBe('UNDER_ASSURANCE');
		}
	});

	// ── CONTROL 3: THE BAG IS INERT, IN BOTH DIRECTIONS ─────────────────────────────────────────────────────
	// Without this, the row above is satisfiable by a guard that refuses EVERY rejection carrying a
	// `supportingObjectIds` key at all — which would read as precision and be a denial of service. Two arms,
	// because the promise is that the optional field changes NOTHING: absent, and present-but-worthless, must
	// both be ACCEPTED on the strength of the dedicated citation alone.
	it('CONTROL — the dedicated citation ADMITS whether the bag is absent or present and worthless', () => {
		const obsA = observation(OBS, PWU, 'BLOCKING');
		const obsB = observation(OBS_B, OTHER_PWU, 'BLOCKING');
		const decA = decision('REJECTION', [PWU]);
		const decB = decision('REJECTION', [OTHER_PWU]);

		// ARM 1 — no bag at all. The plain, legitimate act.
		ok(rejectWork(decA, [obsA], PWU), 'the dedicated citation alone rejects the work');
		expect(lifecycle(PWU)).toBe('REJECTED');

		// ARM 2 — a bag naming real recorded objects that are NOT blocking observations about this PWU, plus an
		// id recording nothing. The dedicated citation is identical in substance to ARM 1's, and the act must be
		// ACCEPTED all the same.
		ok(
			rejectWorkAlsoCiting(decB, [obsB], [PWU, OBS_UNRECORDED], OTHER_PWU),
			'a worthless supportingObjectIds bag must not defeat a valid dedicated citation'
		);
		expect(lifecycle(OTHER_PWU)).toBe('REJECTED');

		// AND THE EVENT RECORDS THE DEDICATED CITATION. `PwuRejected.blockingObservationIds` is what an auditor
		// reads back as the evidence-backing of the §5.2 act, so it must be the field the guard actually checked
		// and not the bag that sat beside it.
		const recorded = store
			.readAllEvents()
			.filter((e) => e.eventType === 'PwuRejected')
			.map((e) => [
				e.aggregateId,
				(e.payload as { blockingObservationIds?: string[] }).blockingObservationIds
			]);
		expect(recorded, 'both rejections are recorded, each citing its own dedicated finding').toEqual([
			[PWU, [obsA]],
			[OTHER_PWU, [obsB]]
		]);
	});
});
