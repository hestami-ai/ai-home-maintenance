/**
 * CAM (Community Association Management) API client
 * Provides typed functions for calling oRPC backend endpoints
 */

import { apiCall } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Violation {
	id: string;
	violationNumber: string;
	title: string;
	description?: string;
	status: string;
	severity: string;
	observedDate: string;
	unitId: string | null;
	unitNumber?: string;
	responsiblePartyName?: string;
	noticeCount: number;
	totalFinesAssessed: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ViolationDetail extends Violation {
	commonAreaName?: string;
	locationDetails?: string;
	reportedDate: string;
	curePeriodEnds?: string;
	curedDate?: string;
	closedDate?: string;
	responsiblePartyId?: string;
	violationTypeId: string;
	violationType?: { id: string; name: string; code: string };
	unit?: { id: string; unitNumber: string };
	responsibleParty?: { id: string; partyType: string };
	createdAt: string;
	updatedAt: string;
}

export interface ViolationType {
	id: string;
	code: string;
	name: string;
	description?: string;
	defaultSeverity: string;
	defaultCurePeriodDays: number;
	isActive: boolean;
}

export interface ARCRequest {
	id: string;
	requestNumber: string;
	title: string;
	description?: string;
	status: string;
	category: string;
	unitId: string | null;
	unitNumber?: string;
	submitterName?: string;
	estimatedCost?: string;
	plannedStartDate?: string;
	plannedCompletionDate?: string;
	submittedAt: string;
	createdAt: string;
	updatedAt?: string;
}

export interface WorkOrder {
	id: string;
	workOrderNumber: string;
	title: string;
	description?: string;
	status: string;
	priority: string;
	category: string;
	unitId?: string;
	unitNumber?: string;
	locationDescription?: string;
	commonAreaDescription?: string;
	vendorId?: string;
	vendorName?: string;
	estimatedCost?: string;
	actualCost?: string;
	actualHours?: string;
	dueDate?: string;
	scheduledDate?: string;
	completedDate?: string;
	startedAt?: string;
	completedAt?: string;
	createdAt?: string;
	updatedAt?: string;
	// Phase 9: Origin tracking
	originType?: string;
	violationId?: string;
	arcRequestId?: string;
	resolutionId?: string;
	originNotes?: string;
	// Phase 9: Authorization
	authorizedBy?: string;
	authorizedAt?: string;
	authorizationRationale?: string;
	authorizingRole?: string;
	// Phase 9: Budget
	budgetSource?: string;
	approvedAmount?: string;
	spendToDate?: string;
	// Phase 9: Constraints and Board Approval
	constraints?: string;
	requiresBoardApproval?: boolean;
	boardApprovalVoteId?: string;
	boardApprovalStatus?: string;
}

export interface Unit {
	id: string;
	unitNumber: string;
	unitType: string;
	status: string;
	address?: string;
	squareFootage?: number;
	bedrooms?: number;
	bathrooms?: number;
	propertyId: string;
	propertyName?: string;
	ownerName?: string;
	tenantName?: string;
	createdAt?: string;
	property?: { id: string; name: string };
}

export interface Property {
	id: string;
	name: string;
	address: string;
	propertyType: string;
	status: string;
	unitCount?: number;
	commonAreaCount?: number;
	yearBuilt?: number;
	totalSquareFootage?: number;
	parkingSpaces?: number;
	amenities?: string[];
}

export interface Vendor {
	id: string;
	name: string;
	status: string;
	trades: string[];
	contactName?: string;
	email?: string;
	phone?: string;
	address?: string;
	licenseNumber?: string;
	licenseExpiry?: string;
	insuranceExpiry?: string;
	createdAt?: string;
}

export interface Association {
	id: string;
	name: string;
	legalName?: string;
	status: string;
	fiscalYearEnd: number;
	address?: string;
	phone?: string;
	email?: string;
	website?: string;
}

export interface Document {
	id: string;
	name: string;
	category: string;
	visibility: string;
	mimeType: string;
	size: number;
	contextType?: string;
	contextId?: string;
	createdAt: string;
}

// ============================================================================
// Violation API
// ============================================================================

export const violationApi = {
	list: (params?: {
		status?: string;
		severity?: string;
		unitId?: string;
		violationTypeId?: string;
		search?: string;
	}) =>
		apiCall<{ violations: Violation[] }>('violation/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ violation: ViolationDetail }>('violation/get', {
			body: { id }
		}),

	create: (data: {
		violationTypeId: string;
		title: string;
		description: string;
		severity?: string;
		unitId?: string;
		commonAreaName?: string;
		locationDetails?: string;
		observedDate: string;
		responsiblePartyId?: string;
		reporterType?: 'STAFF' | 'RESIDENT' | 'ANONYMOUS';
		idempotencyKey: string;
	}) =>
		apiCall<{ violation: { id: string; violationNumber: string; title: string; status: string; severity: string } }>(
			'violation/create',
			{ body: data }
		),

	update: (
		id: string,
		data: {
			title?: string;
			description?: string;
			severity?: string;
			unitId?: string;
			commonAreaName?: string;
			locationDetails?: string;
			responsiblePartyId?: string;
		}
	) =>
		apiCall<{ violation: ViolationDetail }>('violation/update', {
			body: { id, ...data }
		}),

	changeStatus: (
		id: string,
		data: {
			status: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ violation: { id: string; status: string } }>('violation/changeStatus', {
			body: { id, ...data }
		}),

	sendNotice: (
		id: string,
		data: {
			noticeType: string;
			templateId?: string;
			curePeriodDays?: number;
			deliveryMethod: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ notice: { id: string; noticeType: string } }>('violation/sendNotice', {
			body: { violationId: id, ...data }
		}),

	scheduleHearing: (
		id: string,
		data: {
			hearingDate: string;
			location?: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ hearing: { id: string; hearingDate: string } }>('violation/scheduleHearing', {
			body: { violationId: id, ...data }
		}),

	assessFine: (
		id: string,
		data: {
			amount: number;
			fineType?: string;
			dueDate: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ fine: { id: string; amount: string } }>('violation/assessFine', {
			body: { violationId: id, ...data }
		})
};

export const violationTypeApi = {
	list: () =>
		apiCall<{ violationTypes: ViolationType[] }>('violationType/list', {
			body: {}
		}),

	get: (id: string) =>
		apiCall<{ violationType: ViolationType }>('violationType/get', {
			body: { id }
		})
};

// ============================================================================
// ARC Request API
// ============================================================================

export const arcRequestApi = {
	list: (params?: {
		status?: string;
		category?: string;
		unitId?: string;
		search?: string;
	}) =>
		apiCall<{ requests: ARCRequest[] }>('arcRequest/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ request: ARCRequest }>('arcRequest/get', {
			body: { id }
		}),

	create: (data: {
		unitId?: string;
		title: string;
		description: string;
		category: string;
		projectScope?: string;
		estimatedCost?: number;
		plannedStartDate?: string;
		plannedCompletionDate?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ request: { id: string; requestNumber: string } }>('arcRequest/create', {
			body: data
		}),

	getPriorPrecedents: (requestId: string, params?: { unitId?: string; category?: string; limit?: number }) =>
		apiCall<{
			unitPrecedents: Array<{ id: string; requestNumber: string; title: string; status: string; category: string; decisionDate: string | null }>;
			categoryPrecedents: Array<{ id: string; requestNumber: string; title: string; status: string; category: string; decisionDate: string | null }>;
		}>('arcRequest/getPriorPrecedents', {
			body: { requestId, ...params }
		}),

	recordDecision: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ request: { id: string; status: string } }>('arcRequest/recordDecision', {
			body: data
		}),

	requestInfo: (data: {
		requestId: string;
		infoNeeded: string;
		dueDate?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ request: { id: string; status: string } }>('arcRequest/requestInfo', {
			body: data
		}),

	submitInfo: (data: {
		requestId: string;
		response: string;
		documentIds?: string[];
		idempotencyKey: string;
	}) =>
		apiCall<{ request: { id: string; status: string } }>('arcRequest/submitInfo', {
			body: data
		})
};

export const arcReviewApi = {
	getVotes: (requestId: string) =>
		apiCall<{
			votes: Array<{
				id: string;
				reviewerId: string;
				reviewerName: string | null;
				action: string;
				notes: string | null;
				conditions: string | null;
				createdAt: string;
			}>;
			summary: { total: number; approve: number; deny: number; requestChanges: number; table: number };
			quorum: { required: number | null; met: boolean; activeMembers: number };
			threshold: { required: number | null; current: number; met: boolean };
		}>('arcReview/getVotes', {
			body: { requestId }
		}),

	getCommitteeForRequest: (requestId: string) =>
		apiCall<{
			committee: {
				id: string;
				name: string;
				quorum: number | null;
				approvalThreshold: number | null;
				members: Array<{
					id: string;
					partyId: string;
					name: string | null;
					role: string | null;
					isChair: boolean;
					hasVoted: boolean;
					vote: string | null;
				}>;
			} | null;
		}>('arcReview/getCommitteeForRequest', {
			body: { requestId }
		}),

	submitReview: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ review: { id: string; requestId: string; action: string } }>('arcReview/submitReview', {
			body: data
		}),

	recordDecision: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ request: { id: string; status: string } }>('arcReview/recordDecision', {
			body: data
		})
};

// ============================================================================
// Work Order API
// ============================================================================

export const workOrderApi = {
	list: (params?: {
		status?: string;
		priority?: string;
		category?: string;
		unitId?: string;
		vendorId?: string;
		search?: string;
	}) =>
		apiCall<{ workOrders: WorkOrder[] }>('workOrder/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ workOrder: WorkOrder }>('workOrder/get', {
			body: { id }
		}),

	create: (data: {
		title: string;
		description: string;
		category: string;
		priority: string;
		unitId?: string;
		commonAreaDescription?: string;
		vendorId?: string;
		dueDate?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ workOrder: { id: string; workOrderNumber: string } }>('workOrder/create', {
			body: data
		}),

	update: (
		id: string,
		data: {
			title?: string;
			description?: string;
			category?: string;
			priority?: string;
			unitId?: string;
			commonAreaDescription?: string;
			vendorId?: string;
			dueDate?: string;
		}
	) =>
		apiCall<{ workOrder: WorkOrder }>('workOrder/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Unit API
// ============================================================================

export const unitApi = {
	list: (params?: {
		propertyId?: string;
		status?: string;
		unitType?: string;
		search?: string;
	}) =>
		apiCall<{ units: Unit[] }>('unit/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ unit: Unit }>('unit/get', {
			body: { id }
		}),

	create: (data: {
		propertyId: string;
		unitNumber: string;
		unitType: string;
		status?: string;
		address?: string;
		squareFootage?: number;
		bedrooms?: number;
		bathrooms?: number;
		floor?: number;
		idempotencyKey: string;
	}) =>
		apiCall<{ unit: { id: string; unitNumber: string } }>('unit/create', {
			body: data
		}),

	update: (
		id: string,
		data: {
			unitNumber?: string;
			unitType?: string;
			status?: string;
			address?: string;
			squareFootage?: number;
			bedrooms?: number;
			bathrooms?: number;
		}
	) =>
		apiCall<{ unit: Unit }>('unit/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Property API
// ============================================================================

export const propertyApi = {
	list: (params?: {
		status?: string;
		propertyType?: string;
		search?: string;
	}) =>
		apiCall<{ properties: Property[] }>('property/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ property: Property }>('property/get', {
			body: { id }
		}),

	create: (data: {
		name: string;
		address: string;
		propertyType: string;
		status?: string;
		yearBuilt?: number;
		totalSquareFootage?: number;
		parkingSpaces?: number;
		amenities?: string[];
		idempotencyKey: string;
	}) =>
		apiCall<{ property: { id: string; name: string } }>('property/create', {
			body: data
		}),

	update: (
		id: string,
		data: {
			name?: string;
			address?: string;
			propertyType?: string;
			status?: string;
			yearBuilt?: number;
			totalSquareFootage?: number;
			parkingSpaces?: number;
			amenities?: string[];
		}
	) =>
		apiCall<{ property: Property }>('property/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Vendor API
// ============================================================================

export const vendorApi = {
	list: (params?: {
		status?: string;
		trade?: string;
		search?: string;
	}) =>
		apiCall<{ vendors: Vendor[] }>('vendor/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ vendor: Vendor }>('vendor/get', {
			body: { id }
		}),

	create: (data: {
		name: string;
		trades: string[];
		contactName?: string;
		email?: string;
		phone?: string;
		address?: string;
		licenseNumber?: string;
		insuranceExpiry?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ vendor: { id: string; name: string } }>('vendor/create', {
			body: data
		}),

	update: (
		id: string,
		data: {
			name?: string;
			status?: string;
			trades?: string[];
			contactName?: string;
			email?: string;
			phone?: string;
			address?: string;
			licenseNumber?: string;
			insuranceExpiry?: string;
		}
	) =>
		apiCall<{ vendor: Vendor }>('vendor/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Association API
// ============================================================================

export const associationApi = {
	list: () =>
		apiCall<{ associations: Association[] }>('association/list', {
			body: {}
		}),

	get: (id: string) =>
		apiCall<{ association: Association }>('association/get', {
			body: { id }
		}),

	update: (
		id: string,
		data: {
			name?: string;
			legalName?: string;
			status?: string;
			fiscalYearEnd?: number;
			address?: string;
			phone?: string;
			email?: string;
			website?: string;
		}
	) =>
		apiCall<{ association: Association }>('association/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Document API
// ============================================================================

export const documentApi = {
	list: (params?: {
		category?: string;
		visibility?: string;
		contextType?: string;
		contextId?: string;
		search?: string;
	}) =>
		apiCall<{ documents: Document[] }>('document/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ document: Document }>('document/get', {
			body: { id }
		})
};

// ============================================================================
// Activity Event API
// ============================================================================

export const activityEventApi = {
	list: (params?: {
		entityType?: string;
		entityId?: string;
		contextType?: string;
		contextId?: string;
	}) =>
		apiCall<{
			events: Array<{
				id: string;
				action: string;
				summary: string;
				performedBy: string;
				createdAt: string;
			}>;
		}>('activityEvent/list', {
			body: params || {}
		})
};

// ============================================================================
// Governance API
// ============================================================================

export const governanceApi = {
	boards: {
		list: () =>
			apiCall<{
				boards: Array<{
					id: string;
					name: string;
					boardType: string;
					status: string;
				}>;
			}>('governanceBoard/list', { body: {} })
	},
	meetings: {
		list: (params?: { boardId?: string; status?: string }) =>
			apiCall<{
				meetings: Array<{
					id: string;
					title: string;
					meetingType: string;
					scheduledDate: string;
					status: string;
				}>;
			}>('governanceMeeting/list', { body: params || {} })
	},
	resolutions: {
		list: (params?: { status?: string }) =>
			apiCall<{
				resolutions: Array<{
					id: string;
					resolutionNumber: string;
					title: string;
					status: string;
					adoptedDate?: string;
				}>;
			}>('governanceResolution/list', { body: params || {} })
	}
};

// ============================================================================
// Report API
// ============================================================================

export const reportApi = {
	definitions: {
		list: (params?: { category?: string }) =>
			apiCall<{
				reports: Array<{
					id: string;
					name: string;
					description?: string;
					category: string;
					isSystem: boolean;
				}>;
			}>('reportDefinition/list', { body: params || {} })
	}
};

// ============================================================================
// Badge Counts API
// ============================================================================

export interface BadgeCounts {
	openViolations: number;
	pendingArcRequests: number;
	activeWorkOrders: number;
	overdueWorkOrders: number;
	pendingVendors: number;
}

export const badgeCountApi = {
	get: (associationId: string) =>
		apiCall<{ counts: BadgeCounts }>('cam/getBadgeCounts', { body: { associationId } })
};

/**
 * Fetch badge counts using direct API calls (fallback when oRPC endpoint not available)
 */
export async function fetchBadgeCounts(associationId: string): Promise<BadgeCounts> {
	const counts: BadgeCounts = {
		openViolations: 0,
		pendingArcRequests: 0,
		activeWorkOrders: 0,
		overdueWorkOrders: 0,
		pendingVendors: 0
	};

	try {
		const [violationsRes, arcRes, workOrdersRes, vendorsRes] = await Promise.all([
			fetch(`/api/violation?associationId=${associationId}`).catch(() => null),
			fetch(`/api/arc/request?associationId=${associationId}&status=SUBMITTED`).catch(() => null),
			fetch(`/api/work-order?associationId=${associationId}`).catch(() => null),
			fetch(`/api/vendor?associationId=${associationId}&status=PENDING`).catch(() => null)
		]);

		if (violationsRes?.ok) {
			const data = await violationsRes.json();
			if (data.ok && data.data?.items) {
				counts.openViolations = data.data.items.filter((v: { status: string }) =>
					['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'].includes(v.status)
				).length;
			}
		}

		if (arcRes?.ok) {
			const data = await arcRes.json();
			if (data.ok && data.data) {
				counts.pendingArcRequests = data.data.total || data.data.items?.length || 0;
			}
		}

		if (workOrdersRes?.ok) {
			const data = await workOrdersRes.json();
			if (data.ok && data.data?.items) {
				const now = new Date();
				const workOrders = data.data.items;
				counts.activeWorkOrders = workOrders.filter((wo: { status: string }) =>
					['SUBMITTED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(wo.status)
				).length;
				counts.overdueWorkOrders = workOrders.filter((wo: { dueDate?: string; status: string }) => {
					if (!wo.dueDate) return false;
					return new Date(wo.dueDate) < now && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status);
				}).length;
			}
		}

		if (vendorsRes?.ok) {
			const data = await vendorsRes.json();
			if (data.ok && data.data) {
				counts.pendingVendors = data.data.total || data.data.items?.length || 0;
			}
		}
	} catch (e) {
		console.error('Failed to fetch badge counts:', e);
	}

	return counts;
}
