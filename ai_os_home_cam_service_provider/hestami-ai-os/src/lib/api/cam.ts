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

// ============================================================================
// Enum Value Constants - Client-safe copies for use in Svelte components
// (Cannot import directly from generated/prisma due to svelte-check memory issues)
// These MUST be kept in sync with generated/prisma/enums.ts
// ============================================================================

// Job & Work Order Status Enums (most commonly used)
export const JobStatusValues = {
	LEAD: 'LEAD',
	TICKET: 'TICKET',
	ESTIMATE_REQUIRED: 'ESTIMATE_REQUIRED',
	ESTIMATE_SENT: 'ESTIMATE_SENT',
	ESTIMATE_APPROVED: 'ESTIMATE_APPROVED',
	JOB_CREATED: 'JOB_CREATED',
	SCHEDULED: 'SCHEDULED',
	DISPATCHED: 'DISPATCHED',
	IN_PROGRESS: 'IN_PROGRESS',
	ON_HOLD: 'ON_HOLD',
	COMPLETED: 'COMPLETED',
	INVOICED: 'INVOICED',
	PAID: 'PAID',
	WARRANTY: 'WARRANTY',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
} as const;

export const WorkOrderStatusValues = {
	DRAFT: 'DRAFT',
	SUBMITTED: 'SUBMITTED',
	TRIAGED: 'TRIAGED',
	AUTHORIZED: 'AUTHORIZED',
	ASSIGNED: 'ASSIGNED',
	SCHEDULED: 'SCHEDULED',
	IN_PROGRESS: 'IN_PROGRESS',
	ON_HOLD: 'ON_HOLD',
	COMPLETED: 'COMPLETED',
	REVIEW_REQUIRED: 'REVIEW_REQUIRED',
	INVOICED: 'INVOICED',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
} as const;

export const WorkOrderPriorityValues = {
	EMERGENCY: 'EMERGENCY',
	HIGH: 'HIGH',
	MEDIUM: 'MEDIUM',
	LOW: 'LOW',
	SCHEDULED: 'SCHEDULED'
} as const;

export const WorkOrderCategoryValues = {
	MAINTENANCE: 'MAINTENANCE',
	REPAIR: 'REPAIR',
	INSPECTION: 'INSPECTION',
	INSTALLATION: 'INSTALLATION',
	REPLACEMENT: 'REPLACEMENT',
	EMERGENCY: 'EMERGENCY',
	PREVENTIVE: 'PREVENTIVE',
	LANDSCAPING: 'LANDSCAPING',
	CLEANING: 'CLEANING',
	SECURITY: 'SECURITY',
	OTHER: 'OTHER'
} as const;

export const WorkOrderOriginTypeValues = {
	VIOLATION_REMEDIATION: 'VIOLATION_REMEDIATION',
	ARC_APPROVAL: 'ARC_APPROVAL',
	PREVENTIVE_MAINTENANCE: 'PREVENTIVE_MAINTENANCE',
	BOARD_DIRECTIVE: 'BOARD_DIRECTIVE',
	EMERGENCY_ACTION: 'EMERGENCY_ACTION',
	MANUAL: 'MANUAL'
} as const;

// Concierge & Case Enums
export const ConciergeCaseStatusValues = {
	INTAKE: 'INTAKE',
	ASSESSMENT: 'ASSESSMENT',
	IN_PROGRESS: 'IN_PROGRESS',
	PENDING_EXTERNAL: 'PENDING_EXTERNAL',
	PENDING_OWNER: 'PENDING_OWNER',
	ON_HOLD: 'ON_HOLD',
	RESOLVED: 'RESOLVED',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
} as const;

export const ConciergeCasePriorityValues = {
	LOW: 'LOW',
	NORMAL: 'NORMAL',
	HIGH: 'HIGH',
	URGENT: 'URGENT',
	EMERGENCY: 'EMERGENCY'
} as const;

export const ConciergeActionStatusValues = {
	PLANNED: 'PLANNED',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED',
	BLOCKED: 'BLOCKED'
} as const;

export const ConciergeActionTypeValues = {
	PHONE_CALL: 'PHONE_CALL',
	EMAIL: 'EMAIL',
	DOCUMENT_REVIEW: 'DOCUMENT_REVIEW',
	RESEARCH: 'RESEARCH',
	VENDOR_CONTACT: 'VENDOR_CONTACT',
	HOA_CONTACT: 'HOA_CONTACT',
	SCHEDULING: 'SCHEDULING',
	APPROVAL_REQUEST: 'APPROVAL_REQUEST',
	FOLLOW_UP: 'FOLLOW_UP',
	ESCALATION: 'ESCALATION',
	OTHER: 'OTHER'
} as const;

// Owner & Property Request Enums
export const OwnerRequestStatusValues = {
	DRAFT: 'DRAFT',
	SUBMITTED: 'SUBMITTED',
	IN_PROGRESS: 'IN_PROGRESS',
	RESOLVED: 'RESOLVED',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
} as const;

export const OwnerRequestCategoryValues = {
	GENERAL_INQUIRY: 'GENERAL_INQUIRY',
	MAINTENANCE: 'MAINTENANCE',
	BILLING: 'BILLING',
	ARCHITECTURAL: 'ARCHITECTURAL',
	VIOLATION: 'VIOLATION',
	GOVERNANCE: 'GOVERNANCE',
	AMENITY: 'AMENITY',
	OTHER: 'OTHER'
} as const;

export const IndividualRequestStatusValues = {
	SUBMITTED: 'SUBMITTED',
	REVIEWING: 'REVIEWING',
	APPROVED: 'APPROVED',
	SCHEDULED: 'SCHEDULED',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED'
} as const;

export const OwnerIntentStatusValues = {
	DRAFT: 'DRAFT',
	SUBMITTED: 'SUBMITTED',
	ACKNOWLEDGED: 'ACKNOWLEDGED',
	CONVERTED_TO_CASE: 'CONVERTED_TO_CASE',
	DECLINED: 'DECLINED',
	WITHDRAWN: 'WITHDRAWN'
} as const;

