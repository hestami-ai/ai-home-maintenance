/**
 * Cross-Domain Integration Service
 *
 * Provides integration between Phase 1 (HOA/CAM) and Phase 2 (Contractor Operations).
 * Handles:
 * - Work Order → Job creation and status sync
 * - Violation → Job creation for remediation
 * - ARC Request → Job creation for inspections/installations
 * - Vendor compliance integration
 *
 * NOTE: All mutating operations are now delegated to crossDomainIntegrationWorkflow
 * for governance compliance (R2/R3 rules - DBOS durable workflows).
 */

import { prisma } from '../../db.js';
import { JobStatus, WorkOrderStatus, LicenseStatus, InsuranceStatus, ARCRequestStatus, ResolutionStatus, ActivityEntityType } from '../../../../../generated/prisma/enums.js';
import { startCrossDomainIntegrationWorkflow, CrossDomainIntegrationWorkflowAction } from '../../workflows/index.js';

// Schedule event types (not Prisma enums, but typed constants for consistency)
const ScheduleEventType = {
	JOB: 'JOB',
	SCHEDULED_VISIT: 'SCHEDULED_VISIT',
	WORK_ORDER: 'WORK_ORDER',
	TIME_OFF: 'TIME_OFF'
} as const;

// =============================================================================
// Status Mapping
// =============================================================================

/**
 * Map Work Order status to Job status
 */
const WORK_ORDER_TO_JOB_STATUS: Partial<Record<WorkOrderStatus, JobStatus>> = {
	[WorkOrderStatus.DRAFT]: JobStatus.TICKET,
	[WorkOrderStatus.SUBMITTED]: JobStatus.TICKET,
	[WorkOrderStatus.TRIAGED]: JobStatus.JOB_CREATED,
	[WorkOrderStatus.ASSIGNED]: JobStatus.SCHEDULED,
	[WorkOrderStatus.SCHEDULED]: JobStatus.SCHEDULED,
	[WorkOrderStatus.IN_PROGRESS]: JobStatus.IN_PROGRESS,
	[WorkOrderStatus.ON_HOLD]: JobStatus.ON_HOLD,
	[WorkOrderStatus.COMPLETED]: JobStatus.COMPLETED,
	[WorkOrderStatus.CLOSED]: JobStatus.CLOSED,
	[WorkOrderStatus.CANCELLED]: JobStatus.CANCELLED
};

/**
 * Map Job status to Work Order status
 */
const JOB_TO_WORK_ORDER_STATUS: Partial<Record<JobStatus, WorkOrderStatus>> = {
	[JobStatus.TICKET]: WorkOrderStatus.SUBMITTED,
	[JobStatus.JOB_CREATED]: WorkOrderStatus.TRIAGED,
	[JobStatus.SCHEDULED]: WorkOrderStatus.SCHEDULED,
	[JobStatus.IN_PROGRESS]: WorkOrderStatus.IN_PROGRESS,
	[JobStatus.ON_HOLD]: WorkOrderStatus.ON_HOLD,
	[JobStatus.COMPLETED]: WorkOrderStatus.COMPLETED,
	[JobStatus.CLOSED]: WorkOrderStatus.CLOSED,
	[JobStatus.CANCELLED]: WorkOrderStatus.CANCELLED
};

// =============================================================================
// Work Order → Job Integration
// =============================================================================

export interface CreateJobFromWorkOrderInput {
	workOrderId: string;
	contractorOrgId: string;
	userId: string;
	assignedTechnicianId?: string;
	assignedBranchId?: string;
	idempotencyKey: string;
}

export interface CreateJobFromWorkOrderResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create a contractor Job from an HOA Work Order
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createJobFromWorkOrder(
	input: CreateJobFromWorkOrderInput
): Promise<CreateJobFromWorkOrderResult> {
	// Check if job already exists for this work order (read-only check)
	const existingJob = await prisma.job.findFirst({
		where: {
			workOrderId: input.workOrderId,
			organizationId: input.contractorOrgId,
			deletedAt: null
		}
	});

	if (existingJob) {
		return {
			jobId: existingJob.id,
			jobNumber: existingJob.jobNumber,
			status: existingJob.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_JOB_FROM_WORK_ORDER,
			organizationId: input.contractorOrgId,
			userId: input.userId,
			workOrderId: input.workOrderId
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create job from work order');
	}

	// Fetch the created job to get the job number
	const job = await prisma.job.findUniqueOrThrow({
		where: { id: result.jobId! }
	});

	return {
		jobId: job.id,
		jobNumber: job.jobNumber,
		status: job.status
	};
}

/**
 * Sync Job status back to Work Order
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function syncJobStatusToWorkOrder(
	jobId: string,
	userId: string,
	organizationId: string,
	idempotencyKey: string
): Promise<{ workOrderId: string; newStatus: WorkOrderStatus } | null> {
	const job = await prisma.job.findUnique({
		where: { id: jobId },
		select: {
			workOrderId: true,
			status: true,
			organizationId: true
		}
	});

	if (!job?.workOrderId) {
		return null;
	}

	const newWorkOrderStatus = JOB_TO_WORK_ORDER_STATUS[job.status];
	if (!newWorkOrderStatus) {
		return null;
	}

	const workOrder = await prisma.workOrder.findUnique({
		where: { id: job.workOrderId },
		select: { status: true }
	});

	if (!workOrder || workOrder.status === newWorkOrderStatus) {
		return null;
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.SYNC_JOB_STATUS_TO_WORK_ORDER,
			organizationId,
			userId,
			jobId,
			jobStatus: job.status
		},
		idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to sync job status to work order');
	}

	return {
		workOrderId: job.workOrderId,
		newStatus: result.newStatus as WorkOrderStatus
	};
}

/**
 * Sync Work Order status to Job
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function syncWorkOrderStatusToJob(
	workOrderId: string,
	userId: string,
	organizationId: string,
	idempotencyKey: string
): Promise<{ jobId: string; newStatus: JobStatus } | null> {
	const workOrder = await prisma.workOrder.findUnique({
		where: { id: workOrderId },
		select: { status: true }
	});

	if (!workOrder) {
		return null;
	}

	const job = await prisma.job.findFirst({
		where: { workOrderId, deletedAt: null },
		select: { id: true, status: true }
	});

	if (!job) {
		return null;
	}

	const newJobStatus = WORK_ORDER_TO_JOB_STATUS[workOrder.status];
	if (!newJobStatus || job.status === newJobStatus) {
		return null;
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.SYNC_WORK_ORDER_STATUS_TO_JOB,
			organizationId,
			userId,
			workOrderId,
			workOrderStatus: workOrder.status
		},
		idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to sync work order status to job');
	}

	return {
		jobId: job.id,
		newStatus: result.newStatus as JobStatus
	};
}

// =============================================================================
// Violation → Job Integration
// =============================================================================

export interface CreateJobFromViolationInput {
	violationId: string;
	contractorOrgId: string;
	userId: string;
	title?: string;
	description?: string;
	assignedTechnicianId?: string;
	assignedBranchId?: string;
	idempotencyKey: string;
}

export interface CreateJobFromViolationResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create a remediation Job from a Violation
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createJobFromViolation(
	input: CreateJobFromViolationInput
): Promise<CreateJobFromViolationResult> {
	// Check if job already exists (read-only check)
	const existingJob = await prisma.job.findFirst({
		where: {
			violationId: input.violationId,
			organizationId: input.contractorOrgId,
			deletedAt: null
		}
	});

	if (existingJob) {
		return {
			jobId: existingJob.id,
			jobNumber: existingJob.jobNumber,
			status: existingJob.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_JOB_FROM_VIOLATION,
			organizationId: input.contractorOrgId,
			userId: input.userId,
			violationId: input.violationId
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create job from violation');
	}

	// Fetch the created job to get the job number
	const job = await prisma.job.findUniqueOrThrow({
		where: { id: result.jobId! }
	});

	return {
		jobId: job.id,
		jobNumber: job.jobNumber,
		status: job.status
	};
}

// =============================================================================
// ARC Request → Job Integration
// =============================================================================

export interface CreateJobFromARCRequestInput {
	arcRequestId: string;
	contractorOrgId: string;
	userId: string;
	title?: string;
	description?: string;
	jobType: 'INSPECTION' | 'INSTALLATION';
	assignedTechnicianId?: string;
	assignedBranchId?: string;
	idempotencyKey: string;
}

export interface CreateJobFromARCRequestResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create an inspection or installation Job from an ARC Request
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createJobFromARCRequest(
	input: CreateJobFromARCRequestInput
): Promise<CreateJobFromARCRequestResult> {
	// Check if job already exists (read-only check)
	const existingJob = await prisma.job.findFirst({
		where: {
			arcRequestId: input.arcRequestId,
			organizationId: input.contractorOrgId,
			deletedAt: null,
			category: input.jobType
		}
	});

	if (existingJob) {
		return {
			jobId: existingJob.id,
			jobNumber: existingJob.jobNumber,
			status: existingJob.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_JOB_FROM_ARC_REQUEST,
			organizationId: input.contractorOrgId,
			userId: input.userId,
			arcRequestId: input.arcRequestId
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create job from ARC request');
	}

	// Fetch the created job to get the job number
	const job = await prisma.job.findUniqueOrThrow({
		where: { id: result.jobId! }
	});

	return {
		jobId: job.id,
		jobNumber: job.jobNumber,
		status: job.status
	};
}

// =============================================================================
// Vendor Compliance Integration
// =============================================================================

export interface VendorComplianceStatus {
	vendorId: string;
	serviceProviderOrgId: string | null;
	isCompliant: boolean;
	hasValidLicense: boolean;
	hasValidInsurance: boolean;
	licenseExpirations: Array<{ type: string; expiresAt: Date }>;
	insuranceExpirations: Array<{ type: string; expiresAt: Date }>;
	complianceScore: number | null;
}

/**
 * Check vendor compliance status by linking to contractor profile
 */
export async function getVendorComplianceStatus(
	vendorId: string
): Promise<VendorComplianceStatus | null> {
	// Get vendor with its service provider link
	const vendor = await prisma.vendor.findUnique({
		where: { id: vendorId },
		select: {
			id: true,
			serviceProviderOrgId: true
		}
	});

	if (!vendor) {
		return null;
	}

	// If vendor is linked to a service provider org, check their compliance
	if (!vendor.serviceProviderOrgId) {
		return {
			vendorId,
			serviceProviderOrgId: null,
			isCompliant: false,
			hasValidLicense: false,
			hasValidInsurance: false,
			licenseExpirations: [],
			insuranceExpirations: [],
			complianceScore: null
		};
	}

	// Get contractor profile with licenses and insurances
	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId: vendor.serviceProviderOrgId },
		include: {
			licenses: true,
			insurances: true
		}
	});

	if (!profile) {
		return {
			vendorId,
			serviceProviderOrgId: vendor.serviceProviderOrgId,
			isCompliant: false,
			hasValidLicense: false,
			hasValidInsurance: false,
			licenseExpirations: [],
			insuranceExpirations: [],
			complianceScore: null
		};
	}

	const now = new Date();

	// Check licenses (status ACTIVE and not expired)
	const validLicenses = profile.licenses.filter(
		(l) => l.status === LicenseStatus.ACTIVE && (!l.expirationDate || l.expirationDate > now)
	);
	const hasValidLicense = validLicenses.length > 0;

	// Check insurances (status ACTIVE and not expired)
	const validInsurances = profile.insurances.filter(
		(i) => i.status === InsuranceStatus.ACTIVE && i.expirationDate > now
	);
	const hasValidInsurance = validInsurances.length > 0;

	// Get upcoming expirations (within 30 days)
	const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	const licenseExpirations = profile.licenses
		.filter((l) => l.expirationDate && l.expirationDate <= thirtyDaysFromNow && l.expirationDate > now)
		.map((l) => ({ type: l.licenseType, expiresAt: l.expirationDate! }));

	const insuranceExpirations = profile.insurances
		.filter((i) => i.expirationDate <= thirtyDaysFromNow && i.expirationDate > now)
		.map((i) => ({ type: i.insuranceType, expiresAt: i.expirationDate }));

	return {
		vendorId,
		serviceProviderOrgId: vendor.serviceProviderOrgId,
		isCompliant: hasValidLicense && hasValidInsurance,
		hasValidLicense,
		hasValidInsurance,
		licenseExpirations,
		insuranceExpirations,
		complianceScore: profile.complianceScore
	};
}

