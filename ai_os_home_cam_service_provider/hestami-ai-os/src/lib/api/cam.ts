/**
 * CAM (Community Association Management) API client
 * Provides typed functions for calling oRPC backend endpoints
 */

import { apiCall } from './client';
import { orpc } from './index';

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
	resolvedDate?: string;
	dueDate?: string;
	curePeriodDays?: number;
	responsiblePartyId?: string;
	violationTypeId: string;
	violationTypeName?: string;
	violationTypeRuleText?: string;
	violationType?: { id: string; name: string; code: string };
	unit?: { id: string; unitNumber: string };
	responsibleParty?: { id: string; partyType: string };
	hasHoaConflict?: boolean;
	hoaConflictNotes?: string;
	hasAppeal?: boolean;
	appealStatus?: string;
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
	submitterId?: string;
	submitterName?: string;
	projectScope?: string;
	estimatedCost?: string | number;
	plannedStartDate?: string;
	plannedCompletionDate?: string;
	startDate?: string;
	completionDate?: string;
	conditions?: string;
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
	commonAreaId?: string;
	commonAreaName?: string;
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
	createdAt: string;
	updatedAt: string;
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

// ============================================================================
// Phase 11: Governance Types
// ============================================================================

export type MeetingType = 'BOARD' | 'ANNUAL' | 'SPECIAL' | 'COMMITTEE' | 'BUDGET' | 'EXECUTIVE';
export type MeetingStatus = 'SCHEDULED' | 'IN_SESSION' | 'ADJOURNED' | 'MINUTES_DRAFT' | 'MINUTES_APPROVED' | 'ARCHIVED' | 'CANCELLED';
export type MeetingAttendanceStatus = 'PRESENT' | 'ABSENT' | 'REMOTE' | 'PROXY' | 'EXCUSED';
export type BoardMotionStatus = 'PROPOSED' | 'SECONDED' | 'UNDER_DISCUSSION' | 'UNDER_VOTE' | 'APPROVED' | 'DENIED' | 'TABLED' | 'WITHDRAWN';
export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN';
export type ResolutionStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';

export interface Meeting {
	id: string;
	associationId: string;
	boardId?: string;
	type: MeetingType;
	status: MeetingStatus;
	title: string;
	description?: string;
	scheduledFor: string;
	location?: string;
	virtualLink?: string;
	quorumRequired?: number | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	// Relations (when included)
	agendaItems?: MeetingAgendaItem[];
	attendance?: MeetingAttendance[];
	minutes?: MeetingMinutes | null;
	boardMotions?: BoardMotion[];
	votes?: Vote[];
}

export interface MeetingAgendaItem {
	id: string;
	meetingId: string;
	order: number;
	title: string;
	description?: string | null;
	timeAllotment?: number | null;
	createdAt: string;
	updatedAt: string;
	// Cross-domain links
	arcRequestId?: string | null;
	violationId?: string | null;
	workOrderId?: string | null;
	policyDocumentId?: string | null;
	// Relations (when included)
	arcRequest?: ARCRequest | null;
	violation?: Violation | null;
	workOrder?: WorkOrder | null;
}

export interface MeetingAttendance {
	id: string;
	meetingId: string;
	partyId: string;
	status: MeetingAttendanceStatus;
	proxyForPartyId?: string | null;
	arrivedAt?: string | null;
	leftAt?: string | null;
	createdAt: string;
	// Relations (when included)
	party?: { id: string; displayName?: string; partyType: string };
}