export const OwnerIntentCategoryValues = {
	MAINTENANCE: 'MAINTENANCE',
	IMPROVEMENT: 'IMPROVEMENT',
	COMPLIANCE: 'COMPLIANCE',
	DISPUTE: 'DISPUTE',
	INQUIRY: 'INQUIRY',
	EMERGENCY: 'EMERGENCY',
	OTHER: 'OTHER'
} as const;

export const OwnerIntentPriorityValues = {
	LOW: 'LOW',
	NORMAL: 'NORMAL',
	HIGH: 'HIGH',
	URGENT: 'URGENT'
} as const;

// ARC Request Enums
export const ARCRequestStatusValues = {
	DRAFT: 'DRAFT',
	SUBMITTED: 'SUBMITTED',
	UNDER_REVIEW: 'UNDER_REVIEW',
	APPROVED: 'APPROVED',
	DENIED: 'DENIED',
	CHANGES_REQUESTED: 'CHANGES_REQUESTED',
	TABLED: 'TABLED',
	WITHDRAWN: 'WITHDRAWN',
	CANCELLED: 'CANCELLED',
	EXPIRED: 'EXPIRED'
} as const;

export const ARCCategoryValues = {
	FENCE: 'FENCE',
	ROOF: 'ROOF',
	PAINT: 'PAINT',
	ADDITION: 'ADDITION',
	LANDSCAPING: 'LANDSCAPING',
	WINDOWS: 'WINDOWS',
	DOORS: 'DOORS',
	DRIVEWAY: 'DRIVEWAY',
	GARAGE: 'GARAGE',
	SOLAR: 'SOLAR',
	HVAC: 'HVAC',
	OTHER: 'OTHER'
} as const;

export const ARCReviewActionValues = {
	APPROVE: 'APPROVE',
	DENY: 'DENY',
	REQUEST_CHANGES: 'REQUEST_CHANGES',
	TABLE: 'TABLE'
} as const;

// Service Contract Enums
export const ServiceContractStatusValues = {
	DRAFT: 'DRAFT',
	PENDING_APPROVAL: 'PENDING_APPROVAL',
	ACTIVE: 'ACTIVE',
	SUSPENDED: 'SUSPENDED',
	EXPIRED: 'EXPIRED',
	CANCELLED: 'CANCELLED',
	RENEWED: 'RENEWED'
} as const;

export const ServiceContractTypeValues = {
	PREVENTIVE_MAINTENANCE: 'PREVENTIVE_MAINTENANCE',
	FULL_SERVICE: 'FULL_SERVICE',
	INSPECTION_ONLY: 'INSPECTION_ONLY',
	ON_CALL: 'ON_CALL',
	SEASONAL: 'SEASONAL'
} as const;

// Staff Enums
export const StaffStatusValues = {
	PENDING: 'PENDING',
	ACTIVE: 'ACTIVE',
	SUSPENDED: 'SUSPENDED',
	DEACTIVATED: 'DEACTIVATED'
} as const;

export const StaffRoleValues = {
	CONCIERGE_OPERATOR: 'CONCIERGE_OPERATOR',
	OPERATIONS_COORDINATOR: 'OPERATIONS_COORDINATOR',
	CAM_SPECIALIST: 'CAM_SPECIALIST',
	VENDOR_LIAISON: 'VENDOR_LIAISON',
	PLATFORM_ADMIN: 'PLATFORM_ADMIN'
} as const;

export const PillarAccessValues = {
	CONCIERGE: 'CONCIERGE',
	CAM: 'CAM',
	CONTRACTOR: 'CONTRACTOR',
	VENDOR: 'VENDOR',
	ADMIN: 'ADMIN'
} as const;

export const ServiceProviderTeamMemberStatusValues = {
	PENDING: 'PENDING',
	ACTIVE: 'ACTIVE',
	SUSPENDED: 'SUSPENDED',
	DEACTIVATED: 'DEACTIVATED'
} as const;

export const ServiceProviderRoleValues = {
	OWNER: 'OWNER',
	ADMIN: 'ADMIN',
	OFFICE_MANAGER: 'OFFICE_MANAGER',
	DISPATCHER: 'DISPATCHER',
	ESTIMATOR: 'ESTIMATOR',
	BOOKKEEPER: 'BOOKKEEPER',
	TECHNICIAN: 'TECHNICIAN'
} as const;

// Invitation Enums
export const InvitationStatusValues = {
	PENDING: 'PENDING',
	ACCEPTED: 'ACCEPTED',
	EXPIRED: 'EXPIRED',
	REVOKED: 'REVOKED'
} as const;

// Violation Enums
export const ViolationStatusValues = {
	DRAFT: 'DRAFT',
	DETECTED: 'DETECTED',
	OPEN: 'OPEN',
	UNDER_REVIEW: 'UNDER_REVIEW',
	NOTICE_SENT: 'NOTICE_SENT',
	OWNER_RESPONSE_PENDING: 'OWNER_RESPONSE_PENDING',
	CURE_PERIOD: 'CURE_PERIOD',
	CURED: 'CURED',
	ESCALATED: 'ESCALATED',
	HEARING_SCHEDULED: 'HEARING_SCHEDULED',
	HEARING_HELD: 'HEARING_HELD',
	REMEDIATION_IN_PROGRESS: 'REMEDIATION_IN_PROGRESS',
	FINE_ASSESSED: 'FINE_ASSESSED',
	APPEALED: 'APPEALED',
	RESOLVED: 'RESOLVED',
	CLOSED: 'CLOSED',
	DISMISSED: 'DISMISSED'
} as const;

export const ViolationSeverityValues = {
	MINOR: 'MINOR',
	MODERATE: 'MODERATE',
	MAJOR: 'MAJOR',
	CRITICAL: 'CRITICAL'
} as const;