/**
 * Update vendor compliance notes based on contractor compliance status
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function syncVendorComplianceNotes(
	vendorId: string,
	organizationId: string,
	userId: string,
	idempotencyKey: string
): Promise<{ updated: boolean; notes?: string }> {
	const compliance = await getVendorComplianceStatus(vendorId);

	if (!compliance) {
		return { updated: false, notes: 'Vendor not found' };
	}

	const notes: string[] = [];
	if (!compliance.serviceProviderOrgId) {
		notes.push('Not linked to service provider');
	} else if (!compliance.isCompliant) {
		if (!compliance.hasValidLicense) notes.push('Missing valid license');
		if (!compliance.hasValidInsurance) notes.push('Missing valid insurance');
	} else {
		notes.push('Compliant');
		if (compliance.licenseExpirations.length > 0) {
			notes.push(`License expiring soon: ${compliance.licenseExpirations.map(l => l.type).join(', ')}`);
		}
		if (compliance.insuranceExpirations.length > 0) {
			notes.push(`Insurance expiring soon: ${compliance.insuranceExpirations.map(i => i.type).join(', ')}`);
		}
	}

	const complianceNotes = notes.join('; ');

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.SYNC_VENDOR_COMPLIANCE_NOTES,
			organizationId,
			userId,
			vendorId,
			notes: complianceNotes
		},
		idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to sync vendor compliance notes');
	}

	return { updated: true, notes: complianceNotes };
}

// =============================================================================
// Shared Scheduling Integration
// =============================================================================

export interface SharedScheduleEvent {
	id: string;
	type: 'JOB' | 'SCHEDULED_VISIT' | 'WORK_ORDER';
	title: string;
	start: Date;
	end: Date;
	resourceId?: string; // Technician or vendor ID
	resourceName?: string;
	status: string;
	sourceId: string;
}

/**
 * Get unified schedule for a date range
 */
