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
	approveExecutionPlan,
	cancelExecutionPlan,
	proposeExecutionPlan
} from './execution.js';
import {
	admitEvidence,
	assertClaim,
	completeAssuranceAssessment,
	detectAssumption,
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
	// Execution plan (DOC-002 §20)
	ProposeExecutionPlan: proposeExecutionPlan,
	ApproveExecutionPlan: approveExecutionPlan,
	ActivateExecutionPlan: activateExecutionPlan,
	CancelExecutionPlan: cancelExecutionPlan,
	// Assurance: evidence / claim / assumption / assessment / observation (DOC-002 §12, §15–19)
	ProposeEvidence: proposeEvidence,
	AdmitEvidence: admitEvidence,
	InvalidateEvidence: invalidateEvidence,
	AssertClaim: assertClaim,
	DetectAssumption: detectAssumption,
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
	CompleteRecomposition: completeRecomposition
};