// Activity Event Enums
export const ActivityEntityTypeValues = {
	ASSOCIATION: 'ASSOCIATION',
	UNIT: 'UNIT',
	OWNER: 'OWNER',
	PARTY: 'PARTY',
	OWNERSHIP: 'OWNERSHIP',
	VIOLATION: 'VIOLATION',
	ARC_REQUEST: 'ARC_REQUEST',
	ASSESSMENT: 'ASSESSMENT',
	GOVERNING_DOCUMENT: 'GOVERNING_DOCUMENT',
	BOARD_ACTION: 'BOARD_ACTION',
	JOB: 'JOB',
	WORK_ORDER: 'WORK_ORDER',
	ESTIMATE: 'ESTIMATE',
	INVOICE: 'INVOICE',
	TECHNICIAN: 'TECHNICIAN',
	CONTRACTOR: 'CONTRACTOR',
	INVENTORY: 'INVENTORY',
	PURCHASE_ORDER: 'PURCHASE_ORDER',
	CONCIERGE_CASE: 'CONCIERGE_CASE',
	OWNER_INTENT: 'OWNER_INTENT',
	INDIVIDUAL_PROPERTY: 'INDIVIDUAL_PROPERTY',
	PROPERTY_DOCUMENT: 'PROPERTY_DOCUMENT',
	MATERIAL_DECISION: 'MATERIAL_DECISION',
	EXTERNAL_HOA: 'EXTERNAL_HOA',
	EXTERNAL_VENDOR: 'EXTERNAL_VENDOR',
	CONCIERGE_ACTION: 'CONCIERGE_ACTION',
	MEETING: 'MEETING',
	MOTION: 'MOTION',
	VOTE: 'VOTE',
	RESOLUTION: 'RESOLUTION',
	USER: 'USER',
	USER_ROLE: 'USER_ROLE',
	ORGANIZATION: 'ORGANIZATION',
	DOCUMENT: 'DOCUMENT',
	STAFF: 'STAFF',
	STAFF_ASSIGNMENT: 'STAFF_ASSIGNMENT',
	VENDOR_CANDIDATE: 'VENDOR_CANDIDATE',
	VENDOR_BID: 'VENDOR_BID',
	OTHER: 'OTHER'
} as const;

export const ActivityActionTypeValues = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	STATUS_CHANGE: 'STATUS_CHANGE',
	APPROVE: 'APPROVE',
	DENY: 'DENY',
	ASSIGN: 'ASSIGN',
	UNASSIGN: 'UNASSIGN',
	SUBMIT: 'SUBMIT',
	CANCEL: 'CANCEL',
	COMPLETE: 'COMPLETE',
	SCHEDULE: 'SCHEDULE',
	DISPATCH: 'DISPATCH',
	CLOSE: 'CLOSE',
	REOPEN: 'REOPEN',
	ESCALATE: 'ESCALATE',
	ROLE_CHANGE: 'ROLE_CHANGE',
	LOGIN: 'LOGIN',
	LOGOUT: 'LOGOUT',
	WORKFLOW_INITIATED: 'WORKFLOW_INITIATED',
	WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
	WORKFLOW_FAILED: 'WORKFLOW_FAILED',
	CUSTOM: 'CUSTOM',
	CLASSIFY: 'CLASSIFY',
	VERSION: 'VERSION',
	SUPERSEDE: 'SUPERSEDE',
	REFERENCED: 'REFERENCED',
	START_SESSION: 'START_SESSION',
	ADJOURN: 'ADJOURN',
	APPROVE_MINUTES: 'APPROVE_MINUTES',
	ARCHIVE: 'ARCHIVE',
	PROPOSE: 'PROPOSE',
	SECOND: 'SECOND',
	OPEN_VOTING: 'OPEN_VOTING',
	CLOSE_VOTING: 'CLOSE_VOTING',
	TABLE: 'TABLE',
	WITHDRAW: 'WITHDRAW',
	CAST_BALLOT: 'CAST_BALLOT',
	ADOPT: 'ADOPT',
	REQUEST_INFO: 'REQUEST_INFO',
	RESPOND: 'RESPOND',
	LINK: 'LINK'
} as const;

export const ActivityActorTypeValues = {
	HUMAN: 'HUMAN',
	AI: 'AI',
	SYSTEM: 'SYSTEM'
} as const;

export const ActivityEventCategoryValues = {
	INTENT: 'INTENT',
	DECISION: 'DECISION',
	EXECUTION: 'EXECUTION',
	SYSTEM: 'SYSTEM'
} as const;

// Meeting & Governance Enums
export const MeetingStatusValues = {
	SCHEDULED: 'SCHEDULED',
	IN_SESSION: 'IN_SESSION',
	ADJOURNED: 'ADJOURNED',
	MINUTES_DRAFT: 'MINUTES_DRAFT',
	MINUTES_APPROVED: 'MINUTES_APPROVED',
	ARCHIVED: 'ARCHIVED',
	CANCELLED: 'CANCELLED'
} as const;

export const MeetingTypeValues = {
	BOARD: 'BOARD',
	ANNUAL: 'ANNUAL',
	SPECIAL: 'SPECIAL'
} as const;

export const MeetingAttendanceStatusValues = {
	PRESENT: 'PRESENT',
	ABSENT: 'ABSENT',
	EXCUSED: 'EXCUSED'
} as const;

export const BoardMotionStatusValues = {
	PROPOSED: 'PROPOSED',
	SECONDED: 'SECONDED',
	UNDER_DISCUSSION: 'UNDER_DISCUSSION',
	UNDER_VOTE: 'UNDER_VOTE',
	TABLED: 'TABLED',
	APPROVED: 'APPROVED',
	DENIED: 'DENIED',
	WITHDRAWN: 'WITHDRAWN'
} as const;

export const BoardMotionCategoryValues = {
	POLICY: 'POLICY',
	BUDGET: 'BUDGET',
	ASSESSMENT: 'ASSESSMENT',
	ENFORCEMENT: 'ENFORCEMENT',
	CONTRACT: 'CONTRACT',
	CAPITAL_PROJECT: 'CAPITAL_PROJECT',
	RULE_CHANGE: 'RULE_CHANGE',
	ELECTION: 'ELECTION',
	OTHER: 'OTHER'
} as const;

