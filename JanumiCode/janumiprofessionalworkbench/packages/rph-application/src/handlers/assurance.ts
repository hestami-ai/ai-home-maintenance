// Assurance-side handlers: Evidence (propose/admit/invalidate), Claim (assert), Assumption (detect), Assurance
// Assessment (request/complete), Assurance Observation (record). The exec≠assurance separation (INV-5) is upheld
// structurally — nothing here is driven by executionState; a satisfied assessment is a separate, explicit act
// whose disposition comes from the validator recommendation and is gated by the AssuranceAssessment.state machine
// (which makes VALIDATOR_FAILED→REJECTED and INDEPENDENCE_VIOLATION→SATISFIED illegal). Evidence admissibility
// (§8.11) is enforced at AdmitEvidence by @janumipwb/rph-assurance's evidenceAdmissibility — the kernel rule,
// called, not a copy of it. Validator-independence scoring still lives there uncalled; that is the next increment.
import {
	checkIndependence,
	evidenceAdmissibility,
	type Identity,
	type IndependenceRequirement
} from '@janumipwb/rph-assurance';
import type {
	ActorReference,
	AdmitEvidencePayload,
	AssertClaimPayload,
	CreateAssurancePolicyPayload,
	DetectAssumptionPayload,
	DomainCommand,
	EditAssurancePolicyPayload,
	ProposeEvidencePayload,
	RecordAssuranceObservationPayload,
	RequestAssuranceAssessmentPayload,
	SubmitEvidenceForAssessmentPayload,
	SupersedeAssurancePolicyPayload
} from '@janumipwb/rph-contracts';
import {
	advanceStatus,
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler
} from './kit.js';

// ---- Assurance Policy ----
const POLICY = 'ASSURANCE_POLICY';

// The 3 de minimis floor policies (guide §8.4) are LOCKED: always-apply, non-waivable, non-editable — the
// exec≠assurance floor (INV-5). Their ids mirror @janumipwb/rph-assurance FLOOR_POLICY_IDS (kept literal here to
// avoid a cross-package dep). Edit / Supersede / Suspend / Activate all reject when targeting one.
const FLOOR_POLICY_IDS: ReadonlySet<string> = new Set([
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
]);

/** A status-transition guard that rejects any lifecycle change to a locked de minimis floor policy. */
function rejectIfFloorLocked(command: DomainCommand): () => ReturnType<typeof reject> | null {
	return () =>
		FLOOR_POLICY_IDS.has(command.targetAggregateId)
			? reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`The de minimis floor policy ${command.targetAggregateId} is locked (always-applies, non-waivable) and cannot be edited, suspended, or superseded`,
					[command.targetAggregateId]
				)
			: null;
}

/** CreateAssurancePolicy — create a versioned ASSURANCE_POLICY object. Regular (catalog) policies are born DRAFT
 *  (the ratified DOC-002 §18 initial state) and must be activated to govern; the de minimis floor policies (§8.4)
 *  are seeded through this too but are born ACTIVE (locked, always-apply — they cannot be activated). See bornStatus
 *  below. Five of the six governing rule arrays are now settable from the payload (evidence, disposition, escalation,
 *  waiver — DOC-004 §6.1/§10.2/§13/§12.1); remediationRules alone stays empty (its element type is undefined in the
 *  corpus). The enum-typed fields are validated by the object schema. */
