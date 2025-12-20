import { systemRouter } from './routes/system.js';
import { organizationRouter } from './routes/organization.js';
import { associationRouter } from './routes/association.js';
import { propertyRouter } from './routes/property.js';
import { unitRouter } from './routes/unit.js';
import { partyRouter } from './routes/party.js';
import { ownershipRouter } from './routes/ownership.js';

// Phase 3: Accounting domain
import {
	glAccountRouter,
	journalEntryRouter,
	assessmentRouter,
	paymentRouter,
	vendorRouter,
	apInvoiceRouter,
	bankAccountRouter
} from './routes/accounting/index.js';

// Phase 4: Work Orders & Assets
import {
	assetRouter,
	workOrderRouter,
	bidRouter
} from './routes/workOrder/index.js';

// Phase 5: Violations
import {
	violationRouter,
	violationTypeRouter,
	noticeTemplateRouter,
	appealRouter
} from './routes/violation/index.js';

import { arcRequestRouter, arcReviewRouter } from './routes/arc/index.js';
import {
	governanceBoardRouter,
	governanceMeetingRouter,
	governanceResolutionRouter
} from './routes/governance/index.js';
import { communicationRouter } from './routes/communication/index.js';
import { ownerPortalRouter } from './routes/ownerPortal.js';
import { documentRouter } from './routes/document.js';
import { reserveRouter } from './routes/reserve.js';
import { complianceRouter } from './routes/compliance.js';
import { contractorRouter } from './routes/contractor/index.js';
import { technicianRouter } from './routes/technician/index.js';
import { pricebookRouter } from './routes/pricebook/index.js';
import { customerRouter, jobRouter } from './routes/job/index.js';
import { dispatchRouter, slaRouter } from './routes/dispatch/index.js';
import {
	checklistRouter,
	timeEntryRouter,
	mediaRouter,
	signatureRouter,
	offlineSyncRouter
} from './routes/fieldTech/index.js';
import {
	estimateRouter,
	proposalRouter,
	invoiceRouter,
	jobPaymentRouter
} from './routes/billing/index.js';
import {
	supplierRouter,
	inventoryItemRouter,
	inventoryLocationRouter,
	stockRouter,
	transferRouter,
	usageRouter,
	purchaseOrderRouter
} from './routes/inventory/index.js';
import {
	serviceContractRouter,
	contractScheduleRouter,
	scheduledVisitRouter,
	contractSLARouter
} from './routes/contract/index.js';

// Phase 14: Cross-Tenant Features
import {
	serviceAreaRouter,
	workOrderViewRouter
} from './routes/serviceProvider/index.js';

// Phase 3: Concierge Property Owner Platform
import {
	propertyOwnershipRouter,
	delegatedAuthorityRouter,
	portfolioRouter,
	ownerIntentRouter,
	conciergeCaseRouter,
	conciergeActionRouter,
	externalHoaRouter,
	externalVendorRouter,
	materialDecisionRouter,
	propertyPortfolioRouter,
	individualPropertyRouter
} from './routes/concierge/index.js';

// Phase 4: Activity & Audit Subsystem
import { activityEventRouter } from './routes/activityEvent.js';

// Phase 16: Staff Management
import { staffRouter } from './routes/staff.js';
import { workQueueRouter } from './routes/workQueue.js';

// Phase 16.5: Vendor Discovery
import { vendorCandidateRouter } from './routes/vendorCandidate.js';
import { vendorBidRouter } from './routes/vendorBid.js';

// Phase 16.7: Communications
import { caseCommunicationRouter } from './routes/caseCommunication.js';

// Phase 16.11: Case Review
import { caseReviewRouter } from './routes/caseReview.js';

// Phase 15: Reporting & Analytics
import {
	reportDefinitionRouter,
	reportExecutionRouter,
	reportScheduleRouter,
	dashboardRouter
} from './routes/report/index.js';

/**
 * Main API router combining all domain routers
 *
 * URL structure:
 *   /api/v1/rpc/{domain}/{method}           - unversioned methods
 *   /api/v1/rpc/{domain}/{version}/{method} - versioned methods
 *
 * Examples:
 *   POST /api/v1/rpc/system/health
 *   POST /api/v1/rpc/workOrder/v1/create
 */
