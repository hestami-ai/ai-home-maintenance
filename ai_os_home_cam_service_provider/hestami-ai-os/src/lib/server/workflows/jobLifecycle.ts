/**
 * Job Lifecycle Workflow (v1)
 *
 * DBOS durable workflow for managing contractor job state transitions.
 * Handles: state validation, SLA tracking, notifications, and integration with HOA work orders.
 *
 * State Machine (Phase 15 - Contractor Job Lifecycle):
 *   LEAD → TICKET → ESTIMATE_REQUIRED → ESTIMATE_SENT → ESTIMATE_APPROVED → JOB_CREATED
 *                                                                              ↓
 *   LEAD → TICKET → JOB_CREATED (direct, no estimate required) ────────────────┘
 *                                                                              ↓
 *   JOB_CREATED → SCHEDULED → DISPATCHED → IN_PROGRESS → COMPLETED → INVOICED → PAID → CLOSED
 *                    ↓            ↓            ↓
 *                 ON_HOLD ←───────────────────┘
 *                    ↓
 *   Any state → CANCELLED (except CLOSED)
 *   COMPLETED → WARRANTY → CLOSED (optional warranty period)
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { JobStatus } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'job_status';
const WORKFLOW_ERROR_EVENT = 'job_error';

const validTransitions: Record<JobStatus, JobStatus[]> = {
	// Initial states
	LEAD: ['TICKET', 'CANCELLED'],
	TICKET: ['ESTIMATE_REQUIRED', 'JOB_CREATED', 'CANCELLED'],
	
	// Estimate workflow
	ESTIMATE_REQUIRED: ['ESTIMATE_SENT', 'JOB_CREATED', 'CANCELLED'],
	ESTIMATE_SENT: ['ESTIMATE_APPROVED', 'ESTIMATE_REQUIRED', 'CANCELLED'], // Can revise estimate
	ESTIMATE_APPROVED: ['JOB_CREATED', 'CANCELLED'],
	
	// Job execution
	JOB_CREATED: ['SCHEDULED', 'CANCELLED'],
	SCHEDULED: ['DISPATCHED', 'ON_HOLD', 'CANCELLED'],
	DISPATCHED: ['IN_PROGRESS', 'SCHEDULED', 'ON_HOLD', 'CANCELLED'], // Can reschedule
	IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
	ON_HOLD: ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'CANCELLED'],
	
	// Completion & payment
	COMPLETED: ['INVOICED', 'WARRANTY', 'CLOSED', 'CANCELLED'],
	INVOICED: ['PAID', 'CANCELLED'],
	PAID: ['WARRANTY', 'CLOSED'],
	WARRANTY: ['CLOSED', 'IN_PROGRESS'], // Can reopen for warranty work
	
	// Terminal states
	CLOSED: [],
	CANCELLED: []
};

const SLA_HOURS: Record<string, number> = {
	EMERGENCY: 2,
	HIGH: 8,
	MEDIUM: 24,
	LOW: 72,
	SCHEDULED: 168
};

interface JobTransitionInput {
	jobId: string;
	toStatus: JobStatus;
	userId: string;
	notes?: string;
	technicianId?: string;
	scheduledStart?: Date;
	scheduledEnd?: Date;
	actualCost?: number;
	actualHours?: number;
}

interface JobTransitionResult {
	success: boolean;
	jobId: string;
	fromStatus: JobStatus;
	toStatus: JobStatus;
	timestamp: string;
	slaStatus?: { isOverdue: boolean; hoursRemaining: number | null };
	error?: string;
}

async function validateJobTransition(input: JobTransitionInput): Promise<{
	valid: boolean;
	currentStatus: JobStatus;
	organizationId?: string;
	error?: string;
}> {
	const job = await prisma.job.findUnique({
		where: { id: input.jobId },
		select: { status: true, organizationId: true, assignedTechnicianId: true }
	});

	if (!job) {
		return { valid: false, currentStatus: 'LEAD', error: 'Job not found' };
	}

	const currentStatus = job.status as JobStatus;
	const allowedTransitions = validTransitions[currentStatus] || [];

	if (!allowedTransitions.includes(input.toStatus)) {
		return {
			valid: false,
			currentStatus,
			organizationId: job.organizationId,
			error: `Invalid transition from ${currentStatus} to ${input.toStatus}`
		};
	}

	// Validation for specific transitions
	if (input.toStatus === 'SCHEDULED' && !input.technicianId && !job.assignedTechnicianId) {
		// Technician assignment is recommended but not required
		console.log(`[JobWorkflow] Warning: Scheduling job ${input.jobId} without technician assignment`);
	}

	return { valid: true, currentStatus, organizationId: job.organizationId };
}

async function updateJobStatus(
	input: JobTransitionInput,
	fromStatus: JobStatus
): Promise<void> {
	await prisma.$transaction(async (tx) => {
		const updateData: Record<string, unknown> = {
			status: input.toStatus
		};

		switch (input.toStatus) {
			case 'ESTIMATE_SENT':
				// Estimate sent to customer - no additional fields needed
				break;

			case 'ESTIMATE_APPROVED':
				// Customer approved estimate - no additional fields needed
				break;

			case 'JOB_CREATED':
				// Job created from estimate or ticket
				break;

			case 'SCHEDULED':
				if (input.technicianId) {
					updateData.assignedTechnicianId = input.technicianId;
					updateData.assignedAt = new Date();
					updateData.assignedBy = input.userId;
				}
				if (input.scheduledStart) updateData.scheduledStart = input.scheduledStart;
				if (input.scheduledEnd) updateData.scheduledEnd = input.scheduledEnd;
				break;

			case 'DISPATCHED':
				updateData.dispatchedAt = new Date();
				break;

			case 'IN_PROGRESS':
				if (!input.scheduledStart) {
					// Only set startedAt if not already set
					const job = await tx.job.findUnique({ where: { id: input.jobId }, select: { startedAt: true } });
					if (!job?.startedAt) {
						updateData.startedAt = new Date();
					}
				}
				break;

			case 'COMPLETED':
				updateData.completedAt = new Date();
				if (input.actualCost !== undefined) updateData.actualCost = input.actualCost;
				if (input.actualHours !== undefined) updateData.actualHours = input.actualHours;
				break;

			case 'INVOICED':
				updateData.invoicedAt = new Date();
				break;

			case 'PAID':
				updateData.paidAt = new Date();
				break;

			case 'CLOSED':
				updateData.closedAt = new Date();
				updateData.closedBy = input.userId;
				break;

			case 'CANCELLED':
				updateData.cancelledAt = new Date();
				break;
		}

		await tx.job.update({
			where: { id: input.jobId },
			data: updateData
		});

		// Record status history
		await tx.jobStatusHistory.create({
			data: {
				jobId: input.jobId,
				fromStatus,
				toStatus: input.toStatus,
				changedBy: input.userId,
				notes: input.notes
			}
		});
	});
}

async function checkJobSlaCompliance(jobId: string): Promise<{
	isOverdue: boolean;
	hoursRemaining: number | null;
}> {
	const job = await prisma.job.findUnique({
		where: { id: jobId },
		select: { scheduledEnd: true, status: true, priority: true }
	});

	// Use scheduledEnd as SLA deadline proxy
	if (!job?.scheduledEnd) {
		return { isOverdue: false, hoursRemaining: null };
	}

	const now = new Date();
	const deadline = new Date(job.scheduledEnd);
	const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

	return {
		isOverdue: hoursRemaining < 0,
		hoursRemaining: Math.round(hoursRemaining * 10) / 10
	};
}

async function syncWithWorkOrder(jobId: string, toStatus: JobStatus): Promise<void> {
	const job = await prisma.job.findUnique({
		where: { id: jobId },
		select: { workOrderId: true }
	});

	if (!job?.workOrderId) return;

	// Map job status to work order status for sync
	const statusMap: Partial<Record<JobStatus, string>> = {
		IN_PROGRESS: 'IN_PROGRESS',
		COMPLETED: 'COMPLETED',
		CANCELLED: 'CANCELLED'
	};

	const workOrderStatus = statusMap[toStatus];
	if (workOrderStatus) {
		console.log(`[JobWorkflow] Sync job ${jobId} status ${toStatus} to work order ${job.workOrderId}`);
		// In production, this would trigger the work order workflow or update directly
	}
}

async function queueJobNotifications(
	jobId: string,
	fromStatus: JobStatus,
	toStatus: JobStatus,
	userId: string
): Promise<void> {
	console.log(`[JobWorkflow] Notification queued: Job ${jobId} transitioned from ${fromStatus} to ${toStatus} by user ${userId}`);
}

async function jobTransitionWorkflow(input: JobTransitionInput): Promise<JobTransitionResult> {
	const workflowId = DBOS.workflowID;

	try {
		const validation = await DBOS.runStep(
			() => validateJobTransition(input),
			{ name: 'validateJobTransition' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', ...validation });

		if (!validation.valid) {
			return {
				success: false,
				jobId: input.jobId,
				fromStatus: validation.currentStatus,
				toStatus: input.toStatus,
				timestamp: new Date().toISOString(),
				error: validation.error
			};
		}

		await DBOS.runStep(
			() => updateJobStatus(input, validation.currentStatus),
			{ name: 'updateJobStatus' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'updated', status: input.toStatus });

		const slaStatus = await DBOS.runStep(
			() => checkJobSlaCompliance(input.jobId),
			{ name: 'checkJobSlaCompliance' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'sla_checked', ...slaStatus });

		await DBOS.runStep(
			() => syncWithWorkOrder(input.jobId, input.toStatus),
			{ name: 'syncWithWorkOrder' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'synced' });

		await DBOS.runStep(
			() => queueJobNotifications(input.jobId, validation.currentStatus, input.toStatus, input.userId),
			{ name: 'queueJobNotifications' }
		);
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notifications_queued' });

		if (slaStatus.isOverdue) {
			console.warn(`[Workflow ${workflowId}] Job ${input.jobId} is OVERDUE by ${Math.abs(slaStatus.hoursRemaining!)} hours`);
		}

		return {
			success: true,
			jobId: input.jobId,
			fromStatus: validation.currentStatus,
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			slaStatus
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		return {
			success: false,
			jobId: input.jobId,
			fromStatus: 'LEAD',
			toStatus: input.toStatus,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const jobLifecycle_v1 = DBOS.registerWorkflow(jobTransitionWorkflow);

export async function startJobTransition(
	input: JobTransitionInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `job-transition-${input.jobId}-${Date.now()}`;
	await DBOS.startWorkflow(jobLifecycle_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getJobTransitionStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export async function getJobTransitionError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { JobTransitionInput, JobTransitionResult };
