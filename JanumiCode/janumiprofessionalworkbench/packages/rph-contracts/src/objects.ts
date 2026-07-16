// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:objects`.
// Source: vocab/m1-object-fields.json (grounded from DOC-002/007). See gen/gen-objects.ts.
import { z } from 'zod';
import { objectEnvelopeShape, ActorReferenceSchema } from './envelopes.js';
import {
	AssumptionStatusSchema,
	AssuranceAssessmentStateSchema,
	AssurancePolicyStatusSchema,
	AssuranceSeveritySchema,
	AssuranceStateSchema,
	AuthorityTypeSchema,
	AuthorizationStatusSchema,
	BaselineStatusSchema,
	BaselineTypeSchema,
	CardinalityCodeSchema,
	ClaimStatusSchema,
	ClaimTypeSchema,
	ConstraintStatusSchema,
	ConstraintStrengthSchema,
	ConstraintTypeSchema,
	ControlActionSchema,
	CoverageTypeSchema,
	CriterionResultOutcomeSchema,
	DecisionStatusSchema,
	DecisionTypeSchema,
	DecompositionContractStatusSchema,
	EvidenceStatusSchema,
	EvidenceTypeSchema,
	ExecutionPlanStatusSchema,
	ExecutionStateSchema,
	IndependenceRequirementSchema,
	IntentStatusSchema,
	MaterialitySchema,
	ObligationStatusSchema,
	ObligationStrengthSchema,
	ObligationTypeSchema,
	ObservationDispositionSchema,
	ObservationTypeSchema,
	ProfessionalWorkObjectTypeSchema,
	RecompositionContractStatusSchema,
	RiskConsequenceSchema,
	RiskIrreversibilitySchema,
	RiskRegulatoryExposureSchema,
	RiskSecuritySensitivitySchema,
	RiskUncertaintySchema,
	ShapeIntegrityStateSchema,
	StepStateSchema,
	StepTypeSchema,
	TraceRelationSchema,
	WorkLifecycleStateSchema
} from './enums.js';

