// ABSENT IS NOT SUPPLIED, AND SUPPLIED IS NOT ABSENT — the assurance handlers' half of that distinction.
//
// ── WHAT THIS FILE PROTECTS ──────────────────────────────────────────────────────────────────────────────────
// `handlers/assurance.ts` repeatedly decides what to do about something that may or may not be there: an
// optional payload field, a target aggregate, an escalation rule that names no severity, a subject with no
// kind. Each such decision has two arms, and the arms mean opposite things:
//
//   SUPPLIED -> the value must reach the GOVERNED RECORD. A field the command accepts and the event drops is
//               the authored-then-dropped shape REG-F-022 records — the caller stated a fact and the audit log
//               does not have it. `handlers/assurance.ts` itself calls this class out at `EDITABLE_PATCH_FIELDS`
//               ("an edit that supplied it had it SILENTLY DROPPED").
//   ABSENT   -> the handler must not invent one. An omitted optional stays OMITTED on the event (the file's own
//               words at `proposeEvidence`: "absent = not specified, never a fabricated empty"); an absent
//               target REFUSES rather than proceeding against `undefined`; an absent severity list does not fire
//               the rule that would have named it; an absent subject is DECLINED, not decided against.
//
// Both arms had gone unexercised across a family of these. That is the precise condition in which the two
// collapse into each other unnoticed: the handler keeps compiling, every existing test keeps passing, and the
// difference between "the professional said nothing" and "the professional said nothing of consequence" is
// erased in the one record that is supposed to hold it.
//
// ── HOW IT ASSERTS ───────────────────────────────────────────────────────────────────────────────────────────
// Every test drives the LIVE command bus and pins a VALUE or a MESSAGE — the emitted payload compared whole (so
// an extra key fails too), the refusal string compared byte-for-byte (so a guard that refuses for a DIFFERENT
// reason fails), or the resulting state. No test asserts merely that something was refused.
//
// ── WHAT IT DELIBERATELY DOES NOT CLOSE ──────────────────────────────────────────────────────────────────────
//   - `parseCompletion`'s disposition refusal. `ValidatorResultSchema.dispositionRecommendation` is the SAME
//     ratified enum `DISPOSITIONS` is derived from, and `validatorResult` is required, so no dispatched command
//     can reach that arm. It is a TS-narrowing guard, not a live gate, and no test here reaches around the
//     command boundary to colour it green.
//   - The `permittedControlActions === undefined` skips in `rejectRemediationActionsNotPermitted` and
//     `rejectUnpermittedControlActions`. `CreateAssurancePolicyPayloadSchema` makes the field REQUIRED and the
//     edit path falls back to the stored value, so ABSENT is unreachable from any command — only the EMPTY arm
//     is, and `assurance-independence.test.ts` already parameterises that.
//   - Authentication. As `claim-assessment.test.ts` records, one actor issues every command here; the producer
//     and evaluator identities below are asserted facts on the wire, not unforgeable ones.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-12T00:00:00Z';
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69K0001';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69K0002';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69K0003';
const ACTOR: ActorReference = { actorId: 'author-1', actorType: 'HUMAN', displayName: 'Author' };

