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
	completeExecutionStep,
	failExecutionStep,
	proposeExecutionPlan,
	retryExecutionStep,
	startExecutionStep
} from './execution.js';
import {
	authorizeRuntimeBinding,
	denyRuntimeBinding,
	requestRuntimeBinding,
	revokeRuntimeCapability
} from './runtime-binding.js';
import {
	admitEvidence,
	assertClaim,
	completeAssuranceAssessment,
	detectAssumption,
	createAssurancePolicy,
	invalidateEvidence,
	proposeEvidence,
	recordAssuranceObservation,
	requestAssuranceAssessment
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
	reviseDecomposition,
	validateDecomposition
} from './decomposition.js';
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
	ApplyTacticalChange: applyTacticalChange,
	StartExecutionStep: startExecutionStep,
	CompleteExecutionStep: completeExecutionStep,
	FailExecutionStep: failExecutionStep,
	RetryExecutionStep: retryExecutionStep,
	RequestRuntimeBinding: requestRuntimeBinding,
	AuthorizeRuntimeBinding: authorizeRuntimeBinding,
	DenyRuntimeBinding: denyRuntimeBinding,
	RevokeRuntimeCapability: revokeRuntimeCapability,
	// Assurance: evidence / claim / assumption / assessment / observation (DOC-002 §12, §15–19)
	ProposeEvidence: proposeEvidence,
	AdmitEvidence: admitEvidence,
	InvalidateEvidence: invalidateEvidence,
	AssertClaim: assertClaim,
	DetectAssumption: detectAssumption,
	CreateAssurancePolicy: createAssurancePolicy,
	RequestAssuranceAssessment: requestAssuranceAssessment,
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
	// Decomposition / recomposition (DOC-002 §13, §14)
	ProposeDecomposition: proposeDecomposition,
	ValidateDecomposition: validateDecomposition,
	ReviseDecomposition: reviseDecomposition,
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
