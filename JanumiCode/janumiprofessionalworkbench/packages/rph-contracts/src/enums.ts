// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:enums`.
// Source of enum VALUES: vocab/canonical-vocabulary.json (ratified per docs §5, grounded from RPH specs).
// Each closed enum is authored ONCE here as a Zod schema; TS types + JSON Schema derive from it.
import { z } from 'zod';

/** ActorReference.actorType — RPH-DOC-007 §6 (identical to DOC-002 §5) */
export const ActorTypeSchema = z.enum([
	'HUMAN',
	'AGENT',
	'MODEL',
	'SERVICE',
	'POLICY_ENGINE',
	'EXTERNAL_SYSTEM'
]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

/** Aggregate assurance disposition — composition-across-policies outcome (semantic rule) — RPH-DOC-004 §28.2 (6 values) */
export const AggregateAssuranceDispositionSchema = z.enum([
	'REJECTED',
	'EVIDENCE_REQUIRED',
	'UNASSESSED',
	'INCONCLUSIVE',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED'
]);
export type AggregateAssuranceDisposition = z.infer<typeof AggregateAssuranceDispositionSchema>;

/** ApplicabilityExpression.op (union discriminant) — RPH-DOC-007 §18 (8 ops) */
export const ApplicabilityExpressionOpSchema = z.enum([
	'ALL',
	'ANY',
	'NOT',
	'EQUALS',
	'IN',
	'CONTAINS',
	'EXISTS',
	'RISK_AT_LEAST'
]);
export type ApplicabilityExpressionOp = z.infer<typeof ApplicabilityExpressionOpSchema>;

/** ApplicabilityOutcome type alias — RPH-DOC-004 §5.2 */
export const ApplicabilityOutcomeSchema = z.enum([
	'REQUIRED',
	'RECOMMENDED',
	'OPTIONAL',
	'NOT_APPLICABLE',
	'REQUIRES_HUMAN_DETERMINATION'
]);
export type ApplicabilityOutcome = z.infer<typeof ApplicabilityOutcomeSchema>;

/** AssumptionObject.status — RPH-DOC-007 §12.1 / DOC-002 §12.1 (8 values) */
export const AssumptionStatusSchema = z.enum([
	'PROPOSED',
	'DISCLOSED',
	'UNDER_VERIFICATION',
	'ACCEPTED',
	'VERIFIED',
	'FALSIFIED',
	'EXPIRED',
	'SUPERSEDED'
]);
export type AssumptionStatus = z.infer<typeof AssumptionStatusSchema>;

/** AssuranceAssessment.state / .assessmentState (assessment aggregate state machine) — RPH-DOC-004 §30 (15 values; governs assessment state) */
export const AssuranceAssessmentStateSchema = z.enum([
	'REQUESTED',
	'EVIDENCE_PENDING',
	'READY',
	'ASSESSING',
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED',
	'WAIVED',
	'VALIDATOR_FAILED',
	'INDEPENDENCE_VIOLATION',
	'INVALIDATED',
	'WAIVER_EXPIRED',
	'CANCELLED'
]);
export type AssuranceAssessmentState = z.infer<typeof AssuranceAssessmentStateSchema>;

/** Terminal assurance disposition meanings (semantic outcome vocabulary) — RPH-DOC-004 §10.1 (6 disposition meanings; governs disposition) */
export const AssuranceDispositionSchema = z.enum([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'WAIVED',
	'ESCALATED'
]);
export type AssuranceDisposition = z.infer<typeof AssuranceDispositionSchema>;

/** ValidatorResult.dispositionRecommendation; DispositionRule.disposition; AssuranceAssessmentCompletedPayload.disposition — RPH-DOC-004 §4.2 & §10.2 (WAIVED excluded) / DOC-007 §19.3 & §20 */
export const AssuranceDispositionRecommendationSchema = z.enum([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'ESCALATED'
]);
export type AssuranceDispositionRecommendation = z.infer<
	typeof AssuranceDispositionRecommendationSchema
>;

/** AssurancePolicyDefinition.status — RPH-DOC-007 §17 / DOC-004 §3.1 / DOC-002 §17.1 (all agree) */
export const AssurancePolicyStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'SUPERSEDED']);
export type AssurancePolicyStatus = z.infer<typeof AssurancePolicyStatusSchema>;

