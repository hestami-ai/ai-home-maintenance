// The ENFORCEMENT REGISTER's disclosures, OBSERVED rather than argued — the mirror of
// `execrem-wp16-enforcement-observed.test.ts`.
//
// WHY A SECOND INSTRUMENT EXISTS (2026-08-01, the RPH-EVD tranche). A disclosure that nothing checks is an excuse.
// The register's original guard for "nothing enforces this" was a CENSUS: name the dead kernel predicate, pin the
// exact set of production files that reference it, and let the gate grep. That works — but only when the baseline
// set EXCLUDES the file the wiring would land in. `capabilityAuthorized`'s census is one file, its own definition,
// so the archetype satisfied that precondition silently and nothing checked it.
//
// It fails for every RPH-EVD row. Measured with the gate's own algorithm, every plausible symbol's baseline ALREADY
// CONTAINS a command-layer handler (`producedBy` -> handlers/assurance.ts; `parentCompletionClaimId` ->
// handlers/decomposition.ts; `admittedScope` -> handlers/assurance.ts). Wiring the missing check into that same
// handler would not change the set, and the row would stay green through the very event it exists to detect. That
// is a guard that cannot fail, and `enforcement-register.test.ts` now rejects one by construction.
//
// So these rows are guarded by BEHAVIOUR instead. Each dispatches the arrangement its ratified statement says must
// be REFUSED, and asserts the engine ACCEPTS it. The day someone wires the guard, this file goes RED and the row
// must be re-dispositioned to ENFORCED with a refusal probe. That is strictly stronger than a census: it reddens on
// the behaviour changing, not on a symbol moving.
//
// EVERY PROBE CARRIES A CONTROL, and it is the MIRROR of the enforcement file's. There, the control is the same
// command ACCEPTED before the arranging act, so a handler that refused everything cannot pass. Here the hazard is
// inverted — an acceptance means nothing if the command is never refused for any reason, or if the arrangement
// never reached the site at all. So each control is a SIBLING DEFECT AT THE SAME SITE that IS refused: it proves
// the refusal machinery is alive and simply has no limb for this rule.
//
// THESE ARRANGEMENTS CORRECTED TWO CLAIMS THAT SURVIVED SOURCE-READING. "Evidence with no producing actor is
// admitted" is FALSE — `ActorReferenceSchema` requires `actorId`/`displayName` `.min(1)`, so that antecedent is
// schema-foreclosed and never reaches a handler (asserted below, because a disclosure narrower than its rule must
// say where the rest of the rule went). What survives dispatch is the SOURCE half, and it survives for a precise
// reason: `ArtifactReferenceSchema` is `z.record(z.string(), z.unknown())`, so `contentReference: {}` is valid, and
// the guard's CONTENT_AVAILABLE limb is a null-check that `{}` passes.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import {
	ENFORCEMENT_REGISTER,
	observedAdmissionRuleIds,
	type RegisteredRuleId
} from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-01T00:00:00Z';
const actor: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0A';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V05';
const RCP2 = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V06';
/** Deliberately names NO Claim aggregate — nothing ever asserts it. That absence IS the arrangement. */
const UNREIFIED_CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V07';

interface Outcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
}

/**
 * One disclosure's proof: the arrangement the rule says must be refused, ACCEPTED; and a sibling defect at the same
 * site, REFUSED.
 */
interface DisclosureProbe {
	/** What is dispatched, and why its acceptance is the rule going unenforced. */
	readonly arrangement: string;
	readonly run: () => { readonly admitted: Outcome; readonly control: Outcome };
}