// ---- Helper sub-types the specs reference but never fully define. Permissive structured
// placeholders (any object) — tightened in the milestone that defines them (M7/M9/M11). ----
export const ApplicabilityExpressionSchema = z.record(z.string(), z.unknown());
export type ApplicabilityExpression = z.infer<typeof ApplicabilityExpressionSchema>;
export const ApplicabilityRuleSchema = z.record(z.string(), z.unknown());
export type ApplicabilityRule = z.infer<typeof ApplicabilityRuleSchema>;
export const ArtifactReferenceSchema = z.record(z.string(), z.unknown());
export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;
export const ArtifactRequirementSchema = z.record(z.string(), z.unknown());
export type ArtifactRequirement = z.infer<typeof ArtifactRequirementSchema>;
export const AssessmentCriterionSchema = z.record(z.string(), z.unknown());
export type AssessmentCriterion = z.infer<typeof AssessmentCriterionSchema>;
export const CapabilityGrantSchema = z.record(z.string(), z.unknown());
export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;
export const CapabilityRequestSchema = z.record(z.string(), z.unknown());
export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>;
export const ClaimAssessmentResultSchema = z.record(z.string(), z.unknown());
export type ClaimAssessmentResult = z.infer<typeof ClaimAssessmentResultSchema>;
export const ClaimTemplateSchema = z.record(z.string(), z.unknown());
export type ClaimTemplate = z.infer<typeof ClaimTemplateSchema>;
export const ConditionSchema = z.record(z.string(), z.unknown());
export type Condition = z.infer<typeof ConditionSchema>;
export const ConfidenceAssessmentSchema = z.record(z.string(), z.unknown());
export type ConfidenceAssessment = z.infer<typeof ConfidenceAssessmentSchema>;
export const ControlActionRecommendationSchema = z.record(z.string(), z.unknown());
export type ControlActionRecommendation = z.infer<typeof ControlActionRecommendationSchema>;
export const DesiredOutcomeSchema = z.record(z.string(), z.unknown());
export type DesiredOutcome = z.infer<typeof DesiredOutcomeSchema>;
export const DispositionRuleSchema = z.record(z.string(), z.unknown());
export type DispositionRule = z.infer<typeof DispositionRuleSchema>;
export const EscalationPolicySchema = z.record(z.string(), z.unknown());
export type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;
export const EscalationRuleSchema = z.record(z.string(), z.unknown());
export type EscalationRule = z.infer<typeof EscalationRuleSchema>;
export const EvidenceRequirementSchema = z.record(z.string(), z.unknown());
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;
export const ExecutionProvenanceSchema = z.record(z.string(), z.unknown());
export type ExecutionProvenance = z.infer<typeof ExecutionProvenanceSchema>;
export const ExecutionTransitionSchema = z.record(z.string(), z.unknown());
export type ExecutionTransition = z.infer<typeof ExecutionTransitionSchema>;
export const FindingDefinitionSchema = z.record(z.string(), z.unknown());
export type FindingDefinition = z.infer<typeof FindingDefinitionSchema>;
export const InputBindingSchema = z.record(z.string(), z.unknown());
export type InputBinding = z.infer<typeof InputBindingSchema>;
export const ModelSelectionPolicySchema = z.record(z.string(), z.unknown());
export type ModelSelectionPolicy = z.infer<typeof ModelSelectionPolicySchema>;
export const OutputBindingSchema = z.record(z.string(), z.unknown());
export type OutputBinding = z.infer<typeof OutputBindingSchema>;
export const OutputDefinitionSchema = z.record(z.string(), z.unknown());
export type OutputDefinition = z.infer<typeof OutputDefinitionSchema>;
export const ProposedAssuranceObservationSchema = z.record(z.string(), z.unknown());
export type ProposedAssuranceObservation = z.infer<typeof ProposedAssuranceObservationSchema>;
export const RejectedEvidenceReferenceSchema = z.record(z.string(), z.unknown());
export type RejectedEvidenceReference = z.infer<typeof RejectedEvidenceReferenceSchema>;
export const RemediationRuleSchema = z.record(z.string(), z.unknown());
export type RemediationRule = z.infer<typeof RemediationRuleSchema>;
export const RetryPolicySchema = z.record(z.string(), z.unknown());
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export const SandboxPolicySchema = z.record(z.string(), z.unknown());
export type SandboxPolicy = z.infer<typeof SandboxPolicySchema>;
export const SuccessConditionSchema = z.record(z.string(), z.unknown());
export type SuccessCondition = z.infer<typeof SuccessConditionSchema>;
export const TacticalChangePolicySchema = z.record(z.string(), z.unknown());
export type TacticalChangePolicy = z.infer<typeof TacticalChangePolicySchema>;
export const TerminationPolicySchema = z.record(z.string(), z.unknown());
export type TerminationPolicy = z.infer<typeof TerminationPolicySchema>;
export const ValidatorResultSchema = z.record(z.string(), z.unknown());
export type ValidatorResult = z.infer<typeof ValidatorResultSchema>;
export const WaiverRuleSchema = z.record(z.string(), z.unknown());
export type WaiverRule = z.infer<typeof WaiverRuleSchema>;