/** AssuranceObservation.severity (ObservationSeverity); AssessmentCriterion.severityIfNotMet; FindingDefinition.defaultSeverity — RPH-DOC-007 §21 / DOC-002 §19 / DOC-004 §7 & §9.1 (5 values; all agree) */
export const AssuranceSeveritySchema = z.enum([
	'INFORMATIONAL',
	'ADVISORY',
	'MATERIAL',
	'BLOCKING',
	'CRITICAL'
]);
export type AssuranceSeverity = z.infer<typeof AssuranceSeveritySchema>;

/** ProfessionalWorkUnit.assuranceState (PWU-level rollup — NOT the assessment state machine) — RPH-DOC-002 §7.4 (11 values) */
export const AssuranceStateSchema = z.enum([
	'NOT_REQUIRED',
	'UNASSESSED',
	'EVIDENCE_REQUIRED',
	'READY_FOR_ASSESSMENT',
	'ASSESSING',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED',
	'REJECTED',
	'WAIVED',
	'INVALIDATED',
	'ESCALATED'
]);
export type AssuranceState = z.infer<typeof AssuranceStateSchema>;

/** AssuranceViewProjection.aggregateDisposition (read-model projection field) — RPH-DOC-007 §26.2 (9 values; serialized projection) */
export const AssuranceViewAggregateDispositionSchema = z.enum([
	'UNASSESSED',
	'EVIDENCE_REQUIRED',
	'ASSESSING',
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'INCONCLUSIVE',
	'WAIVED',
	'INVALIDATED'
]);
export type AssuranceViewAggregateDisposition = z.infer<
	typeof AssuranceViewAggregateDispositionSchema
>;

/** AuthorityReference.authorityType — RPH-DOC-002 §5 */
export const AuthorityTypeSchema = z.enum([
	'USER',
	'ORGANIZATIONAL_ROLE',
	'POLICY',
	'LEGAL_REQUIREMENT',
	'SYSTEM_OWNER',
	'DELEGATED_AGENT'
]);
export type AuthorityType = z.infer<typeof AuthorityTypeSchema>;

/** RuntimeBinding.authorizationStatus — RPH-DOC-002 §22 */
export const AuthorizationStatusSchema = z.enum([
	'REQUESTED',
	'AUTHORIZED',
	'PARTIALLY_AUTHORIZED',
	'DENIED',
	'REVOKED'
]);
export type AuthorizationStatus = z.infer<typeof AuthorizationStatusSchema>;

/** BaselineObject.status — RPH-DOC-007 §23 / DOC-002 §24.1 (7 values) */
export const BaselineStatusSchema = z.enum([
	'DRAFT',
	'CANDIDATE',
	'UNDER_REVIEW',
	'APPROVED',
	'AUTHORITATIVE',
	'SUPERSEDED',
	'REVOKED'
]);
export type BaselineStatus = z.infer<typeof BaselineStatusSchema>;

/** BaselineObject.baselineType — RPH-DOC-007 §23 / DOC-002 §24.1 (6 values) */
export const BaselineTypeSchema = z.enum([
	'INTENT',
	'REQUIREMENTS',
	'ARCHITECTURE',
	'IMPLEMENTATION',
	'RELEASE',
	'EVIDENCE_PACKAGE'
]);
export type BaselineType = z.infer<typeof BaselineTypeSchema>;

