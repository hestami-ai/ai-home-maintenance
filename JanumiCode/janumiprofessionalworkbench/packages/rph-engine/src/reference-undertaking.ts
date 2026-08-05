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
// WHAT INCREMENT 26 CHANGED. The governance half, the same way: DetectAssumption records the offline residual as
// a real Assumption object linked to the PWUs it affects (ratified §28 Test 2 — "the assumption cannot remain
// only in prose"); the Intent and Architecture baselines are CREATED, submitted for review, authorized by a
// PROMOTE_BASELINE decision made effective, approved, and PROMOTED — and only then does the controller move the
// PWU to BASELINED, citing the promoted baseline and the decision. §8.1's Given for that arrow is "Authorized
// promotion decision"; it used to be nothing at all.
//
// AND THE ENGINE NOW ENFORCES BOTH. `rejectUnbackedDisposition` and `rejectUnbackedBaselining` (pwu.ts) refuse a
// disposition with no assessment behind it and a BASELINED with no promoted baseline behind it. So this script no
// longer tells the truth merely by choosing to — it could not lie in these two ways if it tried.
//
// WHAT INCREMENT 28 CHANGED. The last assigned axis. Execution was notional: ONE hand-written plan for thirteen
// PWUs, never started, never completed, and `executionState: SUCCEEDED` simply written on all of them. Now every
// PWU has a plan it actually runs — propose, approve, activate, start the step, produce a real output, complete
// it — and the step's output IS the evidence the assessment later admits (`proposedEvidenceIds` is the join).
// Before, `earnAssurance` conjured evidence no work had made.
//
// THE FLOOR GATE BLOCKED THIS INCREMENT, WHICH IS THE POINT. The steps are MODEL_INVOCATION — an AI produced
// these outputs — and completeExecutionStep derives `aiProduced` FROM THE STEP and refused: "floor.schema-
// invariant=MISSING, floor.identity-provenance=MISSING, floor.reasoning-review=MISSING". §8.4 L841 makes
// Reasoning Review mandatory for AI-produced work; L854 says a missing review "cannot satisfy assurance or
// permit its protected transition". The workbench's sharpest guard had been live and never once exercised —
// because its own demo never completed a step. It caught the author of this comment claiming AI authorship with
// no review attached. The floor is now recorded over every AI-produced result, which is the demonstration this
// product exists to make.
//
// ALL THREE AXES ARE NOW GUARDED (pwu.ts): a disposition needs an assessment, a baselining needs a promoted
// baseline, an execution success needs a succeeded step. This script no longer tells the truth by choosing to.
//
// WHAT IS STILL NOT DEMONSTRATED, precisely:
//  * `shapeReadinessAssessmentId: 'assess_shape'` still resolves to UNDEFINED — it names an object never created.
//    (markPwuReady does not check it; completeExecutionStep DOES check its own result ids, and rejects unrecorded
//    outputs — so the two boundaries disagree about whether a cited id must exist.)
//  * openResiduals is still NOT PROJECTED: professional-work-graph.ts returns `opts.openResiduals ?? []` from
//    the const below, derived from no event. An auditor injecting an arbitrary string gets it rendered verbatim.
//    The residual IS now a recorded MATERIAL observation AND an Assumption object — the view just does not read
//    it from either.
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
import { evaluateApplicability, FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ProfessionalWorkObjectTypeSchema } from '@janumipwb/rph-contracts';
import { applicabilityPermitsAssessment, policyApplicability } from '@janumipwb/rph-domain';
import { driveAssessmentToAssessing } from './assessment-drive.js';
import type { EngineHandle } from './engine.js';

const ACTOR: ActorReference = {
	actorId: 'owner-1',
	actorType: 'HUMAN',
	displayName: 'Undertaking Owner',
	// THE INVOCATION THIS PARTY ACTED IN (REG-F-029, second layer). `checkIndependence`'s `differs()` requires the
	// compared field present on BOTH sides, so DIFFERENT_INVOCATION FAILS CLOSED when neither party records one —
	// correctly: independence you cannot demonstrate is independence you do not have. That was invisible while the
	// drive cited a single policy requiring DIFFERENT_AGENT. Selecting the policies that actually govern each PWU
	// brought in `pol_intent_completeness` and `pol_assumption_disclosure`, both DIFFERENT_INVOCATION, and both
	// reached INDEPENDENCE_VIOLATION — the WEAKER requirement refused where the STRONGER one passed, purely for
	// want of the datum.
	//
	// This records a fact that was already true rather than asserting a new one: producing the work and assessing
	// it are separate acts, issued as separate commands by separate parties. The seam maps
	// `executionInstanceId` -> `invocationId`.
	executionInstanceId: 'exec-production'
};