export const createAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateAssurancePolicyPayload;
	// The initial governance state, split by policy kind:
	//   - REGULAR (ratified DOC-004 catalog) policies are born DRAFT — the RATIFIED AssurancePolicy.status initial
	//     state (DOC-002 §18: initialState DRAFT, with a guarded DRAFT -> ACTIVE "policy activated" transition). The
	//     handler used to write 'ACTIVE' for ALL policies, bypassing that lifecycle — which is why the reference
	//     undertaking's ActivateAssurancePolicy call was a meaningless ACTIVE->ACTIVE no-op. A regular policy now
	//     governs only once deliberately activated (requestAssuranceAssessment requires ACTIVE).
	//   - The three de minimis FLOOR policies (§8.4, a guide construct) are LOCKED and always-apply: rejectIfFloorLocked
	//     rejects Activate/Suspend/Supersede/Edit on them, so they CANNOT be activated and MUST be born ACTIVE. The
	//     ratified §18 lifecycle governs the ratified catalog; the authored floor overlay is exempt by construction.
	const bornStatus = FLOOR_POLICY_IDS.has(p.policyId) ? 'ACTIVE' : 'DRAFT';
	const state: Record<string, unknown> = {
		...newEnvelope(command, POLICY, p.policyId, {
			lifecycleStatus: bornStatus,
			originType: 'HUMAN_DECISION'
		}),
		version: p.version,
		name: p.name,
		purpose: p.purpose,
		rationale: p.rationale,
		applicableObjectTypes: p.applicableObjectTypes,
		applicability: {},
		evaluatedClaimTypes: p.evaluatedClaimTypes,
		defaultClaimTemplates: [],
		requiredEvidence: p.requiredEvidence ?? [],
		optionalEvidence: p.optionalEvidence ?? [],
		criteria: p.criteria,
		evaluatorRole: p.evaluatorRole,
		independenceRequirement: p.independenceRequirement,
		findingDefinitions: p.findingDefinitions,
		// AssurancePolicyDefinition has SIX governing rule arrays that were REQUIRED by the object schema but carried
		// by NO command — hardcoded empty here, exactly like ARTIFACT's outputArtifactIds (Increment 10a): the object
		// demands it, nothing could set it, so a seeded policy could declare NONE of the rules that make it a policy
		// (its outcome, its escalation, its evidence, its waivability).
		//
		// FIVE are now SETTABLE (payload fields authored under the §0.3 grant; element shapes transcribed from DOC-004,
		// Inc A): requiredEvidence + optionalEvidence (§6.1, set above), dispositionRules (§10.2), escalationRules
		// (§13), and waiverRules (§12.1). remediationRules ALONE stays hardcoded [] — DEFERRED because RemediationRule
		// is undefined across the corpus (the ExecutionProvenance situation), so invent nothing. (An earlier note
		// counted a seventh array, riskProfiles; it is NOT an AssurancePolicyDefinition field — the '6/7' miscounted.)
		//
		// SETTABLE, NOT YET ENFORCED: occupying these ratified homes is documentation-grade — the assurance loop
		// derives disposition from the validator recommendation and floor.ts hardcodes the plan, so nothing READS
		// these declared rules at runtime yet. Wiring a store→runtime read is the deeper follow-up.
		dispositionRules: p.dispositionRules ?? [],
		remediationRules: [],
		escalationRules: p.escalationRules ?? [],
		waiverRules: p.waiverRules ?? [],
		permittedControlActions: p.permittedControlActions,
		status: bornStatus
	};
	return createObject(ctx, command, {
		objectType: POLICY,
		aggregateId: p.policyId,
		state,
		eventType: 'AssurancePolicyCreated'
	});
};

/** EditAssurancePolicy — revise a non-floor, non-superseded policy's content in place (same version, revision++).
 *  Only payload-present fields change (patch). Floor policies + SUPERSEDED policies reject. */
