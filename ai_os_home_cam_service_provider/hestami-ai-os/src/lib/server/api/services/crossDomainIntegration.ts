/**
 * Cross-Domain Integration Service
 *
 * Provides integration between Phase 1 (HOA/CAM) and Phase 2 (Contractor Operations).
 * Handles:
 * - Work Order → Job creation and status sync
 * - Violation → Job creation for remediation
 * - ARC Request → Job creation for inspections/installations
 * - Vendor compliance integration
 */

import { prisma } from '../../db.js';
import { JobStatus, JobSourceType, WorkOrderStatus } from '../../../../../generated/prisma/client.js';

// =============================================================================
// Status Mapping
// =============================================================================

/**
 * Map Work Order status to Job status
 */
const WORK_ORDER_TO_JOB_STATUS: Partial<Record<WorkOrderStatus, JobStatus>> = {
	DRAFT: 'TICKET',
	SUBMITTED: 'TICKET',
	TRIAGED: 'JOB_CREATED',
	ASSIGNED: 'SCHEDULED',
	SCHEDULED: 'SCHEDULED',
	IN_PROGRESS: 'IN_PROGRESS',
	ON_HOLD: 'ON_HOLD',
	COMPLETED: 'COMPLETED',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
};

/**
 * Map Job status to Work Order status
 */
const JOB_TO_WORK_ORDER_STATUS: Partial<Record<JobStatus, WorkOrderStatus>> = {
	TICKET: 'SUBMITTED',
	JOB_CREATED: 'TRIAGED',
	SCHEDULED: 'SCHEDULED',
	IN_PROGRESS: 'IN_PROGRESS',
	ON_HOLD: 'ON_HOLD',
	COMPLETED: 'COMPLETED',
	CLOSED: 'CLOSED',
	CANCELLED: 'CANCELLED'
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
}

export interface CreateJobFromWorkOrderResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create a contractor Job from an HOA Work Order
 */
export async function createJobFromWorkOrder(
	input: CreateJobFromWorkOrderInput
): Promise<CreateJobFromWorkOrderResult> {
	const workOrder = await prisma.workOrder.findUnique({
		where: { id: input.workOrderId },
		include: {
			unit: true,
			association: {
				include: {
					properties: { take: 1 }
				}
			}
		}
	});

	if (!workOrder) {
		throw new Error(`Work order not found: ${input.workOrderId}`);
	}

	// Check if job already exists for this work order
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

	// Generate job number
	const year = new Date().getFullYear();
	const count = await prisma.job.count({
		where: {
			organizationId: input.contractorOrgId,
			jobNumber: { startsWith: `JOB-${year}-` }
		}
	});
	const jobNumber = `JOB-${year}-${String(count + 1).padStart(6, '0')}`;

	// Map work order status to job status
	const jobStatus = WORK_ORDER_TO_JOB_STATUS[workOrder.status] ?? 'TICKET';

	// Map priority
	const priorityMap: Record<string, string> = {
		EMERGENCY: 'EMERGENCY',
		HIGH: 'HIGH',
		MEDIUM: 'MEDIUM',
		LOW: 'LOW'
	};

	const job = await prisma.$transaction(async (tx) => {
		const newJob = await tx.job.create({
			data: {
				organizationId: input.contractorOrgId,
				jobNumber,
				status: jobStatus,
				sourceType: 'WORK_ORDER',
				workOrderId: workOrder.id,
				unitId: workOrder.unitId,
				propertyId: workOrder.unit?.propertyId ?? workOrder.association?.properties[0]?.id,
				associationId: workOrder.associationId,
				title: workOrder.title,
				description: workOrder.description,
				category: workOrder.category,
				priority: priorityMap[workOrder.priority] ?? 'MEDIUM',
				assignedTechnicianId: input.assignedTechnicianId,
				assignedBranchId: input.assignedBranchId,
				assignedAt: input.assignedTechnicianId ? new Date() : null,
				assignedBy: input.assignedTechnicianId ? input.userId : null,
				scheduledStart: workOrder.scheduledStart,
				scheduledEnd: workOrder.scheduledEnd,
				estimatedCost: workOrder.estimatedCost,
				estimatedHours: workOrder.estimatedHours,
				locationNotes: workOrder.locationDetails
			}
		});

		// Record initial status
		await tx.jobStatusHistory.create({
			data: {
				jobId: newJob.id,
				toStatus: newJob.status,
				changedBy: input.userId
			}
		});

		return newJob;
	});

	return {
		jobId: job.id,
		jobNumber: job.jobNumber,
		status: job.status
	};
}