export async function getUnifiedSchedule(
	organizationId: string,
	startDate: Date,
	endDate: Date,
	options?: {
		technicianId?: string;
		includeWorkOrders?: boolean;
		includeJobs?: boolean;
		includeScheduledVisits?: boolean;
	}
): Promise<SharedScheduleEvent[]> {
	const events: SharedScheduleEvent[] = [];

	// Get Jobs
	if (options?.includeJobs !== false) {
		const jobs = await prisma.job.findMany({
			where: {
				organizationId,
				deletedAt: null,
				scheduledStart: { gte: startDate, lte: endDate },
				...(options?.technicianId && { assignedTechnicianId: options.technicianId })
			},
			include: {
				assignedTechnician: { select: { firstName: true, lastName: true } }
			}
		});

		for (const job of jobs) {
			if (job.scheduledStart && job.scheduledEnd) {
				events.push({
					id: `job-${job.id}`,
					type: ActivityEntityType.JOB,
					title: job.title,
					start: job.scheduledStart,
					end: job.scheduledEnd,
					resourceId: job.assignedTechnicianId ?? undefined,
					resourceName: job.assignedTechnician
						? `${job.assignedTechnician.firstName} ${job.assignedTechnician.lastName}`
						: undefined,
					status: job.status,
					sourceId: job.id
				});
			}
		}
	}

	// Get Scheduled Visits (from maintenance contracts)
	if (options?.includeScheduledVisits !== false) {
		const visits = await prisma.scheduledVisit.findMany({
			where: {
				contract: { organizationId },
				scheduledStart: { gte: startDate, lte: endDate },
				...(options?.technicianId && { technicianId: options.technicianId })
			},
			include: {
				contract: { select: { name: true } },
				technician: { select: { firstName: true, lastName: true } }
			}
		});

		for (const visit of visits) {
			if (visit.scheduledStart && visit.scheduledEnd) {
				events.push({
					id: `visit-${visit.id}`,
					type: ScheduleEventType.SCHEDULED_VISIT,
					title: `${visit.contract.name} - Visit #${visit.visitNumber}`,
					start: visit.scheduledStart,
					end: visit.scheduledEnd,
					resourceId: visit.technicianId ?? undefined,
					resourceName: visit.technician
						? `${visit.technician.firstName} ${visit.technician.lastName}`
						: undefined,
					status: visit.status,
					sourceId: visit.id
				});
			}
		}
	}

	// Sort by start time
	events.sort((a, b) => a.start.getTime() - b.start.getTime());

	return events;
}

