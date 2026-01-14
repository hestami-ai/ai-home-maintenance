/**
 * DBOS Workflow Registry
 *
 * All workflows are registered here and exported for use in API routes.
 * 
 * IMPORTANT: Each workflow module calls DBOS.registerWorkflow() at module load time.
 * The re-exports below ensure all modules are loaded when this index is imported.
 * This must happen BEFORE DBOS.launch() is called.
 */

// Force side-effect imports to ensure all workflow modules are evaluated
// This prevents the bundler from lazy-loading workflow registrations
import './workOrderLifecycle.js';
import './workOrderLineItemWorkflow.js';
import './violationLifecycle.js';
import './violationCreateWorkflow.js';
import './arcReviewLifecycle.js';
import './assessmentPosting.js';
import './meetingLifecycle.js';
import './jobLifecycle.js';
import './jobCreateWorkflow.js';
import './estimateGeneration.js';
import './estimateCreateWorkflow.js';
import './dispatchAssignment.js';
import './slaWorkflow.js';
import './invoicePayment.js';
import './invoiceCreateWorkflow.js';
import './maintenanceContract.js';
import './complianceWorkflow.js';
import './inventoryWorkflow.js';
import './technicianWorkflow.js';
import './customerWorkflow.js';
import './pricebookWorkflow.js';
import './dispatchWorkflow.js';
import './contractWorkflow.js';
import './visitWorkflow.js';
import './scheduleWorkflow.js';
import './billingWorkflow.js';
import './jobWorkflow.js';
import './estimateWorkflow.js';
import './purchaseOrderWorkflow.js';
import './stockWorkflow.js';
import './transferWorkflow.js';
import './inventoryItemWorkflow.js';
import './inventoryLocationWorkflow.js';
import './supplierWorkflow.js';
import './usageWorkflow.js';
import './violationFineWorkflow.js';
import './timeEntryWorkflow.js';
import './checklistWorkflow.js';
import './mediaWorkflow.js';
import './offlineSyncWorkflow.js';
import './signatureWorkflow.js';
import './appealWorkflow.js';
import './dashboardWorkflow.js';
import './reportScheduleWorkflow.js';
import './reportDefinitionWorkflow.js';
import './reportExecutionWorkflow.js';
import './arcRequestWorkflow.js';
import './arcReviewWorkflow.js';
import './contractSLAWorkflow.js';
import './contractorComplianceWorkflow.js';
import './serviceAreaWorkflow.js';
import './noticeTemplateWorkflow.js';
import './contractorBranchWorkflow.js';
import './workOrderConfigWorkflow.js';
import './contractorProfileWorkflow.js';
import './governanceWorkflow.js';
import './reserveWorkflow.js';
import './violationWorkflow.js';
import './caseLifecycleWorkflow.js';
import './externalApprovalWorkflow.js';
import './conciergeActionWorkflow.js';
import './resolutionCloseoutWorkflow.js';
import './communicationWorkflow.js';
import './documentWorkflow.js';
import './ownerPortalWorkflow.js';
import './motionLifecycle.js';
import './resolutionCloseout.js';
import './associationWorkflow.js';
import './notificationWorkflow.js';
import './documentProcessingRetryWorkflow.js';
import './apInvoiceWorkflow.js';
import './assessmentWorkflow.js';
import './bankAccountWorkflow.js';
import './glAccountWorkflow.js';
import './journalEntryWorkflow.js';
import './paymentWorkflow.js';
import './vendorWorkflow.js';
import './workOrderMutationWorkflow.js';
import './delegatedAuthorityWorkflow.js';
import './externalHoaWorkflow.js';
import './externalVendorWorkflow.js';
import './individualPropertyWorkflow.js';
import './materialDecisionWorkflow.js';
import './ownerIntentWorkflow.js';
import './ownershipWorkflow.js';
import './propertyPortfolioWorkflow.js';
import './partyWorkflow.js';
import './staffWorkflow.js';
import './unitWorkflow.js';
import './documentCleanupWorkflow.js';
import './portfolioWorkflow.js';
import './propertyOwnershipWorkflow.js';
import './crossDomainIntegrationWorkflow.js';
import './bidWorkflow.js';
import './assetWorkflow.js';
import './organizationWorkflow.js';
import './vendorBidWorkflow.js';
import './vendorCandidateWorkflow.js';
import './propertyWorkflow.js';
import './caseCommunicationWorkflow.js';
import './caseReviewWorkflow.js';
import './systemSettingsWorkflow.js';

