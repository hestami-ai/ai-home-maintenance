// driveReferenceUndertaking — the Field Service Management SaaS Reference Undertaking (RPH-DOC-006 / RPH-DOC-010
// §27) driven LIVE through the command pipeline: it dispatches an intent lifecycle, proposes the Product
// Realization root + its Intent/Behavior/Architecture children + the architecture concerns, records the
// decomposition contracts, and advances each PWU's four axes with the controller lever (ChangePwuState) to its
// terminal condition. This REPLACES the hand-authored terminal graph — the resulting Professional Work Graph is a
// projection of real events produced by real handlers.
//
// ⚠️ WHAT THIS DOES AND DOES NOT DEMONSTRATE. Read this before citing the demo graph as evidence of anything.
//
// HISTORY, because it is the instructive part. Until 2026-07-17 this header ended "...so it demonstrably upholds
// INV-5 (no green without assurance)". That was false: the script performed NO assurance at all. It emitted 110
// events of 14 types, zero of them from the claim -> evidence -> assessment -> decision -> baseline chain, and
// wrote every assurance fact directly onto the axes via ChangePwuState with `supportingObjectIds: []`. Mobile &
// Offline passed THROUGH EVIDENCE_PENDING with no evidence and ASSESSING with no assessment. A comment turned a
// fixture into evidence, and five tests over this file stayed green throughout.
//
// WHAT INCREMENT 25 CHANGED. The assurance loop was never missing — every command below was already registered
// and emitting nothing because this script never called them. It calls them now. For each assured PWU: a FITNESS
// claim is asserted, evidence is proposed and ADMITTED, an assessment is started against a policy that EXISTS at
// a version and is bound to the subject's semantic version (DOC-004 invariant 2), observations are recorded, and
// a full DOC-007 §20 verdict is returned. Each assurance axis hop now follows its declared trigger and CITES the
// object that caused it in `supportingObjectIds`. The facts are earned and traceable.
//
// WHAT IS STILL NOT DEMONSTRATED, precisely:
//  * The GOVERNANCE half is still absent — no decision is proposed or takes effect, no baseline is created or
//    promoted, no assumption is detected. So the Architecture PWU still reaches BASELINED with no Baseline
//    object, which ratified RPH-BAS-004 ("Missing required assessment prevents promotion") forbids.
//  * The ENGINE still does not enforce any of this. classifyTransition reads only from/to and ignores each
//    transition's declared `trigger`/`guard`, so a caller can still walk the assurance axis to SATISFIED one
//    legal hop at a time with no assessment. This script now tells the truth by construction, not because it is
//    prevented from lying. reference-undertaking.test.ts's "EARNED and CITED" test is what holds it honest.
//  * `shapeReadinessAssessmentId: 'assess_shape'` still resolves to UNDEFINED — it names an object never created.
//  * openResiduals is still NOT PROJECTED: professional-work-graph.ts returns `opts.openResiduals ?? []` from
//    the const below, derived from no event. An auditor injecting an arbitrary string gets it rendered verbatim.
//    The residual IS now also a recorded MATERIAL observation on a real assessment — but the view does not read
//    it from there.
//
// PRECISION, because the sloppy version of the old criticism is wrong. Ratified Property P1 says executionState =
// SUCCEEDED "must never ALONE cause" assuranceState = SATISFIED. Even before Increment 25 it did not: an explicit
// command caused it. So the seed never VIOLATED P1; it failed to DEMONSTRATE it. What it contradicted was a
// convergent set: §8.1's Command column contains NO command that changes assuranceState (it is a precondition
// CONSUMED by the lifecycle transition, not produced by one); §34.2 and DOC-004 §32 enumerate the assurance
// mutators and include no generic setter; §18.1 requires every disposition to identify evidence considered;
// §37 requires every control action to record the evidence considered and the authorizing policy.
//
// The controller lever itself is NOT the defect: ratified RPH-PWU-006's "When" is "the controller evaluates the
// PWU". Its Given — "execution succeeded; required evidence is admitted; all mandatory assurance assessments are
// satisfied" — is what was missing, and is what now holds.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { EngineHandle } from './engine.js';

const ACTOR: ActorReference = {
	actorId: 'owner-1',
	actorType: 'HUMAN',
	displayName: 'Undertaking Owner'
};

