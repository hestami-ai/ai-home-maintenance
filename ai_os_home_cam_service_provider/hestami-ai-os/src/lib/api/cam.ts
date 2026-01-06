/**
 * CAM (Community Association Management) API client
 * Provides typed functions for calling oRPC backend endpoints
 * 
 * Types are extracted from types.generated.ts following the pipeline:
 * Prisma Schema → Zod Schemas → oRPC → OpenAPI → Generated Types → API Clients
 */

import { orpc } from './orpc.js';
import type { operations } from './types.generated';
import { waitForOrganization } from '$lib/stores/organization.js';

/**
 * Helper to ensure organization context is loaded before making API calls.
 * Wraps an async function to wait for organization first.
 */
async function withOrgContext<T>(fn: () => Promise<T>): Promise<T> {
	const org = await waitForOrganization();
	if (!org) {
		throw new Error('No organization context available. Please select an organization.');
	}
	return fn();
}

// ============================================================================
// Types - Extracted from types.generated.ts
// ============================================================================

// Core Types - Organization and Staff (for client-side use instead of Prisma types)
export type Organization = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];
export type Staff = operations['orgStaff.get']['responses']['200']['content']['application/json']['data']['staff'];

// Violation Types
export type Violation = operations['violation.list']['responses']['200']['content']['application/json']['data']['violations'][number];
export type ViolationDetail = operations['violation.get']['responses']['200']['content']['application/json']['data']['violation'];
export type ViolationStatus = operations['violation.list']['requestBody'] extends { content: { 'application/json': infer T } } ? NonNullable<T extends { status?: infer S } ? S : never> : never;
export type ViolationSeverity = operations['violation.list']['requestBody'] extends { content: { 'application/json': infer T } } ? NonNullable<T extends { severity?: infer S } ? S : never> : never;

// Violation Type
export type ViolationType = operations['violationType.list']['responses']['200']['content']['application/json']['data']['violationTypes'][number];

// ARC Request Types
export type ARCRequest = operations['arcRequest.list']['responses']['200']['content']['application/json']['data']['requests'][number];
export type ARCRequestDetail = operations['arcRequest.get']['responses']['200']['content']['application/json']['data']['request'];

// Work Order Types
export type WorkOrder = operations['workOrder.list']['responses']['200']['content']['application/json']['data']['workOrders'][number];
export type WorkOrderDetail = operations['workOrder.get']['responses']['200']['content']['application/json']['data']['workOrder'];

// ============================================================================
// Phase 11: Governance Types - Extracted from types.generated.ts
// ============================================================================

// Meeting Types
export type Meeting = operations['governanceMeeting.get']['responses']['200']['content']['application/json']['data']['meeting'];
export type MeetingListItem = operations['governanceMeeting.list']['responses']['200']['content']['application/json']['data']['meetings'][number];

// Board Motion Types - boardMotion routes don't exist in oRPC, using manual types
export type BoardMotionStatus = 'PROPOSED' | 'SECONDED' | 'UNDER_DISCUSSION' | 'UNDER_VOTE' | 'APPROVED' | 'DENIED' | 'TABLED' | 'WITHDRAWN';
export type BoardMotion = {
	id: string;
	title: string;
	status: BoardMotionStatus;
	description?: string;
	movedById: string;
	secondedById?: string;
};
export type BoardMotionListItem = BoardMotion;

// Resolution Types
export type Resolution = operations['governanceResolution.getResolution']['responses']['200']['content']['application/json']['data']['resolution'];
export type ResolutionListItem = operations['governanceResolution.listResolutions']['responses']['200']['content']['application/json']['data']['resolutions'][number];

// Governance Board Types
export type GovernanceBoard = operations['governanceBoard.get']['responses']['200']['content']['application/json']['data']['board'];
export type GovernanceBoardListItem = operations['governanceBoard.list']['responses']['200']['content']['application/json']['data']['boards'][number];

// ============================================================================
// Other Types - Extracted from types.generated.ts
// ============================================================================

// Unit Types
export type Unit = operations['unit.list']['responses']['200']['content']['application/json']['data']['units'][number];
export type UnitDetail = operations['unit.get']['responses']['200']['content']['application/json']['data']['unit'];

// Property Types
export type Property = operations['property.list']['responses']['200']['content']['application/json']['data']['properties'][number];
export type PropertyDetail = operations['property.get']['responses']['200']['content']['application/json']['data']['property'];

// Vendor Types
export type Vendor = operations['vendor.list']['responses']['200']['content']['application/json']['data']['vendors'][number];
export type VendorDetail = operations['vendor.get']['responses']['200']['content']['application/json']['data']['vendor'];

// Association Types
export type Association = operations['association.list']['responses']['200']['content']['application/json']['data']['associations'][number];
export type AssociationDetail = operations['association.get']['responses']['200']['content']['application/json']['data']['association'];
export type AssociationCreateInput = operations['association.create']['requestBody']['content']['application/json'];
export type AssociationUpdateInput = operations['association.update']['requestBody']['content']['application/json'];

// Document Types
export type Document = operations['document.listDocuments']['responses']['200']['content']['application/json']['data']['documents'][number];
export type DocumentDetail = operations['document.getDocument']['responses']['200']['content']['application/json']['data']['document'];

// Phase 28: Staff & Party Types
export type OrgStaffListItem = operations['orgStaff.list']['responses']['200']['content']['application/json']['data']['staff'][number];
export type OrgStaffDetail = operations['orgStaff.get']['responses']['200']['content']['application/json']['data']['staff'];
export type StaffStatus = OrgStaffListItem['status'];
export type StaffRole = OrgStaffListItem['roles'][number];
export type PillarAccess = OrgStaffListItem['pillarAccess'][number];
export type Party = operations['party.list']['responses']['200']['content']['application/json']['data']['parties'][number];

// ============================================================================
// Violation API - Using oRPC client
// ============================================================================