/**
 * Check for scheduling conflicts
 */
export async function checkSchedulingConflicts(
	technicianId: string,
	startTime: Date,
	endTime: Date,
	excludeJobId?: string
): Promise<Array<{ type: string; id: string; title: string; start: Date; end: Date }>> {
	const conflicts: Array<{ type: string; id: string; title: string; start: Date; end: Date }> = [];

	// Check job conflicts
	const jobConflicts = await prisma.job.findMany({
		where: {
			assignedTechnicianId: technicianId,
			deletedAt: null,
			status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
			...(excludeJobId && { id: { not: excludeJobId } }),
			OR: [
				{
					scheduledStart: { lte: endTime },
					scheduledEnd: { gte: startTime }
				}
			]
		},
		select: { id: true, title: true, scheduledStart: true, scheduledEnd: true }
	});

	for (const job of jobConflicts) {
		if (job.scheduledStart && job.scheduledEnd) {
			conflicts.push({
				type: ActivityEntityType.JOB,
				id: job.id,
				title: job.title,
				start: job.scheduledStart,
				end: job.scheduledEnd
			});
		}
	}

	// Check scheduled visit conflicts
	const visitConflicts = await prisma.scheduledVisit.findMany({
		where: {
			technicianId,
			status: { notIn: ['COMPLETED', 'CANCELLED', 'RESCHEDULED', 'MISSED'] },
			OR: [
				{
					scheduledStart: { lte: endTime },
					scheduledEnd: { gte: startTime }
				}
			]
		},
		include: { contract: { select: { name: true } } }
	});

	for (const visit of visitConflicts) {
		if (visit.scheduledStart && visit.scheduledEnd) {
			conflicts.push({
				type: ScheduleEventType.SCHEDULED_VISIT,
				id: visit.id,
				title: `${visit.contract.name} - Visit #${visit.visitNumber}`,
				start: visit.scheduledStart,
				end: visit.scheduledEnd
			});
		}
	}

	// Check time off
	const timeOffConflicts = await prisma.technicianTimeOff.findMany({
		where: {
			technicianId,
			OR: [
				{
					startsAt: { lte: endTime },
					endsAt: { gte: startTime }
				}
			]
		}
	});

	for (const timeOff of timeOffConflicts) {
		conflicts.push({
			type: ScheduleEventType.TIME_OFF,
			id: timeOff.id,
			title: `Time Off: ${timeOff.reason ?? 'Personal'}`,
			start: timeOff.startsAt,
			end: timeOff.endsAt
		});
	}

	return conflicts;
}

// =============================================================================
// Phase 9: Work Order Creation from Origin Entities (CAM Oversight)
// =============================================================================

export interface CreateWorkOrderFromViolationInput {
	violationId: string;
	organizationId: string;
	associationId: string;
	userId: string;
	title?: string;
	description?: string;
	priority?: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SCHEDULED';
	idempotencyKey: string;
}

export interface CreateWorkOrderFromViolationResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from a Violation (remediation work)
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createWorkOrderFromViolation(
	input: CreateWorkOrderFromViolationInput
): Promise<CreateWorkOrderFromViolationResult> {
	const violation = await prisma.violation.findUnique({
		where: { id: input.violationId },
		include: {
			violationType: true,
			unit: true
		}
	});

	if (!violation) {
		throw new Error(`Violation not found: ${input.violationId}`);
	}

	if (violation.associationId !== input.associationId) {
		throw new Error('Violation does not belong to this association');
	}

	// Check if work order already exists for this violation (read-only check)
	const existingWO = await prisma.workOrder.findFirst({
		where: {
			violationId: input.violationId,
			associationId: input.associationId
		}
	});

	if (existingWO) {
		return {
			workOrderId: existingWO.id,
			workOrderNumber: existingWO.workOrderNumber,
			status: existingWO.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_WORK_ORDER_FROM_VIOLATION,
			organizationId: input.organizationId,
			userId: input.userId,
			violationId: input.violationId,
			priority: input.priority as any
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create work order from violation');
	}

	// Fetch the created work order to get the work order number
	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: result.workOrderId! }
	});

	return {
		workOrderId: workOrder.id,
		workOrderNumber: workOrder.workOrderNumber,
		status: workOrder.status
	};
}

