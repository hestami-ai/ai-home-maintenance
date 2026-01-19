/**
 * Job Create Workflow (v1)
 *
 * DBOS durable workflow for creating contractor jobs.
 * Provides idempotency, durability, and trace correlation for job creation.
 *
 * This is separate from jobLifecycle_v1 which handles status transitions.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { JobSourceType, JobStatus } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { type BaseWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	JobStatus as JobStatusEnum,
	JobSourceType as JobSourceTypeEnum
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	JOB_CREATE_WORKFLOW_ERROR: 'JOB_CREATE_WORKFLOW_ERROR'
} as const;

// Workflow step constants
const JobCreateStep = {
	CREATE_JOB: 'CREATE_JOB'
} as const;

const log = createWorkflowLogger('JobCreateWorkflow');

const WORKFLOW_STATUS_EVENT = 'job_create_status';
const WORKFLOW_ERROR_EVENT = 'job_create_error';

export interface JobCreateInput {
	organizationId: string;
	userId: string;
	sourceType: JobSourceType;
	title: string;
	description?: string;
	category?: string;
	priority: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
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
}

export interface JobCreateResult extends BaseWorkflowResult {
	jobId?: string;
	jobNumber?: string;
	status?: JobStatus;
	timestamp: string;
}

async function generateJobNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `JOB-${year}`;
	const count = await prisma.job.count({
		where: {
			organizationId,
			jobNumber: { startsWith: prefix }
		}
	});
	return `${prefix}-${String(count + 1).padStart(5, '0')}`;
}

async function createJob(input: JobCreateInput): Promise<{
	id: string;
	jobNumber: string;
	status: JobStatus;
	title: string;
}> {
	const jobNumber = await generateJobNumber(input.organizationId);
	const initialStatus: JobStatus = input.sourceType === JobSourceTypeEnum.LEAD ? JobStatusEnum.LEAD : JobStatusEnum.TICKET;

	const job = await prisma.$transaction(async (tx) => {
		const createdJob = await tx.job.create({
			data: {
				organizationId: input.organizationId,
				jobNumber,
				status: initialStatus,
				sourceType: input.sourceType,
				workOrderId: input.workOrderId,
				violationId: input.violationId,
				arcRequestId: input.arcRequestId,
				customerId: input.customerId,
				unitId: input.unitId,
				propertyId: input.propertyId,
				associationId: input.associationId,
				addressLine1: input.addressLine1,
				addressLine2: input.addressLine2,
				city: input.city,
				state: input.state,
				postalCode: input.postalCode,
				locationNotes: input.locationNotes,
				title: input.title,
				description: input.description,
				category: input.category,
				priority: input.priority,
				estimatedHours: input.estimatedHours,
				estimatedCost: input.estimatedCost
			}
		});

		// Record initial status history
		await tx.jobStatusHistory.create({
			data: {
				jobId: createdJob.id,
				toStatus: initialStatus,
				changedBy: input.userId
			}
		});

		return createdJob;
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: job.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Job created: ${job.title}`,
		performedById: input.userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'jobCreateWorkflow_v1',
		workflowStep: JobCreateStep.CREATE_JOB,
		workflowVersion: 'v1',
		jobId: job.id,
		newState: {
			jobNumber: job.jobNumber,
			title: job.title,
			status: job.status,
			sourceType: job.sourceType,
			priority: job.priority
		}
	});

	return {
		id: job.id,
		jobNumber: job.jobNumber,
		status: job.status as JobStatus,
		title: job.title
	};
}

async function jobCreateWorkflow(input: JobCreateInput): Promise<JobCreateResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started' });

		const result = await DBOS.runStep(() => createJob(input), { name: 'createJob' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			jobId: result.id,
			jobNumber: result.jobNumber
		});

		return {
			success: true,
			jobId: result.id,
			jobNumber: result.jobNumber,
			status: result.status,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.JOB_CREATE_WORKFLOW_ERROR
		});

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const jobCreateWorkflow_v1 = DBOS.registerWorkflow(jobCreateWorkflow);

export async function startJobCreateWorkflow(
	input: JobCreateInput,
	idempotencyKey: string
): Promise<JobCreateResult> {
	const handle = await DBOS.startWorkflow(jobCreateWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export async function getJobCreateWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