/**
 * Sync Job status back to Work Order
 */
export async function syncJobStatusToWorkOrder(
	jobId: string,
	userId: string
): Promise<{ workOrderId: string; newStatus: WorkOrderStatus } | null> {
	const job = await prisma.job.findUnique({
		where: { id: jobId },
		select: {
			workOrderId: true,
			status: true,
			completedAt: true,
			closedAt: true,
			actualCost: true,
			actualHours: true,
			resolutionNotes: true
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

	await prisma.$transaction(async (tx) => {
		// Update work order status
		await tx.workOrder.update({
			where: { id: job.workOrderId! },
			data: {
				status: newWorkOrderStatus,
				...(job.status === 'IN_PROGRESS' && !job.completedAt && { startedAt: new Date() }),
				...(job.status === 'COMPLETED' && { completedAt: job.completedAt ?? new Date() }),
				...(job.status === 'CLOSED' && { closedAt: job.closedAt ?? new Date(), closedBy: userId }),
				...(job.actualCost && { actualCost: job.actualCost }),
				...(job.actualHours && { actualHours: job.actualHours }),
				...(job.resolutionNotes && { resolutionNotes: job.resolutionNotes })
			}
		});

		// Record status history
		await tx.workOrderStatusHistory.create({
			data: {
				workOrderId: job.workOrderId!,
				fromStatus: workOrder.status,
				toStatus: newWorkOrderStatus,
				changedBy: userId,
				notes: `Synced from Job status: ${job.status}`
			}
		});
	});

	return {
		workOrderId: job.workOrderId,
		newStatus: newWorkOrderStatus
	};
}

/**
 * Sync Work Order status to Job
 */
export async function syncWorkOrderStatusToJob(
	workOrderId: string,
	userId: string
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

	await prisma.$transaction(async (tx) => {
		await tx.job.update({
			where: { id: job.id },
			data: { status: newJobStatus }
		});

		await tx.jobStatusHistory.create({
			data: {
				jobId: job.id,
				fromStatus: job.status,
				toStatus: newJobStatus,
				changedBy: userId,
				notes: `Synced from Work Order status: ${workOrder.status}`
			}
		});
	});

	return {
		jobId: job.id,
		newStatus: newJobStatus
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
}

export interface CreateJobFromViolationResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create a remediation Job from a Violation
 */
export async function createJobFromViolation(
	input: CreateJobFromViolationInput
): Promise<CreateJobFromViolationResult> {
	const violation = await prisma.violation.findUnique({
		where: { id: input.violationId },
		include: {
			unit: { select: { propertyId: true } },
			violationType: { select: { name: true } }
		}
	});

	if (!violation) {
		throw new Error(`Violation not found: ${input.violationId}`);
	}

	// Check if job already exists
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

	// Generate job number
	const year = new Date().getFullYear();
	const count = await prisma.job.count({
		where: {
			organizationId: input.contractorOrgId,
			jobNumber: { startsWith: `JOB-${year}-` }
		}
	});
	const jobNumber = `JOB-${year}-${String(count + 1).padStart(6, '0')}`;

	const job = await prisma.$transaction(async (tx) => {
		const violationTypeName = violation.violationType?.name ?? 'Unknown';
		const newJob = await tx.job.create({
			data: {
				organizationId: input.contractorOrgId,
				jobNumber,
				status: 'TICKET',
				sourceType: 'VIOLATION',
				violationId: violation.id,
				unitId: violation.unitId,
				propertyId: violation.unit?.propertyId,
				associationId: violation.associationId,
				title: input.title ?? `Violation Remediation: ${violationTypeName}`,
				description: input.description ?? violation.description,
				category: violationTypeName,
				priority: violation.severity === 'CRITICAL' ? 'EMERGENCY' : violation.severity === 'MAJOR' ? 'HIGH' : 'MEDIUM',
				assignedTechnicianId: input.assignedTechnicianId,
				assignedBranchId: input.assignedBranchId,
				assignedAt: input.assignedTechnicianId ? new Date() : null,
				assignedBy: input.assignedTechnicianId ? input.userId : null
			}
		});

		await tx.jobStatusHistory.create({
			data: {
				jobId: newJob.id,
				toStatus: newJob.status,
				changedBy: input.userId
			}
		});

		return newJob;
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
}

export interface CreateJobFromARCRequestResult {
	jobId: string;
	jobNumber: string;
	status: JobStatus;
}

/**
 * Create an inspection or installation Job from an ARC Request
 */
export async function createJobFromARCRequest(
	input: CreateJobFromARCRequestInput
): Promise<CreateJobFromARCRequestResult> {
	const arcRequest = await prisma.aRCRequest.findUnique({
		where: { id: input.arcRequestId },
		include: {
			unit: { select: { propertyId: true } }
		}
	});

	if (!arcRequest) {
		throw new Error(`ARC Request not found: ${input.arcRequestId}`);
	}

	// Check if job already exists
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

	// Generate job number
	const year = new Date().getFullYear();
	const count = await prisma.job.count({
		where: {
			organizationId: input.contractorOrgId,
			jobNumber: { startsWith: `JOB-${year}-` }
		}
	});
	const jobNumber = `JOB-${year}-${String(count + 1).padStart(6, '0')}`;

	const titlePrefix = input.jobType === 'INSPECTION' ? 'ARC Inspection' : 'ARC Installation';

	const job = await prisma.$transaction(async (tx) => {
		const newJob = await tx.job.create({
			data: {
				organizationId: input.contractorOrgId,
				jobNumber,
				status: 'TICKET',
				sourceType: 'ARC_REQUEST',
				arcRequestId: arcRequest.id,
				unitId: arcRequest.unitId,
				propertyId: arcRequest.unit?.propertyId,
				associationId: arcRequest.associationId,
				title: input.title ?? `${titlePrefix}: ${arcRequest.title}`,
				description: input.description ?? arcRequest.description,
				category: input.jobType,
				priority: 'MEDIUM',
				assignedTechnicianId: input.assignedTechnicianId,
				assignedBranchId: input.assignedBranchId,
				assignedAt: input.assignedTechnicianId ? new Date() : null,
				assignedBy: input.assignedTechnicianId ? input.userId : null
			}
		});

		await tx.jobStatusHistory.create({
			data: {
				jobId: newJob.id,
				toStatus: newJob.status,
				changedBy: input.userId
			}
		});

		return newJob;
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
		(l) => l.status === 'ACTIVE' && (!l.expirationDate || l.expirationDate > now)
	);
	const hasValidLicense = validLicenses.length > 0;

	// Check insurances (status ACTIVE and not expired)
	const validInsurances = profile.insurances.filter(
		(i) => i.status === 'ACTIVE' && i.expirationDate > now
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
 */
export async function syncVendorComplianceNotes(
	vendorId: string
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

	await prisma.vendor.update({
		where: { id: vendorId },
		data: { complianceNotes }
	});

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
					type: 'JOB',
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
					type: 'SCHEDULED_VISIT',
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
				type: 'JOB',
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
				type: 'SCHEDULED_VISIT',
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
			type: 'TIME_OFF',
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
}

export interface CreateWorkOrderFromViolationResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from a Violation (remediation work)
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

	// Check if work order already exists for this violation
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

	// Generate work order number
	const lastWO = await prisma.workOrder.findFirst({
		where: { associationId: input.associationId },
		orderBy: { createdAt: 'desc' }
	});

	const workOrderNumber = lastWO
		? `WO-${String(parseInt(lastWO.workOrderNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
		: 'WO-000001';

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			associationId: input.associationId,
			workOrderNumber,
			title: input.title ?? `Remediation: ${violation.violationType.name}`,
			description: input.description ?? `Work order created to remediate violation #${violation.violationNumber}: ${violation.title}`,
			category: 'REPAIR',
			priority: input.priority ?? 'MEDIUM',
			status: 'DRAFT',
			unitId: violation.unitId,
			commonAreaName: violation.commonAreaName,
			locationDetails: violation.locationDetails,
			requestedBy: input.userId,
			originType: 'VIOLATION_REMEDIATION',
			violationId: violation.id,
			originNotes: `Created from violation #${violation.violationNumber}`
		}
	});

	// Record status history
	await prisma.workOrderStatusHistory.create({
		data: {
			workOrderId: workOrder.id,
			fromStatus: null,
			toStatus: 'DRAFT',
			changedBy: input.userId,
			notes: `Work order created from violation #${violation.violationNumber}`
		}
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
}

export interface CreateWorkOrderFromARCResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from an approved ARC Request
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

	if (arcRequest.status !== 'APPROVED') {
		throw new Error('ARC Request must be approved before creating work order');
	}

	// Check if work order already exists for this ARC request
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

	// Generate work order number
	const lastWO = await prisma.workOrder.findFirst({
		where: { associationId: input.associationId },
		orderBy: { createdAt: 'desc' }
	});

	const workOrderNumber = lastWO
		? `WO-${String(parseInt(lastWO.workOrderNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
		: 'WO-000001';

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			associationId: input.associationId,
			workOrderNumber,
			title: input.title ?? arcRequest.title,
			description: input.description ?? arcRequest.description,
			category: 'INSTALLATION',
			priority: input.priority ?? 'MEDIUM',
			status: 'DRAFT',
			unitId: arcRequest.unitId,
			requestedBy: input.userId,
			estimatedCost: arcRequest.estimatedCost,
			originType: 'ARC_APPROVAL',
			arcRequestId: arcRequest.id,
			originNotes: `Created from ARC request #${arcRequest.requestNumber}`,
			constraints: arcRequest.conditions // Copy approval conditions
		}
	});

	// Record status history
	await prisma.workOrderStatusHistory.create({
		data: {
			workOrderId: workOrder.id,
			fromStatus: null,
			toStatus: 'DRAFT',
			changedBy: input.userId,
			notes: `Work order created from ARC request #${arcRequest.requestNumber}`
		}
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
}

export interface CreateWorkOrderFromResolutionResult {
	workOrderId: string;
	workOrderNumber: string;
	status: string;
}

/**
 * Phase 9: Create a Work Order from a Board Resolution (board directive)
 * Board directives are pre-authorized
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

	if (resolution.status !== 'ADOPTED') {
		throw new Error('Resolution must be adopted before creating work order');
	}

	// Check if work order already exists for this resolution
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

	// Generate work order number
	const lastWO = await prisma.workOrder.findFirst({
		where: { associationId: input.associationId },
		orderBy: { createdAt: 'desc' }
	});

	const workOrderNumber = lastWO
		? `WO-${String(parseInt(lastWO.workOrderNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
		: 'WO-000001';

	const now = new Date();

	// Board directives are pre-authorized
	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			associationId: input.associationId,
			workOrderNumber,
			title: input.title ?? resolution.title,
			description: input.description ?? resolution.summary ?? `Work order per board resolution: ${resolution.title}`,
			category: 'MAINTENANCE',
			priority: input.priority ?? 'MEDIUM',
			status: 'AUTHORIZED', // Pre-authorized by board
			requestedBy: input.userId,
			originType: 'BOARD_DIRECTIVE',
			resolutionId: resolution.id,
			originNotes: `Created from board resolution: ${resolution.title}`,
			// Pre-authorized fields
			authorizedBy: input.userId,
			authorizedAt: now,
			authorizingRole: 'BOARD',
			authorizationRationale: `Per board resolution: ${resolution.title}`,
			budgetSource: input.budgetSource,
			approvedAmount: input.approvedAmount
		}
	});

	// Record status history (skip DRAFT, go straight to AUTHORIZED)
	await prisma.workOrderStatusHistory.create({
		data: {
			workOrderId: workOrder.id,
			fromStatus: null,
			toStatus: 'AUTHORIZED',
			changedBy: input.userId,
			notes: `Work order created and pre-authorized from board resolution: ${resolution.title}`
		}
	});

	return {
		workOrderId: workOrder.id,
		workOrderNumber: workOrder.workOrderNumber,
		status: workOrder.status
	};
}