// Work Order Lifecycle (Phase 4)
export {
	workOrderLifecycle_v1,
	startWorkOrderTransition,
	getWorkOrderTransitionStatus,
	getWorkOrderTransitionError,
	type TransitionInput,
	type TransitionResult
} from './workOrderLifecycle.js';

// Work Order Line Item (Phase 4)
export {
	addLineItemWorkflow_v1,
	removeLineItemWorkflow_v1,
	startAddLineItemWorkflow,
	startRemoveLineItemWorkflow,
	type AddLineItemInput,
	type RemoveLineItemInput,
	type LineItemResult
} from './workOrderLineItemWorkflow.js';

// Violation Lifecycle (Phase 5)
export {
	violationLifecycle_v1,
	startViolationTransition,
	getViolationTransitionStatus,
	getViolationTransitionError,
	type ViolationTransitionInput,
	type ViolationTransitionResult
} from './violationLifecycle.js';

// Violation Create (Phase 5)
export {
	violationCreateWorkflow_v1,
	startViolationCreateWorkflow,
	getViolationCreateWorkflowStatus,
	type ViolationCreateInput,
	type ViolationCreateResult
} from './violationCreateWorkflow.js';

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

// Job Create (P2.10)
export {
	jobCreateWorkflow_v1,
	startJobCreateWorkflow,
	getJobCreateWorkflowStatus,
	type JobCreateInput,
	type JobCreateResult
} from './jobCreateWorkflow.js';

// Estimate Generation (P2.10)
export {
	estimateGeneration_v1,
	startEstimateGeneration,
	getEstimateGenerationStatus,
	getEstimateGenerationError,
	type EstimateGenerationInput,
	type EstimateGenerationResult
} from './estimateGeneration.js';

// Estimate Create (P2.10)
export {
	estimateCreateWorkflow_v1,
	startEstimateCreateWorkflow,
	getEstimateCreateWorkflowStatus,
	type EstimateCreateInput,
	type EstimateCreateResult,
	type EstimateLine
} from './estimateCreateWorkflow.js';

// Dispatch Assignment (P2.10)
export {
	dispatchAssignment_v1,
	startDispatchAssignment,
	getDispatchAssignmentStatus,
	getDispatchAssignmentError,
	type DispatchAssignmentInput,
	type DispatchAssignmentResult
} from './dispatchAssignment.js';

// SLA Workflow (P2.10)
export {
	slaWorkflow_v1,
	startSLAWorkflow,
	type SLAWorkflowInput,
	type SLAWorkflowResult,
	type SLAAction
} from './slaWorkflow.js';

// Invoice Payment (P2.10)
export {
	invoicePayment_v1,
	startInvoicePayment,
	getInvoicePaymentStatus,
	getInvoicePaymentError,
	type InvoicePaymentInput,
	type InvoicePaymentResult
} from './invoicePayment.js';

// Invoice Create (P2.10)
export {
	invoiceCreateWorkflow_v1,
	startInvoiceCreateWorkflow,
	getInvoiceCreateWorkflowStatus,
	type InvoiceCreateInput,
	type InvoiceCreateResult,
	type InvoiceLine
} from './invoiceCreateWorkflow.js';

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

// Technician Workflow (P2.10)
export {
	technicianWorkflow_v1,
	startTechnicianWorkflow,
	type TechnicianWorkflowInput,
	type TechnicianWorkflowResult,
	type TechnicianAction
} from './technicianWorkflow.js';

// Customer Workflow (P2.10)
export {
	customerWorkflow_v1,
	startCustomerWorkflow,
	type CustomerWorkflowInput,
	type CustomerWorkflowResult,
	type CustomerAction
} from './customerWorkflow.js';

// Pricebook Workflow (P2.10)
export {
	pricebookWorkflow_v1,
	startPricebookWorkflow,
	type PricebookWorkflowInput,
	type PricebookWorkflowResult,
	type PricebookAction
} from './pricebookWorkflow.js';