// The assurance EVALUATOR is a DISTINCT party from the work producer (ACTOR) — the whole point of independence
// (DOC-004 §39 invariant 8, §8.4). Until now the reference undertaking stamped `owner-1` as BOTH the producer of
// every artifact AND the evaluator of every assessment, so a real independence check (DIFFERENT_AGENT on the
// fitness policy; the evaluator≠producer the Assurance Service must verify) would have had to REJECT the canonical
// drive or be defeated to pass. A separate reviewer identity makes the seed's independence genuine rather than an
// accident of one actor wearing both hats. `actorId` distinct from `owner-1` satisfies DIFFERENT_AGENT (the seam
// maps actorId→agentId); `HUMAN` satisfies the workbench fitness policy's HUMAN requirement.
const EVALUATOR: ActorReference = {
	actorId: 'evaluator-1',
	actorType: 'HUMAN',
	displayName: 'Independent Assurance Reviewer',
	// DISTINCT from the producer's — see the note on ACTOR. Same value on both sides would satisfy nothing:
	// `differs()` demands present-on-both AND different.
	executionInstanceId: 'exec-assurance-review'
};

// The Reasoning Review floor (§8.4) is the AI-review floor: an AI produced the work, and a DIFFERENT model must
// review it (its ratified independence requirement is DIFFERENT_MODEL). These are the two model identities that
// make that real — checkIndependence compares their `modelId`, so distinct models is what the floor demands and
// what these supply. The other two floor policies are deterministic checks with independence NONE, so their
// evaluator identity is immaterial to the check.
const PRODUCER_MODEL: ActorReference = {
	actorId: 'producer-agent-1',
	actorType: 'MODEL',
	displayName: 'Producing Model',
	modelId: 'producer-model-1'
};
const REVIEWER_MODEL: ActorReference = {
	actorId: 'reviewer-agent-1',
	actorType: 'MODEL',
	displayName: 'Independent Reasoning Reviewer',
	modelId: 'reviewer-model-1'
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

/**
 * The corpus §25 constraint chain (RPH-FIX-005). Named so the conformance check can address the very objects the
 * rule names rather than discovering whichever constraint happens to exist — a check that finds its own subject
 * can be satisfied by the wrong one.
 *
 * A SEPARATE CONSTANT, and that is not tidiness. These three ids first went into `REFERENCE_UNDERTAKING` and two
 * test suites went red: `PWU_IDS` there is derived as "every entry EXCEPT intentId", so an exclusion list silently
 * treated a Constraint, an Artifact and a Claim as PWUs. The derivation has been made positive in the same commit,
 * but the constant's meaning is restored here too — a map whose name says PWU should not have to be filtered.
 */
export const REFERENCE_CONSTRAINT_CHAIN = {
	multiTenancyConstraint: 'cns_01ARZ3NDEKTSV4RRFFQ69G5D00',
	tenantIsolationArtifact: 'art_01ARZ3NDEKTSV4RRFFQ69G5D10',
	tenantIsolationClaim: 'clm_01ARZ3NDEKTSV4RRFFQ69G5D20'
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
		kind: 'INTENT_AND_PRODUCT_DEFINITION'
	},
	[REFERENCE_UNDERTAKING.behavior]: {
		title: 'Product Behavior Definition',
		kind: 'PRODUCT_BEHAVIOR_DEFINITION'
	},
	[REFERENCE_UNDERTAKING.architecture]: {
		title: 'Architecture Definition',
		kind: 'ARCHITECTURE_DEFINITION'
	},
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
		kind: 'INTEGRATED_PRODUCT_VALIDATION'
	},
	[REFERENCE_UNDERTAKING.promotion]: {
		title: 'Product Baseline Promotion',
		kind: 'PRODUCT_BASELINE_PROMOTION'
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
	const C = REFERENCE_CONSTRAINT_CHAIN;

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

		// The three de minimis floor policies (rph-assurance §8.4) must EXIST as objects for the completion handler
		// to resolve their independence requirement — the Reasoning Review floor requires DIFFERENT_MODEL.
		// `satisfyFloor` below cited these ids without creating them, so the floor's independence went UNVERIFIED
		// (policy unresolved → the handler's gate skips). Created here (ACTIVE on create; §8.4/§8.9) — but ONLY on
		// this standalone path: when the caller supplies its own fitness policy (the workbench seed) it ALSO seeds
		// the floor policies, and `CreateAssurancePolicy` on an existing object CONFLICTS (createObject requires
		// absence), so re-creating them would break that path.
		for (const def of FLOOR_POLICY_DEFINITIONS) {
			send('CreateAssurancePolicy', 'ASSURANCE_POLICY', def.policyId, {
				policyId: def.policyId,
				version: '1.0.0',
				name: def.name,
				purpose: def.purpose,
				rationale: def.rationale,
				// THE SECOND CREATION SITE, AND THE ONE REG-F-024'S FIX MISSED. `seedFloorPolicies` was corrected to
				// derive this from the object-type enum; THIS copy kept the narrow `['PROFESSIONAL_WORK_ARCHITECTURE']`
				// for another commit, and `floor-declared-scope.test.ts` could not see it because that gate calls only
				// `seedFloorPolicies`. So the gate written to stop the floor being scoped away from the work it governs
				// asserted over one of the two places that scope is set — and on THIS path `satisfyFloor`'s subjects
				// are EVIDENCE objects, exactly the case that produced the original step-#47 refusal.
				//
				// A gate that covers one of two writers is not a gate; it is the first writer's own test wearing the
				// word "declared". Both sites derive now, and the gate drives both paths.
				applicableObjectTypes: [...ProfessionalWorkObjectTypeSchema.options],
				evaluatedClaimTypes: def.evaluatedClaimTypes,
				criteria: def.criteria,
				evaluatorRole: def.evaluatorRole,
				independenceRequirement: def.independence,
				findingDefinitions: def.findingDefinitions,
				permittedControlActions: def.permittedControlActions
			});
		}
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

	// --- The Multi-Tenancy Constraint (RPH-FIX-005, corpus §25) ---
	//
	// ASSERTED BEFORE THE PWUs ARE PROPOSED, because the chain's first hop is the constraint PROPAGATING to the
	// Multi-Tenancy PWU and a PWU cites its constraints at proposal (`constraintIds`). Asserting it afterwards
	// would leave the reference dangling in the direction the rule reads.
	//
	// Sourced from the INTENT: §25 Test 3 makes it a property of the approved need that must remain traceable
	// through architecture, not something the architecture invented for itself.
	send('AssertConstraint', 'CONSTRAINT', C.multiTenancyConstraint, {
		statement:
			'Tenant data SHALL be isolated so that no tenant can read or write another tenant records',
		constraintType: 'SECURITY',
		sourceObjectId: R.intentId,
		authority: {
			authorityId: 'auth_architecture_lead',
			authorityType: 'ORGANIZATIONAL_ROLE',
			scope: ['ARCHITECTURE'],
			validFrom: '2026-07-12T00:00:00Z'
		},
		// CONFORMED 2026-08-05. This read `{ appliesTo: 'ARCHITECTURE', scope: 'all tenant-scoped work' }` — two
		// field names DOC-004 §5.1 does not define, accepted only because `ApplicabilityRuleSchema` was an opaque
		// `z.record(string, unknown)`. Schematizing §5.1 made it visible: the canonical drive had been writing a
		// shape that is not an ApplicabilityRule into a field typed as one, and nothing could object.
		//
		// `appliesTo: 'ARCHITECTURE'` maps exactly onto the ratified `pwuKindConditions`. The `scope` prose has NO
		// §5.1 home — it is not a condition, it is a description — so it is NOT smuggled into `expression` (the
		// escape hatch for conditions the structured fields cannot express, which is a different thing from prose).
		// It survives where it belongs: in the constraint's own statement text below.
		applicability: {
			objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
			pwuKindConditions: ['ARCHITECTURE']
		},
		strength: 'MANDATORY'
	});

	/** Constraints each PWU carries at proposal. Only the Multi-Tenancy concern binds one today (corpus §25). */
	const CONSTRAINTS_BY_PWU: Readonly<Record<string, readonly string[]>> = {
		[R.multiTenancy]: [C.multiTenancyConstraint]
	};

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
			constraintIds: [...(CONSTRAINTS_BY_PWU[pwuId] ?? [])],
			assumptionIds: [],
			expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
			// WHICH POLICIES GOVERN THIS PWU DIRECTLY (REG-F-029). This shipped `[]` while `earnAssurance` assessed
			// every PWU under one policy chosen elsewhere — so the object said "no policy governs me" and the drive
			// assessed it anyway, which is the finding in miniature.
			//
			// On the SEEDED path the declaration comes from the PWU Type (`pwuTypeId` above → its
			// `requiredAssurancePolicyIds`), so this stays empty and the type's list is the whole declaration.
			// On the STANDALONE path there is no PWA and no type, so the drive's own policy is declared HERE rather
			// than being a fallback inside the selector: a fallback cannot tell "declared nothing" from "declared
			// this", and that distinction is the one this finding turned on.
			assurancePolicyIds: opts.pwuTypeByKind?.[meta.kind] ? [] : [policyId],
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

	// --- Architecture obligations (RPH-FIX-004, 2026-08-04) ---
	//
	// WITHOUT THESE THE RULE HOLDS VACUOUSLY, which is why they are authored rather than the check simply added.
	// RPH-FIX-004 is "all architecture obligations in the fixture are allocated to child PWUs". Every PWU here was
	// proposed with `obligationIds: []` and every decomposition with no `obligationAllocations`, so the universally
	// quantified check would have ranged over an EMPTY set and passed — certifying a ratified rule on the strength
	// of there being nothing to certify. That is the shape this register has recorded repeatedly (a floor test that
	// arranged no floor; a guard that could not see its own subject), and adding the check first would have
	// reproduced it exactly.
	//
	// SOURCED FROM THE CORPUS, not invented: §25 Test 3 requires the Multi-Tenancy Constraint to be traceable to
	// the Multi-Tenancy, Data Architecture and Integration Architecture PWU Instances, and §25 Test 4 is the
	// decomposition-coverage test itself. These three obligations are that requirement stated as obligations of the
	// Architecture Definition PWU, allocated to exactly those children.
	const OBLIGATIONS: ReadonlyArray<{
		readonly id: string;
		readonly statement: string;
		readonly obligationType: 'SECURITY' | 'QUALITY' | 'FUNCTIONAL';
		readonly allocatedTo: readonly string[];
	}> = [
		{
			id: 'obl_01ARZ3NDEKTSV4RRFFQ69G5C10',
			statement:
				'Tenant data SHALL be isolated so that no tenant can read or write another tenant records',
			obligationType: 'SECURITY',
			allocatedTo: [R.multiTenancy]
		},
		{
			id: 'obl_01ARZ3NDEKTSV4RRFFQ69G5C11',
			statement: 'The data model SHALL carry a tenant discriminator on every tenant-scoped entity',
			obligationType: 'QUALITY',
			allocatedTo: [R.dataArch]
		},
		{
			id: 'obl_01ARZ3NDEKTSV4RRFFQ69G5C12',
			statement: 'Outbound integrations SHALL NOT leak tenant identifiers across tenant boundaries',
			obligationType: 'FUNCTIONAL',
			allocatedTo: [R.integrations]
		}
	];
	for (const o of OBLIGATIONS) {
		send('AssertObligation', 'OBLIGATION', o.id, {
			statement: o.statement,
			obligationType: o.obligationType,
			// The obligations belong to the Architecture Definition PWU — that is what makes them ARCHITECTURE
			// obligations, and what makes "allocated to child PWUs" a statement about THIS decomposition.
			sourceObjectId: R.architecture,
			authority: {
				authorityId: 'auth_architecture_lead',
				authorityType: 'ORGANIZATIONAL_ROLE',
				scope: ['ARCHITECTURE'],
				validFrom: '2026-07-12T00:00:00Z'
			},
			// MANDATORY on purpose: DOC-003 §6 DEC-3's conservation equation quantifies over MANDATORY parent
			// obligations. An ADVISORY obligation would leave the check true without the equation ever binding.
			strength: 'MANDATORY'
		});
	}

	// --- Decomposition contracts (root -> areas, architecture -> concerns) ---
	const decompose = (
		dcpId: string,
		parentWorkUnitId: string,
		childWorkUnitIds: string[],
		obligationAllocations: ReadonlyArray<{ obligationId: string; allocatedTo: string[] }> = []
	): void => {
		send('ProposeDecomposition', 'DECOMPOSITION_CONTRACT', dcpId, {
			parentWorkUnitId,
			childWorkUnitIds,
			rationale: 'Product Realization decomposition',
			...(obligationAllocations.length > 0 ? { obligationAllocations } : {})
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
	decompose(
		'dcp_01ARZ3NDEKTSV4RRFFQ69G5B10',
		R.architecture,
		[R.systemContext, R.multiTenancy, R.dataArch, R.integrations, R.mobileOffline],
		OBLIGATIONS.map((o) => ({ obligationId: o.id, allocatedTo: [...o.allocatedTo] }))
	);

	// An Execution Plan is a DISTINCT object that PERFORMS a PWU Instance through temporal steps — it is NOT the
	// Professional Work Graph (§35.3 / criterion 16). There used to be exactly ONE, hand-written here for the
	// Architecture PWU, and even it was never executed: no step was started or completed, and all thirteen PWUs
	// were then simply assigned `executionState: SUCCEEDED`. Every PWU now gets a plan it actually runs, minted
	// inside `shapeAndExecute` (Increment 28), so this standalone block is gone rather than duplicated.

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

	// --- THE EXECUTION LOOP (Increment 28) ---
	//
	// The last axis that was assigned rather than earned. This used to be four bare `chg` hops ending in
	// `executionState: SUCCEEDED` — no plan, no step, no attempt, no output. Fourth confirmation of the same
	// pattern: StartExecutionStep / CompleteExecutionStep were registered all along, and completeExecutionStep is
	// thoroughly built — it validates the ratified §16.1 payload, emits the §16.2 event, REQUIRES real output
	// (`hasOutput`), and carries a de minimis floor gate. Built, guarded, uncalled.
	//
	// The order follows the ratified §26 trace: the CLAIM is asserted while shaping (step 19), before the PWU is
	// marked ready (20) — a claim is what the work is trying to make true, not a description of it afterwards —
	// then plan/approve/activate (21-23), the step runs (24-25), and its output becomes the evidence (26) the
	// assurance loop then admits (27).
	//
	// THIS IS WHERE THE CHAIN CLOSES. `CompleteExecutionStepPayload.proposedEvidenceIds` is the join: the step's
	// output IS the evidence the assessment later considers. Before this, `earnAssurance` conjured evidence from
	// nowhere — an artifact of no work. Now the work produces it.
	/** The three locked de minimis floor policies every AI-produced result must clear (rph-assurance floor.*).
	 *  Their ids are the ones the execution floor gate looks for by name. */
	const FLOOR_POLICIES = [
		'floor.schema-invariant',
		'floor.identity-provenance',
		'floor.reasoning-review'
	] as const;

	/** Record the de minimis floor over an AI-produced RESULT, SATISFIED, at the version it was judged at.
	 *  The subject is the RESULT, never the step: DOC-004 invariant 2 requires every assessment to identify its
	 *  subject semantic version, and an ExecutionStep has none. */
	const satisfyFloor = (subjectId: string): void => {
		for (const floorPolicyId of FLOOR_POLICIES) {
			const assessmentId = mintId('asm');
			// Reasoning Review is the AI-review floor and REQUIRES model independence (DIFFERENT_MODEL): a DIFFERENT
			// model must review the producing model's output. So it is reviewed by REVIEWER_MODEL and cites the
			// PRODUCER_MODEL that made the subject — distinct models, which the handler's independence gate now
			// verifies. The other two floors are deterministic checks (independence NONE); their evaluator is
			// immaterial to the check, so they keep the human reviewer and supply no producer.
			const isReasoningReview = floorPolicyId === 'floor.reasoning-review';
			// The ratified §30 sequence, through the one helper that knows it (REG-F-021 increment 4).
			driveAssessmentToAssessing(send, {
				assessmentId,
				assurancePolicyId: floorPolicyId,
				policyVersion: '1.0.0',
				subjectObjectIds: [subjectId],
				subjectSemanticVersions: { [subjectId]: 1 },
				claimIds: []
			});
			send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
				validatorResult: {
					validatorId: `deterministic.${floorPolicyId.replace(/^floor\./, '')}`,
					validatorVersion: '1',
					policyId: floorPolicyId,
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [subjectId],
					subjectSemanticVersions: { [subjectId]: 1 },
					claimResults: [],
					evidenceConsideredIds: [subjectId],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: { evaluator: isReasoningReview ? REVIEWER_MODEL : EVALUATOR }
				},
				...(isReasoningReview ? { producer: PRODUCER_MODEL } : {})
			});
		}
	};

	/** Shape a PWU, assert its claim, and EXECUTE it for real. Returns the claim and the evidence the work made. */
	const shapeAndExecute = (pwuId: string): { claimId: string; evidenceId: string } => {
		const label = LABELS[pwuId]?.title ?? pwuId;
		const claimId = mintId('clm');
		const planId = mintId('exp');
		const stepId = mintId('stp');
		const attemptId = mintId('ata');
		const evidenceId = mintId('evd');

		send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', pwuId, {});
		// §26 step 19: the claim is asserted during shaping — the thing this work must make true.
		send('AssertClaim', 'CLAIM', claimId, {
			statement: `${label} is fit for the approved need it was decomposed to serve`,
			claimType: 'FITNESS',
			subjectObjectIds: [pwuId]
		});
		send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			shapeReadinessAssessmentId: 'assess_shape',
			expectedSemanticVersion: 1
		});

		send('ProposeExecutionPlan', 'EXECUTION_PLAN', planId, {
			executionPlanId: planId,
			workUnitId: pwuId,
			steps: [
				{
					id: stepId,
					executionPlanId: planId,
					stepType: 'MODEL_INVOCATION',
					purpose: `Produce ${label}'s expected output`,
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
		send('ApproveExecutionPlan', 'EXECUTION_PLAN', planId, {});
		send('ActivateExecutionPlan', 'EXECUTION_PLAN', planId, { authorizedRuntimeBindingIds: [] });
		chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED', [planId]);
		chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED', [planId]);

		send('StartExecutionStep', 'EXECUTION_PLAN', planId, { stepId });
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED', [planId]);

		// The output of the work, recorded as evidence for the claim the work was meant to make true. This is
		// the honest source of the evidence the assessment will consider — it exists because a step produced it.
		send('ProposeEvidence', 'EVIDENCE', evidenceId, {
			evidenceId,
			evidenceType: 'ARTIFACT',
			contentReference: {
				kind: 'INLINE',
				note: `${label} — recorded output of execution step ${stepId}`
			},
			producedBy: ACTOR,
			supportsClaimIds: [claimId],
			contradictsClaimIds: [],
			scope: label,
			limitations: [],
			capturedAt: '2026-07-12T00:00:00Z'
		});
		// THE DE MINIMIS FLOOR — and this is the most important thing in the file.
		//
		// The step above is a MODEL_INVOCATION: an AI produced this output. §8.4 L841 makes Reasoning Review
		// mandatory "when the transformation is produced by or materially shaped by an AI/agent", and L854: "A
		// missing, stale, malformed, failed, unavailable, or independence-invalid required review cannot satisfy
		// assurance or permit its protected transition." completeExecutionStep enforces exactly that, deriving
		// aiProduced from the step rather than taking anyone's word.
		//
		// It BLOCKED this increment on first run — "floor.schema-invariant=MISSING, floor.identity-provenance=
		// MISSING, floor.reasoning-review=MISSING" — which is the gate working, against me, correctly: I had
		// claimed AI authorship and supplied no review. The seed never met this gate in its whole existence
		// because it never completed a step; it just assigned SUCCEEDED. So the workbench's sharpest guard has
		// been live and unexercised, and its own demo was the thing routing around it.
		//
		// This is the demonstration the product exists to make: an AI made this, and here is the floor that lets
		// it count.
		satisfyFloor(evidenceId);

		send('CompleteExecutionStep', 'EXECUTION_PLAN', planId, {
			executionStepId: stepId,
			executionAttemptId: attemptId,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [evidenceId],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: { evaluator: ACTOR }
		});
		// Earned, and cited: the plan whose step actually succeeded.
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED', [planId]);
		return { claimId, evidenceId };
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

	/** Establish RPH-PWU-006's GIVEN for `pwuId` and return the assessment id that evidences it.
	 *
	 *  Takes the claim and evidence the EXECUTION produced (Increment 28). It used to mint both itself — asserting
	 *  a claim and conjuring "evidence" that no work had made, an artifact of nothing. Assurance does not
	 *  manufacture its own evidence; it admits and assesses what execution actually produced. */
	/**
	 * WHICH POLICIES GOVERN THIS PWU — DECLARED ∩ DETERMINED (REG-F-029).
	 *
	 * `earnAssurance` used to cite ONE policy for every PWU, resolved once at the top of the drive. On the seeded
	 * path that policy is the catalog's `pol_fitness_for_purpose`, scoped to three PWU kinds — and the eight PWUs
	 * this drive assesses are of four OTHER kinds. The assessed population and the policy's scope were **perfectly
	 * disjoint**: every assessment the canonical drive recorded cited a policy the catalog says does not govern
	 * its subject.
	 *
	 * DECLARED is the same join §38's `buildApplicablePolicies` computes — the PWU's own `assurancePolicyIds` plus
	 * its PWU Type's `requiredAssurancePolicyIds` — so the drive and the read model cannot give different answers
	 * to "which policies apply here".
	 *
	 * DETERMINED runs the ratified §5.1 kernel, `policyApplicability`, over the policy objects ACTUALLY IN THE
	 * STORE. That is the point: `requestAssuranceAssessment`'s precondition calls the same function on the same
	 * data, so once it is enforced this drive passes **by construction rather than by coincidence**. It also drops
	 * the ontology's own internal contradictions without anyone hand-editing them — `PRODUCT_REALIZATION` declares
	 * `pol_baseline_promotion`, which scopes itself to `PRODUCT_BASELINE_PROMOTION`.
	 *
	 * FAILS LOUD ON AN EMPTY SELECTION. A PWU whose declaration survives nothing is a PWU nothing can assess, and
	 * returning `[]` here would surface as a missing assessment three layers away — or, worse, as a PWU driven to
	 * SATISFIED with no assessment backing it, which is the shape RPH-PWU-006 exists to forbid.
	 */
	const policiesGoverning = (pwuId: string): string[] => {
		const pwu = handle.loadObject(pwuId)?.state as
			| { pwuKind?: string; pwuTypeId?: string; assurancePolicyIds?: string[]; tags?: string[] }
			| undefined;
		const viaType = pwu?.pwuTypeId
			? ((
					handle.loadObject(pwu.pwuTypeId)?.state as
						{ requiredAssurancePolicyIds?: string[] } | undefined
				)?.requiredAssurancePolicyIds ?? [])
			: [];
		const declared = [...new Set([...(pwu?.assurancePolicyIds ?? []), ...viaType])];
		const excluded: string[] = [];
		const selected = declared.filter((pid) => {
			const pol = handle.loadObject(pid)?.state as
				{ status?: string; applicability?: unknown; applicableObjectTypes?: string[] } | undefined;
			if (!pol) return excluded.push(`${pid}: not in the store`) && false;
			if (pol.status !== 'ACTIVE') return excluded.push(`${pid}: ${String(pol.status)}`) && false;
			const outcome = policyApplicability(
				pol.applicability ?? { objectTypeConditions: pol.applicableObjectTypes },
				{
					objectType: 'PROFESSIONAL_WORK_UNIT',
					...(pwu?.pwuKind ? { pwuKind: pwu.pwuKind } : {}),
					...(pwu?.tags ? { tags: pwu.tags } : {})
				},
				// Same evaluator the handler injects — the point of "one answer computed once" is that both sides
				// decide expressions the same way too, not merely the fields either happens to understand.
				(expr, subj) => evaluateApplicability(expr as never, subj)
			);
			if (applicabilityPermitsAssessment(outcome)) return true;
			excluded.push(`${pid}: ${outcome}`);
			return false;
		});
		if (selected.length === 0)
			throw new Error(
				`Reference Undertaking: no policy governs ${pwuId} (${String(pwu?.pwuKind)}). Declared ` +
					`[${declared.join(', ') || 'nothing'}]; excluded [${excluded.join('; ') || 'n/a'}]. A PWU nothing ` +
					`can assess cannot be driven to a disposition — RPH-PWU-006 requires an assessment behind it.`
			);
		return selected;
	};

	const earnAssurance = (
		pwuId: string,
		produced: { readonly claimId: string; readonly evidenceId: string },
		disposition: 'SATISFIED' | 'CONDITIONALLY_SATISFIED',
		observations: readonly EarnedObservation[] = [],
		/** Additional claims this assessment VERIFIES — the last hop of the corpus §25 chain (RPH-FIX-005). */
		extraClaimIds: readonly string[] = []
	): string => {
		const label = LABELS[pwuId]?.title ?? pwuId;
		const { claimId, evidenceId } = produced;
		// EVERY policy that governs this PWU gets its own assessment, not just the first (REG-F-029). Citing one of
		// four would leave the other three reading `assessed: false` in the §38 view on a PWU this drive calls
		// SATISFIED — a required-but-unassessed gap, which is the same class of defect as the finding itself. The
		// PRIMARY assessment (the first) is the one the evidence admission cites and the one returned to callers,
		// because those reference a single assessment id; the rest are peers, not subordinates.
		const governing = policiesGoverning(pwuId);
		const assessmentIds = governing.map(() => mintId('asm'));
		const assessmentId = assessmentIds[0]!;

		// The evidence execution proposed is now ADMITTED. Admission is the ratified trigger for the assurance
		// axis leaving EVIDENCE_REQUIRED, so the hop below is caused rather than asserted.
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
		// The ratified §30 sequence, through the one helper that knows it (REG-F-021 increment 4). This is the
		// CANONICAL drive, so it names its evaluator: `selectAssuranceEvaluator` is what gives "who assessed" a
		// governed home instead of letting it arrive inside the verdict.
		for (const [i, pid] of governing.entries())
			driveAssessmentToAssessing(send, {
				assessmentId: assessmentIds[i]!,
				assurancePolicyId: pid,
				policyVersion: '1.0.0',
				subjectObjectIds: [pwuId],
				subjectSemanticVersions: { [pwuId]: 1 },
				claimIds: [claimId, ...extraClaimIds],
				evaluator: EVALUATOR
			});
		// The PWU's own assurance axis hops ONCE regardless of how many policies govern it — the axis records that
		// this WORK is being assessed, not how many assessments are open against it.
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
		//    ONE PER ASSESSMENT, each naming ITS OWN policy: a ValidatorResult whose `policyId` did not match the
		//    assessment's would be a verdict attributed to criteria it was not measured against.
		for (const [i, pid] of governing.entries())
			send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentIds[i]!, {
				validatorResult: {
					validatorId: 'reference-undertaking.reviewer',
					validatorVersion: '1',
					policyId: pid,
					policyVersion: '1.0.0',
					assessmentId: assessmentIds[i]!,
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
					executionProvenance: { evaluator: EVALUATOR }
				},
				producer: ACTOR
			});
		return assessmentId;
	};

	// --- THE GOVERNANCE LOOP (Increment 26b) ---
	//
	// DOC-002 §8.1: "SATISFIED/RECOMPOSED | Promote baseline | BASELINED | Authorized promotion decision".
	// The seed used to assert BASELINED outright — no Baseline object, no decision, no promotion — which
	// collides with ratified RPH-BAS-004 ("Missing required assessment prevents promotion"). As with the
	// assurance loop, none of this had to be built: CreateBaseline / SubmitBaselineForReview / ApproveBaseline /
	// PromoteBaseline / ProposeDecision / ApproveDecision were all registered and emitting nothing because this
	// script never called them.
	//
	// Note PromoteBaselinePayload was ALREADY governance-shaped: it demands a promotionDecisionId, the exact
	// expected semantic version of every item, and the requiredAssessmentIds. The contract has always asked for
	// the Given; nobody was answering it.
	/** Baseline a satisfied PWU through the ratified chain, returning [baselineId, decisionId] to cite. */
	const baseline = (
		pwuId: string,
		baselineType: 'INTENT' | 'ARCHITECTURE',
		label: string,
		assessmentIds: readonly string[]
	): readonly string[] => {
		const baselineId = mintId('bsl');
		const decisionId = mintId('dec');

		send('CreateBaseline', 'BASELINE', baselineId, {
			baselineType,
			itemObjectIds: [pwuId],
			assuranceAssessmentIds: [...assessmentIds]
		});
		send('SubmitBaselineForReview', 'BASELINE', baselineId, {});

		// The authorizing decision — §37 requires a control action to record the evidence considered and the
		// policy authorizing it; DecisionType.PROMOTE_BASELINE is the ratified vocabulary for this act.
		send('ProposeDecision', 'DECISION', decisionId, {
			decisionType: 'PROMOTE_BASELINE',
			subjectObjectIds: [pwuId, baselineId],
			selectedOption: `Promote the ${label}`,
			rationale: `${label}'s assessments are satisfied and its evidence admitted; promotion freezes it as authoritative.`,
			authority: ACTOR,
			consideredObservationIds: []
		});
		send('ApproveDecision', 'DECISION', decisionId, {
			selectedOption: `Promote the ${label}`,
			rationale: `${label}'s assessments are satisfied and its evidence admitted; promotion freezes it as authoritative.`,
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: { [pwuId]: 1, [baselineId]: 1 }
		});

		send('ApproveBaseline', 'BASELINE', baselineId, { approvalDecisionId: decisionId });
		send('PromoteBaseline', 'BASELINE', baselineId, {
			promotionDecisionId: decisionId,
			expectedItemObjectVersions: [{ objectId: pwuId, semanticVersion: 1 }],
			requiredAssessmentIds: [...assessmentIds]
		});
		return [baselineId, decisionId];
	};

	/** Returns the satisfied assessment's id, so a caller that goes on to baseline this PWU can cite the very
	 *  assessment that permitted its satisfaction (PromoteBaseline's `requiredAssessmentIds`). */
	const driveToSatisfied = (
		pwuId: string,
		/** Runs AFTER execution and BEFORE assurance; returns extra claims the assessment must verify. The hook
		 *  exists so the §25 chain keeps its true ordering — a PWU produces the model, a claim is asserted over
		 *  that model, and only then is it assessed. Authoring the artifact before the PWU had executed would
		 *  have been a small fiction inside a fixture whose whole purpose is to be faithful. */
		afterExecution?: () => readonly string[]
	): string => {
		const produced = shapeAndExecute(pwuId);
		const extraClaimIds = afterExecution?.() ?? [];
		const assessmentId = earnAssurance(pwuId, produced, 'SATISFIED', [], extraClaimIds);
		// The Given now holds and is CITED: this hop names the satisfied assessment that permits it.
		chg(pwuId, 'UNDER_ASSURANCE', 'SATISFIED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED', [
			assessmentId
		]);
		return assessmentId;
	};

	const driveToConditional = (pwuId: string): void => {
		const produced = shapeAndExecute(pwuId);
		const assessmentId = earnAssurance(pwuId, produced, 'CONDITIONALLY_SATISFIED', [
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

	// Intent & Product Definition: satisfied, then frozen as the authoritative Intent Baseline (§26 trace steps
	// 15-16). The Behavior PWU is satisfied and deliberately NOT baselined — the reference undertaking's point is
	// that satisfied and baselined are different things.
	const intentDefAssessment = driveToSatisfied(R.intentDef);
	baseline(R.intentDef, 'INTENT', 'Intent Baseline', [intentDefAssessment]);

	driveToSatisfied(R.behavior);

	// The material assumption that produced the offline residual. Ratified Reference Undertaking §28 Test 2
	// ("Material assumptions persist") requires an Assumption OBJECT linked to the affected PWUs — "the
	// assumption cannot remain only in prose". It was prose: a hardcoded string handed to the view.
	const assumptionId = mintId('asu');
	send('DetectAssumption', 'ASSUMPTION', assumptionId, {
		assumptionId,
		statement: REFERENCE_OPEN_RESIDUALS[0],
		basis: 'First-increment scope decision: connectivity assumed at job start and sync deferred.',
		introducedBy: ACTOR,
		affectedObjectIds: [R.mobileOffline, R.behavior],
		materiality: 'MATERIAL'
	});

	// Architecture: satisfied, then BASELINED through the ratified chain — create, submit for review, an
	// authorizing PROMOTE_BASELINE decision made effective, approve, promote — and only then the controller's
	// hop, citing the baseline and the decision that authorized it. DOC-002 §8.1's Given for this arrow is
	// "Authorized promotion decision"; it used to be nothing at all.
	const archAssessment = driveToSatisfied(R.architecture);
	const [archBaseline, archDecision] = baseline(
		R.architecture,
		'ARCHITECTURE',
		'Architecture Baseline',
		[archAssessment]
	);
	chg(R.architecture, 'SATISFIED', 'BASELINED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED', [
		archBaseline!,
		archDecision!
	]);

	// Architecture concerns: all satisfied except Mobile & Offline, which is only CONDITIONALLY satisfied
	// (the offline residual is deferred) — so it is NOT qualified-green (Property P1 made visible).
	driveToSatisfied(R.systemContext);
	// The corpus §25 chain, completed (RPH-FIX-005): the Multi-Tenancy PWU PRODUCES the Tenant Isolation Model, a
	// SECURITY claim is asserted OVER that model, and the PWU's assessment VERIFIES it. The constraint hop was
	// bound at proposal (`constraintIds`), so all five links now exist as real references in the graph.
	driveToSatisfied(R.multiTenancy, () => {
		send('RecordArtifact', 'ARTIFACT', C.tenantIsolationArtifact, {
			artifactId: C.tenantIsolationArtifact,
			artifactType: 'ARCHITECTURE_MODEL',
			mediaType: 'text/markdown',
			storageProvider: 'workbench',
			storageKey: 'architecture/tenant-isolation-model.md',
			contentHash: 'sha256:tenant-isolation-model',
			producingPwuId: R.multiTenancy,
			securityClassification: 'INTERNAL',
			retentionClass: 'STANDARD',
			status: 'AVAILABLE'
		});
		send('AssertClaim', 'CLAIM', C.tenantIsolationClaim, {
			statement:
				'The Tenant Isolation Model enforces the Multi-Tenancy Constraint for every tenant-scoped entity',
			claimType: 'SECURITY',
			subjectObjectIds: [C.tenantIsolationArtifact]
		});
		return [C.tenantIsolationClaim];
	});
	driveToSatisfied(R.dataArch);
	driveToSatisfied(R.integrations);
	driveToConditional(R.mobileOffline);
}