export const violationApi = {
	list: (params?: {
		status?: ViolationStatus;
		severity?: ViolationSeverity;
		unitId?: string;
		violationTypeId?: string;
		search?: string;
	}) => orpc.violation.list(params || {}),

	get: (id: string) => orpc.violation.get({ id }),

	create: (data: {
		violationTypeId: string;
		title: string;
		description: string;
		severity?: ViolationSeverity;
		unitId?: string;
		commonAreaName?: string;
		locationDetails?: string;
		observedDate: string;
		responsiblePartyId?: string;
		reporterType?: 'STAFF' | 'RESIDENT' | 'ANONYMOUS';
		idempotencyKey: string;
	}) => orpc.violation.create(data),

	update: (
		id: string,
		data: {
			title?: string;
			description?: string;
			severity?: ViolationSeverity;
			unitId?: string;
			commonAreaName?: string;
			locationDetails?: string;
			responsiblePartyId?: string;
			idempotencyKey: string;
		}
	) => orpc.violation.update({ id, ...data }),

	changeStatus: (
		id: string,
		data: {
			status: ViolationStatus;
			notes?: string;
			idempotencyKey: string;
		}
	) => orpc.violation.updateStatus({ id, ...data }),

	sendNotice: (
		id: string,
		data: {
			noticeType: 'WARNING' | 'FIRST_NOTICE' | 'SECOND_NOTICE' | 'FINAL_NOTICE' | 'FINE_NOTICE' | 'HEARING_NOTICE' | 'CURE_CONFIRMATION';
			subject: string;
			body: string;
			recipientName: string;
			recipientEmail?: string;
			recipientAddress?: string;
			deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'CERTIFIED_MAIL' | 'POSTED' | 'HAND_DELIVERED';
			curePeriodDays?: number;
		}
	) => orpc.violation.sendNotice({ violationId: id, ...data }),

	scheduleHearing: (
		id: string,
		data: {
			hearingDate: string;
			location?: string;
			notes?: string;
			idempotencyKey: string;
		}
	) => orpc.violation.scheduleHearing({ violationId: id, ...data }),

	assessFine: (
		id: string,
		data: {
			amount: number;
			fineType?: string;
			dueDate: string;
			notes?: string;
			idempotencyKey: string;
		}
	) => orpc.violation.assessFine({ violationId: id, ...data }),

	getNotices: (id: string) => orpc.violation.listNotices({ violationId: id }),

	getStatusHistory: (id: string) => orpc.violation.getStatusHistory({ violationId: id }),

	fileAppeal: (
		id: string,
		data: {
			reason: string;
			supportingDocumentIds?: string[];
			idempotencyKey: string;
		}
	) => orpc.violation.fileAppeal({ violationId: id, ...data }),

	getAppeal: (violationId: string) => orpc.violation.getAppeal({ violationId }),

	cure: (id: string, data?: { notes?: string }) => orpc.violation.cure({ id, ...data }),

	close: (id: string, data?: { notes?: string }) => orpc.violation.close({ id, ...data }),

	escalate: (id: string, data: { reason: string; idempotencyKey: string }) =>
		orpc.violation.escalate({ id, ...data }),

	resolve: (id: string, data: { notes: string; idempotencyKey: string }) =>
		orpc.violation.resolve({ id, ...data }),

	addEvidence: (data: {
		violationId: string;
		evidenceType: 'DOCUMENT' | 'PHOTO' | 'VIDEO' | 'AUDIO';
		fileName: string;
		fileUrl: string;
		fileSize?: number;
		mimeType?: string;
		description?: string;
		capturedAt?: string;
		gpsLatitude?: number;
		gpsLongitude?: number;
	}) => orpc.violation.addEvidence(data),

	listEvidence: (violationId: string) => orpc.violation.listEvidence({ violationId }),

	listHearings: (violationId: string) => orpc.violation.listHearings({ violationId }),

	listFines: (violationId: string) => orpc.violation.listFines({ violationId }),

	getPriorViolations: (data: { violationId: string; unitId?: string; violationTypeId?: string; limit?: number }) =>
		orpc.violation.getPriorViolations(data)
};

export const violationTypeApi = {
	list: () => orpc.violationType.list({}),
	get: (id: string) => orpc.violationType.get({ id })
};

// ============================================================================
// ARC Request API - Using oRPC client
// ============================================================================

// ARC Request category enum for type safety
export type ARCCategory = 'LANDSCAPING' | 'OTHER' | 'HVAC' | 'FENCE' | 'ROOF' | 'PAINT' | 'ADDITION' | 'WINDOWS' | 'DOORS' | 'DRIVEWAY' | 'GARAGE' | 'SOLAR';
export type ARCStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'DENIED' | 'TABLED' | 'WITHDRAWN' | 'EXPIRED' | 'CANCELLED';

export const arcRequestApi = {
	list: (params?: {
		associationId?: string;
		status?: ARCStatus;
		cursor?: string;
		limit?: number;
	}) => orpc.arcRequest.list(params || {}),

	get: (id: string) => orpc.arcRequest.get({ id }),

	create: (data: {
		associationId: string;
		requesterPartyId: string;
		title: string;
		description: string;
		category: ARCCategory;
		projectScope?: string;
		estimatedCost?: number;
		proposedStartDate?: string;
		proposedEndDate?: string;
		idempotencyKey: string;
	}) => orpc.arcRequest.create(data),

	getPriorPrecedents: (requestId: string, params?: { unitId?: string; category?: ARCCategory; limit?: number }) =>
		orpc.arcRequest.getPriorPrecedents({ requestId, ...params }),

	recordDecision: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) => orpc.arcRequest.recordDecision(data),

	requestInfo: (data: {
		requestId: string;
		infoNeeded: string;
		dueDate?: string;
		idempotencyKey: string;
	}) => orpc.arcRequest.requestInfo(data),

	submitInfo: (data: {
		requestId: string;
		response: string;
		documentIds?: string[];
		idempotencyKey: string;
	}) => orpc.arcRequest.submitInfo(data)
};

export const arcReviewApi = {
	getVotes: (requestId: string) => orpc.arcReview.getVotes({ requestId }),

	getCommitteeForRequest: (requestId: string) => orpc.arcReview.getCommitteeForRequest({ requestId }),

	submitReview: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) => orpc.arcReview.submitReview(data),

	recordDecision: (data: {
		requestId: string;
		action: 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE';
		notes?: string;
		conditions?: string;
		expiresAt?: string;
		idempotencyKey: string;
	}) => orpc.arcReview.recordDecision(data)
};

// ============================================================================
// Work Order API - Using oRPC client
// ============================================================================

// Work Order enums for type safety
export type WorkOrderStatus = 'DRAFT' | 'SUBMITTED' | 'TRIAGED' | 'AUTHORIZED' | 'ASSIGNED' | 'SCHEDULED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'REVIEW_REQUIRED' | 'INVOICED' | 'CLOSED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' | 'SCHEDULED';
export type WorkOrderCategory = 'EMERGENCY' | 'MAINTENANCE' | 'REPAIR' | 'INSPECTION' | 'INSTALLATION' | 'REPLACEMENT' | 'PREVENTIVE' | 'LANDSCAPING' | 'CLEANING' | 'SECURITY' | 'OTHER';