// Dispatch Workflow (P2.10)
export {
	dispatchWorkflow_v1,
	startDispatchWorkflow,
	type DispatchWorkflowInput,
	type DispatchWorkflowResult,
	type DispatchAction
} from './dispatchWorkflow.js';

// Service Contract Workflow (P2.10)
export {
	contractWorkflow_v1,
	startServiceContractWorkflow,
	type ServiceContractWorkflowInput,
	type ServiceContractWorkflowResult,
	type ContractAction as ServiceContractAction
} from './contractWorkflow.js';

// Visit Workflow (P2.10)
export {
	visitWorkflow_v1,
	startVisitWorkflow,
	type VisitWorkflowInput,
	type VisitWorkflowResult,
	type VisitAction
} from './visitWorkflow.js';

// Schedule Workflow (P2.10)
export {
	scheduleWorkflow_v1,
	startScheduleWorkflow,
	type ScheduleWorkflowInput,
	type ScheduleWorkflowResult,
	type ScheduleAction
} from './scheduleWorkflow.js';

// Billing Workflow (P2.10)
export {
	billingWorkflow_v1,
	startBillingWorkflow,
	type BillingWorkflowInput,
	type BillingWorkflowResult,
	type BillingAction
} from './billingWorkflow.js';

// Job Workflow (P2.11)
export {
	jobWorkflow_v1,
	startJobWorkflow,
	type JobWorkflowInput,
	type JobWorkflowResult,
	type JobAction
} from './jobWorkflow.js';

// Estimate Workflow (P2.12)
export {
	estimateWorkflow_v1,
	startEstimateWorkflow,
	type EstimateWorkflowInput,
	type EstimateWorkflowResult,
	type EstimateAction
} from './estimateWorkflow.js';

// Purchase Order Workflow (P2.13)
export {
	purchaseOrderWorkflow_v1,
	startPurchaseOrderWorkflow,
	type PurchaseOrderWorkflowInput,
	type PurchaseOrderWorkflowResult,
	type PurchaseOrderAction
} from './purchaseOrderWorkflow.js';

// Stock Workflow (P2.14)
export {
	stockWorkflow_v1,
	startStockWorkflow,
	type StockWorkflowInput,
	type StockWorkflowResult,
	type StockAction
} from './stockWorkflow.js';

// Transfer Workflow (P2.15)
export {
	transferWorkflow_v1,
	startTransferWorkflow,
	type TransferWorkflowInput,
	type TransferWorkflowResult,
	type TransferAction
} from './transferWorkflow.js';

// Inventory Item Workflow (P2.16)
export {
	inventoryItemWorkflow_v1,
	startInventoryItemWorkflow,
	type InventoryItemWorkflowInput,
	type InventoryItemWorkflowResult,
	type InventoryItemAction
} from './inventoryItemWorkflow.js';

// Inventory Location Workflow (P2.17)
export {
	inventoryLocationWorkflow_v1,
	startInventoryLocationWorkflow,
	type InventoryLocationWorkflowInput,
	type InventoryLocationWorkflowResult,
	type InventoryLocationAction
} from './inventoryLocationWorkflow.js';

// Supplier Workflow (P2.18)
export {
	supplierWorkflow_v1,
	startSupplierWorkflow,
	type SupplierWorkflowInput,
	type SupplierWorkflowResult,
	type SupplierAction
} from './supplierWorkflow.js';

// Usage Workflow (P2.19)
export {
	usageWorkflow_v1,
	startUsageWorkflow,
	type UsageWorkflowInput,
	type UsageWorkflowResult,
	type UsageAction
} from './usageWorkflow.js';

// Violation Fine Workflow (P2.20)
export {
	violationFineWorkflow_v1,
	startViolationFineWorkflow,
	type ViolationFineWorkflowInput,
	type ViolationFineWorkflowResult,
	type ViolationFineAction
} from './violationFineWorkflow.js';

// Time Entry Workflow (P2.21)
export {
	timeEntryWorkflow_v1,
	startTimeEntryWorkflow,
	type TimeEntryWorkflowInput,
	type TimeEntryWorkflowResult,
	type TimeEntryAction
} from './timeEntryWorkflow.js';

