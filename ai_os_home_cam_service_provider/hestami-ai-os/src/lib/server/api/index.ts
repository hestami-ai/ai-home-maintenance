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
	compliance: complianceRouter
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