export const workOrderApi = {
	list: (params?: {
		status?: WorkOrderStatus;
		priority?: WorkOrderPriority;
		category?: WorkOrderCategory;
		unitId?: string;
		vendorId?: string;
		search?: string;
	}) => orpc.workOrder.list(params || {}),

	get: (id: string) => orpc.workOrder.get({ id }),

	create: (data: {
		title: string;
		description: string;
		category: WorkOrderCategory;
		priority: WorkOrderPriority;
		unitId?: string;
		commonAreaDescription?: string;
		vendorId?: string;
		slaDeadline?: string;
		idempotencyKey: string;
	}) => orpc.workOrder.create(data),

	updateStatus: (id: string, data: { status: WorkOrderStatus; notes?: string; idempotencyKey: string }) =>
		orpc.workOrder.updateStatus({ id, ...data }),

	assignVendor: (id: string, data: { vendorId: string; notes?: string; idempotencyKey: string }) =>
		orpc.workOrder.assignVendor({ id, ...data }),

	assignTechnician: (id: string, data: { technicianId: string; notes?: string; idempotencyKey: string }) =>
		orpc.workOrder.assignTechnician({ id, ...data }),

	schedule: (id: string, data: { scheduledStart: string; scheduledEnd?: string; technicianId?: string; notes?: string; idempotencyKey: string }) =>
		orpc.workOrder.schedule({ id, ...data }),

	complete: (id: string, data: { completionNotes?: string; actualCost?: number; idempotencyKey: string }) =>
		orpc.workOrder.complete({ id, ...data }),

	authorize: (data: { workOrderId: string; rationale: string; budgetSource: 'OPERATING' | 'RESERVE' | 'SPECIAL'; approvedAmount: number; constraints?: string }) =>
		orpc.workOrder.authorize(data),

	getStatusHistory: (id: string) => orpc.workOrder.getStatusHistory({ workOrderId: id }),

	addComment: (data: { workOrderId: string; comment: string; isInternal?: boolean }) =>
		orpc.workOrder.addComment(data),

	transitionStatus: (id: string, data: { toStatus: WorkOrderStatus; notes?: string; idempotencyKey: string }) =>
		orpc.workOrder.transitionStatus({ workOrderId: id, ...data })
};

// ============================================================================
// Unit API - Using oRPC client
// ============================================================================

// Unit type enum for type safety
export type UnitType = 'SINGLE_FAMILY_HOME' | 'CONDO_UNIT' | 'TOWNHOUSE' | 'LOT' | 'COMMERCIAL_UNIT';

export const unitApi = {
	list: (params?: {
		propertyId?: string;
		unitType?: UnitType;
		cursor?: string;
		limit?: number;
	}) => orpc.unit.list(params || {}),

	get: (id: string) => orpc.unit.get({ id }),

	create: (data: {
		propertyId: string;
		unitNumber: string;
		unitType: UnitType;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		bedrooms?: number;
		bathrooms?: number;
		squareFeet?: number;
		lotSquareFeet?: number;
		parkingSpaces?: number;
		assessmentClass?: string;
		votingWeight?: number;
	}) => orpc.unit.create(data),

	update: (id: string, data: {
		unitNumber?: string;
		unitType?: UnitType;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		bedrooms?: number;
		bathrooms?: number;
		squareFeet?: number;
		lotSquareFeet?: number;
		parkingSpaces?: number;
		assessmentClass?: string;
		votingWeight?: number;
	}) => orpc.unit.update({ id, ...data })
};

// ============================================================================
// Property API - Using oRPC client
// ============================================================================

// Property type enum for type safety
export type PropertyType = 'SINGLE_FAMILY' | 'CONDOMINIUM' | 'TOWNHOUSE' | 'COOPERATIVE' | 'MIXED_USE' | 'COMMERCIAL';

export const propertyApi = {
	list: (params?: {
		associationId?: string;
		propertyType?: PropertyType;
		cursor?: string;
		limit?: number;
	}) => orpc.property.list(params || {}),

	get: (id: string) => orpc.property.get({ id }),

	create: (data: {
		associationId: string;
		name: string;
		propertyType: PropertyType;
		addressLine1: string;
		addressLine2?: string;
		city: string;
		state: string;
		postalCode: string;
		latitude?: number;
		longitude?: number;
		yearBuilt?: number;
		totalUnits?: number;
		totalAcres?: number;
	}) => orpc.property.create(data),

	update: (id: string, data: {
		name?: string;
		propertyType?: PropertyType;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		latitude?: number;
		longitude?: number;
		yearBuilt?: number;
		totalUnits?: number;
		totalAcres?: number;
	}) => orpc.property.update({ id, ...data })
};

// ============================================================================
// Vendor API - Using oRPC client
// ============================================================================

export const vendorApi = {
	list: (params?: {
		isActive?: boolean;
		tradeCategory?: string;
		cursor?: string;
		limit?: number;
	}) => orpc.vendor.list(params || {}),

	get: (id: string) => orpc.vendor.get({ id }),

	create: (data: {
		name: string;
		tradeCategory: string;
		contactName?: string;
		contactEmail?: string;
		contactPhone?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		licenseNumber?: string;
		licenseExpiry?: string;
		insuranceExpiry?: string;
		notes?: string;
	}) => orpc.vendor.create(data),

	update: (id: string, data: {
		name?: string;
		tradeCategory?: string;
		contactName?: string;
		contactEmail?: string;
		contactPhone?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		licenseNumber?: string;
		licenseExpiry?: string;
		insuranceExpiry?: string;
		notes?: string;
		isActive?: boolean;
	}) => orpc.vendor.update({ id, ...data })
};

// ============================================================================
// Association API - Using oRPC client
// ============================================================================

export const associationApi = {
	list: (params?: { cursor?: string; limit?: number; status?: 'ACTIVE' | 'ONBOARDING' | 'SUSPENDED' | 'TERMINATED' }) =>
		orpc.association.list(params || {}),

	get: (id: string) => orpc.association.get({ id }),

	create: (data: AssociationCreateInput) => orpc.association.create(data),

	update: (data: AssociationUpdateInput) => orpc.association.update(data)
};

// ============================================================================
// Document API - Using oRPC client
// ============================================================================

// Document context type enum for type safety (matches oRPC schema)
export type DocumentContextType = 'ASSOCIATION' | 'PROPERTY' | 'UNIT' | 'JOB' | 'CASE' | 'WORK_ORDER' | 'TECHNICIAN' | 'CONTRACTOR' | 'VENDOR' | 'PARTY' | 'OWNER_INTENT' | 'VIOLATION' | 'ARC_REQUEST' | 'BOARD_MOTION' | 'RESOLUTION' | 'MEETING';

// Document category enum for type safety (matches oRPC schema)
export type DocumentCategory = 'GOVERNING_DOCS' | 'FINANCIAL' | 'MEETING' | 'LEGAL' | 'INSURANCE' | 'MAINTENANCE' | 'ARCHITECTURAL' | 'RESERVE_STUDY' | 'INSPECTION' | 'CONTRACT' | 'CC_AND_RS' | 'PERMIT' | 'APPROVAL' | 'CORRESPONDENCE' | 'TITLE_DEED' | 'SURVEY' | 'WARRANTY' | 'LICENSE' | 'CERTIFICATION' | 'BOND' | 'PROPOSAL' | 'ESTIMATE' | 'INVOICE' | 'WORK_ORDER' | 'VOICE_NOTE' | 'SIGNATURE' | 'CHECKLIST' | 'PHOTO' | 'VIDEO' | 'GENERAL';