export const editAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as EditAssurancePolicyPayload;
	const id = command.targetAggregateId;
	const floorBlock = rejectIfFloorLocked(command)();
	if (floorBlock) return floorBlock;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.status === 'SUPERSEDED') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Policy ${id} is SUPERSEDED and cannot be edited — create a new version instead`,
			[id]
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		...(p.name !== undefined ? { name: p.name } : {}),
		...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
		...(p.rationale !== undefined ? { rationale: p.rationale } : {}),
		...(p.applicableObjectTypes !== undefined
			? { applicableObjectTypes: p.applicableObjectTypes }
			: {}),
		...(p.evaluatedClaimTypes !== undefined ? { evaluatedClaimTypes: p.evaluatedClaimTypes } : {}),
		...(p.criteria !== undefined ? { criteria: p.criteria } : {}),
		...(p.evaluatorRole !== undefined ? { evaluatorRole: p.evaluatorRole } : {}),
		...(p.independenceRequirement !== undefined
			? { independenceRequirement: p.independenceRequirement }
			: {}),
		...(p.findingDefinitions !== undefined ? { findingDefinitions: p.findingDefinitions } : {}),
		...(p.requiredEvidence !== undefined ? { requiredEvidence: p.requiredEvidence } : {}),
		...(p.optionalEvidence !== undefined ? { optionalEvidence: p.optionalEvidence } : {}),
		...(p.dispositionRules !== undefined ? { dispositionRules: p.dispositionRules } : {}),
		...(p.escalationRules !== undefined ? { escalationRules: p.escalationRules } : {}),
		// waiverRules has been on the Edit payload since Inc 13 but was never applied here — the create side threaded
		// it, the edit side silently dropped it, so a policy's waivability could be set at birth but never revised.
		// Closing that pre-existing gap (adversarial review, Inc C).
		...(p.waiverRules !== undefined ? { waiverRules: p.waiverRules } : {}),
		...(p.permittedControlActions !== undefined
			? { permittedControlActions: p.permittedControlActions }
			: {})
	};
	const event = makeEvent(ctx, command, {
		eventType: 'AssurancePolicyEdited',
		aggregateType: POLICY,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: POLICY,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** SupersedeAssurancePolicy — retire a policy version (ACTIVE|SUSPENDED -> SUPERSEDED) when a successor replaces
 *  it. The successor id (if given) is recorded as a `superseded-by:<id>` tag. Floor policies reject. */
export const supersedeAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as SupersedeAssurancePolicyPayload;
	return advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUPERSEDED',
		eventType: 'AssurancePolicySuperseded',
		guard: rejectIfFloorLocked(command),
		mutate: p.supersededByPolicyId
			? (base) => ({
					...base,
					tags: [
						...(Array.isArray(base.tags) ? (base.tags as unknown[]) : []),
						`superseded-by:${p.supersededByPolicyId}`
					]
				})
			: undefined
	});
};

/** SuspendAssurancePolicy — temporarily disable a policy (ACTIVE -> SUSPENDED). Floor policies reject. */
export const suspendAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'SUSPENDED',
		eventType: 'AssurancePolicySuspended',
		guard: rejectIfFloorLocked(command)
	});

/** ActivateAssurancePolicy — put a policy into force (DRAFT|SUSPENDED -> ACTIVE). */
export const activateAssurancePolicy: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: POLICY,
		statusField: 'status',
		machine: 'AssurancePolicy.status',
		target: 'ACTIVE',
		eventType: 'AssurancePolicyActivated',
		guard: rejectIfFloorLocked(command)
	});

// ---- Evidence ----
const EVIDENCE = 'EVIDENCE';

/** ProposeEvidence — create Evidence in PROPOSED. */
export const proposeEvidence: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeEvidencePayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, EVIDENCE, p.evidenceId, { lifecycleStatus: 'PROPOSED' }),
		evidenceType: p.evidenceType,
		contentReference: p.contentReference,
		producedBy: p.producedBy,
		supportsClaimIds: p.supportsClaimIds,
		contradictsClaimIds: p.contradictsClaimIds,
		scope: p.scope,
		limitations: p.limitations,
		capturedAt: p.capturedAt,
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: EVIDENCE,
		aggregateId: p.evidenceId,
		state,
		eventType: 'EvidenceProposed',
		// The event records the RESULTING state. EvidenceProposed declares the evidence + the created `status`
		// (PROPOSED); the raw command payload omits `status`. Emit the declared shape — the required evidence fields
		// (contentReference passes through as-is) + status, plus the optional claim links / limitations when
		// supplied (absent = not specified, never a fabricated empty). (Pinned defect; now conforms.)
		eventPayload: {
			evidenceType: p.evidenceType,
			contentReference: p.contentReference,
			producedBy: p.producedBy,
			scope: p.scope,
			capturedAt: p.capturedAt,
			status: 'PROPOSED',
			...(p.supportsClaimIds?.length ? { supportsClaimIds: p.supportsClaimIds } : {}),
			...(p.contradictsClaimIds?.length ? { contradictsClaimIds: p.contradictsClaimIds } : {}),
			...(p.limitations?.length ? { limitations: p.limitations } : {})
		}
	});
};

/**
 * AdmitEvidence — PROPOSED -> ADMISSIBLE, and ONLY if the Evidence is admissible.
 *
 * This was a bare status advance: admission was a label anyone could apply to anything. §8.11 L1027 makes
 * admissibility a precondition, and the kernel has evaluated it correctly all along —
 * `evidenceAdmissibility` (rph-assurance) implements all 8 conditions and is unit-proven. Nothing called it.
 * The gap was never the rule; it was the wiring.
 *
 * `sufficientlyCurrent` and `claimId` are deliberately NOT passed: freshness needs a policy-supplied horizon
 * and relevance needs the target Claim, and neither is on this Command. Passing a guess would re-create the
 * defect this fixes. The 6 conditions the accepted contract can answer are enforced; the 2 it cannot are left
 * to the floor, which has the policy context.
 */
export const admitEvidence: CommandHandler = (ctx, command, payload) => {
	const p = payload as AdmitEvidencePayload;
	return advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'ADMISSIBLE',
		eventType: 'EvidenceAdmitted',
		// §14.3 EvidenceAdmittedPayload — was the raw AdmitEvidence command payload (admissibilityAssessmentId /
		// admittedScope / admittedClaimIds, which §14.3 does want, verbatim). Delta: + evidenceId (the target
		// aggregate id), + status ('ADMISSIBLE' — the transition this handler just proved legal and admissible).
		eventPayload: () => ({
			evidenceId: command.targetAggregateId,
			status: 'ADMISSIBLE',
			admissibilityAssessmentId: p.admissibilityAssessmentId,
			admittedScope: p.admittedScope,
			admittedClaimIds: p.admittedClaimIds
		}),
		guard: (state) => {
			const verdict = evidenceAdmissibility({
				id: String(state.id ?? ''),
				provenance: state.provenance,
				contentReference: state.contentReference,
				scope: state.scope as string | undefined,
				limitations: state.limitations as readonly string[] | undefined,
				status: state.status as string | undefined,
				supportsClaimIds: state.supportsClaimIds as readonly string[] | undefined
			});
			return verdict.admissible
				? null
				: reject(
						command,
						'RPH_VALIDATION_SEMANTIC_FAILED',
						`AdmitEvidence blocked: ${command.targetAggregateId} is inadmissible (§8.11) — failed ${verdict.failed.join(', ')}.`,
						[command.targetAggregateId]
					);
		}
	});
};

/** InvalidateEvidence — ADMISSIBLE -> INVALIDATED (P4: dependent claims are re-contested by the controller). */
export const invalidateEvidence: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'INVALIDATED',
		eventType: 'EvidenceInvalidated'
	});

// ---- Claim ----
const CLAIM = 'CLAIM';

/** AssertClaim — create a Claim in OPEN (the claim id is the command's target aggregate id). */
export const assertClaim: CommandHandler = (ctx, command, payload) => {
	const p = payload as AssertClaimPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, CLAIM, id, { lifecycleStatus: 'OPEN' }),
		statement: p.statement,
		claimType: p.claimType,
		assertedBy: command.issuedBy,
		subjectObjectIds: p.subjectObjectIds,
		supportingEvidenceIds: p.supportingEvidenceIds ?? [],
		contradictingEvidenceIds: p.contradictingEvidenceIds ?? [],
		status: 'OPEN'
	};
	// §13.1 ClaimAssertedPayload — was the raw AssertClaim command payload. Delta: + claimId (the command's target
	// aggregate id — the command carries the claim id in the envelope, not the payload), + assertedBy
	// (command.issuedBy, the same value the state records), + status ('OPEN'); - supportingEvidenceIds /
	// - contradictingEvidenceIds (accepted by the command, not defined by §13.1 — a strictObject rejects them as
	// extra keys; they persist on the object state, which is where the claim's evidence links live).
	return createObject(ctx, command, {
		objectType: CLAIM,
		aggregateId: id,
		state,
		eventType: 'ClaimAsserted',
		eventPayload: {
			claimId: id,
			statement: p.statement,
			claimType: p.claimType,
			subjectObjectIds: p.subjectObjectIds,
			assertedBy: command.issuedBy,
			status: 'OPEN'
		}
	});
};

// ---- Assumption ----
const ASSUMPTION = 'ASSUMPTION';

/** DetectAssumption — create a first-class Assumption in PROPOSED (a material assumption must not stay in prose). */
export const detectAssumption: CommandHandler = (ctx, command, payload) => {
	const p = payload as DetectAssumptionPayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSUMPTION, p.assumptionId, {
			lifecycleStatus: 'PROPOSED',
			originType: 'MODEL_GENERATION'
		}),
		statement: p.statement,
		...(p.basis ? { basis: p.basis } : {}),
		introducedBy: p.introducedBy,
		affectedObjectIds: p.affectedObjectIds,
		materiality: p.materiality,
		status: 'PROPOSED'
	};
	// §12.2 AssumptionDetectedPayload — was the raw DetectAssumption command payload, which carries every §12.2
	// field EXCEPT `status`. Delta: + status only; the other eight are the command's, 1:1.
	//
	// The value is the object's own (PROPOSED), not §12.2's literal `status: 'DISCLOSED'`. §12.2 writes that
	// literal, but this command creates the Assumption in PROPOSED and the generated schema is the
	// AssumptionStatus enum, not a literal — so PROPOSED satisfies it. This is the DOC-007-§12.2-vs-DOC-002-§26.3
	// VALUE DRIFT already recorded in the vocab (DOC-002 makes DISCLOSED a separate AssumptionDisclosed
	// transition). Emitting 'DISCLOSED' would make the event contradict the object it describes; the event reports
	// the status the object actually has. Resolving the drift is a vocab act, not a handler one.
	return createObject(ctx, command, {
		objectType: ASSUMPTION,
		aggregateId: p.assumptionId,
		state,
		eventType: 'AssumptionDetected',
		eventPayload: {
			assumptionId: p.assumptionId,
			statement: p.statement,
			...(p.basis ? { basis: p.basis } : {}),
			introducedBy: p.introducedBy,
			affectedObjectIds: p.affectedObjectIds,
			materiality: p.materiality,
			status: state.status,
			...(p.sourceArtifactId ? { sourceArtifactId: p.sourceArtifactId } : {}),
			...(p.sourceExecutionAttemptId
				? { sourceExecutionAttemptId: p.sourceExecutionAttemptId }
				: {})
		}
	});
};

// ---- Assurance Assessment ----
const ASSESSMENT = 'ASSURANCE_ASSESSMENT';
const DISPOSITIONS = new Set([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED'
]);

/** RequestAssuranceAssessment — create an assessment already in ASSESSING (request-and-begin; the evidence-
 * pending/ready prep states are a deeper increment — see RESUME-STATE). */
export const requestAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as RequestAssuranceAssessmentPayload;
	// FAIL CLOSED on policy governance state (independence follow-up B + the DOC-002 §18 lifecycle). The assessment's
	// policy is what defines its criteria AND its independenceRequirement; the I2 independence gate skips silently
	// when the cited policy id does not resolve. Before this, the handler stored assurancePolicyId blindly, so an
	// assessment could cite a phantom policy — assessing against nothing, and disarming the independence check by
	// making its requirement unresolvable. And a policy governs an assessment only while IN FORCE: the §18 machine is
	// DRAFT -> ACTIVE -> (SUSPENDED) -> SUPERSEDED, so a new assessment must cite an ACTIVE policy — not a DRAFT one
	// (not yet activated), a SUSPENDED one (out of force), or a SUPERSEDED version (a new assessment pins the current
	// version, §18). Two distinct rejections so the audit says which.
	const policy = ctx.store.loadObject(p.assurancePolicyId)?.state as
		{ status?: string; requiredEvidence?: Array<{ id?: string }> } | undefined;
	if (!policy) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestAssuranceAssessment: assurance policy ${p.assurancePolicyId} does not exist — an assessment cannot be requested against a policy that was never created (its criteria and independence requirement are unresolvable).`,
			[p.assessmentId, p.assurancePolicyId]
		);
	}
	if (policy.status !== 'ACTIVE') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RequestAssuranceAssessment: assurance policy ${p.assurancePolicyId} is ${String(policy.status)}, not ACTIVE — a policy governs an assessment only while in force (DOC-002 §18). Activate it (or cite the current active version) before assessing against it.`,
			[p.assessmentId, p.assurancePolicyId]
		);
	}
	// §38 "missing evidence" is sourced here. The policy's requiredEvidence (DOC-004 §6.1) names the required
	// evidence-requirement ids; resolved from the (now loaded) policy and carried on the Started EVENT so the read
	// model can report what this assessment requires — NOT on the command payload (the operator does not choose it,
	// the policy does), and NOT on the object state (the ASSURANCE_ASSESSMENT schema does not carry it; the event is
	// the fold's source). Empty when the policy requires no evidence = a real sourced "none", not "unknown". The
	// per-requirement SATISFACTION side (§32 submitEvidenceForAssessment -> AssuranceEvidenceReceived) is a separate
	// increment; until it lands, the read model reports the full required set as missing (DOC-004 §31 L1770).
	const requiredEvidenceIds = (policy.requiredEvidence ?? [])
		.map((r) => r?.id)
		.filter((id): id is string => typeof id === 'string');
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSESSMENT, p.assessmentId, {
			lifecycleStatus: 'ASSESSING',
			sourceObjectIds: p.subjectObjectIds
		}),
		assurancePolicyId: p.assurancePolicyId,
		policyVersion: p.policyVersion,
		policySemanticVersion: 1,
		subjectObjectIds: p.subjectObjectIds,
		subjectSemanticVersions: p.subjectSemanticVersions,
		claimIds: p.claimIds,
		evidenceConsideredIds: [],
		rejectedEvidence: [],
		observationIds: [],
		startedAt: command.issuedAt,
		assessmentState: 'ASSESSING',
		residualUncertainty: [],
		recommendedControlActions: []
	};
	return createObject(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: p.assessmentId,
		state,
		eventType: 'AssuranceAssessmentStarted',
		eventPayload: { ...p, requiredEvidenceIds }
	});
};

/** SubmitEvidenceForAssessment (DOC-004 §32) — the SATISFACTION side of "missing evidence". Records that an
 *  Evidence object satisfying one of the assessment's declared EvidenceRequirements (§6.1) was received, emitting
 *  AssuranceEvidenceReceived (§31). The §38 view folds `missingEvidence = requiredEvidenceIds` (from the Started
 *  event, Increment K) MINUS the requirement ids received here — so it flips from "the whole required set" to a
 *  faithful required-minus-received. Ratified NAMES, AUTHORED schema (§31 L1770: "ratified names here but
 *  schematized nowhere ... a schema-and-wiring task, NOT a ratification decision"). The received fact lives on the
 *  EVENT, not the assessment snapshot — symmetric with requiredEvidenceIds living on AssuranceAssessmentStarted,
 *  and the read model is the fold's consumer. */
export const submitEvidenceForAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as SubmitEvidenceForAssessmentPayload;
	const id = command.targetAggregateId; // the assessment aggregate
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	// Evidence may only be submitted while the assessment is OPEN. requestAssuranceAssessment creates it in
	// ASSESSING and completeAssuranceAssessment moves it to a terminal disposition; recording evidence against a
	// completed assessment would silently shrink its "missing" set after the verdict was already reached.
	const assessmentState = loaded.state.assessmentState;
	if (assessmentState !== 'ASSESSING') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SubmitEvidenceForAssessment: assessment ${id} is ${String(assessmentState)}, not ASSESSING — evidence may only be submitted while the assessment is open.`,
			[id]
		);
	}
	// A submission must satisfy a requirement the assessment's policy actually DECLARES (§6.1). The required set is
	// EvidenceRequirement ids while evidenceId is an Evidence OBJECT id — different namespaces, so the binding is
	// explicit (satisfiesRequirementId), never inferred from proximity. Fail closed when the requirement is not
	// declared: otherwise "missing evidence" could be reduced by evidence that satisfies nothing the policy asked
	// for. (This is exactly the namespace subtlety Increment K flagged as why this was not a trivial fold.)
	const policyId = loaded.state.assurancePolicyId as string | undefined;
	const policy = policyId
		? (ctx.store.loadObject(policyId)?.state as { requiredEvidence?: Array<{ id?: string }> } | undefined)
		: undefined;
	const declared = new Set(
		(policy?.requiredEvidence ?? [])
			.map((r) => r?.id)
			.filter((x): x is string => typeof x === 'string')
	);
	if (!declared.has(p.satisfiesRequirementId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SubmitEvidenceForAssessment: '${p.satisfiesRequirementId}' is not an evidence requirement the assessment's policy declares (DOC-004 §6.1) — evidence can only be submitted against a declared requirement.`,
			[id, p.satisfiesRequirementId]
		);
	}
	const newRevision = loaded.revision + 1;
	// The assessment SNAPSHOT is unchanged beyond the envelope bump — the received-evidence fact lives on the EVENT.
	const next = nextEnvelope(loaded.state, command, newRevision);
	const event = makeEvent(ctx, command, {
		eventType: 'AssuranceEvidenceReceived',
		aggregateType: ASSESSMENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: {
			assessmentId: id,
			evidenceId: p.evidenceId,
			satisfiesRequirementId: p.satisfiesRequirementId,
			...(p.evidenceType !== undefined ? { evidenceType: p.evidenceType } : {})
		}
	});
	return commitState(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** The reverse of record-assurance.ts's `identityToActorReference`: map the ratified wire `ActorReference` back
 *  onto the assurance-island `Identity` that `checkIndependence` reasons over. Symmetric with the forward seam —
 *  `actorId`↔`agentId`, `modelId`, `providerId`, `executionInstanceId`↔`invocationId`, `actorType`.
 *  `contextInstanceId`/`orgId` have no `ActorReference` source and stay undefined; an independence dimension keyed on
 *  one of those is then unprovable from a bare `ActorReference`, which `differs()` treats as NOT independent — a
 *  fail-closed absence, never a fabricated pass. */
function actorReferenceToIdentity(a: ActorReference): Identity {
	return {
		agentId: a.actorId,
		...(a.modelId ? { modelId: a.modelId } : {}),
		...(a.providerId ? { providerId: a.providerId } : {}),
		...(a.executionInstanceId ? { invocationId: a.executionInstanceId } : {}),
		actorType: a.actorType
	};
}

/** CompleteAssuranceAssessment — ASSESSING -> a terminal disposition read from the validator recommendation
 * (validatorResult.dispositionRecommendation). The AssuranceAssessment.state machine rejects the illegal
 * disposition transitions (INV-8/INV-9/INV-10). */
export const completeAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as {
		validatorResult?: {
			validatorId?: string;
			validatorVersion?: string;
			dispositionRecommendation?: string;
			subjectObjectIds?: string[];
			subjectSemanticVersions?: Record<string, number>;
			evidenceConsideredIds?: string[];
			residualUncertainty?: string[];
			recommendedControlActions?: Record<string, unknown>[];
			executionProvenance?: { evaluator?: ActorReference };
		};
		/** Increment I2: the identity that PRODUCED the subject, for the independence check against the evaluator. */
		producer?: ActorReference;
	};
	const disposition = p.validatorResult?.dispositionRecommendation;
	if (!disposition || !DISPOSITIONS.has(disposition)) {
		return reject(
			command,
			'RPH_VALIDATOR_OUTPUT_INVALID',
			`CompleteAssuranceAssessment requires validatorResult.dispositionRecommendation in ${[...DISPOSITIONS].join('|')}`
		);
	}
	// DOC-004 INVARIANT 2 — "Every assessment identifies its subject semantic version." THE SCHEMA CANNOT SAY
	// THIS. `subjectSemanticVersions: Record<string, number>` is satisfied by `{}`, so a verdict that names a
	// subject and no version for it is schema-valid and meaningless: nothing downstream can tell whether the
	// judgement still applies to the object as it now stands. Found by mutation — emptying the record left the
	// §20 strictObject perfectly happy and every test green, which is precisely the class of hole this whole
	// effort exists to close. A shape check is not an invariant check.
	//
	// §13.3: "Fail closed on missing identity, tenant, policy, schema, or authority context."
	const subjectIds = p.validatorResult?.subjectObjectIds ?? [];
	const versions = p.validatorResult?.subjectSemanticVersions ?? {};
	const unversioned = subjectIds.filter((id) => typeof versions[id] !== 'number');
	if (unversioned.length > 0) {
		return reject(
			command,
			'RPH_VALIDATOR_OUTPUT_INVALID',
			`CompleteAssuranceAssessment: validatorResult.subjectSemanticVersions must name a version for every subject (DOC-004 invariant 2 — "Every assessment identifies its subject semantic version"). Missing: ${unversioned.join(', ')}`,
			unversioned
		);
	}
	// Record WHO judged. The Assessment object has always carried an optional `evaluator: ActorReference`; the
	// completion path simply never wrote it, so the model/provider that actually reviewed the artifact was
	// persisted nowhere (§9.7 "resolved provider/model/version actually invoked"; §8.4 L851 "actual identities and
	// lineage are recorded"). Validated against the ratified schema at the aggregate boundary like any field.
	//
	// IT MOVED, from `validatorResult.evaluator` to `validatorResult.executionProvenance.evaluator`, because
	// DOC-007 §20 has no `evaluator` field — the old path only type-checked while ValidatorResultSchema was
	// `z.record(z.string(), z.unknown())`, and a §20 strictObject rejects it outright. `executionProvenance` is
	// where §9.7's "resolved provider/model/version actually invoked" belongs.
	//
	// AND THIS IS STILL NOT THE RATIFIED HOME. DOC-004 §32 ratifies `selectAssuranceEvaluator` as its own
	// command — choosing the evaluator is a governed act, not a rider on the verdict. That command does not exist
	// in this codebase (nor do §32's `recordCriterionResult`, `submitEvidenceForAssessment`, or
	// `beginAssuranceAssessment` — 4 of §32's 13). Their absence is exactly why the evaluator was smuggled
	// through the verdict and why criterion results and evidence are dropped at the boundary: the commands that
	// own those facts were never built. Surfaced in HARMONIZATION-LOG PART 4, not fixed here.
	const evaluator = p.validatorResult?.executionProvenance?.evaluator;

	// INDEPENDENCE (Increment I2). §39 invariant 8 ("Required independence must be verified"), §8.4, §20.2: a
	// required independence must be verified before an assessment may be satisfied. `checkIndependence` is the kernel
	// rule (@janumipwb/rph-assurance), called here the same way `admitEvidence` calls `evidenceAdmissibility` — the
	// rule, invoked, not a copy of it. On a real violation the assessment does NOT complete to a disposition; it
	// transitions ASSESSING -> INDEPENDENCE_VIOLATION (the ratified §30 arrow, which INV-8 forbids from ever reaching
	// SATISFIED), recording `AssuranceIndependenceViolated`.
	//
	// GATED, and honest about the gate. The check runs only when the policy's requirement RESOLVES, is not `NONE`,
	// and BOTH operands are present. When it cannot — the policy id does not resolve (a known boundary hole:
	// `requestAssuranceAssessment` never checked policy existence either, so the standalone drive's floor assessments
	// cite absent policies), the requirement is `NONE`, or this caller did not supply the subject's producer (the
	// floor recording path does not yet) — the assessment proceeds WITHOUT a check rather than fabricate a pass or a
	// violation. Those paths leave independence unverified; recorded in HARMONIZATION-LOG, closed incrementally,
	// never papered over with a defaulted identity. The positive `AssuranceIndependenceVerified` signal is Increment I4.
	const producer = p.producer;
	const assessmentState = ctx.store.loadObject(command.targetAggregateId)?.state as
		{ assurancePolicyId?: string } | undefined;
	const independenceRequirement = assessmentState?.assurancePolicyId
		? (
				ctx.store.loadObject(assessmentState.assurancePolicyId)?.state as
					{ independenceRequirement?: string } | undefined
			)?.independenceRequirement
		: undefined;
	// 'VERIFIED' only when the check RAN and PASSED; left undefined when it did not run (see the gate note above) so
	// the §38 view reads that as "unknown", never a fabricated pass. The negative branch returns early below.
	let independenceResult: string | undefined;
	if (independenceRequirement && independenceRequirement !== 'NONE' && producer && evaluator) {
		const verdict = checkIndependence(
			independenceRequirement as IndependenceRequirement,
			actorReferenceToIdentity(producer),
			actorReferenceToIdentity(evaluator)
		);
		if (!verdict.independent) {
			return advanceStatus(ctx, command, {
				objectType: ASSESSMENT,
				statusField: 'assessmentState',
				machine: 'AssuranceAssessment.state',
				target: 'INDEPENDENCE_VIOLATION',
				eventType: 'AssuranceIndependenceViolated',
				setLifecycleStatus: true,
				eventPayload: (next) => ({
					assessmentId: command.targetAggregateId,
					assurancePolicyId: next.assurancePolicyId,
					policyVersion: next.policyVersion,
					subjectObjectIds: subjectIds,
					subjectSemanticVersions: versions,
					independenceRequirement,
					reason: verdict.reason ?? 'required independence not satisfied'
				}),
				// Record BOTH identities the check compared (contract-drift fix): an INV-8 violation whose object
				// state names neither operand cannot answer "producer X vs evaluator Y" — the very pair that failed.
				// The violation path previously wrote neither; both are recorded now.
				mutate: (base) => ({
					...base,
					completedAt: command.issuedAt,
					...(producer ? { producer } : {}),
					...(evaluator ? { evaluator } : {})
				})
			});
		}
		independenceResult = 'VERIFIED';
	}

	return advanceStatus(ctx, command, {
		objectType: ASSESSMENT,
		statusField: 'assessmentState',
		machine: 'AssuranceAssessment.state',
		target: disposition,
		eventType: 'AssuranceAssessmentCompleted',
		setLifecycleStatus: true,
		// §19.3 AssuranceAssessmentCompletedPayload — was the raw CompleteAssuranceAssessment command payload,
		// i.e. `{ validatorResult }`: a single key §19.3 does not define, and NINE of its ten fields absent. The
		// verdict — what was judged, at which version, and how it came out — was never in the event; the audit log
		// recorded the validator's raw return and nothing about the assessment it completed. Delta: + assessmentId,
		// + assurancePolicyId, + policyVersion, + subjectObjectIds, + subjectSemanticVersions, + disposition,
		// + evidenceConsideredIds, + observationIds, + residualUncertainty, + recommendedControlActions;
		// - validatorResult (not a §19.3 field; a strictObject rejects it).
		//
		// Identity + policy come from the aggregate (`next`); subjects + versions from the validatorResult the
		// invariant-2 gate above just proved complete; disposition is the transition target.
		//
		// evidenceConsideredIds / residualUncertainty / recommendedControlActions are read from the validatorResult
		// and NOT from the object, which reports [] for all three: requestAssuranceAssessment hardcodes them empty
		// and no completion path ever writes them (the §32 commands that own those facts do not exist — see the
		// evaluator note above). So the object's [] is silence, not a finding of "none". The validator's values are
		// the real ones, they are on the validated command, and §19.3 asks the event for exactly them — emitting []
		// would put a known-false record in the audit log. The event therefore carries more than the object does;
		// reconciling the object is the §32 increment, not this one.
		//
		// WHO/WHAT VALIDATED (Increment 37). validatorId + validatorVersion are the §20 ValidatorResult's
		// "validator implementation identity" — WHICH validator, at WHICH version, produced this verdict. §38
		// REQUIRES the Assurance View to show it and §22 REQUIRES the audit log to record "validator/version" for
		// every validator call, yet §19.3's first-slice payload (§16 item 6) omitted it, so the completion event
		// recorded the outcome and erased the author of it. The value is REQUIRED on the §20 ValidatorResult the
		// command boundary already validated, so it is threaded through, never invented; the `?? ''` is an
		// unreachable TS guard (a rejected command never reaches here).
		//
		// INDEPENDENCE RESULT (Increment I4). `independenceResult: 'VERIFIED'` rides the completion when the check
		// above RAN and PASSED — the §22 "independence result" the audit log requires and the §38 view's "independence
		// status" source. It is a PROPERTY of this completion, not a state change (the violation IS a state change, so
		// it earns its own AssuranceIndependenceViolated event + INDEPENDENCE_VIOLATION state instead). Spread only
		// when set: an unverified completion omits it, and the view reads absence as "unknown", never a fabricated pass.
		eventPayload: (next) => ({
			assessmentId: command.targetAggregateId,
			assurancePolicyId: next.assurancePolicyId,
			policyVersion: next.policyVersion,
			subjectObjectIds: subjectIds,
			subjectSemanticVersions: versions,
			disposition,
			evidenceConsideredIds: p.validatorResult?.evidenceConsideredIds ?? [],
			observationIds: next.observationIds ?? [],
			residualUncertainty: p.validatorResult?.residualUncertainty ?? [],
			recommendedControlActions: p.validatorResult?.recommendedControlActions ?? [],
			validatorId: p.validatorResult?.validatorId ?? '',
			validatorVersion: p.validatorResult?.validatorVersion ?? '',
			...(independenceResult ? { independenceResult } : {})
		}),
		mutate: (base) => ({
			...base,
			completedAt: command.issuedAt,
			...(evaluator ? { evaluator } : {}),
			// producer: the INV-8 counterparty checkIndependence compared evaluator against. Contract-drift fix —
			// it was read to compute independenceResult then discarded; now recorded beside evaluator so a VERIFIED
			// completion names both operands of the independence determination, not just its outcome.
			...(producer ? { producer } : {})
		})
	});
};

