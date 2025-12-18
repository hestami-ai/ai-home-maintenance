/**
 * DBOS Workflow Registry
 *
 * All workflows are registered here and exported for use in API routes.
 */

// Work Order Lifecycle (Phase 4)
export {
	workOrderLifecycle_v1,
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError,
	type TransitionInput,
	type TransitionResult
} from './workOrderLifecycle.js';

// Violation Lifecycle (Phase 5)
export {
	violationLifecycle_v1,
	startViolationTransition,
	getViolationTransitionStatus,
	getViolationTransitionError,
	type ViolationTransitionInput,
	type ViolationTransitionResult
} from './violationLifecycle.js';

// ARC Review Lifecycle (Phase 6)
export {
	arcReviewLifecycle_v1,
	startARCReviewTransition,
	getARCReviewTransitionStatus,
	getARCReviewTransitionError,
	type ARCTransitionInput,
	type ARCTransitionResult
} from './arcReviewLifecycle.js';

// Assessment Posting (Phase 13)
export {
	assessmentPosting_v1,
	startAssessmentPosting,
	getAssessmentPostingStatus,
	type AssessmentPostingInput,
	type AssessmentPostingResult
} from './assessmentPosting.js';

// Meeting Lifecycle (Phase 13)
export {
	meetingLifecycle_v1,
	startMeetingTransition,
	getMeetingTransitionStatus,
	type MeetingTransitionInput,
	type MeetingTransitionResult
} from './meetingLifecycle.js';

// Job Lifecycle (P2.10)
export {
	jobLifecycle_v1,
	startJobTransition,
	getJobTransitionStatus,
	getJobTransitionError,
	type JobTransitionInput,
	type JobTransitionResult
} from './jobLifecycle.js';

// Estimate Generation (P2.10)
export {
	estimateGeneration_v1,
	startEstimateGeneration,
	getEstimateGenerationStatus,
	getEstimateGenerationError,
	type EstimateGenerationInput,
	type EstimateGenerationResult
} from './estimateGeneration.js';

// Dispatch Assignment (P2.10)
export {
	dispatchAssignment_v1,
	startDispatchAssignment,
	getDispatchAssignmentStatus,
	getDispatchAssignmentError,
	type DispatchAssignmentInput,
	type DispatchAssignmentResult
} from './dispatchAssignment.js';

// Invoice Payment (P2.10)
export {
	invoicePayment_v1,
	startInvoicePayment,
	getInvoicePaymentStatus,
	getInvoicePaymentError,
	type InvoicePaymentInput,
	type InvoicePaymentResult
} from './invoicePayment.js';

// Maintenance Contract (P2.10)
export {
	maintenanceContract_v1,
	startMaintenanceContractWorkflow,
	getMaintenanceContractWorkflowStatus,
	getMaintenanceContractWorkflowError,
	type ContractWorkflowInput,
	type ContractWorkflowResult
} from './maintenanceContract.js';

// Compliance Workflow (P2.10)
export {
	complianceWorkflow_v1,
	startComplianceWorkflow,
	getComplianceWorkflowStatus,
	getComplianceWorkflowError,
	type ComplianceWorkflowInput,
	type ComplianceWorkflowResult
} from './complianceWorkflow.js';

// Inventory Workflow (P2.10)
export {
	inventoryWorkflow_v1,
	startInventoryWorkflow,
	getInventoryWorkflowStatus,
	getInventoryWorkflowError,
	type InventoryWorkflowInput,
	type InventoryWorkflowResult
} from './inventoryWorkflow.js';

// Workflow Version Registry
export {
	WORKFLOW_REGISTRY,
	getCurrentWorkflowVersion,
	getWorkflowVersions,
	getCurrentWorkflows,
	getDeprecatedWorkflows,
	getWorkflowsByPhase,
	getWorkflowSummary,
	type WorkflowVersion,
	type WorkflowStatus
} from './registry.js';

// Phase 3: Concierge Platform Workflows

// Case Lifecycle (P3.10)
export {
	caseLifecycleWorkflow_v1,
	startCaseLifecycleWorkflow,
	getCaseLifecycleWorkflowStatus,
	type CaseLifecycleWorkflowInput,
	type CaseLifecycleWorkflowResult
} from './caseLifecycleWorkflow.js';

// External Approval Tracking (P3.10)
export {
	externalApprovalWorkflow_v1,
	startExternalApprovalWorkflow,
	getExternalApprovalWorkflowStatus,
	type ExternalApprovalWorkflowInput,
	type ExternalApprovalWorkflowResult
} from './externalApprovalWorkflow.js';

// Concierge Action Execution (P3.10)
export {
	conciergeActionWorkflow_v1,
	startConciergeActionWorkflow,
	getConciergeActionWorkflowStatus,
	type ConciergeActionWorkflowInput,
	type ConciergeActionWorkflowResult
} from './conciergeActionWorkflow.js';

// Resolution Closeout (P3.10)
export {
	resolutionCloseoutWorkflow_v1,
	startResolutionCloseoutWorkflow,
	getResolutionCloseoutWorkflowStatus,
	type ResolutionCloseoutWorkflowInput,
	type ResolutionCloseoutWorkflowResult
} from './resolutionCloseoutWorkflow.js';

// Future workflows:
// - apPaymentProcessing_v1 (Phase 13)
// - vendorAssignment_v1 (Phase 13)
// - documentReview_v1 (P3.10) - upload processing, malware scan, content moderation
