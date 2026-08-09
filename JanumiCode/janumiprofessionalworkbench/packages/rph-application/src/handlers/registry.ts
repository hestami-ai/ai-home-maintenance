// The command handler registry — commandType -> handler. dispatch() looks a command up here after the generic
// pre-stages (idempotency + payload validation). A command with no registered handler is REJECTED (the same
// posture the M4 skeleton had for everything but CaptureIntent), so the surface grows one handler group at a time.
import type { CommandHandler } from './kit.js';
import {
	approveIntent,
	beginIntentDiscovery,
	captureIntent,
	formalizeIntent,
	provisionIntent,
	reviseIntent
} from './intent.js';
import {
	abandonPwu,
	baselinePwu,
	blockPwu,
	beginPwuShaping,
	challengePwu,
	changePwuState,
	invalidatePwu,
	markPwuReady,
	escalatePwu,
	proposePwu,
	rejectPwu,
	reshapePwu,
	supersedePwu
} from './pwu.js';
import {
	activateExecutionPlan,
	applyTacticalChange,
	approveExecutionPlan,
	cancelExecutionPlan,
	cancelExecutionStep,
	completeExecutionPlan,
	completeExecutionStep,
	enterExecutionStepWait,
	failExecutionPlan,
	failExecutionStep,
	proposeExecutionPlan,
	resolveExecutionStepWait,
	pruneExecutionStep,
	retryExecutionStep,
	skipExecutionStep,
	startExecutionStep,
	supersedeExecutionPlan
} from './execution.js';
import {
	authorizeRuntimeBinding,
	denyRuntimeBinding,
	requestRuntimeBinding,
	revokeRuntimeCapability
} from './runtime-binding.js';
import { recordArtifact } from './artifact.js';
import {
	admitEvidence,
	activateAssurancePolicy,
	assertClaim,
	recordClaimAssessment,
	beginAssuranceAssessment,
	cancelAssuranceAssessment,
	completeAssuranceAssessment,
	detectAssumption,
	discloseAssumption,
	expireAssumption,
	falsifyAssumption,
	createAssurancePolicy,
	editAssurancePolicy,
	invalidateEvidence,
	proposeEvidence,
	recordAssuranceObservation,
	requestAssuranceAssessment,
	selectAssuranceEvaluator,
	submitEvidenceForAssessment,
	supersedeAssurancePolicy,
	suspendAssurancePolicy
} from './assurance.js';
import {
	disableValidator,
	enableValidator,
	markValidatorDegraded,
	registerValidator,
	restoreValidator
} from './validator-registry.js';
import {
	approveBaseline,
	approveDecision,
	createBaseline,
	denyWaiver,
	grantWaiver,
	promoteBaseline,
	proposeDecision,
	requestWaiver,
	revokeDecision,
	submitBaselineForReview,
	supersedeBaseline
} from './governance.js';
import {
	beginRecomposition,
	completeRecomposition,
	proposeDecomposition,
	proposeRecomposition,
	reviseDecomposition,
	validateDecomposition
} from './decomposition.js';
import { assertConstraint, assertObligation } from './obligation-constraint.js';
import { proposeHarness } from './harness.js';
import {
	createPwa,
	appendConversationEntries,
	createUndertaking,
	definePwuType,
	deletePwa,
	deprecatePwa,
	editPwa,
	editPwuType,
	publishPwa,
	removePwuType,
	retirePwa,
	submitPwaForReview,
	validatePwa
} from './pwa-authoring.js';