export const ResolutionStatusValues = {
	PROPOSED: 'PROPOSED',
	ADOPTED: 'ADOPTED',
	SUPERSEDED: 'SUPERSEDED',
	ARCHIVED: 'ARCHIVED'
} as const;

export const VoteMethodValues = {
	IN_PERSON: 'IN_PERSON',
	PROXY: 'PROXY',
	ELECTRONIC: 'ELECTRONIC'
} as const;

export const VoteChoiceValues = {
	YES: 'YES',
	NO: 'NO',
	ABSTAIN: 'ABSTAIN'
} as const;

export const CommitteeTypeValues = {
	ARC: 'ARC',
	SOCIAL: 'SOCIAL',
	LANDSCAPE: 'LANDSCAPE',
	BUDGET: 'BUDGET',
	SAFETY: 'SAFETY',
	NOMINATING: 'NOMINATING',
	CUSTOM: 'CUSTOM'
} as const;

export const CommitteeRoleValues = {
	CHAIR: 'CHAIR',
	VICE_CHAIR: 'VICE_CHAIR',
	SECRETARY: 'SECRETARY',
	MEMBER: 'MEMBER'
} as const;

export const BoardRoleValues = {
	PRESIDENT: 'PRESIDENT',
	VICE_PRESIDENT: 'VICE_PRESIDENT',
	SECRETARY: 'SECRETARY',
	TREASURER: 'TREASURER',
	DIRECTOR: 'DIRECTOR',
	MEMBER_AT_LARGE: 'MEMBER_AT_LARGE'
} as const;

// Document Enums
export const DocumentStatusValues = {
	DRAFT: 'DRAFT',
	PENDING_UPLOAD: 'PENDING_UPLOAD',
	PROCESSING: 'PROCESSING',
	PROCESSING_FAILED: 'PROCESSING_FAILED',
	INFECTED: 'INFECTED',
	ACTIVE: 'ACTIVE',
	SUPERSEDED: 'SUPERSEDED',
	ARCHIVED: 'ARCHIVED'
} as const;

export const DocumentCategoryValues = {
	GOVERNING_DOCS: 'GOVERNING_DOCS',
	FINANCIAL: 'FINANCIAL',
	MEETING: 'MEETING',
	LEGAL: 'LEGAL',
	INSURANCE: 'INSURANCE',
	MAINTENANCE: 'MAINTENANCE',
	ARCHITECTURAL: 'ARCHITECTURAL',
	RESERVE_STUDY: 'RESERVE_STUDY',
	INSPECTION: 'INSPECTION',
	CONTRACT: 'CONTRACT',
	CC_AND_RS: 'CC_AND_RS',
	PERMIT: 'PERMIT',
	APPROVAL: 'APPROVAL',
	CORRESPONDENCE: 'CORRESPONDENCE',
	TITLE_DEED: 'TITLE_DEED',
	SURVEY: 'SURVEY',
	WARRANTY: 'WARRANTY',
	LICENSE: 'LICENSE',
	CERTIFICATION: 'CERTIFICATION',
	BOND: 'BOND',
	PROPOSAL: 'PROPOSAL',
	ESTIMATE: 'ESTIMATE',
	INVOICE: 'INVOICE',
	WORK_ORDER: 'WORK_ORDER',
	VOICE_NOTE: 'VOICE_NOTE',
	SIGNATURE: 'SIGNATURE',
	CHECKLIST: 'CHECKLIST',
	ARC_ATTACHMENT: 'ARC_ATTACHMENT',
	VIOLATION_EVIDENCE: 'VIOLATION_EVIDENCE',
	PHOTO: 'PHOTO',
	VIDEO: 'VIDEO',
	AUDIO: 'AUDIO',
	GENERAL: 'GENERAL'
} as const;

export const DocumentContextTypeValues = {
	ASSOCIATION: 'ASSOCIATION',
	PROPERTY: 'PROPERTY',
	UNIT: 'UNIT',
	JOB: 'JOB',
	CASE: 'CASE',
	WORK_ORDER: 'WORK_ORDER',
	TECHNICIAN: 'TECHNICIAN',
	CONTRACTOR: 'CONTRACTOR',
	VENDOR: 'VENDOR',
	PARTY: 'PARTY',
	OWNER_INTENT: 'OWNER_INTENT',
	VIOLATION: 'VIOLATION',
	ARC_REQUEST: 'ARC_REQUEST',
	BOARD_MOTION: 'BOARD_MOTION',
	RESOLUTION: 'RESOLUTION',
	MEETING: 'MEETING'
} as const;

export const DocumentVisibilityValues = {
	PUBLIC: 'PUBLIC',
	OWNERS_ONLY: 'OWNERS_ONLY',
	BOARD_ONLY: 'BOARD_ONLY',
	STAFF_ONLY: 'STAFF_ONLY',
	PRIVATE: 'PRIVATE'
} as const;

// Vendor & Approval Enums
export const VendorApprovalStatusValues = {
	PENDING: 'PENDING',
	APPROVED: 'APPROVED',
	CONDITIONAL: 'CONDITIONAL',
	SUSPENDED: 'SUSPENDED',
	REJECTED: 'REJECTED'
} as const;

export const VendorCandidateStatusValues = {
	IDENTIFIED: 'IDENTIFIED',
	CONTACTED: 'CONTACTED',
	RESPONDED: 'RESPONDED',
	QUOTED: 'QUOTED',
	SELECTED: 'SELECTED',
	REJECTED: 'REJECTED',
	ARCHIVED: 'ARCHIVED'
} as const;

export const ExternalApprovalStatusValues = {
	NOT_REQUIRED: 'NOT_REQUIRED',
	PENDING: 'PENDING',
	SUBMITTED: 'SUBMITTED',
	APPROVED: 'APPROVED',
	DENIED: 'DENIED',
	EXPIRED: 'EXPIRED'
} as const;

export const BoardApprovalStatusValues = {
	PENDING: 'PENDING',
	APPROVED: 'APPROVED',
	DENIED: 'DENIED'
} as const;