// ---- Well-specified helper sub-types. ----
export const AggregationRuleSchema = z.strictObject({
	rule: z.string()
});
export type AggregationRule = z.infer<typeof AggregationRuleSchema>;
export const AssumptionPropagationSchema = z.strictObject({
	assumptionId: z.string(),
	childWorkUnitIds: z.array(z.string()),
	rationale: z.string().optional()
});
export type AssumptionPropagation = z.infer<typeof AssumptionPropagationSchema>;
export const AuthorityReferenceSchema = z.strictObject({
	authorityId: z.string(),
	authorityType: AuthorityTypeSchema,
	grantedBy: z.string().optional(),
	scope: z.array(z.string()),
	validFrom: z.string(),
	validUntil: z.string().optional()
});
export type AuthorityReference = z.infer<typeof AuthorityReferenceSchema>;
export const BaselineItemVersionSchema = z.strictObject({
	objectId: z.string(),
	semanticVersion: z.number(),
	contentHash: z.string().optional()
});
export type BaselineItemVersion = z.infer<typeof BaselineItemVersionSchema>;
export const ConflictResolutionRuleSchema = z.strictObject({
	conflictType: z.string(),
	action: z.string()
});
export type ConflictResolutionRule = z.infer<typeof ConflictResolutionRuleSchema>;
export const ConstraintPropagationSchema = z.strictObject({
	constraintId: z.string(),
	childWorkUnitIds: z.array(z.string()),
	disposition: z
		.enum(['PROPAGATED', 'RETAINED', 'INAPPLICABLE', 'WAIVED', 'SUPERSEDED'])
		.optional(),
	rationale: z.string().optional(),
	authorityDecisionId: z.string().optional(),
	supersededByConstraintId: z.string().optional()
});
export type ConstraintPropagation = z.infer<typeof ConstraintPropagationSchema>;
export const ConversationEntrySchema = z.strictObject({
	role: z.string(),
	kind: z.string(),
	text: z.string(),
	success: z.boolean().optional()
});
export type ConversationEntry = z.infer<typeof ConversationEntrySchema>;
export const CoverageClaimSchema = z.strictObject({
	claimId: z.string(),
	parentObligationIds: z.array(z.string()),
	childWorkUnitIds: z.array(z.string()),
	coverageType: CoverageTypeSchema,
	rationale: z.string()
});
export type CoverageClaim = z.infer<typeof CoverageClaimSchema>;
export const CriterionResultSchema = z.strictObject({
	criterionId: z.string(),
	result: CriterionResultOutcomeSchema,
	rationale: z.string(),
	evidenceIds: z.array(z.string())
});
export type CriterionResult = z.infer<typeof CriterionResultSchema>;
export const ExecutionStepSchema = z.strictObject({
	id: z.string(),
	executionPlanId: z.string(),
	stepType: StepTypeSchema,
	purpose: z.string(),
	inputBindings: z.array(InputBindingSchema),
	outputBindings: z.array(OutputBindingSchema),
	runtimeBindingId: z.string().optional(),
	preconditions: z.array(ConditionSchema),
	postconditions: z.array(ConditionSchema),
	stepState: StepStateSchema
});
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;
export const IntentMappingSchema = z.strictObject({
	childWorkUnitId: z.string(),
	servesParentIntentOrObligationId: z.string(),
	rationale: z.string().optional()
});
export type IntentMapping = z.infer<typeof IntentMappingSchema>;
export const ObligationAllocationSchema = z.strictObject({
	obligationId: z.string(),
	allocatedTo: z.array(z.string())
});
export type ObligationAllocation = z.infer<typeof ObligationAllocationSchema>;
export const PermittedChildRuleSchema = z.strictObject({
	typeId: z.string(),
	cardinality: CardinalityCodeSchema,
	applicabilityNote: z.string().optional()
});
export type PermittedChildRule = z.infer<typeof PermittedChildRuleSchema>;
export const TraceLinkSchema = z.strictObject({
	id: z.string(),
	sourceObjectId: z.string(),
	sourceSemanticVersion: z.number().optional(),
	targetObjectId: z.string(),
	targetSemanticVersion: z.number().optional(),
	relation: TraceRelationSchema,
	rationale: z.string().optional(),
	createdAt: z.string(),
	createdBy: ActorReferenceSchema
});
export type TraceLink = z.infer<typeof TraceLinkSchema>;
export const WaiverDetailSchema = z.strictObject({
	waivedPolicyId: z.string(),
	waivedCriterionId: z.string(),
	waivedFindingIds: z.array(z.string()),
	expiresAt: z.string().optional(),
	compensatingControls: z.array(z.string()),
	downstreamImpactObjectIds: z.array(z.string()),
	reviewConditions: z.array(z.string())
});
export type WaiverDetail = z.infer<typeof WaiverDetailSchema>;
export const WorkBoundarySchema = z.strictObject({
	inScope: z.array(z.string()),
	outOfScope: z.array(z.string()),
	permittedChanges: z.array(z.string()),
	prohibitedChanges: z.array(z.string())
});
export type WorkBoundary = z.infer<typeof WorkBoundarySchema>;
export const WorkRiskProfileSchema = z.strictObject({
	consequence: RiskConsequenceSchema,
	uncertainty: RiskUncertaintySchema,
	irreversibility: RiskIrreversibilitySchema,
	securitySensitivity: RiskSecuritySensitivitySchema,
	regulatoryExposure: RiskRegulatoryExposureSchema
});
export type WorkRiskProfile = z.infer<typeof WorkRiskProfileSchema>;