export const HANDLERS: Readonly<Record<string, CommandHandler>> = {
	// Intent lifecycle (DOC-002 §6)
	CaptureIntent: captureIntent,
	BeginIntentDiscovery: beginIntentDiscovery,
	ProvisionIntent: provisionIntent,
	FormalizeIntent: formalizeIntent,
	ApproveIntent: approveIntent,
	ReviseIntent: reviseIntent,
	// PWU lifecycle (DOC-002 §7, §8)
	ProposePwu: proposePwu,
	BeginPwuShaping: beginPwuShaping,
	MarkPwuReady: markPwuReady,
	ChangePwuState: changePwuState,
	ChallengePwu: challengePwu,
	ReshapePwu: reshapePwu,
	InvalidatePwu: invalidatePwu,
	SupersedePwu: supersedePwu,
	// JAN-PWUWP W-1 (REG-D-029): the two acts JPWB-DOC-001 §5.2 reserves to Governance finally have the
	// semantically named commands PER-3 requires, and their authority guards moved off the generic setter.
	AbandonPwu: abandonPwu,
	// JAN-PWUWP W-4.5: BASELINED had no command at all — promoteBaseline advances the Baseline, never the PWU.
	BaselinePwu: baselinePwu,
	// W-5: neither is a §5.2 act — PER-3 wants every arrow named, not every arrow authorized.
	BlockPwu: blockPwu,
	EscalatePwu: escalatePwu,
	RejectPwu: rejectPwu,
	// Execution plan + steps + runtime bindings (DOC-002 §20, §21, §22)
	ProposeExecutionPlan: proposeExecutionPlan,
	ApproveExecutionPlan: approveExecutionPlan,
	ActivateExecutionPlan: activateExecutionPlan,
	CancelExecutionPlan: cancelExecutionPlan,
	CompleteExecutionPlan: completeExecutionPlan,
	FailExecutionPlan: failExecutionPlan,
	SupersedeExecutionPlan: supersedeExecutionPlan,
	ApplyTacticalChange: applyTacticalChange,
	StartExecutionStep: startExecutionStep,
	CompleteExecutionStep: completeExecutionStep,
	FailExecutionStep: failExecutionStep,
	RetryExecutionStep: retryExecutionStep,
	SkipExecutionStep: skipExecutionStep,
	CancelExecutionStep: cancelExecutionStep,
	PruneExecutionStep: pruneExecutionStep,
	EnterExecutionStepWait: enterExecutionStepWait,
	ResolveExecutionStepWait: resolveExecutionStepWait,
	RequestRuntimeBinding: requestRuntimeBinding,
	AuthorizeRuntimeBinding: authorizeRuntimeBinding,
	DenyRuntimeBinding: denyRuntimeBinding,
	RevokeRuntimeCapability: revokeRuntimeCapability,
	// Artifacts — the recorded OUTPUT of work (DOC-009 §18.1; no ratified command/event, authored under the
	// 2026-07-16 grant to close `outputArtifactIds`' dangling reference)
	RecordArtifact: recordArtifact,
	// Assurance: evidence / claim / assumption / assessment / observation (DOC-002 §12, §15–19)
	ProposeEvidence: proposeEvidence,
	AdmitEvidence: admitEvidence,
	InvalidateEvidence: invalidateEvidence,
	AssertClaim: assertClaim,
	RecordClaimAssessment: recordClaimAssessment,
	DetectAssumption: detectAssumption,
	// The only route into the middle of the Assumption lifecycle — without it FALSIFIED is unreachable.
	DiscloseAssumption: discloseAssumption,
	ExpireAssumption: expireAssumption,
	// REG-F-069: the join between OBJ-4, the ratified AssumptionFalsified event, the orphan kernel
	// `assessFalsification`, and `canAuthorizeNewWork` — which already refused FALSIFIED and could never see it.
	FalsifyAssumption: falsifyAssumption,
	CreateAssurancePolicy: createAssurancePolicy,
	EditAssurancePolicy: editAssurancePolicy,
	SupersedeAssurancePolicy: supersedeAssurancePolicy,
	SuspendAssurancePolicy: suspendAssurancePolicy,
	ActivateAssurancePolicy: activateAssurancePolicy,
	RegisterValidator: registerValidator,
	MarkValidatorDegraded: markValidatorDegraded,
	RestoreValidator: restoreValidator,
	DisableValidator: disableValidator,
	EnableValidator: enableValidator,
	RequestAssuranceAssessment: requestAssuranceAssessment,
	SelectAssuranceEvaluator: selectAssuranceEvaluator,
	BeginAssuranceAssessment: beginAssuranceAssessment,
	CancelAssuranceAssessment: cancelAssuranceAssessment,
	SubmitEvidenceForAssessment: submitEvidenceForAssessment,
	CompleteAssuranceAssessment: completeAssuranceAssessment,
	RecordAssuranceObservation: recordAssuranceObservation,
	// Governance: decisions / waivers / baselines (DOC-002 §23, §24)
	ProposeDecision: proposeDecision,
	ApproveDecision: approveDecision,
	RevokeDecision: revokeDecision,
	RequestWaiver: requestWaiver,
	GrantWaiver: grantWaiver,
	DenyWaiver: denyWaiver,
	CreateBaseline: createBaseline,
	SubmitBaselineForReview: submitBaselineForReview,
	ApproveBaseline: approveBaseline,
	PromoteBaseline: promoteBaseline,
	SupersedeBaseline: supersedeBaseline,
	// Obligation / Constraint object plane (DOC-002 §10, §11; master WP-1-005/006) — mint the first-class
	// objects obligation-conservation (P2) and constraint-propagation (P3) decide over.
	AssertObligation: assertObligation,
	AssertConstraint: assertConstraint,
	// RecursiveProfessionalHarness — the durable RPH coordination object (JAN-IRP capability C7)
	ProposeHarness: proposeHarness,
	// Decomposition / recomposition (DOC-002 §13, §14)
	ProposeDecomposition: proposeDecomposition,
	ValidateDecomposition: validateDecomposition,
	ReviseDecomposition: reviseDecomposition,
	ProposeRecomposition: proposeRecomposition,
	BeginRecomposition: beginRecomposition,
	CompleteRecomposition: completeRecomposition,
	// PWA-authoring context (RPH-DOC-010 §6, §11, §20, §42)
	CreatePwa: createPwa,
	DeletePwa: deletePwa,
	AppendConversationEntries: appendConversationEntries,
	DefinePwuType: definePwuType,
	EditPwa: editPwa,
	EditPwuType: editPwuType,
	RemovePwuType: removePwuType,
	SubmitPwaForReview: submitPwaForReview,
	ValidatePwa: validatePwa,
	PublishPwa: publishPwa,
	DeprecatePwa: deprecatePwa,
	RetirePwa: retirePwa,
	CreateUndertaking: createUndertaking
};