// Checklist Workflow (P2.22)
export {
	checklistWorkflow_v1,
	startChecklistWorkflow,
	type ChecklistWorkflowInput,
	type ChecklistWorkflowResult,
	type ChecklistAction
} from './checklistWorkflow.js';

// Media Workflow (P2.23)
export {
	mediaWorkflow_v1,
	startMediaWorkflow,
	type MediaWorkflowInput,
	type MediaWorkflowResult,
	type MediaAction
} from './mediaWorkflow.js';

// Offline Sync Workflow (P2.24)
export {
	offlineSyncWorkflow_v1,
	startOfflineSyncWorkflow,
	type OfflineSyncWorkflowInput,
	type OfflineSyncWorkflowResult,
	type OfflineSyncAction
} from './offlineSyncWorkflow.js';

// Signature Workflow (P2.25)
export {
	signatureWorkflow_v1,
	startSignatureWorkflow,
	type SignatureWorkflowInput,
	type SignatureWorkflowResult,
	type SignatureAction
} from './signatureWorkflow.js';

// Appeal Workflow (P2.26)
export {
	appealWorkflow_v1,
	startAppealWorkflow,
	type AppealWorkflowInput,
	type AppealWorkflowResult,
	type AppealAction
} from './appealWorkflow.js';

// Dashboard Workflow (P2.27)
export {
	dashboardWorkflow_v1,
	startDashboardWorkflow,
	type DashboardWorkflowInput,
	type DashboardWorkflowResult,
	type DashboardAction
} from './dashboardWorkflow.js';

// Report Schedule Workflow (P2.28)
export {
	reportScheduleWorkflow_v1,
	startReportScheduleWorkflow,
	type ReportScheduleWorkflowInput,
	type ReportScheduleWorkflowResult,
	type ReportScheduleAction
} from './reportScheduleWorkflow.js';

// Report Definition Workflow (P2.29)
export {
	reportDefinitionWorkflow_v1,
	startReportDefinitionWorkflow,
	type ReportDefinitionWorkflowInput,
	type ReportDefinitionWorkflowResult,
	type ReportDefinitionAction
} from './reportDefinitionWorkflow.js';

// Report Execution Workflow (P2.30)
export {
	reportExecutionWorkflow_v1,
	startReportExecutionWorkflow,
	type ReportExecutionWorkflowInput,
	type ReportExecutionWorkflowResult,
	type ReportExecutionAction
} from './reportExecutionWorkflow.js';

// ARC Request Workflow (P2.31)
export {
	arcRequestWorkflow_v1,
	startARCRequestWorkflow,
	type ARCRequestWorkflowInput,
	type ARCRequestWorkflowResult,
	type ARCRequestAction
} from './arcRequestWorkflow.js';

// ARC Review Workflow (P2.32)
export {
	arcReviewWorkflow_v1,
	startARCReviewWorkflow,
	type ARCReviewWorkflowInput,
	type ARCReviewWorkflowResult,
	type ARCReviewAction_WF
} from './arcReviewWorkflow.js';

// Contract SLA Workflow (P2.33)
export {
	contractSLAWorkflow_v1,
	startContractSLAWorkflow,
	type ContractSLAWorkflowInput,
	type ContractSLAWorkflowResult,
	type ContractSLAAction
} from './contractSLAWorkflow.js';

// Contractor Compliance Workflow (P2.34)
export {
	contractorComplianceWorkflow_v1,
	startContractorComplianceWorkflow,
	type ContractorComplianceWorkflowInput,
	type ContractorComplianceWorkflowResult,
	type ContractorComplianceAction
} from './contractorComplianceWorkflow.js';

// Service Area Workflow (P2.35)
export {
	serviceAreaWorkflow_v1,
	startServiceAreaWorkflow,
	type ServiceAreaWorkflowInput,
	type ServiceAreaWorkflowResult,
	type ServiceAreaAction
} from './serviceAreaWorkflow.js';

