// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:messages`.
// Source: vocab/m3-commands-events.json (grounded from DOC-007 + DOC-002, reconciled). See gen/gen-messages.ts.
import { z } from 'zod';
import {
	AssumptionStatusSchema,
	AssuranceDispositionSchema,
	AssuranceStateSchema,
	AuthorizationStatusSchema,
	BaselineStatusSchema,
	BaselineTypeSchema,
	ClaimStatusSchema,
	ClaimTypeSchema,
	ConstraintStatusSchema,
	ConstraintStrengthSchema,
	ConstraintTypeSchema,
	DecisionStatusSchema,
	DecisionTypeSchema,
	DecompositionContractStatusSchema,
	EvidenceStatusSchema,
	EvidenceTypeSchema,
	ExecutionPlanStatusSchema,
	ExecutionStateSchema,
	IntentStatusSchema,
	MaterialitySchema,
	ObligationStatusSchema,
	ObservationDispositionSchema,
	ObservationTypeSchema,
	RecompositionContractStatusSchema,
	ShapeIntegrityStateSchema,
	StepStateSchema,
	WorkLifecycleStateSchema
} from './enums.js';

// ---- Command payload schemas ----
export const CaptureIntentPayloadSchema = z.strictObject({
	intentId: z.string(),
	originatingExpression: z.string(),
	ontologyId: z.string(),
	ontologyVersion: z.string()
});
export type CaptureIntentPayload = z.infer<typeof CaptureIntentPayloadSchema>;
export const FormalizeIntentPayloadSchema = z.strictObject({
	formalizedObjective: z.string(),
	desiredOutcomes: z.array(z.unknown()),
	successConditions: z.array(z.unknown()),
	nonGoals: z.array(z.string()),
	ambiguityIds: z.array(z.string()),
	constraintIds: z.array(z.string()),
	stakeholderIds: z.array(z.string())
});
export type FormalizeIntentPayload = z.infer<typeof FormalizeIntentPayloadSchema>;
export const ApproveIntentPayloadSchema = z.strictObject({
	decisionId: z.string(),
	approvedSemanticVersion: z.number(),
	approvalScope: z.string()
});
export type ApproveIntentPayload = z.infer<typeof ApproveIntentPayloadSchema>;
export const ProposePwuPayloadSchema = z.strictObject({
	pwuId: z.string(),
	pwuKind: z.string(),
	title: z.string(),
	description: z.string(),
	intentId: z.string(),
	parentWorkUnitId: z.string().optional(),
	boundaries: z.unknown(),
	obligationIds: z.array(z.string()),
	constraintIds: z.array(z.string()),
	assumptionIds: z.array(z.string()),
	expectedOutputs: z.array(z.unknown()),
	assurancePolicyIds: z.array(z.string()),
	riskProfile: z.unknown(),
	undertakingId: z.string().optional(),
	pwuTypeId: z.string().optional(),
	isLocalExtension: z.boolean().optional()
});
export type ProposePwuPayload = z.infer<typeof ProposePwuPayloadSchema>;
export const MarkPwuReadyPayloadSchema = z.strictObject({
	shapeReadinessAssessmentId: z.string(),
	expectedSemanticVersion: z.number()
});
export type MarkPwuReadyPayload = z.infer<typeof MarkPwuReadyPayloadSchema>;
export const ProposeExecutionPlanPayloadSchema = z.strictObject({
	executionPlanId: z.string(),
	workUnitId: z.string(),
	steps: z.array(z.unknown()),
	transitions: z.array(z.unknown()),
	retryPolicy: z.unknown(),
	tacticalChangePolicy: z.unknown(),
	escalationPolicy: z.unknown(),
	terminationPolicy: z.unknown()
});
export type ProposeExecutionPlanPayload = z.infer<typeof ProposeExecutionPlanPayloadSchema>;
export const ActivateExecutionPlanPayloadSchema = z.strictObject({
	approvalDecisionId: z.string().optional(),
	authorizedRuntimeBindingIds: z.array(z.string())
});
export type ActivateExecutionPlanPayload = z.infer<typeof ActivateExecutionPlanPayloadSchema>;
export const CompleteExecutionStepPayloadSchema = z.strictObject({
	executionStepId: z.string(),
	executionAttemptId: z.string(),
	resultStatus: z.literal('SUCCEEDED'),
	outputArtifactIds: z.array(z.string()),
	proposedEvidenceIds: z.array(z.string()),
	detectedAssumptionIds: z.array(z.string()),
	structuredResult: z.unknown(),
	executionProvenance: z.unknown()
});
export type CompleteExecutionStepPayload = z.infer<typeof CompleteExecutionStepPayloadSchema>;
export const ProposeEvidencePayloadSchema = z.strictObject({
	evidenceId: z.string(),
	evidenceType: EvidenceTypeSchema,
	contentReference: z.unknown(),
	producedBy: z.unknown(),
	supportsClaimIds: z.array(z.string()),
	contradictsClaimIds: z.array(z.string()),
	scope: z.string(),
	limitations: z.array(z.string()),
	capturedAt: z.string()
});
export type ProposeEvidencePayload = z.infer<typeof ProposeEvidencePayloadSchema>;
export const AdmitEvidencePayloadSchema = z.strictObject({
	admissibilityAssessmentId: z.string(),
	admittedScope: z.string(),
	admittedClaimIds: z.array(z.string())
});
export type AdmitEvidencePayload = z.infer<typeof AdmitEvidencePayloadSchema>;
export const RequestAssuranceAssessmentPayloadSchema = z.strictObject({
	assessmentId: z.string(),
	assurancePolicyId: z.string(),
	policyVersion: z.string(),
	subjectObjectIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number()),
	claimIds: z.array(z.string())
});
export type RequestAssuranceAssessmentPayload = z.infer<
	typeof RequestAssuranceAssessmentPayloadSchema
>;
export const CompleteAssuranceAssessmentPayloadSchema = z.strictObject({
	validatorResult: z.unknown()
});
export type CompleteAssuranceAssessmentPayload = z.infer<
	typeof CompleteAssuranceAssessmentPayloadSchema
>;
export const ApproveDecisionPayloadSchema = z.strictObject({
	selectedOption: z.string(),
	rationale: z.string(),
	consideredEvidenceIds: z.array(z.string()),
	consideredObservationIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number())
});
export type ApproveDecisionPayload = z.infer<typeof ApproveDecisionPayloadSchema>;
export const PromoteBaselinePayloadSchema = z.strictObject({
	promotionDecisionId: z.string(),
	expectedItemObjectVersions: z.array(
		z.strictObject({
			objectId: z.string(),
			semanticVersion: z.number(),
			contentHash: z.string().optional()
		})
	),
	requiredAssessmentIds: z.array(z.string())
});
export type PromoteBaselinePayload = z.infer<typeof PromoteBaselinePayloadSchema>;
export const BeginPwuShapingPayloadSchema = z.strictObject({});
export type BeginPwuShapingPayload = z.infer<typeof BeginPwuShapingPayloadSchema>;
export const ChangePwuStatePayloadSchema = z.strictObject({
	previousState: WorkLifecycleStateSchema,
	newState: WorkLifecycleStateSchema,
	executionState: ExecutionStateSchema,
	assuranceState: AssuranceStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema,
	reasonCode: z.string(),
	supportingObjectIds: z.array(z.string())
});
export type ChangePwuStatePayload = z.infer<typeof ChangePwuStatePayloadSchema>;
export const ApproveExecutionPlanPayloadSchema = z.strictObject({
	approvalDecisionId: z.string().optional()
});
export type ApproveExecutionPlanPayload = z.infer<typeof ApproveExecutionPlanPayloadSchema>;
export const StartExecutionStepPayloadSchema = z.strictObject({
	stepId: z.string()
});
export type StartExecutionStepPayload = z.infer<typeof StartExecutionStepPayloadSchema>;
export const FailExecutionStepPayloadSchema = z.strictObject({
	stepId: z.string(),
	failureReason: z.string(),
	failureClass: z.string().optional()
});
export type FailExecutionStepPayload = z.infer<typeof FailExecutionStepPayloadSchema>;
export const DetectAssumptionPayloadSchema = z.strictObject({
	assumptionId: z.string(),
	statement: z.string(),
	basis: z.string().optional(),
	introducedBy: z.unknown(),
	affectedObjectIds: z.array(z.string()),
	materiality: MaterialitySchema,
	sourceArtifactId: z.string().optional(),
	sourceExecutionAttemptId: z.string().optional()
});
export type DetectAssumptionPayload = z.infer<typeof DetectAssumptionPayloadSchema>;
export const AssertClaimPayloadSchema = z.strictObject({
	statement: z.string(),
	claimType: ClaimTypeSchema,
	subjectObjectIds: z.array(z.string()),
	supportingEvidenceIds: z.array(z.string()).optional(),
	contradictingEvidenceIds: z.array(z.string()).optional()
});
export type AssertClaimPayload = z.infer<typeof AssertClaimPayloadSchema>;
export const RecordAssuranceObservationPayloadSchema = z.strictObject({
	assessmentId: z.string(),
	observationType: ObservationTypeSchema,
	severity: z.string(),
	statement: z.string(),
	evidenceIds: z.array(z.string()).optional()
});
export type RecordAssuranceObservationPayload = z.infer<
	typeof RecordAssuranceObservationPayloadSchema