/** Stable ids for the Reference Undertaking objects (valid Crockford-base32 ULIDs). */
export const REFERENCE_UNDERTAKING = {
	intentId: 'int_01ARZ3NDEKTSV4RRFFQ69G5AAA',
	root: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A00',
	intentDef: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A10',
	behavior: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A20',
	architecture: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A30',
	systemContext: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A40',
	multiTenancy: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A50',
	dataArch: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A60',
	integrations: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A70',
	mobileOffline: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A80',
	// The downstream work areas (§7) — NOT STARTED in the reference terminal state (§27).
	planning: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A90',
	implementation: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AB0',
	validation: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AC0',
	promotion: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AD0'
} as const;

export const REFERENCE_OPEN_RESIDUALS = [
	'Offline behavior deferred from the first implementation increment'
] as const;

/** The policy the Reference Undertaking's assessments are judged under. It is CREATED and ACTIVATED by the drive
 *  (below) rather than merely cited: `requestAssuranceAssessment` does not check that its `assurancePolicyId`
 *  resolves, so a cited-but-absent policy would be accepted — a governance fact pointing at nothing, which is the
 *  same defect as the `shapeReadinessAssessmentId: 'assess_shape'` that resolves to UNDEFINED. (That the handler
 *  does not check is itself a hole; recorded in HARMONIZATION-LOG, not fixed here.) */
export const REFERENCE_ASSURANCE_POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5P00';