export const appRouter = {
	system: systemRouter,
	organization: organizationRouter,
	association: associationRouter,
	property: propertyRouter,
	unit: unitRouter,
	party: partyRouter,
	ownership: ownershipRouter,

	// Phase 3: Accounting domain
	glAccount: glAccountRouter,
	journalEntry: journalEntryRouter,
	assessment: assessmentRouter,
	payment: paymentRouter,
	vendor: vendorRouter,
	apInvoice: apInvoiceRouter,
	bankAccount: bankAccountRouter,

	// Phase 4: Work Orders & Assets
	asset: assetRouter,
	workOrder: workOrderRouter,
	bid: bidRouter,

	// Phase 5: Violations
	violation: violationRouter,
	violationType: violationTypeRouter,
	noticeTemplate: noticeTemplateRouter,
	violationAppeal: appealRouter,

	// Phase 6: ARC
	arcRequest: arcRequestRouter,
	arcReview: arcReviewRouter,

	// Phase 7: Governance
	governanceBoard: governanceBoardRouter,
	governanceMeeting: governanceMeetingRouter,
	governanceResolution: governanceResolutionRouter,

	// Phase 8: Communications
	communication: communicationRouter,

	// Phase 9: Owner Portal / CRM
	ownerPortal: ownerPortalRouter,

	// Phase 10: Documents & Records
	document: documentRouter,

	// Phase 11: Reserve Studies
	reserve: reserveRouter,

	// Phase 12: Compliance
	compliance: complianceRouter,
	contractor: contractorRouter,
	technician: technicianRouter,
	pricebook: pricebookRouter,

	// Phase 2: Job Lifecycle
	customer: customerRouter,
	job: jobRouter,

	// Phase 2: Dispatch & Scheduling
	dispatch: dispatchRouter,
	sla: slaRouter,

	// Phase 2: Field Technician Mobile
	checklist: checklistRouter,
	timeEntry: timeEntryRouter,
	jobMedia: mediaRouter,
	jobSignature: signatureRouter,
	offlineSync: offlineSyncRouter,

	// Phase 2: Estimates, Proposals & Invoicing
	estimate: estimateRouter,
	proposal: proposalRouter,
	jobInvoice: invoiceRouter,
	jobPayment: jobPaymentRouter,

	// Phase 2: Inventory, Materials & Procurement
	supplier: supplierRouter,
	inventoryItem: inventoryItemRouter,
	inventoryLocation: inventoryLocationRouter,
	stock: stockRouter,
	inventoryTransfer: transferRouter,
	materialUsage: usageRouter,
	purchaseOrder: purchaseOrderRouter,

	// Phase 2: Maintenance Contracts & Recurring Services
	serviceContract: serviceContractRouter,
	contractSchedule: contractScheduleRouter,
	scheduledVisit: scheduledVisitRouter,
	contractSLA: contractSLARouter,

	// Phase 14: Cross-Tenant Features (Service Provider Portal)
	serviceArea: serviceAreaRouter,
	serviceProviderWorkOrders: workOrderViewRouter,

	// Phase 15: Reporting & Analytics
	reportDefinition: reportDefinitionRouter,
	reportExecution: reportExecutionRouter,
	reportSchedule: reportScheduleRouter,
	dashboard: dashboardRouter,

	// Phase 3: Concierge Property Owner Platform
	propertyOwnership: propertyOwnershipRouter,
	delegatedAuthority: delegatedAuthorityRouter,
	portfolio: portfolioRouter,
	ownerIntent: ownerIntentRouter,
	conciergeCase: conciergeCaseRouter,
	conciergeAction: conciergeActionRouter,
	externalHoa: externalHoaRouter,
	externalVendor: externalVendorRouter,
	materialDecision: materialDecisionRouter,

	// Phase 17: Concierge Property Owner UX
	propertyPortfolio: propertyPortfolioRouter,
	individualProperty: individualPropertyRouter,

	// Phase 4: Activity & Audit Subsystem
	activityEvent: activityEventRouter,

	// Phase 16: Staff Management
	staff: staffRouter,
	workQueue: workQueueRouter,

	// Phase 16.5: Vendor Discovery
	vendorCandidate: vendorCandidateRouter,
	vendorBid: vendorBidRouter,

	// Phase 16.7: Communications
	caseCommunication: caseCommunicationRouter,

	// Phase 16.11: Case Review
	caseReview: caseReviewRouter
};

export type AppRouter = typeof appRouter;

// Re-export utilities
export { createEmptyContext, type RequestContext } from './context.js';
export { ApiException, ErrorCode, ErrorType } from './errors.js';
export {
	publicProcedure,
	authedProcedure,
	orgProcedure,
	adminProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from './router.js';

//permissions.ts is deprecated. We've implemented Cerbos.
//export {
//	Permission,
//	hasPermission,
//	hasAllPermissions,
//	hasAnyPermission,
//	requirePermission,
//	requireAllPermissions,
//	type PermissionType
//} from './permissions.js';
