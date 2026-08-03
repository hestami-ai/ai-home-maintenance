// JAN-EXECREM WP-16 / SM-6 gate (c) — every rule the ENFORCEMENT REGISTER declares ENFORCED is OBSERVED refusing,
// end to end, through `Engine.dispatch`.
//
// THIS IS THE TEST THE REGISTER EXISTS TO FORCE. DS-001 §4 item 2: the coverage manifest certified RPH-PWU-010
// COVERED because a test called `canResumeExecutionOnPwu` and checked its return value. The predicate was correct;
// nothing in the running engine asked it. A pure-function assertion cannot distinguish "this rule is enforced"
// from "this function computes what the rule says", and the whole family of defects this programme fixes lives in
// that gap.
//
// So an ENFORCED claim is settled here and nowhere else, and it must survive three ways of being wrong:
//
//   ADMITTED    the command was accepted — the rule is not enforced at all.
//   WRONG_CODE  something refused, but a different check did.
//   MASKED      the right CODE from the wrong GUARD. `RPH_ILLEGAL_STATE_TRANSITION` is produced by the machine, by
//               four prechecks and by every source set in the system, so a probe asserting only the code proves
//               that SOMETHING refused. That is the vacuous negative, and it is why every row carries a distinct
//               >=20-character marker string that only its own refusal produces.
//
// EVERY PROBE CARRIES A CONTROL. A refusal proves nothing if the same command would have been refused anyway: the
// control is the SAME command accepted before the arranging act, so the arrangement is demonstrably what flipped
// it. Without that half, a handler that refused everything would pass this entire file.
//
// The probe map is TOTAL over `enforcedRuleIds()` by TYPE — adding an ENFORCED row without a probe is a compile
// error, which is the property that makes the register an instrument rather than a document.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import {
	classifyRefusal,
	ENFORCEMENT_REGISTER,
	enforcedRuleIds,
	type RegisteredRuleId
} from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';
import { floorValidatorResult, seedPolicy as seedFloorPolicyFixture } from './__tests__/floor-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H6100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H6120';
const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69H6130';
const sid = (i: number) => `${PLAN}-s${i}`;

const AUTHORITY = {
	authorityId: 'auth_arch',
	authorityType: 'ORGANIZATIONAL_ROLE' as const,
	scope: ['architecture'],
	validFrom: TS
};

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

/** What a dispatch returned, reduced to the fields `classifyRefusal` reads. */
interface Outcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
	/**
	 * The boundary's structured issues, carried for SCHEMA-layer rows. The message at that layer is the constant
	 * 'Schema validation failed', so `details.issues` is the only thing that can say WHICH field refused.
	 */
	readonly issues?: readonly { readonly path: string; readonly code: string }[];
}

/** One rule's proof: the same command ACCEPTED before the arranging act, then REFUSED after it. */
interface Probe {
	/** What the arranging act is, and why it is the thing that should flip the answer. */
	readonly arrangement: string;
	readonly run: () => { readonly control: Outcome; readonly observed: Outcome };
}