export interface CreateWorkOrderFromARCInput {
	arcRequestId: string;
	organizationId: string;
	associationId: string;
	userId: string;
	title?: string;
	description?: string;
	priority?: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SCHEDULED';
	idempotencyKey: string;
}

export interface CreateWorkOrderFromARCResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from an approved ARC Request
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createWorkOrderFromARC(
	input: CreateWorkOrderFromARCInput
): Promise<CreateWorkOrderFromARCResult> {
	const arcRequest = await prisma.aRCRequest.findUnique({
		where: { id: input.arcRequestId },
		include: { unit: true }
	});

	if (!arcRequest) {
		throw new Error(`ARC Request not found: ${input.arcRequestId}`);
	}

	if (arcRequest.associationId !== input.associationId) {
		throw new Error('ARC Request does not belong to this association');
	}

	if (arcRequest.status !== ARCRequestStatus.APPROVED) {
		throw new Error('ARC Request must be approved before creating work order');
	}

	// Check if work order already exists for this ARC request (read-only check)
	const existingWO = await prisma.workOrder.findFirst({
		where: {
			arcRequestId: input.arcRequestId,
			associationId: input.associationId
		}
	});

	if (existingWO) {
		return {
			workOrderId: existingWO.id,
			workOrderNumber: existingWO.workOrderNumber,
			status: existingWO.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_WORK_ORDER_FROM_ARC,
			organizationId: input.organizationId,
			userId: input.userId,
			arcRequestId: input.arcRequestId,
			priority: input.priority as any
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create work order from ARC request');
	}

	// Fetch the created work order to get the work order number
	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: result.workOrderId! }
	});

	return {
		workOrderId: workOrder.id,
		workOrderNumber: workOrder.workOrderNumber,
		status: workOrder.status
	};
}

export interface CreateWorkOrderFromResolutionInput {
	resolutionId: string;
	organizationId: string;
	associationId: string;
	userId: string;
	title?: string;
	description?: string;
	priority?: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SCHEDULED';
	budgetSource?: 'OPERATING' | 'RESERVE' | 'SPECIAL';
	approvedAmount?: number;
	idempotencyKey: string;
}

export interface CreateWorkOrderFromResolutionResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from a Board Resolution (board directive)
 * Board directives are pre-authorized
 * Uses crossDomainIntegrationWorkflow for governance compliance.
 */
export async function createWorkOrderFromResolution(
	input: CreateWorkOrderFromResolutionInput
): Promise<CreateWorkOrderFromResolutionResult> {
	const resolution = await prisma.resolution.findUnique({
		where: { id: input.resolutionId }
	});

	if (!resolution) {
		throw new Error(`Resolution not found: ${input.resolutionId}`);
	}

	if (resolution.associationId !== input.associationId) {
		throw new Error('Resolution does not belong to this association');
	}

	if (resolution.status !== ResolutionStatus.ADOPTED) {
		throw new Error('Resolution must be adopted before creating work order');
	}

	// Check if work order already exists for this resolution (read-only check)
	const existingWO = await prisma.workOrder.findFirst({
		where: {
			resolutionId: input.resolutionId,
			associationId: input.associationId
		}
	});

	if (existingWO) {
		return {
			workOrderId: existingWO.id,
			workOrderNumber: existingWO.workOrderNumber,
			status: existingWO.status
		};
	}

	// Delegate to workflow for mutation
	const result = await startCrossDomainIntegrationWorkflow(
		{
			action: CrossDomainIntegrationWorkflowAction.CREATE_WORK_ORDER_FROM_RESOLUTION,
			organizationId: input.organizationId,
			userId: input.userId,
			resolutionId: input.resolutionId,
			priority: input.priority as any
		},
		input.idempotencyKey
	);

	if (!result.success) {
		throw new Error(result.error || 'Failed to create work order from resolution');
	}

	// Fetch the created work order to get the work order number
	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: result.workOrderId! }
	});

	return {
		workOrderId: workOrder.id,
		workOrderNumber: workOrder.workOrderNumber,
		status: workOrder.status
	};
}
