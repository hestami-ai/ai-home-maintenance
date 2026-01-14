/**
 * Job Workflow (v1)
 *
 * DBOS durable workflow for managing contractor job operations.
 * Handles: update, transition, assign, schedule, notes, attachments, checkpoints, visits, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { JobStatus, type EntityWorkflowResult } from './schemas.js';
import type { CheckpointType } from '../../../../generated/prisma/client.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('JobWorkflow');

// Action types for the unified workflow
export const JobAction = {
	UPDATE_JOB: 'UPDATE_JOB',
	TRANSITION_STATUS: 'TRANSITION_STATUS',
	ASSIGN_TECHNICIAN: 'ASSIGN_TECHNICIAN',
	SCHEDULE_JOB: 'SCHEDULE_JOB',
	ADD_NOTE: 'ADD_NOTE',
	ADD_ATTACHMENT: 'ADD_ATTACHMENT',
	DELETE_ATTACHMENT: 'DELETE_ATTACHMENT',
	ADD_CHECKPOINT: 'ADD_CHECKPOINT',
	COMPLETE_CHECKPOINT: 'COMPLETE_CHECKPOINT',
	ADD_VISIT: 'ADD_VISIT',
	UPDATE_VISIT: 'UPDATE_VISIT',
	DELETE_JOB: 'DELETE_JOB'
} as const;

export type JobAction = (typeof JobAction)[keyof typeof JobAction];

export interface JobWorkflowInput {
	action: JobAction;
	organizationId: string;
	userId: string;
	jobId?: string;
	entityId?: string; // For notes, attachments, checkpoints, visits
	data: Record<string, unknown>;
}

export interface JobWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Helper to record workflow events - simplified logging for now
async function recordWorkflowEvent(
	organizationId: string,
	userId: string,
	entityType: string,
	entityId: string,
	action: string,
	metadata?: Record<string, unknown>
): Promise<void> {
	// Log the event for now - activity events will be recorded by the route handlers
	console.log(`[JobWorkflow] ${action} on ${entityType}:${entityId} by user ${userId}`);
}

// Step functions for each operation
async function updateJob(
	organizationId: string,
	userId: string,
	jobId: string,
	data: Record<string, unknown>
): Promise<string> {
	const { idempotencyKey, id, ...updateData } = data;

	const job = await prisma.job.update({
		where: { id: jobId },
		data: updateData
	});

	await recordWorkflowEvent(organizationId, userId, 'job', job.id, 'UPDATE_JOB', { fields: Object.keys(updateData) });
	return job.id;
}

async function transitionJobStatus(
	organizationId: string,
	userId: string,
	jobId: string,
	toStatus: JobStatus,
	notes?: string
): Promise<string> {
	const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
	const fromStatus = job.status;

	const updateData: Record<string, unknown> = { status: toStatus };

	switch (toStatus) {
		case 'DISPATCHED':
			updateData.dispatchedAt = new Date();
			break;
		case 'IN_PROGRESS':
			if (!job.startedAt) updateData.startedAt = new Date();
			break;
		case 'COMPLETED':
			updateData.completedAt = new Date();
			break;
		case 'INVOICED':
			updateData.invoicedAt = new Date();
			break;
		case 'PAID':
			updateData.paidAt = new Date();
			break;
		case 'CLOSED':
			updateData.closedAt = new Date();
			updateData.closedBy = userId;
			break;
		case 'CANCELLED':
			updateData.cancelledAt = new Date();
			break;
	}

	await prisma.$transaction(async (tx) => {
		await tx.job.update({ where: { id: jobId }, data: updateData });
		await tx.jobStatusHistory.create({
			data: {
				jobId,
				fromStatus,
				toStatus,
				changedBy: userId,
				notes
			}
		});

		// Phase 15.7: Propagate status to linked entities (work orders and concierge cases)
		// Map job status to work order status
		const jobToWorkOrderStatus: Partial<Record<JobStatus, string>> = {
			SCHEDULED: 'SCHEDULED',
			DISPATCHED: 'SCHEDULED',
			IN_PROGRESS: 'IN_PROGRESS',
			COMPLETED: 'COMPLETED',
			CLOSED: 'CLOSED',
			CANCELLED: 'CANCELLED'
		};

		const workOrderStatus = jobToWorkOrderStatus[toStatus];

		// Update linked work order if exists
		if (job.workOrderId && workOrderStatus) {
			await tx.workOrder.update({
				where: { id: job.workOrderId },
				data: {
					status: workOrderStatus as any,
					...(toStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
					...(toStatus === 'CLOSED' ? { closedAt: new Date(), closedBy: userId } : {})
				}
			}).catch((err) => {
				console.error(`Failed to update linked work order ${job.workOrderId}:`, err);
			});
		}

		// Update linked concierge cases
		const linkedCases = await tx.conciergeCase.findMany({
			where: { linkedJobId: jobId }
		});

		if (linkedCases.length > 0) {
			const jobToCaseStatus: Partial<Record<JobStatus, string>> = {
				SCHEDULED: 'IN_PROGRESS',
				IN_PROGRESS: 'IN_PROGRESS',
				COMPLETED: 'RESOLVED',
				CLOSED: 'CLOSED',
				CANCELLED: 'CLOSED'
			};

			const caseStatus = jobToCaseStatus[toStatus];
			if (caseStatus) {
				for (const linkedCase of linkedCases) {
					await tx.conciergeCase.update({
						where: { id: linkedCase.id },
						data: {
							status: caseStatus as any,
							...(toStatus === 'COMPLETED' || toStatus === 'CLOSED' ? { resolvedAt: new Date() } : {}),
							...(toStatus === 'CLOSED' ? { closedAt: new Date() } : {})
						}
					}).catch((err) => {
						console.error(`Failed to update linked case ${linkedCase.id}:`, err);
					});
				}
			}
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job', jobId, 'TRANSITION_STATUS', { fromStatus, toStatus });
	return jobId;
}

async function assignTechnician(
	organizationId: string,
	userId: string,
	jobId: string,
	technicianId: string
): Promise<string> {
	await prisma.job.update({
		where: { id: jobId },
		data: {
			assignedTechnicianId: technicianId,
			assignedAt: new Date(),
			assignedBy: userId
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job', jobId, 'ASSIGN_TECHNICIAN', { technicianId });
	return jobId;
}

async function scheduleJob(
	organizationId: string,
	userId: string,
	jobId: string,
	scheduledStart: string,
	scheduledEnd?: string,
	technicianId?: string
): Promise<string> {
	const updateData: Record<string, unknown> = {
		scheduledStart: new Date(scheduledStart),
		status: 'SCHEDULED'
	};

	if (scheduledEnd) updateData.scheduledEnd = new Date(scheduledEnd);
	if (technicianId) {
		updateData.assignedTechnicianId = technicianId;
		updateData.assignedAt = new Date();
		updateData.assignedBy = userId;
	}

	await prisma.job.update({ where: { id: jobId }, data: updateData });

	await recordWorkflowEvent(organizationId, userId, 'job', jobId, 'SCHEDULE_JOB', { scheduledStart, scheduledEnd, technicianId });
	return jobId;
}

async function addNote(
	organizationId: string,
	userId: string,
	jobId: string,
	content: string,
	isInternal: boolean
): Promise<string> {
	const note = await prisma.jobNote.create({
		data: {
			jobId,
			content,
			isInternal,
			authorId: userId
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job_note', note.id, 'ADD_NOTE', { jobId, isInternal });
	return note.id;
}

async function addAttachment(
	organizationId: string,
	userId: string,
	jobId: string,
	data: Record<string, unknown>
): Promise<string> {
	const attachment = await prisma.jobAttachment.create({
		data: {
			jobId,
			fileName: data.fileName as string,
			fileUrl: data.storageUrl as string,
			fileSize: data.fileSize as number | undefined,
			mimeType: data.fileType as string | undefined,
			description: data.description as string | undefined,
			uploadedBy: userId
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job_attachment', attachment.id, 'ADD_ATTACHMENT', { jobId });
	return attachment.id;
}

async function deleteAttachment(
	organizationId: string,
	userId: string,
	attachmentId: string
): Promise<string> {
	await prisma.jobAttachment.delete({ where: { id: attachmentId } });

	await recordWorkflowEvent(organizationId, userId, 'job_attachment', attachmentId, 'DELETE_ATTACHMENT');
	return attachmentId;
}

async function addCheckpoint(
	organizationId: string,
	userId: string,
	jobId: string,
	data: Record<string, unknown>
): Promise<string> {
	const checkpoint = await prisma.jobCheckpoint.create({
		data: {
			jobId,
			type: data.type as CheckpointType,
			name: (data.name as string) || `Checkpoint ${data.type}`,
			description: data.description as string | undefined,
			isRequired: data.isRequired as boolean | undefined ?? true
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job_checkpoint', checkpoint.id, 'ADD_CHECKPOINT', { jobId, type: data.type });
	return checkpoint.id;
}

async function completeCheckpoint(
	organizationId: string,
	userId: string,
	checkpointId: string,
	notes?: string
): Promise<string> {
	await prisma.jobCheckpoint.update({
		where: { id: checkpointId },
		data: {
			completedAt: new Date(),
			completedBy: userId,
			notes
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job_checkpoint', checkpointId, 'COMPLETE_CHECKPOINT');
	return checkpointId;
}

async function addVisit(
	organizationId: string,
	userId: string,
	jobId: string,
	data: Record<string, unknown>
): Promise<string> {
	const scheduledEndValue = data.scheduledEnd ? new Date(data.scheduledEnd as string) : new Date(data.scheduledStart as string);
	const visit = await prisma.jobVisit.create({
		data: {
			jobId,
			visitNumber: data.visitNumber as number,
			scheduledStart: new Date(data.scheduledStart as string),
			scheduledEnd: scheduledEndValue,
			technicianId: data.technicianId as string | undefined,
			notes: data.notes as string | undefined
		}
	});

	await recordWorkflowEvent(organizationId, userId, 'job_visit', visit.id, 'ADD_VISIT', { jobId });
	return visit.id;
}

async function updateVisit(
	organizationId: string,
	userId: string,
	visitId: string,
	data: Record<string, unknown>
): Promise<string> {
	const updateData: Record<string, unknown> = {};
	if (data.scheduledStart) updateData.scheduledStart = new Date(data.scheduledStart as string);
	if (data.scheduledEnd) updateData.scheduledEnd = new Date(data.scheduledEnd as string);
	if (data.actualStart) updateData.actualStart = new Date(data.actualStart as string);
	if (data.actualEnd) updateData.actualEnd = new Date(data.actualEnd as string);
	if (data.status) updateData.status = data.status;
	if (data.notes !== undefined) updateData.notes = data.notes;

	await prisma.jobVisit.update({ where: { id: visitId }, data: updateData });

	await recordWorkflowEvent(organizationId, userId, 'job_visit', visitId, 'UPDATE_VISIT');
	return visitId;
}

async function deleteJob(
	organizationId: string,
	userId: string,
	jobId: string
): Promise<string> {
	await prisma.job.update({
		where: { id: jobId },
		data: { deletedAt: new Date() }
	});

	await recordWorkflowEvent(organizationId, userId, 'job', jobId, 'DELETE_JOB');
	return jobId;
}

// Main workflow function
async function jobWorkflow(input: JobWorkflowInput): Promise<JobWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'UPDATE_JOB':
				entityId = await DBOS.runStep(
					() => updateJob(input.organizationId, input.userId, input.jobId!, input.data),
					{ name: 'updateJob' }
				);
				break;

			case 'TRANSITION_STATUS':
				entityId = await DBOS.runStep(
					() => transitionJobStatus(
						input.organizationId,
						input.userId,
						input.jobId!,
						input.data.toStatus as JobStatus,
						input.data.notes as string | undefined
					),
					{ name: 'transitionJobStatus' }
				);
				break;

			case 'ASSIGN_TECHNICIAN':
				entityId = await DBOS.runStep(
					() => assignTechnician(
						input.organizationId,
						input.userId,
						input.jobId!,
						input.data.technicianId as string
					),
					{ name: 'assignTechnician' }
				);
				break;

			case 'SCHEDULE_JOB':
				entityId = await DBOS.runStep(
					() => scheduleJob(
						input.organizationId,
						input.userId,
						input.jobId!,
						input.data.scheduledStart as string,
						input.data.scheduledEnd as string | undefined,
						input.data.technicianId as string | undefined
					),
					{ name: 'scheduleJob' }
				);
				break;

			case 'ADD_NOTE':
				entityId = await DBOS.runStep(
					() => addNote(
						input.organizationId,
						input.userId,
						input.jobId!,
						input.data.content as string,
						input.data.isInternal as boolean
					),
					{ name: 'addNote' }
				);
				break;

			case 'ADD_ATTACHMENT':
				entityId = await DBOS.runStep(
					() => addAttachment(input.organizationId, input.userId, input.jobId!, input.data),
					{ name: 'addAttachment' }
				);
				break;

			case 'DELETE_ATTACHMENT':
				entityId = await DBOS.runStep(
					() => deleteAttachment(input.organizationId, input.userId, input.entityId!),
					{ name: 'deleteAttachment' }
				);
				break;

			case 'ADD_CHECKPOINT':
				entityId = await DBOS.runStep(
					() => addCheckpoint(input.organizationId, input.userId, input.jobId!, input.data),
					{ name: 'addCheckpoint' }
				);
				break;

			case 'COMPLETE_CHECKPOINT':
				entityId = await DBOS.runStep(
					() => completeCheckpoint(
						input.organizationId,
						input.userId,
						input.entityId!,
						input.data.notes as string | undefined
					),
					{ name: 'completeCheckpoint' }
				);
				break;

			case 'ADD_VISIT':
				entityId = await DBOS.runStep(
					() => addVisit(input.organizationId, input.userId, input.jobId!, input.data),
					{ name: 'addVisit' }
				);
				break;

			case 'UPDATE_VISIT':
				entityId = await DBOS.runStep(
					() => updateVisit(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateVisit' }
				);
				break;

			case 'DELETE_JOB':
				entityId = await DBOS.runStep(
					() => deleteJob(input.organizationId, input.userId, input.jobId!),
					{ name: 'deleteJob' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[JobWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'JOB_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const jobWorkflow_v1 = DBOS.registerWorkflow(jobWorkflow);

export async function startJobWorkflow(
	input: JobWorkflowInput,
	idempotencyKey: string
): Promise<JobWorkflowResult> {
	const workflowId = idempotencyKey || `job-${input.action}-${input.jobId || input.entityId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(jobWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