// Dispatch & Schedule Enums
export const DispatchStatusValues = {
	PENDING: 'PENDING',
	ASSIGNED: 'ASSIGNED',
	ACCEPTED: 'ACCEPTED',
	DECLINED: 'DECLINED',
	EN_ROUTE: 'EN_ROUTE',
	ON_SITE: 'ON_SITE',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED'
} as const;

export const ScheduledVisitStatusValues = {
	SCHEDULED: 'SCHEDULED',
	CONFIRMED: 'CONFIRMED',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED',
	RESCHEDULED: 'RESCHEDULED',
	MISSED: 'MISSED'
} as const;

export const JobVisitStatusValues = {
	SCHEDULED: 'SCHEDULED',
	EN_ROUTE: 'EN_ROUTE',
	ARRIVED: 'ARRIVED',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED'
} as const;

// Report Enums
export const ReportExecutionStatusValues = {
	PENDING: 'PENDING',
	RUNNING: 'RUNNING',
	COMPLETED: 'COMPLETED',
	FAILED: 'FAILED',
	CANCELLED: 'CANCELLED'
} as const;

export const ReportCategoryValues = {
	FINANCIAL: 'FINANCIAL',
	RECEIVABLES: 'RECEIVABLES',
	PAYABLES: 'PAYABLES',
	OPERATIONAL: 'OPERATIONAL',
	COMPLIANCE: 'COMPLIANCE',
	GOVERNANCE: 'GOVERNANCE',
	CUSTOM: 'CUSTOM'
} as const;

export const ReportFormatValues = {
	PDF: 'PDF',
	EXCEL: 'EXCEL',
	CSV: 'CSV',
	JSON: 'JSON',
	HTML: 'HTML'
} as const;

export const ScheduleFrequencyValues = {
	DAILY: 'DAILY',
	WEEKLY: 'WEEKLY',
	BIWEEKLY: 'BIWEEKLY',
	MONTHLY: 'MONTHLY',
	QUARTERLY: 'QUARTERLY',
	ANNUALLY: 'ANNUALLY',
	CUSTOM: 'CUSTOM'
} as const;

// Organization Enums
export const OrganizationStatusValues = {
	ACTIVE: 'ACTIVE',
	SUSPENDED: 'SUSPENDED',
	INACTIVE: 'INACTIVE'
} as const;

export const OrganizationTypeValues = {
	COMMUNITY_ASSOCIATION: 'COMMUNITY_ASSOCIATION',
	MANAGEMENT_COMPANY: 'MANAGEMENT_COMPANY',
	SERVICE_PROVIDER: 'SERVICE_PROVIDER',
	EXTERNAL_SERVICE_PROVIDER: 'EXTERNAL_SERVICE_PROVIDER',
	COMMERCIAL_CLIENT: 'COMMERCIAL_CLIENT',
	INDIVIDUAL_PROPERTY_OWNER: 'INDIVIDUAL_PROPERTY_OWNER',
	TRUST_OR_LLC: 'TRUST_OR_LLC',
	PLATFORM_OPERATOR: 'PLATFORM_OPERATOR'
} as const;

export const AssociationStatusValues = {
	ACTIVE: 'ACTIVE',
	ONBOARDING: 'ONBOARDING',
	SUSPENDED: 'SUSPENDED',
	TERMINATED: 'TERMINATED'
} as const;

// Insurance & License Enums
export const InsuranceStatusValues = {
	ACTIVE: 'ACTIVE',
	EXPIRED: 'EXPIRED',
	PENDING_VERIFICATION: 'PENDING_VERIFICATION',
	CANCELLED: 'CANCELLED'
} as const;

export const InsuranceTypeValues = {
	GENERAL_LIABILITY: 'GENERAL_LIABILITY',
	WORKERS_COMPENSATION: 'WORKERS_COMPENSATION',
	PROFESSIONAL_LIABILITY: 'PROFESSIONAL_LIABILITY',
	AUTO_LIABILITY: 'AUTO_LIABILITY',
	UMBRELLA: 'UMBRELLA',
	BONDING: 'BONDING'
} as const;

export const LicenseStatusValues = {
	ACTIVE: 'ACTIVE',
	EXPIRED: 'EXPIRED',
	SUSPENDED: 'SUSPENDED',
	REVOKED: 'REVOKED',
	PENDING_RENEWAL: 'PENDING_RENEWAL'
} as const;

// Contractor Enums
export const ContractorTradeTypeValues = {
	PLUMBING: 'PLUMBING',
	ELECTRICAL: 'ELECTRICAL',
	HVAC: 'HVAC',
	ROOFING: 'ROOFING',
	LANDSCAPING: 'LANDSCAPING',
	PAINTING: 'PAINTING',
	FLOORING: 'FLOORING',
	CARPENTRY: 'CARPENTRY',
	MASONRY: 'MASONRY',
	GENERAL_CONTRACTOR: 'GENERAL_CONTRACTOR',
	POOL_SPA: 'POOL_SPA',
	PEST_CONTROL: 'PEST_CONTROL',
	CLEANING: 'CLEANING',
	SECURITY: 'SECURITY',
	FIRE_SAFETY: 'FIRE_SAFETY',
	ELEVATOR: 'ELEVATOR',
	APPLIANCE_REPAIR: 'APPLIANCE_REPAIR',
	LOCKSMITH: 'LOCKSMITH',
	GLASS_WINDOW: 'GLASS_WINDOW',
	FENCING: 'FENCING',
	CONCRETE: 'CONCRETE',
	DEMOLITION: 'DEMOLITION',
	EXCAVATION: 'EXCAVATION',
	WATERPROOFING: 'WATERPROOFING',
	INSULATION: 'INSULATION',
	DRYWALL: 'DRYWALL',
	SIDING: 'SIDING',
	GUTTERS: 'GUTTERS',
	GARAGE_DOOR: 'GARAGE_DOOR',
	OTHER: 'OTHER'
} as const;