// ---- The 17 Professional Work Object schemas (each composes objectEnvelopeShape). ----
/** INTENT — id prefix: INTENT */
export const IntentObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	originatingExpression: z.string(),
	formalizedObjective: z.string().optional(),
	desiredOutcomes: z.array(DesiredOutcomeSchema),
	successConditions: z.array(SuccessConditionSchema),
	nonGoals: z.array(z.string()),
	ambiguityIds: z.array(z.string()),
	constraintIds: z.array(z.string()),
	stakeholderIds: z.array(z.string()),
	parentIntentId: z.string().optional(),
	supersedesIntentId: z.string().optional(),
	intentStatus: IntentStatusSchema
});
export type IntentObject = z.infer<typeof IntentObjectSchema>;

/** PROFESSIONAL_WORK_UNIT — id prefix: PROFESSIONAL_WORK_UNIT */
export const ProfessionalWorkUnitSchema = z.strictObject({
	...objectEnvelopeShape,
	pwuKind: z.string(),
	title: z.string(),
	description: z.string(),
	intentId: z.string(),
	parentWorkUnitId: z.string().optional(),
	boundaries: WorkBoundarySchema,
	obligationIds: z.array(z.string()),
	constraintIds: z.array(z.string()),
	assumptionIds: z.array(z.string()),
	dependencyIds: z.array(z.string()),
	inputRequirements: z.array(ArtifactRequirementSchema),
	expectedOutputs: z.array(OutputDefinitionSchema),
	evidenceRequirementIds: z.array(z.string()),
	verificationCriterionIds: z.array(z.string()),
	decompositionContractId: z.string().optional(),
	recompositionContractId: z.string().optional(),
	activeExecutionPlanId: z.string().optional(),
	assurancePolicyIds: z.array(z.string()),
	workLifecycleState: WorkLifecycleStateSchema,
	executionState: ExecutionStateSchema,
	assuranceState: AssuranceStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema,
	riskProfile: WorkRiskProfileSchema,
	currentBaselineId: z.string().optional(),
	undertakingId: z.string().optional(),
	pwuTypeId: z.string().optional(),
	isLocalExtension: z.boolean().optional()
});
export type ProfessionalWorkUnit = z.infer<typeof ProfessionalWorkUnitSchema>;

/** OBLIGATION — id prefix: OBLIGATION */
export const ObligationObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	statement: z.string(),
	obligationType: ObligationTypeSchema,
	sourceObjectId: z.string(),
	authority: AuthorityReferenceSchema,
	strength: ObligationStrengthSchema,
	status: ObligationStatusSchema
});
export type ObligationObject = z.infer<typeof ObligationObjectSchema>;

/** CONSTRAINT — id prefix: CONSTRAINT */
export const ConstraintObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	statement: z.string(),
	constraintType: ConstraintTypeSchema,
	authority: AuthorityReferenceSchema,
	applicability: ApplicabilityRuleSchema,
	strength: ConstraintStrengthSchema,
	status: ConstraintStatusSchema
});
export type ConstraintObject = z.infer<typeof ConstraintObjectSchema>;