export interface MeetingMinutes {
	id: string;
	meetingId: string;
	content: string;
	status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
	approvedAt?: string | null;
	approvedBy?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface BoardMotion {
	id: string;
	meetingId: string;
	motionNumber: string;
	title: string;
	description?: string | null;
	status: BoardMotionStatus;
	category?: string | null;
	movedById: string;
	secondedById?: string | null;
	outcome?: string | null;
	decidedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	// Relations (when included)
	movedBy?: { id: string; displayName?: string };
	secondedBy?: { id: string; displayName?: string } | null;
	vote?: Vote | null;
	resolutions?: Resolution[];
}

export interface Vote {
	id: string;
	meetingId: string;
	motionId?: string | null;
	agendaItemId?: string | null;
	question: string;
	method: 'VOICE' | 'ROLL_CALL' | 'BALLOT' | 'SHOW_OF_HANDS';
	status: 'OPEN' | 'CLOSED';
	openedAt: string;
	closedAt?: string | null;
	result?: string | null;
	createdAt: string;
	updatedAt: string;
	// Relations (when included)
	ballots?: VoteBallot[];
}

export interface VoteBallot {
	id: string;
	voteId: string;
	voterId: string;
	choice: VoteChoice;
	hasConflictOfInterest: boolean;
	conflictNotes?: string | null;
	castAt: string;
	// Relations (when included)
	voter?: { id: string; displayName?: string };
}

export interface Resolution {
	id: string;
	associationId: string;
	resolutionNumber: string;
	title: string;
	content: string;
	status: ResolutionStatus;
	category?: string | null;
	effectiveDate?: string | null;
	expirationDate?: string | null;
	supersededById?: string | null;
	motionId?: string | null;
	createdAt: string;
	updatedAt: string;
	// Relations (when included)
	motion?: BoardMotion | null;
	workOrders?: WorkOrder[];
	policyDocuments?: Array<{ id: string; title: string }>;
}

// ============================================================================
// Other Types
// ============================================================================

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
	rating?: number;
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
	taxId?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface Document {
	id: string;
	name: string;
	title?: string;
	category: string;
	visibility: string;
	status?: string;
	mimeType: string;
	size: number;
	fileSize?: number;
	fileName?: string;
	fileUrl?: string;
	version?: number;
	effectiveDate?: string | null;
	uploadedBy?: string;
	uploadedByName?: string;
	contextType?: string;
	contextId?: string;
	contextName?: string;
	createdAt: string;
	updatedAt?: string;
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
		}),

	getNotices: (id: string) =>
		apiCall<{ notices: Array<{ id: string; noticeType: string; sentAt: string; deliveryMethod: string }> }>(
			'violation/getNotices',
			{ body: { violationId: id } }
		),

	getResponses: (id: string) =>
		apiCall<{ responses: Array<{ id: string; responseType: string; submittedAt: string; content: string }> }>(
			'violation/getResponses',
			{ body: { violationId: id } }
		),

	recordAction: (
		id: string,
		data: {
			action: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ success: boolean }>('violation/recordAction', {
			body: { violationId: id, ...data }
		}),

	fileAppeal: (
		id: string,
		data: {
			appealReason: string;
			supportingDocuments?: string[];
			idempotencyKey: string;
		}
	) =>
		apiCall<{ appeal: { id: string } }>('violation/fileAppeal', {
			body: { violationId: id, ...data }
		}),

	authorizeRemediation: (
		id: string,
		data: {
			vendorId: string;
			budgetSource: string;
			estimatedCost?: number;
			scope: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ workOrderId?: string }>('violation/authorizeRemediation', {
			body: { violationId: id, ...data }
		}),

	getResponse: (violationId: string, responseId: string) =>
		apiCall<{ response: { id: string; submittedDate: string; content: string; submittedBy: string; submittedByEmail?: string; submittedByPhone?: string; hasAttachments: boolean; acknowledged: boolean; acknowledgedBy?: string; acknowledgedAt?: string } }>(
			'violation/getResponse',
			{ body: { violationId, responseId } }
		),

	acknowledgeResponse: (
		violationId: string,
		responseId: string,
		data: { idempotencyKey: string }
	) =>
		apiCall<{ success: boolean }>('violation/acknowledgeResponse', {
			body: { violationId, responseId, ...data }
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
		}),

	assign: (
		id: string,
		data: {
			vendorId: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ workOrder: { id: string; status: string } }>('workOrder/assign', {
			body: { workOrderId: id, ...data }
		}),

	schedule: (
		id: string,
		data: {
			scheduledDate: string;
			scheduledTime?: string;
			estimatedDuration?: number;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ workOrder: { id: string; status: string } }>('workOrder/schedule', {
			body: { workOrderId: id, ...data }
		}),

	complete: (
		id: string,
		data: {
			completedDate: string;
			actualCost?: number;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ workOrder: { id: string; status: string } }>('workOrder/complete', {
			body: { workOrderId: id, ...data }
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
		}),

	updateStatus: (
		id: string,
		data: {
			status: string;
			notes?: string;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ vendor: Vendor }>('vendor/updateStatus', {
			body: { vendorId: id, ...data }
		})
};

// ============================================================================
// Association API
// ============================================================================

export const associationApi = {
	list: (params?: { organizationId?: string }) =>
		apiCall<{ associations: Association[] }>('association/list', {
			body: params || {}
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
			taxId?: string;
		}
	) =>
		apiCall<{ association: Association }>('association/update', {
			body: { id, ...data }
		})
};

// ============================================================================
// Document API
// ============================================================================

export interface DocumentDetail extends Document {
	title?: string;
	description?: string;
	version: number;
	status: string;
	effectiveDate?: string;
	tags?: string[];
	parentDocumentId?: string;
	supersededById?: string;
	uploadedById?: string;
	uploadedByName?: string;
	updatedAt?: string;
}

export interface DocumentReference {
	id: string;
	contextType: string;
	contextId: string;
	bindingNotes?: string;
	createdAt: string;
	// Resolved entity info
	entityTitle?: string;
	entityNumber?: string;
	entityStatus?: string;
}

export interface DocumentVersion {
	id: string;
	version: number;
	status: string;
	createdAt: string;
}

export const documentApi = {
	list: (params?: {
		category?: string;
		visibility?: string;
		status?: string;
		contextType?: string;
		contextId?: string;
		search?: string;
	}) =>
		apiCall<{ documents: Document[] }>('document/list', {
			body: params || {}
		}),

	get: (id: string) =>
		apiCall<{ document: DocumentDetail }>('document/get', {
			body: { id }
		}),

	classify: (data: {
		documentId: string;
		category: string;
		reason: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ document: { id: string; category: string } }>('document/classifyDocument', {
			body: data
		}),

	linkToContext: (data: {
		documentId: string;
		contextType: string;
		contextId: string;
		bindingNotes?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ binding: { id: string; documentId: string; contextType: string; contextId: string } }>(
			'document/linkToContext',
			{ body: data }
		),

	unlinkFromContext: (data: {
		documentId: string;
		contextType: string;
		contextId: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ success: boolean }>('document/unlinkFromContext', {
			body: data
		}),

	getReferences: (documentId: string) =>
		apiCall<{ references: DocumentReference[]; referenceCount: number }>('document/getReferences', {
			body: { documentId }
		}),

	getActivityHistory: (documentId: string) =>
		apiCall<{
			events: Array<{
				id: string;
				action: string;
				summary: string;
				actorType: string;
				performedBy: string;
				createdAt: string;
			}>;
		}>('document/getActivityHistory', {
			body: { documentId }
		}),

	getVersions: (documentId: string) =>
		apiCall<{ versions: DocumentVersion[] }>('document/getVersions', {
			body: { documentId }
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
				actorType?: string;
				rationale?: string;
				relatedDocuments?: string[];
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
	policies: {
		list: (params?: { category?: string }) =>
			apiCall<{
				policies: Array<{
					id: string;
					title: string;
					category: string;
					version: string;
					status: string;
					effectiveDate: string;
					lastReviewedDate?: string;
					nextReviewDate?: string;
					summary?: string;
					documentId?: string;
				}>;
			}>('governancePolicy/list', { body: params || {} })
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
			}>('governanceMeeting/list', { body: params || {} }),

		get: (id: string) =>
			apiCall<{ meeting: unknown }>('governanceMeeting/get', { body: { id } }),

		create: (data: {
			associationId: string;
			boardId?: string;
			type: string;
			title: string;
			description?: string;
			scheduledFor: string;
			location?: string;
			virtualLink?: string;
			quorumRequired?: number;
			idempotencyKey: string;
		}) =>
			apiCall<{ meeting: { id: string; associationId: string; status: string } }>(
				'governanceMeeting/create',
				{ body: data }
			),

		// Phase 11: Meeting State Transitions
		startSession: (data: { meetingId: string; idempotencyKey: string }) =>
			apiCall<{
				meeting: { id: string; status: string };
				quorumStatus: { required: number | null; present: number; met: boolean };
			}>('governanceMeeting/startSession', { body: data }),

		adjourn: (data: { meetingId: string; notes?: string; idempotencyKey: string }) =>
			apiCall<{ meeting: { id: string; status: string } }>('governanceMeeting/adjourn', { body: data }),

		submitMinutesDraft: (data: { meetingId: string; content: string; idempotencyKey: string }) =>
			apiCall<{ meeting: { id: string; status: string } }>('governanceMeeting/submitMinutesDraft', { body: data }),

		approveMinutes: (data: { meetingId: string; idempotencyKey: string }) =>
			apiCall<{ meeting: { id: string; status: string } }>('governanceMeeting/approveMinutes', { body: data }),

		archive: (data: { meetingId: string; idempotencyKey: string }) =>
			apiCall<{ meeting: { id: string; status: string } }>('governanceMeeting/archive', { body: data }),

		getQuorumStatus: (meetingId: string) =>
			apiCall<{
				quorumRequired: number | null;
				presentCount: number;
				quorumMet: boolean;
				attendees: Array<{ partyId: string; status: string }>;
			}>('governanceMeeting/getQuorumStatus', { body: { meetingId } }),

		// Agenda Items
		addAgendaItem: (data: {
			meetingId: string;
			title: string;
			description?: string;
			order?: number;
			arcRequestId?: string;
			violationId?: string;
			workOrderId?: string;
			policyDocumentId?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ agendaItem: { id: string; meetingId: string } }>('governanceMeeting/addAgendaItem', { body: data }),

		// Attendance
		recordAttendance: (data: {
			meetingId: string;
			partyId: string;
			status: string;
			proxyForPartyId?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ attendance: { id: string; meetingId: string; partyId: string; status: string } }>(
				'governanceMeeting/recordAttendance',
				{ body: data }
			),

		// Voting
		openVote: (data: {
			meetingId: string;
			agendaItemId?: string;
			question: string;
			method?: string;
			quorumRequired?: number;
			idempotencyKey: string;
		}) =>
			apiCall<{ vote: { id: string; meetingId: string; question: string; quorumRequired: number | null } }>(
				'governanceMeeting/openVote',
				{ body: data }
			),

		castBallot: (data: {
			voteId: string;
			voterPartyId: string;
			choice: string;
			hasConflictOfInterest?: boolean;
			conflictNotes?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ ballot: { id: string; voteId: string; voterPartyId: string; choice: string; hasConflictOfInterest: boolean } }>(
				'governanceMeeting/castBallot',
				{ body: data }
			),

		getEligibleVoters: (voteId: string) =>
			apiCall<{
				eligibleVoters: Array<{ partyId: string; name: string | null; hasVoted: boolean; attendanceStatus: string }>;
				totalEligible: number;
				totalVoted: number;
			}>('governanceMeeting/getEligibleVoters', { body: { voteId } }),

		tallyVote: (voteId: string) =>
			apiCall<{
				results: {
					yes: number;
					no: number;
					abstain: number;
					totalBallots: number;
					attendanceCount: number;
					turnoutPct: number;
					quorumRequired: number | null;
					quorumMet: boolean;
				};
			}>('governanceMeeting/tallyVote', { body: { voteId } }),

		closeVote: (data: { voteId: string; idempotencyKey: string }) =>
			apiCall<{
				vote: {
					id: string;
					closedAt: string;
					results: {
						yes: number;
						no: number;
						abstain: number;
						totalBallots: number;
						attendanceCount: number;
						turnoutPct: number;
						quorumRequired: number | null;
						quorumMet: boolean;
					};
				};
			}>('governanceMeeting/closeVote', { body: data })
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
			}>('governanceResolution/list', { body: params || {} }),

		get: (id: string) =>
			apiCall<{ resolution: unknown }>('governanceResolution/getResolution', { body: { id } }),

		create: (data: {
			associationId: string;
			boardId?: string;
			title: string;
			summary?: string;
			effectiveDate?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ resolution: { id: string; associationId: string; title: string; status: string } }>(
				'governanceResolution/createResolution',
				{ body: data }
			),

		updateStatus: (data: { id: string; status: string; idempotencyKey: string }) =>
			apiCall<{ resolution: { id: string; title: string; status: string } }>(
				'governanceResolution/updateResolutionStatus',
				{ body: data }
			),

		// Phase 11: Resolution Linking
		linkToMotion: (data: { resolutionId: string; motionId: string; idempotencyKey: string }) =>
			apiCall<{ resolution: { id: string; title: string; motionId: string } }>(
				'governanceResolution/linkToMotion',
				{ body: data }
			),

		getLinkedActions: (resolutionId: string) =>
			apiCall<{
				resolution: { id: string; title: string };
				linkedMotion: { id: string; title: string; status: string } | null;
				linkedWorkOrders: Array<{ id: string; workOrderNumber: string; status: string }>;
				linkedPolicies: Array<{ id: string; title: string; status: string }>;
			}>('governanceResolution/getLinkedActions', { body: { resolutionId } })
	},
	motions: {
		list: (params: {
			associationId: string;
			meetingId?: string;
			status?: string;
			category?: string;
			outcome?: string;
			search?: string;
			page?: number;
			pageSize?: number;
		}) =>
			apiCall<{
				motions: BoardMotion[];
				pagination: { page: number; pageSize: number; total: number; totalPages: number };
			}>('boardMotion/list', { body: params }),

		get: (id: string) =>
			apiCall<{ motion: BoardMotion }>('boardMotion/get', { body: { id } }),

		create: (data: {
			associationId: string;
			meetingId?: string;
			title: string;
			description?: string;
			category: string;
			movedById?: string;
			secondedById?: string;
			rationale?: string;
			effectiveDate?: string;
			expiresAt?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ motion: { id: string; motionNumber: string; title: string; status: string } }>(
				'boardMotion/create',
				{ body: data }
			),

		update: (
			id: string,
			data: {
				title?: string;
				description?: string;
				category?: string;
				rationale?: string;
				effectiveDate?: string | null;
				expiresAt?: string | null;
			}
		) =>
			apiCall<{ motion: BoardMotion }>('boardMotion/update', { body: { id, ...data } }),

		second: (data: { id: string; secondedById: string; idempotencyKey: string }) =>
			apiCall<{ motion: { id: string; motionNumber: string; status: string } }>(
				'boardMotion/second',
				{ body: data }
			),

		changeStatus: (data: { id: string; status: string; notes?: string; idempotencyKey: string }) =>
			apiCall<{ motion: { id: string; motionNumber: string; status: string } }>(
				'boardMotion/changeStatus',
				{ body: data }
			),

		recordOutcome: (data: {
			id: string;
			outcome: string;
			outcomeNotes?: string;
			idempotencyKey: string;
		}) =>
			apiCall<{ motion: { id: string; motionNumber: string; status: string; outcome: string | null } }>(
				'boardMotion/recordOutcome',
				{ body: data }
			),

		withdraw: (data: { id: string; reason?: string; idempotencyKey: string }) =>
			apiCall<{ motion: { id: string; motionNumber: string; status: string; outcome: string | null } }>(
				'boardMotion/withdraw',
				{ body: data }
			),

		// Phase 11: Motion Voting Lifecycle
		openVoting: (data: { id: string; meetingId: string; voteQuestion?: string; idempotencyKey: string }) =>
			apiCall<{
				motion: { id: string; motionNumber: string; status: string };
				vote: { id: string; question: string };
			}>('boardMotion/openVoting', { body: data }),

		closeVoting: (data: { id: string; idempotencyKey: string }) =>
			apiCall<{
				motion: { id: string; motionNumber: string; status: string; outcome: string | null };
				voteResults: { yes: number; no: number; abstain: number; passed: boolean };
			}>('boardMotion/closeVoting', { body: data }),

		table: (data: { id: string; reason?: string; idempotencyKey: string }) =>
			apiCall<{ motion: { id: string; motionNumber: string; status: string; outcome: string | null } }>(
				'boardMotion/table',
				{ body: data }
			)
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
			}>('reportDefinition/list', { body: params || {} }),

		get: (id: string) =>
			apiCall<{
				report: {
					id: string;
					name: string;
					description?: string;
					category: string;
					outputFormat?: string;
					parameters?: Array<{
						name: string;
						label: string;
						type: string;
						required: boolean;
						options?: Array<{ value: string; label: string }>;
						defaultValue?: string;
					}>;
				};
			}>('reportDefinition/get', { body: { id } })
	},

	execute: (
		id: string,
		data: {
			parameters?: Record<string, string>;
			idempotencyKey: string;
		}
	) =>
		apiCall<{
			result: {
				id: string;
				status: string;
				generatedAt: string;
				rowCount?: number;
				data?: Record<string, unknown>[];
				columns?: Array<{ key: string; label: string }>;
				downloadUrl?: string;
			};
		}>('report/execute', { body: { reportId: id, ...data } }),

	schedule: (
		id: string,
		data: {
			frequency: string;
			dayOfWeek?: number;
			dayOfMonth?: number;
			time: string;
			outputFormat: string;
			recipients: string[];
			isActive: boolean;
			idempotencyKey: string;
		}
	) =>
		apiCall<{ schedule: { id: string } }>('report/schedule', { body: { reportId: id, ...data } })
};

// ============================================================================
// Accounting API
// ============================================================================

export const accountingApi = {
	assessments: {
		list: (params?: { status?: string }) =>
			apiCall<{ assessments: Array<{ id: string; unitId: string; unitNumber: string; ownerName: string; type: string; amount: number; dueDate: string; status: string; paidAmount: number; createdAt: string }> }>(
				'accounting/assessments/list',
				{ body: params || {} }
			)
	},
	payables: {
		list: (params?: { status?: string }) =>
			apiCall<{ payables: Array<{ id: string; vendorId: string; vendorName: string; invoiceNumber: string; description: string; amount: number; dueDate: string; status: string; createdAt: string }> }>(
				'accounting/payables/list',
				{ body: params || {} }
			)
	},
	receivables: {
		list: (params?: Record<string, unknown>) =>
			apiCall<{ receivables: Array<{ unitId: string; unitNumber: string; ownerName: string; current: number; days30: number; days60: number; days90: number; days90Plus: number; total: number }>; summary: { totalOutstanding: number; current: number; days30: number; days60: number; days90: number; days90Plus: number; delinquentUnits: number } | null }>(
				'accounting/receivables/list',
				{ body: params || {} }
			)
	},
	gl: {
		accounts: (params?: Record<string, unknown>) =>
			apiCall<{ accounts: Array<{ id: string; accountNumber: string; name: string; type: string; balance: number; isActive: boolean }> }>(
				'accounting/gl/accounts',
				{ body: params || {} }
			),
		journal: (params?: { limit?: number }) =>
			apiCall<{ entries: Array<{ id: string; entryNumber: string; date: string; description: string; debitTotal: number; creditTotal: number; status: string; createdBy: string }> }>(
				'accounting/gl/journal',
				{ body: params || {} }
			)
	}
};

// ============================================================================
// Dashboard API (Phase 12)
// ============================================================================

// Re-export dashboard types from generated types for convenience
import type { operations } from './types.generated';

export type DashboardData = operations['dashboard.getData']['responses']['200']['content']['application/json']['data']['dashboard'];
export type DashboardFilters = operations['dashboard.getData']['requestBody'] extends { content: { 'application/json': infer T } } ? T : never;
export type DashboardRequiresAction = DashboardData['requiresAction'];
export type DashboardRiskCompliance = DashboardData['riskCompliance'];
export type DashboardFinancialAttention = DashboardData['financialAttention'];
export type DashboardRecentGovernance = DashboardData['recentGovernance'];
export type DashboardRecentGovernanceItem = DashboardRecentGovernance['items'][number];

export type DashboardEventType = 'DASHBOARD_VIEWED' | 'CARD_CLICKED' | 'FILTER_APPLIED';

export const dashboardApi = {
	/**
	 * Get comprehensive dashboard data for all four sections (Phase 12)
	 */
	getData: (filters?: DashboardFilters) =>
		apiCall<{ dashboard: DashboardData }>('dashboard/getData', {
			body: filters || {}
		}),

	/**
	 * Record dashboard view/interaction for audit trail (Phase 12)
	 */
	recordView: (data: {
		eventType: DashboardEventType;
		section?: string;
		card?: string;
		targetUrl?: string;
		filters?: DashboardFilters;
	}) =>
		apiCall<{ recorded: boolean }>('dashboard/recordView', {
			body: data
		}),

	/**
	 * Get existing summary data (legacy endpoint)
	 */
	getSummary: () =>
		apiCall<{
			summary: {
				financials: {
					totalReceivables: string;
					totalPayables: string;
					delinquentUnits: number;
				};
				operations: {
					openWorkOrders: number;
					pendingViolations: number;
					pendingArcRequests: number;
				};
				compliance: {
					upcomingDeadlines: number;
					overdueItems: number;
				};
			};
		}>('dashboard/getSummary', { body: {} })
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

// ============================================================================
// Phase 13: Concierge Case API
// ============================================================================

export type ConciergeCaseStatus =
	| 'INTAKE'
	| 'ASSESSMENT'
	| 'IN_PROGRESS'
	| 'PENDING_EXTERNAL'
	| 'PENDING_OWNER'
	| 'ON_HOLD'
	| 'RESOLVED'
	| 'CLOSED'
	| 'CANCELLED';

export type ConciergeCasePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY';

export type CaseNoteType =
	| 'GENERAL'
	| 'CLARIFICATION_REQUEST'
	| 'CLARIFICATION_RESPONSE'
	| 'DECISION_RATIONALE';

export interface ConciergeCase {
	id: string;
	caseNumber: string;
	propertyId: string;
	title: string;
	description: string;
	status: ConciergeCaseStatus;
	priority: ConciergeCasePriority;
	originIntentId?: string | null;
	assignedConciergeUserId?: string | null;
	assignedConciergeName?: string | null;
	linkedUnitId?: string | null;
	linkedJobId?: string | null;
	linkedArcRequestId?: string | null;
	linkedWorkOrderId?: string | null;
	resolvedAt?: string | null;
	resolutionSummary?: string | null;
	closedAt?: string | null;
	cancelledAt?: string | null;
	cancelReason?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CaseNote {
	id: string;
	caseId?: string;
	content: string;
	noteType: CaseNoteType;
	isInternal: boolean;
	createdBy: string;
	createdAt: string;
}

export interface CaseStatusHistoryItem {
	id: string;
	fromStatus: string | null;
	toStatus: string;
	reason: string | null;
	changedBy: string;
	createdAt: string;
}

export interface CaseParticipant {
	id: string;
	partyId: string | null;
	partyName: string | null;
	externalContactName: string | null;
	externalContactEmail: string | null;
	role: string;
	addedAt: string;
}

export interface CaseAction {
	id: string;
	actionType: string;
	status: string;
	description: string;
	plannedAt: string | null;
	completedAt: string | null;
	createdAt: string;
}

export interface CaseDecision {
	id: string;
	category: string;
	title: string;
	rationale: string;
	decidedAt: string;
	hasOutcome: boolean;
}

export interface CaseAttachment {
	id: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	fileUrl: string;
	uploadedBy: string;
	createdAt: string;
}

export interface CaseDetailProperty {
	id: string;
	name: string;
	addressLine1: string;
	city: string | null;
	state: string | null;
	postalCode: string | null;
}

export interface CaseOriginIntent {
	id: string;
	title: string;
	description: string;
	status: string;
	createdAt: string;
}

export interface ConciergeCaseDetail {
	case: ConciergeCase;
	property: CaseDetailProperty;
	originIntent: CaseOriginIntent | null;
	statusHistory: CaseStatusHistoryItem[];
	notes: CaseNote[];
	participants: CaseParticipant[];
	actions: CaseAction[];
	decisions: CaseDecision[];
	attachments: CaseAttachment[];
}

export const conciergeCaseApi = {
	list: (params: {
		status?: ConciergeCaseStatus;
		priority?: ConciergeCasePriority;
		propertyId?: string;
		assignedConciergeUserId?: string;
		page?: number;
		pageSize?: number;
	}) =>
		apiCall<{ items: ConciergeCase[]; total: number; page: number; pageSize: number }>(
			'concierge/case/list',
			{ body: params }
		),

	get: (id: string) => apiCall<{ case: ConciergeCase }>('concierge/case/get', { body: { id } }),

	getDetail: (id: string) =>
		apiCall<ConciergeCaseDetail>('concierge/case/getDetail', { body: { id } }),

	create: (data: {
		propertyId: string;
		title: string;
		description: string;
		priority?: ConciergeCasePriority;
		originIntentId?: string;
		idempotencyKey: string;
	}) => apiCall<{ case: ConciergeCase }>('concierge/case/create', { body: data }),

	updateStatus: (data: {
		caseId: string;
		status: ConciergeCaseStatus;
		reason?: string;
		idempotencyKey: string;
	}) => apiCall<{ case: ConciergeCase }>('concierge/case/updateStatus', { body: data }),

	assign: (data: { caseId: string; conciergeUserId: string; idempotencyKey: string }) =>
		apiCall<{ case: ConciergeCase }>('concierge/case/assign', { body: data }),

	resolve: (data: { caseId: string; resolutionSummary: string; idempotencyKey: string }) =>
		apiCall<{ case: ConciergeCase }>('concierge/case/resolve', { body: data }),

	close: (data: { caseId: string; idempotencyKey: string }) =>
		apiCall<{ case: ConciergeCase }>('concierge/case/close', { body: data }),

	cancel: (data: { caseId: string; reason: string; idempotencyKey: string }) =>
		apiCall<{ case: ConciergeCase }>('concierge/case/cancel', { body: data }),

	addNote: (data: {
		caseId: string;
		content: string;
		noteType?: CaseNoteType;
		isInternal?: boolean;
		idempotencyKey: string;
	}) => apiCall<{ note: CaseNote }>('concierge/case/addNote', { body: data }),

	listNotes: (params: { caseId: string; noteType?: CaseNoteType; includeInternal?: boolean }) =>
		apiCall<{ notes: CaseNote[] }>('concierge/case/listNotes', { body: params }),

	requestClarification: (data: { caseId: string; question: string; idempotencyKey: string }) =>
		apiCall<{ note: CaseNote; case: { id: string; status: string } }>(
			'concierge/case/requestClarification',
			{ body: data }
		),

	respondToClarification: (data: { caseId: string; response: string; idempotencyKey: string }) =>
		apiCall<{ note: CaseNote }>('concierge/case/respondToClarification', { body: data }),

	linkToArc: (data: { caseId: string; arcRequestId: string; idempotencyKey: string }) =>
		apiCall<{ caseId: string; linkedArcRequestId: string }>('concierge/case/linkToArc', {
			body: data
		}),

	linkToWorkOrder: (data: { caseId: string; workOrderId: string; idempotencyKey: string }) =>
		apiCall<{ caseId: string; linkedWorkOrderId: string }>('concierge/case/linkToWorkOrder', {
			body: data
		}),

	linkToUnit: (data: { caseId: string; unitId: string; idempotencyKey: string }) =>
		apiCall<{ caseId: string; linkedUnitId: string }>('concierge/case/linkToUnit', { body: data }),

	linkToJob: (data: { caseId: string; jobId: string; idempotencyKey: string }) =>
		apiCall<{ caseId: string; linkedJobId: string }>('concierge/case/linkToJob', { body: data }),

	getStatusHistory: (caseId: string) =>
		apiCall<{ history: CaseStatusHistoryItem[] }>('concierge/case/getStatusHistory', {
			body: { caseId }
		}),

	addParticipant: (data: {
		caseId: string;
		partyId?: string;
		externalContactName?: string;
		externalContactEmail?: string;
		externalContactPhone?: string;
		role: string;
		notes?: string;
		idempotencyKey: string;
	}) =>
		apiCall<{ participant: CaseParticipant }>('concierge/case/addParticipant', { body: data }),

	listParticipants: (caseId: string) =>
		apiCall<{ participants: CaseParticipant[] }>('concierge/case/listParticipants', {
			body: { caseId }
		}),

	removeParticipant: (data: { caseId: string; participantId: string; idempotencyKey: string }) =>
		apiCall<{ removed: boolean }>('concierge/case/removeParticipant', { body: data }),

	listConcierges: () =>
		apiCall<{ concierges: Array<{ id: string; name: string; email: string }> }>(
			'concierge/case/listConcierges',
			{ body: {} }
		)
};

// ============================================================================
// Job API (Phase 15 - Contractor Job Lifecycle)
// ============================================================================

export type JobStatus =
	| 'LEAD'
	| 'TICKET'
	| 'ESTIMATE_REQUIRED'
	| 'ESTIMATE_SENT'
	| 'ESTIMATE_APPROVED'
	| 'JOB_CREATED'
	| 'SCHEDULED'
	| 'DISPATCHED'
	| 'IN_PROGRESS'
	| 'ON_HOLD'
	| 'COMPLETED'
	| 'INVOICED'
	| 'PAID'
	| 'WARRANTY'
	| 'CLOSED'
	| 'CANCELLED';

export type JobSourceType =
	| 'WORK_ORDER'
	| 'VIOLATION'
	| 'ARC_REQUEST'
	| 'DIRECT_CUSTOMER'
	| 'LEAD'
	| 'RECURRING';

export interface Job {
	id: string;
	organizationId: string;
	jobNumber: string;
	status: JobStatus;
	sourceType: JobSourceType;
	workOrderId: string | null;
	violationId: string | null;
	arcRequestId: string | null;
	customerId: string | null;
	unitId: string | null;
	propertyId: string | null;
	associationId: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	city: string | null;
	state: string | null;
	postalCode: string | null;
	locationNotes: string | null;
	title: string;
	description: string | null;
	category: string | null;
	priority: string;
	assignedTechnicianId: string | null;
	assignedBranchId: string | null;
	assignedAt: string | null;
	assignedBy: string | null;
	scheduledStart: string | null;
	scheduledEnd: string | null;
	estimatedHours: string | null;
	dispatchedAt: string | null;
	startedAt: string | null;
	completedAt: string | null;
	invoicedAt: string | null;
	paidAt: string | null;
	closedAt: string | null;
	closedBy: string | null;
	cancelledAt: string | null;
	estimatedCost: string | null;
	actualCost: string | null;
	actualHours: string | null;
	warrantyEnds: string | null;
	warrantyNotes: string | null;
	resolutionNotes: string | null;
	customerRating: number | null;
	customerFeedback: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface JobNote {
	id: string;
	jobId: string;
	authorId: string;
	content: string;
	isInternal: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface JobStatusHistoryItem {
	id: string;
	fromStatus: JobStatus | null;
	toStatus: JobStatus;
	changedBy: string;
	changedAt: string;
	notes: string | null;
}

export const jobApi = {
	list: (params?: {
		status?: JobStatus;
		sourceType?: JobSourceType;
		customerId?: string;
		assignedTechnicianId?: string;
		search?: string;
		cursor?: string;
		limit?: number;
	}) => apiCall<{ jobs: Job[]; pagination: { nextCursor: string | null; hasMore: boolean } }>('job/list', { body: params || {} }),

	get: (id: string) => apiCall<{ job: Job }>('job/get', { body: { id } }),

	create: (data: {
		sourceType: JobSourceType;
		title: string;
		description?: string;
		category?: string;
		priority?: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
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
	}) => apiCall<{ job: Job }>('job/create', { body: data }),

	update: (data: {
		id: string;
		title?: string;
		description?: string | null;
		category?: string | null;
		priority?: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		postalCode?: string | null;
		locationNotes?: string | null;
		estimatedHours?: number | null;
		estimatedCost?: number | null;
		warrantyNotes?: string | null;
		resolutionNotes?: string | null;
		idempotencyKey?: string;
	}) => apiCall<{ job: Job }>('job/update', { body: data }),

	transitionStatus: (data: {
		id: string;
		toStatus: JobStatus;
		notes?: string;
		idempotencyKey?: string;
	}) => apiCall<{ job: Job }>('job/transitionStatus', { body: data }),

	assignTechnician: (data: {
		id: string;
		technicianId: string | null;
		branchId?: string | null;
		idempotencyKey?: string;
	}) => apiCall<{ job: Job }>('job/assignTechnician', { body: data }),

	schedule: (data: {
		id: string;
		scheduledStart: string;
		scheduledEnd: string;
		idempotencyKey?: string;
	}) => apiCall<{ job: Job }>('job/schedule', { body: data }),

	getStatusHistory: (jobId: string) =>
		apiCall<{ history: JobStatusHistoryItem[] }>('job/getStatusHistory', { body: { jobId } }),

	addNote: (data: {
		jobId: string;
		content: string;
		isInternal?: boolean;
		idempotencyKey: string;
	}) => apiCall<{ note: JobNote }>('job/addNote', { body: data }),

	listNotes: (params: { jobId: string; includeInternal?: boolean }) =>
		apiCall<{ notes: JobNote[] }>('job/listNotes', { body: params }),

	delete: (data: { id: string; idempotencyKey?: string }) =>
		apiCall<{ deleted: boolean }>('job/delete', { body: data })
};

// ============================================================================
// Estimate API (Phase 15 - Contractor Job Lifecycle)
// ============================================================================

export type EstimateStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVISED';

export interface EstimateLine {
	id: string;
	lineNumber: number;
	description: string;
	quantity: string;
	unitPrice: string;
	lineTotal: string;
	pricebookItemId: string | null;
	isTaxable: boolean;
	taxRate: string | null;
}

export interface Estimate {
	id: string;
	organizationId: string;
	jobId: string;
	customerId: string | null;
	estimateNumber: string;
	status: EstimateStatus;
	version: number;
	subtotal: string;
	taxAmount: string;
	discount: string;
	totalAmount: string;
	notes: string | null;
	terms: string | null;
	validUntil: string | null;
	sentAt: string | null;
	viewedAt: string | null;
	acceptedAt: string | null;
	declinedAt: string | null;
	declineReason: string | null;
	createdAt: string;
	updatedAt: string;
	lines?: EstimateLine[];
}

export const estimateApi = {
	list: (params: { jobId: string }) =>
		apiCall<{ estimates: Estimate[] }>('billing/estimate/list', { body: params }),

	get: (id: string) =>
		apiCall<{ estimate: Estimate }>('billing/estimate/get', { body: { id } }),

	create: (data: {
		jobId: string;
		customerId?: string;
		notes?: string;
		terms?: string;
		validUntil?: string;
		idempotencyKey: string;
	}) => apiCall<{ estimate: Estimate }>('billing/estimate/create', { body: data }),

	update: (data: {
		id: string;
		notes?: string;
		terms?: string;
		validUntil?: string;
		discount?: number;
		idempotencyKey?: string;
	}) => apiCall<{ estimate: Estimate }>('billing/estimate/update', { body: data }),

	addLine: (data: {
		estimateId: string;
		description: string;
		quantity: number;
		unitPrice: number;
		isTaxable?: boolean;
		taxRate?: number;
		pricebookItemId?: string;
		idempotencyKey: string;
	}) => apiCall<{ estimate: Estimate }>('billing/estimate/addLine', { body: data }),

	removeLine: (data: {
		estimateId: string;
		lineId: string;
		idempotencyKey: string;
	}) => apiCall<{ estimate: Estimate }>('billing/estimate/removeLine', { body: data }),

	send: (data: { id: string; idempotencyKey?: string }) =>
		apiCall<{ estimate: Estimate }>('billing/estimate/send', { body: data }),

	accept: (data: { id: string; selectedOptionId?: string; idempotencyKey?: string }) =>
		apiCall<{ estimate: Estimate }>('billing/estimate/accept', { body: data }),

	decline: (data: { id: string; reason?: string; idempotencyKey?: string }) =>
		apiCall<{ estimate: Estimate }>('billing/estimate/decline', { body: data }),

	revise: (data: { id: string; idempotencyKey?: string }) =>
		apiCall<{ estimate: Estimate }>('billing/estimate/revise', { body: data })
};

// ============================================================================
// Invoice API (Phase 15 - Contractor Job Lifecycle)
// ============================================================================

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID' | 'REFUNDED';

export interface InvoiceLine {
	id: string;
	lineNumber: number;
	description: string;
	quantity: string;
	unitPrice: string;
	lineTotal: string;
	pricebookItemId: string | null;
	isTaxable: boolean;
	taxRate: string | null;
}

export interface JobInvoice {
	id: string;
	organizationId: string;
	jobId: string;
	customerId: string | null;
	estimateId: string | null;
	invoiceNumber: string;
	status: InvoiceStatus;
	dueDate: string | null;
	subtotal: string;
	taxAmount: string;
	discount: string;
	totalAmount: string;
	amountPaid: string;
	balanceDue: string;
	notes: string | null;
	terms: string | null;
	sentAt: string | null;
	viewedAt: string | null;
	paidAt: string | null;
	createdAt: string;
	updatedAt: string;
	lines?: InvoiceLine[];
}

export const invoiceApi = {
	list: (params: { jobId: string }) =>
		apiCall<{ invoices: JobInvoice[] }>('billing/invoice/list', { body: params }),

	get: (id: string) =>
		apiCall<{ invoice: JobInvoice }>('billing/invoice/get', { body: { id } }),

	createFromEstimate: (data: {
		estimateId: string;
		dueDate?: string;
		notes?: string;
		terms?: string;
		idempotencyKey: string;
	}) => apiCall<{ invoice: JobInvoice }>('billing/invoice/createFromEstimate', { body: data }),

	create: (data: {
		jobId: string;
		customerId?: string;
		dueDate?: string;
		notes?: string;
		terms?: string;
		idempotencyKey: string;
	}) => apiCall<{ invoice: JobInvoice }>('billing/invoice/create', { body: data }),

	send: (data: { id: string; idempotencyKey?: string }) =>
		apiCall<{ invoice: JobInvoice }>('billing/invoice/send', { body: data }),

	recordPayment: (data: {
		id: string;
		amount: number;
		paymentMethod?: string;
		referenceNumber?: string;
		notes?: string;
		idempotencyKey?: string;
	}) => apiCall<{ invoice: JobInvoice }>('billing/invoice/recordPayment', { body: data }),

	void: (data: { id: string; reason?: string; idempotencyKey?: string }) =>
		apiCall<{ invoice: JobInvoice }>('billing/invoice/void', { body: data }),

	getPayments: (invoiceId: string) =>
		apiCall<{ payments: InvoicePayment[] }>('billing/invoice/getPayments', { body: { invoiceId } })
};

export interface InvoicePayment {
	id: string;
	invoiceId: string;
	amount: string;
	paymentMethod: string | null;
	referenceNumber: string | null;
	notes: string | null;
	paidAt: string;
	recordedBy: string;
	createdAt: string;
}

// ============================================================================
// Technician API (Phase 15 - Contractor Job Lifecycle)
// ============================================================================

export interface Technician {
	id: string;
	organizationId: string;
	userId: string | null;
	firstName: string;
	lastName: string;
	email: string | null;
	phone: string | null;
	employeeId: string | null;
	isActive: boolean;
	skills: string[];
	certifications: string[];
	createdAt: string;
}

export const technicianApi = {
	list: (params?: { isActive?: boolean; limit?: number }) =>
		apiCall<{ technicians: Technician[] }>('contractor/technician/list', { body: params || {} }),

	get: (id: string) =>
		apiCall<{ technician: Technician }>('contractor/technician/get', { body: { id } })
};

// ============================================================================
// Job Document API (Phase 15 - Job Documents)
// ============================================================================

export interface JobDocument {
	id: string;
	jobId: string;
	name: string;
	description: string | null;
	fileUrl: string;
	fileType: string;
	fileSize: number;
	category: string;
	uploadedBy: string;
	createdAt: string;
}

export const jobDocumentApi = {
	listForJob: (jobId: string) =>
		apiCall<{ documents: JobDocument[] }>('job/listDocuments', { body: { jobId } }),

	upload: (data: {
		jobId: string;
		name: string;
		description?: string;
		fileUrl: string;
		fileType: string;
		fileSize: number;
		category: string;
		idempotencyKey: string;
	}) => apiCall<{ document: JobDocument }>('job/uploadDocument', { body: data }),

	delete: (data: { id: string; idempotencyKey?: string }) =>
		apiCall<{ deleted: boolean }>('job/deleteDocument', { body: data })
};

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