// DocumentReference and DocumentVersion extracted from document operations
export type DocumentReference = operations['document.getReferences']['responses']['200']['content']['application/json']['data']['references'][number];
export type DocumentVersion = operations['document.getVersions']['responses']['200']['content']['application/json']['data']['versions'][number];

export type DocumentStatus = 'DRAFT' | 'PENDING_UPLOAD' | 'PROCESSING' | 'PROCESSING_FAILED' | 'INFECTED' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';

export const documentApi = {
	list: (params?: {
		category?: DocumentCategory;
		contextType?: DocumentContextType;
		contextId?: string;
		status?: DocumentStatus;
		search?: string;
		cursor?: string;
		limit?: number;
	}) => orpc.document.listDocuments(params || {}),

	get: (id: string) => orpc.document.getDocument({ id }),

	classify: (data: {
		id: string;
		category: DocumentCategory;
		reason: string;
		idempotencyKey: string;
	}) => orpc.document.classifyDocument(data),

	linkToContext: (data: {
		documentId: string;
		contextType: DocumentContextType;
		contextId: string;
		isPrimary?: boolean;
		bindingNotes?: string;
		idempotencyKey: string;
	}) => orpc.document.linkToContext(data),

	unlinkFromContext: (data: {
		documentId: string;
		contextType: DocumentContextType;
		contextId: string;
	}) => orpc.document.unlinkFromContext(data),

	getReferences: (documentId: string) => orpc.document.getReferences({ documentId }),

	getVersions: (documentId: string) => orpc.document.getVersions({ documentId }),

	getActivityHistory: (documentId: string) => orpc.document.getActivityHistory({ documentId }),

	getDownloadUrl: (id: string) => orpc.document.getDownloadUrl({ id })
};

// ============================================================================
// Activity Event API - Using oRPC client
// ============================================================================

// Activity entity type enum for type safety (matches oRPC schema)
export type ActivityEntityType = 'ASSOCIATION' | 'UNIT' | 'OWNER' | 'VIOLATION' | 'ARC_REQUEST' | 'ASSESSMENT' | 'GOVERNING_DOCUMENT' | 'BOARD_ACTION' | 'JOB' | 'WORK_ORDER' | 'ESTIMATE' | 'INVOICE' | 'TECHNICIAN' | 'CONTRACTOR' | 'INVENTORY' | 'CONCIERGE_CASE' | 'OWNER_INTENT' | 'INDIVIDUAL_PROPERTY' | 'PROPERTY_DOCUMENT' | 'MATERIAL_DECISION' | 'EXTERNAL_HOA' | 'EXTERNAL_VENDOR' | 'CONCIERGE_ACTION' | 'USER' | 'USER_ROLE' | 'ORGANIZATION' | 'DOCUMENT' | 'STAFF' | 'STAFF_ASSIGNMENT' | 'OTHER';

export const activityEventApi = {
	getByEntity: (params: { entityType: ActivityEntityType; entityId: string; cursor?: string; limit?: number }) =>
		orpc.activityEvent.getByEntity(params),

	getByOrganization: (params?: { cursor?: string; limit?: number }) =>
		orpc.activityEvent.getByOrganization(params || {}),

	getByCase: (params: { caseId: string; cursor?: string; limit?: number }) =>
		orpc.activityEvent.getByCase(params),

	getByJob: (params: { jobId: string; cursor?: string; limit?: number }) =>
		orpc.activityEvent.getByJob(params),

	search: (params: { query: string; entityTypes?: ActivityEntityType[]; startDate?: string; endDate?: string; cursor?: string; limit?: number }) =>
		orpc.activityEvent.search(params)
};

// ============================================================================
// Governance API - Using oRPC client
// ============================================================================