// Pricebook & Version Enums
export const PricebookVersionStatusValues = {
	DRAFT: 'DRAFT',
	PUBLISHED: 'PUBLISHED',
	ACTIVE: 'ACTIVE',
	ARCHIVED: 'ARCHIVED'
} as const;

export const PricebookItemTypeValues = {
	SERVICE: 'SERVICE',
	LABOR: 'LABOR',
	MATERIAL: 'MATERIAL',
	BUNDLE: 'BUNDLE'
} as const;

// Communication & Notification Enums
export const CommunicationStatusValues = {
	DRAFT: 'DRAFT',
	SCHEDULED: 'SCHEDULED',
	SENT: 'SENT',
	CANCELLED: 'CANCELLED'
} as const;

export const NotificationStatusValues = {
	PENDING: 'PENDING',
	SENT: 'SENT',
	FAILED: 'FAILED',
	CANCELLED: 'CANCELLED'
} as const;

export const NotificationTypeValues = {
	INFO: 'INFO',
	SUCCESS: 'SUCCESS',
	WARNING: 'WARNING',
	ERROR: 'ERROR'
} as const;

export const NotificationCategoryValues = {
	GENERAL: 'GENERAL',
	BILLING: 'BILLING',
	MAINTENANCE: 'MAINTENANCE',
	GOVERNANCE: 'GOVERNANCE',
	ARC: 'ARC',
	VIOLATION: 'VIOLATION',
	COMMUNICATION: 'COMMUNICATION',
	DOCUMENT_PROCESSING: 'DOCUMENT_PROCESSING'
} as const;

// Billing & Payment Enums
export const BidStatusValues = {
	REQUESTED: 'REQUESTED',
	PENDING: 'PENDING',
	SUBMITTED: 'SUBMITTED',
	UNDER_REVIEW: 'UNDER_REVIEW',
	ACCEPTED: 'ACCEPTED',
	REJECTED: 'REJECTED',
	WITHDRAWN: 'WITHDRAWN',
	EXPIRED: 'EXPIRED'
} as const;

export const EstimateStatusValues = {
	DRAFT: 'DRAFT',
	SENT: 'SENT',
	VIEWED: 'VIEWED',
	ACCEPTED: 'ACCEPTED',
	DECLINED: 'DECLINED',
	EXPIRED: 'EXPIRED',
	REVISED: 'REVISED'
} as const;

export const InvoiceStatusValues = {
	DRAFT: 'DRAFT',
	PENDING_APPROVAL: 'PENDING_APPROVAL',
	APPROVED: 'APPROVED',
	PARTIALLY_PAID: 'PARTIALLY_PAID',
	PAID: 'PAID',
	VOIDED: 'VOIDED'
} as const;

export const JobInvoiceStatusValues = {
	DRAFT: 'DRAFT',
	SENT: 'SENT',
	VIEWED: 'VIEWED',
	PARTIAL: 'PARTIAL',
	PAID: 'PAID',
	OVERDUE: 'OVERDUE',
	VOID: 'VOID',
	REFUNDED: 'REFUNDED'
} as const;

export const JobPaymentStatusValues = {
	PENDING: 'PENDING',
	PROCESSING: 'PROCESSING',
	SUCCEEDED: 'SUCCEEDED',
	FAILED: 'FAILED',
	CANCELLED: 'CANCELLED',
	REFUNDED: 'REFUNDED'
} as const;

export const PaymentStatusValues = {
	PENDING: 'PENDING',
	CLEARED: 'CLEARED',
	BOUNCED: 'BOUNCED',
	REFUNDED: 'REFUNDED',
	VOIDED: 'VOIDED'
} as const;

export const PaymentMethodValues = {
	CHECK: 'CHECK',
	ACH: 'ACH',
	CREDIT_CARD: 'CREDIT_CARD',
	CASH: 'CASH',
	WIRE: 'WIRE',
	OTHER: 'OTHER'
} as const;

export const ChargeStatusValues = {
	PENDING: 'PENDING',
	BILLED: 'BILLED',
	PARTIALLY_PAID: 'PARTIALLY_PAID',
	PAID: 'PAID',
	WRITTEN_OFF: 'WRITTEN_OFF',
	CREDITED: 'CREDITED'
} as const;

export const PurchaseOrderStatusValues = {
	DRAFT: 'DRAFT',
	SUBMITTED: 'SUBMITTED',
	CONFIRMED: 'CONFIRMED',
	PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
	RECEIVED: 'RECEIVED',
	CANCELLED: 'CANCELLED'
} as const;

// Checklist & Milestone Enums
export const ChecklistItemStatusValues = {
	PENDING: 'PENDING',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	SKIPPED: 'SKIPPED',
	FAILED: 'FAILED'
} as const;

export const MilestoneStatusValues = {
	PENDING: 'PENDING',
	IN_PROGRESS: 'IN_PROGRESS',
	COMPLETED: 'COMPLETED',
	SKIPPED: 'SKIPPED',
	BLOCKED: 'BLOCKED'
} as const;

export const MilestoneTypeValues = {
	INTAKE_COMPLETE: 'INTAKE_COMPLETE',
	ASSESSMENT_COMPLETE: 'ASSESSMENT_COMPLETE',
	SCOPE_DEFINED: 'SCOPE_DEFINED',
	VENDOR_SELECTED: 'VENDOR_SELECTED',
	WORK_STARTED: 'WORK_STARTED',
	WORK_COMPLETE: 'WORK_COMPLETE',
	INSPECTION_PASSED: 'INSPECTION_PASSED',
	PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
	CASE_CLOSED: 'CASE_CLOSED',
	CUSTOM: 'CUSTOM'
} as const;

// Template & Policy Enums
export const TemplateVersionStatusValues = {
	DRAFT: 'DRAFT',
	ACTIVE: 'ACTIVE',
	RETIRED: 'RETIRED'
} as const;

export const PolicyStatusValues = {
	DRAFT: 'DRAFT',
	ACTIVE: 'ACTIVE',
	RETIRED: 'RETIRED'
} as const;