/** ASSUMPTION — id prefix: ASSUMPTION */
export const AssumptionObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	statement: z.string(),
	basis: z.string().optional(),
	introducedBy: ActorReferenceSchema,
	affectedObjectIds: z.array(z.string()),
	materiality: MaterialitySchema,
	verificationMethod: z.string().optional(),
	expirationCondition: z.string().optional(),
	status: AssumptionStatusSchema
});
export type AssumptionObject = z.infer<typeof AssumptionObjectSchema>;

/** CLAIM — id prefix: CLAIM */
export const ClaimObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	statement: z.string(),
	claimType: ClaimTypeSchema,
	assertedBy: ActorReferenceSchema,
	subjectObjectIds: z.array(z.string()),
	supportingEvidenceIds: z.array(z.string()),
	contradictingEvidenceIds: z.array(z.string()),
	status: ClaimStatusSchema
});
export type ClaimObject = z.infer<typeof ClaimObjectSchema>;

/** EVIDENCE — id prefix: EVIDENCE */
export const EvidenceObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	evidenceType: EvidenceTypeSchema,
	contentReference: ArtifactReferenceSchema,
	producedBy: ActorReferenceSchema,
	supportsClaimIds: z.array(z.string()),
	contradictsClaimIds: z.array(z.string()),
	scope: z.string(),
	limitations: z.array(z.string()),
	capturedAt: z.string(),
	validFrom: z.string().optional(),
	validUntil: z.string().optional(),
	status: EvidenceStatusSchema
});
export type EvidenceObject = z.infer<typeof EvidenceObjectSchema>;

/** ASSURANCE_POLICY — id prefix: ASSURANCE_POLICY */
export const AssurancePolicyDefinitionSchema = z.strictObject({
	...objectEnvelopeShape,
	id: z.string(),
	version: z.string(),
	semanticVersion: z.number(),
	name: z.string(),
	purpose: z.string(),
	rationale: z.string(),
	applicableObjectTypes: ProfessionalWorkObjectTypeSchema,
	applicability: ApplicabilityExpressionSchema,
	evaluatedClaimTypes: ClaimTypeSchema,
	defaultClaimTemplates: z.array(ClaimTemplateSchema),
	requiredEvidence: z.array(EvidenceRequirementSchema),
	optionalEvidence: z.array(EvidenceRequirementSchema),
	criteria: z.array(AssessmentCriterionSchema),
	evaluatorRole: z.string(),
	independenceRequirement: IndependenceRequirementSchema,
	findingDefinitions: z.array(FindingDefinitionSchema),
	dispositionRules: z.array(DispositionRuleSchema),
	permittedControlActions: ControlActionSchema,
	remediationRules: z.array(RemediationRuleSchema),
	escalationRules: z.array(EscalationRuleSchema),
	waiverRules: z.array(WaiverRuleSchema),
	status: AssurancePolicyStatusSchema
});
export type AssurancePolicyDefinition = z.infer<typeof AssurancePolicyDefinitionSchema>;

/** ASSURANCE_ASSESSMENT — id prefix: ASSURANCE_ASSESSMENT */
export const AssuranceAssessmentSchema = z.strictObject({
	...objectEnvelopeShape,
	assurancePolicyId: z.string(),
	policyVersion: z.string(),
	policySemanticVersion: z.number(),
	subjectObjectIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number()),
	claimIds: z.array(z.string()),
	evaluator: ActorReferenceSchema.optional(),
	evidenceConsideredIds: z.array(z.string()),
	rejectedEvidence: z.array(RejectedEvidenceReferenceSchema),
	observationIds: z.array(z.string()),
	startedAt: z.string(),
	completedAt: z.string().optional(),
	assessmentState: AssuranceAssessmentStateSchema,
	confidence: ConfidenceAssessmentSchema.optional(),
	residualUncertainty: z.array(z.string()),
	recommendedControlActions: z.array(ControlActionRecommendationSchema)
});
export type AssuranceAssessment = z.infer<typeof AssuranceAssessmentSchema>;