/** ClaimObject.status — RPH-DOC-007 §13 / DOC-002 §15.1 (8 values) */
export const ClaimStatusSchema = z.enum([
	'OPEN',
	'UNDER_ASSESSMENT',
	'SUPPORTED',
	'CONDITIONALLY_SUPPORTED',
	'CONTESTED',
	'REJECTED',
	'WAIVED',
	'SUPERSEDED'
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/** ClaimObject.claimType; AssurancePolicyDefinition.evaluatedClaimTypes; FindingDefinition.affectedClaimTypes — RPH-DOC-007 §13 / DOC-002 §15.1 (10 values) */
export const ClaimTypeSchema = z.enum([
	'COMPLETENESS',
	'CORRECTNESS',
	'COMPLIANCE',
	'CONSISTENCY',
	'FITNESS',
	'PRESERVATION',
	'FEASIBILITY',
	'PERFORMANCE',
	'SECURITY',
	'COVERAGE'
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

/** CommandReceipt.status — RPH-DOC-007 §30 */
export const CommandReceiptStatusSchema = z.enum(['PROCESSING', 'ACCEPTED', 'REJECTED']);
export type CommandReceiptStatus = z.infer<typeof CommandReceiptStatusSchema>;

/** CommandResult.status — RPH-DOC-007 §8.2 */
export const CommandResultStatusSchema = z.enum([
	'ACCEPTED',
	'REJECTED',
	'CONFLICT',
	'DUPLICATE',
	'UNAUTHORIZED',
	'VALIDATION_FAILED'
]);
export type CommandResultStatus = z.infer<typeof CommandResultStatusSchema>;

/** CompatibilityMilestoneProjection.currentMilestone — RPH-DOC-007 §26.3 (11 values; latest serialized projection) */
export const CompatibilityMilestoneSchema = z.enum([
	'INTAKE',
	'ARCHITECTURE',
	'PROPOSE',
	'ASSUMPTION_SURFACING',
	'VERIFY',
	'HISTORICAL_CHECK',
	'REVIEW',
	'EXECUTE',
	'VALIDATE',
	'COMMIT',
	'REPLAN'
]);
export type CompatibilityMilestone = z.infer<typeof CompatibilityMilestoneSchema>;

/** ConstraintObject.status — RPH-DOC-002 §11.1 */
export const ConstraintStatusSchema = z.enum([
	'PROPOSED',
	'ACTIVE',
	'WAIVED',
	'INAPPLICABLE',
	'VIOLATED',
	'SUPERSEDED',
	'INVALIDATED'
]);
export type ConstraintStatus = z.infer<typeof ConstraintStatusSchema>;

/** ConstraintObject.strength — RPH-DOC-002 §11.1 */
export const ConstraintStrengthSchema = z.enum(['MANDATORY', 'PREFERRED', 'ADVISORY']);
export type ConstraintStrength = z.infer<typeof ConstraintStrengthSchema>;

/** ConstraintObject.constraintType — RPH-DOC-002 §11.1 (9 values) */
export const ConstraintTypeSchema = z.enum([
	'TECHNICAL',
	'BUSINESS',
	'LEGAL',
	'SECURITY',
	'POLICY',
	'RESOURCE',
	'TEMPORAL',
	'USER_PREFERENCE',
	'ARCHITECTURAL'
]);
export type ConstraintType = z.infer<typeof ConstraintTypeSchema>;

/** AssurancePolicyDefinition.permittedControlActions; FindingDefinition.defaultControlActions; EscalationRule.timeoutAction; ControlActionRecommendation.action; ProposedAssuranceObservation.recommendedControlActions — RPH-DOC-004 §11 (23 values, superset; governs ControlAction) */
export const ControlActionSchema = z.enum([
	'CONTINUE',
	'WAIT',
	'CLARIFY',
	'GATHER_CONTEXT',
	'GATHER_EVIDENCE',
	'REVISE_PROMPT',
	'REVISE_CONTEXT',
	'RETRY',
	'CHANGE_MODEL',
	'CHANGE_TOOL',
	'CHANGE_VALIDATOR',
	'CHANGE_TACTIC',
	'RESHAPE_PWU',
	'REVISE_DECOMPOSITION',
	'REPLAN_EXECUTION',
	'INVALIDATE_DEPENDENTS',
	'REQUEST_HUMAN_DECISION',
	'REQUEST_WAIVER',
	'ESCALATE',
	'REJECT',
	'ABANDON',
	'ACCEPT',
	'PROMOTE_BASELINE'
]);
export type ControlAction = z.infer<typeof ControlActionSchema>;

/** CoverageClaim.coverageType — RPH-DOC-002 §13.3 */
export const CoverageTypeSchema = z.enum(['COMPLETE', 'PARTIAL', 'CONDITIONAL', 'EXPLORATORY']);
export type CoverageType = z.infer<typeof CoverageTypeSchema>;

/** CriterionResult.result — RPH-DOC-007 §20.1 (UPPERCASE_SNAKE_CASE per DOC-007 §4.5) */
export const CriterionResultOutcomeSchema = z.enum([
	'MET',
	'PARTIALLY_MET',
	'NOT_MET',
	'NOT_APPLICABLE',
	'UNABLE_TO_DETERMINE'
]);
export type CriterionResultOutcome = z.infer<typeof CriterionResultOutcomeSchema>;

/** AssessmentCriterion.criterionType — RPH-DOC-004 §7 */
export const CriterionTypeSchema = z.enum([
	'BOOLEAN',
	'ENUMERATED',
	'QUALITATIVE',
	'QUANTITATIVE',
	'COMPOSITE'
]);
export type CriterionType = z.infer<typeof CriterionTypeSchema>;

/** DecisionObject.status — RPH-DOC-007 §22 / DOC-002 §23.1 */
export const DecisionStatusSchema = z.enum(['PROPOSED', 'EFFECTIVE', 'REVOKED', 'SUPERSEDED']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

/** DecisionObject.decisionType — RPH-DOC-007 §22 / DOC-002 §23.1 (9 values) */
export const DecisionTypeSchema = z.enum([
	'APPROVAL',
	'REJECTION',
	'WAIVER',
	'ESCALATION',
	'RESHAPE',
	'REPLAN',
	'PROMOTE_BASELINE',
	'ABANDON',
	'REVOKE'
]);
export type DecisionType = z.infer<typeof DecisionTypeSchema>;

/** DecompositionContract.status — RPH-DOC-002 §13.1 */
export const DecompositionContractStatusSchema = z.enum([
	'DRAFT',
	'UNDER_REVIEW',
	'VALID',
	'CONDITIONALLY_VALID',
	'INVALID',
	'SUPERSEDED'
]);
export type DecompositionContractStatus = z.infer<typeof DecompositionContractStatusSchema>;

/** EscalationRule.escalationTarget — RPH-DOC-004 §13 */
export const EscalationTargetSchema = z.enum([
	'HUMAN_USER',
	'PRODUCT_OWNER',
	'ARCHITECT',
	'SECURITY_REVIEWER',
	'LEGAL_REVIEWER',
	'SYSTEM_OWNER',
	'INDEPENDENT_VALIDATOR'
]);
export type EscalationTarget = z.infer<typeof EscalationTargetSchema>;

/** AssessmentCriterion.evaluationMethod — RPH-DOC-004 §7 */
export const EvaluationMethodSchema = z.enum([
	'DETERMINISTIC',
	'MODEL_JUDGMENT',
	'HUMAN_JUDGMENT',
	'HYBRID'
]);
export type EvaluationMethod = z.infer<typeof EvaluationMethodSchema>;

/** EvidenceRequirement.cardinality — RPH-DOC-004 §6.1 */
export const EvidenceCardinalitySchema = z.enum([
	'EXACTLY_ONE',
	'AT_LEAST_ONE',
	'ZERO_OR_MORE',
	'ONE_PER_SUBJECT',
	'ONE_PER_OBLIGATION'
]);
export type EvidenceCardinality = z.infer<typeof EvidenceCardinalitySchema>;

/** EvidenceObject.status — RPH-DOC-007 §14 / DOC-002 §16.1 */
export const EvidenceStatusSchema = z.enum([
	'PROPOSED',
	'ADMISSIBLE',
	'REJECTED',
	'SUPERSEDED',
	'INVALIDATED'
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

/** EvidenceObject.evidenceType; EvidenceRequirement.evidenceType — RPH-DOC-007 §14 / DOC-002 §16.1 (9 values) */
export const EvidenceTypeSchema = z.enum([
	'ARTIFACT',
	'TEST_RESULT',
	'SOURCE',
	'TRACE',
	'OBSERVATION',
	'ANALYSIS',
	'MEASUREMENT',
	'APPROVAL',
	'REVIEW'
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/** ExecutionPlan.status — RPH-DOC-007 §15 / DOC-002 §20.1 (8 values) */
export const ExecutionPlanStatusSchema = z.enum([
	'PROPOSED',
	'UNDER_REVIEW',
	'APPROVED',
	'ACTIVE',
	'COMPLETED',
	'FAILED',
	'SUPERSEDED',
	'CANCELLED'
]);
export type ExecutionPlanStatus = z.infer<typeof ExecutionPlanStatusSchema>;

/** ProfessionalWorkUnit.executionState — RPH-DOC-002 §7.3 (10 values) */
export const ExecutionStateSchema = z.enum([
	'NOT_PLANNED',
	'PLANNED',
	'QUEUED',
	'RUNNING',
	'WAITING',
	'RETRYING',
	'SUCCEEDED',
	'FAILED',
	'CANCELLED',
	'SUPERSEDED'
]);
export type ExecutionState = z.infer<typeof ExecutionStateSchema>;

/** AssurancePolicy.failureSeverity — RPH-DOC-002 §17.1 (4 values) */
export const FailureSeveritySchema = z.enum(['ADVISORY', 'MATERIAL', 'BLOCKING', 'CRITICAL']);
export type FailureSeverity = z.infer<typeof FailureSeveritySchema>;

/** AssurancePolicyDefinition.independenceRequirement; DispositionRule.requiredIndependence — RPH-DOC-004 §8.1 (8 values; governs assurance enums) */
export const IndependenceRequirementSchema = z.enum([
	'NONE',
	'DIFFERENT_INVOCATION',
	'DIFFERENT_CONTEXT_INSTANCE',
	'DIFFERENT_AGENT',
	'DIFFERENT_MODEL',
	'DIFFERENT_PROVIDER',
	'HUMAN',
	'ORGANIZATIONALLY_INDEPENDENT'
]);
export type IndependenceRequirement = z.infer<typeof IndependenceRequirementSchema>;

/** IntentObject.intentStatus — RPH-DOC-007 §10.1 (identical to DOC-002 §6.1) */
export const IntentStatusSchema = z.enum([
	'RAW',
	'UNDER_DISCOVERY',
	'PROVISIONAL',
	'FORMALIZED',
	'APPROVED',
	'REVISED',
	'SUPERSEDED',
	'WITHDRAWN'
]);
export type IntentStatus = z.infer<typeof IntentStatusSchema>;

/** AssumptionObject.materiality — RPH-DOC-007 §12.1 (identical DOC-002 §12.1) */
export const MaterialitySchema = z.enum(['IMMATERIAL', 'MATERIAL', 'CRITICAL']);
export type Materiality = z.infer<typeof MaterialitySchema>;

/** CompatibilityMilestoneProjection.milestoneStatus — RPH-DOC-007 §26.3 */
export const MilestoneStatusSchema = z.enum([
	'NOT_STARTED',
	'IN_PROGRESS',
	'WAITING',
	'COMPLETE',
	'FAILED',
	'BLOCKED'
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

/** ObligationObject.status — RPH-DOC-002 §10.1 */
export const ObligationStatusSchema = z.enum([
	'PROPOSED',
	'ACTIVE',
	'ALLOCATED',
	'SATISFIED',
	'WAIVED',
	'VIOLATED',
	'SUPERSEDED'
]);
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

/** ObligationObject.strength — RPH-DOC-002 §10.1 */
export const ObligationStrengthSchema = z.enum(['MANDATORY', 'CONDITIONAL', 'ADVISORY']);
export type ObligationStrength = z.infer<typeof ObligationStrengthSchema>;

/** ObligationObject.obligationType — RPH-DOC-002 §10.1 */
export const ObligationTypeSchema = z.enum([
	'FUNCTIONAL',
	'QUALITY',
	'COMPLIANCE',
	'SAFETY',
	'SECURITY',
	'PROCESS',
	'EVIDENCE',
	'GOVERNANCE'
]);
export type ObligationType = z.infer<typeof ObligationTypeSchema>;

/** AssuranceObservation.disposition — RPH-DOC-007 §21 / DOC-002 §19 (6 values) */
export const ObservationDispositionSchema = z.enum([
	'OPEN',
	'ACCEPTED',
	'REMEDIATED',
	'WAIVED',
	'REJECTED',
	'SUPERSEDED'
]);
export type ObservationDisposition = z.infer<typeof ObservationDispositionSchema>;

/** AssuranceObservation.observationType — RPH-DOC-007 §21 / DOC-002 §19 (7 values) */
export const ObservationTypeSchema = z.enum([
	'FINDING',
	'MEASUREMENT',
	'CONFLICT',
	'EVIDENCE_DEFICIT',
	'SHAPE_RISK',
	'POLICY_VIOLATION',
	'RECOMMENDATION'
]);
export type ObservationType = z.infer<typeof ObservationTypeSchema>;

/** ProvenanceRecord.originType — RPH-DOC-007 §7.1 */
export const OriginTypeSchema = z.enum([
	'USER_INPUT',
	'MODEL_GENERATION',
	'TOOL_OUTPUT',
	'HUMAN_DECISION',
	'MIGRATION',
	'DERIVED',
	'IMPORTED'
]);
export type OriginType = z.infer<typeof OriginTypeSchema>;

/** OutboxMessage.status — RPH-DOC-007 §29 */
export const OutboxStatusSchema = z.enum(['PENDING', 'PUBLISHED', 'FAILED']);
export type OutboxStatus = z.infer<typeof OutboxStatusSchema>;

/** ObjectEnvelope.objectType (all Professional Work Objects); AssurancePolicyDefinition.applicableObjectTypes — RPH-DOC-002 §4 (17 runtime) + 3 authoring objects (RPH-DOC-010) */
export const ProfessionalWorkObjectTypeSchema = z.enum([
	'INTENT',
	'PROFESSIONAL_WORK_UNIT',
	'OBLIGATION',
	'CONSTRAINT',
	'ASSUMPTION',
	'CLAIM',
	'EVIDENCE',
	'ASSURANCE_POLICY',
	'ASSURANCE_ASSESSMENT',
	'ASSURANCE_OBSERVATION',
	'DECISION',
	'ARTIFACT',
	'DECOMPOSITION_CONTRACT',
	'RECOMPOSITION_CONTRACT',
	'EXECUTION_PLAN',
	'RUNTIME_BINDING',
	'BASELINE',
	'PROFESSIONAL_WORK_ARCHITECTURE',
	'PWU_TYPE',
	'UNDERTAKING',
	'AUTHORING_CONVERSATION'
]);
export type ProfessionalWorkObjectType = z.infer<typeof ProfessionalWorkObjectTypeSchema>;

/** RecompositionContract.status — RPH-DOC-002 §14 (8 values) */
export const RecompositionContractStatusSchema = z.enum([
	'DRAFT',
	'READY',
	'EVALUATING',
	'COMPOSABLE',
	'CONFLICTED',
	'INSUFFICIENT',
	'SATISFIED',
	'SUPERSEDED'
]);
export type RecompositionContractStatus = z.infer<typeof RecompositionContractStatusSchema>;

/** EvidenceRequirement.requiredForDispositions — RPH-DOC-004 §6.1 */
export const RequiredForDispositionsSchema = z.enum([
	'ALL',
	'SATISFIED_ONLY',
	'CONDITIONAL_OR_SATISFIED'
]);
export type RequiredForDispositions = z.infer<typeof RequiredForDispositionsSchema>;

/** WorkRiskProfile.consequence — RPH-DOC-002 §9.2 */
export const RiskConsequenceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskConsequence = z.infer<typeof RiskConsequenceSchema>;

/** ApplicabilityExpression op=RISK_AT_LEAST .dimension — RPH-DOC-007 §18 */
export const RiskDimensionSchema = z.enum([
	'CONSEQUENCE',
	'UNCERTAINTY',
	'IRREVERSIBILITY',
	'SECURITY_SENSITIVITY',
	'REGULATORY_EXPOSURE'
]);
export type RiskDimension = z.infer<typeof RiskDimensionSchema>;

/** WorkRiskProfile.irreversibility — RPH-DOC-002 §9.2 */
export const RiskIrreversibilitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskIrreversibility = z.infer<typeof RiskIrreversibilitySchema>;

/** ApplicabilityExpression op=RISK_AT_LEAST .level — RPH-DOC-007 §18 */
export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** WorkRiskProfile.regulatoryExposure — RPH-DOC-002 §9.2 */
export const RiskRegulatoryExposureSchema = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']);
export type RiskRegulatoryExposure = z.infer<typeof RiskRegulatoryExposureSchema>;

/** WorkRiskProfile.securitySensitivity — RPH-DOC-002 §9.2 */
export const RiskSecuritySensitivitySchema = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']);
export type RiskSecuritySensitivity = z.infer<typeof RiskSecuritySensitivitySchema>;

/** WorkRiskProfile.uncertainty — RPH-DOC-002 §9.2 */
export const RiskUncertaintySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskUncertainty = z.infer<typeof RiskUncertaintySchema>;

/** RphError.category — RPH-DOC-007 §25 (10 values) */
export const RphErrorCategorySchema = z.enum([
	'VALIDATION',
	'AUTHORIZATION',
	'CONCURRENCY',
	'NOT_FOUND',
	'INVARIANT',
	'EXECUTION',
	'ASSURANCE',
	'PERSISTENCE',
	'EXTERNAL_DEPENDENCY',
	'SCHEMA_COMPATIBILITY'
]);
export type RphErrorCategory = z.infer<typeof RphErrorCategorySchema>;

/** SemanticViolation.severity — RPH-DOC-007 §37 */
export const SemanticViolationSeveritySchema = z.enum(['ERROR', 'WARNING']);
export type SemanticViolationSeverity = z.infer<typeof SemanticViolationSeveritySchema>;

/** ProfessionalWorkUnit.shapeIntegrityState — RPH-DOC-002 §7.5 (7 values) */
export const ShapeIntegrityStateSchema = z.enum([
	'UNKNOWN',
	'PRESERVED',
	'AT_RISK',
	'VIOLATED',
	'RESHAPING_REQUIRED',
	'RESHAPING_IN_PROGRESS',
	'RESTORED'
]);
export type ShapeIntegrityState = z.infer<typeof ShapeIntegrityStateSchema>;

/** ExecutionStep.stepState — RPH-DOC-002 §21 (10 values) */
export const StepStateSchema = z.enum([
	'NOT_READY',
	'READY',
	'QUEUED',
	'RUNNING',
	'WAITING',
	'SUCCEEDED',
	'FAILED',
	'SKIPPED',
	'CANCELLED',
	'SUPERSEDED'
]);
export type StepState = z.infer<typeof StepStateSchema>;

/** ExecutionStep.stepType — RPH-DOC-002 §21 (9 values) */
export const StepTypeSchema = z.enum([
	'MODEL_INVOCATION',
	'TOOL_INVOCATION',
	'RETRIEVAL',
	'TRANSFORMATION',
	'HUMAN_INTERACTION',
	'WAIT',
	'BRANCH',
	'PARALLEL_GROUP',
	'ASSURANCE_INVOCATION'
]);
export type StepType = z.infer<typeof StepTypeSchema>;

/** TraceLink.relation — RPH-DOC-007 §24 / DOC-002 §25 (17 values; DOC-007 governs TraceRelation) */
export const TraceRelationSchema = z.enum([
	'DERIVED_FROM',
	'REFINES',
	'DECOMPOSES',
	'SATISFIES',
	'DEPENDS_ON',
	'CONSTRAINED_BY',
	'ASSUMES',
	'PRODUCES',
	'SUPPORTS',
	'CONTRADICTS',
	'VERIFIES',
	'INVALIDATES',
	'SUPERSEDES',
	'PROMOTES',
	'ALLOCATES',
	'PROPAGATES',
	'GOVERNS'
]);
export type TraceRelation = z.infer<typeof TraceRelationSchema>;

/** ValidatorRegistryEntry.costClass — RPH-DOC-004 §35 */
export const ValidatorCostClassSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type ValidatorCostClass = z.infer<typeof ValidatorCostClassSchema>;

/** ValidatorContract.determinism — RPH-DOC-004 §4.1 */
export const ValidatorDeterminismSchema = z.enum([
	'DETERMINISTIC',
	'BOUNDED_NONDETERMINISTIC',
	'NONDETERMINISTIC'
]);
export type ValidatorDeterminism = z.infer<typeof ValidatorDeterminismSchema>;

/** ValidatorContract.implementationType — RPH-DOC-004 §4.1 */
export const ValidatorImplementationTypeSchema = z.enum([
	'MODEL',
	'DETERMINISTIC',
	'HYBRID',
	'HUMAN',
	'EXTERNAL_SERVICE'
]);
export type ValidatorImplementationType = z.infer<typeof ValidatorImplementationTypeSchema>;

/** ValidatorRegistryEntry.latencyClass — RPH-DOC-004 §35 */
export const ValidatorLatencyClassSchema = z.enum(['INTERACTIVE', 'STANDARD', 'LONG_RUNNING']);
export type ValidatorLatencyClass = z.infer<typeof ValidatorLatencyClassSchema>;

/** ValidatorRegistryEntry.status — RPH-DOC-004 §35 */
export const ValidatorRegistryStatusSchema = z.enum(['ACTIVE', 'DEGRADED', 'DISABLED']);
export type ValidatorRegistryStatus = z.infer<typeof ValidatorRegistryStatusSchema>;

/** ProfessionalWorkUnit.workLifecycleState — RPH-DOC-002 §7.2 (20 values) */
export const WorkLifecycleStateSchema = z.enum([
	'PROPOSED',
	'SHAPING',
	'READY',
	'PLANNED',
	'EXECUTING',
	'EVIDENCE_PENDING',
	'UNDER_ASSURANCE',
	'CONDITIONALLY_SATISFIED',
	'SATISFIED',
	'RECOMPOSING',
	'RECOMPOSED',
	'BASELINED',
	'BLOCKED',
	'CHALLENGED',
	'RESHAPING',
	'ESCALATED',
	'INVALIDATED',
	'REJECTED',
	'ABANDONED',
	'SUPERSEDED'
]);
export type WorkLifecycleState = z.infer<typeof WorkLifecycleStateSchema>;

/** Registry of every canonical enum schema, for introspection, JSON-Schema emission, and fidelity tests. */
export const CANONICAL_ENUM_SCHEMAS = {
	ActorType: ActorTypeSchema,
	AggregateAssuranceDisposition: AggregateAssuranceDispositionSchema,
	ApplicabilityExpressionOp: ApplicabilityExpressionOpSchema,
	ApplicabilityOutcome: ApplicabilityOutcomeSchema,
	AssumptionStatus: AssumptionStatusSchema,
	AssuranceAssessmentState: AssuranceAssessmentStateSchema,
	AssuranceDisposition: AssuranceDispositionSchema,
	AssuranceDispositionRecommendation: AssuranceDispositionRecommendationSchema,
	AssurancePolicyStatus: AssurancePolicyStatusSchema,
	AssuranceSeverity: AssuranceSeveritySchema,
	AssuranceState: AssuranceStateSchema,
	AssuranceViewAggregateDisposition: AssuranceViewAggregateDispositionSchema,
	AuthorityType: AuthorityTypeSchema,
	AuthorizationStatus: AuthorizationStatusSchema,
	BaselineStatus: BaselineStatusSchema,
	BaselineType: BaselineTypeSchema,
	ClaimStatus: ClaimStatusSchema,
	ClaimType: ClaimTypeSchema,
	CommandReceiptStatus: CommandReceiptStatusSchema,
	CommandResultStatus: CommandResultStatusSchema,
	CompatibilityMilestone: CompatibilityMilestoneSchema,
	ConstraintStatus: ConstraintStatusSchema,
	ConstraintStrength: ConstraintStrengthSchema,
	ConstraintType: ConstraintTypeSchema,
	ControlAction: ControlActionSchema,
	CoverageType: CoverageTypeSchema,
	CriterionResultOutcome: CriterionResultOutcomeSchema,
	CriterionType: CriterionTypeSchema,
	DecisionStatus: DecisionStatusSchema,
	DecisionType: DecisionTypeSchema,
	DecompositionContractStatus: DecompositionContractStatusSchema,
	EscalationTarget: EscalationTargetSchema,
	EvaluationMethod: EvaluationMethodSchema,
	EvidenceCardinality: EvidenceCardinalitySchema,
	EvidenceStatus: EvidenceStatusSchema,
	EvidenceType: EvidenceTypeSchema,
	ExecutionPlanStatus: ExecutionPlanStatusSchema,
	ExecutionState: ExecutionStateSchema,
	FailureSeverity: FailureSeveritySchema,
	IndependenceRequirement: IndependenceRequirementSchema,
	IntentStatus: IntentStatusSchema,
	Materiality: MaterialitySchema,
	MilestoneStatus: MilestoneStatusSchema,
	ObligationStatus: ObligationStatusSchema,
	ObligationStrength: ObligationStrengthSchema,
	ObligationType: ObligationTypeSchema,
	ObservationDisposition: ObservationDispositionSchema,
	ObservationType: ObservationTypeSchema,
	OriginType: OriginTypeSchema,
	OutboxStatus: OutboxStatusSchema,
	ProfessionalWorkObjectType: ProfessionalWorkObjectTypeSchema,
	RecompositionContractStatus: RecompositionContractStatusSchema,
	RequiredForDispositions: RequiredForDispositionsSchema,
	'WorkRiskProfile.consequence': RiskConsequenceSchema,
	RiskDimension: RiskDimensionSchema,
	'WorkRiskProfile.irreversibility': RiskIrreversibilitySchema,
	RiskLevel: RiskLevelSchema,
	'WorkRiskProfile.regulatoryExposure': RiskRegulatoryExposureSchema,
	'WorkRiskProfile.securitySensitivity': RiskSecuritySensitivitySchema,
	'WorkRiskProfile.uncertainty': RiskUncertaintySchema,
	RphErrorCategory: RphErrorCategorySchema,
	SemanticViolationSeverity: SemanticViolationSeveritySchema,
	ShapeIntegrityState: ShapeIntegrityStateSchema,
	StepState: StepStateSchema,
	StepType: StepTypeSchema,
	TraceRelation: TraceRelationSchema,
	ValidatorCostClass: ValidatorCostClassSchema,
	ValidatorDeterminism: ValidatorDeterminismSchema,
	ValidatorImplementationType: ValidatorImplementationTypeSchema,
	ValidatorLatencyClass: ValidatorLatencyClassSchema,
	ValidatorRegistryStatus: ValidatorRegistryStatusSchema,
	WorkLifecycleState: WorkLifecycleStateSchema
} as const;
