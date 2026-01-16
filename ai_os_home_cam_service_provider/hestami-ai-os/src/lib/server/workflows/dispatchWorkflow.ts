/**
 * Dispatch Workflow (v1)
 *
 * DBOS durable workflow for dispatch assignment operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { DispatchStatus } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';

const log = createWorkflowLogger('DispatchWorkflow');

const WORKFLOW_STATUS_EVENT = 'dispatch_status';
const WORKFLOW_ERROR_EVENT = 'dispatch_error';

export const DispatchAction = {
	CREATE_ASSIGNMENT: 'CREATE_ASSIGNMENT',
	REASSIGN: 'REASSIGN',
	UPDATE_STATUS: 'UPDATE_STATUS',
	RESCHEDULE: 'RESCHEDULE',
	OPTIMIZE_ROUTE: 'OPTIMIZE_ROUTE',
	CREATE_ROUTE_PLAN: 'CREATE_ROUTE_PLAN'
} as const;

export type DispatchAction = (typeof DispatchAction)[keyof typeof DispatchAction];

export interface DispatchWorkflowInput {
	action: DispatchAction;
	organizationId: string;
	userId: string;
	assignmentId?: string;
	jobId?: string;
	technicianId?: string;
	data: Record<string, unknown>;
}

export interface DispatchWorkflowResult extends LifecycleWorkflowResult {
	entityId?: string;
}

async function createAssignment(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const result = await orgTransaction(organizationId, async (tx) => {
		const assignment = await tx.dispatchAssignment.create({
			data: {
				organizationId,
				jobId: data.jobId as string,
				jobVisitId: data.jobVisitId as string | undefined,
				technicianId: data.technicianId as string,
				status: 'ASSIGNED',
				assignedBy: userId,
				scheduledStart: new Date(data.scheduledStart as string),
				scheduledEnd: new Date(data.scheduledEnd as string),
				estimatedTravelMinutes: data.estimatedTravelMinutes as number | undefined,
				dispatchNotes: data.dispatchNotes as string | undefined
			}
		});

		// Create schedule slot for the technician
		await tx.scheduleSlot.create({
			data: {
				organizationId,
				technicianId: data.technicianId as string,
				startTime: new Date(data.scheduledStart as string),
				endTime: new Date(data.scheduledEnd as string),
				slotType: 'JOB',
				jobId: data.jobId as string,
				jobVisitId: data.jobVisitId as string | undefined
			}
		});

		// Update job assignment
		await tx.job.update({
			where: { id: data.jobId as string },
			data: {
				assignedTechnicianId: data.technicianId as string,
				assignedAt: new Date(),
				assignedBy: userId
			}
		});

		return assignment;
	}, { userId, reason: 'Create dispatch assignment' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: result.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: 'Dispatch assignment created',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'dispatchWorkflow_v1',
		workflowStep: 'CREATE_ASSIGNMENT',
		workflowVersion: 'v1',
		jobId: data.jobId as string
	});

	return { id: result.id };
}

async function reassignDispatch(
	organizationId: string,
	userId: string,
	assignmentId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const result = await orgTransaction(organizationId, async (tx) => {
		const existing = await tx.dispatchAssignment.findUniqueOrThrow({
			where: { id: assignmentId }
		});

		// Update the assignment
		const updated = await tx.dispatchAssignment.update({
			where: { id: assignmentId },
			data: {
				technicianId: data.newTechnicianId as string,
				scheduledStart: data.scheduledStart ? new Date(data.scheduledStart as string) : undefined,
				scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd as string) : undefined,
				assignedAt: new Date(),
				assignedBy: userId,
				dispatchNotes: data.reason as string | undefined
			}
		});

		// Update schedule slot
		await tx.scheduleSlot.updateMany({
			where: { jobId: existing.jobId, technicianId: existing.technicianId },
			data: {
				technicianId: data.newTechnicianId as string,
				startTime: data.scheduledStart ? new Date(data.scheduledStart as string) : undefined,
				endTime: data.scheduledEnd ? new Date(data.scheduledEnd as string) : undefined
			}
		});

		// Update job assignment
		await tx.job.update({
			where: { id: existing.jobId },
			data: {
				assignedTechnicianId: data.newTechnicianId as string,
				assignedAt: new Date(),
				assignedBy: userId
			}
		});

		return updated;
	}, { userId, reason: 'Reassign dispatch to new technician' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: result.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Dispatch reassigned',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'dispatchWorkflow_v1',
		workflowStep: 'REASSIGN',
		workflowVersion: 'v1',
		jobId: result.jobId
	});

	return { id: result.id };
}

async function updateDispatchStatus(
	organizationId: string,
	userId: string,
	assignmentId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const assignment = await orgTransaction(organizationId, async (tx) => {
		return tx.dispatchAssignment.update({
			where: { id: assignmentId },
			data: {
				status: data.status as DispatchStatus,
				actualStart: data.actualStart ? new Date(data.actualStart as string) : undefined,
				actualEnd: data.actualEnd ? new Date(data.actualEnd as string) : undefined,
				techNotes: data.completionNotes as string | undefined
			}
		});
	}, { userId, reason: 'Update dispatch status' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: assignment.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Dispatch status updated to ${data.status}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'dispatchWorkflow_v1',
		workflowStep: 'UPDATE_STATUS',
		workflowVersion: 'v1',
		jobId: assignment.jobId
	});

	return { id: assignment.id };
}

async function rescheduleDispatch(
	organizationId: string,
	userId: string,
	assignmentId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const result = await orgTransaction(organizationId, async (tx) => {
		const existing = await tx.dispatchAssignment.findUniqueOrThrow({
			where: { id: assignmentId }
		});

		const updated = await tx.dispatchAssignment.update({
			where: { id: assignmentId },
			data: {
				scheduledStart: new Date(data.scheduledStart as string),
				scheduledEnd: new Date(data.scheduledEnd as string),
				dispatchNotes: data.reason as string | undefined
			}
		});

		// Update schedule slot
		await tx.scheduleSlot.updateMany({
			where: { jobId: existing.jobId, technicianId: existing.technicianId },
			data: {
				startTime: new Date(data.scheduledStart as string),
				endTime: new Date(data.scheduledEnd as string)
			}
		});

		return updated;
	}, { userId, reason: 'Reschedule dispatch' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: result.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Dispatch rescheduled',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'dispatchWorkflow_v1',
		workflowStep: 'RESCHEDULE',
		workflowVersion: 'v1',
		jobId: result.jobId
	});

	return { id: result.id };
}

async function optimizeRoute(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const routePlan = await orgTransaction(organizationId, async (tx) => {
		return tx.routePlan.create({
			data: {
				organizationId,
				technicianId: data.technicianId as string,
				routeDate: new Date(data.planDate as string),
				isOptimized: true,
				optimizedAt: new Date()
			}
		});
	}, { userId, reason: 'Optimize route plan' });

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: routePlan.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: 'Route plan created',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'dispatchWorkflow_v1',
		workflowStep: 'OPTIMIZE_ROUTE',
		workflowVersion: 'v1'
	});

	return { id: routePlan.id };
}

async function createRoutePlan(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const routePlan = await orgTransaction(organizationId, async (tx) => {
		return tx.routePlan.create({
			data: {
				organizationId,
				technicianId: data.technicianId as string,
				routeDate: new Date(data.routeDate as string)
			}
		});
	}, { userId, reason: 'Create route plan' });

	log.info('CREATE_ROUTE_PLAN completed', { routePlanId: routePlan.id, technicianId: data.technicianId });
	return { id: routePlan.id };
}

async function dispatchWorkflow(input: DispatchWorkflowInput): Promise<DispatchWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_ASSIGNMENT': {
				const result = await DBOS.runStep(
					() => createAssignment(input.organizationId, input.userId, input.data),
					{ name: 'createAssignment' }
				);
				entityId = result.id;
				break;
			}
			case 'REASSIGN': {
				if (!input.assignmentId) throw new Error('assignmentId required for REASSIGN');
				const result = await DBOS.runStep(
					() => reassignDispatch(input.organizationId, input.userId, input.assignmentId!, input.data),
					{ name: 'reassignDispatch' }
				);
				entityId = result.id;
				break;
			}
			case 'UPDATE_STATUS': {
				if (!input.assignmentId) throw new Error('assignmentId required for UPDATE_STATUS');
				const result = await DBOS.runStep(
					() => updateDispatchStatus(input.organizationId, input.userId, input.assignmentId!, input.data),
					{ name: 'updateDispatchStatus' }
				);
				entityId = result.id;
				break;
			}
			case 'RESCHEDULE': {
				if (!input.assignmentId) throw new Error('assignmentId required for RESCHEDULE');
				const result = await DBOS.runStep(
					() => rescheduleDispatch(input.organizationId, input.userId, input.assignmentId!, input.data),
					{ name: 'rescheduleDispatch' }
				);
				entityId = result.id;
				break;
			}
			case 'OPTIMIZE_ROUTE': {
				const result = await DBOS.runStep(
					() => optimizeRoute(input.organizationId, input.userId, input.data),
					{ name: 'optimizeRoute' }
				);
				entityId = result.id;
				break;
			}
			case 'CREATE_ROUTE_PLAN': {
				const result = await DBOS.runStep(
					() => createRoutePlan(input.organizationId, input.userId, input.data),
					{ name: 'createRoutePlan' }
				);
				entityId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'DISPATCH_WORKFLOW_ERROR'
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const dispatchWorkflow_v1 = DBOS.registerWorkflow(dispatchWorkflow);

export async function startDispatchWorkflow(
	input: DispatchWorkflowInput,
	idempotencyKey: string
): Promise<DispatchWorkflowResult> {
	const handle = await DBOS.startWorkflow(dispatchWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