// ---- Assurance Observation ----
const OBSERVATION = 'ASSURANCE_OBSERVATION';

/** RecordAssuranceObservation — create an observation in OPEN, linked to its assessment (inherits policy +
 * subjects from the assessment). */
export const recordAssuranceObservation: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordAssuranceObservationPayload;
	const id = command.targetAggregateId;
	const assessment = ctx.store.loadObject(p.assessmentId)?.state as
		{ assurancePolicyId?: string; subjectObjectIds?: string[] } | undefined;
	if (!assessment) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`RecordAssuranceObservation requires an existing assessment ${p.assessmentId}`,
			[id]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, OBSERVATION, id, { lifecycleStatus: 'OPEN' }),
		assessmentId: p.assessmentId,
		policyId: assessment.assurancePolicyId ?? p.assessmentId,
		subjectObjectIds: assessment.subjectObjectIds ?? [],
		findingCode: p.findingCode ?? p.observationType,
		observationType: p.observationType,
		severity: p.severity,
		statement: p.statement,
		implication: p.statement,
		evidenceIds: p.evidenceIds ?? [],
		disposition: 'OPEN'
	};
	// §21.1 AssuranceObservationRecordedPayload — was the raw RecordAssuranceObservation command payload, which
	// defines neither the observation's id nor the policy/subjects it is against. Delta: + observationId (target
	// aggregate id), + policyId / + subjectObjectIds (inherited from the assessment, exactly as the state does),
	// + implication, + disposition ('OPEN'); findingCode and evidenceIds are optional on the command but REQUIRED
	// by §21.1, so both carry the state's resolved value (findingCode defaults to observationType, evidenceIds to
	// []); - observationType (on the command, undefined by §21.1 — a strictObject rejects it; DOC-002 §26.5 is the
	// variant that keeps it, and the object state does too).
	//
	// Every value is read off `state`, so the event reports the object as persisted. That includes `implication`,
	// which the object sets to a copy of `statement` — §21.1 wants the observation's consequence and no command
	// field carries one. That placeholder is pre-existing object state and out of scope here; the event inherits
	// it rather than inventing a second, differently-wrong value.
	return createObject(ctx, command, {
		objectType: OBSERVATION,
		aggregateId: id,
		state,
		eventType: 'AssuranceObservationRecorded',
		eventPayload: {
			observationId: id,
			assessmentId: p.assessmentId,
			policyId: state.policyId,
			subjectObjectIds: state.subjectObjectIds,
			findingCode: state.findingCode,
			severity: p.severity,
			statement: p.statement,
			implication: state.implication,
			evidenceIds: state.evidenceIds,
			disposition: 'OPEN'
		}
	});
};