describe('JAN-EXECREM WP-16 (c) — the enforcement register is OBSERVED, not asserted', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	/** Distinct id space per decompositionProbe() call — three probes share one engine per test. */
	let probeSeq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id = PLAN,
		aggType = 'EXECUTION_PLAN'
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
			correlationId: 'wp16',
			idempotencyKey: `k-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		const issues = (r.error?.details as { issues?: { path: string; code: string }[] } | undefined)
			?.issues;
		return { status: r.status, code: r.error?.code, message: r.error?.message, issues };
	}

	/**
	 * `dispatch` with extra ENVELOPE fields. Added 2026-08-02 for RPH-PER-001, whose subject is the envelope field
	 * `expectedRevision` rather than anything in a payload — the same seam `disclosure-observed.test.ts` needed for
	 * RPH-CON-003, which is the OTHER half of this field's story: that row discloses that OMITTING it is admitted,
	 * this one proves that SENDING a stale one is refused.
	 */
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
			correlationId: 'wp16',
			idempotencyKey: `k-${n}`,
			payload,
			...envelope
		};
		const r = engine.dispatch(command as unknown as DomainCommand);
		return { status: r.status, code: r.error?.code, message: r.error?.message };
	}

	const seedFloorPolicy = (policyId: string): void =>
		seedFloorPolicyFixture({ dispatch: (c: unknown) => engine.dispatch(c as never) } as never, policyId);

	const ok = (r: Outcome, what: string): Outcome => {
		expect(r.status, `${what}: ${r.message}`).toBe('ACCEPTED');
		return r;
	};

	/**
	 * The shared arrangement for RPH-DEC-002, RPH-DEC-003 and RPH-CNS-003 — three rules refused at ONE site with
	 * ONE message, distinguished only by the finding code interpolated into it.
	 *
	 * Each `limb` builds a CONTROL decomposition that passes the gate and an OBSERVED one differing in exactly the
	 * field its own rule is about. Sharing the scaffolding is what makes that difference the only difference: if
	 * the two decompositions were built separately, a stray field could refuse for a sibling's reason and the
	 * marker check alone would not tell (it would report MASKED, but from the wrong arrangement).
	 */
	function decompositionProbe(limb: 'obligation' | 'constraint' | 'rationale'): {
		control: Outcome;
		observed: Outcome;
	} {
		const n = ++probeSeq;
		const INT = `int_01ARZ3NDEKTSV4RRFFQ69H7${n}00`;
		const mk = (suffix: string) => ({
			parent: `pwu_01ARZ3NDEKTSV4RRFFQ69H7${n}${suffix}1`,
			child: `pwu_01ARZ3NDEKTSV4RRFFQ69H7${n}${suffix}2`,
			obl: `obl_01ARZ3NDEKTSV4RRFFQ69H7${n}${suffix}3`,
			con: `con_01ARZ3NDEKTSV4RRFFQ69H7${n}${suffix}4`,
			dcp: `dcp_01ARZ3NDEKTSV4RRFFQ69H7${n}${suffix}5`
		});
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INT,
				'INTENT'
			),
			'capture intent'
		);
		const proposePwu = (id: string, obligationIds: string[], constraintIds: string[]) =>
			ok(
				dispatch(
					'ProposePwu',
					{
						pwuId: id,
						pwuKind: 'ARCHITECTURE',
						title: id,
						description: 'd',
						intentId: INT,
						boundaries: {
							inScope: [],
							outOfScope: [],
							permittedChanges: [],
							prohibitedChanges: []
						},
						obligationIds,
						constraintIds,
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
					id,
					'PROFESSIONAL_WORK_UNIT'
				),
				`propose ${id}`
			);

		/** Build one decomposition and validate it. `pass` selects the arrangement the gate should accept. */
		const drive = (pass: boolean): Outcome => {
			const v = mk(pass ? 'A' : 'B');
			const gatesObligation = limb === 'obligation';
			ok(
				dispatch(
					'AssertObligation',
					{
						statement: 'Isolate tenant data',
						obligationType: 'SECURITY',
						sourceObjectId: v.parent,
						authority: AUTHORITY,
						strength: 'MANDATORY'
					},
					v.obl,
					'OBLIGATION'
				),
				'assert obligation'
			);
			ok(
				dispatch(
					'AssertConstraint',
					{
						statement: 'Encrypt PII at rest',
						constraintType: 'SECURITY',
						sourceObjectId: v.parent,
						authority: AUTHORITY,
						applicability: {},
						strength: 'MANDATORY'
					},
					v.con,
					'CONSTRAINT'
				),
				'assert constraint'
			);
			// The PARENT carries the mandatory obligation, and the constraint only when a constraint limb is
			// under test — an unrelated mandatory constraint would refuse every arrangement for DEC-003's reason.
			proposePwu(v.parent, [v.obl], gatesObligation ? [] : [v.con]);
			proposePwu(v.child, [], []);

			// The obligation is always accounted for EXCEPT in the obligation limb's failing arrangement.
			const obligationFields =
				gatesObligation && !pass ? {} : { retainedParentObligationIds: [v.obl] };
			// The constraint disposition varies by limb.
			const constraintFields = gatesObligation
				? {}
				: {
						constraintPropagations: [
							limb === 'constraint'
								? // DEC-003: the failing arrangement omits the relevant child entirely.
									{
										constraintId: v.con,
										childWorkUnitIds: pass ? [v.child] : [],
										disposition: 'PROPAGATED'
									}
								: // CNS-003: INAPPLICABLE, and the ONLY difference is the rationale.
									{
										constraintId: v.con,
										childWorkUnitIds: [v.child],
										disposition: 'INAPPLICABLE',
										// The arm refuses on `!rationale || !authorityDecisionId`, so the authority is
										// present in BOTH arrangements and the RATIONALE is the only delta — otherwise
										// the control would fail for the sibling reason under the same finding code.
										authorityDecisionId: 'dec_01ARZ3NDEKTSV4RRFFQ69H7999',
										...(pass ? { rationale: 'the child holds no PII' } : {})
									}
						]
					};
			ok(
				dispatch(
					'ProposeDecomposition',
					{
						parentWorkUnitId: v.parent,
						childWorkUnitIds: [v.child],
						rationale: 'split',
						...obligationFields,
						...constraintFields
					},
					v.dcp,
					'DECOMPOSITION_CONTRACT'
				),
				'propose decomposition'
			);
			return dispatch(
				'ValidateDecomposition',
				{ disposition: 'VALID' },
				v.dcp,
				'DECOMPOSITION_CONTRACT'
			);
		};
		return { control: drive(true), observed: drive(false) };
	}

	/**
	 * The shared arrangement for RPH-BAS-003/004/006 and RPH-GOV-003 — four rules refused by ONE handler, three of
	 * them through one joined finding-code message and the fourth at a later arm with its own sentence.
	 *
	 * `defect` selects what the OBSERVED promotion gets wrong; the CONTROL is the same promotion with that one
	 * thing right. Everything else — the PWU, the satisfied assessment, the effective decision, the approved
	 * baseline — is identical, so the delta is the rule under test and nothing else.
	 */
	function promotionProbe(
		defect: 'blocking-observation' | 'unsatisfied-assessment' | 'no-decision' | 'stale-version'
	): { control: Outcome; observed: Outcome } {
		const n = ++probeSeq;
		const b = (suffix: string) => ({
			pwu: `pwu_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}1`,
			asmt: `asmt_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}2`,
			bad: `asmt_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}6`,
			dec: `dec_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}3`,
			base: `base_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}4`,
			obs: `obs_01ARZ3NDEKTSV4RRFFQ69H8${n}${suffix}5`
		});

		const drive = (pass: boolean): Outcome => {
			const v = b(pass ? 'A' : 'B');
			const POL = `pol_bas_${n}${pass ? 'A' : 'B'}`;
			seedFloorPolicy(POL);
			// THE SUBJECT MUST EXIST. decisionAuthorizesVersions skips a subject the store cannot load
			// (`currentVersion === undefined` — a documented fail-open), so without this the RPH-GOV-003
			// arrangement is ACCEPTED for the wrong reason and the probe reports a false ADMITTED.
			const INT2 = `int_01ARZ3NDEKTSV4RRFFQ69H8${n}${pass ? 'A' : 'B'}0`;
			ok(
				dispatch(
					'CaptureIntent',
					{ intentId: INT2, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
					INT2,
					'INTENT'
				),
				'capture intent'
			);
			ok(
				dispatch(
					'ProposePwu',
					{
						pwuId: v.pwu,
						pwuKind: 'ARCHITECTURE',
						title: 'subject',
						description: 'd',
						intentId: INT2,
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
					v.pwu,
					'PROFESSIONAL_WORK_UNIT'
				),
				'propose subject pwu'
			);
			const requestAndComplete = (
				id: string,
				disposition: 'SATISFIED' | 'REJECTED'
			) => {
				ok(
					dispatch(
						'RequestAssuranceAssessment',
						{
							assessmentId: id,
							assurancePolicyId: POL,
							policyVersion: '1',
							subjectObjectIds: [v.pwu],
							subjectSemanticVersions: { [v.pwu]: 1 },
							claimIds: []
						},
						id,
						'ASSURANCE_ASSESSMENT'
					),
					`request ${id}`
				);
				ok(
					dispatch(
						'CompleteAssuranceAssessment',
						{
							validatorResult: floorValidatorResult({
								assessmentId: id,
								policyId: POL,
								subjectId: v.pwu,
								subjectSemanticVersion: 1,
								disposition
							})
						},
						id,
						'ASSURANCE_ASSESSMENT'
					),
					`complete ${id}`
				);
			};
			requestAndComplete(v.asmt, 'SATISFIED');
			// The unsatisfied-assessment defect adds a SECOND, REJECTED assessment to the required list.
			const wantsBad = defect === 'unsatisfied-assessment' && !pass;
			if (wantsBad) requestAndComplete(v.bad, 'REJECTED');

			// A blocking observation over the baselined item, OPEN — only in that defect's failing arrangement.
			if (defect === 'blocking-observation' && !pass) {
				ok(
					dispatch(
						'RecordAssuranceObservation',
						{
							assessmentId: v.asmt,
							observationType: 'FINDING',
							findingCode: 'TENANT_ISOLATION_BREACH',
							severity: 'BLOCKING',
							statement: 'tenant data is not isolated'
						},
						v.obs,
						'ASSURANCE_OBSERVATION'
					),
					'record blocking observation'
				);
			}

			// The promotion decision. The no-decision defect never makes it EFFECTIVE.
			ok(
				dispatch(
					'ProposeDecision',
					{
						decisionType: 'PROMOTE_BASELINE',
						subjectObjectIds: [v.pwu],
						selectedOption: 'promote',
						rationale: 'ready',
						authority: actor
					},
					v.dec,
					'DECISION'
				),
				'propose promotion decision'
			);
			const wantsNoDecision = defect === 'no-decision' && !pass;
			if (!wantsNoDecision) {
				// The stale-version defect approves the decision binding version 2 while the subject is at 1.
				const boundVersion = defect === 'stale-version' && !pass ? 2 : 1;
				ok(
					dispatch(
						'ApproveDecision',
						{
							selectedOption: 'promote',
							rationale: 'ready',
							consideredEvidenceIds: [],
							consideredObservationIds: [],
							subjectSemanticVersions: { [v.pwu]: boundVersion }
						},
						v.dec,
						'DECISION'
					),
					'approve promotion decision'
				);
			}

			ok(
				dispatch(
					'CreateBaseline',
					{
						baselineType: 'ARCHITECTURE',
						itemObjectIds: [v.pwu],
						assuranceAssessmentIds: [v.asmt]
					},
					v.base,
					'BASELINE'
				),
				`create ${v.base}`
			);
			ok(dispatch('SubmitBaselineForReview', {}, v.base, 'BASELINE'), 'submit');
			ok(dispatch('ApproveBaseline', {}, v.base, 'BASELINE'), 'approve baseline');
			return dispatch(
				'PromoteBaseline',
				{
					promotionDecisionId: v.dec,
					expectedItemObjectVersions: [{ objectId: v.pwu, semanticVersion: 1 }],
					requiredAssessmentIds: wantsBad ? [v.asmt, v.bad] : [v.asmt]
				},
				v.base,
				'BASELINE'
			);
		};
		return { control: drive(true), observed: drive(false) };
	}

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'HUMAN_INTERACTION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	const chg = (previousState: string, newState: string) =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'fixture',
				supportingObjectIds: []
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);

	const start = (i: number) => dispatch('StartExecutionStep', { stepId: sid(i) });
	const fail = (i: number) =>
		dispatch('FailExecutionStep', { stepId: sid(i), failureReason: 'boom' });
	const retry = (i: number) => dispatch('RetryExecutionStep', { stepId: sid(i) });

	/** Complete step `i`. `explicit` false omits BOTH outputs and the no-output assertion — the RPH-EXE-006 case. */
	const complete = (i: number, explicit = true) =>
		dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			...(explicit ? { noOutputResult: SAYS_NOTHING } : {}),
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
		});

	/** An ACTIVE 3-step linear plan on an OPEN (READY) PWU. Returns the activation outcome. */
	function activePlan(retryPolicy: Record<string, unknown> = {}): Outcome {
		ok(chg('PROPOSED', 'SHAPING'), 'shaping');
		ok(chg('SHAPING', 'READY'), 'ready');
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1), mkStep(2), mkStep(3)],
				transitions: [],
				retryPolicy,
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		return ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	}

	// ── intent fixtures (RPH-INT-003/004/005) ────────────────────────────────────────────────────────────────
	// The lifecycle is RAW -> UNDER_DISCOVERY -> PROVISIONAL -> FORMALIZED.
	//
	// A FORMALIZED INTENT IS AT v1, NOT v2, AND THAT IS A FINDING RATHER THAN A FIXTURE DETAIL. RPH-INT-002's
	// ratified statement says FormalizeIntent "increments semantic version"; `formalizeIntent` does not set
	// `bumpSemanticVersion`, and only `reviseIntent` does. The controls below therefore approve v1 — and they had
	// to be corrected to it, because the first draft assumed the rule was performed. See REG-F-009.

	const captureIntent = (id: string) =>
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: id, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				id,
				'INTENT'
			),
			`capture ${id}`
		);

	/** Drive an intent to FORMALIZED. `outcomes` defaults to one; pass [] for the RPH-INT-004 arrangement. */
	const formalizeIntent = (id: string, outcomes: unknown[] = [{ statement: 'the outcome' }]) => {
		ok(dispatch('BeginIntentDiscovery', {}, id, 'INTENT'), `discover ${id}`);
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, id, 'INTENT'), `provision ${id}`);
		ok(
			dispatch(
				'FormalizeIntent',
				{
					formalizedObjective: 'objective',
					desiredOutcomes: outcomes,
					successConditions: [],
					nonGoals: [],
					ambiguityIds: [],
					constraintIds: [],
					stakeholderIds: []
				},
				id,
				'INTENT'
			),
			`formalize ${id}`
		);
	};

	const approveIntent = (id: string, approvedSemanticVersion: number) =>
		dispatch(
			'ApproveIntent',
			{
				decisionId: `dec_${id.slice(-4)}`,
				approvedSemanticVersion,
				approvalScope: 'the whole intent'
			},
			id,
			'INTENT'
		);

	// ── assurance fixtures (RPH-ASR-002 / RPH-ASR-007) ───────────────────────────────────────────────────────
	// A subject the assessments can name. The PWU seeded in beforeEach serves; these only need it to exist.

	/** Create and ACTIVATE a minimal policy. A non-floor policy is born DRAFT and cannot be assessed against. */
	const asrPolicy = (policyId: string, over: Record<string, unknown> = {}): Outcome => {
		const created = dispatch(
			'CreateAssurancePolicy',
			{
				policyId,
				version: '1.0.0',
				name: `ASR probe policy ${policyId}`,
				purpose: 'Assess the subject against its approved need.',
				rationale: 'Seeded for a live enforcement probe.',
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
				independenceRequirement: 'NONE',
				findingDefinitions: [],
				permittedControlActions: ['CONTINUE'],
				...over
			},
			policyId,
			'ASSURANCE_POLICY'
		);
		if (created.status !== 'ACCEPTED') return created;
		return dispatch('ActivateAssurancePolicy', { policyId }, policyId, 'ASSURANCE_POLICY');
	};

	/** Request an assessment against `policyId` and complete it; `over` mutates the validator result. */
	const asrComplete = (
		assessmentId: string,
		policyId: string,
		over: Record<string, unknown> = {}
	): Outcome => {
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			),
			`request assessment ${assessmentId}`
		);
		return dispatch(
			'CompleteAssuranceAssessment',
			{
				validatorResult: {
					validatorId: 'reviewer',
					validatorVersion: '1',
					policyId,
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
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
	};

	/** Propose + approve a successor plan on the SAME PWU, and return the activation attempt (not asserted). */
	function proposeSuccessor(): Outcome {
		ok(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN2,
					workUnitId: PWU,
					steps: [{ ...mkStep(1), id: `${PLAN2}-s1`, executionPlanId: PLAN2 }],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN2
			),
			'successor propose'
		);
		return ok(dispatch('ApproveExecutionPlan', {}, PLAN2), 'successor approve');
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
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
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
	});

	/**
	 * TOTAL over the ENFORCED rows, by type. A row added to the register with no probe here does not compile.
	 *
	 * Written as a `Record` over the id union rather than a list, for the same reason `STEP_COMMAND_SPECS` is: a
	 * list can be short by one and nothing notices. That is the omission this whole programme is about.
	 */
	const PROBES: Readonly<Record<RegisteredRuleId, Probe | null>> = {
		'RPH-EXE-001': {
			arrangement: 'a second plan on the same PWU, with the first still ACTIVE and not superseded',
			run: () => {
				const control = activePlan(); // the FIRST activation is accepted…
				proposeSuccessor();
				return {
					control,
					observed: dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN2)
				};
			}
		},
		'RPH-EXE-002': {
			arrangement: 'the plan superseded out from under a step that has not started',
			run: () => {
				activePlan();
				const control = start(1); // Start is accepted while the plan is ACTIVE…
				ok(complete(1), 'complete s1');
				proposeSuccessor();
				ok(dispatch('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }), 'supersede');
				return { control, observed: start(2) };
			}
		},
		'RPH-EXE-003': {
			arrangement: 'a step whose runtimeBindingId names a binding that has been REVOKED',
			run: () => {
				// JAN-EXEBIND WP-B1 closed this row, and the register's totality gate FORCED this probe: the map is a
				// total Record over the id union, so flipping RPH-EXE-003 to ENFORCED does not compile until an
				// observation exists.
				//
				// TWO BINDINGS, ONE PER STEP — corrected by JAN-REVREM RW-3. This fixture used ONE binding for both
				// steps, which was only legal because nothing compared the binding's ratified `executionStepId` to the
				// step being started (review finding #2). The moment that scope check landed, this probe started
				// failing for the WRONG reason. A fixture that depended on the hole; made honest, not weakened.
				const bindFor = (n: number) => `bind_01ARZ3NDEKTSV4RRFFQ69H614${n}`;
				const requestBinding = (n: number) =>
					ok(
						dispatch(
							'RequestRuntimeBinding',
							{
								runtimeBindingId: bindFor(n),
								executionStepId: sid(n),
								roleId: 'role-architect',
								requestedCapabilities: [{ capability: 'file-system' }]
							},
							bindFor(n),
							'RUNTIME_BINDING'
						),
						`request binding ${n}`
					);
				const authorize = (n: number) =>
					ok(
						dispatch(
							'AuthorizeRuntimeBinding',
							{ grantedCapabilities: [{ capability: 'file-system' }] },
							bindFor(n),
							'RUNTIME_BINDING'
						),
						`authorize ${n}`
					);

				requestBinding(1);
				requestBinding(2);
				ok(chg('PROPOSED', 'SHAPING'), 'shaping');
				ok(chg('SHAPING', 'READY'), 'ready');
				ok(
					dispatch('ProposeExecutionPlan', {
						executionPlanId: PLAN,
						workUnitId: PWU,
						steps: [
							{ ...mkStep(1), runtimeBindingId: bindFor(1) },
							{ ...mkStep(2), runtimeBindingId: bindFor(2) }
						],
						transitions: [],
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}),
					'propose'
				);
				ok(dispatch('ApproveExecutionPlan', {}), 'approve');
				ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');

				authorize(1);
				authorize(2);
				const control = start(1); // …the control accepts under an AUTHORIZED binding
				ok(complete(1), 'complete s1');

				// …and REVOKING s2's OWN binding refuses s2 — so the arrangement under test is the STATUS, not the
				// scope. The two limbs are kept apart deliberately: the marker asserted below is the status one.
				ok(
					dispatch(
						'RevokeRuntimeCapability',
						{ reason: 'credential rotated mid-plan' },
						bindFor(2),
						'RUNTIME_BINDING'
					),
					'revoke'
				);
				return { control, observed: start(2) };
			}
		},
		'RPH-EXE-004': null,
		// JAN-CAPBIND WP-3 (N-3). This slot was `null` because RPH-EXE-005 was UNENFORCED — its subject
		// (`InputBinding`) was `Source TBD` in the corpus, so the rule had nothing to quantify over. WP-0 authored
		// the shape; this is the observation that the wiring actually refuses through `Engine.dispatch`.
		'RPH-EXE-005': {
			arrangement:
				'a QUEUED step on an ACTIVE plan and an OPEN PWU, naming no runtime binding, whose REQUIRED input artifact does not resolve',
			run: () => {
				// Every earlier limb is deliberately satisfied so the input-readiness limb is the ONLY thing that can
				// refuse: ACTIVE plan, open PWU, no binding (out of scope), QUEUED source state, first step so the
				// start-gate is clear. Reaching this refusal through any other guard would be a vacuous negative.
				ok(chg('PROPOSED', 'SHAPING'), 'shaping');
				ok(chg('SHAPING', 'READY'), 'ready');
				ok(
					dispatch('ProposeExecutionPlan', {
						executionPlanId: PLAN,
						workUnitId: PWU,
						steps: [
							mkStep(1),
							{
								...mkStep(2),
								inputBindings: [{ artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69HZZZZ', required: true }]
							},
							mkStep(3)
						],
						transitions: [],
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}),
					'propose'
				);
				ok(dispatch('ApproveExecutionPlan', {}), 'approve');
				ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
				// THE CONTROL is step 1 — the SAME command, on the same plan, differing ONLY in that its declared
				// inputs are empty. Without it the limb could refuse every Start and this probe would still be green,
				// which is over-refusal wearing the fix's clothes.
				//
				// The control must run FIRST and be COMPLETED, because the linear start-gate refuses a step whose
				// predecessor is not terminal-success — so observing step 2 while step 1 sat QUEUED would produce a
				// refusal from a DIFFERENT guard, i.e. the vacuous negative this whole probe map exists to prevent.
				const control = dispatch('StartExecutionStep', { stepId: sid(1) });
				ok(control, 'control: start s1 with empty inputs');
				ok(complete(1, true), 'complete s1 so the start-gate is clear for s2');
				const observed = dispatch('StartExecutionStep', { stepId: sid(2) });
				return { control, observed };
			}
		},
		'RPH-EXE-006': {
			arrangement:
				'a completion carrying neither an output artifact NOR an explicit no-output assertion',
			run: () => {
				activePlan();
				ok(start(1), 'start s1');
				const control = complete(1, true); // the SAME command, with the assertion present…
				ok(start(2), 'start s2');
				return { control, observed: complete(2, false) };
			}
		},
		'RPH-EXE-007': null,
		'RPH-EXE-008': {
			arrangement: 'a retry issued after the plan retry policy cap is reached',
			run: () => {
				activePlan({ maxAttempts: 2 });
				ok(start(1), 'attempt 1');
				ok(fail(1), 'fail 1');
				const control = retry(1); // the first retry is within the cap…
				ok(start(1), 'attempt 2');
				ok(fail(1), 'fail 2');
				return { control, observed: retry(1) };
			}
		},
		'RPH-EXE-009': null,
		'RPH-PWU-009': {
			arrangement: 'the owning PWU moved to SUPERSEDED while its plan is still ACTIVE',
			run: () => {
				activePlan();
				const control = start(1); // Start is accepted while the PWU is open…
				ok(complete(1), 'complete s1');
				// SUPERSEDED via the seam for the same reason as BASELINED below: `SupersedePwu` requires a successor
				// PWU whose construction is a decomposition-plane arrangement with nothing to do with this rule.
				seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SUPERSEDED');
				return { control, observed: start(2) };
			}
		},
		'RPH-PWU-010': {
			arrangement: 'the owning PWU BASELINED while its plan is still ACTIVE',
			run: () => {
				activePlan();
				const control = start(1);
				ok(complete(1), 'complete s1');
				// Seeded, and the split is stated in `pwu-fixtures.ts`: BASELINED has exactly two in-arrows (SATISFIED,
				// RECOMPOSED — `READY -> BASELINED` is explicitly ILLEGAL), so arranging it through the bus means
				// driving the entire assurance chain. That chain can fail for eight reasons unrelated to this rule,
				// and each would present as "RPH-PWU-010 is not enforced". The ARRANGEMENT is seeded; the REFUSAL is
				// driven, which is the half this gate is about.
				seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'BASELINED');
				return { control, observed: start(2) };
			}
		},

		// ── THE RPH-EVD FAMILY (2026-08-01) ────────────────────────────────────────────────────────────────────
		// Six of the seven are not ENFORCED, so they are `null` here BY TYPE — the map is a total Record, and the
		// gate below rejects both a missing probe for an ENFORCED row and a probe for a row that is not.
		// The three disclosed rows are observed being ADMITTED instead, in `disclosure-observed.test.ts`.
		'RPH-EVD-001': null,
		'RPH-EVD-002': null,
		'RPH-EVD-003': {
			arrangement:
				'Evidence whose contentReference is {} — a source reference naming nothing — offered for admission (REG-F-008 remediation)',
			run: () => {
				const propose = (evId: string, over: Record<string, unknown> = {}) =>
					ok(
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
						),
						`propose ${evId}`
					);
				const admit = (evId: string) =>
					dispatch(
						'AdmitEvidence',
						{
							admissibilityAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5F02',
							admittedScope: 'unit tests for module X',
							admittedClaimIds: []
						},
						evId,
						'EVIDENCE'
					);

				const EV_OK = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FB2';
				const EV_BAD = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FB1';
				propose(EV_OK);
				propose(EV_BAD, { contentReference: {} });

				// THE SECOND HALF OF THE RULE, asserted here because the marker only pins the CONTENT limb and the
				// register's declaredMutations name that asymmetry explicitly. A producing actor that names nobody
				// is refused too — at the SCHEMA layer, since ActorReferenceSchema requires .min(1) ids, so it never
				// reaches this guard. Recorded so a reader knows where the other half is enforced.
				expect(
					dispatch(
						'ProposeEvidence',
						{
							evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5FA1',
							evidenceType: 'TEST_RESULT',
							contentReference: { uri: 'x' },
							producedBy: { actorId: '', actorType: 'MODEL', displayName: '' },
							supportsClaimIds: [],
							contradictsClaimIds: [],
							scope: 's',
							limitations: [],
							capturedAt: TS
						},
						'evd_01ARZ3NDEKTSV4RRFFQ69G5FA1',
						'EVIDENCE'
					).status,
					'the producing-actor half is schema-foreclosed; if it ever becomes ACCEPTED this row must widen'
				).toBe('VALIDATION_FAILED');

				return { control: admit(EV_OK), observed: admit(EV_BAD) };
			}
		},
		'RPH-EVD-004': null,
		'RPH-EVD-005': null,
		'RPH-EVD-006': null,
		'RPH-EVD-007': {
			arrangement:
				"Evidence proposed with an unstated scope (''), then admitted — the admission must evaluate the evidence rather than advance its status",
			run: () => {
				// THE CONTROL IS A SECOND AGGREGATE, not the same one admitted twice: AdmitEvidence's precondition is
				// `fromStates('PROPOSED')`, so re-admitting the control evidence would be refused by the PRECONDITION
				// and the probe would be measuring the wrong guard entirely.
				const propose = (evId: string, scope: string) =>
					ok(
						dispatch(
							'ProposeEvidence',
							{
								evidenceId: evId,
								evidenceType: 'TEST_RESULT',
								contentReference: { uri: 'file://report.xml' },
								producedBy: { actorId: 'ci-1', actorType: 'SERVICE', displayName: 'CI' },
								supportsClaimIds: [],
								contradictsClaimIds: [],
								scope,
								limitations: [],
								capturedAt: TS
							},
							evId,
							'EVIDENCE'
						),
						`propose ${evId}`
					);
				const admit = (evId: string) =>
					dispatch(
						'AdmitEvidence',
						{
							admissibilityAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5F01',
							admittedScope: 'unit tests for module X',
							admittedClaimIds: []
						},
						evId,
						'EVIDENCE'
					);

				const EV_OK = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD1';
				const EV_BAD = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FC1';
				propose(EV_OK, 'unit tests for module X');
				propose(EV_BAD, '');
				// The control admits WELL-SCOPED evidence — so a guard that refused every admission cannot pass this
				// row, which is the failure mode an "is it refused?" assertion alone would certify as success.
				return { control: admit(EV_OK), observed: admit(EV_BAD) };
			}
		},

		// ── THE RPH-ASR FAMILY (2026-08-02) ────────────────────────────────────────────────────────────────────
		// Nine of twelve are not ENFORCED and are `null` here by type; four of those nine are observed being
		// ADMITTED in `disclosure-observed.test.ts`. RPH-ASR-010 is enforced on the PWA PUBLISH path rather than
		// the assessment path, and its refusal is already driven end to end by `pwa-publish-stale-floor.test.ts`,
		// which is what the manifest cites; it is probed here as well because this map is total over ENFORCED rows.
		'RPH-ASR-001': null,
		'RPH-ASR-003': null,
		'RPH-ASR-004': null,
		'RPH-ASR-005': null,
		'RPH-ASR-006': null,
		'RPH-ASR-008': null,
		'RPH-ASR-009': null,
		'RPH-ASR-011': null,
		'RPH-ASR-012': null,
		'RPH-ASR-002': {
			arrangement:
				'a completion recommending SATISFIED against a policy whose evidence requirement is required FOR that disposition, with nothing submitted for it',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5D02';
				const ok1 = asrPolicy(POL, {
					requiredEvidence: [
						{
							id: 'R-TRACE',
							evidenceType: 'TRACE',
							description: 'the requirement trace matrix the coverage assessment rests on',
							purpose: 'demonstrate that every requirement is covered',
							cardinality: 'EXACTLY_ONE',
							admissibilityRules: [],
							// SATISFIED_ONLY is what makes Gate A's `requiredForDispositions` subset non-empty for a
							// positive disposition and empty for a non-positive one — which is exactly the delta
							// between this row's observation and its control.
							requiredForDispositions: 'SATISFIED_ONLY',
							mayBeWaived: false
						}
					]
				});
				expect(ok1.status, `seed policy: ${ok1.message}`).toBe('ACCEPTED');
				// CONTROL — the SAME policy, the SAME command, recommending a NON-satisfied disposition, which
				// Gate A lets through. So a gate that refused every completion cannot green this row.
				const control = asrComplete('asm_01ARZ3NDEKTSV4RRFFQ69G5D02', POL, {
					dispositionRecommendation: 'INCONCLUSIVE'
				});
				const observed = asrComplete('asm_01ARZ3NDEKTSV4RRFFQ69G5D03', POL, {
					dispositionRecommendation: 'SATISFIED'
				});
				return { control, observed };
			}
		},
		'RPH-ASR-007': {
			arrangement:
				'a validator result whose subjectSemanticVersions names no version for a declared subject — semantic malformation the schema cannot express',
			run: () => {
				const POL = 'pol_01ARZ3NDEKTSV4RRFFQ69G5D07';
				const ok1 = asrPolicy(POL);
				expect(ok1.status, `seed policy: ${ok1.message}`).toBe('ACCEPTED');
				// The control is a WELL-FORMED completion, accepted — the parse step is not refusing everything.
				const control = asrComplete('asm_01ARZ3NDEKTSV4RRFFQ69G5D07', POL);
				const observed = asrComplete('asm_01ARZ3NDEKTSV4RRFFQ69G5D08', POL, {
					subjectSemanticVersions: {}
				});
				return { control, observed };
			}
		},
		// RPH-ASR-010 was drafted ENFORCED here against the PWA-publish floor gate and re-dispositioned to
		// UNENFORCED_DISCLOSED before any probe was written — the floor gate's version binding is real, and is over
		// a different subject. Its admission is observed in `disclosure-observed.test.ts`.
		'RPH-ASR-010': null,

		// ── THE RPH-INT FAMILY (2026-08-02) ────────────────────────────────────────────────────────────────────
		// Four of seven describe what an ACCEPTED command produces and are `null` here by type; they are not
		// disclosed either, so they appear in neither observation map. Three are refused, all three by
		// `approveIntent`, and the ORDER of its guards is what these probes have to navigate.
		'RPH-INT-001': null,
		'RPH-INT-002': null,
		'RPH-INT-006': null,
		'RPH-INT-007': null,
		// ── THE FIRST SCHEMA-LAYER ROW (2026-08-02) ────────────────────────────────────────────────────────────
		'RPH-CON-001': null,
		'RPH-CON-003': null,
		'RPH-CON-004': null,
		'RPH-CON-005': null,
		'RPH-CON-006': null,
		'RPH-CON-007': null,
		'RPH-CON-008': null,

		// ── RPH-PER, twelve of fourteen (2026-08-02) ──────────────────────────────────────────────────────────
		// Ten are NOT_A_COMMAND_REFUSAL — §§18-20 state durability PROPERTIES (replay equivalence, projection
		// rebuild, outbox atomicity, restart recovery), and a refusal probe cannot hold any of them. One
		// (RPH-PER-012) is disclosed by a dead-predicate census in rph-domain. Only RPH-PER-001 is a refusal, and
		// it is the row that made `refusalStatus` necessary.
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
		'RPH-GOV-001': {
			arrangement:
				"a Decision whose recorded `authority.actorType` is AGENT, approved — refused UNAUTHORIZED / RPH_AUTHORITY_INSUFFICIENT, against the byte-identical decision whose authority is HUMAN, which is ACCEPTED",
			run: () => {
				const SUBJ = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6600';
				const OK_ID = 'dec_01ARZ3NDEKTSV4RRFFQ69H6610';
				const BAD_ID = 'dec_01ARZ3NDEKTSV4RRFFQ69H6611';
				const AGENT = { actorId: 'a1', actorType: 'AGENT', displayName: 'Agent' };
				const propose = (id: string, authority: unknown) =>
					dispatch(
						'ProposeDecision',
						{
							decisionType: 'APPROVAL',
							subjectObjectIds: [SUBJ],
							selectedOption: 'ship',
							rationale: 'r',
							authority
						},
						id,
						'DECISION'
					);
				const approve = (id: string) =>
					dispatch(
						'ApproveDecision',
						{
							selectedOption: 'ship',
							rationale: 'r',
							consideredEvidenceIds: [],
							consideredObservationIds: [],
							subjectSemanticVersions: { [SUBJ]: 1 }
						},
						id,
						'DECISION'
					);
				// THE CONTROL: the SAME command on a decision differing ONLY in `authority.actorType`. That single
				// field is the whole delta, which is what pins the refusal to the authority check rather than to
				// the transition guard, the kind predicate, or the subject-version limb — all of which sit on this
				// same path and all of which would refuse with a different code.
				ok(propose(OK_ID, actor), 'propose HUMAN-authority decision');
				const control = approve(OK_ID);
				ok(propose(BAD_ID, AGENT), 'propose AGENT-authority decision');
				const observed = approve(BAD_ID);
				return { control, observed };
			}
		},
		// RPH-GOV, three more (2026-08-02) — all NOT_A_COMMAND_REFUSAL. GOV-002 is arm 3 SPECIFICALLY so it does
		// not share GOV-001's single refusal site (one mutant would redden both); GOV-004's outcome is not
		// produced at all; GOV-007's kernel predicate is a CONSTANT FUNCTION that cannot return half its own
		// declared union. GOV-003/005 (ENFORCED) and GOV-006 (DISCLOSED) still owe observations.
		'RPH-GOV-002': null,
		'RPH-GOV-004': null,
		'RPH-GOV-007': null,
		// ── THE THREE CONSERVATION PROBES ─────────────────────────────────────────────────────────────────────
		// One site, one message, three finding codes. Each probe's CONTROL is the byte-adjacent arrangement that
		// differs only in the field its own rule is about — so a refusal here cannot be a sibling's.
		'RPH-DEC-002': {
			arrangement:
				'ValidateDecomposition -> VALID on a decomposition leaving a MANDATORY parent obligation neither allocated nor retained, against the identical decomposition that allocates it',
			run: () => decompositionProbe('obligation'),
		},
		'RPH-DEC-003': {
			arrangement:
				'ValidateDecomposition -> VALID on a decomposition leaving a MANDATORY parent constraint undispositioned for a relevant child, against the identical decomposition that propagates it',
			run: () => decompositionProbe('constraint'),
		},
		'RPH-CNS-003': {
			arrangement:
				'a constraint dispositioned INAPPLICABLE with NO rationale, against the byte-adjacent record that carries one',
			run: () => decompositionProbe('rationale'),
		},
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
		'RPH-BAS-003': {
			arrangement:
				'PromoteBaseline with an OPEN BLOCKING observation over the baselined item, against the identical promotion without it',
			run: () => promotionProbe('blocking-observation')
		},
		'RPH-BAS-004': {
			arrangement:
				'PromoteBaseline listing a REJECTED assessment among its required set, against the identical promotion listing only the SATISFIED one',
			run: () => promotionProbe('unsatisfied-assessment')
		},
		'RPH-BAS-006': {
			arrangement:
				'PromoteBaseline naming a promotion decision still PROPOSED, against the identical promotion whose decision is EFFECTIVE',
			run: () => promotionProbe('no-decision')
		},
		'RPH-GOV-003': {
			arrangement:
				'PromoteBaseline under a decision that approved the subject at v2 while it is at v1, against the identical promotion whose decision bound v1',
			run: () => promotionProbe('stale-version')
		},
		'RPH-ASM-006': {
			arrangement:
				'ApproveExecutionPlan for a plan whose PWU declares an EXPIRED assumption, against the identical plan whose assumption is still live',
			run: () => {
				const n = ++probeSeq;
				const drive = (pass: boolean): Outcome => {
					const t = pass ? 'A' : 'B';
					const iid = `int_01ARZ3NDEKTSV4RRFFQ69H9${n}${t}0`;
					const pid = `pwu_01ARZ3NDEKTSV4RRFFQ69H9${n}${t}1`;
					const aid = `asm_01ARZ3NDEKTSV4RRFFQ69H9${n}${t}2`;
					const plid = `plan_01ARZ3NDEKTSV4RRFFQ69H9${n}${t}3`;
					ok(
						dispatch(
							'CaptureIntent',
							{ intentId: iid, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
							iid,
							'INTENT'
						),
						'capture intent'
					);
					ok(
						dispatch(
							'DetectAssumption',
							{
								assumptionId: aid,
								statement: 'the tenant index is unique',
								introducedBy: actor,
								affectedObjectIds: [pid],
								materiality: 'CRITICAL'
							},
							aid,
							'ASSUMPTION'
						),
						'detect assumption'
					);
					// THE ARRANGING ACT, and the ONLY difference between the two runs.
					if (!pass) ok(dispatch('ExpireAssumption', {}, aid, 'ASSUMPTION'), 'expire assumption');
					ok(
						dispatch(
							'ProposePwu',
							{
								pwuId: pid,
								pwuKind: 'ARCHITECTURE',
								title: 'subject',
								description: 'd',
								intentId: iid,
								boundaries: {
									inScope: [],
									outOfScope: [],
									permittedChanges: [],
									prohibitedChanges: []
								},
								obligationIds: [],
								constraintIds: [],
								assumptionIds: [aid],
								expectedOutputs: [],
								assurancePolicyIds: [],
								riskProfile: {
									consequence: 'HIGH',
									uncertainty: 'MEDIUM',
									irreversibility: 'HIGH',
									securitySensitivity: 'HIGH',
									regulatoryExposure: 'LOW'
								}
							},
							pid,
							'PROFESSIONAL_WORK_UNIT'
						),
						'propose pwu'
					);
					ok(
						dispatch(
							'ProposeExecutionPlan',
							{
								executionPlanId: plid,
								workUnitId: pid,
								steps: [
									{
										id: `${plid}-s1`,
										executionPlanId: plid,
										stepType: 'HUMAN_INTERACTION',
										purpose: 'work',
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
							},
							plid,
							'EXECUTION_PLAN'
						),
						'propose plan'
					);
					return dispatch('ApproveExecutionPlan', {}, plid, 'EXECUTION_PLAN');
				};
				return { control: drive(true), observed: drive(false) };
			}
		},
		'RPH-BAS-001': null,
		'RPH-BAS-002': null,
		'RPH-BAS-005': null,
		'RPH-BAS-007': null,
		'RPH-PER-002': null,
		'RPH-PER-003': null, // disclosed — observed in disclosure-observed.test.ts
		'RPH-PER-004': null, // disclosed — observed in disclosure-observed.test.ts
		'RPH-PER-005': null,
		'RPH-PER-006': null,
		'RPH-PER-007': null,
		'RPH-PER-008': null,
		'RPH-PER-009': null,
		'RPH-PER-010': null,
		'RPH-PER-011': null,
		'RPH-PER-012': null,
		'RPH-PER-013': null,
		'RPH-PER-014': null,
		'RPH-PER-001': {
			arrangement:
				"two BeginIntentDiscovery commands both declaring expectedRevision r0 — the first ACCEPTED and producing r0+1, the second refused with RPH_REVISION_CONFLICT at status CONFLICT (the ratified arrangement verbatim: 'two commands expect revision 5 … the first produces revision 6')",
			run: () => {
				const ID = 'int_01ARZ3NDEKTSV4RRFFQ69H6500';
				ok(
					dispatch(
						'CaptureIntent',
						{
							intentId: ID,
							originatingExpression: 'x',
							ontologyId: 'o',
							ontologyVersion: '1'
						},
						ID,
						'INTENT'
					),
					'capture for PER-001'
				);
				const r0 = store.loadObject(ID)!.revision;
				// THE CONTROL IS THE FIRST OF THE TWO RACING COMMANDS — byte-identical to the observed one, and
				// ACCEPTED. That is what makes this a concurrency proof rather than a proof that
				// BeginIntentDiscovery is refused: the ONLY difference between the two dispatches is that the
				// first one happened.
				const control = dispatchWith('BeginIntentDiscovery', {}, ID, 'INTENT', {
					expectedRevision: r0
				});
				const observed = dispatchWith('BeginIntentDiscovery', {}, ID, 'INTENT', {
					expectedRevision: r0
				});
				return { control, observed };
			}
		},
		'RPH-CON-002': {
			arrangement:
				'a CaptureIntent payload carrying an undeclared property, refused by the contract boundary before any handler runs',
			run: () => {
				const base = (over: Record<string, unknown> = {}) => ({
					intentId: 'int_01ARZ3NDEKTSV4RRFFQ69H6400',
					originatingExpression: 'x',
					ontologyId: 'o',
					ontologyVersion: '1',
					...over
				});
				// THE CONTROL IS THE SAME PAYLOAD MINUS ONE KEY, and for a SCHEMA row that minimal delta is doing
				// more work than usual: a matched issue path is necessary but not sufficient, since a sloppy payload
				// failing on several fields would match a declared path among them. The control is what pins the
				// refusal to the undeclared property and nothing else.
				const control = dispatch(
					'CaptureIntent',
					base(),
					'int_01ARZ3NDEKTSV4RRFFQ69H6400',
					'INTENT'
				);
				const observed = dispatch(
					'CaptureIntent',
					base({ notADeclaredField: 'smuggled' }),
					'int_01ARZ3NDEKTSV4RRFFQ69H6401',
					'INTENT'
				);
				return { control, observed };
			}
		},

		// ── THE RPH-PWU FAMILY, five of ten (2026-08-02) ───────────────────────────────────────────────────────
		'RPH-PWU-001': null,
		'RPH-PWU-005': null,
		'RPH-PWU-006': null,
		'RPH-PWU-008': null,
		'RPH-PWU-007': null,
		'RPH-PWU-003': null,
		'RPH-PWU-002': {
			arrangement: 'ProposePwu naming an intentId that resolves to no Intent aggregate',
			run: () => {
				const mk = (pwuId: string, intentId: string) =>
					dispatch(
						'ProposePwu',
						{
							pwuId,
							pwuKind: 'ARCHITECTURE',
							title: 'Arch',
							description: 'd',
							intentId,
							boundaries: {
								inScope: [],
								outOfScope: [],
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
							}
						},
						pwuId,
						'PROFESSIONAL_WORK_UNIT'
					);
				// The CONTROL cites the intent seeded in beforeEach — so a handler refusing every proposal cannot
				// green this row. The observation differs by exactly one field: an intent id nothing minted.
				return {
					control: mk('pwu_01ARZ3NDEKTSV4RRFFQ69H6300', INTENT),
					observed: mk('pwu_01ARZ3NDEKTSV4RRFFQ69H6301', 'int_01ARZ3NDEKTSV4RRFFQ69H6399')
				};
			}
		},
		'RPH-PWU-004': {
			arrangement: 'MarkPwuReady on a SHAPING PWU whose expectedOutputs is empty — readiness attested over nothing',
			run: () => {
				// THE FIXTURE MUST SATISFY EVERY OTHER READINESS LIMB, or the control is refused for reasons that
				// have nothing to do with this rule and the marker never gets exercised. `checkPwuShapeReadiness`
				// also requires an in-scope statement, an out-of-scope statement, and — for a root PWU — an intent
				// at least PROVISIONAL. So both PWUs below get all of that, and the ONLY delta between the control
				// and the observation is `expectedOutputs`.
				const READY_INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H6330';
				captureIntent(READY_INTENT);
				ok(dispatch('BeginIntentDiscovery', {}, READY_INTENT, 'INTENT'), 'discover');
				ok(
					dispatch('ProvisionIntent', { ambiguityIds: [] }, READY_INTENT, 'INTENT'),
					'provision'
				);
				const propose = (pwuId: string, expectedOutputs: unknown[]) =>
					ok(
						dispatch(
							'ProposePwu',
							{
								pwuId,
								pwuKind: 'ARCHITECTURE',
								title: 'Arch',
								description: 'd',
								intentId: READY_INTENT,
								boundaries: {
									inScope: ['the architecture note'],
									outOfScope: ['implementation'],
									permittedChanges: [],
									prohibitedChanges: []
								},
								obligationIds: [],
								constraintIds: [],
								assumptionIds: [],
								expectedOutputs,
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
				const markReady = (pwuId: string) =>
					dispatch(
						'MarkPwuReady',
						{ shapeReadinessAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69H6320', expectedSemanticVersion: 1 },
						pwuId,
						'PROFESSIONAL_WORK_UNIT'
					);
				const shape = (pwuId: string) =>
					ok(
						dispatch(
							'ChangePwuState',
							{
								previousState: 'PROPOSED',
								newState: 'SHAPING',
								executionState: 'NOT_PLANNED',
								assuranceState: 'UNASSESSED',
								shapeIntegrityState: 'PRESERVED',
								reasonCode: 'fixture',
								supportingObjectIds: []
							},
							pwuId,
							'PROFESSIONAL_WORK_UNIT'
						),
						`shape ${pwuId}`
					);

				const OK_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6310';
				const BAD_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6311';
				propose(OK_PWU, [
					{ artifactType: 'DOCUMENT', description: 'the architecture note', verificationCriteria: ['reviewed'] }
				]);
				propose(BAD_PWU, []);
				shape(OK_PWU);
				shape(BAD_PWU);
				return { control: markReady(OK_PWU), observed: markReady(BAD_PWU) };
			}
		},

		'RPH-INT-003': {
			arrangement: 'ApproveIntent dispatched against a RAW intent — before it has been formalized',
			run: () => {
				const RAW = 'int_01ARZ3NDEKTSV4RRFFQ69H6200';
				captureIntent(RAW);
				// CONTROL: the SAME command on the SAME kind of intent, driven to FORMALIZED first. So a handler
				// that refused every approval cannot green this row.
				const OK = 'int_01ARZ3NDEKTSV4RRFFQ69H6201';
				captureIntent(OK);
				formalizeIntent(OK);
				return { control: approveIntent(OK, 1), observed: approveIntent(RAW, 1) };
			}
		},
		'RPH-INT-004': {
			arrangement:
				'ApproveIntent on a FORMALIZED intent whose desiredOutcomes is empty — an approval with nothing to approve',
			run: () => {
				const EMPTY = 'int_01ARZ3NDEKTSV4RRFFQ69H6210';
				captureIntent(EMPTY);
				formalizeIntent(EMPTY, []); // formalized, but with no desired outcomes
				const OK = 'int_01ARZ3NDEKTSV4RRFFQ69H6211';
				captureIntent(OK);
				formalizeIntent(OK);
				return { control: approveIntent(OK, 1), observed: approveIntent(EMPTY, 1) };
			}
		},
		'RPH-INT-005': {
			arrangement:
				'ApproveIntent naming a semantic version the intent is not at — a stale approval offered as authority',
			run: () => {
				// THE MASKING HAZARD THIS ROW HAS TO CLEAR, and it is the reason the fixture supplies outcomes.
				// RPH-INT-004's limb runs FIRST in the same precheck; an arrangement that omitted desiredOutcomes
				// would be refused by THAT limb and would green this row on the wrong refusal. The marker would
				// report MASKED, but only because the marker exists — a code-only probe would report KILLED, since
				// both limbs carry RPH_INVARIANT_VIOLATION.
				const STALE = 'int_01ARZ3NDEKTSV4RRFFQ69H6220';
				captureIntent(STALE);
				formalizeIntent(STALE);
				const OK = 'int_01ARZ3NDEKTSV4RRFFQ69H6221';
				captureIntent(OK);
				formalizeIntent(OK);
				// The control names the CURRENT version; the observation names a version the intent is not at.
				return { control: approveIntent(OK, 1), observed: approveIntent(STALE, 99) };
			}
		}
	};

	it('the probe map is TOTAL over the ENFORCED rows — every claim has an observation', () => {
		const unprobed = enforcedRuleIds().filter((id) => PROBES[id] === null);
		expect(unprobed, 'ENFORCED rule(s) with no probe').toEqual([]);
		// …and nothing probes a row that is NOT claimed enforced, which would be a green with nothing behind it.
		const overProbed = (Object.keys(PROBES) as RegisteredRuleId[]).filter(
			(id) => PROBES[id] !== null && ENFORCEMENT_REGISTER[id].kind !== 'ENFORCED'
		);
		expect(overProbed, 'probe(s) for rule(s) the register does not claim are enforced').toEqual([]);
	});

	it.each(enforcedRuleIds())(
		'%s is REFUSED by its declared site, with its declared code and marker',
		(id) => {
			const row = ENFORCEMENT_REGISTER[id];
			const probe = PROBES[id];
			expect(row.kind).toBe('ENFORCED');
			expect(probe, `${id} has no probe`).not.toBeNull();
			if (row.kind !== 'ENFORCED' || !probe) return;

			const { control, observed } = probe.run();

			// THE CONTROL. Same command, before the arranging act. Without this the whole file is satisfied by a handler
			// that refuses everything — which is over-refusal wearing the fix's clothes.
			expect(control.status, `${id}: the control must be ACCEPTED (${control.message})`).toBe(
				'ACCEPTED'
			);

			const verdict = classifyRefusal(observed, row);
			expect(
				verdict,
				`${id} (${probe.arrangement}) — declared ${row.refusalCode} / "${row.refusalMarker}", observed ` +
					`${observed.status} ${observed.code ?? ''}: ${observed.message ?? '(no message)'}`
			).toBe('KILLED');
		}
	);

	// The register's markers are asserted DISTINCT in rph-domain. This proves the distinctness is real at the
	// observation point rather than merely true of two strings: the two rules refused by the SAME production
	// function must produce messages that satisfy their own marker and NOT the other's.
	it('the two same-site PWU rows are not satisfiable by one arrangement', () => {
		const nine = ENFORCEMENT_REGISTER['RPH-PWU-009'];
		const ten = ENFORCEMENT_REGISTER['RPH-PWU-010'];
		if (nine.kind !== 'ENFORCED' || ten.kind !== 'ENFORCED')
			throw new Error('rows must be ENFORCED');

		const supersededMessage = PROBES['RPH-PWU-009']!.run().observed;
		expect(classifyRefusal(supersededMessage, nine)).toBe('KILLED');
		expect(
			classifyRefusal(supersededMessage, ten),
			'the SUPERSEDED arrangement must NOT also green the BASELINED row'
		).toBe('MASKED');
	});
});