/** ASSURANCE_OBSERVATION — id prefix: ASSURANCE_OBSERVATION */
export const AssuranceObservationSchema = z.strictObject({
	...objectEnvelopeShape,
	assessmentId: z.string(),
	policyId: z.string(),
	criterionId: z.string().optional(),
	subjectObjectIds: z.array(z.string()),
	findingCode: z.string(),
	observationType: ObservationTypeSchema,
	severity: AssuranceSeveritySchema,
	statement: z.string(),
	implication: z.string(),
	evidenceIds: z.array(z.string()),
	disposition: ObservationDispositionSchema
});
export type AssuranceObservation = z.infer<typeof AssuranceObservationSchema>;

/** DECISION — id prefix: DECISION */
export const DecisionObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	decisionType: DecisionTypeSchema,
	subjectObjectIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number()),
	selectedOption: z.string(),
	rationale: z.string(),
	authority: ActorReferenceSchema,
	consideredEvidenceIds: z.array(z.string()),
	consideredObservationIds: z.array(z.string()),
	effectiveAt: z.string().optional(),
	status: DecisionStatusSchema,
	waiver: WaiverDetailSchema.optional()
});
export type DecisionObject = z.infer<typeof DecisionObjectSchema>;

/** ARTIFACT — id prefix: ARTIFACT */
export const ArtifactObjectSchema = z.strictObject({ ...objectEnvelopeShape });
export type ArtifactObject = z.infer<typeof ArtifactObjectSchema>;

/** DECOMPOSITION_CONTRACT — id prefix: DECOMPOSITION_CONTRACT */
export const DecompositionContractSchema = z.strictObject({
	...objectEnvelopeShape,
	parentWorkUnitId: z.string(),
	childWorkUnitIds: z.array(z.string()),
	rationale: z.string(),
	intentMappings: z.array(IntentMappingSchema),
	obligationAllocations: z.array(ObligationAllocationSchema),
	constraintPropagations: z.array(ConstraintPropagationSchema),
	assumptionPropagations: z.array(AssumptionPropagationSchema),
	retainedParentObligationIds: z.array(z.string()),
	coverageClaims: z.array(CoverageClaimSchema),
	siblingDependencyIds: z.array(z.string()),
	recompositionContractId: z.string(),
	status: DecompositionContractStatusSchema
});
export type DecompositionContract = z.infer<typeof DecompositionContractSchema>;

/** RECOMPOSITION_CONTRACT — id prefix: RECOMPOSITION_CONTRACT */
export const RecompositionContractSchema = z.strictObject({
	...objectEnvelopeShape,
	parentWorkUnitId: z.string(),
	requiredChildWorkUnitIds: z.array(z.string()),
	aggregationRules: z.array(AggregationRuleSchema),
	conflictResolutionRules: z.array(ConflictResolutionRuleSchema),
	parentCompletionClaimId: z.string(),
	status: RecompositionContractStatusSchema
});
export type RecompositionContract = z.infer<typeof RecompositionContractSchema>;