describe('the register\'s RPH-EVD disclosures are OBSERVED, not asserted', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id: string,
		aggType: string
	): Outcome {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'evd-disclosure',
			idempotencyKey: `k-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		return { status: r.status, code: r.error?.code, message: r.error?.message };
	}

	const ok = (r: Outcome, what: string): Outcome => {
		expect(r.status, `${what}: ${r.code ?? ''} ${r.message ?? ''}`).toBe('ACCEPTED');
		return r;
	};

	// ── evidence fixtures ────────────────────────────────────────────────────────────────────────────────────
	const proposeEvidence = (evId: string, over: Record<string, unknown> = {}): Outcome =>
		dispatch(
			'ProposeEvidence',
			{
				evidenceId: evId,
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'file://report.xml' },
				producedBy: { actorId: 'ci-1', actorType: 'SERVICE', displayName: 'CI' },
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: 'unit tests for module X',
				limitations: [],
				capturedAt: TS,
				...over
			},
			evId,
			'EVIDENCE'
		);

	const admitEvidence = (evId: string, over: Record<string, unknown> = {}): Outcome =>
		dispatch(
			'AdmitEvidence',
			{
				admissibilityAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5F01',
				admittedScope: 'unit tests for module X',
				admittedClaimIds: [],
				...over
			},
			evId,
			'EVIDENCE'
		);

	/**
	 * THE SHARED CONTROL for both evidence rows: the same guard, at the same site, refusing a sibling limb.
	 *
	 * Shared deliberately and safely — unlike the ENFORCED arm's refusal markers, which must be distinct because a
	 * shared marker would let one arrangement green two rows, a shared CONTROL cannot do that: it proves a property
	 * of the SITE (its guard is alive), and each row still carries its own distinct arrangement, which is the half
	 * that carries the finding.
	 */
	const liveGuardControl = (evId: string): Outcome => {
		ok(proposeEvidence(evId, { scope: '' }), `propose control ${evId}`);
		return admitEvidence(evId);
	};

	const proposePwu = (pwuId: string) =>
		ok(
			dispatch(
				'ProposePwu',
				{
					pwuId,
					pwuKind: 'ARCHITECTURE',
					title: pwuId,
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
				},
				pwuId,
				'PROFESSIONAL_WORK_UNIT'
			),
			`propose ${pwuId}`
		);

	// ── assurance fixtures (the RPH-ASR family) ──────────────────────────────────────────────────────────────
	//
	// Every ASR arrangement is the same four dispatches — create policy, activate it, request an assessment,
	// complete it — differing only in what the POLICY declares and what the VALIDATOR RESULT says. That is
	// deliberate: it keeps each row's arrangement one field away from its control, so the delta that carries the
	// finding is visible rather than buried in fixture divergence.

	/**
	 * A minimal ACTIVE policy. `criterionSeverity` BLOCKING is what makes the criterion MANDATORY under the
	 * engine's own derivation — MATERIAL would make the arrangement unfaithful to the rules that say "mandatory".
	 *
	 * The OMISSIONS are load-bearing and are the point of several rows: no `dispositionRules`, no
	 * `escalationRules`, no `requiredEvidence`, and an empty-by-default `permittedControlActions` posture, so each
	 * of completeAssuranceAssessment's gates hits its own stated skip condition and cannot MASK the observation.
	 */
	const seedPolicy = (
		policyId: string,
		opts: { criterionSeverity?: string; dispositionRules?: unknown[] } = {}
	): void => {
		ok(
			dispatch(
				'CreateAssurancePolicy',
				{
					policyId,
					version: '1.0.0',
					name: `ASR probe policy ${policyId}`,
					purpose: 'Assess the subject against its approved need.',
					rationale: 'Seeded for a live command-drive disclosure probe.',
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
							severityIfNotMet: opts.criterionSeverity ?? 'BLOCKING',
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
					permittedControlActions: ['CONTINUE'],
					...(opts.dispositionRules ? { dispositionRules: opts.dispositionRules } : {})
				},
				policyId,
				'ASSURANCE_POLICY'
			),
			`create policy ${policyId}`
		);
		// REQUIRED: a non-floor policy is born DRAFT, and requestAssuranceAssessment refuses a non-ACTIVE policy.
		ok(
			dispatch('ActivateAssurancePolicy', { policyId }, policyId, 'ASSURANCE_POLICY'),
			`activate policy ${policyId}`
		);
	};

	const requestAssessment = (assessmentId: string, policyId: string): void => {
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [PARENT],
					subjectSemanticVersions: { [PARENT]: 1 },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			),
			`request assessment ${assessmentId}`
		);
	};

	/** A schema-valid §20 verdict. `over` mutates the validator result, which is where every ASR delta lives. */
	const completeAssessment = (
		assessmentId: string,
		policyId: string,
		over: Record<string, unknown> = {}
	): Outcome =>
		dispatch(
			'CompleteAssuranceAssessment',
			{
				validatorResult: {
					validatorId: 'reviewer',
					validatorVersion: '1',
					policyId,
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [PARENT],
					subjectSemanticVersions: { [PARENT]: 1 },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {
						evaluator: { actorId: 'rev-1', actorType: 'HUMAN', displayName: 'Reviewer' }
					},
					...over
				}
			},
			assessmentId,
			'ASSURANCE_ASSESSMENT'
		);

	/**
	 * THE SHARED ASR CONTROL: the same command, the same handler, the same parse step, ONE field apart from the
	 * admitted arrangement — `subjectSemanticVersions: {}` while `subjectObjectIds` still names the subject.
	 * `z.record(z.string(), z.number())` admits `{}`, so it passes the schema and reaches `parseCompletion`, which
	 * refuses it. Proves the site rejects malformed validator output and simply never asks the question each
	 * disclosed row is about.
	 *
	 * This is the SAME limb RPH-ASR-007 records as ENFORCED, which is a coherence property rather than a
	 * coincidence: the register says that limb refuses, and these controls observe it refusing.
	 */
	/** `ChangePwuState` carries all four axes FLAT, not nested — a shape this fixture got wrong once. */
	const pwuState = (
		pwuId: string,
		previousState: string,
		newState: string,
		over: Record<string, unknown> = {}
	): Outcome =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'fixture',
				supportingObjectIds: [],
				...over
			},
			pwuId,
			'PROFESSIONAL_WORK_UNIT'
		);

	const driveToReady = (pwuId: string): void => {
		ok(pwuState(pwuId, 'PROPOSED', 'SHAPING'), `${pwuId} -> SHAPING`);
		ok(pwuState(pwuId, 'SHAPING', 'READY'), `${pwuId} -> READY`);
	};

	/**
	 * Walk the assurance axis to `ASSESSING` — the only state SATISFIED has an in-arrow from.
	 *
	 * The matrix is UNASSESSED -> EVIDENCE_REQUIRED -> READY_FOR_ASSESSMENT -> ASSESSING -> SATISFIED, and a probe
	 * that jumped straight to SATISFIED was refused by the MACHINE rather than by the backing check it exists to
	 * measure. That is the masking hazard in its arranging half: the observation would have read as "the rule is
	 * enforced" while the arrangement had never reached the guard.
	 */
	const driveAssuranceToAssessing = (pwuId: string): void => {
		ok(
			pwuState(pwuId, 'READY', 'READY', { assuranceState: 'EVIDENCE_REQUIRED', reasonCode: 'fx' }),
			`${pwuId} assurance -> EVIDENCE_REQUIRED`
		);
		ok(
			pwuState(pwuId, 'READY', 'READY', {
				assuranceState: 'READY_FOR_ASSESSMENT',
				reasonCode: 'fx'
			}),
			`${pwuId} assurance -> READY_FOR_ASSESSMENT`
		);
		ok(
			pwuState(pwuId, 'READY', 'READY', { assuranceState: 'ASSESSING', reasonCode: 'fx' }),
			`${pwuId} assurance -> ASSESSING`
		);
	};

	/** Assert a terminal assurance disposition, citing `supporting` as its backing. */
	const setAssurance = (pwuId: string, assuranceState: string, supporting: string[]): Outcome =>
		pwuState(pwuId, 'READY', 'READY', {
			assuranceState,
			supportingObjectIds: supporting,
			reasonCode: 'aggregate assurance'
		});

	const parseGuardControl = (assessmentId: string, policyId: string): Outcome => {
		requestAssessment(assessmentId, policyId);
		return completeAssessment(assessmentId, policyId, { subjectSemanticVersions: {} });
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'capture intent'
		);
		proposePwu(PARENT);
		proposePwu(CHILD_A);
	});

	/**
	 * TOTAL over the OBSERVED_ADMISSION rows, by type. A row given that guard with no probe here does not compile —
	 * the same property that makes the enforcement map an instrument rather than a document.
	 */
	const PROBES: Readonly<Record<RegisteredRuleId, DisclosureProbe | null>> = {
		'RPH-EXE-001': null,
		'RPH-EXE-002': null,
		'RPH-EXE-003': null,
		'RPH-EXE-004': null, // disclosed, but by a DEAD_PREDICATE census — guarded in rph-domain, not here
		'RPH-EXE-005': null,
		'RPH-EXE-006': null,
		'RPH-EXE-007': null,
		'RPH-EXE-008': null,
		'RPH-EXE-009': null,
		'RPH-PWU-009': null,
		'RPH-PWU-010': null,
		'RPH-EVD-002': null,
		'RPH-EVD-005': null,
		'RPH-EVD-006': null,
		'RPH-EVD-007': null, // ENFORCED — its refusal is probed in execrem-wp16-enforcement-observed.test.ts
		'RPH-ASR-001': null,
		'RPH-ASR-002': null, // ENFORCED
		'RPH-ASR-003': null,
		'RPH-ASR-006': null,
		'RPH-ASR-007': null, // ENFORCED
		'RPH-ASR-009': null,
		'RPH-ASR-011': null,

		'RPH-EVD-001': {
			arrangement:
				"CompleteRecomposition asserting the parent's completion is supported, naming a Claim id that was never asserted",
			run: () => {
				ok(
					dispatch(
						'ProposeRecomposition',
						{
							parentWorkUnitId: PARENT,
							requiredChildWorkUnitIds: [CHILD_A],
							parentCompletionClaimId: UNREIFIED_CLAIM,
							conflictResolutionRules: []
						},
						RCP,
						'RECOMPOSITION_CONTRACT'
					),
					'propose recomposition'
				);
				ok(
					dispatch(
						'BeginRecomposition',
						{ recompositionContractId: RCP },
						RCP,
						'RECOMPOSITION_CONTRACT'
					),
					'begin recomposition'
				);
				// The Claim named above is NEVER asserted — `store.loadObject(UNREIFIED_CLAIM)` is undefined
				// throughout — and the completion judgement travels instead as a caller-supplied boolean.
				expect(
					store.loadObject(UNREIFIED_CLAIM),
					'the arrangement is only meaningful while the Claim genuinely does not exist'
				).toBeUndefined();
				const admitted = dispatch(
					'CompleteRecomposition',
					{ parentCompletionClaimId: UNREIFIED_CLAIM, parentCompletionClaimSupported: true },
					RCP,
					'RECOMPOSITION_CONTRACT'
				);

				// CONTROL — the same command at the same site, on a contract that was proposed but never BEGUN, so
				// it sits in READY rather than EVALUATING. Refused with RPH_ILLEGAL_STATE_TRANSITION. Proves
				// CompleteRecomposition IS refusable, so the acceptance above is a missing limb rather than a
				// handler that accepts unconditionally.
				//
				// REFUSED BY TWO INDEPENDENT LIMBS, measured: `precondition: fromStates('EVALUATING')` refuses it,
				// AND the RecompositionContract.status machine forbids READY -> outcome even when that precondition
				// is widened to admit READY. Stated because it means this control is robust rather than
				// single-limb sensitive, and a reader re-running the mutation would otherwise read the survival as
				// a defect.
				ok(
					dispatch(
						'ProposeRecomposition',
						{
							parentWorkUnitId: PARENT,
							requiredChildWorkUnitIds: [CHILD_A],
							parentCompletionClaimId: UNREIFIED_CLAIM,
							conflictResolutionRules: []
						},
						RCP2,
						'RECOMPOSITION_CONTRACT'
					),
					'propose control recomposition'
				);
				const control = dispatch(
					'CompleteRecomposition',
					{ parentCompletionClaimId: UNREIFIED_CLAIM, parentCompletionClaimSupported: true },
					RCP2,
					'RECOMPOSITION_CONTRACT'
				);
				return { admitted, control };
			}
		},

		// RPH-EVD-003 was disclosed here until 2026-08-02, when REG-F-008's remediation turned this very probe RED
		// and forced its re-disposition to ENFORCED. Its refusal is now observed in
		// `execrem-wp16-enforcement-observed.test.ts`. Left as a named null rather than deleted, because the
		// row moving between the two maps IS the mechanism working and a reader should be able to see it happened.
		'RPH-EVD-003': null,

		'RPH-EVD-004': {
			arrangement:
				"a TEST_RESULT of scope 'unit' admitted in support of a FITNESS claim, neither rejected nor qualified",
			run: () => {
				const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5F11';
				ok(
					dispatch(
						'AssertClaim',
						{
							claimType: 'FITNESS',
							statement: 'the product is fit for its intended use',
							subjectObjectIds: [PARENT],
							supportingEvidenceIds: [],
							contradictingEvidenceIds: []
						},
						CLAIM,
						'CLAIM'
					),
					'assert FITNESS claim'
				);
				const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FE1';
				ok(
					proposeEvidence(EV, { scope: 'unit', supportsClaimIds: [CLAIM] }),
					'propose unit-scope evidence'
				);
				return {
					admitted: admitEvidence(EV, { admittedScope: 'unit', admittedClaimIds: [CLAIM] }),
					control: liveGuardControl('evd_01ARZ3NDEKTSV4RRFFQ69G5FF1')
				};
			}
		},

		'RPH-ASR-004': {
			arrangement:
				'a validator recommending SATISFIED while the policy\'s BLOCKING criterion came back NOT_MET — the recommendation taken as the disposition',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5A04';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A04';
				seedPolicy(POL, { criterionSeverity: 'BLOCKING' });
				requestAssessment(ASM, POL);
				const admitted = completeAssessment(ASM, POL, {
					dispositionRecommendation: 'SATISFIED',
					claimResults: [{ criterionId: 'C1', result: 'NOT_MET', statement: 'the blocking criterion is not met' }]
				});
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5A05', POL) };
			}
		},

		'RPH-ASR-005': {
			arrangement:
				"a mandatory (BLOCKING) criterion returning UNABLE_TO_DETERMINE while the validator recommends SATISFIED — undetermined treated as met",
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5A06';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A06';
				seedPolicy(POL, { criterionSeverity: 'BLOCKING' });
				requestAssessment(ASM, POL);
				const admitted = completeAssessment(ASM, POL, {
					dispositionRecommendation: 'SATISFIED',
					claimResults: [
						{ criterionId: 'C1', result: 'UNABLE_TO_DETERMINE', statement: 'could not be determined' }
					]
				});
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5A07', POL) };
			}
		},

		'RPH-ASR-008': {
			arrangement:
				'a CRITICAL observation recorded OPEN against a live assessment, then that assessment completed SATISFIED under a policy that declares no dispositionRules',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5A08';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A08';
				seedPolicy(POL);
				requestAssessment(ASM, POL);
				ok(
					dispatch(
						'RecordAssuranceObservation',
						{
							assessmentId: ASM,
							observationType: 'FINDING',
							findingCode: 'UNFIT',
							severity: 'CRITICAL',
							statement: 'a critical finding, left open'
						},
						'obs_01ARZ3NDEKTSV4RRFFQ69G5B08',
						'ASSURANCE_OBSERVATION'
					),
					'record CRITICAL observation'
				);
				const admitted = completeAssessment(ASM, POL);

				// THE STRONGEST CONTROL IN EITHER TRANCHE, and it is specific to this row rather than the shared
				// parse-guard one: the SAME command, the SAME site, the SAME still-open CRITICAL observation — and
				// it IS refused, once the policy declares the rule. The only delta is `dispositionRules`. So what
				// is missing is not the mechanism but THE ENGINE'S OWN DEFAULT, which is precisely the finding.
				const POL2 = 'pol_01ARZ3NDEKTSV4RRFFQ69G5A09';
				const ASM2 = 'asm_01ARZ3NDEKTSV4RRFFQ69G5A0A';
				seedPolicy(POL2, {
					dispositionRules: [
						{ disposition: 'SATISFIED', condition: 'no open critical', forbiddenOpenSeverities: ['CRITICAL'] }
					]
				});
				requestAssessment(ASM2, POL2);
				ok(
					dispatch(
						'RecordAssuranceObservation',
						{
							assessmentId: ASM2,
							observationType: 'FINDING',
							findingCode: 'UNFIT',
							severity: 'CRITICAL',
							statement: 'a critical finding, left open'
						},
						'obs_01ARZ3NDEKTSV4RRFFQ69G5B09',
						'ASSURANCE_OBSERVATION'
					),
					'record CRITICAL observation (control)'
				);
				return { admitted, control: completeAssessment(ASM2, POL2) };
			}
		},

		'RPH-ASR-010': {
			arrangement:
				'an assessment completed with a validatorResult binding the subject to a semantic version the subject is NOT at — a verdict on version n satisfying version n+1',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5B10';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5B10';
				seedPolicy(POL, { criterionSeverity: 'MATERIAL' });
				requestAssessment(ASM, POL);
				// The subject PWU is at semanticVersion 1 (nothing has revised it). The verdict claims to have
				// assessed version 99. Asserted from live state rather than a literal, so the staleness is real:
				// a probe that pinned BOTH sides to constants could not tell a stale floor from a fresh one.
				const actual = Number(
					(store.loadObject(PARENT)?.state as Record<string, unknown>)?.semanticVersion ?? 1
				);
				expect(actual, 'the arrangement only means something while the versions genuinely differ').not.toBe(
					99
				);
				const admitted = completeAssessment(ASM, POL, {
					subjectSemanticVersions: { [PARENT]: 99 }
				});
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5B11', POL) };
			}
		},

		'RPH-ASR-012': {
			arrangement:
				'a PWU assurance disposition asserted SATISFIED while citing only the satisfied assessments, with a REJECTED assessment against another required policy left uncomposed',
			run: () => {
				const POL_OK = 'pol_01ARZ3NDEKTSV4RRFFQ69G5C01';
				const POL_BAD = 'pol_01ARZ3NDEKTSV4RRFFQ69G5C02';
				const ASM_OK = 'asm_01ARZ3NDEKTSV4RRFFQ69G5C01';
				const ASM_BAD = 'asm_01ARZ3NDEKTSV4RRFFQ69G5C02';
				seedPolicy(POL_OK, { criterionSeverity: 'MATERIAL' });
				seedPolicy(POL_BAD, { criterionSeverity: 'MATERIAL' });
				requestAssessment(ASM_OK, POL_OK);
				ok(completeAssessment(ASM_OK, POL_OK), 'complete the SATISFIED assessment');
				requestAssessment(ASM_BAD, POL_BAD);
				ok(
					completeAssessment(ASM_BAD, POL_BAD, { dispositionRecommendation: 'REJECTED' }),
					'complete the REJECTED assessment'
				);

				// Assert the aggregate SATISFIED citing ONLY the satisfied assessment. The REJECTED one is a real,
				// valid assessment against another policy the subject is assessed under, and nothing composes it in.
				driveToReady(PARENT);
				driveAssuranceToAssessing(PARENT);
				const admitted = setAssurance(PARENT, 'SATISFIED', [ASM_OK]);

				// CONTROL — the byte-identical command citing ONLY the REJECTED assessment, refused by
				// `rejectUnbackedDisposition` at the same site. The BACKING check is alive; the COMPOSITION across
				// required policies is what is absent.
				driveToReady(CHILD_A);
				driveAssuranceToAssessing(CHILD_A);
				const control = setAssurance(CHILD_A, 'SATISFIED', [ASM_BAD]);
				return { admitted, control };
			}
		}
	};

	it('the probe map is TOTAL over the OBSERVED_ADMISSION rows — every disclosure has an observation', () => {
		const unprobed = observedAdmissionRuleIds().filter((id) => PROBES[id] === null);
		expect(unprobed, 'OBSERVED_ADMISSION row(s) with no probe').toEqual([]);
		// …and nothing probes a row that does not claim that guard, which would be an observation with no claim
		// behind it — the mirror of the enforcement map's over-probing check.
		const overProbed = (Object.keys(PROBES) as RegisteredRuleId[]).filter((id) => {
			if (PROBES[id] === null) return false;
			const row = ENFORCEMENT_REGISTER[id];
			return !(row.kind === 'UNENFORCED_DISCLOSED' && row.guard.kind === 'OBSERVED_ADMISSION');
		});
		expect(overProbed, 'probe(s) for rule(s) that do not declare an OBSERVED_ADMISSION guard').toEqual(
			[]
		);
	});

	it.each(observedAdmissionRuleIds())(
		'%s is ADMITTED by the running engine — the disclosure is a measured fact',
		(id) => {
			const row = ENFORCEMENT_REGISTER[id];
			const probe = PROBES[id];
			expect(row.kind).toBe('UNENFORCED_DISCLOSED');
			expect(probe, `${id} has no probe`).not.toBeNull();
			if (row.kind !== 'UNENFORCED_DISCLOSED' || !probe) return;

			const { admitted, control } = probe.run();

			// THE DISCLOSURE. Wire the guard and this line fails, which is the whole point of the row.
			expect(
				admitted.status,
				`${id} (${probe.arrangement}) — the engine REFUSED what this row discloses as unenforced ` +
					`(${admitted.code ?? ''}: ${admitted.message ?? ''}). Re-disposition it as ENFORCED with a probe.`
			).toBe('ACCEPTED');

			// THE CONTROL. Without it, a site that accepted literally everything — or an arrangement that never
			// reached the site — would satisfy this file completely.
			//
			// CONTROL STRENGTH, MEASURED RATHER THAN ASSUMED (2026-08-01). Each control was mutated to check it is
			// load-bearing, and the two families answered differently — recorded because the difference is the kind
			// of thing that is otherwise assumed:
			//   EVD-003 / EVD-004  KILLED. Neutering `evidenceAdmissibility`'s SCOPE_STATED limb turns both controls
			//                      ACCEPTED and reddens THIS assertion (not the disclosure one above), which is the
			//                      property a control has to have.
			//   ASR-004/005/010/012  KILLED, one mutant each, each reddening ONLY its own row. These are ADDITIVE
			//                      mutants — they WIRE the missing rule rather than delete an existing one, which is
			//                      the only way to test a disclosure's real property: that it detects the gap being
			//                      closed. F: refuse SATISFIED with a NOT_MET criterion. G: refuse SATISFIED with an
			//                      UNABLE_TO_DETERMINE criterion. H: refuse a verdict whose subject version is not
			//                      the subject's current one. I: refuse a positive aggregate while any assessment on
			//                      the same subject is REJECTED. All four rows went RED and no other row moved.
			//   EVD-001            SURVIVED BY REDUNDANCY, not by vacuity. Widening completeRecomposition's
			//                      `fromStates('EVALUATING')` to admit READY leaves the control REJECTED, because
			//                      the RecompositionContract.status machine independently forbids READY -> outcome.
			//                      Two independent limbs refuse it. The control still reddens if the site stops
			//                      refusing at all, which is what it is here to exclude; it is simply not
			//                      single-limb sensitive, and saying so beats implying a kill that did not happen.
			expect(
				control.status,
				`${id}: the control must be REFUSED, proving the site's guard is alive and this rule is simply ` +
					`missing from it (observed ${control.status} ${control.code ?? ''}: ${control.message ?? ''})`
			).toBe('REJECTED');
		}
	);

	it('the disclosed arrangements are DISTINCT — no two rows are satisfied by one observation', () => {
		// The mirror of the refusal-marker distinctness gate. Two disclosures sharing an arrangement would report
		// two unenforced rules while only one thing had ever been dispatched.
		const arrangements = observedAdmissionRuleIds().map((id) => PROBES[id]?.arrangement ?? id);
		expect(new Set(arrangements).size, 'duplicate arrangement(s)').toBe(arrangements.length);
	});
});
