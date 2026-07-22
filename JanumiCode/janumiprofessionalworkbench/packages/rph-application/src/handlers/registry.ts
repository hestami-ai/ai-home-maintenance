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
	beginPwuShaping,
	challengePwu,
	changePwuState,
	invalidatePwu,
	markPwuReady,
	proposePwu,
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
	failExecutionPlan,
	failExecutionStep,
	proposeExecutionPlan,
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
	completeAssuranceAssessment,
	detectAssumption,
	expireAssumption,
	createAssurancePolicy,
	editAssurancePolicy,
	invalidateEvidence,
	proposeEvidence,
	recordAssuranceObservation,
	requestAssuranceAssessment,
	submitEvidenceForAssessment,
	supersedeAssurancePolicy,
	suspendAssurancePolicy
} from './assurance.js';
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
	DetectAssumption: detectAssumption,
	ExpireAssumption: expireAssumption,
	CreateAssurancePolicy: createAssurancePolicy,
	EditAssurancePolicy: editAssurancePolicy,
	SupersedeAssurancePolicy: supersedeAssurancePolicy,
	SuspendAssurancePolicy: suspendAssurancePolicy,
	ActivateAssurancePolicy: activateAssurancePolicy,
	RequestAssuranceAssessment: requestAssuranceAssessment,
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