>;
export const ProposeDecisionPayloadSchema = z.strictObject({
	decisionType: DecisionTypeSchema,
	subjectObjectIds: z.array(z.string()),
	selectedOption: z.string(),
	rationale: z.string(),
	authority: z.unknown(),
	consideredEvidenceIds: z.array(z.string()).optional(),
	consideredObservationIds: z.array(z.string()).optional(),
	effectiveAt: z.string().optional()
});
export type ProposeDecisionPayload = z.infer<typeof ProposeDecisionPayloadSchema>;
export const CreateBaselinePayloadSchema = z.strictObject({
	baselineType: BaselineTypeSchema,
	itemObjectIds: z.array(z.string()),
	assuranceAssessmentIds: z.array(z.string()).optional()
});
export type CreateBaselinePayload = z.infer<typeof CreateBaselinePayloadSchema>;
export const ReviseIntentPayloadSchema = z.strictObject({
	changeRationale: z.string(),
	impactAnalysisId: z.string().optional()
});
export type ReviseIntentPayload = z.infer<typeof ReviseIntentPayloadSchema>;
export const ChallengePwuPayloadSchema = z.strictObject({
	challengeReason: z.string(),
	observationIds: z.array(z.string()).optional()
});
export type ChallengePwuPayload = z.infer<typeof ChallengePwuPayloadSchema>;
export const ReshapePwuPayloadSchema = z.strictObject({
	reason: z.string(),
	triggeringObjectId: z.string().optional()
});
export type ReshapePwuPayload = z.infer<typeof ReshapePwuPayloadSchema>;
export const InvalidatePwuPayloadSchema = z.strictObject({
	invalidationReason: z.string(),
	triggeringObjectId: z.string().optional()
});
export type InvalidatePwuPayload = z.infer<typeof InvalidatePwuPayloadSchema>;
export const SupersedePwuPayloadSchema = z.strictObject({
	supersedingWorkUnitId: z.string()
});
export type SupersedePwuPayload = z.infer<typeof SupersedePwuPayloadSchema>;
export const ProposeDecompositionPayloadSchema = z.strictObject({
	parentWorkUnitId: z.string(),
	childWorkUnitIds: z.array(z.string()),
	rationale: z.string(),
	intentMappings: z.array(z.unknown()).optional(),
	obligationAllocations: z.array(z.unknown()).optional(),
	constraintPropagations: z.array(z.unknown()).optional(),
	assumptionPropagations: z.array(z.unknown()).optional(),
	retainedParentObligationIds: z.array(z.string()).optional(),
	coverageClaims: z.array(z.unknown()).optional(),
	siblingDependencyIds: z.array(z.string()).optional(),
	recompositionContractId: z.string().optional()
});
export type ProposeDecompositionPayload = z.infer<typeof ProposeDecompositionPayloadSchema>;
export const ValidateDecompositionPayloadSchema = z.strictObject({
	disposition: z.string(),
	validatorRole: z.string().optional(),
	observationIds: z.array(z.string()).optional()
});
export type ValidateDecompositionPayload = z.infer<typeof ValidateDecompositionPayloadSchema>;
export const ReviseDecompositionPayloadSchema = z.strictObject({
	rationale: z.string(),
	childWorkUnitIds: z.array(z.string()).optional(),
	obligationAllocations: z.array(z.unknown()).optional(),
	constraintPropagations: z.array(z.unknown()).optional()
});
export type ReviseDecompositionPayload = z.infer<typeof ReviseDecompositionPayloadSchema>;
export const BeginRecompositionPayloadSchema = z.strictObject({
	recompositionContractId: z.string()
});
export type BeginRecompositionPayload = z.infer<typeof BeginRecompositionPayloadSchema>;
export const CompleteRecompositionPayloadSchema = z.strictObject({
	parentCompletionClaimId: z.string()
});
export type CompleteRecompositionPayload = z.infer<typeof CompleteRecompositionPayloadSchema>;
export const InvalidateEvidencePayloadSchema = z.strictObject({
	invalidationReason: z.string(),
	affectedClaimIds: z.array(z.string()).optional()
});
export type InvalidateEvidencePayload = z.infer<typeof InvalidateEvidencePayloadSchema>;
export const RequestWaiverPayloadSchema = z.strictObject({
	subjectObjectIds: z.array(z.string()),
	scope: z.string(),
	rationale: z.string(),
	duration: z.string(),
	affectedObjectIds: z.array(z.string())
});
export type RequestWaiverPayload = z.infer<typeof RequestWaiverPayloadSchema>;
export const GrantWaiverPayloadSchema = z.strictObject({
	waiverDecisionId: z.string(),
	effectiveAt: z.string(),
	duration: z.string()
});
export type GrantWaiverPayload = z.infer<typeof GrantWaiverPayloadSchema>;
export const DenyWaiverPayloadSchema = z.strictObject({
	rationale: z.string()
});
export type DenyWaiverPayload = z.infer<typeof DenyWaiverPayloadSchema>;
export const RetryExecutionStepPayloadSchema = z.strictObject({
	stepId: z.string(),
	retryReason: z.string().optional()
});
export type RetryExecutionStepPayload = z.infer<typeof RetryExecutionStepPayloadSchema>;
export const ApplyTacticalChangePayloadSchema = z.strictObject({
	stepId: z.string().optional(),
	changeType: z.string(),
	rationale: z.string(),
	authorizingPolicyId: z.string()
});
export type ApplyTacticalChangePayload = z.infer<typeof ApplyTacticalChangePayloadSchema>;
export const CancelExecutionPlanPayloadSchema = z.strictObject({
	reason: z.string()
});
export type CancelExecutionPlanPayload = z.infer<typeof CancelExecutionPlanPayloadSchema>;
export const RevokeDecisionPayloadSchema = z.strictObject({
	revocationRationale: z.string()
});
export type RevokeDecisionPayload = z.infer<typeof RevokeDecisionPayloadSchema>;
export const SupersedeBaselinePayloadSchema = z.strictObject({
	supersedingBaselineId: z.string()
});
export type SupersedeBaselinePayload = z.infer<typeof SupersedeBaselinePayloadSchema>;
export const BeginIntentDiscoveryPayloadSchema = z.strictObject({});
export type BeginIntentDiscoveryPayload = z.infer<typeof BeginIntentDiscoveryPayloadSchema>;
export const ProvisionIntentPayloadSchema = z.strictObject({
	ambiguityIds: z.array(z.string())
});
export type ProvisionIntentPayload = z.infer<typeof ProvisionIntentPayloadSchema>;
export const SubmitBaselineForReviewPayloadSchema = z.strictObject({});
export type SubmitBaselineForReviewPayload = z.infer<typeof SubmitBaselineForReviewPayloadSchema>;
export const ApproveBaselinePayloadSchema = z.strictObject({
	approvalDecisionId: z.string().optional()
});
export type ApproveBaselinePayload = z.infer<typeof ApproveBaselinePayloadSchema>;
export const RequestRuntimeBindingPayloadSchema = z.strictObject({
	runtimeBindingId: z.string(),
	executionStepId: z.string(),
	roleId: z.string(),
	requestedCapabilities: z.array(z.unknown())
});
export type RequestRuntimeBindingPayload = z.infer<typeof RequestRuntimeBindingPayloadSchema>;
export const AuthorizeRuntimeBindingPayloadSchema = z.strictObject({
	grantedCapabilities: z.array(z.unknown())
});
export type AuthorizeRuntimeBindingPayload = z.infer<typeof AuthorizeRuntimeBindingPayloadSchema>;
export const DenyRuntimeBindingPayloadSchema = z.strictObject({
	reason: z.string()
});
export type DenyRuntimeBindingPayload = z.infer<typeof DenyRuntimeBindingPayloadSchema>;
export const RevokeRuntimeCapabilityPayloadSchema = z.strictObject({
	reason: z.string()
});
export type RevokeRuntimeCapabilityPayload = z.infer<typeof RevokeRuntimeCapabilityPayloadSchema>;
export const CreatePwaPayloadSchema = z.strictObject({
	pwaId: z.string(),
	name: z.string(),
	description: z.string(),
	domain: z.string(),
	version: z.string()
});
export type CreatePwaPayload = z.infer<typeof CreatePwaPayloadSchema>;
export const DefinePwuTypePayloadSchema = z.strictObject({
	pwuTypeId: z.string(),
	pwaId: z.string(),
	pwuKind: z.string(),
	name: z.string(),
	purpose: z.string(),
	isRoot: z.boolean(),
	permittedParentTypeIds: z.array(z.string()).optional(),
	permittedChildTypeIds: z.array(z.string()).optional(),
	requiredAssurancePolicyIds: z.array(z.string()).optional(),
	completionRule: z.string().optional()
});
export type DefinePwuTypePayload = z.infer<typeof DefinePwuTypePayloadSchema>;
export const SubmitPwaForReviewPayloadSchema = z.strictObject({});
export type SubmitPwaForReviewPayload = z.infer<typeof SubmitPwaForReviewPayloadSchema>;
export const ValidatePwaPayloadSchema = z.strictObject({});
export type ValidatePwaPayload = z.infer<typeof ValidatePwaPayloadSchema>;
export const PublishPwaPayloadSchema = z.strictObject({
	rootPwuTypeId: z.string().optional()
});
export type PublishPwaPayload = z.infer<typeof PublishPwaPayloadSchema>;
export const DeprecatePwaPayloadSchema = z.strictObject({});
export type DeprecatePwaPayload = z.infer<typeof DeprecatePwaPayloadSchema>;
export const RetirePwaPayloadSchema = z.strictObject({});
export type RetirePwaPayload = z.infer<typeof RetirePwaPayloadSchema>;
export const CreateUndertakingPayloadSchema = z.strictObject({
	undertakingId: z.string(),
	name: z.string(),
	description: z.string(),
	pwaId: z.string(),
	pwaVersion: z.string(),
	instantiationProfile: z.string(),
	objective: z.string(),
	intendedOutputProduct: z.string()
});
export type CreateUndertakingPayload = z.infer<typeof CreateUndertakingPayloadSchema>;

// ---- Event payload schemas ----
export const AssumptionAcceptedPayloadSchema = z.strictObject({
	acceptanceDecisionId: z.string().optional(),
	status: AssumptionStatusSchema
});
export type AssumptionAcceptedPayload = z.infer<typeof AssumptionAcceptedPayloadSchema>;
export const AssumptionDetectedPayloadSchema = z.strictObject({
	assumptionId: z.string(),
	statement: z.string(),
	basis: z.string().optional(),
	introducedBy: z.unknown(),
	affectedObjectIds: z.array(z.string()),
	materiality: MaterialitySchema,
	status: AssumptionStatusSchema,
	sourceArtifactId: z.string().optional(),
	sourceExecutionAttemptId: z.string().optional()
});
export type AssumptionDetectedPayload = z.infer<typeof AssumptionDetectedPayloadSchema>;
export const AssumptionDisclosedPayloadSchema = z.strictObject({
	status: AssumptionStatusSchema
});
export type AssumptionDisclosedPayload = z.infer<typeof AssumptionDisclosedPayloadSchema>;
export const AssumptionExpiredPayloadSchema = z.strictObject({
	expirationCondition: z.string().optional(),
	status: AssumptionStatusSchema
});
export type AssumptionExpiredPayload = z.infer<typeof AssumptionExpiredPayloadSchema>;
export const AssumptionFalsifiedPayloadSchema = z.strictObject({
	assumptionId: z.string(),
	priorStatus: AssumptionStatusSchema,
	newStatus: AssumptionStatusSchema,
	contradictingEvidenceIds: z.array(z.string()),
	affectedObjectIds: z.array(z.string()),
	impactAnalysisRequired: z.literal(true)
});
export type AssumptionFalsifiedPayload = z.infer<typeof AssumptionFalsifiedPayloadSchema>;
export const AssumptionVerificationStartedPayloadSchema = z.strictObject({
	verificationMethod: z.string().optional(),
	status: AssumptionStatusSchema
});
export type AssumptionVerificationStartedPayload = z.infer<
	typeof AssumptionVerificationStartedPayloadSchema
>;
export const AssumptionVerifiedPayloadSchema = z.strictObject({
	evidenceIds: z.array(z.string()).optional(),
	status: AssumptionStatusSchema
});
export type AssumptionVerifiedPayload = z.infer<typeof AssumptionVerifiedPayloadSchema>;
export const AssuranceAssessmentCompletedPayloadSchema = z.strictObject({
	assessmentId: z.string(),
	assurancePolicyId: z.string(),
	policyVersion: z.string(),
	subjectObjectIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number()),
	disposition: z.string(),
	evidenceConsideredIds: z.array(z.string()),
	observationIds: z.array(z.string()),
	residualUncertainty: z.array(z.string()),
	recommendedControlActions: z.array(z.unknown())
});
export type AssuranceAssessmentCompletedPayload = z.infer<
	typeof AssuranceAssessmentCompletedPayloadSchema