const LABELS: Record<string, { title: string; kind: string }> = {
	[REFERENCE_UNDERTAKING.root]: { title: 'Product Realization', kind: 'PRODUCT_REALIZATION' },
	[REFERENCE_UNDERTAKING.intentDef]: {
		title: 'Intent & Product Definition',
		kind: 'INTENT_DEFINITION'
	},
	[REFERENCE_UNDERTAKING.behavior]: {
		title: 'Product Behavior Definition',
		kind: 'PRODUCT_BEHAVIOR'
	},
	[REFERENCE_UNDERTAKING.architecture]: { title: 'Architecture Definition', kind: 'ARCHITECTURE' },
	[REFERENCE_UNDERTAKING.systemContext]: { title: 'System Context', kind: 'ARCHITECTURE_CONCERN' },
	[REFERENCE_UNDERTAKING.multiTenancy]: {
		title: 'Multi-Tenancy Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.dataArch]: { title: 'Data Architecture', kind: 'ARCHITECTURE_CONCERN' },
	[REFERENCE_UNDERTAKING.integrations]: {
		title: 'Integration Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.mobileOffline]: {
		title: 'Mobile & Offline Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.planning]: {
		title: 'Implementation Planning',
		kind: 'IMPLEMENTATION_PLANNING'
	},
	[REFERENCE_UNDERTAKING.implementation]: {
		title: 'Product Implementation',
		kind: 'PRODUCT_IMPLEMENTATION'
	},
	[REFERENCE_UNDERTAKING.validation]: {
		title: 'Integrated Product Validation',
		kind: 'INTEGRATED_VALIDATION'
	},
	[REFERENCE_UNDERTAKING.promotion]: {
		title: 'Product Baseline Promotion',
		kind: 'BASELINE_PROMOTION'
	}
};

/** Drive the Reference Undertaking end to end via live commands. Throws if any command is rejected (fail-loud).
 * Pass `undertakingId` to stamp each proposed PWU with its owning Undertaking (CON-009 ownership binding). */
export function driveReferenceUndertaking(
	handle: EngineHandle,
	opts: {
		readonly undertakingId?: string;
		readonly pwuTypeByKind?: Readonly<Record<string, string>>;
		/** The policy this undertaking's assessments are judged under. The workbench seed passes the RATIFIED
		 *  catalog's `pol_fitness_for_purpose` ("Determine whether the completed product is suitable for the
		 *  actual approved user need"), so the demo exercises the catalog rather than growing it — the system
		 *  tells its own authoring agent to reuse an existing policy and create one only for a treatment not
		 *  already offered, and a 16th policy duplicating a ratified one is exactly what seed-workbench.test.ts
		 *  exists to catch.
		 *
		 *  Omitted (standalone drives, e.g. rph-engine's own tests) the drive CREATES its own policy below,
		 *  rather than minting a stand-in under a ratified id — that would be a fake wearing a real name. */
		readonly assurancePolicyId?: string;
	} = {}
): void {
	let n = 0;
	const send = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	) => {
		n += 1;
		const command: DomainCommand = {
			commandId: `ru-cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: '2026-07-12T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'reference-undertaking',
			idempotencyKey: `ru-idem-${n}`,
			payload
		};
		const result = handle.dispatch(command);
		if (result.status !== 'ACCEPTED' && result.status !== 'DUPLICATE') {
			throw new Error(
				`Reference Undertaking drive failed at #${n} ${commandType} (${targetAggregateId}): ${result.status} ${JSON.stringify(result.error)}`
			);
		}
	};

	const R = REFERENCE_UNDERTAKING;

	// --- The assurance policy the undertaking's assessments are judged under ---
	// Reuse the caller's (the workbench seed passes the ratified catalog's pol_fitness_for_purpose); otherwise
	// create and ACTIVATE our own, so that every assessment below cites a policy that EXISTS at a version rather
	// than a dangling id. One criterion and one finding definition: the smallest policy that is a real policy.
	// It mirrors pol_fitness_for_purpose's shape (FITNESS claims) so both paths assess the same kind of thing.
	const policyId = opts.assurancePolicyId ?? REFERENCE_ASSURANCE_POLICY;
	if (!opts.assurancePolicyId) {
		send('CreateAssurancePolicy', 'ASSURANCE_POLICY', policyId, {
			policyId,
			version: '1.0.0',
			name: 'Reference Undertaking Fitness Review',
			purpose:
				'Determine whether the completed work is suitable for the approved need it was decomposed to serve',
			rationale:
				'Execution success reports that work ran, not that it was right. This policy is the assessment that decides the latter (Property P1).',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: ['FITNESS'],
			criteria: [
				{
					id: 'RUC-01',
					name: 'Expected output present and attributable',
					description:
						'The PWU has produced its declared expected output, and admitted evidence attributes that output to this PWU at the assessed semantic version.',
					criterionType: 'QUALITATIVE',
					evaluationMethod: 'HUMAN_JUDGMENT',
					requiredEvidenceIds: [],
					severityIfNotMet: 'MATERIAL',
					mayBeNotApplicable: false
				}
			],
			evaluatorRole: 'REVIEWER',
			// NOTE (contract drift, surfaced by driving this): CreateAssurancePolicyPayload types this
			// `z.string()` while the AssurancePolicy OBJECT types it an enum — so the command bus accepted the
			// prose sentence that was here and the (d1) object check rejected it. The command contract is looser
			// than the object it creates. Logged in HARMONIZATION-LOG; not fixed here.
			independenceRequirement: 'DIFFERENT_AGENT',
			findingDefinitions: [
				{
					code: 'UNFIT_OUTPUT',
					name: 'Output not fit for the approved need',
					description:
						'The declared expected output is absent, partial, or does not serve the approved need this PWU was decomposed to meet — so the fitness claim cannot be sustained on the admitted evidence.',
					defaultSeverity: 'MATERIAL',
					affectedClaimTypes: ['FITNESS'],
					defaultControlActions: ['GATHER_CONTEXT', 'REQUEST_HUMAN_DECISION']
				}
			],
			permittedControlActions: ['CONTINUE', 'GATHER_CONTEXT', 'REQUEST_HUMAN_DECISION']
		});
		send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId });
	}

	// --- Intent lifecycle: RAW -> ... -> APPROVED ---
	send('CaptureIntent', 'INTENT', R.intentId, {
		intentId: R.intentId,
		originatingExpression: 'Enable trades businesses to manage work from request through invoice',
		ontologyId: 'product-realization-pwa',
		ontologyVersion: '1.3.0'
	});
	send('BeginIntentDiscovery', 'INTENT', R.intentId, {});
	send('ProvisionIntent', 'INTENT', R.intentId, { ambiguityIds: [] });
	send('FormalizeIntent', 'INTENT', R.intentId, {
		formalizedObjective: 'A multi-tenant field service management SaaS for trades businesses',
		desiredOutcomes: [{ description: 'Dispatch a job to a technician' }],
		successConditions: [{ statement: 'A customer request becomes an invoiced job' }],
		nonGoals: ['payroll'],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: []
	});
	send('ApproveIntent', 'INTENT', R.intentId, {
		decisionId: 'dec_intent',
		approvedSemanticVersion: 1,
		approvalScope: 'full'
	});

	// --- Propose the Professional Work Graph nodes ---
	// Each node is SHAPED at proposal: an in-scope statement, an out-of-scope status, and an expected output.
	// This was previously left empty, and every node was then marked READY — which DOC-002 §9.1's shape-readiness
	// contract forbids (a PWU may enter READY only once its minimum shape fields are present). The demonstration
	// must model a shaped PWU, not an unshaped one; the readiness guard (rph-domain checkPwuShapeReadiness) now
	// enforces it. `outOfScope` uses §9.1's explicitly-permitted "not yet known" status — a real exercise of that
	// branch — since a per-node out-of-scope is not meaningful to derive generically.
	const propose = (pwuId: string, parentWorkUnitId?: string): void => {
		const meta = LABELS[pwuId] ?? { title: pwuId, kind: 'PWU' };
		send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			pwuId,
			pwuKind: meta.kind,
			title: meta.title,
			description: meta.title,
			intentId: R.intentId,
			...(parentWorkUnitId ? { parentWorkUnitId } : {}),
			...(opts.undertakingId ? { undertakingId: opts.undertakingId, isLocalExtension: false } : {}),
			...(opts.pwuTypeByKind?.[meta.kind] ? { pwuTypeId: opts.pwuTypeByKind[meta.kind] } : {}),
			boundaries: {
				inScope: [`${meta.title} for the field service management SaaS`],
				outOfScope: ['not yet known'],
				permittedChanges: [],
				prohibitedChanges: []
			},
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'HIGH',
				uncertainty: 'MEDIUM',
				irreversibility: 'MEDIUM',
				securitySensitivity: 'HIGH',
				regulatoryExposure: 'MEDIUM'
			}
		});
	};

	propose(R.root);
	propose(R.intentDef, R.root);
	propose(R.behavior, R.root);
	propose(R.architecture, R.root);
	for (const concern of [
		R.systemContext,
		R.multiTenancy,
		R.dataArch,
		R.integrations,
		R.mobileOffline
	]) {
		propose(concern, R.architecture);
	}
	// The downstream work areas — proposed but NOT STARTED in the reference terminal state (§27).
	propose(R.planning, R.root);
	propose(R.implementation, R.root);
	propose(R.validation, R.root);
	propose(R.promotion, R.root);

	// --- Decomposition contracts (root -> areas, architecture -> concerns) ---
	const decompose = (dcpId: string, parentWorkUnitId: string, childWorkUnitIds: string[]): void => {
		send('ProposeDecomposition', 'DECOMPOSITION_CONTRACT', dcpId, {
			parentWorkUnitId,
			childWorkUnitIds,
			rationale: 'Product Realization decomposition'
		});
		send('ValidateDecomposition', 'DECOMPOSITION_CONTRACT', dcpId, { disposition: 'VALID' });
	};
	decompose('dcp_01ARZ3NDEKTSV4RRFFQ69G5B00', R.root, [
		R.intentDef,
		R.behavior,
		R.architecture,
		R.planning,
		R.implementation,
		R.validation,
		R.promotion
	]);
	decompose('dcp_01ARZ3NDEKTSV4RRFFQ69G5B10', R.architecture, [
		R.systemContext,
		R.multiTenancy,
		R.dataArch,
		R.integrations,
		R.mobileOffline
	]);

	// One Execution Plan for the Architecture PWU. An Execution Plan is a DISTINCT object that PERFORMS a PWU
	// Instance through temporal steps — it is NOT the Professional Work Graph (§35.3 / criterion 16).
	const archPlan = 'plan_01ARZ3NDEKTSV4RRFFQ69G5C00';
	send('ProposeExecutionPlan', 'EXECUTION_PLAN', archPlan, {
		executionPlanId: archPlan,
		workUnitId: R.architecture,
		steps: [
			{
				id: 'step_01ARZ3NDEKTSV4RRFFQ69G5C10',
				executionPlanId: archPlan,
				stepType: 'MODEL_INVOCATION',
				purpose: 'Generate the architecture description',
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
	send('ApproveExecutionPlan', 'EXECUTION_PLAN', archPlan, {});
	send('ActivateExecutionPlan', 'EXECUTION_PLAN', archPlan, { authorizedRuntimeBindingIds: [] });

	// --- Advance each PWU's four axes via the controller lever (ChangePwuState) ---
	const chg = (
		pwuId: string,
		previousState: string,
		newState: string,
		executionState: string,
		assuranceState: string,
		shapeIntegrityState: string,
		// DOC-007 §11.5 pairs `reasonCode` with `supportingObjectIds` — the reason, and what backs it. Every hop
		// used to pass []. An assurance hop now names the claim/evidence/assessment that caused it, so the
		// governed stream records not just that the state moved but what moved it. Non-assurance hops (planning,
		// execution scheduling) still pass none: there is nothing yet to cite, and inventing a citation would be
		// worse than an honest absence.
		supportingObjectIds: readonly string[] = []
	): void =>
		send('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			previousState,
			newState,
			executionState,
			assuranceState,
			shapeIntegrityState,
			reasonCode: 'CONTROLLER',
			supportingObjectIds
		});

	const shapeToExecutedSuccess = (pwuId: string): void => {
		send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', pwuId, {});
		send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			shapeReadinessAssessmentId: 'assess_shape',
			expectedSemanticVersion: 1
		});
		chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED');
	};

	// --- THE ASSURANCE LOOP (Increment 25) ---
	//
	// Ratified RPH-PWU-006 sanctions the controller moving a PWU to SATISFIED, but only on a GIVEN:
	//   "Given execution succeeded; required evidence is admitted; all mandatory assurance assessments are
	//    satisfied.  When the controller evaluates the PWU.  Then the PWU may transition to SATISFIED."
	// This seed used to skip the Given entirely: it walked the assurance axis EVIDENCE_REQUIRED ->
	// READY_FOR_ASSESSMENT -> ASSESSING -> SATISFIED with no evidence and no assessment, every hop carrying
	// `supportingObjectIds: []`. The axes were assigned, not earned.
	//
	// Nothing had to be built to fix that — every command below was already registered and emitting nothing,
	// because the seed simply never called them. What is new here is that each axis hop now happens only AFTER
	// its declared trigger has actually fired (PWU.assuranceState's own matrix: EVIDENCE_REQUIRED ->
	// READY_FOR_ASSESSMENT is triggered by "EvidenceAdmitted", -> ASSESSING by "AssuranceAssessmentStarted",
	// -> SATISFIED by "AssuranceAssessmentSatisfied"), and CITES the object that fired it in
	// `supportingObjectIds` — the field DOC-007 §11.5 puts beside `reasonCode` for exactly this purpose, and
	// which was empty on all 67 previous hops.
	//
	// The controller lever is still ChangePwuState, which is correct: RPH-PWU-006's "When" is the controller
	// evaluating the PWU. The engine does NOT yet enforce the Given — classifyTransition reads only from/to and
	// ignores each transition's declared `trigger`/`guard` — so this seed now tells the truth by construction,
	// not because it is prevented from lying. That enforcement is the next increment.
	let seq = 0;
	/** Crockford-base32 ULID-shaped ids — the format the object schemas enforce:
	 *  /^([a-z]+)_([0-9A-HJKMNP-TV-Z]{26})$/ (26 chars, no I/L/O/U). Deterministic, because the seed must
	 *  produce a byte-identical graph on every run. */
	const mintId = (prefix: string): string => {
		seq += 1;
		return `${prefix}_01ARZ3NDEKTSV4RRFFQ69G${String(seq).padStart(4, '0')}`;
	};

	interface EarnedObservation {
		readonly severity: string;
		readonly statement: string;
	}

	/** Establish RPH-PWU-006's GIVEN for `pwuId` and return the assessment id that evidences it. */
	const earnAssurance = (
		pwuId: string,
		disposition: 'SATISFIED' | 'CONDITIONALLY_SATISFIED',
		observations: readonly EarnedObservation[] = []
	): string => {
		const label = LABELS[pwuId]?.title ?? pwuId;
		const claimId = mintId('clm');
		const evidenceId = mintId('evd');
		const assessmentId = mintId('asm');

		// 1. The CLAIM. Assurance assesses a claim about the work; without one there is nothing to be right about.
		send('AssertClaim', 'CLAIM', claimId, {
			statement: `${label} is fit for the approved need it was decomposed to serve`,
			claimType: 'FITNESS',
			subjectObjectIds: [pwuId]
		});

		// 2. The EVIDENCE, proposed then ADMITTED. Admission is the ratified trigger for the assurance axis
		//    leaving EVIDENCE_REQUIRED, so the hop below is now caused rather than asserted.
		send('ProposeEvidence', 'EVIDENCE', evidenceId, {
			evidenceId,
			evidenceType: 'ARTIFACT',
			contentReference: {
				kind: 'INLINE',
				note: `${label} — recorded output of the execution step`
			},
			producedBy: ACTOR,
			supportsClaimIds: [claimId],
			contradictsClaimIds: [],
			scope: label,
			limitations: [],
			capturedAt: '2026-07-12T00:00:00Z'
		});
		send('AdmitEvidence', 'EVIDENCE', evidenceId, {
			admissibilityAssessmentId: assessmentId,
			admittedScope: label,
			admittedClaimIds: [claimId]
		});
		chg(pwuId, 'EXECUTING', 'EVIDENCE_PENDING', 'SUCCEEDED', 'EVIDENCE_REQUIRED', 'PRESERVED', [
			claimId
		]);
		chg(
			pwuId,
			'EVIDENCE_PENDING',
			'UNDER_ASSURANCE',
			'SUCCEEDED',
			'READY_FOR_ASSESSMENT',
			'PRESERVED',
			[evidenceId]
		);

		// 3. The ASSESSMENT, bound to the policy version AND the subject's semantic version (DOC-004 invariant 2).
		send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			assessmentId,
			assurancePolicyId: policyId,
			policyVersion: '1.0.0',
			subjectObjectIds: [pwuId],
			subjectSemanticVersions: { [pwuId]: 1 },
			claimIds: [claimId]
		});
		chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'ASSESSING', 'PRESERVED', [
			assessmentId
		]);

		// 4. The OBSERVATIONS. The conditional case's residual is now a recorded finding on a real assessment,
		//    not a string handed to the view.
		for (const o of observations) {
			send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintId('obs'), {
				assessmentId,
				observationType: 'FINDING',
				severity: o.severity,
				statement: o.statement,
				evidenceIds: [evidenceId]
			});
		}

		// 5. The VERDICT — a full DOC-007 §20 ValidatorResult naming what was judged, at which version, on which
		//    evidence, and how it came out. The (d2) event gate validates the event this produces.
		send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				validatorId: 'reference-undertaking.reviewer',
				validatorVersion: '1',
				policyId,
				policyVersion: '1.0.0',
				assessmentId,
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: 1 },
				claimResults: [],
				evidenceConsideredIds: [evidenceId],
				evidenceRejected: [],
				observations: observations.map((o) => ({
					severity: o.severity,
					statement: o.statement,
					subjectObjectIds: [pwuId]
				})),
				dispositionRecommendation: disposition,
				recommendedControlActions: [],
				residualUncertainty: observations.map((o) => o.statement),
				limitations: [],
				executionProvenance: { evaluator: ACTOR }
			}
		});
		return assessmentId;
	};

	const driveToSatisfied = (pwuId: string): void => {
		shapeToExecutedSuccess(pwuId);
		const assessmentId = earnAssurance(pwuId, 'SATISFIED');
		// The Given now holds and is CITED: this hop names the satisfied assessment that permits it.
		chg(pwuId, 'UNDER_ASSURANCE', 'SATISFIED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED', [
			assessmentId
		]);
	};

	const driveToConditional = (pwuId: string): void => {
		shapeToExecutedSuccess(pwuId);
		const assessmentId = earnAssurance(pwuId, 'CONDITIONALLY_SATISFIED', [
			{ severity: 'MATERIAL', statement: REFERENCE_OPEN_RESIDUALS[0] }
		]);
		chg(
			pwuId,
			'UNDER_ASSURANCE',
			'CONDITIONALLY_SATISFIED',
			'SUCCEEDED',
			'CONDITIONALLY_SATISFIED',
			'AT_RISK',
			[assessmentId]
		);
	};

	// Root stays in progress (EXECUTING) while its children complete.
	send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', R.root, {});
	send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', R.root, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	chg(R.root, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED');
	chg(R.root, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED');

	driveToSatisfied(R.intentDef);
	driveToSatisfied(R.behavior);

	// Architecture: satisfied, then BASELINED (an authoritative Architecture Baseline).
	driveToSatisfied(R.architecture);
	chg(R.architecture, 'SATISFIED', 'BASELINED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED');

	// Architecture concerns: all satisfied except Mobile & Offline, which is only CONDITIONALLY satisfied
	// (the offline residual is deferred) — so it is NOT qualified-green (INV-5 made visible).
	driveToSatisfied(R.systemContext);
	driveToSatisfied(R.multiTenancy);
	driveToSatisfied(R.dataArch);
	driveToSatisfied(R.integrations);
	driveToConditional(R.mobileOffline);
}