// Notice Template Workflow (P2.36)
export {
	noticeTemplateWorkflow_v1,
	startNoticeTemplateWorkflow,
	type NoticeTemplateWorkflowInput,
	type NoticeTemplateWorkflowResult,
	type NoticeTemplateAction
} from './noticeTemplateWorkflow.js';

// Contractor Branch Workflow (P2.37)
export {
	contractorBranchWorkflow_v1,
	startContractorBranchWorkflow,
	type ContractorBranchWorkflowInput,
	type ContractorBranchWorkflowResult,
	type ContractorBranchAction
} from './contractorBranchWorkflow.js';

// Work Order Config Workflow (P2.38)
export {
	workOrderConfigWorkflow_v1,
	startWorkOrderConfigWorkflow,
	type WorkOrderConfigWorkflowInput,
	type WorkOrderConfigWorkflowResult,
	type WorkOrderConfigAction
} from './workOrderConfigWorkflow.js';

// Contractor Profile Workflow (P2.39)
export {
	contractorProfileWorkflow_v1,
	startContractorProfileWorkflow,
	type ContractorProfileWorkflowInput,
	type ContractorProfileWorkflowResult,
	type ContractorProfileAction
} from './contractorProfileWorkflow.js';

// Governance Workflow (P2.40)
export {
	governanceWorkflow_v1,
	startGovernanceWorkflow,
	type GovernanceWorkflowInput,
	type GovernanceWorkflowResult,
	type GovernanceAction
} from './governanceWorkflow.js';

// Reserve Workflow (P2.41)
export {
	reserveWorkflow_v1,
	startReserveWorkflow,
	type ReserveWorkflowInput,
	type ReserveWorkflowResult,
	type ReserveAction
} from './reserveWorkflow.js';

// Violation Workflow (P2.42)
export {
	violationWorkflow_v1,
	startViolationWorkflow,
	type ViolationWorkflowInput,
	type ViolationWorkflowResult,
	type ViolationAction
} from './violationWorkflow.js';


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

// Communication Workflow (P3.10)
export {
	communicationWorkflow_v1,
	startCommunicationWorkflow,
	type CommunicationWorkflowInput,
	type CommunicationWorkflowResult,
	type CommunicationAction
} from './communicationWorkflow.js';

// Document Workflow (P3.10)
export {
	documentWorkflow_v1,
	startDocumentWorkflow,
	type DocumentWorkflowInput,
	type DocumentWorkflowResult,
	type DocumentAction
} from './documentWorkflow.js';

// Owner Portal Workflow (P3.10)
export {
	ownerPortalWorkflow_v1,
	startOwnerPortalWorkflow,
	type OwnerPortalWorkflowInput,
	type OwnerPortalWorkflowResult,
	type OwnerPortalAction
} from './ownerPortalWorkflow.js';

// Motion Lifecycle (Phase 11)
export {
	motionLifecycle_v1,
	startMotionTransition,
	getMotionTransitionStatus,
	type MotionTransitionInput,
	type MotionTransitionResult
} from './motionLifecycle.js';

// Resolution Closeout (Phase 11) - different from resolutionCloseoutWorkflow
export {
	resolutionCloseout_v1,
	startResolutionCloseout,
	getResolutionCloseoutStatus,
	type ResolutionCloseoutInput,
	type ResolutionCloseoutResult
} from './resolutionCloseout.js';

// Association Workflow (Phase 27)
export {
	createManagedAssociation_v1_wf,
	type CreateManagedAssociationInput,
	type CreateManagedAssociationResult,
	associationManagement_v1,
	startAssociationManagementWorkflow,
	AssociationManagementAction,
	type AssociationManagementInput,
	type AssociationManagementResult
} from './associationWorkflow.js';

// Notification Workflow (Phase 24)
export {
	notificationWorkflow_v1,
	NotificationAction,
	type NotificationWorkflowInput,
	type NotificationWorkflowResult
} from './notificationWorkflow.js';

// Document Processing Retry Workflow (Phase 24)
export {
	documentProcessingRetryWorkflow_v1,
	DocumentRetryAction,
	type DocumentRetryWorkflowInput,
	type DocumentRetryWorkflowResult
} from './documentProcessingRetryWorkflow.js';