>;
export const AssuranceAssessmentConditionallySatisfiedPayloadSchema = z.strictObject({
	conditions: z.array(z.string()),
	residualUncertainty: z.array(z.string()).optional(),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentConditionallySatisfiedPayload = z.infer<
	typeof AssuranceAssessmentConditionallySatisfiedPayloadSchema
>;
export const AssuranceAssessmentEscalatedPayloadSchema = z.strictObject({
	escalationReason: z.string(),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentEscalatedPayload = z.infer<
	typeof AssuranceAssessmentEscalatedPayloadSchema
>;
export const AssuranceAssessmentInconclusivePayloadSchema = z.strictObject({
	residualUncertainty: z.array(z.string()),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentInconclusivePayload = z.infer<
	typeof AssuranceAssessmentInconclusivePayloadSchema
>;
export const AssuranceAssessmentRejectedPayloadSchema = z.strictObject({
	blockingObservationIds: z.array(z.string()),
	recommendedControlAction: z.string().optional(),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentRejectedPayload = z.infer<
	typeof AssuranceAssessmentRejectedPayloadSchema
>;
export const AssuranceAssessmentRequestedPayloadSchema = z.strictObject({
	assurancePolicyId: z.string(),
	policySemanticVersion: z.number(),
	subjectObjectIds: z.array(z.string()),
	claimIds: z.array(z.string()),
	evaluator: z.unknown(),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentRequestedPayload = z.infer<
	typeof AssuranceAssessmentRequestedPayloadSchema
>;
export const AssuranceAssessmentSatisfiedPayloadSchema = z.strictObject({
	evidenceConsideredIds: z.array(z.string()),
	criteriaMetIds: z.array(z.string()).optional(),
	confidence: z.unknown().optional(),
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentSatisfiedPayload = z.infer<
	typeof AssuranceAssessmentSatisfiedPayloadSchema
>;
export const AssuranceAssessmentStartedPayloadSchema = z.strictObject({
	disposition: AssuranceDispositionSchema
});
export type AssuranceAssessmentStartedPayload = z.infer<
	typeof AssuranceAssessmentStartedPayloadSchema
>;
export const AssuranceObservationRecordedPayloadSchema = z.strictObject({
	observationId: z.string(),
	assessmentId: z.string(),
	policyId: z.string(),
	subjectObjectIds: z.array(z.string()),
	findingCode: z.string(),
	severity: z.string(),
	statement: z.string(),
	implication: z.string(),
	evidenceIds: z.array(z.string()),
	disposition: ObservationDispositionSchema
});
export type AssuranceObservationRecordedPayload = z.infer<
	typeof AssuranceObservationRecordedPayloadSchema
>;
export const BaselineApprovedPayloadSchema = z.strictObject({
	status: BaselineStatusSchema
});
export type BaselineApprovedPayload = z.infer<typeof BaselineApprovedPayloadSchema>;
export const BaselineCreatedPayloadSchema = z.strictObject({
	baselineType: BaselineTypeSchema,
	itemObjectIds: z.array(z.string()),
	assuranceAssessmentIds: z.array(z.string()).optional(),
	status: BaselineStatusSchema
});
export type BaselineCreatedPayload = z.infer<typeof BaselineCreatedPayloadSchema>;
export const BaselinePromotedPayloadSchema = z.strictObject({
	baselineId: z.string(),
	baselineType: BaselineTypeSchema,
	promotionDecisionId: z.string(),
	itemObjectVersions: z.array(
		z.strictObject({
			objectId: z.string(),
			semanticVersion: z.number(),
			contentHash: z.string().optional()
		})
	),
	assuranceAssessmentIds: z.array(z.string()),
	status: BaselineStatusSchema
});
export type BaselinePromotedPayload = z.infer<typeof BaselinePromotedPayloadSchema>;
export const BaselineRevokedPayloadSchema = z.strictObject({
	revocationDecisionId: z.string(),
	status: BaselineStatusSchema
});
export type BaselineRevokedPayload = z.infer<typeof BaselineRevokedPayloadSchema>;
export const BaselineSubmittedForReviewPayloadSchema = z.strictObject({
	status: BaselineStatusSchema
});
export type BaselineSubmittedForReviewPayload = z.infer<
	typeof BaselineSubmittedForReviewPayloadSchema
>;
export const BaselineSupersededPayloadSchema = z.strictObject({
	supersedingBaselineId: z.string(),
	status: BaselineStatusSchema
});
export type BaselineSupersededPayload = z.infer<typeof BaselineSupersededPayloadSchema>;
export const ClaimAssertedPayloadSchema = z.strictObject({
	claimId: z.string(),
	statement: z.string(),
	claimType: ClaimTypeSchema,
	subjectObjectIds: z.array(z.string()),
	assertedBy: z.unknown(),
	status: ClaimStatusSchema
});
export type ClaimAssertedPayload = z.infer<typeof ClaimAssertedPayloadSchema>;
export const ClaimContestedPayloadSchema = z.strictObject({
	contradictingEvidenceIds: z.array(z.string()),
	status: ClaimStatusSchema
});
export type ClaimContestedPayload = z.infer<typeof ClaimContestedPayloadSchema>;
export const ClaimRejectedPayloadSchema = z.strictObject({
	assessmentId: z.string().optional(),
	rationale: z.string().optional(),
	status: ClaimStatusSchema
});
export type ClaimRejectedPayload = z.infer<typeof ClaimRejectedPayloadSchema>;
export const ClaimSupportedPayloadSchema = z.strictObject({
	supportingEvidenceIds: z.array(z.string()),
	assessmentId: z.string().optional(),
	status: ClaimStatusSchema
});
export type ClaimSupportedPayload = z.infer<typeof ClaimSupportedPayloadSchema>;
export const ClarificationRequestedPayloadSchema = z.strictObject({
	pwuId: z.string(),
	question: z.string()
});
export type ClarificationRequestedPayload = z.infer<typeof ClarificationRequestedPayloadSchema>;
export const ConstraintAddedPayloadSchema = z.strictObject({
	statement: z.string(),
	constraintType: ConstraintTypeSchema,
	authority: z.unknown(),
	applicability: z.unknown().optional(),
	strength: ConstraintStrengthSchema,
	status: ConstraintStatusSchema
});
export type ConstraintAddedPayload = z.infer<typeof ConstraintAddedPayloadSchema>;
export const ConstraintDeclaredInapplicablePayloadSchema = z.strictObject({
	rationale: z.string(),
	status: ConstraintStatusSchema
});
export type ConstraintDeclaredInapplicablePayload = z.infer<
	typeof ConstraintDeclaredInapplicablePayloadSchema
>;
export const ConstraintPropagatedPayloadSchema = z.strictObject({
	parentConstraintId: z.string(),
	childWorkUnitId: z.string(),
	status: ConstraintStatusSchema
});
export type ConstraintPropagatedPayload = z.infer<typeof ConstraintPropagatedPayloadSchema>;
export const ConstraintSupersededPayloadSchema = z.strictObject({
	supersedingConstraintId: z.string(),
	status: ConstraintStatusSchema
});
export type ConstraintSupersededPayload = z.infer<typeof ConstraintSupersededPayloadSchema>;
export const ConstraintViolatedPayloadSchema = z.strictObject({
	observationId: z.string().optional(),
	status: ConstraintStatusSchema
});
export type ConstraintViolatedPayload = z.infer<typeof ConstraintViolatedPayloadSchema>;
export const ConstraintWaivedPayloadSchema = z.strictObject({
	waiverDecisionId: z.string(),
	status: ConstraintStatusSchema
});
export type ConstraintWaivedPayload = z.infer<typeof ConstraintWaivedPayloadSchema>;
export const DecisionApprovedPayloadSchema = z.strictObject({
	approvalAuthority: z.unknown(),
	status: DecisionStatusSchema
});
export type DecisionApprovedPayload = z.infer<typeof DecisionApprovedPayloadSchema>;
export const DecisionEffectivePayloadSchema = z.strictObject({
	decisionId: z.string(),
	decisionType: DecisionTypeSchema,
	subjectObjectIds: z.array(z.string()),
	subjectSemanticVersions: z.record(z.string(), z.number()),
	selectedOption: z.string(),
	rationale: z.string(),
	effectiveAt: z.string()
});
export type DecisionEffectivePayload = z.infer<typeof DecisionEffectivePayloadSchema>;
export const DecisionProposedPayloadSchema = z.strictObject({
	decisionType: DecisionTypeSchema,
	subjectObjectIds: z.array(z.string()),
	selectedOption: z.string(),
	rationale: z.string(),
	authority: z.unknown(),
	consideredEvidenceIds: z.array(z.string()).optional(),
	consideredObservationIds: z.array(z.string()).optional(),
	effectiveAt: z.string().optional(),
	status: DecisionStatusSchema
});
export type DecisionProposedPayload = z.infer<typeof DecisionProposedPayloadSchema>;
export const DecisionRejectedPayloadSchema = z.strictObject({
	rationale: z.string()
});
export type DecisionRejectedPayload = z.infer<typeof DecisionRejectedPayloadSchema>;
export const DecisionRevokedPayloadSchema = z.strictObject({
	revocationRationale: z.string(),
	status: DecisionStatusSchema
});
export type DecisionRevokedPayload = z.infer<typeof DecisionRevokedPayloadSchema>;
export const DecompositionProposedPayloadSchema = z.strictObject({
	parentWorkUnitId: z.string(),
	childWorkUnitIds: z.array(z.string()),
	rationale: z.string(),
	intentMappings: z.array(z.unknown()).optional(),
	obligationAllocations: z.array(z.unknown()).optional(),
	constraintPropagations: z.array(z.unknown()).optional(),
	assumptionPropagations: z.array(z.unknown()).optional(),
	retainedParentObligationIds: z.array(z.string()).optional(),
	coverageClaims: z.array(z.unknown()).optional(),
	siblingDependencyIds: z.array(z.string()).optional(),
	recompositionContractId: z.string().optional(),
	status: DecompositionContractStatusSchema
});
export type DecompositionProposedPayload = z.infer<typeof DecompositionProposedPayloadSchema>;
export const DecompositionRejectedPayloadSchema = z.strictObject({
	blockingObservationIds: z.array(z.string()),
	status: DecompositionContractStatusSchema
});
export type DecompositionRejectedPayload = z.infer<typeof DecompositionRejectedPayloadSchema>;
export const DecompositionRevisedPayloadSchema = z.strictObject({
	supersedesDecompositionContractId: z.string(),
	rationale: z.string(),
	semanticVersion: z.number(),
	status: DecompositionContractStatusSchema
});
export type DecompositionRevisedPayload = z.infer<typeof DecompositionRevisedPayloadSchema>;
export const DecompositionValidatedPayloadSchema = z.strictObject({
	validatorRole: z.string().optional(),
	coverageClaims: z.array(z.unknown()).optional(),
	status: DecompositionContractStatusSchema
});
export type DecompositionValidatedPayload = z.infer<typeof DecompositionValidatedPayloadSchema>;
export const EvidenceAdmittedPayloadSchema = z.strictObject({
	evidenceId: z.string(),
	status: EvidenceStatusSchema,
	admissibilityAssessmentId: z.string(),
	admittedScope: z.string(),
	admittedClaimIds: z.array(z.string())
});
export type EvidenceAdmittedPayload = z.infer<typeof EvidenceAdmittedPayloadSchema>;
export const EvidenceExpiredPayloadSchema = z.strictObject({
	status: EvidenceStatusSchema
});
export type EvidenceExpiredPayload = z.infer<typeof EvidenceExpiredPayloadSchema>;
export const EvidenceInvalidatedPayloadSchema = z.strictObject({
	invalidationReason: z.string(),
	affectedClaimIds: z.array(z.string()).optional(),
	status: EvidenceStatusSchema
});
export type EvidenceInvalidatedPayload = z.infer<typeof EvidenceInvalidatedPayloadSchema>;
export const EvidenceProposedPayloadSchema = z.strictObject({
	evidenceType: EvidenceTypeSchema,
	contentReference: z.unknown(),
	producedBy: z.unknown(),
	supportsClaimIds: z.array(z.string()).optional(),
	contradictsClaimIds: z.array(z.string()).optional(),
	scope: z.string(),
	limitations: z.array(z.string()).optional(),
	capturedAt: z.string(),
	validFrom: z.string().optional(),
	validUntil: z.string().optional(),
	status: EvidenceStatusSchema
});
export type EvidenceProposedPayload = z.infer<typeof EvidenceProposedPayloadSchema>;
export const EvidenceRejectedPayloadSchema = z.strictObject({
	rationale: z.string().optional(),
	status: EvidenceStatusSchema
});
export type EvidenceRejectedPayload = z.infer<typeof EvidenceRejectedPayloadSchema>;
export const ExecutionEscalatedPayloadSchema = z.strictObject({
	reason: z.string(),
	observationIds: z.array(z.string()).optional(),
	workLifecycleState: WorkLifecycleStateSchema.optional()
});
export type ExecutionEscalatedPayload = z.infer<typeof ExecutionEscalatedPayloadSchema>;
export const ExecutionPlanActivatedPayloadSchema = z.strictObject({
	executionPlanId: z.string(),
	workUnitId: z.string(),
	planVersion: z.number(),
	status: ExecutionPlanStatusSchema,
	authorizedRuntimeBindingIds: z.array(z.string())
});
export type ExecutionPlanActivatedPayload = z.infer<typeof ExecutionPlanActivatedPayloadSchema>;
export const ExecutionPlanApprovedPayloadSchema = z.strictObject({
	approvalDecisionId: z.string().optional(),
	status: ExecutionPlanStatusSchema
});
export type ExecutionPlanApprovedPayload = z.infer<typeof ExecutionPlanApprovedPayloadSchema>;
export const ExecutionPlanProposedPayloadSchema = z.strictObject({
	workUnitId: z.string(),
	planVersion: z.number(),
	stepIds: z.array(z.string()).optional(),
	transitionIds: z.array(z.string()).optional(),
	retryPolicy: z.unknown().optional(),
	tacticalChangePolicy: z.unknown().optional(),
	escalationPolicy: z.unknown().optional(),
	terminationPolicy: z.unknown().optional(),
	status: ExecutionPlanStatusSchema
});
export type ExecutionPlanProposedPayload = z.infer<typeof ExecutionPlanProposedPayloadSchema>;
export const ExecutionPlanRevisedPayloadSchema = z.strictObject({
	executionPlanId: z.string(),
	planVersion: z.number(),
	reason: z.string()
});
export type ExecutionPlanRevisedPayload = z.infer<typeof ExecutionPlanRevisedPayloadSchema>;
export const ExecutionPlanSupersededPayloadSchema = z.strictObject({
	supersedingExecutionPlanId: z.string(),
	status: ExecutionPlanStatusSchema
});
export type ExecutionPlanSupersededPayload = z.infer<typeof ExecutionPlanSupersededPayloadSchema>;
export const ExecutionStepCancelledPayloadSchema = z.strictObject({
	stepId: z.string(),
	stepState: StepStateSchema
});
export type ExecutionStepCancelledPayload = z.infer<typeof ExecutionStepCancelledPayloadSchema>;
export const ExecutionStepFailedPayloadSchema = z.strictObject({
	stepId: z.string(),
	failureReason: z.string(),
	failureClass: z.string().optional(),
	stepState: StepStateSchema
});
export type ExecutionStepFailedPayload = z.infer<typeof ExecutionStepFailedPayloadSchema>;
export const ExecutionStepReadyPayloadSchema = z.strictObject({
	stepId: z.string(),
	stepState: StepStateSchema
});
export type ExecutionStepReadyPayload = z.infer<typeof ExecutionStepReadyPayloadSchema>;
export const ExecutionStepRetriedPayloadSchema = z.strictObject({
	stepId: z.string(),
	attemptNumber: z.number().optional(),
	stepState: StepStateSchema
});
export type ExecutionStepRetriedPayload = z.infer<typeof ExecutionStepRetriedPayloadSchema>;
export const ExecutionStepSkippedPayloadSchema = z.strictObject({
	stepId: z.string(),
	waiverOrRevisionId: z.string().optional(),
	stepState: StepStateSchema
});
export type ExecutionStepSkippedPayload = z.infer<typeof ExecutionStepSkippedPayloadSchema>;
export const ExecutionStepStartedPayloadSchema = z.strictObject({
	stepId: z.string(),
	runtimeBindingId: z.string().optional(),
	stepState: StepStateSchema
});
export type ExecutionStepStartedPayload = z.infer<typeof ExecutionStepStartedPayloadSchema>;
export const ExecutionStepSucceededPayloadSchema = z.strictObject({
	executionStepId: z.string(),
	executionAttemptId: z.string(),
	outputArtifactIds: z.array(z.string()),
	proposedEvidenceIds: z.array(z.string()),
	detectedAssumptionIds: z.array(z.string()),
	resultingExecutionState: ExecutionStateSchema
});
export type ExecutionStepSucceededPayload = z.infer<typeof ExecutionStepSucceededPayloadSchema>;
export const ExecutionStepWaitingPayloadSchema = z.strictObject({
	stepId: z.string(),
	waitReason: z.string().optional(),
	stepState: StepStateSchema
});
export type ExecutionStepWaitingPayload = z.infer<typeof ExecutionStepWaitingPayloadSchema>;
export const ExecutionTerminatedPayloadSchema = z.strictObject({
	reason: z.string(),
	terminationPolicyId: z.string().optional(),
	status: ExecutionPlanStatusSchema
});
export type ExecutionTerminatedPayload = z.infer<typeof ExecutionTerminatedPayloadSchema>;
export const IntentApprovedPayloadSchema = z.strictObject({
	decisionId: z.string(),
	approvedSemanticVersion: z.number(),
	intentStatus: IntentStatusSchema
});
export type IntentApprovedPayload = z.infer<typeof IntentApprovedPayloadSchema>;
export const IntentCapturedPayloadSchema = z.strictObject({
	intentId: z.string(),
	originatingExpression: z.string(),
	intentStatus: IntentStatusSchema,
	ontologyId: z.string(),
	ontologyVersion: z.string()
});
export type IntentCapturedPayload = z.infer<typeof IntentCapturedPayloadSchema>;
export const IntentConstraintRefinedPayloadSchema = z.strictObject({
	intentId: z.string(),
	constraintId: z.string(),
	refinement: z.string()
});
export type IntentConstraintRefinedPayload = z.infer<typeof IntentConstraintRefinedPayloadSchema>;
export const IntentDiscoveryStartedPayloadSchema = z.strictObject({
	intentStatus: IntentStatusSchema,
	ambiguityIds: z.array(z.string()).optional()
});
export type IntentDiscoveryStartedPayload = z.infer<typeof IntentDiscoveryStartedPayloadSchema>;
export const IntentFormalizedPayloadSchema = z.strictObject({
	priorSemanticVersion: z.number(),
	newSemanticVersion: z.number(),
	formalizedObjective: z.string(),
	desiredOutcomes: z.array(z.unknown()),
	successConditions: z.array(z.unknown()),
	nonGoals: z.array(z.string()),
	intentStatus: IntentStatusSchema
});
export type IntentFormalizedPayload = z.infer<typeof IntentFormalizedPayloadSchema>;
export const IntentRevisedPayloadSchema = z.strictObject({
	changeRationale: z.string(),
	impactAnalysisId: z.string().optional(),
	semanticVersion: z.number(),
	intentStatus: IntentStatusSchema
});
export type IntentRevisedPayload = z.infer<typeof IntentRevisedPayloadSchema>;
export const IntentSupersededPayloadSchema = z.strictObject({
	supersedingIntentId: z.string(),
	intentStatus: IntentStatusSchema
});
export type IntentSupersededPayload = z.infer<typeof IntentSupersededPayloadSchema>;
export const ObligationAllocatedPayloadSchema = z.strictObject({
	allocatedToWorkUnitIds: z.array(z.string()),
	decompositionContractId: z.string(),
	status: ObligationStatusSchema
});
export type ObligationAllocatedPayload = z.infer<typeof ObligationAllocatedPayloadSchema>;
export const ObligationRetainedPayloadSchema = z.strictObject({
	parentWorkUnitId: z.string(),
	decompositionContractId: z.string(),
	status: ObligationStatusSchema
});
export type ObligationRetainedPayload = z.infer<typeof ObligationRetainedPayloadSchema>;
export const ObligationSatisfiedPayloadSchema = z.strictObject({
	supportingClaimId: z.string(),
	status: ObligationStatusSchema
});
export type ObligationSatisfiedPayload = z.infer<typeof ObligationSatisfiedPayloadSchema>;
export const ObligationViolatedPayloadSchema = z.strictObject({
	observationId: z.string().optional(),
	status: ObligationStatusSchema
});
export type ObligationViolatedPayload = z.infer<typeof ObligationViolatedPayloadSchema>;
export const ObligationWaivedPayloadSchema = z.strictObject({
	waiverDecisionId: z.string(),
	status: ObligationStatusSchema
});
export type ObligationWaivedPayload = z.infer<typeof ObligationWaivedPayloadSchema>;
export const PwuAbandonedPayloadSchema = z.strictObject({
	abandonmentDecisionId: z.string(),
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuAbandonedPayload = z.infer<typeof PwuAbandonedPayloadSchema>;
export const PwuBaselinedPayloadSchema = z.strictObject({
	pwuId: z.string(),
	baselineId: z.string(),
	newState: z.string()
});
export type PwuBaselinedPayload = z.infer<typeof PwuBaselinedPayloadSchema>;
export const PwuBlockedPayloadSchema = z.strictObject({
	blockReason: z.string(),
	missingObjectIds: z.array(z.string()).optional(),
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuBlockedPayload = z.infer<typeof PwuBlockedPayloadSchema>;
export const PwuChallengedPayloadSchema = z.strictObject({
	challengeReason: z.string(),
	observationIds: z.array(z.string()).optional(),
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuChallengedPayload = z.infer<typeof PwuChallengedPayloadSchema>;
export const PwuConditionallySatisfiedPayloadSchema = z.strictObject({
	conditionStatement: z.string(),
	assuranceAssessmentId: z.string(),
	assuranceState: AssuranceStateSchema,
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuConditionallySatisfiedPayload = z.infer<
	typeof PwuConditionallySatisfiedPayloadSchema
>;
export const PwuInvalidatedPayloadSchema = z.strictObject({
	invalidationReason: z.string(),
	triggeringObjectId: z.string(),
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuInvalidatedPayload = z.infer<typeof PwuInvalidatedPayloadSchema>;
export const PwuMarkedReadyPayloadSchema = z.strictObject({
	shapeReadinessAttestationId: z.string().optional(),
	workLifecycleState: WorkLifecycleStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema.optional()
});
export type PwuMarkedReadyPayload = z.infer<typeof PwuMarkedReadyPayloadSchema>;
export const PwuProposedPayloadSchema = z.strictObject({
	pwuId: z.string(),
	pwuKind: z.string(),
	title: z.string(),
	intentId: z.string(),
	parentWorkUnitId: z.string().optional(),
	workLifecycleState: WorkLifecycleStateSchema,
	executionState: ExecutionStateSchema,
	assuranceState: AssuranceStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema
});
export type PwuProposedPayload = z.infer<typeof PwuProposedPayloadSchema>;
export const PwuRejectedPayloadSchema = z.strictObject({
	blockingObservationIds: z.array(z.string()),
	assuranceState: AssuranceStateSchema,
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuRejectedPayload = z.infer<typeof PwuRejectedPayloadSchema>;
export const PwuReshapingStartedPayloadSchema = z.strictObject({
	reason: z.string(),
	triggeringObjectId: z.string().optional(),
	workLifecycleState: WorkLifecycleStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema
});
export type PwuReshapingStartedPayload = z.infer<typeof PwuReshapingStartedPayloadSchema>;
export const PwuSatisfiedPayloadSchema = z.strictObject({
	assuranceAssessmentId: z.string(),
	assuranceState: AssuranceStateSchema,
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuSatisfiedPayload = z.infer<typeof PwuSatisfiedPayloadSchema>;
export const PwuShapingStartedPayloadSchema = z.strictObject({
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuShapingStartedPayload = z.infer<typeof PwuShapingStartedPayloadSchema>;
export const PwuStateChangedPayloadSchema = z.strictObject({
	previousState: WorkLifecycleStateSchema,
	newState: WorkLifecycleStateSchema,
	executionState: ExecutionStateSchema,
	assuranceState: AssuranceStateSchema,
	shapeIntegrityState: ShapeIntegrityStateSchema,
	reasonCode: z.string(),
	supportingObjectIds: z.array(z.string())
});
export type PwuStateChangedPayload = z.infer<typeof PwuStateChangedPayloadSchema>;
export const PwuSupersededPayloadSchema = z.strictObject({
	supersedingWorkUnitId: z.string(),
	workLifecycleState: WorkLifecycleStateSchema
});
export type PwuSupersededPayload = z.infer<typeof PwuSupersededPayloadSchema>;
export const RecompositionCompletedPayloadSchema = z.strictObject({
	parentCompletionClaimId: z.string(),
	status: RecompositionContractStatusSchema,
	workLifecycleState: WorkLifecycleStateSchema.optional()
});
export type RecompositionCompletedPayload = z.infer<typeof RecompositionCompletedPayloadSchema>;
export const RecompositionConflictDetectedPayloadSchema = z.strictObject({
	conflictingChildWorkUnitIds: z.array(z.string()),
	conflictDescription: z.string(),
	status: RecompositionContractStatusSchema
});
export type RecompositionConflictDetectedPayload = z.infer<
	typeof RecompositionConflictDetectedPayloadSchema
>;
export const RecompositionFailedPayloadSchema = z.strictObject({
	reason: z.string(),
	unsatisfiedChildWorkUnitIds: z.array(z.string()).optional(),
	status: RecompositionContractStatusSchema
});
export type RecompositionFailedPayload = z.infer<typeof RecompositionFailedPayloadSchema>;
export const RecompositionStartedPayloadSchema = z.strictObject({
	parentWorkUnitId: z.string(),
	requiredChildWorkUnitIds: z.array(z.string()),
	status: RecompositionContractStatusSchema,
	workLifecycleState: WorkLifecycleStateSchema.optional()
});
export type RecompositionStartedPayload = z.infer<typeof RecompositionStartedPayloadSchema>;
export const RuntimeBindingAuthorizedPayloadSchema = z.strictObject({
	grantedCapabilities: z.array(z.unknown()),
	authorizationStatus: AuthorizationStatusSchema
});
export type RuntimeBindingAuthorizedPayload = z.infer<typeof RuntimeBindingAuthorizedPayloadSchema>;
export const RuntimeBindingDeniedPayloadSchema = z.strictObject({
	denialReason: z.string().optional(),
	authorizationStatus: AuthorizationStatusSchema
});
export type RuntimeBindingDeniedPayload = z.infer<typeof RuntimeBindingDeniedPayloadSchema>;
export const RuntimeBindingRequestedPayloadSchema = z.strictObject({
	executionStepId: z.string(),
	roleId: z.string(),
	modelSelectionPolicy: z.unknown().optional(),
	requestedCapabilities: z.array(z.unknown()),
	sandboxPolicy: z.unknown().optional(),
	authorizationStatus: AuthorizationStatusSchema
});
export type RuntimeBindingRequestedPayload = z.infer<typeof RuntimeBindingRequestedPayloadSchema>;
export const RuntimeCapabilityRevokedPayloadSchema = z.strictObject({
	revocationReason: z.string(),
	revokedCapabilities: z.array(z.unknown()).optional(),
	authorizationStatus: AuthorizationStatusSchema
});
export type RuntimeCapabilityRevokedPayload = z.infer<typeof RuntimeCapabilityRevokedPayloadSchema>;
export const TacticalChangeAppliedPayloadSchema = z.strictObject({
	executionPlanId: z.string(),
	stepId: z.string().optional(),
	changeType: z.string(),
	authorizingPolicyId: z.string()
});
export type TacticalChangeAppliedPayload = z.infer<typeof TacticalChangeAppliedPayloadSchema>;
export const TacticalChangeRequestedPayloadSchema = z.strictObject({
	executionPlanId: z.string(),
	stepId: z.string().optional(),
	changeType: z.string(),
	rationale: z.string()
});
export type TacticalChangeRequestedPayload = z.infer<typeof TacticalChangeRequestedPayloadSchema>;
export const WaiverDeniedPayloadSchema = z.strictObject({
	rationale: z.string()
});
export type WaiverDeniedPayload = z.infer<typeof WaiverDeniedPayloadSchema>;
export const WaiverExpiredPayloadSchema = z.strictObject({
	waiverDecisionId: z.string()
});
export type WaiverExpiredPayload = z.infer<typeof WaiverExpiredPayloadSchema>;
export const WaiverGrantedPayloadSchema = z.strictObject({
	waiverDecisionId: z.string(),
	effectiveAt: z.string(),
	duration: z.string(),
	status: DecisionStatusSchema
});
export type WaiverGrantedPayload = z.infer<typeof WaiverGrantedPayloadSchema>;
export const WaiverRequestedPayloadSchema = z.strictObject({
	subjectObjectIds: z.array(z.string()),
	scope: z.string(),
	rationale: z.string(),
	duration: z.string(),
	affectedObjectIds: z.array(z.string()),
	decisionType: DecisionTypeSchema,
	status: DecisionStatusSchema
});
export type WaiverRequestedPayload = z.infer<typeof WaiverRequestedPayloadSchema>;
export const IntentProvisionedPayloadSchema = z.strictObject({
	ambiguityIds: z.array(z.string())
});
export type IntentProvisionedPayload = z.infer<typeof IntentProvisionedPayloadSchema>;
export const PwaCreatedPayloadSchema = z.strictObject({
	pwaId: z.string(),
	name: z.string(),
	version: z.string()
});
export type PwaCreatedPayload = z.infer<typeof PwaCreatedPayloadSchema>;
export const PwuTypeDefinedPayloadSchema = z.strictObject({
	pwuTypeId: z.string(),
	pwaId: z.string(),
	pwuKind: z.string()
});
export type PwuTypeDefinedPayload = z.infer<typeof PwuTypeDefinedPayloadSchema>;
export const PwaSubmittedForReviewPayloadSchema = z.strictObject({});
export type PwaSubmittedForReviewPayload = z.infer<typeof PwaSubmittedForReviewPayloadSchema>;
export const PwaValidatedPayloadSchema = z.strictObject({});
export type PwaValidatedPayload = z.infer<typeof PwaValidatedPayloadSchema>;
export const PwaPublishedPayloadSchema = z.strictObject({});
export type PwaPublishedPayload = z.infer<typeof PwaPublishedPayloadSchema>;
export const PwaDeprecatedPayloadSchema = z.strictObject({});
export type PwaDeprecatedPayload = z.infer<typeof PwaDeprecatedPayloadSchema>;
export const PwaRetiredPayloadSchema = z.strictObject({});
export type PwaRetiredPayload = z.infer<typeof PwaRetiredPayloadSchema>;
export const UndertakingCreatedPayloadSchema = z.strictObject({
	undertakingId: z.string(),
	pwaId: z.string(),
	pwaVersion: z.string()
});
export type UndertakingCreatedPayload = z.infer<typeof UndertakingCreatedPayloadSchema>;

export const FIRST_SLICE_COMMANDS = [
	'CaptureIntent',
	'FormalizeIntent',
	'ApproveIntent',
	'ProposePwu',
	'MarkPwuReady',
	'ProposeExecutionPlan',
	'ActivateExecutionPlan',
	'CompleteExecutionStep',
	'ProposeEvidence',
	'AdmitEvidence',
	'RequestAssuranceAssessment',
	'CompleteAssuranceAssessment',
	'ApproveDecision',
	'PromoteBaseline'
] as const;

/** Registry: commandType -> payload schema + target aggregate + emitted event + first-slice flag. */
export const COMMANDS = {
	CaptureIntent: {
		payload: CaptureIntentPayloadSchema,
		targetAggregateType: 'INTENT',
		emitsEvent: 'IntentCaptured',
		firstSlice: true
	},
	FormalizeIntent: {
		payload: FormalizeIntentPayloadSchema,
		targetAggregateType: 'INTENT',
		emitsEvent: 'IntentFormalized',
		firstSlice: true
	},
	ApproveIntent: {
		payload: ApproveIntentPayloadSchema,
		targetAggregateType: 'INTENT',
		emitsEvent: 'IntentApproved',
		firstSlice: true
	},
	ProposePwu: {
		payload: ProposePwuPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
		emitsEvent: 'PwuProposed',
		firstSlice: true
	},
	MarkPwuReady: {
		payload: MarkPwuReadyPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
		emitsEvent: 'PwuStateChanged',
		firstSlice: true
	},
	ProposeExecutionPlan: {
		payload: ProposeExecutionPlanPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionPlanProposed',
		firstSlice: true
	},
	ActivateExecutionPlan: {
		payload: ActivateExecutionPlanPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionPlanActivated',
		firstSlice: true
	},
	CompleteExecutionStep: {
		payload: CompleteExecutionStepPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionStepSucceeded',
		firstSlice: true
	},
	ProposeEvidence: {
		payload: ProposeEvidencePayloadSchema,
		targetAggregateType: 'EVIDENCE',
		emitsEvent: 'EvidenceProposed',
		firstSlice: true
	},
	AdmitEvidence: {
		payload: AdmitEvidencePayloadSchema,
		targetAggregateType: 'EVIDENCE',
		emitsEvent: 'EvidenceAdmitted',
		firstSlice: true
	},
	RequestAssuranceAssessment: {
		payload: RequestAssuranceAssessmentPayloadSchema,
		targetAggregateType: 'ASSURANCE_ASSESSMENT',
		emitsEvent: 'AssuranceAssessmentRequested',
		firstSlice: true
	},
	CompleteAssuranceAssessment: {
		payload: CompleteAssuranceAssessmentPayloadSchema,
		targetAggregateType: 'ASSURANCE_ASSESSMENT',
		emitsEvent: 'AssuranceAssessmentCompleted',
		firstSlice: true
	},
	ApproveDecision: {
		payload: ApproveDecisionPayloadSchema,
		targetAggregateType: 'DECISION',
		emitsEvent: 'DecisionEffective',
		firstSlice: true
	},
	PromoteBaseline: {
		payload: PromoteBaselinePayloadSchema,
		targetAggregateType: 'BASELINE',
		emitsEvent: 'BaselinePromoted',
		firstSlice: true
	},
	BeginPwuShaping: {
		payload: BeginPwuShapingPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
		emitsEvent: 'PwuShapingStarted',
		firstSlice: false
	},
	ChangePwuState: {
		payload: ChangePwuStatePayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
		emitsEvent: 'PwuStateChanged',
		firstSlice: false
	},
	ApproveExecutionPlan: {
		payload: ApproveExecutionPlanPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionPlanApproved',
		firstSlice: false
	},
	StartExecutionStep: {
		payload: StartExecutionStepPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionStepStarted',
		firstSlice: false
	},
	FailExecutionStep: {
		payload: FailExecutionStepPayloadSchema,
		targetAggregateType: 'EXECUTION_PLAN',
		emitsEvent: 'ExecutionStepFailed',
		firstSlice: false
	},
	DetectAssumption: {
		payload: DetectAssumptionPayloadSchema,
		targetAggregateType: 'ASSUMPTION',
		emitsEvent: 'AssumptionDetected',
		firstSlice: false
	},
	AssertClaim: {
		payload: AssertClaimPayloadSchema,
		targetAggregateType: 'CLAIM',
		emitsEvent: 'ClaimAsserted',
		firstSlice: false
	},
	RecordAssuranceObservation: {
		payload: RecordAssuranceObservationPayloadSchema,
		targetAggregateType: 'ASSURANCE_OBSERVATION',
		emitsEvent: 'AssuranceObservationRecorded',
		firstSlice: false
	},
	ProposeDecision: {
		payload: ProposeDecisionPayloadSchema,
		targetAggregateType: 'DECISION',
		emitsEvent: 'DecisionProposed',
		firstSlice: false
	},
	CreateBaseline: {
		payload: CreateBaselinePayloadSchema,
		targetAggregateType: 'BASELINE',
		emitsEvent: 'BaselineCreated',
		firstSlice: false
	},
	ReviseIntent: {
		payload: ReviseIntentPayloadSchema,
		targetAggregateType: 'Intent',
		emitsEvent: 'IntentRevised',
		firstSlice: false
	},
	ChallengePwu: {
		payload: ChallengePwuPayloadSchema,
		targetAggregateType: 'ProfessionalWorkUnit',
		emitsEvent: 'PwuChallenged',
		firstSlice: false
	},
	ReshapePwu: {
		payload: ReshapePwuPayloadSchema,
		targetAggregateType: 'ProfessionalWorkUnit',
		emitsEvent: 'PwuReshapingStarted',
		firstSlice: false
	},
	InvalidatePwu: {
		payload: InvalidatePwuPayloadSchema,
		targetAggregateType: 'ProfessionalWorkUnit',
		emitsEvent: 'PwuInvalidated',
		firstSlice: false
	},
	SupersedePwu: {
		payload: SupersedePwuPayloadSchema,
		targetAggregateType: 'ProfessionalWorkUnit',
		emitsEvent: 'PwuSuperseded',
		firstSlice: false
	},
	ProposeDecomposition: {
		payload: ProposeDecompositionPayloadSchema,
		targetAggregateType: 'DecompositionContract',
		emitsEvent: 'DecompositionProposed',
		firstSlice: false
	},
	ValidateDecomposition: {
		payload: ValidateDecompositionPayloadSchema,
		targetAggregateType: 'DecompositionContract',
		emitsEvent: 'DecompositionValidated',
		firstSlice: false
	},
	ReviseDecomposition: {
		payload: ReviseDecompositionPayloadSchema,
		targetAggregateType: 'DecompositionContract',
		emitsEvent: 'DecompositionRevised',
		firstSlice: false
	},
	BeginRecomposition: {
		payload: BeginRecompositionPayloadSchema,
		targetAggregateType: 'RecompositionContract',
		emitsEvent: 'RecompositionStarted',
		firstSlice: false
	},
	CompleteRecomposition: {
		payload: CompleteRecompositionPayloadSchema,
		targetAggregateType: 'RecompositionContract',
		emitsEvent: 'RecompositionCompleted',
		firstSlice: false
	},
	InvalidateEvidence: {
		payload: InvalidateEvidencePayloadSchema,
		targetAggregateType: 'Evidence',
		emitsEvent: 'EvidenceInvalidated',
		firstSlice: false
	},
	RequestWaiver: {
		payload: RequestWaiverPayloadSchema,
		targetAggregateType: 'Decision',
		emitsEvent: 'WaiverRequested',
		firstSlice: false
	},
	GrantWaiver: {
		payload: GrantWaiverPayloadSchema,
		targetAggregateType: 'Decision',
		emitsEvent: 'WaiverGranted',
		firstSlice: false
	},
	DenyWaiver: {
		payload: DenyWaiverPayloadSchema,
		targetAggregateType: 'Decision',
		emitsEvent: 'WaiverDenied',
		firstSlice: false
	},
	RetryExecutionStep: {
		payload: RetryExecutionStepPayloadSchema,
		targetAggregateType: 'ExecutionPlan',
		emitsEvent: 'ExecutionStepRetried',
		firstSlice: false
	},
	ApplyTacticalChange: {
		payload: ApplyTacticalChangePayloadSchema,
		targetAggregateType: 'ExecutionPlan',
		emitsEvent: 'TacticalChangeApplied',
		firstSlice: false
	},
	CancelExecutionPlan: {
		payload: CancelExecutionPlanPayloadSchema,
		targetAggregateType: 'ExecutionPlan',
		emitsEvent: 'ExecutionTerminated',
		firstSlice: false
	},
	RevokeDecision: {
		payload: RevokeDecisionPayloadSchema,
		targetAggregateType: 'Decision',
		emitsEvent: 'DecisionRevoked',
		firstSlice: false
	},
	SupersedeBaseline: {
		payload: SupersedeBaselinePayloadSchema,
		targetAggregateType: 'Baseline',
		emitsEvent: 'BaselineSuperseded',
		firstSlice: false
	},
	BeginIntentDiscovery: {
		payload: BeginIntentDiscoveryPayloadSchema,
		targetAggregateType: 'INTENT',
		emitsEvent: 'IntentDiscoveryStarted',
		firstSlice: false
	},
	ProvisionIntent: {
		payload: ProvisionIntentPayloadSchema,
		targetAggregateType: 'INTENT',
		emitsEvent: 'IntentProvisioned',
		firstSlice: false
	},
	SubmitBaselineForReview: {
		payload: SubmitBaselineForReviewPayloadSchema,
		targetAggregateType: 'BASELINE',
		emitsEvent: 'BaselineSubmittedForReview',
		firstSlice: false
	},
	ApproveBaseline: {
		payload: ApproveBaselinePayloadSchema,
		targetAggregateType: 'BASELINE',
		emitsEvent: 'BaselineApproved',
		firstSlice: false
	},
	RequestRuntimeBinding: {
		payload: RequestRuntimeBindingPayloadSchema,
		targetAggregateType: 'RUNTIME_BINDING',
		emitsEvent: 'RuntimeBindingRequested',
		firstSlice: false
	},
	AuthorizeRuntimeBinding: {
		payload: AuthorizeRuntimeBindingPayloadSchema,
		targetAggregateType: 'RUNTIME_BINDING',
		emitsEvent: 'RuntimeBindingAuthorized',
		firstSlice: false
	},
	DenyRuntimeBinding: {
		payload: DenyRuntimeBindingPayloadSchema,
		targetAggregateType: 'RUNTIME_BINDING',
		emitsEvent: 'RuntimeBindingDenied',
		firstSlice: false
	},
	RevokeRuntimeCapability: {
		payload: RevokeRuntimeCapabilityPayloadSchema,
		targetAggregateType: 'RUNTIME_BINDING',
		emitsEvent: 'RuntimeCapabilityRevoked',
		firstSlice: false
	},
	CreatePwa: {
		payload: CreatePwaPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaCreated',
		firstSlice: false
	},
	DefinePwuType: {
		payload: DefinePwuTypePayloadSchema,
		targetAggregateType: 'PWU_TYPE',
		emitsEvent: 'PwuTypeDefined',
		firstSlice: false
	},
	SubmitPwaForReview: {
		payload: SubmitPwaForReviewPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaSubmittedForReview',
		firstSlice: false
	},
	ValidatePwa: {
		payload: ValidatePwaPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaValidated',
		firstSlice: false
	},
	PublishPwa: {
		payload: PublishPwaPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaPublished',
		firstSlice: false
	},
	DeprecatePwa: {
		payload: DeprecatePwaPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaDeprecated',
		firstSlice: false
	},
	RetirePwa: {
		payload: RetirePwaPayloadSchema,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		emitsEvent: 'PwaRetired',
		firstSlice: false
	},
	CreateUndertaking: {
		payload: CreateUndertakingPayloadSchema,
		targetAggregateType: 'UNDERTAKING',
		emitsEvent: 'UndertakingCreated',
		firstSlice: false
	}
} as const;

/** Registry: eventType -> payload schema + aggregate type. */
export const EVENTS = {
	AssumptionAccepted: { payload: AssumptionAcceptedPayloadSchema, aggregateType: 'Assumption' },
	AssumptionDetected: { payload: AssumptionDetectedPayloadSchema, aggregateType: 'Assumption' },
	AssumptionDisclosed: { payload: AssumptionDisclosedPayloadSchema, aggregateType: 'Assumption' },
	AssumptionExpired: { payload: AssumptionExpiredPayloadSchema, aggregateType: 'Assumption' },
	AssumptionFalsified: { payload: AssumptionFalsifiedPayloadSchema, aggregateType: 'Assumption' },
	AssumptionVerificationStarted: {
		payload: AssumptionVerificationStartedPayloadSchema,
		aggregateType: 'Assumption'
	},
	AssumptionVerified: { payload: AssumptionVerifiedPayloadSchema, aggregateType: 'Assumption' },
	AssuranceAssessmentCompleted: {
		payload: AssuranceAssessmentCompletedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentConditionallySatisfied: {
		payload: AssuranceAssessmentConditionallySatisfiedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentEscalated: {
		payload: AssuranceAssessmentEscalatedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentInconclusive: {
		payload: AssuranceAssessmentInconclusivePayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentRejected: {
		payload: AssuranceAssessmentRejectedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentRequested: {
		payload: AssuranceAssessmentRequestedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentSatisfied: {
		payload: AssuranceAssessmentSatisfiedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceAssessmentStarted: {
		payload: AssuranceAssessmentStartedPayloadSchema,
		aggregateType: 'AssuranceAssessment'
	},
	AssuranceObservationRecorded: {
		payload: AssuranceObservationRecordedPayloadSchema,
		aggregateType: 'AssuranceObservation'
	},
	BaselineApproved: { payload: BaselineApprovedPayloadSchema, aggregateType: 'Baseline' },
	BaselineCreated: { payload: BaselineCreatedPayloadSchema, aggregateType: 'Baseline' },
	BaselinePromoted: { payload: BaselinePromotedPayloadSchema, aggregateType: 'Baseline' },
	BaselineRevoked: { payload: BaselineRevokedPayloadSchema, aggregateType: 'Baseline' },
	BaselineSubmittedForReview: {
		payload: BaselineSubmittedForReviewPayloadSchema,
		aggregateType: 'Baseline'
	},
	BaselineSuperseded: { payload: BaselineSupersededPayloadSchema, aggregateType: 'Baseline' },
	ClaimAsserted: { payload: ClaimAssertedPayloadSchema, aggregateType: 'Claim' },
	ClaimContested: { payload: ClaimContestedPayloadSchema, aggregateType: 'Claim' },
	ClaimRejected: { payload: ClaimRejectedPayloadSchema, aggregateType: 'Claim' },
	ClaimSupported: { payload: ClaimSupportedPayloadSchema, aggregateType: 'Claim' },
	ClarificationRequested: {
		payload: ClarificationRequestedPayloadSchema,
		aggregateType: 'ProfessionalWorkUnit'
	},
	ConstraintAdded: { payload: ConstraintAddedPayloadSchema, aggregateType: 'Constraint' },
	ConstraintDeclaredInapplicable: {
		payload: ConstraintDeclaredInapplicablePayloadSchema,
		aggregateType: 'Constraint'
	},
	ConstraintPropagated: { payload: ConstraintPropagatedPayloadSchema, aggregateType: 'Constraint' },
	ConstraintSuperseded: { payload: ConstraintSupersededPayloadSchema, aggregateType: 'Constraint' },
	ConstraintViolated: { payload: ConstraintViolatedPayloadSchema, aggregateType: 'Constraint' },
	ConstraintWaived: { payload: ConstraintWaivedPayloadSchema, aggregateType: 'Constraint' },
	DecisionApproved: { payload: DecisionApprovedPayloadSchema, aggregateType: 'Decision' },
	DecisionEffective: { payload: DecisionEffectivePayloadSchema, aggregateType: 'Decision' },
	DecisionProposed: { payload: DecisionProposedPayloadSchema, aggregateType: 'Decision' },
	DecisionRejected: { payload: DecisionRejectedPayloadSchema, aggregateType: 'Decision' },
	DecisionRevoked: { payload: DecisionRevokedPayloadSchema, aggregateType: 'Decision' },
	DecompositionProposed: {
		payload: DecompositionProposedPayloadSchema,
		aggregateType: 'DecompositionContract'
	},
	DecompositionRejected: {
		payload: DecompositionRejectedPayloadSchema,
		aggregateType: 'DecompositionContract'
	},
	DecompositionRevised: {
		payload: DecompositionRevisedPayloadSchema,
		aggregateType: 'DecompositionContract'
	},
	DecompositionValidated: {
		payload: DecompositionValidatedPayloadSchema,
		aggregateType: 'DecompositionContract'
	},
	EvidenceAdmitted: { payload: EvidenceAdmittedPayloadSchema, aggregateType: 'Evidence' },
	EvidenceExpired: { payload: EvidenceExpiredPayloadSchema, aggregateType: 'Evidence' },
	EvidenceInvalidated: { payload: EvidenceInvalidatedPayloadSchema, aggregateType: 'Evidence' },
	EvidenceProposed: { payload: EvidenceProposedPayloadSchema, aggregateType: 'Evidence' },
	EvidenceRejected: { payload: EvidenceRejectedPayloadSchema, aggregateType: 'Evidence' },
	ExecutionEscalated: { payload: ExecutionEscalatedPayloadSchema, aggregateType: 'ExecutionPlan' },
	ExecutionPlanActivated: {
		payload: ExecutionPlanActivatedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionPlanApproved: {
		payload: ExecutionPlanApprovedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionPlanProposed: {
		payload: ExecutionPlanProposedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionPlanRevised: {
		payload: ExecutionPlanRevisedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionPlanSuperseded: {
		payload: ExecutionPlanSupersededPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepCancelled: {
		payload: ExecutionStepCancelledPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepFailed: {
		payload: ExecutionStepFailedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepReady: { payload: ExecutionStepReadyPayloadSchema, aggregateType: 'ExecutionPlan' },
	ExecutionStepRetried: {
		payload: ExecutionStepRetriedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepSkipped: {
		payload: ExecutionStepSkippedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepStarted: {
		payload: ExecutionStepStartedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepSucceeded: {
		payload: ExecutionStepSucceededPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionStepWaiting: {
		payload: ExecutionStepWaitingPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	ExecutionTerminated: {
		payload: ExecutionTerminatedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	IntentApproved: { payload: IntentApprovedPayloadSchema, aggregateType: 'Intent' },
	IntentCaptured: { payload: IntentCapturedPayloadSchema, aggregateType: 'Intent' },
	IntentConstraintRefined: {
		payload: IntentConstraintRefinedPayloadSchema,
		aggregateType: 'Intent'
	},
	IntentDiscoveryStarted: { payload: IntentDiscoveryStartedPayloadSchema, aggregateType: 'Intent' },
	IntentFormalized: { payload: IntentFormalizedPayloadSchema, aggregateType: 'Intent' },
	IntentRevised: { payload: IntentRevisedPayloadSchema, aggregateType: 'Intent' },
	IntentSuperseded: { payload: IntentSupersededPayloadSchema, aggregateType: 'Intent' },
	ObligationAllocated: { payload: ObligationAllocatedPayloadSchema, aggregateType: 'Obligation' },
	ObligationRetained: { payload: ObligationRetainedPayloadSchema, aggregateType: 'Obligation' },
	ObligationSatisfied: { payload: ObligationSatisfiedPayloadSchema, aggregateType: 'Obligation' },
	ObligationViolated: { payload: ObligationViolatedPayloadSchema, aggregateType: 'Obligation' },
	ObligationWaived: { payload: ObligationWaivedPayloadSchema, aggregateType: 'Obligation' },
	PwuAbandoned: { payload: PwuAbandonedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuBaselined: { payload: PwuBaselinedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuBlocked: { payload: PwuBlockedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuChallenged: { payload: PwuChallengedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuConditionallySatisfied: {
		payload: PwuConditionallySatisfiedPayloadSchema,
		aggregateType: 'ProfessionalWorkUnit'
	},
	PwuInvalidated: { payload: PwuInvalidatedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuMarkedReady: { payload: PwuMarkedReadyPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuProposed: { payload: PwuProposedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuRejected: { payload: PwuRejectedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuReshapingStarted: {
		payload: PwuReshapingStartedPayloadSchema,
		aggregateType: 'ProfessionalWorkUnit'
	},
	PwuSatisfied: { payload: PwuSatisfiedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuShapingStarted: {
		payload: PwuShapingStartedPayloadSchema,
		aggregateType: 'ProfessionalWorkUnit'
	},
	PwuStateChanged: { payload: PwuStateChangedPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	PwuSuperseded: { payload: PwuSupersededPayloadSchema, aggregateType: 'ProfessionalWorkUnit' },
	RecompositionCompleted: {
		payload: RecompositionCompletedPayloadSchema,
		aggregateType: 'RecompositionContract'
	},
	RecompositionConflictDetected: {
		payload: RecompositionConflictDetectedPayloadSchema,
		aggregateType: 'RecompositionContract'
	},
	RecompositionFailed: {
		payload: RecompositionFailedPayloadSchema,
		aggregateType: 'RecompositionContract'
	},
	RecompositionStarted: {
		payload: RecompositionStartedPayloadSchema,
		aggregateType: 'RecompositionContract'
	},
	RuntimeBindingAuthorized: {
		payload: RuntimeBindingAuthorizedPayloadSchema,
		aggregateType: 'RuntimeBinding'
	},
	RuntimeBindingDenied: {
		payload: RuntimeBindingDeniedPayloadSchema,
		aggregateType: 'RuntimeBinding'
	},
	RuntimeBindingRequested: {
		payload: RuntimeBindingRequestedPayloadSchema,
		aggregateType: 'RuntimeBinding'
	},
	RuntimeCapabilityRevoked: {
		payload: RuntimeCapabilityRevokedPayloadSchema,
		aggregateType: 'RuntimeBinding'
	},
	TacticalChangeApplied: {
		payload: TacticalChangeAppliedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	TacticalChangeRequested: {
		payload: TacticalChangeRequestedPayloadSchema,
		aggregateType: 'ExecutionPlan'
	},
	WaiverDenied: { payload: WaiverDeniedPayloadSchema, aggregateType: 'Decision' },
	WaiverExpired: { payload: WaiverExpiredPayloadSchema, aggregateType: 'Decision' },
	WaiverGranted: { payload: WaiverGrantedPayloadSchema, aggregateType: 'Decision' },
	WaiverRequested: { payload: WaiverRequestedPayloadSchema, aggregateType: 'Decision' },
	IntentProvisioned: { payload: IntentProvisionedPayloadSchema, aggregateType: 'Intent' },
	PwaCreated: { payload: PwaCreatedPayloadSchema, aggregateType: 'ProfessionalWorkArchitecture' },
	PwuTypeDefined: { payload: PwuTypeDefinedPayloadSchema, aggregateType: 'PwuType' },
	PwaSubmittedForReview: {
		payload: PwaSubmittedForReviewPayloadSchema,
		aggregateType: 'ProfessionalWorkArchitecture'
	},
	PwaValidated: {
		payload: PwaValidatedPayloadSchema,
		aggregateType: 'ProfessionalWorkArchitecture'
	},
	PwaPublished: {
		payload: PwaPublishedPayloadSchema,
		aggregateType: 'ProfessionalWorkArchitecture'
	},
	PwaDeprecated: {
		payload: PwaDeprecatedPayloadSchema,
		aggregateType: 'ProfessionalWorkArchitecture'
	},
	PwaRetired: { payload: PwaRetiredPayloadSchema, aggregateType: 'ProfessionalWorkArchitecture' },
	UndertakingCreated: { payload: UndertakingCreatedPayloadSchema, aggregateType: 'Undertaking' }
} as const;

export interface CommandEventBinding {
	readonly commandType: string;
	readonly eventType: string;
	readonly machine?: string;
	readonly from?: string;
	readonly to?: string;
}
/** The command -> event -> state-transition binding table. */
export const BINDINGS: readonly CommandEventBinding[] = [
	{
		commandType: 'CaptureIntent',
		eventType: 'IntentCaptured',
		machine: 'Intent.intentStatus',
		from: '(initial)',
		to: 'RAW'
	},
	{
		commandType: 'FormalizeIntent',
		eventType: 'IntentFormalized',
		machine: 'Intent.intentStatus',
		from: 'PROVISIONAL',
		to: 'FORMALIZED'
	},
	{
		commandType: 'ApproveIntent',
		eventType: 'IntentApproved',
		machine: 'Intent.intentStatus',
		from: 'FORMALIZED',
		to: 'APPROVED'
	},
	{
		commandType: 'ProposePwu',
		eventType: 'PwuProposed',
		machine: 'PWU.workLifecycleState',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'MarkPwuReady',
		eventType: 'PwuStateChanged',
		machine: 'PWU.workLifecycleState',
		from: 'SHAPING',
		to: 'READY'
	},
	{
		commandType: 'ProposeExecutionPlan',
		eventType: 'ExecutionPlanProposed',
		machine: 'ExecutionPlan.status',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'ActivateExecutionPlan',
		eventType: 'ExecutionPlanActivated',
		machine: 'ExecutionPlan.status',
		from: 'APPROVED',
		to: 'ACTIVE'
	},
	{
		commandType: 'CompleteExecutionStep',
		eventType: 'ExecutionStepSucceeded',
		machine: 'ExecutionStep.stepState',
		from: 'RUNNING',
		to: 'SUCCEEDED'
	},
	{
		commandType: 'ProposeEvidence',
		eventType: 'EvidenceProposed',
		machine: 'Evidence.status',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'AdmitEvidence',
		eventType: 'EvidenceAdmitted',
		machine: 'Evidence.status',
		from: 'PROPOSED',
		to: 'ADMISSIBLE'
	},
	{
		commandType: 'RequestAssuranceAssessment',
		eventType: 'AssuranceAssessmentRequested',
		machine: 'AssuranceAssessment.disposition',
		from: '(initial)',
		to: 'PENDING'
	},
	{
		commandType: 'CompleteAssuranceAssessment',
		eventType: 'AssuranceAssessmentCompleted',
		machine: 'AssuranceAssessment.disposition',
		from: 'ASSESSING',
		to: 'SATISFIED | CONDITIONALLY_SATISFIED | REJECTED | INCONCLUSIVE | ESCALATED'
	},
	{
		commandType: 'ApproveDecision',
		eventType: 'DecisionEffective',
		machine: 'Decision.status',
		from: 'PROPOSED',
		to: 'EFFECTIVE'
	},
	{
		commandType: 'PromoteBaseline',
		eventType: 'BaselinePromoted',
		machine: 'Baseline.status',
		from: 'APPROVED',
		to: 'AUTHORITATIVE'
	},
	{
		commandType: 'BeginPwuShaping',
		eventType: 'PwuShapingStarted',
		machine: 'PWU.workLifecycleState',
		from: 'PROPOSED',
		to: 'SHAPING'
	},
	{
		commandType: 'ChangePwuState',
		eventType: 'PwuStateChanged',
		machine: 'PWU.workLifecycleState',
		from: '(any)',
		to: '(any)'
	},
	{
		commandType: 'ApproveExecutionPlan',
		eventType: 'ExecutionPlanApproved',
		machine: 'ExecutionPlan.status',
		from: 'UNDER_REVIEW',
		to: 'APPROVED'
	},
	{
		commandType: 'StartExecutionStep',
		eventType: 'ExecutionStepStarted',
		machine: 'ExecutionStep.stepState',
		from: 'READY|QUEUED',
		to: 'RUNNING'
	},
	{
		commandType: 'FailExecutionStep',
		eventType: 'ExecutionStepFailed',
		machine: 'ExecutionStep.stepState',
		from: 'RUNNING',
		to: 'FAILED'
	},
	{
		commandType: 'DetectAssumption',
		eventType: 'AssumptionDetected',
		machine: 'Assumption.status',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'AssertClaim',
		eventType: 'ClaimAsserted',
		machine: 'Claim.status',
		from: '(initial)',
		to: 'OPEN'
	},
	{
		commandType: 'RecordAssuranceObservation',
		eventType: 'AssuranceObservationRecorded',
		machine: 'AssuranceObservation.disposition',
		from: '(initial)',
		to: 'OPEN'
	},
	{
		commandType: 'ProposeDecision',
		eventType: 'DecisionProposed',
		machine: 'Decision.status',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'CreateBaseline',
		eventType: 'BaselineCreated',
		machine: 'Baseline.status',
		from: '(initial)',
		to: 'DRAFT'
	},
	{
		commandType: 'ReviseIntent',
		eventType: 'IntentRevised',
		machine: 'Intent.intentStatus',
		from: 'APPROVED',
		to: 'REVISED'
	},
	{
		commandType: 'ChallengePwu',
		eventType: 'PwuChallenged',
		machine: 'PWU.workLifecycleState',
		from: 'READY',
		to: 'CHALLENGED'
	},
	{
		commandType: 'ReshapePwu',
		eventType: 'PwuReshapingStarted',
		machine: 'PWU.workLifecycleState',
		from: 'EXECUTING',
		to: 'RESHAPING'
	},
	{
		commandType: 'InvalidatePwu',
		eventType: 'PwuInvalidated',
		machine: 'PWU.workLifecycleState',
		from: 'SATISFIED|CONDITIONALLY_SATISFIED|RECOMPOSED',
		to: 'INVALIDATED'
	},
	{
		commandType: 'SupersedePwu',
		eventType: 'PwuSuperseded',
		machine: 'PWU.workLifecycleState',
		from: '(any non-baselined)',
		to: 'SUPERSEDED'
	},
	{
		commandType: 'ProposeDecomposition',
		eventType: 'DecompositionProposed',
		machine: 'DecompositionContract.status',
		from: '(initial)',
		to: 'DRAFT'
	},
	{
		commandType: 'ValidateDecomposition',
		eventType: 'DecompositionValidated',
		machine: 'DecompositionContract.status',
		from: 'UNDER_REVIEW',
		to: 'VALID | CONDITIONALLY_VALID'
	},
	{
		commandType: 'ReviseDecomposition',
		eventType: 'DecompositionRevised',
		machine: 'DecompositionContract.status',
		from: '(prior)',
		to: 'SUPERSEDED'
	},
	{
		commandType: 'BeginRecomposition',
		eventType: 'RecompositionStarted',
		machine: 'PWU.workLifecycleState',
		from: 'SATISFIED',
		to: 'RECOMPOSING'
	},
	{
		commandType: 'CompleteRecomposition',
		eventType: 'RecompositionCompleted',
		machine: 'PWU.workLifecycleState',
		from: 'RECOMPOSING',
		to: 'RECOMPOSED'
	},
	{
		commandType: 'InvalidateEvidence',
		eventType: 'EvidenceInvalidated',
		machine: 'Evidence.status',
		from: 'ADMISSIBLE',
		to: 'INVALIDATED'
	},
	{
		commandType: 'RequestWaiver',
		eventType: 'WaiverRequested',
		machine: 'Decision.status',
		from: '(initial)',
		to: 'PROPOSED'
	},
	{
		commandType: 'GrantWaiver',
		eventType: 'WaiverGranted',
		machine: 'Decision.status',
		from: 'PROPOSED',
		to: 'EFFECTIVE'
	},
	{
		commandType: 'DenyWaiver',
		eventType: 'WaiverDenied',
		machine: 'Decision.status',
		from: 'PROPOSED',
		to: '(no status value — §23.1 gap)'
	},
	{
		commandType: 'RetryExecutionStep',
		eventType: 'ExecutionStepRetried',
		machine: 'ExecutionStep.stepState',
		from: 'FAILED',
		to: 'QUEUED'
	},
	{
		commandType: 'ApplyTacticalChange',
		eventType: 'TacticalChangeApplied',
		machine: 'ExecutionPlan.status',
		from: 'ACTIVE',
		to: 'ACTIVE'
	},
	{
		commandType: 'CancelExecutionPlan',
		eventType: 'ExecutionTerminated',
		machine: 'ExecutionPlan.status',
		from: 'ACTIVE',
		to: 'CANCELLED'
	},
	{
		commandType: 'RevokeDecision',
		eventType: 'DecisionRevoked',
		machine: 'Decision.status',
		from: 'EFFECTIVE',
		to: 'REVOKED'
	},
	{
		commandType: 'SupersedeBaseline',
		eventType: 'BaselineSuperseded',
		machine: 'Baseline.status',
		from: 'AUTHORITATIVE',
		to: 'SUPERSEDED'
	},
	{
		commandType: 'BeginIntentDiscovery',
		eventType: 'IntentDiscoveryStarted',
		machine: 'Intent.intentStatus',
		from: 'RAW',
		to: 'UNDER_DISCOVERY'
	},
	{
		commandType: 'ProvisionIntent',
		eventType: 'IntentProvisioned',
		machine: 'Intent.intentStatus',
		from: 'UNDER_DISCOVERY',
		to: 'PROVISIONAL'
	},
	{
		commandType: 'SubmitBaselineForReview',
		eventType: 'BaselineSubmittedForReview',
		machine: 'Baseline.status',
		from: 'CANDIDATE',
		to: 'UNDER_REVIEW'
	},
	{
		commandType: 'ApproveBaseline',
		eventType: 'BaselineApproved',
		machine: 'Baseline.status',
		from: 'UNDER_REVIEW',
		to: 'APPROVED'
	},
	{
		commandType: 'RequestRuntimeBinding',
		eventType: 'RuntimeBindingRequested',
		machine: 'RuntimeBinding.authorizationStatus',
		from: '(initial)',
		to: 'REQUESTED'
	},
	{
		commandType: 'AuthorizeRuntimeBinding',
		eventType: 'RuntimeBindingAuthorized',
		machine: 'RuntimeBinding.authorizationStatus',
		from: 'REQUESTED',
		to: 'AUTHORIZED'
	},
	{
		commandType: 'DenyRuntimeBinding',
		eventType: 'RuntimeBindingDenied',
		machine: 'RuntimeBinding.authorizationStatus',
		from: 'REQUESTED',
		to: 'DENIED'
	},
	{
		commandType: 'RevokeRuntimeCapability',
		eventType: 'RuntimeCapabilityRevoked',
		machine: 'RuntimeBinding.authorizationStatus',
		from: 'AUTHORIZED',
		to: 'REVOKED'
	},
	{
		commandType: 'CreatePwa',
		eventType: 'PwaCreated',
		machine: 'PWA.publicationStatus',
		from: '(initial)',
		to: 'DRAFT'
	},
	{
		commandType: 'DefinePwuType',
		eventType: 'PwuTypeDefined',
		machine: 'PwuType.status',
		from: '(initial)',
		to: 'DRAFT'
	},
	{
		commandType: 'SubmitPwaForReview',
		eventType: 'PwaSubmittedForReview',
		machine: 'PWA.publicationStatus',
		from: 'DRAFT',
		to: 'UNDER_REVIEW'
	},
	{
		commandType: 'ValidatePwa',
		eventType: 'PwaValidated',
		machine: 'PWA.publicationStatus',
		from: 'UNDER_REVIEW',
		to: 'VALIDATED'
	},
	{
		commandType: 'PublishPwa',
		eventType: 'PwaPublished',
		machine: 'PWA.publicationStatus',
		from: 'VALIDATED',
		to: 'PUBLISHED'
	},
	{
		commandType: 'DeprecatePwa',
		eventType: 'PwaDeprecated',
		machine: 'PWA.publicationStatus',
		from: 'PUBLISHED',
		to: 'DEPRECATED'
	},
	{
		commandType: 'RetirePwa',
		eventType: 'PwaRetired',
		machine: 'PWA.publicationStatus',
		from: 'DEPRECATED',
		to: 'RETIRED'
	},
	{
		commandType: 'CreateUndertaking',
		eventType: 'UndertakingCreated',
		machine: 'Undertaking.status',
		from: '(initial)',
		to: 'ACTIVE'
	}
];