// Asset & Reserve Enums
export const AssetStatusValues = {
	ACTIVE: 'ACTIVE',
	INACTIVE: 'INACTIVE',
	UNDER_REPAIR: 'UNDER_REPAIR',
	DISPOSED: 'DISPOSED'
} as const;

export const AssetCategoryValues = {
	HVAC: 'HVAC',
	PLUMBING: 'PLUMBING',
	ELECTRICAL: 'ELECTRICAL',
	STRUCTURAL: 'STRUCTURAL',
	LANDSCAPING: 'LANDSCAPING',
	POOL_SPA: 'POOL_SPA',
	ELEVATOR: 'ELEVATOR',
	SECURITY: 'SECURITY',
	FIRE_SAFETY: 'FIRE_SAFETY',
	COMMON_AREA: 'COMMON_AREA',
	EQUIPMENT: 'EQUIPMENT',
	VEHICLE: 'VEHICLE',
	OTHER: 'OTHER'
} as const;

export const ReserveComponentCategoryValues = {
	ROOFING: 'ROOFING',
	PAVING: 'PAVING',
	PAINTING: 'PAINTING',
	PLUMBING: 'PLUMBING',
	ELECTRICAL: 'ELECTRICAL',
	HVAC: 'HVAC',
	POOL_SPA: 'POOL_SPA',
	LANDSCAPING: 'LANDSCAPING',
	FENCING: 'FENCING',
	STRUCTURAL: 'STRUCTURAL',
	ELEVATOR: 'ELEVATOR',
	COMMON_AREA: 'COMMON_AREA',
	EQUIPMENT: 'EQUIPMENT',
	OTHER: 'OTHER'
} as const;

// Appeal Enums
export const AppealStatusValues = {
	PENDING: 'PENDING',
	SCHEDULED: 'SCHEDULED',
	UPHELD: 'UPHELD',
	MODIFIED: 'MODIFIED',
	REVERSED: 'REVERSED',
	WITHDRAWN: 'WITHDRAWN'
} as const;

export const AppealDecisionValues = {
	UPHELD: 'UPHELD',
	MODIFIED: 'MODIFIED',
	OVERTURNED: 'OVERTURNED',
	REVERSED: 'REVERSED'
} as const;

// Job Source Enums
export const JobSourceTypeValues = {
	WORK_ORDER: 'WORK_ORDER',
	VIOLATION: 'VIOLATION',
	ARC_REQUEST: 'ARC_REQUEST',
	DIRECT_CUSTOMER: 'DIRECT_CUSTOMER',
	LEAD: 'LEAD',
	RECURRING: 'RECURRING'
} as const;

export const JobPriorityValues = {
	EMERGENCY: 'EMERGENCY',
	HIGH: 'HIGH',
	MEDIUM: 'MEDIUM',
	LOW: 'LOW'
} as const;

// Property & Unit Enums
export const PropertyTypeValues = {
	SINGLE_FAMILY: 'SINGLE_FAMILY',
	CONDOMINIUM: 'CONDOMINIUM',
	TOWNHOUSE: 'TOWNHOUSE',
	COOPERATIVE: 'COOPERATIVE',
	MIXED_USE: 'MIXED_USE',
	COMMERCIAL: 'COMMERCIAL'
} as const;

export const UnitTypeValues = {
	SINGLE_FAMILY_HOME: 'SINGLE_FAMILY_HOME',
	CONDO_UNIT: 'CONDO_UNIT',
	TOWNHOUSE: 'TOWNHOUSE',
	LOT: 'LOT',
	COMMERCIAL_UNIT: 'COMMERCIAL_UNIT'
} as const;

export const PropertyOwnershipStatusValues = {
	ACTIVE: 'ACTIVE',
	PENDING_VERIFICATION: 'PENDING_VERIFICATION',
	SUSPENDED: 'SUSPENDED',
	TERMINATED: 'TERMINATED'
} as const;

export const PropertyOwnershipRoleValues = {
	OWNER: 'OWNER',
	CO_OWNER: 'CO_OWNER',
	TRUSTEE_MANAGER: 'TRUSTEE_MANAGER',
	DELEGATED_AGENT: 'DELEGATED_AGENT'
} as const;

// Party & Ownership Enums
export const PartyTypeValues = {
	INDIVIDUAL: 'INDIVIDUAL',
	TRUST: 'TRUST',
	CORPORATION: 'CORPORATION',
	LLC: 'LLC',
	PARTNERSHIP: 'PARTNERSHIP',
	ESTATE: 'ESTATE'
} as const;

export const OwnershipTypeValues = {
	FEE_SIMPLE: 'FEE_SIMPLE',
	JOINT_TENANCY: 'JOINT_TENANCY',
	TENANCY_IN_COMMON: 'TENANCY_IN_COMMON',
	COMMUNITY_PROPERTY: 'COMMUNITY_PROPERTY',
	TRUST: 'TRUST'
} as const;

// User Role Enum
export const UserRoleValues = {
	OWNER: 'OWNER',
	TENANT: 'TENANT',
	MANAGER: 'MANAGER',
	VENDOR: 'VENDOR',
	BOARD_MEMBER: 'BOARD_MEMBER',
	ADMIN: 'ADMIN'
} as const;

// Notice Enums
export const NoticeTypeValues = {
	WARNING: 'WARNING',
	FIRST_NOTICE: 'FIRST_NOTICE',
	SECOND_NOTICE: 'SECOND_NOTICE',
	FINAL_NOTICE: 'FINAL_NOTICE',
	FINE_NOTICE: 'FINE_NOTICE',
	HEARING_NOTICE: 'HEARING_NOTICE',
	CURE_CONFIRMATION: 'CURE_CONFIRMATION'
} as const;

export const NoticeDeliveryMethodValues = {
	EMAIL: 'EMAIL',
	MAIL: 'MAIL',
	CERTIFIED_MAIL: 'CERTIFIED_MAIL',
	POSTED: 'POSTED',
	HAND_DELIVERED: 'HAND_DELIVERED',
	PORTAL: 'PORTAL'
} as const;