describe('assurance handlers — an absent input and a supplied one must not collapse into each other', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
	});

	const dispatch = (
		commandType: string,
		aggregateId: string,
		aggregateType: string,
		payload: unknown
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggregateType,
			targetAggregateId: aggregateId,
			issuedAt: TS,
			correlationId: 'absent-versus-supplied',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	/** Dispatch an ARRANGEMENT step, which must succeed — a fixture may not silently arrange nothing. */
	function arrange(
		commandType: string,
		aggregateId: string,
		aggregateType: string,
		payload: unknown
	): void {
		const r = dispatch(commandType, aggregateId, aggregateType, payload);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`arranging ${commandType} (${aggregateId}): ${JSON.stringify(r.error)}`);
		}
	}

	/** Create + ACTIVATE a regular catalog policy (born DRAFT per DOC-002 §18, so it must be activated). */
	function createPolicy(
		policyId: string,
		opts: {
			independenceRequirement?: string;
			requiredEvidence?: unknown[];
			escalationRules?: unknown[];
		} = {}
	): void {
		arrange('CreateAssurancePolicy', policyId, 'ASSURANCE_POLICY', {
			policyId,
			version: '1.0.0',
			name: `Policy ${policyId}`,
			purpose: 'Assess the subject against its approved need.',
			rationale: 'Seeded for an absent-versus-supplied drive.',
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
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				}
			],
			evaluatorRole: 'REVIEWER',
			independenceRequirement: opts.independenceRequirement ?? 'NONE',
			findingDefinitions: [
				{
					code: 'UNFIT',
					name: 'Unfit',
					description: 'Not fit for the approved need.',
					defaultSeverity: 'MATERIAL',
					affectedClaimTypes: ['FITNESS'],
					defaultControlActions: ['CONTINUE']
				}
			],
			permittedControlActions: ['CONTINUE'],
			// Omitted rather than sent as [] when the caller did not ask for them: the ABSENT form is what a
			// seeded policy actually carries, and this file is about that difference.
			...(opts.requiredEvidence ? { requiredEvidence: opts.requiredEvidence } : {}),
			...(opts.escalationRules ? { escalationRules: opts.escalationRules } : {})
		});
		arrange('ActivateAssurancePolicy', policyId, 'ASSURANCE_POLICY', { policyId });
	}

	/** A §6.1 EvidenceRequirement that gates only a SATISFIED verdict — so the assessment still lands READY. */
	const requirement = (id: string) => ({
		id,
		evidenceType: 'TEST_RESULT',
		description: `Evidence for ${id}`,
		purpose: 'Demonstrate the criterion is met.',
		cardinality: 'EXACTLY_ONE',
		admissibilityRules: [],
		requiredForDispositions: 'SATISFIED_ONLY',
		mayBeWaived: false
	});

	function requestAssessment(
		assessmentId: string,
		policyId: string,
		subjectIds: string[] = [SUBJECT]
	): ReturnType<typeof dispatch> {
		const versions: Record<string, number> = {};
		for (const s of subjectIds) versions[s] = 1;
		return dispatch('RequestAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
			assessmentId,
			assurancePolicyId: policyId,
			policyVersion: '1.0.0',
			subjectObjectIds: subjectIds,
			subjectSemanticVersions: versions,
			claimIds: []
		});
	}

	/** Request + begin, asserting both — the READY -> ASSESSING arrow is its own §32 act (REG-F-021 inc. 3). */
	function driveToAssessing(assessmentId: string, policyId: string): void {
		const r = requestAssessment(assessmentId, policyId);
		if (r.status !== 'ACCEPTED') {
			throw new Error(`arranging RequestAssuranceAssessment: ${JSON.stringify(r.error)}`);
		}
		arrange('BeginAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {});
	}

	/** A complete, schema-valid DOC-007 §20 verdict. */
	function verdict(
		assessmentId: string,
		policyId: string,
		disposition: string,
		evaluator?: ActorReference
	): Record<string, unknown> {
		return {
			validatorId: 'reviewer',
			validatorVersion: '1',
			policyId,
			policyVersion: '1.0.0',
			assessmentId,
			subjectObjectIds: [SUBJECT],
			subjectSemanticVersions: { [SUBJECT]: 1 },
			claimResults: [],
			evidenceConsideredIds: [],
			evidenceRejected: [],
			observations: [],
			dispositionRecommendation: disposition,
			recommendedControlActions: [],
			residualUncertainty: [],
			limitations: [],
			executionProvenance: evaluator ? { evaluator } : {}
		};
	}

	const stateOf = (id: string) =>
		store.loadObject(id)?.state as Record<string, unknown> | undefined;

	const payloadOf = (eventType: string, aggregateId: string): Record<string, unknown> => {
		const found = store
			.readAllEvents()
			.filter((e) => e.eventType === eventType && e.aggregateId === aggregateId);
		expect(found, `expected exactly one ${eventType} on ${aggregateId}`).toHaveLength(1);
		return found[0]!.payload as Record<string, unknown>;
	};

	const assertClaim = (claimId = CLAIM) =>
		arrange('AssertClaim', claimId, 'CLAIM', {
			statement: 'the tenant isolation boundary holds',
			claimType: 'COMPLETENESS',
			subjectObjectIds: [SUBJECT]
		});

	// ── RecordClaimAssessment: the ClaimRejected arm, which had NO emitter of any kind ────────────────────────
	// `eventPayload`'s final arm builds the ClaimRejected payload and was reached by nothing, so BOTH of its
	// conditional spreads were unexercised — the supplied case and the omitted case at once. §26.5 makes both
	// fields optional, which is exactly why the difference has to be observable.

	it('ClaimRejected carries the assessmentId and rationale the command supplied, and nothing else', () => {
		assertClaim();
		arrange('RecordClaimAssessment', CLAIM, 'CLAIM', { targetStatus: 'UNDER_ASSESSMENT' });

		const r = dispatch('RecordClaimAssessment', CLAIM, 'CLAIM', {
			targetStatus: 'REJECTED',
			assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69K0010',
			rationale: 'the subject contradicts its own declared boundary'
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		expect(payloadOf('ClaimRejected', CLAIM)).toEqual({
			assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69K0010',
			rationale: 'the subject contradicts its own declared boundary',
			status: 'REJECTED'
		});
		expect(stateOf(CLAIM)?.status).toBe('REJECTED');
	});

	it('a rejection supplying neither leaves BOTH keys off the event — an absent optional is not an empty one', () => {
		// The contrast that makes the test above mean something. Emitting `assessmentId: undefined` or
		// `rationale: ''` would say the assessor was asked and gave nothing, which is a different claim from
		// never having been asked — and §26.5 declares both fields optional precisely so silence is expressible.
		assertClaim();
		arrange('RecordClaimAssessment', CLAIM, 'CLAIM', { targetStatus: 'UNDER_ASSESSMENT' });

		const r = dispatch('RecordClaimAssessment', CLAIM, 'CLAIM', { targetStatus: 'REJECTED' });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		const payload = payloadOf('ClaimRejected', CLAIM);
		expect(Object.keys(payload).sort()).toEqual(['status']);
		expect(payload).toEqual({ status: 'REJECTED' });
	});

	it('ClaimContested records the contradicting evidence the assessment named, not the claim’s birth value', () => {
		// `assertClaim` writes `contradictingEvidenceIds: []` at birth. If the mutator dropped the supplied ids
		// the claim would keep that [] and the event would faithfully report it — a record that is internally
		// consistent and factually empty, which is the failure mode worth pinning.
		assertClaim();
		arrange('RecordClaimAssessment', CLAIM, 'CLAIM', { targetStatus: 'UNDER_ASSESSMENT' });
		expect(stateOf(CLAIM)?.contradictingEvidenceIds).toEqual([]);

		const r = dispatch('RecordClaimAssessment', CLAIM, 'CLAIM', {
			targetStatus: 'CONTESTED',
			contradictingEvidenceIds: ['evd_01ARZ3NDEKTSV4RRFFQ69K0021', 'evd_01ARZ3NDEKTSV4RRFFQ69K0022']
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		expect(stateOf(CLAIM)?.contradictingEvidenceIds).toEqual([
			'evd_01ARZ3NDEKTSV4RRFFQ69K0021',
			'evd_01ARZ3NDEKTSV4RRFFQ69K0022'
		]);
		expect(payloadOf('ClaimContested', CLAIM)).toEqual({
			contradictingEvidenceIds: [
				'evd_01ARZ3NDEKTSV4RRFFQ69K0021',
				'evd_01ARZ3NDEKTSV4RRFFQ69K0022'
			],
			status: 'CONTESTED'
		});
	});

	// ── The optional facts a creation command accepts must survive onto its event ─────────────────────────────

	it('EvidenceProposed carries the contradicted claims and the limitations the proposal declared', () => {
		arrange('ProposeEvidence', 'evd_01ARZ3NDEKTSV4RRFFQ69K0030', 'EVIDENCE', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0030',
			evidenceType: 'TEST_RESULT',
			contentReference: { uri: 'ref://suite/isolation' },
			producedBy: ACTOR,
			supportsClaimIds: [],
			contradictsClaimIds: [CLAIM],
			scope: 'tenant isolation',
			limitations: ['single-tenant bench only', 'no fault injection'],
			capturedAt: TS
		});
		const declared = payloadOf('EvidenceProposed', 'evd_01ARZ3NDEKTSV4RRFFQ69K0030');
		expect(declared.contradictsClaimIds).toEqual([CLAIM]);
		expect(declared.limitations).toEqual(['single-tenant bench only', 'no fault injection']);

		// The other arm, same command, same shape: EMPTY arrays are not a statement, so the keys come off.
		arrange('ProposeEvidence', 'evd_01ARZ3NDEKTSV4RRFFQ69K0031', 'EVIDENCE', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0031',
			evidenceType: 'TEST_RESULT',
			contentReference: { uri: 'ref://suite/isolation' },
			producedBy: ACTOR,
			supportsClaimIds: [],
			contradictsClaimIds: [],
			scope: 'tenant isolation',
			limitations: [],
			capturedAt: TS
		});
		const silent = payloadOf('EvidenceProposed', 'evd_01ARZ3NDEKTSV4RRFFQ69K0031');
		expect(Object.keys(silent)).not.toContain('contradictsClaimIds');
		expect(Object.keys(silent)).not.toContain('limitations');
	});

	it('AssumptionDetected carries the source artifact and execution attempt that introduced the assumption', () => {
		// §12.2 declares both, and they are the only fields on the event that say WHERE the assumption came
		// from. Dropped, the assumption is first-class and untraceable — which is the state detectAssumption
		// exists to end ("a material assumption must not stay in prose").
		arrange('DetectAssumption', 'asu_01ARZ3NDEKTSV4RRFFQ69K0040', 'ASSUMPTION', {
			assumptionId: 'asu_01ARZ3NDEKTSV4RRFFQ69K0040',
			statement: 'the upstream index is rebuilt nightly',
			introducedBy: ACTOR,
			affectedObjectIds: [SUBJECT],
			materiality: 'MATERIAL',
			sourceArtifactId: 'art_01ARZ3NDEKTSV4RRFFQ69K0041',
			sourceExecutionAttemptId: 'exa_01ARZ3NDEKTSV4RRFFQ69K0042'
		});
		const payload = payloadOf('AssumptionDetected', 'asu_01ARZ3NDEKTSV4RRFFQ69K0040');
		expect(payload.sourceArtifactId).toBe('art_01ARZ3NDEKTSV4RRFFQ69K0041');
		expect(payload.sourceExecutionAttemptId).toBe('exa_01ARZ3NDEKTSV4RRFFQ69K0042');
	});

	// ── A creation event reports the status the object was BORN in, not the spec text’s literal ─────────────────
	it('AssumptionDetected reports PROPOSED — the status the object HAS, not §12.2’s DISCLOSED literal', () => {
		// ⭐ CLOSES the JAN-PFA precision gap inventoried for `detectAssumption`: the mutation
		// `status: state.status` → `status: 'DISCLOSED'`. Nothing asserted this field and nothing would have
		// noticed — `AssumptionStatusSchema` accepts DISCLOSED so the event gate passes the mutant, the OBJECT's
		// PROPOSED (pinned in assumption-falsification.test.ts) is left untouched, replay-conformance compares
		// event TYPES, and the test directly above reads this very payload while saying nothing about `status`.
		//
		// THE PROMISE, which the handler argues rather than assumes: §12.2 writes the literal
		// `status: 'DISCLOSED'` into this payload, and DOC-002 §26.3 makes DISCLOSED a SEPARATE
		// AssumptionDisclosed transition — so the event reports the status the object ACTUALLY has, because
		// "emitting DISCLOSED would make the event contradict the object it describes". Under the mutant a
		// reader folding detection events sees every assumption disclosed to the professional at the instant it
		// was found, and the disclosure act that follows is the second disclosure of something already disclosed.
		const id = 'asu_01ARZ3NDEKTSV4RRFFQ69K0043';
		arrange('DetectAssumption', id, 'ASSUMPTION', {
			assumptionId: id,
			statement: 'connectivity is available when the job starts',
			introducedBy: ACTOR,
			affectedObjectIds: [SUBJECT],
			materiality: 'MATERIAL'
		});
		expect(payloadOf('AssumptionDetected', id).status).toBe('PROPOSED');
		// The event and the object agree, which is the whole of what the handler promises here.
		expect(stateOf(id)?.status).toBe('PROPOSED');

		// ⛔ THE CONTROL. "status is PROPOSED" would also hold for a vocabulary in which DISCLOSED is unsayable,
		// or for a reader of mine that can only ever return the birth value — either would make the assertion
		// above green without discriminating anything. DiscloseAssumption drives the SAME aggregate one arrow on
		// and the SAME reader returns DISCLOSED off the governed event: the value the mutant emits is real,
		// schema-valid and observable right here; it simply belongs to a different act.
		arrange('DiscloseAssumption', id, 'ASSUMPTION', {});
		expect(payloadOf('AssumptionDisclosed', id).status).toBe('DISCLOSED');
		expect(stateOf(id)?.status).toBe('DISCLOSED');
		// And the detection event still says PROPOSED once the assumption IS disclosed — it records the status
		// at DETECTION, so the two events remain distinguishable acts rather than one fact written twice.
		expect(payloadOf('AssumptionDetected', id).status).toBe('PROPOSED');
	});

	// ── An absent TARGET refuses, and says which target ───────────────────────────────────────────────────────

	it('RecordAssuranceObservation refuses a finding against an assessment that does not exist, and names it', () => {
		// The observation inherits its policy and subjects FROM the assessment. Against a missing one it would
		// inherit `undefined` for both and persist an observation attached to nothing — a finding in the log
		// that no assessment ever made.
		const r = dispatch(
			'RecordAssuranceObservation',
			'obs_01ARZ3NDEKTSV4RRFFQ69K0050',
			'ASSURANCE_OBSERVATION',
			{
				assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69K0051',
				observationType: 'FINDING',
				severity: 'MATERIAL',
				statement: 'the boundary is not demonstrated'
			}
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(
			'RecordAssuranceObservation requires an existing assessment asm_01ARZ3NDEKTSV4RRFFQ69K0051'
		);
		expect(store.loadObject('obs_01ARZ3NDEKTSV4RRFFQ69K0050')).toBeUndefined();
	});

	// ── And when the target IS there, the new record inherits what the target holds ─────────────────────────────
	it('an observation inherits the policy and subjects OF THE ASSESSMENT IT NAMES — two assessments, two policies', () => {
		// ⭐ CLOSES the JAN-PFA precision gap inventoried for `recordAssuranceObservation`: the mutation
		// `policyId: assessment.assurancePolicyId ?? p.assessmentId` → `policyId: p.assessmentId`. The test
		// directly above asserts only the NEGATIVE half of the inheritance sentence — a missing assessment
		// refuses, by exact message — and the inherited VALUE was asserted nowhere in the repo. So an
		// observation could be persisted AND emitted carrying its own assessment's id in §21.1's REQUIRED
		// `policyId` — a finding filed against a policy that does not exist — with every test still green.
		//
		// THE PROMISE: §21.1 makes `policyId` required on AssuranceObservationRecorded and the observation
		// INHERITS it from the assessment. It cannot come from anywhere else: the command payload is
		// assessmentId / observationType / findingCode / severity / statement / evidenceIds and nothing more, so
		// the assessment is the only source of the policy this finding is raised under. `subjectObjectIds` is
		// the other half of the same inheritance and was equally unasserted, so it is pinned here too.
		//
		// ⛔ AND THE CONTROL IS THE PAIR. Two assessments, under DIFFERENT policies and over DIFFERENT subjects,
		// each taking one observation. A single assessment would stay green for a handler that hard-coded this
		// policy, or that read "the" policy from anywhere at all; only the pair forces each observation to track
		// the assessment it was actually recorded against. The positive case is also the admitting control for
		// the refusal above — a guard that rejected every RecordAssuranceObservation satisfies that test alone.
		//
		// NOTE the arm that is NOT tested, and why it needs none: `?? p.assessmentId` fires only for a named
		// object carrying no assurancePolicyId (RequestAssuranceAssessment makes assurancePolicyId REQUIRED), and
		// on that arm HEAD and the mutant emit the SAME value. The fallback is not what the mutation changes.
		const otherPolicy = 'pol_01ARZ3NDEKTSV4RRFFQ69K0131';
		const otherSubject = 'pwu_01ARZ3NDEKTSV4RRFFQ69K0132';
		createPolicy(POLICY);
		createPolicy(otherPolicy);

		const first = 'asm_01ARZ3NDEKTSV4RRFFQ69K0133';
		driveToAssessing(first, POLICY);
		const second = 'asm_01ARZ3NDEKTSV4RRFFQ69K0134';
		const requested = requestAssessment(second, otherPolicy, [otherSubject]);
		expect(requested.status, JSON.stringify(requested.error)).toBe('ACCEPTED');
		arrange('BeginAssuranceAssessment', second, 'ASSURANCE_ASSESSMENT', {});

		// The arrangement itself, asserted: each assessment holds its own policy, and — the condition that makes
		// everything below discriminating — a policy id is never equal to the id of the assessment citing it.
		expect(stateOf(first)?.assurancePolicyId).toBe(POLICY);
		expect(stateOf(second)?.assurancePolicyId).toBe(otherPolicy);
		expect(POLICY, 'the mutant emits the ASSESSMENT id, so the two must differ').not.toBe(first);
		expect(otherPolicy, 'the mutant emits the ASSESSMENT id, so the two must differ').not.toBe(
			second
		);

		const observe = (observationId: string, assessmentId: string): void =>
			arrange('RecordAssuranceObservation', observationId, 'ASSURANCE_OBSERVATION', {
				assessmentId,
				observationType: 'FINDING',
				findingCode: 'UNFIT',
				severity: 'MATERIAL',
				statement: 'the boundary is not demonstrated'
			});
		const firstObservation = 'obs_01ARZ3NDEKTSV4RRFFQ69K0135';
		const secondObservation = 'obs_01ARZ3NDEKTSV4RRFFQ69K0136';
		observe(firstObservation, first);
		observe(secondObservation, second);

		expect(payloadOf('AssuranceObservationRecorded', firstObservation)).toEqual({
			observationId: firstObservation,
			assessmentId: first,
			policyId: POLICY,
			subjectObjectIds: [SUBJECT],
			findingCode: 'UNFIT',
			severity: 'MATERIAL',
			statement: 'the boundary is not demonstrated',
			implication: 'the boundary is not demonstrated',
			evidenceIds: [],
			disposition: 'OPEN'
		});
		expect(stateOf(firstObservation)?.policyId).toBe(POLICY);
		expect(stateOf(firstObservation)?.subjectObjectIds).toEqual([SUBJECT]);

		// The control half: the same command shape against the OTHER assessment inherits the OTHER policy and
		// the OTHER subject, so neither value can be a constant this handler happens to carry.
		expect(payloadOf('AssuranceObservationRecorded', secondObservation)).toEqual({
			observationId: secondObservation,
			assessmentId: second,
			policyId: otherPolicy,
			subjectObjectIds: [otherSubject],
			findingCode: 'UNFIT',
			severity: 'MATERIAL',
			statement: 'the boundary is not demonstrated',
			implication: 'the boundary is not demonstrated',
			evidenceIds: [],
			disposition: 'OPEN'
		});
		expect(stateOf(secondObservation)?.policyId).toBe(otherPolicy);
		expect(stateOf(secondObservation)?.subjectObjectIds).toEqual([otherSubject]);
	});

	it('the three §32 assessment commands each fail closed on an assessment that was never created', () => {
		// submit / select / cancel all load-or-reject before doing anything. Each arm is its own line in its own
		// handler, so a guard deleted from one is invisible to the other two.
		const missing = 'asm_01ARZ3NDEKTSV4RRFFQ69K0060';

		const submitted = dispatch('SubmitEvidenceForAssessment', missing, 'ASSURANCE_ASSESSMENT', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0061',
			satisfiesRequirementId: 'ER1'
		});
		expect(submitted.error?.message).toBe(`Aggregate ${missing} does not exist`);

		const selected = dispatch('SelectAssuranceEvaluator', missing, 'ASSURANCE_ASSESSMENT', {
			evaluator: ACTOR
		});
		expect(selected.error?.message).toBe(`Aggregate ${missing} does not exist`);

		const cancelled = dispatch('CancelAssuranceAssessment', missing, 'ASSURANCE_ASSESSMENT', {
			reason: 'the evidence will never arrive'
		});
		expect(cancelled.error?.message).toBe(`Aggregate ${missing} does not exist`);

		expect(store.readAllEvents().filter((e) => e.aggregateId === missing)).toHaveLength(0);
	});

	// ── An assessment that has concluded is CLOSED to evidence, and the refusal says what it is ───────────────

	it('SubmitEvidenceForAssessment refuses once the assessment holds a disposition, naming the state it is in', () => {
		createPolicy(POLICY, { requiredEvidence: [requirement('ER1')] });
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69K0070';
		driveToAssessing(assessmentId, POLICY);
		arrange('CompleteAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
			validatorResult: verdict(assessmentId, POLICY, 'REJECTED')
		});
		expect(stateOf(assessmentId)?.assessmentState).toBe('REJECTED');

		const r = dispatch('SubmitEvidenceForAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0071',
			satisfiesRequirementId: 'ER1'
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(
			`SubmitEvidenceForAssessment: assessment ${assessmentId} is REJECTED, not one of ` +
				'[EVIDENCE_PENDING, READY, ASSESSING] — evidence may only be submitted while the assessment ' +
				'is open to it.'
		);
		// The §38 view folds "missing evidence" from these receipts, so a receipt accepted here would shrink the
		// missing set of an assessment whose verdict is already given.
		expect(
			store
				.readAllEvents()
				.filter(
					(e) => e.eventType === 'AssuranceEvidenceReceived' && e.aggregateId === assessmentId
				)
		).toHaveLength(0);
	});

	it('a supplied evidenceType rides the receipt; an omitted one leaves the key off it', () => {
		createPolicy(POLICY, { requiredEvidence: [requirement('ER1'), requirement('ER2')] });
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69K0080';
		const requested = requestAssessment(assessmentId, POLICY);
		expect(requested.status, JSON.stringify(requested.error)).toBe('ACCEPTED');

		arrange('SubmitEvidenceForAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0081',
			satisfiesRequirementId: 'ER1',
			evidenceType: 'TEST_RESULT'
		});
		arrange('SubmitEvidenceForAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
			evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69K0082',
			satisfiesRequirementId: 'ER2'
		});

		const receipts = store
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceEvidenceReceived' && e.aggregateId === assessmentId)
			.map((e) => e.payload as Record<string, unknown>);
		expect(receipts.map((p) => p.satisfiesRequirementId)).toEqual(['ER1', 'ER2']);
		expect(receipts[0]!.evidenceType).toBe('TEST_RESULT');
		expect(Object.keys(receipts[1]!)).not.toContain('evidenceType');
	});

	// ── The ActorReference -> Identity seam carries the dimension the requirement is keyed on ─────────────────

	it('DIFFERENT_PROVIDER decides on providerId — shared refuses with "same provider", distinct is VERIFIED', () => {
		// `actorReferenceToIdentity` spreads providerId only when present, and `differs()` treats an absent
		// dimension as NOT independent. So a seam that dropped providerId would violate BOTH arrangements below
		// — the second half is what tells "the dimension is carried" apart from "nothing is carried".
		createPolicy(POLICY, { independenceRequirement: 'DIFFERENT_PROVIDER' });

		const shared = 'asm_01ARZ3NDEKTSV4RRFFQ69K0090';
		driveToAssessing(shared, POLICY);
		const sameHouse = dispatch('CompleteAssuranceAssessment', shared, 'ASSURANCE_ASSESSMENT', {
			validatorResult: verdict(shared, POLICY, 'SATISFIED', {
				actorId: 'evaluator-1',
				actorType: 'AGENT',
				displayName: 'Reviewer',
				providerId: 'provider-acme'
			}),
			producer: {
				actorId: 'producer-1',
				actorType: 'AGENT',
				displayName: 'Producer',
				providerId: 'provider-acme'
			}
		});
		expect(sameHouse.status, JSON.stringify(sameHouse.error)).toBe('ACCEPTED');
		expect(stateOf(shared)?.assessmentState).toBe('INDEPENDENCE_VIOLATION');
		const violation = payloadOf('AssuranceIndependenceViolated', shared);
		expect(violation.independenceRequirement).toBe('DIFFERENT_PROVIDER');
		expect(violation.reason).toBe('same provider');

		const distinct = 'asm_01ARZ3NDEKTSV4RRFFQ69K0091';
		driveToAssessing(distinct, POLICY);
		const twoHouses = dispatch('CompleteAssuranceAssessment', distinct, 'ASSURANCE_ASSESSMENT', {
			validatorResult: verdict(distinct, POLICY, 'SATISFIED', {
				actorId: 'evaluator-1',
				actorType: 'AGENT',
				displayName: 'Reviewer',
				providerId: 'provider-globex'
			}),
			producer: {
				actorId: 'producer-1',
				actorType: 'AGENT',
				displayName: 'Producer',
				providerId: 'provider-acme'
			}
		});
		expect(twoHouses.status, JSON.stringify(twoHouses.error)).toBe('ACCEPTED');
		expect(stateOf(distinct)?.assessmentState).toBe('SATISFIED');
		expect(payloadOf('AssuranceAssessmentCompleted', distinct).independenceResult).toBe('VERIFIED');
	});

	// ── Gate D fires on the severity the policy DECLARED, never on one it merely could have ───────────────────

	it('an escalationRule naming no severity does not escalate; the same rule naming CRITICAL does', () => {
		// `escalateOnOpenSeverities` is optional on the ratified EscalationRule, and a rule that omits it routes
		// its trigger through §13's `EscalationRule.trigger` instead. Defaulting the absent list to the
		// escalatable set would make every escalation rule in the system fire on any open CRITICAL — an
		// escalation nobody authored, from a field nobody filled in.
		const quiet = 'pol_01ARZ3NDEKTSV4RRFFQ69K0100';
		const loud = 'pol_01ARZ3NDEKTSV4RRFFQ69K0101';
		const rule = { trigger: {}, escalationTarget: 'ARCHITECT', requiredPackage: [] };
		createPolicy(quiet, { escalationRules: [rule] });
		createPolicy(loud, { escalationRules: [{ ...rule, escalateOnOpenSeverities: ['CRITICAL'] }] });

		const complete = (assessmentId: string, policyId: string, observationId: string): void => {
			driveToAssessing(assessmentId, policyId);
			arrange('RecordAssuranceObservation', observationId, 'ASSURANCE_OBSERVATION', {
				assessmentId,
				observationType: 'FINDING',
				findingCode: 'UNFIT',
				severity: 'CRITICAL',
				statement: 'the boundary is breached'
			});
			const r = dispatch('CompleteAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(assessmentId, policyId, 'REJECTED')
			});
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		};

		const unescalated = 'asm_01ARZ3NDEKTSV4RRFFQ69K0102';
		complete(unescalated, quiet, 'obs_01ARZ3NDEKTSV4RRFFQ69K0103');
		expect(stateOf(unescalated)?.assessmentState).toBe('REJECTED');
		expect(
			store
				.readAllEvents()
				.filter(
					(e) => e.eventType === 'AssuranceAssessmentEscalated' && e.aggregateId === unescalated
				)
		).toHaveLength(0);

		const escalated = 'asm_01ARZ3NDEKTSV4RRFFQ69K0104';
		complete(escalated, loud, 'obs_01ARZ3NDEKTSV4RRFFQ69K0105');
		expect(stateOf(escalated)?.assessmentState).toBe('ESCALATED');
		expect(payloadOf('AssuranceAssessmentEscalated', escalated).escalationReason).toBe(
			'open observation(s) of severity [CRITICAL] → escalation to ARCHITECT per policy ' +
				'escalationRules (§10.3/§13)'
		);
	});

	// ── §5.1 applicability: no subject means DECLINE, a wrong subject means REFUSE ────────────────────────────

	it('a request naming NO subject is admitted — the §5.1 gate declines rather than manufacture NOT_APPLICABLE', () => {
		// The handler's own rule: "AND AN UNRESOLVABLE SUBJECT IS NOT A NEGATIVE ... A subject that does not
		// resolve is left to the checks that own it; this one declines to answer." No subject at all is the
		// same case one step earlier, and reading it as NOT_APPLICABLE would be a decided negative derived from
		// having no information.
		//
		// ⛔ WHAT THIS TEST DOES NOT PROVE, STATED BECAUSE IT WAS FIRST WRITTEN CLAIMING THE OPPOSITE. It was
		// added to cover `if (!subjectId) return null;` (assurance.ts:1299) and declared that removing that line
		// would redden it. ⭑ IT WOULD NOT. Falling through binds `undefined` into
		// `loadObject(subjectId)`, and better-sqlite3's `.get(undefined)` does not throw — it returns
		// `undefined` (probed directly under node, since the native bindings do not load under bun). So
		// `applicabilitySubjectFrom(undefined)` yields null and `if (!subject) return null;` at :1306 returns
		// the SAME value by the SAME route. The two guards are behaviourally indistinguishable.
		// ⭑⭑ SO `:1299` IS A GUARD THAT CANNOT FAIL — a control whose removal no test could detect, found only
		// by trying to write the test that would detect it. It is defensive and harmless; it is NOT removed
		// here, because deleting production code is outside this increment's scope. Filed, not fixed.
		// ⭑ THE TEST IS KEPT ANYWAY, because the BEHAVIOUR below is real and was previously unpinned: a request
		// naming no subject is ACCEPTED, lands READY, and records an empty subject list rather than a decided
		// NOT_APPLICABLE. That is worth a test; it is simply not worth the branch it was written for.
		createPolicy(POLICY);
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69K0110';
		const r = requestAssessment(assessmentId, POLICY, []);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stateOf(assessmentId)?.assessmentState).toBe('READY');
		expect(stateOf(assessmentId)?.subjectObjectIds).toEqual([]);
	});

	it('the §5.1 refusal names the subject’s object type and omits the kind clause when it has no kind', () => {
		// A CLAIM has an objectType and no pwuKind. The kind clause is conditional for exactly this reason —
		// unconditionally interpolated it renders ", kind undefined" into a governed refusal message, which is
		// a fabricated fact about the subject inside the sentence explaining why it was refused.
		createPolicy(POLICY);
		assertClaim();
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69K0120';
		const r = requestAssessment(assessmentId, POLICY, [CLAIM]);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toBe(
			`RequestAssuranceAssessment: assurance policy ${POLICY} does not apply to ${CLAIM} (a CLAIM) ` +
				'— its DOC-004 §5.1 applicability rule yields NOT_APPLICABLE. Assessing work a policy ' +
				'does not govern would record a verdict against criteria written for something else.'
		);
		expect(store.loadObject(assessmentId)).toBeUndefined();
	});
});