// AP Invoice Workflow (Phase 13)
export {
	apInvoiceWorkflow_v1,
	startAPInvoiceWorkflow,
	APInvoiceAction,
	type APInvoiceWorkflowInput,
	type APInvoiceWorkflowResult,
	type APInvoiceLineInput
} from './apInvoiceWorkflow.js';

// Assessment Workflow (Phase 13)
export {
	assessmentWorkflow_v1,
	startAssessmentWorkflow,
	AssessmentWorkflowAction,
	type AssessmentWorkflowInput,
	type AssessmentWorkflowResult
} from './assessmentWorkflow.js';

// Bank Account Workflow (Phase 13)
export {
	bankAccountWorkflow_v1,
	startBankAccountWorkflow,
	BankAccountWorkflowAction,
	type BankAccountWorkflowInput,
	type BankAccountWorkflowResult
} from './bankAccountWorkflow.js';

// GL Account Workflow (Phase 13)
export {
	glAccountWorkflow_v1,
	startGLAccountWorkflow,
	GLAccountWorkflowAction,
	type GLAccountWorkflowInput,
	type GLAccountWorkflowResult
} from './glAccountWorkflow.js';

// Journal Entry Workflow (Phase 13)
export {
	journalEntryWorkflow_v1,
	startJournalEntryWorkflow,
	JournalEntryWorkflowAction,
	type JournalEntryWorkflowInput,
	type JournalEntryWorkflowResult,
	type JournalEntryLineInput
} from './journalEntryWorkflow.js';

// Payment Workflow (Phase 13)
export {
	paymentWorkflow_v1,
	startPaymentWorkflow,
	PaymentWorkflowAction,
	type PaymentWorkflowInput,
	type PaymentWorkflowResult
} from './paymentWorkflow.js';

// Vendor Workflow (Phase 13)
export {
	vendorWorkflow_v1,
	startVendorWorkflow,
	VendorWorkflowAction,
	type VendorWorkflowInput,
	type VendorWorkflowResult
} from './vendorWorkflow.js';

// Work Order Mutation Workflow (Phase 13)
export {
	workOrderMutationWorkflow_v1,
	startWorkOrderMutationWorkflow,
	WorkOrderMutationAction,
	type WorkOrderMutationInput,
	type WorkOrderMutationResult
} from './workOrderMutationWorkflow.js';

// Delegated Authority Workflow (Phase 3 Concierge)
export {
	delegatedAuthorityWorkflow_v1,
	startDelegatedAuthorityWorkflow,
	DelegatedAuthorityWorkflowAction,
	type DelegatedAuthorityWorkflowInput,
	type DelegatedAuthorityWorkflowResult
} from './delegatedAuthorityWorkflow.js';

// External HOA Workflow (Phase 3.7 Concierge)
export {
	externalHoaWorkflow_v1,
	startExternalHoaWorkflow,
	ExternalHoaWorkflowAction,
	type ExternalHoaWorkflowInput,
	type ExternalHoaWorkflowResult
} from './externalHoaWorkflow.js';

// External Vendor Workflow (Phase 3.8 Concierge)
export {
	externalVendorWorkflow_v1,
	startExternalVendorWorkflow,
	ExternalVendorWorkflowAction,
	type ExternalVendorWorkflowInput,
	type ExternalVendorWorkflowResult
} from './externalVendorWorkflow.js';

// Individual Property Workflow (Phase 17 Concierge)
export {
	individualPropertyWorkflow_v1,
	startIndividualPropertyWorkflow,
	IndividualPropertyWorkflowAction,
	type IndividualPropertyWorkflowInput,
	type IndividualPropertyWorkflowResult,
	type ExternalHoaInput
} from './individualPropertyWorkflow.js';

// Material Decision Workflow (Phase 3.9 Concierge)
export {
	materialDecisionWorkflow_v1,
	startMaterialDecisionWorkflow,
	MaterialDecisionWorkflowAction,
	type MaterialDecisionWorkflowInput,
	type MaterialDecisionWorkflowResult
} from './materialDecisionWorkflow.js';

// Owner Intent Workflow (Phase 3 Concierge)
export {
	ownerIntentWorkflow_v1,
	startOwnerIntentWorkflow,
	OwnerIntentWorkflowAction,
	type OwnerIntentWorkflowInput,
	type OwnerIntentWorkflowResult
} from './ownerIntentWorkflow.js';