/** EXECUTION_PLAN — id prefix: EXECUTION_PLAN */
export const ExecutionPlanSchema = z.strictObject({
	...objectEnvelopeShape,
	workUnitId: z.string(),
	planVersion: z.number(),
	steps: z.array(ExecutionStepSchema),
	transitions: z.array(ExecutionTransitionSchema),
	retryPolicy: RetryPolicySchema,
	tacticalChangePolicy: TacticalChangePolicySchema,
	escalationPolicy: EscalationPolicySchema,
	terminationPolicy: TerminationPolicySchema,
	status: ExecutionPlanStatusSchema
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

/** RUNTIME_BINDING — id prefix: RUNTIME_BINDING */
export const RuntimeBindingSchema = z.strictObject({
	...objectEnvelopeShape,
	executionStepId: z.string(),
	roleId: z.string(),
	modelSelectionPolicy: ModelSelectionPolicySchema,
	requestedCapabilities: z.array(CapabilityRequestSchema),
	grantedCapabilities: z.array(CapabilityGrantSchema),
	sandboxPolicy: SandboxPolicySchema,
	contextAssemblyPolicyId: z.string(),
	observabilityPolicyId: z.string(),
	memoryPolicyId: z.string().optional(),
	authorizationStatus: AuthorizationStatusSchema
});
export type RuntimeBinding = z.infer<typeof RuntimeBindingSchema>;

/** BASELINE — id prefix: BASELINE */
export const BaselineObjectSchema = z.strictObject({
	...objectEnvelopeShape,
	baselineType: BaselineTypeSchema,
	purpose: z.string(),
	scope: z.string(),
	itemObjectVersions: z.array(BaselineItemVersionSchema),
	assuranceAssessmentIds: z.array(z.string()),
	promotionDecisionId: z.string(),
	status: BaselineStatusSchema
});
export type BaselineObject = z.infer<typeof BaselineObjectSchema>;

/** PROFESSIONAL_WORK_ARCHITECTURE — id prefix: pwa */
export const ProfessionalWorkArchitectureSchema = z.strictObject({
	...objectEnvelopeShape,
	name: z.string(),
	description: z.string(),
	domain: z.string(),
	version: z.string(),
	rootPwuTypeId: z.string().optional(),
	pwuTypeIds: z.array(z.string()),
	assurancePolicyIds: z.array(z.string()),
	baselineTypeIds: z.array(z.string()),
	roleIds: z.array(z.string()),
	executionStrategyIds: z.array(z.string()),
	conformanceFixtureIds: z.array(z.string()),
	publicationStatus: z.enum([
		'DRAFT',
		'UNDER_REVIEW',
		'VALIDATED',
		'PUBLISHED',
		'DEPRECATED',
		'RETIRED',
		'DISCARDED'
	])
});
export type ProfessionalWorkArchitecture = z.infer<typeof ProfessionalWorkArchitectureSchema>;

/** PWU_TYPE — id prefix: pwut */
export const PwuTypeSchema = z.strictObject({
	...objectEnvelopeShape,
	pwaId: z.string(),
	pwuKind: z.string(),
	name: z.string(),
	purpose: z.string(),
	isRoot: z.boolean(),
	permittedParentTypeIds: z.array(z.string()),
	permittedChildTypeIds: z.array(z.string()),
	permittedChildren: z.array(PermittedChildRuleSchema).optional(),
	requiredInputs: z.array(z.string()),
	requiredOutputs: z.array(z.string()),
	requiredAssurancePolicyIds: z.array(z.string()),
	completionRule: z.string(),
	status: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED', 'REMOVED'])
});
export type PwuType = z.infer<typeof PwuTypeSchema>;

/** UNDERTAKING — id prefix: und */
export const UndertakingSchema = z.strictObject({
	...objectEnvelopeShape,
	name: z.string(),
	description: z.string(),
	pwaId: z.string(),
	pwaVersion: z.string(),
	instantiationProfile: z.string(),
	objective: z.string(),
	intendedOutputProduct: z.string(),
	rootWorkUnitId: z.string().optional(),
	status: z.enum(['ACTIVE', 'MIGRATING', 'ARCHIVED'])
});
export type Undertaking = z.infer<typeof UndertakingSchema>;

/** AUTHORING_CONVERSATION — id prefix: conv */
export const AuthoringConversationSchema = z.strictObject({
	...objectEnvelopeShape,
	pwaId: z.string(),
	entries: z.array(ConversationEntrySchema)
});
export type AuthoringConversation = z.infer<typeof AuthoringConversationSchema>;

/** Registry: objectType literal -> { schema, idPrefixEntity, tsName }. */
export const OBJECT_SCHEMAS = {
	INTENT: { schema: IntentObjectSchema, idPrefixEntity: 'INTENT', tsName: 'IntentObject' },
	PROFESSIONAL_WORK_UNIT: {
		schema: ProfessionalWorkUnitSchema,
		idPrefixEntity: 'PROFESSIONAL_WORK_UNIT',
		tsName: 'ProfessionalWorkUnit'
	},
	OBLIGATION: {
		schema: ObligationObjectSchema,
		idPrefixEntity: 'OBLIGATION',
		tsName: 'ObligationObject'
	},
	CONSTRAINT: {
		schema: ConstraintObjectSchema,
		idPrefixEntity: 'CONSTRAINT',
		tsName: 'ConstraintObject'
	},
	ASSUMPTION: {
		schema: AssumptionObjectSchema,
		idPrefixEntity: 'ASSUMPTION',
		tsName: 'AssumptionObject'
	},
	CLAIM: { schema: ClaimObjectSchema, idPrefixEntity: 'CLAIM', tsName: 'ClaimObject' },
	EVIDENCE: { schema: EvidenceObjectSchema, idPrefixEntity: 'EVIDENCE', tsName: 'EvidenceObject' },
	ASSURANCE_POLICY: {
		schema: AssurancePolicyDefinitionSchema,
		idPrefixEntity: 'ASSURANCE_POLICY',
		tsName: 'AssurancePolicyDefinition'
	},
	ASSURANCE_ASSESSMENT: {
		schema: AssuranceAssessmentSchema,
		idPrefixEntity: 'ASSURANCE_ASSESSMENT',
		tsName: 'AssuranceAssessment'
	},
	ASSURANCE_OBSERVATION: {
		schema: AssuranceObservationSchema,
		idPrefixEntity: 'ASSURANCE_OBSERVATION',
		tsName: 'AssuranceObservation'
	},
	DECISION: { schema: DecisionObjectSchema, idPrefixEntity: 'DECISION', tsName: 'DecisionObject' },
	ARTIFACT: { schema: ArtifactObjectSchema, idPrefixEntity: 'ARTIFACT', tsName: 'ArtifactObject' },
	DECOMPOSITION_CONTRACT: {
		schema: DecompositionContractSchema,
		idPrefixEntity: 'DECOMPOSITION_CONTRACT',
		tsName: 'DecompositionContract'
	},
	RECOMPOSITION_CONTRACT: {
		schema: RecompositionContractSchema,
		idPrefixEntity: 'RECOMPOSITION_CONTRACT',
		tsName: 'RecompositionContract'
	},
	EXECUTION_PLAN: {
		schema: ExecutionPlanSchema,
		idPrefixEntity: 'EXECUTION_PLAN',
		tsName: 'ExecutionPlan'
	},
	RUNTIME_BINDING: {
		schema: RuntimeBindingSchema,
		idPrefixEntity: 'RUNTIME_BINDING',
		tsName: 'RuntimeBinding'
	},
	BASELINE: { schema: BaselineObjectSchema, idPrefixEntity: 'BASELINE', tsName: 'BaselineObject' },
	PROFESSIONAL_WORK_ARCHITECTURE: {
		schema: ProfessionalWorkArchitectureSchema,
		idPrefixEntity: 'pwa',
		tsName: 'ProfessionalWorkArchitecture'
	},
	PWU_TYPE: { schema: PwuTypeSchema, idPrefixEntity: 'pwut', tsName: 'PwuType' },
	UNDERTAKING: { schema: UndertakingSchema, idPrefixEntity: 'und', tsName: 'Undertaking' },
	AUTHORING_CONVERSATION: {
		schema: AuthoringConversationSchema,
		idPrefixEntity: 'conv',
		tsName: 'AuthoringConversation'
	}
} as const;
