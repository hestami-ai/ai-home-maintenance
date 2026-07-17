// Assurance-side handlers: Evidence (propose/admit/invalidate), Claim (assert), Assumption (detect), Assurance
// Assessment (request/complete), Assurance Observation (record). The exec≠assurance separation (INV-5) is upheld
// structurally — nothing here is driven by executionState; a satisfied assessment is a separate, explicit act
// whose disposition comes from the validator recommendation and is gated by the AssuranceAssessment.state machine
// (which makes VALIDATOR_FAILED→REJECTED and INDEPENDENCE_VIOLATION→SATISFIED illegal). Evidence admissibility
// (§8.11) is enforced at AdmitEvidence by @janumipwb/rph-assurance's evidenceAdmissibility — the kernel rule,
// called, not a copy of it. Validator-independence scoring still lives there uncalled; that is the next increment.
import { evidenceAdmissibility } from '@janumipwb/rph-assurance';
import type {
	ActorReference,
	AssertClaimPayload,
	CreateAssurancePolicyPayload,
	DetectAssumptionPayload,
	DomainCommand,
	EditAssurancePolicyPayload,
	ProposeEvidencePayload,
	RecordAssuranceObservationPayload,
	RequestAssuranceAssessmentPayload,
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

/** CreateAssurancePolicy — create a versioned ASSURANCE_POLICY object in ACTIVE (guide §8.9). The de minimis floor
 *  policies (§8.4) are seeded through this. The rich rule arrays are §16.23-unresolved shapes, filled empty; the
 *  meaningful content is criteria + independence + finding definitions. The enum-typed fields
 *  (applicableObjectTypes / evaluatedClaimTypes / permittedControlActions) are validated by the object schema. */
export const createAssurancePolicy: CommandHandler = (ctx, command, payload) => {
	const p = payload as CreateAssurancePolicyPayload;
	const state: Record<string, unknown> = {
		...newEnvelope(command, POLICY, p.policyId, {
			lifecycleStatus: 'ACTIVE',
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
		requiredEvidence: [],
		optionalEvidence: [],
		criteria: p.criteria,
		evaluatorRole: p.evaluatorRole,
		independenceRequirement: p.independenceRequirement,
		findingDefinitions: p.findingDefinitions,
		// SEVEN of AssurancePolicyDefinition's ratified rule arrays are REQUIRED by the object schema and carried
		// by NO command or event, so they are hardcoded empty here. That is not laziness — until 2026-07-16 the
		// wire had no field to put them in, exactly like ARTIFACT's outputArtifactIds (Increment 10a): the object
		// demands it, nothing can set it, so a constant fills the hole. The consequence is that a seeded policy
		// can declare NONE of the rules that make it a policy — what makes it SATISFIED vs REJECTED
		// (dispositionRules, DOC-004 §10.2), when it escalates (§13), what evidence it needs (§6.1).
		//
		// `waiverRules` is now settable (DOC-004 §12.1 transcribed; the payload field authored under the grant),
		// so it is persisted rather than blanked — a policy can finally declare whether it may be waived at all.
		// The other six remain unreachable, measured and surfaced in AUDIT-placeholder-helpers.md, not fixed here.
		dispositionRules: [],
		remediationRules: [],
		escalationRules: [],
		waiverRules: p.waiverRules ?? [],
		permittedControlActions: p.permittedControlActions,
		status: 'ACTIVE'
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
		eventType: 'EvidenceProposed'
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
export const admitEvidence: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: EVIDENCE,
		statusField: 'status',
		machine: 'Evidence.status',
		target: 'ADMISSIBLE',
		eventType: 'EvidenceAdmitted',
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
	return createObject(ctx, command, {
		objectType: CLAIM,
		aggregateId: id,
		state,
		eventType: 'ClaimAsserted'
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
	return createObject(ctx, command, {
		objectType: ASSUMPTION,
		aggregateId: p.assumptionId,
		state,
		eventType: 'AssumptionDetected'
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
		eventType: 'AssuranceAssessmentStarted'
	});
};

/** CompleteAssuranceAssessment — ASSESSING -> a terminal disposition read from the validator recommendation
 * (validatorResult.dispositionRecommendation). The AssuranceAssessment.state machine rejects the illegal
 * disposition transitions (INV-8/INV-9/INV-10). */
export const completeAssuranceAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as {
		validatorResult?: {
			dispositionRecommendation?: string;
			subjectObjectIds?: string[];
			subjectSemanticVersions?: Record<string, number>;
			executionProvenance?: { evaluator?: ActorReference };
		};
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
	return advanceStatus(ctx, command, {
		objectType: ASSESSMENT,
		statusField: 'assessmentState',
		machine: 'AssuranceAssessment.state',
		target: disposition,
		eventType: 'AssuranceAssessmentCompleted',
		setLifecycleStatus: true,
		mutate: (base) => ({
			...base,
			completedAt: command.issuedAt,
			...(evaluator ? { evaluator } : {})
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
	return createObject(ctx, command, {
		objectType: OBSERVATION,
		aggregateId: id,
		state,
		eventType: 'AssuranceObservationRecorded'
	});
};
