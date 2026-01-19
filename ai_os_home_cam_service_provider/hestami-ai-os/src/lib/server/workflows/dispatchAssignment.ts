/**
 * Dispatch Assignment Workflow (v1)
 *
 * DBOS durable workflow for assigning technicians to jobs.
 * Handles: eligibility checks, routing calculation (stub), conflict handling.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType, JobStatus } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	DISPATCH_ASSIGNMENT_WORKFLOW_ERROR: 'DISPATCH_ASSIGNMENT_WORKFLOW_ERROR'
} as const;

// Conflict types for scheduling
const ConflictType = {
	SCHEDULE: 'SCHEDULE',
	TIME_OFF: 'TIME_OFF'
} as const;

const log = createWorkflowLogger('DispatchAssignmentWorkflow');

const WORKFLOW_STATUS_EVENT = 'dispatch_status';
const WORKFLOW_ERROR_EVENT = 'dispatch_error';

interface DispatchAssignmentInput {
	organizationId: string;
	jobId: string;
	technicianId: string;
	userId: string;
	scheduledStart?: Date;
	scheduledEnd?: Date;
	notes?: string;
	overrideConflicts?: boolean;
}

interface DispatchAssignmentResult {
	success: boolean;
	jobId: string;
	technicianId: string;
	timestamp: string;
	conflicts?: ConflictInfo[];
	routingInfo?: RoutingInfo;
	error?: string;
}

interface ConflictInfo {
	type: 'SCHEDULE' | 'TIME_OFF' | 'CAPACITY';
	description: string;
	conflictingJobId?: string;
}

interface RoutingInfo {
	estimatedTravelMinutes: number;
	distanceMiles: number;
	previousJobId?: string;
}

async function checkTechnicianEligibility(
	technicianId: string,
	organizationId: string
): Promise<{ eligible: boolean; reason?: string }> {
	const technician = await prisma.technician.findFirst({
		where: { id: technicianId, organizationId, isActive: true }
	});

	if (!technician) {
		return { eligible: false, reason: 'Technician not found or inactive' };
	}

	// Check compliance (license/insurance via contractor profile)
	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId },
		include: {
			licenses: { where: { status: 'ACTIVE', expirationDate: { gt: new Date() } } },
			insurances: { where: { status: 'ACTIVE', expirationDate: { gt: new Date() } } }
		}
	});

	if (!profile) {
		return { eligible: false, reason: 'Organization is not a contractor' };
	}

	if (profile.licenses.length === 0) {
		return { eligible: false, reason: 'No active license on file' };
	}

	if (profile.insurances.length === 0) {
		return { eligible: false, reason: 'No active insurance on file' };
	}

	return { eligible: true };
}

async function checkScheduleConflicts(
	technicianId: string,
	scheduledStart?: Date,
	scheduledEnd?: Date
): Promise<ConflictInfo[]> {
	const conflicts: ConflictInfo[] = [];

	if (!scheduledStart || !scheduledEnd) {
		return conflicts;
	}

	// Check for overlapping jobs
	const overlappingJobs = await prisma.job.findMany({
		where: {
			assignedTechnicianId: technicianId,
			status: { in: [JobStatus.SCHEDULED, JobStatus.IN_PROGRESS] },
			OR: [
				{
					scheduledStart: { lte: scheduledEnd },
					scheduledEnd: { gte: scheduledStart }
				}
			]
		},
		select: { id: true, jobNumber: true, scheduledStart: true, scheduledEnd: true }
	});

	for (const job of overlappingJobs) {
		conflicts.push({
			type: ConflictType.SCHEDULE,
			description: `Overlaps with job ${job.jobNumber}`,
			conflictingJobId: job.id
		});
	}

	// Check for time off
	const timeOff = await prisma.technicianTimeOff.findFirst({
		where: {
			technicianId,
			startsAt: { lte: scheduledEnd },
			endsAt: { gte: scheduledStart }
		}
	});

	if (timeOff) {
		conflicts.push({
			type: ConflictType.TIME_OFF,
			description: `Technician has approved time off during this period`
		});
	}

	return conflicts;
}

async function calculateRouting(
	technicianId: string,
	jobId: string,
	scheduledStart?: Date
): Promise<RoutingInfo> {
	// Stub implementation - in production would call routing service
	// For now, return placeholder values

	// Find previous job for the technician
	const previousJob = await prisma.job.findFirst({
		where: {
			assignedTechnicianId: technicianId,
			status: { in: [JobStatus.COMPLETED, JobStatus.SCHEDULED] },
			scheduledEnd: scheduledStart ? { lt: scheduledStart } : undefined
		},
		orderBy: { scheduledEnd: 'desc' },
		select: { id: true }
	});

	return {
		estimatedTravelMinutes: 15, // Stub value
		distanceMiles: 5.2, // Stub value
		previousJobId: previousJob?.id
	};
}

async function assignTechnicianToJob(
	input: DispatchAssignmentInput,
	organizationId: string
): Promise<void> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.job.update({
			where: { id: input.jobId },
			data: {
				assignedTechnicianId: input.technicianId,
				status: JobStatus.SCHEDULED,
				scheduledStart: input.scheduledStart,
				scheduledEnd: input.scheduledEnd
			}
		});

		// Record assignment in history
		await tx.jobStatusHistory.create({
			data: {
				jobId: input.jobId,
				fromStatus: 'JOB_CREATED',
				toStatus: 'SCHEDULED',
				changedBy: input.userId,
				notes: input.notes ?? `Assigned to technician ${input.technicianId}`
			}
		});
	}, { userId: input.userId, reason: 'Assigning technician to job' });
}

async function queueDispatchNotifications(
	jobId: string,
	technicianId: string,
	userId: string
): Promise<void> {
	console.log(`[DispatchWorkflow] Notification queued: Job ${jobId} assigned to technician ${technicianId} by user ${userId}`);
}

async function dispatchAssignmentWorkflow(input: DispatchAssignmentInput): Promise<DispatchAssignmentResult> {
	const workflowId = DBOS.workflowID;

	try {
		// Get job to verify organization
		const job = await prisma.job.findUnique({
			where: { id: input.jobId },
			select: { organizationId: true, status: true }
		});

		if (!job) {
			return {
				success: false,
				jobId: input.jobId,
				technicianId: input.technicianId,
				timestamp: new Date().toISOString(),
				error: 'Job not found'
			};
		}

		// Step 1: Check technician eligibility
		const eligibility = await DBOS.runStep(
			() => checkTechnicianEligibility(input.technicianId, job.organizationId),
			{ name: 'checkTechnicianEligibility' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'eligibility_checked', ...eligibility });

		if (!eligibility.eligible) {
			return {
				success: false,
				jobId: input.jobId,
				technicianId: input.technicianId,
				timestamp: new Date().toISOString(),
				error: eligibility.reason
			};
		}

		// Step 2: Check schedule conflicts
		const conflicts = await DBOS.runStep(
			() => checkScheduleConflicts(input.technicianId, input.scheduledStart, input.scheduledEnd),
			{ name: 'checkScheduleConflicts' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'conflicts_checked', conflictCount: conflicts.length });

		if (conflicts.length > 0 && !input.overrideConflicts) {
			return {
				success: false,
				jobId: input.jobId,
				technicianId: input.technicianId,
				timestamp: new Date().toISOString(),
				conflicts,
				error: 'Schedule conflicts detected'
			};
		}

		// Step 3: Calculate routing
		const routingInfo = await DBOS.runStep(
			() => calculateRouting(input.technicianId, input.jobId, input.scheduledStart),
			{ name: 'calculateRouting' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'routing_calculated', ...routingInfo });

		// Step 4: Assign technician
		await DBOS.runStep(
			() => assignTechnicianToJob(input, input.organizationId),
			{ name: 'assignTechnicianToJob' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'assigned' });

		// Step 5: Queue notifications
		await DBOS.runStep(
			() => queueDispatchNotifications(input.jobId, input.technicianId, input.userId),
			{ name: 'queueDispatchNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		return {
			success: true,
			jobId: input.jobId,
			technicianId: input.technicianId,
			timestamp: new Date().toISOString(),
			conflicts: conflicts.length > 0 ? conflicts : undefined,
			routingInfo
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.DISPATCH_ASSIGNMENT_WORKFLOW_ERROR
		});

		return {
			success: false,
			jobId: input.jobId,
			technicianId: input.technicianId,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const dispatchAssignment_v1 = DBOS.registerWorkflow(dispatchAssignmentWorkflow);

export async function startDispatchAssignment(
	input: DispatchAssignmentInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `dispatch-${input.jobId}-${Date.now()}`;
	await DBOS.startWorkflow(dispatchAssignment_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getDispatchAssignmentStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export async function getDispatchAssignmentError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { DispatchAssignmentInput, DispatchAssignmentResult, ConflictInfo, RoutingInfo };