export const governanceApi = {
	boards: {
		list: (params?: { associationId?: string }) => orpc.governanceBoard.list(params || {}),
		get: (id: string) => orpc.governanceBoard.get({ id }),
		create: (data: { associationId: string; name: string; description?: string; idempotencyKey: string }) =>
			orpc.governanceBoard.create(data),
		addMember: (data: {
			boardId: string;
			partyId: string;
			role: 'PRESIDENT' | 'VICE_PRESIDENT' | 'SECRETARY' | 'TREASURER' | 'DIRECTOR' | 'MEMBER_AT_LARGE';
			termStart: string;
			termEnd?: string;
			idempotencyKey: string
		}) => orpc.governanceBoard.addMember(data),
		removeMember: (data: { boardId: string; memberId: string; idempotencyKey: string }) =>
			orpc.governanceBoard.removeMember(data)
	},
	meetings: {
		list: (params?: { associationId?: string; status?: 'SCHEDULED' | 'CANCELLED' | 'IN_SESSION' | 'ADJOURNED' | 'MINUTES_DRAFT' | 'MINUTES_APPROVED' | 'ARCHIVED' }) =>
			orpc.governanceMeeting.list(params || {}),

		get: (id: string) => orpc.governanceMeeting.get({ id }),

		create: (data: {
			associationId: string;
			boardId?: string;
			type: 'BOARD' | 'ANNUAL' | 'SPECIAL';
			title: string;
			description?: string;
			scheduledFor: string;
			location?: string;
			idempotencyKey: string;
		}) => orpc.governanceMeeting.create(data),

		startSession: (data: { meetingId: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.startSession(data),

		adjourn: (data: { meetingId: string; notes?: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.adjourn(data),

		submitMinutesDraft: (data: { meetingId: string; content: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.submitMinutesDraft(data),

		approveMinutes: (data: { meetingId: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.approveMinutes(data),

		archive: (data: { meetingId: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.archive(data),

		getQuorumStatus: (meetingId: string) =>
			orpc.governanceMeeting.getQuorumStatus({ meetingId }),

		addAgendaItem: (data: {
			meetingId: string;
			title: string;
			description?: string;
			order?: number;
			timeAllotment?: number;
			arcRequestId?: string;
			violationId?: string;
			workOrderId?: string;
			policyDocumentId?: string;
			idempotencyKey: string;
		}) => orpc.governanceMeeting.addAgendaItem(data),

		recordAttendance: (data: {
			meetingId: string;
			partyId: string;
			status?: 'PRESENT' | 'ABSENT' | 'EXCUSED';
			proxyForPartyId?: string;
			checkedInAt?: string;
			idempotencyKey: string;
		}) => orpc.governanceMeeting.recordAttendance(data),

		openVote: (data: {
			meetingId: string;
			agendaItemId?: string;
			question: string;
			method: 'IN_PERSON' | 'PROXY' | 'ELECTRONIC';
			quorumRequired?: number;
			idempotencyKey: string;
		}) => orpc.governanceMeeting.openVote(data),

		castBallot: (data: {
			voteId: string;
			voterPartyId: string;
			choice: 'YES' | 'NO' | 'ABSTAIN';
			hasConflictOfInterest?: boolean;
			conflictNotes?: string;
			idempotencyKey: string;
		}) => orpc.governanceMeeting.castBallot(data),

		getEligibleVoters: (voteId: string) =>
			orpc.governanceMeeting.getEligibleVoters({ voteId }),

		tallyVote: (voteId: string) =>
			orpc.governanceMeeting.tallyVote({ voteId }),

		closeVote: (data: { voteId: string; idempotencyKey: string }) =>
			orpc.governanceMeeting.closeVote(data)
	},
	resolutions: {
		list: (params?: { associationId?: string; status?: 'PROPOSED' | 'ADOPTED' | 'SUPERSEDED' | 'ARCHIVED' }) =>
			orpc.governanceResolution.listResolutions(params || {}),

		get: (id: string) => orpc.governanceResolution.getResolution({ id }),

		create: (data: {
			associationId: string;
			resolutionNumber: string;
			title: string;
			content: string;
			category?: string;
			effectiveDate?: string;
			expirationDate?: string;
			idempotencyKey: string;
		}) => orpc.governanceResolution.createResolution(data),

		updateStatus: (data: { id: string; status: 'PROPOSED' | 'ADOPTED' | 'SUPERSEDED' | 'ARCHIVED'; effectiveDate?: string; supersededById?: string; idempotencyKey: string }) =>
			orpc.governanceResolution.updateResolutionStatus(data),

		linkToMotion: (data: { resolutionId: string; motionId: string; idempotencyKey: string }) =>
			orpc.governanceResolution.linkToMotion(data)
	},
	// Phase 28: Committee management
	committees: {
		list: (params?: {
			associationId?: string;
			committeeType?: 'ARC' | 'SOCIAL' | 'LANDSCAPE' | 'BUDGET' | 'SAFETY' | 'NOMINATING' | 'CUSTOM';
			isActive?: boolean;
			cursor?: string;
			limit?: number;
		}) => orpc.governanceCommittee.list(params || {}),

		get: (id: string) => orpc.governanceCommittee.get({ id }),

		create: (data: {
			associationId: string;
			name: string;
			description?: string;
			committeeType: 'ARC' | 'SOCIAL' | 'LANDSCAPE' | 'BUDGET' | 'SAFETY' | 'NOMINATING' | 'CUSTOM';
			isArcLinked?: boolean;
			idempotencyKey: string;
		}) => orpc.governanceCommittee.create(data),

		update: (data: {
			id: string;
			name?: string;
			description?: string | null;
			committeeType?: 'ARC' | 'SOCIAL' | 'LANDSCAPE' | 'BUDGET' | 'SAFETY' | 'NOMINATING' | 'CUSTOM';
			isArcLinked?: boolean;
			isActive?: boolean;
			idempotencyKey: string;
		}) => orpc.governanceCommittee.update(data),

		addMember: (data: {
			committeeId: string;
			partyId: string;
			role: 'CHAIR' | 'VICE_CHAIR' | 'SECRETARY' | 'MEMBER';
			termStart: string;
			termEnd?: string;
			idempotencyKey: string;
		}) => orpc.governanceCommittee.addMember(data),

		removeMember: (data: {
			committeeId: string;
			memberId: string;
			idempotencyKey: string;
		}) => orpc.governanceCommittee.removeMember(data),

		listMembers: (params: {
			committeeId: string;
			isActive?: boolean;
			cursor?: string;
			limit?: number;
		}) => orpc.governanceCommittee.listMembers(params)
	}
};

// ============================================================================
// Phase 28: Org Staff API - Using oRPC client
// ============================================================================

export const orgStaffApi = {
	list: (params?: {
		status?: StaffStatus;
		role?: StaffRole;
		pillar?: PillarAccess;
		cursor?: string;
		limit?: number;
	}) => withOrgContext(() => orpc.orgStaff.list(params || {})),

	get: (staffId: string) => withOrgContext(() => orpc.orgStaff.get({ staffId })),

	create: (data: {
		email: string;
		displayName: string;
		title?: string;
		roles: StaffRole[];
		pillarAccess: PillarAccess[];
		canBeAssignedCases?: boolean;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.orgStaff.create(data)),

	update: (data: {
		staffId: string;
		displayName?: string;
		title?: string | null;
		roles?: StaffRole[];
		pillarAccess?: PillarAccess[];
		canBeAssignedCases?: boolean;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.orgStaff.update(data)),

	activate: (data: { staffId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.orgStaff.activate(data)),

	deactivate: (data: { staffId: string; reason: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.orgStaff.deactivate(data))
};

// ============================================================================
// Party API - Using oRPC client (for selection)
// ============================================================================

export const partyApi = {
	list: (params?: {
		search?: string;
		partyType?: 'INDIVIDUAL' | 'TRUST' | 'CORPORATION' | 'LLC' | 'PARTNERSHIP' | 'ESTATE';
		cursor?: string;
		limit?: number;
	}) => orpc.party.list(params || {})
};

// ============================================================================
// Report API - Using oRPC client
// ============================================================================

export type ReportCategory = 'GOVERNANCE' | 'FINANCIAL' | 'CUSTOM' | 'RECEIVABLES' | 'PAYABLES' | 'OPERATIONAL' | 'COMPLIANCE';

export const reportApi = {
	definitions: {
		list: (params?: { category?: ReportCategory; isActive?: boolean; pagination?: { cursor?: string; limit?: number } }) =>
			orpc.reportDefinition.list(params || {}),

		get: (id: string) => orpc.reportDefinition.get({ id }),

		create: (data: {
			code: string;
			name: string;
			description?: string;
			category: 'GOVERNANCE' | 'FINANCIAL' | 'CUSTOM' | 'RECEIVABLES' | 'PAYABLES' | 'OPERATIONAL' | 'COMPLIANCE';
			queryTemplate: string;
			outputFormat?: string;
			parameters?: Array<{ name: string; label: string; type: string; required: boolean; defaultValue?: string }>;
			idempotencyKey?: string;
		}) => orpc.reportDefinition.create(data)
	},

	execute: (data: { reportId: string; parametersJson?: string; format?: 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML'; idempotencyKey?: string }) =>
		orpc.reportExecution.generate(data),

	getExecution: (id: string) => orpc.reportExecution.get({ id }),

	listExecutions: (params?: { reportId?: string; status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; pagination?: { cursor?: string; limit?: number } }) =>
		orpc.reportExecution.list(params || {}),

	schedules: {
		list: (params?: { reportId?: string; isActive?: boolean; pagination?: { cursor?: string; limit?: number } }) =>
			orpc.reportSchedule.list(params || {}),

		get: (id: string) => orpc.reportSchedule.get({ id }),

		create: (data: {
			reportId: string;
			name: string;
			frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';
			cronExpression?: string;
			parametersJson?: string;
			format?: 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML';
			deliveryMethod?: 'EMAIL' | 'PORTAL' | 'BOTH';
			recipientsJson?: string;
			isActive?: boolean;
			idempotencyKey?: string;
		}) => orpc.reportSchedule.create(data),

		update: (id: string, data: {
			name?: string;
			cronExpression?: string;
			outputFormat?: string;
			parameters?: Record<string, unknown>;
			recipients?: string[];
			isActive?: boolean;
		}) => orpc.reportSchedule.update({ id, ...data }),

		runNow: (data: { id: string; idempotencyKey: string }) => orpc.reportSchedule.runNow(data)
	}
};

// ============================================================================
// Accounting API - Using oRPC client
// ============================================================================

export const accountingApi = {
	glAccounts: {
		list: (params?: { accountType?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; fundType?: 'OPERATING' | 'RESERVE' | 'SPECIAL'; isActive?: boolean; parentId?: string }) =>
			orpc.glAccount.list(params || {}),
		get: (id: string) => orpc.glAccount.get({ id }),
		create: (data: {
			accountNumber: string;
			name: string;
			accountType: string;
			category: string;
			description?: string;
			fundType?: string;
			parentId?: string;
		}) => orpc.glAccount.create(data as any)
	},
	journalEntries: {
		list: (params?: { status?: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED'; fromDate?: string; toDate?: string }) =>
			orpc.journalEntry.list(params || {}),
		get: (id: string) => orpc.journalEntry.get({ id }),
		create: (data: {
			entryDate: string;
			description: string;
			lines: Array<{ accountId: string; debitAmount?: number; creditAmount?: number; description?: string }>;
			referenceType?: string;
			referenceId?: string;
			idempotencyKey: string;
		}) => orpc.journalEntry.create(data),
		post: (data: { id: string; idempotencyKey: string }) => orpc.journalEntry.post(data)
	},
	assessments: {
		createType: (data: {
			name: string;
			code: string;
			frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ONE_TIME';
			defaultAmount: number;
			revenueAccountId: string;
			description?: string;
			lateFeePercentage?: number;
			lateFeeFixedAmount?: number;
			gracePeriodDays?: number;
			isRecurring?: boolean;
			prorateOnTransfer?: boolean;
		}) => orpc.assessment.createType(data),
		listTypes: (params?: { isActive?: boolean }) =>
			orpc.assessment.listTypes(params || {}),
		createCharge: (data: { unitId: string; assessmentTypeId: string; chargeDate: string; dueDate: string; amount: number; periodStart?: string; periodEnd?: string; description?: string; postToGL?: boolean }) =>
			orpc.assessment.createCharge(data),
		listCharges: (params?: { unitId?: string; status?: 'PENDING' | 'BILLED' | 'PARTIALLY_PAID' | 'PAID' | 'WRITTEN_OFF' | 'CREDITED'; fromDate?: string; toDate?: string }) =>
			orpc.assessment.listCharges(params || {}),
		getUnitBalance: (unitId: string) => orpc.assessment.getUnitBalance({ unitId })
	},
	payments: {
		list: (params?: { unitId?: string; status?: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'REFUNDED' | 'VOIDED'; fromDate?: string; toDate?: string }) =>
			orpc.payment.list(params || {}),
		get: (id: string) => orpc.payment.get({ id }),
		create: (data: { unitId: string; amount: number; paymentDate: string; paymentMethod: 'CASH' | 'CHECK' | 'ACH' | 'CREDIT_CARD' | 'WIRE' | 'OTHER'; referenceNumber?: string; notes?: string; idempotencyKey: string }) =>
			orpc.payment.create(data)
	},
	apInvoices: {
		list: (params?: { vendorId?: string; status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED'; fromDate?: string; toDate?: string }) =>
			orpc.apInvoice.list(params || {}),
		get: (id: string) => orpc.apInvoice.get({ id }),
		create: (data: {
			vendorId: string;
			invoiceNumber: string;
			invoiceDate: string;
			dueDate: string;
			description?: string;
			lines: Array<{ glAccountId: string; unitPrice: number; description: string; quantity?: number }>;
			idempotencyKey: string;
		}) => orpc.apInvoice.create(data),
		approve: (data: { id: string; idempotencyKey: string }) => orpc.apInvoice.approve(data)
	}
};

// ============================================================================
// Dashboard API (Phase 12) - Using oRPC client
// ============================================================================

// Dashboard types extracted from generated types
export type DashboardData = operations['dashboard.getData']['responses']['200']['content']['application/json']['data']['dashboard'];
export type DashboardFilters = operations['dashboard.getData']['requestBody'] extends { content: { 'application/json': infer T } } ? T : never;
export type DashboardRequiresAction = DashboardData['requiresAction'];
export type DashboardRiskCompliance = DashboardData['riskCompliance'];
export type DashboardFinancialAttention = DashboardData['financialAttention'];
export type DashboardRecentGovernance = DashboardData['recentGovernance'];
export type DashboardRecentGovernanceItem = DashboardRecentGovernance['items'][number];

export type DashboardEventType = 'DASHBOARD_VIEWED' | 'CARD_CLICKED' | 'FILTER_APPLIED';

export const dashboardApi = {
	getData: (filters?: DashboardFilters) => orpc.dashboard.getData(filters || {}),

	recordView: (data: {
		eventType: DashboardEventType;
		section?: string;
		card?: string;
		targetUrl?: string;
		filters?: DashboardFilters;
	}) => orpc.dashboard.recordView(data),

	getSummary: () => orpc.dashboard.getSummary({})
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

// ============================================================================
// Phase 13: Concierge Case API - Using oRPC client
// ============================================================================

// Concierge Case types extracted from generated types
export type ConciergeCase = operations['conciergeCase.list']['responses']['200']['content']['application/json']['data']['cases'][number];
export type ConciergeCaseDetail = operations['conciergeCase.getDetail']['responses']['200']['content']['application/json']['data'];
export type ConciergeCaseStatus = 'INTAKE' | 'ASSESSMENT' | 'IN_PROGRESS' | 'PENDING_EXTERNAL' | 'PENDING_OWNER' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type ConciergeCasePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY';
export type CaseNoteType = 'GENERAL' | 'CLARIFICATION_REQUEST' | 'CLARIFICATION_RESPONSE' | 'DECISION_RATIONALE';

// Additional case-related types for backward compatibility
export type CaseNote = ConciergeCaseDetail extends { notes: (infer T)[] } ? T : never;
export type CaseStatusHistoryItem = ConciergeCaseDetail extends { statusHistory: (infer T)[] } ? T : never;
export type CaseParticipant = ConciergeCaseDetail extends { participants: (infer T)[] } ? T : never;
export type CaseAction = ConciergeCaseDetail extends { actions: (infer T)[] } ? T : never;

export const conciergeCaseApi = {
	list: (params?: {
		status?: ConciergeCaseStatus;
		priority?: ConciergeCasePriority;
		propertyId?: string;
		assignedConciergeId?: string;
		cursor?: string;
		limit?: number;
	}) => withOrgContext(() => orpc.conciergeCase.list(params || {})),

	get: (id: string) => withOrgContext(() => orpc.conciergeCase.get({ id })),

	getDetail: (id: string) => withOrgContext(() => orpc.conciergeCase.getDetail({ id })),

	create: (data: {
		propertyId: string;
		title: string;
		description: string;
		priority?: ConciergeCasePriority;
		originIntentId?: string;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.conciergeCase.create(data)),

	updateStatus: (data: {
		id: string;
		status: ConciergeCaseStatus;
		reason?: string;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.conciergeCase.updateStatus(data)),

	assign: (data: { caseId: string; conciergeId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.assign({ id: data.caseId, assignedConciergeUserId: data.conciergeId, idempotencyKey: data.idempotencyKey })),

	resolve: (data: { caseId: string; resolutionSummary: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.resolve({ id: data.caseId, resolutionSummary: data.resolutionSummary, idempotencyKey: data.idempotencyKey })),

	close: (data: { caseId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.close({ id: data.caseId, idempotencyKey: data.idempotencyKey })),

	cancel: (data: { caseId: string; reason: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.cancel({ id: data.caseId, reason: data.reason, idempotencyKey: data.idempotencyKey })),

	addNote: (data: {
		caseId: string;
		content: string;
		noteType?: CaseNoteType;
		isInternal?: boolean;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.conciergeCase.addNote(data)),

	listNotes: (params: { caseId: string }) =>
		withOrgContext(() => orpc.conciergeCase.listNotes(params)),

	requestClarification: (data: { caseId: string; question: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.requestClarification(data)),

	respondToClarification: (data: { caseId: string; response: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.respondToClarification(data)),

	linkToArc: (data: { caseId: string; arcRequestId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.linkToArc(data)),

	linkToWorkOrder: (data: { caseId: string; workOrderId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.linkToWorkOrder(data)),

	linkToUnit: (data: { caseId: string; unitId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.linkToUnit(data)),

	linkToJob: (data: { caseId: string; jobId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.linkToJob(data)),

	getStatusHistory: (caseId: string) =>
		withOrgContext(() => orpc.conciergeCase.getStatusHistory({ caseId })),

	addParticipant: (data: {
		caseId: string;
		partyId?: string;
		externalContactName?: string;
		externalContactEmail?: string;
		externalContactPhone?: string;
		role: string;
		notes?: string;
		idempotencyKey: string;
	}) => withOrgContext(() => orpc.conciergeCase.addParticipant(data)),

	listParticipants: (caseId: string) =>
		withOrgContext(() => orpc.conciergeCase.listParticipants({ caseId })),

	removeParticipant: (data: { caseId: string; participantId: string; idempotencyKey: string }) =>
		withOrgContext(() => orpc.conciergeCase.removeParticipant(data)),

	listConcierges: () => withOrgContext(() => orpc.conciergeCase.listConcierges({}))
};

// ============================================================================
// Job API (Phase 15 - Contractor Job Lifecycle) - Using oRPC client
// ============================================================================

// Job types extracted from generated types
export type Job = operations['job.list']['responses']['200']['content']['application/json']['data']['jobs'][number];
export type JobDetail = operations['job.get']['responses']['200']['content']['application/json']['data']['job'];
export type JobStatus = 'LEAD' | 'TICKET' | 'ESTIMATE_REQUIRED' | 'ESTIMATE_SENT' | 'ESTIMATE_APPROVED' | 'JOB_CREATED' | 'SCHEDULED' | 'DISPATCHED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'INVOICED' | 'PAID' | 'WARRANTY' | 'CLOSED' | 'CANCELLED';
export type JobSourceType = 'WORK_ORDER' | 'VIOLATION' | 'ARC_REQUEST' | 'DIRECT_CUSTOMER' | 'LEAD' | 'RECURRING';
export type JobPriority = 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';

// Additional job-related types for backward compatibility
export type JobNote = operations['job.listNotes']['responses']['200']['content']['application/json']['data']['notes'][number];
export type JobStatusHistoryItem = operations['job.getStatusHistory']['responses']['200']['content']['application/json']['data']['history'][number];

export const jobApi = {
	list: (params?: {
		status?: JobStatus;
		sourceType?: JobSourceType;
		customerId?: string;
		assignedTechnicianId?: string;
		search?: string;
		cursor?: string;
		limit?: number;
	}) => orpc.job.list(params || {}),

	get: (id: string) => orpc.job.get({ id }),

	create: (data: {
		sourceType: JobSourceType;
		title: string;
		description?: string;
		category?: string;
		priority?: JobPriority;
		workOrderId?: string;
		violationId?: string;
		arcRequestId?: string;
		customerId?: string;
		unitId?: string;
		propertyId?: string;
		associationId?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		locationNotes?: string;
		estimatedHours?: number;
		estimatedCost?: number;
		idempotencyKey: string;
	}) => orpc.job.create(data),

	update: (data: {
		id: string;
		title?: string;
		description?: string;
		category?: string;
		priority?: JobPriority;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		locationNotes?: string;
		estimatedHours?: number;
		estimatedCost?: number;
		warrantyNotes?: string;
		resolutionNotes?: string;
		idempotencyKey: string;
	}) => orpc.job.update(data),

	transitionStatus: (data: {
		id: string;
		toStatus: JobStatus;
		notes?: string;
		idempotencyKey: string;
	}) => orpc.job.transitionStatus(data),

	assignTechnician: (data: {
		id: string;
		technicianId: string;
		branchId?: string;
		idempotencyKey: string;
	}) => orpc.job.assignTechnician(data),

	schedule: (data: {
		id: string;
		scheduledStart: string;
		scheduledEnd: string;
		idempotencyKey: string;
	}) => orpc.job.schedule(data),

	getStatusHistory: (jobId: string) => orpc.job.getStatusHistory({ jobId }),

	addNote: (data: {
		jobId: string;
		content: string;
		isInternal?: boolean;
		idempotencyKey: string;
	}) => orpc.job.addNote(data),

	listNotes: (params: { jobId: string; includeInternal?: boolean }) =>
		orpc.job.listNotes(params),

	delete: (data: { id: string; idempotencyKey: string }) =>
		orpc.job.delete(data)
};

// ============================================================================
// Estimate API (Phase 15 - Contractor Job Lifecycle) - Using oRPC client
// ============================================================================

// Estimate types extracted from generated types
export type Estimate = operations['estimate.list']['responses']['200']['content']['application/json']['data']['estimates'][number];
export type EstimateDetail = operations['estimate.get']['responses']['200']['content']['application/json']['data']['estimate'];
export type EstimateStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVISED';

// Additional estimate-related types for backward compatibility
export type EstimateLine = EstimateDetail extends { lines?: (infer T)[] } ? T : never;

export const estimateApi = {
	list: (params: { jobId?: string; customerId?: string; status?: EstimateStatus; cursor?: string; limit?: number }) =>
		orpc.estimate.list(params),

	get: (id: string) => orpc.estimate.get({ id }),

	create: (data: {
		jobId: string;
		customerId: string;
		title?: string;
		description?: string;
		notes?: string;
		terms?: string;
		validUntil?: string;
		discount?: number;
		lines?: Array<{ description: string; quantity: number; unitPrice: number; isTaxable?: boolean; taxRate?: number; pricebookItemId?: string }>;
		idempotencyKey: string;
	}) => orpc.estimate.create(data),

	update: (data: {
		id: string;
		notes?: string;
		terms?: string;
		validUntil?: string;
		discount?: number;
		idempotencyKey: string;
	}) => orpc.estimate.update(data),

	addLine: (data: {
		estimateId: string;
		description: string;
		quantity: number;
		unitPrice: number;
		isTaxable?: boolean;
		taxRate?: number;
		pricebookItemId?: string;
		idempotencyKey: string;
	}) => orpc.estimate.addLine(data),

	removeLine: (data: {
		estimateId: string;
		lineId: string;
		idempotencyKey: string;
	}) => orpc.estimate.removeLine(data),

	send: (data: { id: string; idempotencyKey: string }) => orpc.estimate.send(data),

	accept: (data: { id: string; idempotencyKey: string }) => orpc.estimate.accept(data),

	decline: (data: { id: string; reason?: string; idempotencyKey: string }) => orpc.estimate.decline(data),

	revise: (data: { id: string; idempotencyKey: string }) => orpc.estimate.revise(data)
};

// ============================================================================
// Invoice API (Phase 15 - Contractor Job Lifecycle) - Using oRPC client
// ============================================================================

// Invoice types extracted from generated types
export type JobInvoice = operations['jobInvoice.list']['responses']['200']['content']['application/json']['data']['invoices'][number];
export type JobInvoiceDetail = operations['jobInvoice.get']['responses']['200']['content']['application/json']['data']['invoice'];
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' | 'REFUNDED';

// Additional invoice-related types for backward compatibility
export type InvoiceLine = JobInvoiceDetail extends { lines?: (infer T)[] } ? T : never;
export type InvoicePayment = operations['jobPayment.list']['responses']['200']['content']['application/json']['data']['paymentIntents'][number];

export const invoiceApi = {
	list: (params: { jobId?: string; customerId?: string; status?: InvoiceStatus; cursor?: string; limit?: number }) =>
		orpc.jobInvoice.list(params),

	get: (id: string) => orpc.jobInvoice.get({ id }),

	createFromEstimate: (data: {
		estimateId: string;
		dueDate?: string;
		notes?: string;
		terms?: string;
		idempotencyKey: string;
	}) => orpc.jobInvoice.createFromEstimate(data),

	create: (data: {
		jobId: string;
		customerId: string;
		dueDate?: string;
		notes?: string;
		terms?: string;
		discount?: number;
		lines?: Array<{ description: string; quantity: number; unitPrice: number; isTaxable?: boolean; taxRate?: number }>;
		idempotencyKey: string;
	}) => orpc.jobInvoice.create(data),

	send: (data: { id: string; idempotencyKey: string }) => orpc.jobInvoice.send(data),

	recordPayment: (data: {
		id: string;
		amount: number;
		paymentMethod?: string;
		referenceNumber?: string;
		notes?: string;
		idempotencyKey: string;
	}) => orpc.jobInvoice.recordPayment(data),

	void: (data: { id: string; reason?: string; idempotencyKey: string }) => orpc.jobInvoice.void(data)
};

// ============================================================================
// Technician API (Phase 15 - Contractor Job Lifecycle) - Using oRPC client
// ============================================================================

// Technician types extracted from generated types
export type Technician = operations['technician.list']['responses']['200']['content']['application/json']['data']['technicians'][number];
export type TechnicianDetail = operations['technician.get']['responses']['200']['content']['application/json']['data']['technician'];

export const technicianApi = {
	list: (params?: { isActive?: boolean; cursor?: string; limit?: number }) =>
		orpc.technician.list(params || {}),

	get: (id: string) => orpc.technician.get({ id }),

	upsert: (data: {
		id?: string;
		firstName: string;
		lastName: string;
		email?: string;
		phone?: string;
		employeeId?: string;
		skills?: string[];
		certifications?: string[];
		isActive?: boolean;
		idempotencyKey: string;
	}) => orpc.technician.upsert(data)
};

// ============================================================================
// Job Document API - jobDocument route doesn't exist in oRPC, use documentApi instead
// ============================================================================

// Job Document types - manual definition for backward compatibility
export type JobDocument = {
	id: string;
	jobId: string;
	fileName: string;
	fileUrl: string;
	mimeType?: string;
	fileSize?: number;
	category?: string;
	description?: string;
	createdAt: string;
};

// Note: Use documentApi with contextType='JOB' and contextId=jobId instead of jobDocumentApi

/**
 * Fetch badge counts using oRPC endpoints
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
		// Note: oRPC endpoints use organization context from headers, not associationId parameter
		// The association is derived from the organization on the server side
		const [violationsRes, arcRes, workOrdersRes, vendorsRes] = await Promise.all([
			orpc.violation.list({}).catch(() => null),
			orpc.arcRequest.list({ status: 'SUBMITTED' }).catch(() => null),
			orpc.workOrder.list({}).catch(() => null),
			orpc.vendor.list({ isActive: true }).catch(() => null)
		]);

		if (violationsRes?.ok && violationsRes.data?.violations) {
			counts.openViolations = violationsRes.data.violations.filter((v: { status: string }) =>
				['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED'].includes(v.status)
			).length;
		}

		if (arcRes?.ok && arcRes.data?.requests) {
			counts.pendingArcRequests = arcRes.data.requests.length;
		}

		if (workOrdersRes?.ok && workOrdersRes.data?.workOrders) {
			const now = new Date();
			const workOrders = workOrdersRes.data.workOrders;
			counts.activeWorkOrders = workOrders.filter((wo: { status: string }) =>
				['SUBMITTED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(wo.status)
			).length;
			counts.overdueWorkOrders = workOrders.filter((wo: { slaDeadline?: string | null; status: string }) => {
				if (!wo.slaDeadline) return false;
				return new Date(wo.slaDeadline) < now && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status);
			}).length;
		}

		if (vendorsRes?.ok && vendorsRes.data?.vendors) {
			// Filter for vendors that need approval (this would need a proper status field in the vendor model)
			// For now, count all active vendors as a placeholder
			counts.pendingVendors = 0; // TODO: Add proper vendor approval status tracking
		}
	} catch (e) {
		console.error('Failed to fetch badge counts:', e);
	}

	return counts;
}