// Case Note Enum
export const CaseNoteTypeValues = {
	GENERAL: 'GENERAL',
	CLARIFICATION_REQUEST: 'CLARIFICATION_REQUEST',
	CLARIFICATION_RESPONSE: 'CLARIFICATION_RESPONSE',
	DECISION_RATIONALE: 'DECISION_RATIONALE'
} as const;

// Accounting Enums
export const AccountTypeValues = {
	ASSET: 'ASSET',
	LIABILITY: 'LIABILITY',
	EQUITY: 'EQUITY',
	REVENUE: 'REVENUE',
	EXPENSE: 'EXPENSE'
} as const;

export const FundTypeValues = {
	OPERATING: 'OPERATING',
	RESERVE: 'RESERVE',
	SPECIAL: 'SPECIAL'
} as const;

export const JournalEntryStatusValues = {
	DRAFT: 'DRAFT',
	PENDING_APPROVAL: 'PENDING_APPROVAL',
	POSTED: 'POSTED',
	REVERSED: 'REVERSED'
} as const;

export const AssessmentFrequencyValues = {
	MONTHLY: 'MONTHLY',
	QUARTERLY: 'QUARTERLY',
	SEMI_ANNUAL: 'SEMI_ANNUAL',
	ANNUAL: 'ANNUAL',
	ONE_TIME: 'ONE_TIME'
} as const;

// Media & Evidence Enums
export const MediaTypeValues = {
	PHOTO: 'PHOTO',
	VIDEO: 'VIDEO',
	AUDIO: 'AUDIO',
	DOCUMENT: 'DOCUMENT'
} as const;

export const ReporterTypeValues = {
	STAFF: 'STAFF',
	RESIDENT: 'RESIDENT',
	ANONYMOUS: 'ANONYMOUS'
} as const;

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
	) => orpc.violation.sendNotice({ violationId: id, ...data, idempotencyKey: crypto.randomUUID() }),

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

	cure: (id: string, data?: { notes?: string }) => orpc.violation.cure({ id, ...data, idempotencyKey: crypto.randomUUID() }),

	close: (id: string, data?: { notes?: string }) => orpc.violation.close({ id, ...data, idempotencyKey: crypto.randomUUID() }),

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
	}) => orpc.violation.addEvidence({ ...data, idempotencyKey: crypto.randomUUID() }),

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
		orpc.workOrder.authorize({ ...data, idempotencyKey: crypto.randomUUID() }),

	getStatusHistory: (id: string) => orpc.workOrder.getStatusHistory({ workOrderId: id }),

	addComment: (data: { workOrderId: string; comment: string; isInternal?: boolean }) =>
		orpc.workOrder.addComment({ ...data, idempotencyKey: crypto.randomUUID() }),

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
	}) => orpc.unit.create({ ...data, idempotencyKey: crypto.randomUUID() }),

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
	}) => orpc.unit.update({ id, ...data, idempotencyKey: crypto.randomUUID() })
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
	}) => orpc.property.create({ ...data, idempotencyKey: crypto.randomUUID() }),

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
	}) => orpc.property.update({ id, ...data, idempotencyKey: crypto.randomUUID() })
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
	}) => orpc.vendor.create({ ...data, idempotencyKey: crypto.randomUUID() }),

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
	}) => orpc.vendor.update({ id, ...data, idempotencyKey: crypto.randomUUID() })
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
	}) => orpc.document.unlinkFromContext({ ...data, idempotencyKey: crypto.randomUUID() }),

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
		}) => orpc.assessment.createType({ ...data, idempotencyKey: crypto.randomUUID() }),
		listTypes: (params?: { isActive?: boolean }) =>
			orpc.assessment.listTypes(params || {}),
		createCharge: (data: { unitId: string; assessmentTypeId: string; chargeDate: string; dueDate: string; amount: number; periodStart?: string; periodEnd?: string; description?: string; postToGL?: boolean }) =>
			orpc.assessment.createCharge({ ...data, idempotencyKey: crypto.randomUUID() }),
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
	}) => orpc.dashboard.recordView({ ...data, idempotencyKey: crypto.randomUUID() }),

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
			orpc.arcRequest.list({ status: ARCRequestStatusValues.SUBMITTED }).catch(() => null),
			orpc.workOrder.list({}).catch(() => null),
			orpc.vendor.list({ isActive: true }).catch(() => null)
		]);

		if (violationsRes?.ok && violationsRes.data?.violations) {
			const openStatuses = [
				ViolationStatusValues.OPEN,
				ViolationStatusValues.NOTICE_SENT,
				ViolationStatusValues.CURE_PERIOD,
				ViolationStatusValues.ESCALATED
			];
			counts.openViolations = violationsRes.data.violations.filter((v: { status: string }) =>
				(openStatuses as string[]).includes(v.status)
			).length;
		}

		if (arcRes?.ok && arcRes.data?.requests) {
			counts.pendingArcRequests = arcRes.data.requests.length;
		}

		if (workOrdersRes?.ok && workOrdersRes.data?.workOrders) {
			const now = new Date();
			const workOrders = workOrdersRes.data.workOrders;
			const activeStatuses = [
				WorkOrderStatusValues.SUBMITTED,
				WorkOrderStatusValues.ASSIGNED,
				WorkOrderStatusValues.SCHEDULED,
				WorkOrderStatusValues.IN_PROGRESS
			];
			counts.activeWorkOrders = workOrders.filter((wo: { status: string }) =>
				(activeStatuses as string[]).includes(wo.status)
			).length;
			const terminalStatuses = [
				WorkOrderStatusValues.COMPLETED,
				WorkOrderStatusValues.CLOSED,
				WorkOrderStatusValues.CANCELLED
			];
			counts.overdueWorkOrders = workOrders.filter((wo: { slaDeadline?: string | null; status: string }) => {
				if (!wo.slaDeadline) return false;
				return new Date(wo.slaDeadline) < now && !(terminalStatuses as string[]).includes(wo.status);
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