// Property Portfolio Workflow (Phase 17 Concierge)
export {
	propertyPortfolioWorkflow_v1,
	startPropertyPortfolioWorkflow,
	PropertyPortfolioWorkflowAction,
	type PropertyPortfolioWorkflowInput,
	type PropertyPortfolioWorkflowResult
} from './propertyPortfolioWorkflow.js';

// Portfolio (Phase 3 Concierge)
export {
	portfolioWorkflow_v1,
	startPortfolioWorkflow,
	PortfolioWorkflowAction,
	type PortfolioWorkflowInput,
	type PortfolioWorkflowResult
} from './portfolioWorkflow.js';

// Property Ownership (Phase 3 Concierge)
export {
	propertyOwnershipWorkflow_v1,
	startPropertyOwnershipWorkflow,
	PropertyOwnershipWorkflowAction,
	type PropertyOwnershipWorkflowInput,
	type PropertyOwnershipWorkflowResult
} from './propertyOwnershipWorkflow.js';

// Cross-Domain Integration (Phase 1/2 Integration)
export {
	crossDomainIntegrationWorkflow_v1,
	startCrossDomainIntegrationWorkflow,
	CrossDomainIntegrationWorkflowAction,
	type CrossDomainIntegrationWorkflowInput,
	type CrossDomainIntegrationWorkflowResult
} from './crossDomainIntegrationWorkflow.js';

// Bid Workflow (Work Order Bidding)
export {
	bidWorkflow_v1,
	startBidWorkflow,
	BidWorkflowAction,
	type BidWorkflowInput,
	type BidWorkflowResult
} from './bidWorkflow.js';

// Asset Workflow (Asset Management)
export {
	assetWorkflow_v1,
	startAssetWorkflow,
	AssetWorkflowAction,
	type AssetWorkflowInput,
	type AssetWorkflowResult
} from './assetWorkflow.js';

// Organization Workflow
export {
	organizationWorkflow_v1,
	startOrganizationWorkflow,
	OrganizationWorkflowAction,
	type OrganizationWorkflowInput,
	type OrganizationWorkflowResult
} from './organizationWorkflow.js';

// Vendor Bid Workflow (Concierge)
export {
	vendorBidWorkflow_v1,
	startVendorBidWorkflow,
	VendorBidWorkflowAction,
	type VendorBidWorkflowInput,
	type VendorBidWorkflowResult
} from './vendorBidWorkflow.js';

// Vendor Candidate Workflow (Concierge)
export {
	vendorCandidateWorkflow_v1,
	startVendorCandidateWorkflow,
	VendorCandidateWorkflowAction,
	type VendorCandidateWorkflowInput,
	type VendorCandidateWorkflowResult
} from './vendorCandidateWorkflow.js';

// Property Workflow
export {
	propertyWorkflow_v1,
	startPropertyWorkflow,
	PropertyWorkflowAction,
	type PropertyWorkflowInput,
	type PropertyWorkflowResult
} from './propertyWorkflow.js';

// Case Communication Workflow
export {
	caseCommunicationWorkflow_v1,
	startCaseCommunicationWorkflow,
	CaseCommunicationAction,
	type CaseCommunicationWorkflowInput,
	type CaseCommunicationWorkflowResult
} from './caseCommunicationWorkflow.js';

// Case Review Workflow
export {
	caseReviewWorkflow_v1,
	startCaseReviewWorkflow,
	CaseReviewAction,
	type CaseReviewWorkflowInput,
	type CaseReviewWorkflowResult
} from './caseReviewWorkflow.js';

export {
	systemSettingsWorkflow_v1,
	startSystemSettingsWorkflow,
	SystemSettingsAction,
	type SystemSettingsWorkflowInput,
	type SystemSettingsWorkflowResult
} from './systemSettingsWorkflow.js';

// Future workflows:
// - apPaymentProcessing_v1 (Phase 13)
// - vendorAssignment_v1 (Phase 13)
// - documentReview_v1 (P3.10) - upload processing, malware scan, content moderation
