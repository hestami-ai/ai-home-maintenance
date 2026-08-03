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
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';
// Only the VALIDATOR RESULT builder — this file has its own `seedPolicy` (it needs the criteria override that
// RPH-CON-005's arrangement turns on), and importing the fixture module's would shadow it.
import { floorValidatorResult } from './__tests__/floor-fixtures.js';

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

	/** `dispatch` with extra ENVELOPE fields — RPH-CON-003's subject is an envelope field, not a payload one. */
	function dispatchWith(
		commandType: string,
		payload: unknown,
		id: string,
		aggType: string,
		envelope: Record<string, unknown>
	): Outcome {
		const n = ++seq;
		const command = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'evd-disclosure',
			idempotencyKey: `k-${n}`,
			payload,
			...envelope
		};
		const r = engine.dispatch(command as unknown as DomainCommand);
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

	const proposePwu = (pwuId: string, over: Record<string, unknown> = {}) =>
		ok(
			dispatch(
				'ProposePwu',
				{
					pwuId,
					pwuKind: 'ARCHITECTURE',
					title: pwuId,
					description: 'd',
					intentId: INTENT,
					boundaries: {
						inScope: ['the architecture note'],
						outOfScope: ['implementation'],
						permittedChanges: [],
						prohibitedChanges: []
					},
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [
						{
							artifactType: 'DOCUMENT',
							description: 'the architecture note',
							verificationCriteria: ['reviewed']
						}
					],
					assurancePolicyIds: [],
					...over,
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
		opts: { criterionSeverity?: string; dispositionRules?: unknown[]; criteria?: unknown[] } = {}
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
					criteria: opts.criteria ?? [
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

	// ── baseline-promotion fixture (RPH-PWU-008) ─────────────────────────────────────────────────────────────
	//
	// Modelled on `baseline-invalidated-evidence.test.ts`, which already drives this whole chain green. `tag`
	// namespaces the ids so the observation and its control are two independent baselines in one store.
	const baselineChain = (tag: string, opts: { withEvidence?: boolean } = {}) => {
		//  MUST be uppercase Crockford base32 — the id alphabet excludes lower case (and I, L, O, U). A lowercase
		// tag produced RPH_VALIDATION_SCHEMA_FAILED on the first run, at the ARRANGING step, which is the honest
		// place for a malformed fixture to fail.
		const id = (prefix: string, n: string) => `${prefix}_01ARZ3NDEKTSV4RRFFQ69G5${tag}${n}`;
		const pwu = id('pwu', 'P0');
		const pol = id('pol', 'L0');
		const asm = id('asm', 'A0');
		const dec = id('dec', 'D0');
		const baseline = id('bsl', 'B0');
		const claim = id('clm', 'C0');
		const evidence = id('evd', 'E0');

		seedPolicy(pol, { criterionSeverity: 'MATERIAL' });
		proposePwu(pwu);

		if (opts.withEvidence) {
			ok(
				dispatch(
					'AssertClaim',
					{
						statement: 'the architecture is fit for its approved need',
						claimType: 'FITNESS',
						subjectObjectIds: [pwu],
						supportingEvidenceIds: [evidence],
						contradictingEvidenceIds: []
					},
					claim,
					'CLAIM'
				),
				'assert claim'
			);
			ok(proposeEvidence(evidence, { supportsClaimIds: [claim] }), 'propose control evidence');
			ok(admitEvidence(evidence, { admittedClaimIds: [claim] }), 'admit control evidence');
		}

		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId: asm,
					assurancePolicyId: pol,
					policyVersion: '1.0.0',
					subjectObjectIds: [pwu],
					subjectSemanticVersions: { [pwu]: 1 },
					claimIds: opts.withEvidence ? [claim] : []
				},
				asm,
				'ASSURANCE_ASSESSMENT'
			),
			'request baseline assessment'
		);
		ok(completeAssessmentFor(asm, pol, pwu), 'complete baseline assessment');
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType: 'PROMOTE_BASELINE',
					subjectObjectIds: [pwu],
					selectedOption: 'promote',
					rationale: 'ready',
					// ProposeDecision.authority is an ActorReference, NOT the AuthorityReference that
					// AssertObligation/AssertConstraint take. Two fields spelled "authority", two shapes.
					authority: actor
				},
				dec,
				'DECISION'
			),
			'propose promotion decision'
		);
		ok(
			dispatch(
				'ApproveDecision',
				{
					selectedOption: 'promote',
					rationale: 'ready',
					consideredEvidenceIds: opts.withEvidence ? [evidence] : [],
					consideredObservationIds: [],
					subjectSemanticVersions: { [pwu]: 1 }
				},
				dec,
				'DECISION'
			),
			'approve promotion decision'
		);
		ok(
			dispatch(
				'CreateBaseline',
				{ baselineType: 'ARCHITECTURE', itemObjectIds: [pwu], assuranceAssessmentIds: [asm] },
				baseline,
				'BASELINE'
			),
			'create baseline'
		);
		ok(dispatch('SubmitBaselineForReview', {}, baseline, 'BASELINE'), 'submit baseline');
		ok(dispatch('ApproveBaseline', {}, baseline, 'BASELINE'), 'approve baseline');

		return {
			pwu,
			baseline,
			evidence,
			promote: (): Outcome =>
				dispatch(
					'PromoteBaseline',
					{
						promotionDecisionId: dec,
						expectedItemObjectVersions: [{ objectId: pwu, semanticVersion: 1 }],
						requiredAssessmentIds: [asm]
					},
					baseline,
					'BASELINE'
				)
		};
	};

	/**
	 * A plan over `subject` driven to a genuinely SUCCEEDED step, which `rejectUnbackedExecutionSuccess` demands
	 * before the EXECUTING -> EVIDENCE_PENDING hop will carry executionState SUCCEEDED. Modelled on
	 * `succeededPlanFor` in pwu.test.ts, including its recorded-output requirement: `completeExecutionStep`
	 * refuses a step naming results that are not recorded objects, so the evidence is proposed first.
	 */
	const succeededPlanFor = (subject: string, planId: string): void => {
		const stepId = `${planId}-s1`;
		const evId = `${planId.replace(/^pln/, 'evd')}`;
		const plan = (t: string, payload: unknown) =>
			ok(dispatch(t, payload, planId, 'EXECUTION_PLAN'), t);
		plan('ProposeExecutionPlan', {
			executionPlanId: planId,
			workUnitId: subject,
			steps: [
				{
					id: stepId,
					executionPlanId: planId,
					stepType: 'HUMAN_INTERACTION',
					purpose: 'Produce the expected output',
					inputBindings: [],
					outputBindings: [],
					preconditions: [],
					postconditions: [],
					stepState: 'QUEUED'
				}
			],
			transitions: [],
			retryPolicy: {},
			tacticalChangePolicy: {},
			escalationPolicy: {},
			terminationPolicy: {}
		});
		plan('ApproveExecutionPlan', {});
		plan('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		plan('StartExecutionStep', { stepId });
		ok(
			proposeEvidence(evId, {
				evidenceType: 'ARTIFACT',
				contentReference: { kind: 'INLINE', note: 'the produced output' }
			}),
			'propose the step output'
		);
		plan('CompleteExecutionStep', {
			executionStepId: stepId,
			executionAttemptId: `${planId}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [evId],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: {}
		});
	};

	/** `completeAssessment` bound to an arbitrary subject — the shared helper pins PARENT. */
	const completeAssessmentFor = (
		assessmentId: string,
		policyId: string,
		subjectId: string,
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
					subjectObjectIds: [subjectId],
					subjectSemanticVersions: { [subjectId]: 1 },
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
		// ── RPH-PER, twelve of fourteen (2026-08-02) ──────────────────────────────────────────────────────────
		// Eleven are NOT_A_COMMAND_REFUSAL (§§18-20 are durability PROPERTIES, not refusals) and one is ENFORCED,
		// so none is observed here. RPH-PER-012 IS disclosed — but by a DEAD_PREDICATE census, guarded in
		// rph-domain: `classifyInterruptedAttempt` has two repo-wide references, its definition and its own test.
		// RPH-PER-003 and RPH-PER-004 are the two rows OWED, and they land here when they land, because both are
		// cross-aggregate uniqueness gaps that only an observation can settle.
		// ── The three READ-MODEL families (2026-08-02) ────────────────────────────────────────────────────────
		// All fourteen are NOT_A_COMMAND_REFUSAL, so none is observed here. Nine have no dispatchable subject at
		// all; five ARE performed, at a layer classifyRefusal cannot reach (a renderer returns no CommandResult).
		// That boundary is the family's finding — see the register's family header.
		'RPH-PRJ-001': null,
		'RPH-PRJ-002': null,
		'RPH-PRJ-003': null,
		'RPH-PRJ-004': null,
		'RPH-PRJ-005': null,
		'RPH-TRC-001': null,
		'RPH-TRC-002': null,
		'RPH-TRC-003': null,
		'RPH-TRC-004': null,
		'RPH-TRC-005': null,
		'RPH-CMP-001': null,
		'RPH-CMP-002': null,
		'RPH-CMP-003': null,
		'RPH-CMP-004': null,
		// RPH-GOV, three more (2026-08-02) — all NOT_A_COMMAND_REFUSAL. GOV-002 is arm 3 SPECIFICALLY so it does
		// not share GOV-001's single refusal site (one mutant would redden both); GOV-004's outcome is not
		// produced at all; GOV-007's kernel predicate is a CONSTANT FUNCTION that cannot return half its own
		// declared union. GOV-003/005 (ENFORCED) and GOV-006 (DISCLOSED) still owe observations.
		'RPH-GOV-002': null,
		'RPH-GOV-004': null,
		'RPH-GOV-007': null,
		'RPH-DEC-002': null,
		'RPH-DEC-003': null,
		'RPH-CNS-003': null,
		'RPH-DEC-001': null,
		'RPH-DEC-004': null,
		'RPH-DEC-006': null,
		'RPH-DEC-007': null,
		'RPH-CNS-001': null,
		'RPH-CNS-002': null,
		'RPH-CNS-004': null,
		'RPH-ASM-001': null,
		'RPH-ASM-002': null,
		'RPH-ASM-003': null,
		'RPH-ASM-004': null,
		'RPH-ASM-005': null,
		'RPH-BAS-003': null,
		'RPH-BAS-004': null,
		'RPH-BAS-006': null,
		'RPH-GOV-003': null,
		'RPH-BAS-001': null,
		'RPH-BAS-005': null,
		'RPH-BAS-007': null,
		'RPH-BAS-002': {
			arrangement:
				'PromoteBaseline naming semanticVersion 999 for an item the baseline froze at 1 — accepted, because the gate is handed one array as BOTH candidate and reviewed items',
			run: () => {
				const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5Z01';
				const ASSESS = 'asmt_01ARZ3NDEKTSV4RRFFQ69G5Z02';
				const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5Z03';
				const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5Z04';
				const CTRL = 'base_01ARZ3NDEKTSV4RRFFQ69G5Z05';
				seedPolicy('pol_bas');
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: ASSESS,
							assurancePolicyId: 'pol_bas',
							policyVersion: '1',
							subjectObjectIds: [PWU],
							subjectSemanticVersions: { [PWU]: 1 },
							claimIds: []
						},
						ASSESS,
						'ASSURANCE_ASSESSMENT'
					),
					'request assessment'
				);
				ok(
					dispatch(
						'CompleteAssuranceAssessment',
						{
							validatorResult: floorValidatorResult({
								assessmentId: ASSESS,
								policyId: 'pol_bas',
								subjectId: PWU,
								subjectSemanticVersion: 1,
								disposition: 'SATISFIED'
							})
						},
						ASSESS,
						'ASSURANCE_ASSESSMENT'
					),
					'complete assessment'
				);
				ok(
					dispatch(
						'ProposeDecision',
						{
							decisionType: 'PROMOTE_BASELINE',
							subjectObjectIds: [PWU],
							selectedOption: 'promote',
							rationale: 'ready',
							authority: actor
						},
						DEC,
						'DECISION'
					),
					'propose promotion decision'
				);
				ok(
					dispatch(
						'ApproveDecision',
						{
							selectedOption: 'promote',
							rationale: 'ready',
							consideredEvidenceIds: [],
							consideredObservationIds: [],
							subjectSemanticVersions: { [PWU]: 1 }
						},
						DEC,
						'DECISION'
					),
					'approve promotion decision'
				);
				const create = (id: string) =>
					ok(
						dispatch(
							'CreateBaseline',
							{
								baselineType: 'ARCHITECTURE',
								itemObjectIds: [PWU],
								assuranceAssessmentIds: [ASSESS]
							},
							id,
							'BASELINE'
						),
						`create ${id}`
					);
				const promoteWith = (id: string, semanticVersion: number) =>
					dispatch(
						'PromoteBaseline',
						{
							promotionDecisionId: DEC,
							expectedItemObjectVersions: [{ objectId: PWU, semanticVersion }],
							requiredAssessmentIds: [ASSESS]
						},
						id,
						'BASELINE'
					);
				// THE CONTROL: a baseline still in CANDIDATE. Refused at the SAME site — so the acceptance below
				// is a missing comparison, not a command this handler never refuses.
				create(CTRL);
				const control = promoteWith(CTRL, 1);

				create(BASE);
				ok(dispatch('SubmitBaselineForReview', {}, BASE, 'BASELINE'), 'submit');
				ok(dispatch('ApproveBaseline', {}, BASE, 'BASELINE'), 'approve baseline');
				expect(
					(store.loadObject(BASE)?.state as { itemObjectVersions: { semanticVersion: number }[] })
						.itemObjectVersions[0]?.semanticVersion,
					'the baseline must have FROZEN version 1 for the mismatch to be a mismatch'
				).toBe(1);
				const admitted = promoteWith(BASE, 999);
				expect(
					(store.loadObject(BASE)?.state as { status: string }).status,
					'AUTHORITATIVE on a version the baseline never reviewed IS the admission'
				).toBe('AUTHORITATIVE');
				return { admitted, control };
			}
		},
		'RPH-GOV-001': null, // ENFORCED — observed in execrem-wp16-enforcement-observed.test.ts
		'RPH-PER-001': null,
		'RPH-PER-002': null,
		// ── THE TWO CROSS-AGGREGATE UNIQUENESS DISCLOSURES ────────────────────────────────────────────────────
		// Both rules ask "do TWO of these now exist over one subject?", and every duplicate defence this engine
		// has answers the different question "is THIS object being changed twice?". The controls below are the
		// same-aggregate re-issues, which ARE refused — that is what makes each acceptance a missing quantifier
		// rather than a site with no refusal machinery at all.
		'RPH-PER-003': {
			arrangement:
				'two DISTINCT Decision aggregates over the SAME subject, both approved to EFFECTIVE',
			run: () => {
				const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W01';
				const D1 = 'dec_01ARZ3NDEKTSV4RRFFQ69G5W11';
				const D2 = 'dec_01ARZ3NDEKTSV4RRFFQ69G5W12';
				const propose = (id: string) =>
					dispatch(
						'ProposeDecision',
						{
							decisionType: 'APPROVAL',
							subjectObjectIds: [SUBJECT],
							selectedOption: 'ship',
							rationale: 'looks right',
							authority: actor
						},
						id,
						'DECISION'
					);
				const approve = (id: string) =>
					dispatch(
						'ApproveDecision',
						{
							selectedOption: 'ship',
							rationale: 'looks right',
							consideredEvidenceIds: [],
							consideredObservationIds: [],
							subjectSemanticVersions: { [SUBJECT]: 1 }
						},
						id,
						'DECISION'
					);
				ok(propose(D1), 'propose D1');
				ok(approve(D1), 'approve D1');
				// THE CONTROL: the SAME decision approved again. Refused — the site's machinery is alive.
				const control = approve(D1);
				// THE ADMISSION: a SECOND decision over the SAME subject, approved. Both are now EFFECTIVE.
				ok(propose(D2), 'propose D2');
				const admitted = approve(D2);
				expect(
					(store.loadObject(D1)?.state as { status: string }).status,
					'D1 must be EFFECTIVE for "two effective decisions" to be the observed fact'
				).toBe('EFFECTIVE');
				expect(
					(store.loadObject(D2)?.state as { status: string }).status,
					'D2 must also be EFFECTIVE — that IS the admission'
				).toBe('EFFECTIVE');
				return { admitted, control };
			}
		},
		'RPH-PER-004': {
			arrangement:
				'two DISTINCT Baseline aggregates over the SAME itemObjectIds, both promoted to AUTHORITATIVE',
			run: () => {
				const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W21';
				const ASSESS = 'asmt_01ARZ3NDEKTSV4RRFFQ69G5W22';
				const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5W23';
				const B1 = 'base_01ARZ3NDEKTSV4RRFFQ69G5W24';
				const B2 = 'base_01ARZ3NDEKTSV4RRFFQ69G5W25';
				seedPolicy('pol_arch');
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: ASSESS,
							assurancePolicyId: 'pol_arch',
							policyVersion: '1',
							subjectObjectIds: [PWU],
							subjectSemanticVersions: { [PWU]: 1 },
							claimIds: []
						},
						ASSESS,
						'ASSURANCE_ASSESSMENT'
					),
					'request assessment'
				);
				ok(
					dispatch(
						'CompleteAssuranceAssessment',
						{
							validatorResult: floorValidatorResult({
								assessmentId: ASSESS,
								policyId: 'pol_arch',
								subjectId: PWU,
								subjectSemanticVersion: 1,
								disposition: 'SATISFIED'
							})
						},
						ASSESS,
						'ASSURANCE_ASSESSMENT'
					),
					'complete assessment'
				);
				ok(
					dispatch(
						'ProposeDecision',
						{
							decisionType: 'PROMOTE_BASELINE',
							subjectObjectIds: [PWU],
							selectedOption: 'promote',
							rationale: 'ready',
							authority: actor
						},
						DEC,
						'DECISION'
					),
					'propose promotion decision'
				);
				ok(
					dispatch(
						'ApproveDecision',
						{
							selectedOption: 'promote',
							rationale: 'ready',
							consideredEvidenceIds: [],
							consideredObservationIds: [],
							subjectSemanticVersions: { [PWU]: 1 }
						},
						DEC,
						'DECISION'
					),
					'approve promotion decision'
				);
				const driveToApproved = (id: string) => {
					ok(
						dispatch(
							'CreateBaseline',
							{
								baselineType: 'ARCHITECTURE',
								itemObjectIds: [PWU],
								assuranceAssessmentIds: [ASSESS]
							},
							id,
							'BASELINE'
						),
						`create ${id}`
					);
					ok(dispatch('SubmitBaselineForReview', {}, id, 'BASELINE'), `submit ${id}`);
					ok(dispatch('ApproveBaseline', {}, id, 'BASELINE'), `approve ${id}`);
				};
				const promote = (id: string) =>
					dispatch(
						'PromoteBaseline',
						{
							promotionDecisionId: DEC,
							expectedItemObjectVersions: [{ objectId: PWU, semanticVersion: 1 }],
							requiredAssessmentIds: [ASSESS]
						},
						id,
						'BASELINE'
					);
				driveToApproved(B1);
				ok(promote(B1), 'promote B1');
				// THE CONTROL: the SAME baseline re-promoted. Refused — and here BOTH the precondition and the
				// machine's declared illegal self-edge stand in the way, which is a stronger same-aggregate guard
				// than the Decision case has and makes the cross-aggregate silence starker.
				const control = promote(B1);
				// THE ADMISSION: a SECOND baseline freezing the SAME item, promoted. Both are AUTHORITATIVE.
				driveToApproved(B2);
				const admitted = promote(B2);
				expect(
					(store.loadObject(B1)?.state as { status: string }).status,
					'B1 must be AUTHORITATIVE for "two authoritative baselines" to be the observed fact'
				).toBe('AUTHORITATIVE');
				expect(
					(store.loadObject(B2)?.state as { status: string }).status,
					'B2 must also be AUTHORITATIVE — that IS the admission'
				).toBe('AUTHORITATIVE');
				return { admitted, control };
			}
		},
		'RPH-PER-005': null,
		'RPH-PER-006': null,
		'RPH-PER-007': null,
		'RPH-PER-008': null,
		'RPH-PER-009': null,
		'RPH-PER-010': null,
		'RPH-PER-011': null,
		'RPH-PER-012': null, // disclosed by a DEAD_PREDICATE census — guarded in rph-domain, not here
		'RPH-PER-013': null,
		'RPH-PER-014': null,
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
		// The RPH-INT family carries NO disclosures: three are ENFORCED (probed in the enforcement map) and four
		// are NOT_A_COMMAND_REFUSAL, so none appears in either observation map with a probe. Present as nulls
		// because this Record is total over the id union — which is what forced them to be considered at all.
		'RPH-INT-001': null,
		'RPH-INT-002': null,
		'RPH-INT-003': null,
		'RPH-INT-004': null,
		'RPH-INT-005': null,
		'RPH-INT-006': null,
		'RPH-INT-007': null,
		// ENFORCED at the SCHEMA layer — its refusal is probed in execrem-wp16-enforcement-observed.test.ts.
		'RPH-CON-002': null,
		'RPH-CON-001': null, // NOT_A_COMMAND_REFUSAL — and already the register's positive control everywhere
		'RPH-CON-008': null, // NOT_A_COMMAND_REFUSAL — no presentation command schema exists to constrain

		'RPH-CON-003': {
			arrangement:
				'an existing aggregate UPDATED with the envelope field expectedRevision OMITTED — accepted, and the aggregate really advances',
			run: () => {
				const I = 'int_01ARZ3NDEKTSV4RRFFQ69G5C31';
				ok(
					dispatch(
						'CaptureIntent',
						{ intentId: I, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
						I,
						'INTENT'
					),
					'capture'
				);
				const admitted = dispatch('BeginIntentDiscovery', {}, I, 'INTENT');
				// APPLIED, not merely accepted: the update really moved the aggregate, so this is last-write-wins
				// in the plane PER-4 forbids it in — not a no-op that happened to be tolerated.
				expect(
					(store.loadObject(I)?.state as Record<string, unknown>)?.intentStatus,
					'the omitted-revision update must really have advanced the aggregate'
				).toBe('UNDER_DISCOVERY');

				// CONTROL — the same update at the same function with ONE field ADDED: a revision that is WRONG.
				// loadOrReject DOES refuse that. The engine polices a wrong revision and ignores an absent one.
				const J = 'int_01ARZ3NDEKTSV4RRFFQ69G5C32';
				ok(
					dispatch(
						'CaptureIntent',
						{ intentId: J, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
						J,
						'INTENT'
					),
					'capture control'
				);
				const control = dispatchWith(
					'BeginIntentDiscovery',
					{},
					J,
					'INTENT',
					{ expectedRevision: 99 }
				);
				return { admitted, control };
			}
		},

		'RPH-CON-004': {
			arrangement:
				'a declared timestamp field carrying a non-RFC-3339 string — accepted, and persisted verbatim',
			run: () => {
				const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5C41';
				const admitted = proposeEvidence(EV, { capturedAt: 'definitely not a timestamp' });
				expect(
					(store.loadObject(EV)?.state as Record<string, unknown>)?.capturedAt,
					'the malformed timestamp must be PERSISTED, not merely tolerated at the boundary'
				).toBe('definitely not a timestamp');

				// CONTROL — the same payload schema, the same gate, a DECLARED field given an illegal value. It
				// refuses, so the boundary is alive and constraining on this very schema; what is missing is the
				// FORMAT constraint on the timestamp, not the gate. Boundary refusals carry VALIDATION_FAILED,
				// which the row declares via controlStatus.
				const control = proposeEvidence('evd_01ARZ3NDEKTSV4RRFFQ69G5C42', {
					evidenceType: 'NOT_A_TYPE'
				});
				return { admitted, control };
			}
		},

		'RPH-CON-005': {
			arrangement:
				'a validator result answering only four of five mandatory criteria, recommending SATISFIED — accepted, and the assessment advances',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5C51';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5C52';
				// THE POLICY MUST REALLY DECLARE FIVE. The first draft of this probe seeded the default
				// single-criterion policy and answered C1..C4 — so C1 WAS answered, nothing was unanswered, and the
				// probe was green for the wrong reason. A wiring mutant that required every declared criterion to
				// be answered left it green, which is how the misstatement surfaced. The arrangement's own words
				// ("five criteria, four answered") now hold.
				seedPolicy(POL, {
					criteria: [1, 2, 3, 4, 5].map((n) => ({
						id: `C${n}`,
						name: `Criterion ${n}`,
						description: 'a mandatory criterion',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'BLOCKING',
						mayBeNotApplicable: false
					}))
				});
				requestAssessment(ASM, POL);
				const admitted = completeAssessment(ASM, POL, {
					claimResults: [
						{ criterionId: 'C1', result: 'MET' },
						{ criterionId: 'C2', result: 'MET' },
						{ criterionId: 'C3', result: 'MET' },
						{ criterionId: 'C4', result: 'MET' }
						// C5 answered NOWHERE — the partial output the rule calls invalid.
					]
				});
				expect(
					(store.loadObject(ASM)?.state as Record<string, unknown>)?.assessmentState,
					'a partial validator result must really have mutated authoritative state'
				).toBe('SATISFIED');
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5C53', POL) };
			}
		},

		'RPH-CON-006': {
			arrangement:
				"a validatorResult declaring policyVersion '1.1.0' against an assessment created under '1.2.0' — accepted",
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5C61';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5C62';
				seedPolicy(POL, { criterionSeverity: 'MATERIAL' });
				requestAssessment(ASM, POL);
				const admitted = completeAssessment(ASM, POL, { policyVersion: '1.1.0' });
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5C63', POL) };
			}
		},

		'RPH-CON-007': {
			arrangement:
				'a validatorResult claiming subject version 1 against an assessment created to assess version 2 — accepted',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5C71';
				const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5C72';
				seedPolicy(POL, { criterionSeverity: 'MATERIAL' });
				// The assessment TARGETS version 2 …
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: ASM,
							assurancePolicyId: POL,
							policyVersion: '1.0.0',
							subjectObjectIds: [PARENT],
							subjectSemanticVersions: { [PARENT]: 2 },
							claimIds: []
						},
						ASM,
						'ASSURANCE_ASSESSMENT'
					),
					'request assessment targeting v2'
				);
				// … and the validator answers about version 1.
				const admitted = completeAssessment(ASM, POL, { subjectSemanticVersions: { [PARENT]: 1 } });
				return { admitted, control: parseGuardControl('asm_01ARZ3NDEKTSV4RRFFQ69G5C73', POL) };
			}
		},

		'RPH-PWU-001': null,
		'RPH-PWU-002': null,
		'RPH-PWU-004': null,
		'RPH-PWU-005': null,
		'RPH-PWU-006': null,

		'RPH-PWU-003': {
			arrangement:
				'a PWU Instance realizing a PWU Type the published architecture declares NON-ROOT, proposed with no parentWorkUnitId at all',
			run: () => {
				const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5301';
				const ROOT_T = 'pwt_01ARZ3NDEKTSV4RRFFQ69G5302';
				const CHILD_T = 'pwt_01ARZ3NDEKTSV4RRFFQ69G5303';
				const UND = 'und_01ARZ3NDEKTSV4RRFFQ69G5304';

				// A PURELY HUMAN-AUTHORED, NEVER-ASSESSED PWA PUBLISHES WITHOUT A FLOOR — pwaFloorGate applies to an
				// AI-produced PWA (createdBy AGENT/MODEL) or to one that HAS a recorded floor. The fixture actor is
				// HUMAN and no floor is recorded, so the whole de minimis chain is out of scope here. That is a
				// property of the gate, not a shortcut around it.
				ok(
					dispatch(
						'CreatePwa',
						{
							pwaId: PWA,
							name: 'Architecture with a non-root type',
							description: 'd',
							domain: 'software',
							version: '1.0.0'
						},
						PWA,
						'PROFESSIONAL_WORK_ARCHITECTURE'
					),
					'create pwa'
				);
				// ROOT must PERMIT the child, or the graph's `connected` invariant blocks publication — and it is
				// that reachability which makes CHILD_T unambiguously a NON-ROOT node of a VALID architecture,
				// which is the only thing that gives this rule's word "non-root" a subject.
				ok(
					dispatch(
						'DefinePwuType',
						{
							pwuTypeId: ROOT_T,
							pwaId: PWA,
							pwuKind: 'PRODUCT_REALIZATION',
							name: 'Root',
							purpose: 'the root',
							isRoot: true,
							permittedChildTypeIds: [CHILD_T]
						},
						ROOT_T,
						'PWU_TYPE'
					),
					'define root type'
				);
				ok(
					dispatch(
						'DefinePwuType',
						{
							pwuTypeId: CHILD_T,
							pwaId: PWA,
							pwuKind: 'PRODUCT_REALIZATION',
							name: 'Child',
							purpose: 'a non-root type',
							isRoot: false
						},
						CHILD_T,
						'PWU_TYPE'
					),
					'define child type'
				);
				ok(
					dispatch('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE'),
					'submit pwa'
				);
				ok(dispatch('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE'), 'validate pwa');
				ok(
					dispatch(
						'PublishPwa',
						{ rootPwuTypeId: ROOT_T },
						PWA,
						'PROFESSIONAL_WORK_ARCHITECTURE'
					),
					'publish pwa'
				);
				const pwaVersion = String(
					(store.loadObject(PWA)?.state as Record<string, unknown>)?.version ?? '1.0.0'
				);
				ok(
					dispatch(
						'CreateUndertaking',
						{
							undertakingId: UND,
							name: 'An undertaking',
							description: 'd',
							pwaId: PWA,
							pwaVersion,
							instantiationProfile: 'STANDARD',
							objective: 'ship it',
							intendedOutputProduct: 'the product'
						},
						UND,
						'UNDERTAKING'
					),
					'create undertaking'
				);

				const proposeChild = (pwuId: string, over: Record<string, unknown> = {}) =>
					dispatch(
						'ProposePwu',
						{
							pwuId,
							pwuKind: 'PRODUCT_REALIZATION',
							title: 'a non-root instance',
							description: 'd',
							intentId: INTENT,
							undertakingId: UND,
							pwuTypeId: CHILD_T,
							isLocalExtension: false,
							boundaries: {
								inScope: ['x'],
								outOfScope: ['y'],
								permittedChanges: [],
								prohibitedChanges: []
							},
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
							},
							...over
						},
						pwuId,
						'PROFESSIONAL_WORK_UNIT'
					);

				// THE ADMISSION: a non-root type instantiated with NO parentage of any kind.
				const admitted = proposeChild('pwu_01ARZ3NDEKTSV4RRFFQ69G5305');
				expect(
					(store.loadObject('pwu_01ARZ3NDEKTSV4RRFFQ69G5305')?.state as Record<string, unknown>)
						?.parentWorkUnitId,
					'the admitted PWU really must have no parentage at all'
				).toBeUndefined();

				// CONTROL — the same command at the same site with ONE field ADDED: a parent that does not resolve.
				// The engine polices a parent that is WRONG while ignoring one that is ABSENT, and its refusal
				// message literally ends "(PWU-003)" — production naming a rule id it does not enforce.
				const control = proposeChild('pwu_01ARZ3NDEKTSV4RRFFQ69G5306', {
					parentWorkUnitId: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5399'
				});
				return { admitted, control };
			}
		},

		'RPH-PWU-007': {
			arrangement:
				'a PWU whose own assurancePolicyIds names a policy whose required assessment came back REJECTED, moved to workLifecycleState SATISFIED by citing a second, satisfied assessment',
			run: () => {
				const PWU7 = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5701';
				const POL_REJ = 'pol_01ARZ3NDEKTSV4RRFFQ69G5702';
				const POL_OK = 'pol_01ARZ3NDEKTSV4RRFFQ69G5703';
				const ASM_REJ = 'asm_01ARZ3NDEKTSV4RRFFQ69G5704';
				const ASM_OK = 'asm_01ARZ3NDEKTSV4RRFFQ69G5705';
				const PLAN7 = 'pln_01ARZ3NDEKTSV4RRFFQ69G5706';

				seedPolicy(POL_REJ, { criterionSeverity: 'MATERIAL' });
				seedPolicy(POL_OK, { criterionSeverity: 'MATERIAL' });
				// A DEDICATED PROVISIONAL INTENT: `checkPwuShapeReadiness` requires a root PWU's intent to be at
				// least PROVISIONAL, and the shared fixture intent is left RAW on purpose (RPH-EVD-001's
				// arrangement depends on it). Driving the shared one would couple two unrelated probes.
				const INT7 = 'int_01ARZ3NDEKTSV4RRFFQ69G5708';
				ok(
					dispatch(
						'CaptureIntent',
						{ intentId: INT7, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
						INT7,
						'INTENT'
					),
					'capture intent 7'
				);
				ok(dispatch('BeginIntentDiscovery', {}, INT7, 'INTENT'), 'discover 7');
				ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INT7, 'INTENT'), 'provision 7');
				// THE PWU DECLARES THE REJECTING POLICY AS APPLICABLE TO ITSELF. `assurancePolicyIds` is a REQUIRED
				// field on ProposePwu and is WRITTEN to the aggregate (pwu.ts) — and read by nothing, anywhere, for
				// any decision. That is the gap this row records, and this field is where the rule's "required"
				// lives.
				proposePwu(PWU7, { assurancePolicyIds: [POL_REJ], intentId: INT7 });

				// The REJECTED required assessment — the rule's antecedent.
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: ASM_REJ,
							assurancePolicyId: POL_REJ,
							policyVersion: '1.0.0',
							subjectObjectIds: [PWU7],
							subjectSemanticVersions: { [PWU7]: 1 },
							claimIds: []
						},
						ASM_REJ,
						'ASSURANCE_ASSESSMENT'
					),
					'request the rejecting assessment'
				);
				ok(
					completeAssessmentFor(ASM_REJ, POL_REJ, PWU7, {
						dispositionRecommendation: 'REJECTED'
					}),
					'complete it REJECTED'
				);
				expect(
					(store.loadObject(ASM_REJ)?.state as Record<string, unknown>)?.assessmentState,
					'the antecedent is only real while that assessment truly reads REJECTED'
				).toBe('REJECTED');

				// A second, satisfied assessment — the one the controller will cite.
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: ASM_OK,
							assurancePolicyId: POL_OK,
							policyVersion: '1.0.0',
							subjectObjectIds: [PWU7],
							subjectSemanticVersions: { [PWU7]: 1 },
							claimIds: []
						},
						ASM_OK,
						'ASSURANCE_ASSESSMENT'
					),
					'request the satisfying assessment'
				);
				ok(completeAssessmentFor(ASM_OK, POL_OK, PWU7), 'complete it SATISFIED');

				// Execution genuinely succeeds against a live plan — `rejectUnbackedExecutionSuccess` demands it.
				succeededPlanFor(PWU7, PLAN7);
				const hop = (over: Record<string, unknown>) =>
					ok(pwuState(PWU7, String(over.previousState), String(over.newState), over), 'hop');
				ok(dispatch('BeginPwuShaping', {}, PWU7, 'PROFESSIONAL_WORK_UNIT'), 'shape');
				ok(
					dispatch(
						'MarkPwuReady',
						{ shapeReadinessAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5707', expectedSemanticVersion: 1 },
						PWU7,
						'PROFESSIONAL_WORK_UNIT'
					),
					'ready'
				);
				hop({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
				hop({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
				hop({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
				hop({
					previousState: 'EXECUTING',
					newState: 'EVIDENCE_PENDING',
					executionState: 'SUCCEEDED',
					assuranceState: 'EVIDENCE_REQUIRED',
					supportingObjectIds: [PLAN7]
				});
				hop({
					previousState: 'EVIDENCE_PENDING',
					newState: 'UNDER_ASSURANCE',
					executionState: 'SUCCEEDED',
					assuranceState: 'READY_FOR_ASSESSMENT'
				});
				hop({
					previousState: 'UNDER_ASSURANCE',
					newState: 'UNDER_ASSURANCE',
					executionState: 'SUCCEEDED',
					assuranceState: 'ASSESSING'
				});

				// THE ADMISSION: SATISFIED, citing only the satisfied assessment, while ASM_REJ still reads REJECTED
				// against a policy this PWU itself declares.
				const admitted = pwuState(PWU7, 'UNDER_ASSURANCE', 'SATISFIED', {
					executionState: 'SUCCEEDED',
					assuranceState: 'SATISFIED',
					supportingObjectIds: [ASM_OK],
					reasonCode: 'controller satisfies'
				});

				// CONTROL — the byte-identical command with ONE field changed: assuranceState left at ASSESSING,
				// i.e. the controller declining to assert a disposition rather than cherry-picking one to back it.
				// Refused by the very limb that decides "the PWU transitions to SATISFIED"
				// (`rejectIllegalWorkLifecycleMove` -> the UNDER_ASSURANCE->SATISFIED cross-axis guard). So the site
				// that owns this arrow IS alive; it just never looks past the assessment it was handed.
				const control = pwuState(PWU7, 'UNDER_ASSURANCE', 'SATISFIED', {
					executionState: 'SUCCEEDED',
					assuranceState: 'ASSESSING',
					supportingObjectIds: [],
					reasonCode: 'controller satisfies'
				});
				return { admitted, control };
			}
		},

		'RPH-PWU-008': {
			arrangement:
				'a PWU in INVALIDATED frozen into a Baseline and promoted to AUTHORITATIVE — the promotion path never reads the item’s lifecycle',
			run: () => {
				const B = baselineChain('A');
				// THE ARRANGEMENT IS SEEDED, THE ADMISSION IS DRIVEN — the same split `pwu-fixtures.ts` states and
				// the RPH-PWU-010 probe already uses. INVALIDATED has exactly three in-arrows (SATISFIED,
				// CONDITIONALLY_SATISFIED, RECOMPOSED), so driving it means walking the entire execution and
				// assurance chain, which can fail for many reasons unrelated to THIS rule — and each would present
				// as "RPH-PWU-008 is enforced after all". The seeding helper checks the state against the ratified
				// machine's own list and re-parses the aggregate, so nothing rehearses against an impossible PWU.
				seedPwuWorkLifecycleState_FIXTURE(store, B.pwu, 'INVALIDATED');
				expect(
					(store.loadObject(B.pwu)?.state as Record<string, unknown>)?.workLifecycleState,
					'the arrangement is only meaningful while the PWU really is INVALIDATED'
				).toBe('INVALIDATED');
				const admitted = B.promote();
				// Assert the ITEM as well as the acceptance: a promotion that quietly dropped the invalidated item
				// would be a different (and better) engine, and would green this probe for the wrong reason.
				expect(
					(store.loadObject(B.baseline)?.state as Record<string, unknown>)?.status,
					'the baseline must really have become authoritative over the invalidated item'
				).toBe('AUTHORITATIVE');

				// CONTROL — the SAME command at the SAME site, one object type over. The promotion IS refused when
				// the EVIDENCE it rests on is invalidated, which proves promoteBaseline polices invalidation and
				// simply never asks the question about its ITEMS.
				const C = baselineChain('B', { withEvidence: true });
				ok(
					dispatch(
						'InvalidateEvidence',
						{ invalidationReason: 'source retracted' },
						C.evidence,
						'EVIDENCE'
					),
					'invalidate the control evidence'
				);
				return { admitted, control: C.promote() };
			}
		},

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
			// THE EXPECTED CONTROL STATUS IS DECLARED BY THE ROW, defaulting to REJECTED. A boundary refusal carries
			// VALIDATION_FAILED, so a row whose disclosed gap is at the CONTRACT layer must say so — and only that
			// row's control may be a boundary refusal. Accepting either status for every row would let a merely
			// MALFORMED control satisfy a COMMAND row, which is the commonest fixture error in this repository.
			const expectedControl =
				(row.guard.kind === 'OBSERVED_ADMISSION' ? row.guard.controlStatus : undefined) ?? 'REJECTED';
			expect(
				control.status,
				`${id}: the control must be REFUSED (${expectedControl}), proving the site's guard is alive and ` +
					`this rule is simply missing from it (observed ${control.status} ${control.code ?? ''}: ` +
					`${control.message ?? ''})`
			).toBe(expectedControl);
		}
	);

	it('the disclosed arrangements are DISTINCT — no two rows are satisfied by one observation', () => {
		// The mirror of the refusal-marker distinctness gate. Two disclosures sharing an arrangement would report
		// two unenforced rules while only one thing had ever been dispatched.
		const arrangements = observedAdmissionRuleIds().map((id) => PROBES[id]?.arrangement ?? id);
		expect(new Set(arrangements).size, 'duplicate arrangement(s)').toBe(arrangements.length);
	});
});
