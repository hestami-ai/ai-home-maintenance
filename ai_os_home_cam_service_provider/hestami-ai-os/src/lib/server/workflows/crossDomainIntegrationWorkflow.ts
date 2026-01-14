/**
 * Cross-Domain Integration Workflow (v1)
 *
 * DBOS durable workflow for cross-domain integration operations between
 * Phase 1 (HOA/CAM) and Phase 2 (Contractor Operations).
 * Handles: createJobFromWorkOrder, syncJobStatusToWorkOrder, syncWorkOrderStatusToJob,
 * createJobFromViolation, createJobFromARCRequest, syncVendorComplianceNotes,
 * createWorkOrderFromViolation, createWorkOrderFromARC, createWorkOrderFromResolution.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { JobPriority, JobStatus, WorkOrderStatus, Prisma } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'cross_domain_integration_workflow_status';
const WORKFLOW_ERROR_EVENT = 'cross_domain_integration_workflow_error';

// Action types for cross-domain integration operations
export const CrossDomainIntegrationWorkflowAction = {
	CREATE_JOB_FROM_WORK_ORDER: 'CREATE_JOB_FROM_WORK_ORDER',
	SYNC_JOB_STATUS_TO_WORK_ORDER: 'SYNC_JOB_STATUS_TO_WORK_ORDER',
	SYNC_WORK_ORDER_STATUS_TO_JOB: 'SYNC_WORK_ORDER_STATUS_TO_JOB',
	CREATE_JOB_FROM_VIOLATION: 'CREATE_JOB_FROM_VIOLATION',
	CREATE_JOB_FROM_ARC_REQUEST: 'CREATE_JOB_FROM_ARC_REQUEST',
	SYNC_VENDOR_COMPLIANCE_NOTES: 'SYNC_VENDOR_COMPLIANCE_NOTES',
	CREATE_WORK_ORDER_FROM_VIOLATION: 'CREATE_WORK_ORDER_FROM_VIOLATION',
	CREATE_WORK_ORDER_FROM_ARC: 'CREATE_WORK_ORDER_FROM_ARC',
	CREATE_WORK_ORDER_FROM_RESOLUTION: 'CREATE_WORK_ORDER_FROM_RESOLUTION'
} as const;

export type CrossDomainIntegrationWorkflowAction =
	(typeof CrossDomainIntegrationWorkflowAction)[keyof typeof CrossDomainIntegrationWorkflowAction];

export interface CrossDomainIntegrationWorkflowInput {
	action: CrossDomainIntegrationWorkflowAction;
	organizationId: string;
	userId: string;
	// CREATE_JOB_FROM_WORK_ORDER fields
	workOrderId?: string;
	// SYNC_JOB_STATUS_TO_WORK_ORDER / SYNC_WORK_ORDER_STATUS_TO_JOB fields
	jobId?: string;
	jobStatus?: JobStatus;
	workOrderStatus?: WorkOrderStatus;
	// CREATE_JOB_FROM_VIOLATION fields
	violationId?: string;
	// CREATE_JOB_FROM_ARC_REQUEST fields
	arcRequestId?: string;
	// SYNC_VENDOR_COMPLIANCE_NOTES fields
	vendorId?: string;
	notes?: string;
	// CREATE_WORK_ORDER_FROM_* common fields
	priority?: JobPriority;
	assignedTo?: string;
	// CREATE_WORK_ORDER_FROM_RESOLUTION fields
	resolutionId?: string;
}

export interface CrossDomainIntegrationWorkflowResult extends EntityWorkflowResult {
	jobId?: string;
	workOrderId?: string;
	vendorId?: string;
	syncedStatus?: string;
	previousStatus?: string;
	newStatus?: string;
	createdAt?: string;
	updatedAt?: string;
	[key: string]: unknown;
}

// Helper function to map WorkOrder status to Job status
function mapWorkOrderStatusToJobStatus(workOrderStatus: WorkOrderStatus): JobStatus {
	const statusMap: Record<WorkOrderStatus, JobStatus> = {
		DRAFT: 'DRAFT',
		PENDING_APPROVAL: 'PENDING',
		APPROVED: 'APPROVED',
		REJECTED: 'CANCELLED',
		IN_PROGRESS: 'IN_PROGRESS',
		ON_HOLD: 'ON_HOLD',
		COMPLETED: 'COMPLETED',
		CANCELLED: 'CANCELLED',
		CLOSED: 'CLOSED'
	};
	return statusMap[workOrderStatus] || 'PENDING';
}

// Helper function to map Job status to WorkOrder status
function mapJobStatusToWorkOrderStatus(jobStatus: JobStatus): WorkOrderStatus {
	const statusMap: Record<JobStatus, WorkOrderStatus> = {
		DRAFT: 'DRAFT',
		PENDING: 'PENDING_APPROVAL',
		APPROVED: 'APPROVED',
		IN_PROGRESS: 'IN_PROGRESS',
		ON_HOLD: 'ON_HOLD',
		COMPLETED: 'COMPLETED',
		CANCELLED: 'CANCELLED',
		CLOSED: 'CLOSED'
	};
	return statusMap[jobStatus] || 'PENDING_APPROVAL';
}

// Step functions

async function createJobFromWorkOrderStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	jobId: string;
	workOrderId: string;
	createdAt: string;
}> {
	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: input.workOrderId },
		include: {
			property: true,
			lineItems: true
		}
	});

	const result = await prisma.$transaction(async (tx) => {
		// Create the job
		const job = await tx.job.create({
			data: {
				organizationId: input.organizationId,
				propertyId: workOrder.propertyId,
				title: workOrder.title,
				description: workOrder.description,
				priority: workOrder.priority as JobPriority,
				status: mapWorkOrderStatusToJobStatus(workOrder.status),
				estimatedCost: workOrder.estimatedCost,
				sourceType: 'WORK_ORDER',
				sourceId: workOrder.id,
				createdBy: input.userId
			}
		});

		// Link work order to job
		await tx.workOrder.update({
			where: { id: workOrder.id },
			data: { linkedJobId: job.id }
		});

		return job;
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'JOB',
		entityId: result.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Job created from work order ${workOrder.workOrderNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_JOB_FROM_WORK_ORDER',
		workflowVersion: 'v1',
		newState: { workOrderId: workOrder.id, jobId: result.id }
	});

	return {
		jobId: result.id,
		workOrderId: workOrder.id,
		createdAt: result.createdAt.toISOString()
	};
}

async function syncJobStatusToWorkOrderStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	jobId: string;
	workOrderId: string;
	previousStatus: string;
	newStatus: string;
	updatedAt: string;
}> {
	const job = await prisma.job.findUniqueOrThrow({
		where: { id: input.jobId }
	});

	if (!job.sourceId || job.sourceType !== 'WORK_ORDER') {
		throw new Error('Job is not linked to a work order');
	}

	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: job.sourceId }
	});

	const previousStatus = workOrder.status;
	const newStatus = mapJobStatusToWorkOrderStatus(input.jobStatus!);

	const updatedWorkOrder = await prisma.workOrder.update({
		where: { id: workOrder.id },
		data: { status: newStatus }
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: workOrder.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Work order status synced from job: ${previousStatus} → ${newStatus}`,
		performedById: input.userId,
		performedByType: 'SYSTEM',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'SYNC_JOB_STATUS_TO_WORK_ORDER',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: { status: newStatus, jobId: job.id }
	});

	return {
		jobId: job.id,
		workOrderId: workOrder.id,
		previousStatus,
		newStatus,
		updatedAt: updatedWorkOrder.updatedAt.toISOString()
	};
}

async function syncWorkOrderStatusToJobStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	workOrderId: string;
	jobId: string;
	previousStatus: string;
	newStatus: string;
	updatedAt: string;
}> {
	const workOrder = await prisma.workOrder.findUniqueOrThrow({
		where: { id: input.workOrderId }
	});

	if (!workOrder.linkedJobId) {
		throw new Error('Work order is not linked to a job');
	}

	const job = await prisma.job.findUniqueOrThrow({
		where: { id: workOrder.linkedJobId }
	});

	const previousStatus = job.status;
	const newStatus = mapWorkOrderStatusToJobStatus(input.workOrderStatus!);

	const updatedJob = await prisma.job.update({
		where: { id: job.id },
		data: { status: newStatus }
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'JOB',
		entityId: job.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Job status synced from work order: ${previousStatus} → ${newStatus}`,
		performedById: input.userId,
		performedByType: 'SYSTEM',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'SYNC_WORK_ORDER_STATUS_TO_JOB',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: { status: newStatus, workOrderId: workOrder.id }
	});

	return {
		workOrderId: workOrder.id,
		jobId: job.id,
		previousStatus,
		newStatus,
		updatedAt: updatedJob.updatedAt.toISOString()
	};
}

async function createJobFromViolationStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	jobId: string;
	violationId: string;
	createdAt: string;
}> {
	const violation = await prisma.violation.findUniqueOrThrow({
		where: { id: input.violationId },
		include: {
			unit: {
				include: { property: true }
			},
			violationType: true
		}
	});

	const job = await prisma.job.create({
		data: {
			organizationId: input.organizationId,
			propertyId: violation.unit.propertyId,
			title: `Violation Remediation: ${violation.violationType.name}`,
			description: violation.description || `Remediation work for violation ${violation.violationNumber}`,
			priority: violation.severity === 'CRITICAL' ? 'URGENT' : violation.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
			status: 'PENDING',
			sourceType: 'VIOLATION',
			sourceId: violation.id,
			createdBy: input.userId
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'JOB',
		entityId: job.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Job created from violation ${violation.violationNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_JOB_FROM_VIOLATION',
		workflowVersion: 'v1',
		newState: { violationId: violation.id, jobId: job.id }
	});

	return {
		jobId: job.id,
		violationId: violation.id,
		createdAt: job.createdAt.toISOString()
	};
}

async function createJobFromARCRequestStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	jobId: string;
	arcRequestId: string;
	createdAt: string;
}> {
	const arcRequest = await prisma.aRCRequest.findUniqueOrThrow({
		where: { id: input.arcRequestId },
		include: {
			unit: {
				include: { property: true }
			}
		}
	});

	const job = await prisma.job.create({
		data: {
			organizationId: input.organizationId,
			propertyId: arcRequest.unit.propertyId,
			title: `ARC Project: ${arcRequest.projectTitle}`,
			description: arcRequest.projectDescription || `Work for approved ARC request ${arcRequest.requestNumber}`,
			priority: 'MEDIUM',
			status: 'APPROVED',
			sourceType: 'ARC_REQUEST',
			sourceId: arcRequest.id,
			createdBy: input.userId
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'JOB',
		entityId: job.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Job created from ARC request ${arcRequest.requestNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_JOB_FROM_ARC_REQUEST',
		workflowVersion: 'v1',
		newState: { arcRequestId: arcRequest.id, jobId: job.id }
	});

	return {
		jobId: job.id,
		arcRequestId: arcRequest.id,
		createdAt: job.createdAt.toISOString()
	};
}

async function syncVendorComplianceNotesStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	vendorId: string;
	updatedAt: string;
}> {
	const vendor = await prisma.vendor.update({
		where: { id: input.vendorId },
		data: {
			complianceNotes: input.notes
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'VENDOR',
		entityId: vendor.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Vendor compliance notes updated',
		performedById: input.userId,
		performedByType: 'SYSTEM',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'SYNC_VENDOR_COMPLIANCE_NOTES',
		workflowVersion: 'v1',
		newState: { complianceNotes: input.notes }
	});

	return {
		vendorId: vendor.id,
		updatedAt: vendor.updatedAt.toISOString()
	};
}

async function createWorkOrderFromViolationStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	workOrderId: string;
	violationId: string;
	createdAt: string;
}> {
	const violation = await prisma.violation.findUniqueOrThrow({
		where: { id: input.violationId },
		include: {
			unit: {
				include: { property: true }
			},
			violationType: true
		}
	});

	// Get next work order number
	const lastWorkOrder = await prisma.workOrder.findFirst({
		where: { organizationId: input.organizationId },
		orderBy: { createdAt: 'desc' },
		select: { workOrderNumber: true }
	});

	const nextNumber = lastWorkOrder
		? parseInt(lastWorkOrder.workOrderNumber.replace(/\D/g, '')) + 1
		: 1;

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			propertyId: violation.unit.propertyId,
			workOrderNumber: `WO-${nextNumber.toString().padStart(6, '0')}`,
			title: `Violation Remediation: ${violation.violationType.name}`,
			description: violation.description || `Remediation work for violation ${violation.violationNumber}`,
			priority: violation.severity === 'CRITICAL' ? 'URGENT' : violation.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
			status: 'DRAFT',
			sourceType: 'VIOLATION',
			sourceId: violation.id,
			createdBy: input.userId
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: workOrder.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Work order created from violation ${violation.violationNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_WORK_ORDER_FROM_VIOLATION',
		workflowVersion: 'v1',
		newState: { violationId: violation.id, workOrderId: workOrder.id }
	});

	return {
		workOrderId: workOrder.id,
		violationId: violation.id,
		createdAt: workOrder.createdAt.toISOString()
	};
}

async function createWorkOrderFromARCStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	workOrderId: string;
	arcRequestId: string;
	createdAt: string;
}> {
	const arcRequest = await prisma.aRCRequest.findUniqueOrThrow({
		where: { id: input.arcRequestId },
		include: {
			unit: {
				include: { property: true }
			}
		}
	});

	// Get next work order number
	const lastWorkOrder = await prisma.workOrder.findFirst({
		where: { organizationId: input.organizationId },
		orderBy: { createdAt: 'desc' },
		select: { workOrderNumber: true }
	});

	const nextNumber = lastWorkOrder
		? parseInt(lastWorkOrder.workOrderNumber.replace(/\D/g, '')) + 1
		: 1;

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			propertyId: arcRequest.unit.propertyId,
			workOrderNumber: `WO-${nextNumber.toString().padStart(6, '0')}`,
			title: `ARC Project: ${arcRequest.projectTitle}`,
			description: arcRequest.projectDescription || `Work for approved ARC request ${arcRequest.requestNumber}`,
			priority: input.priority || 'MEDIUM',
			status: 'APPROVED',
			sourceType: 'ARC_REQUEST',
			sourceId: arcRequest.id,
			createdBy: input.userId,
			...(input.assignedTo && { assignedTo: input.assignedTo })
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: workOrder.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Work order created from ARC request ${arcRequest.requestNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_WORK_ORDER_FROM_ARC',
		workflowVersion: 'v1',
		newState: { arcRequestId: arcRequest.id, workOrderId: workOrder.id }
	});

	return {
		workOrderId: workOrder.id,
		arcRequestId: arcRequest.id,
		createdAt: workOrder.createdAt.toISOString()
	};
}

async function createWorkOrderFromResolutionStep(
	input: CrossDomainIntegrationWorkflowInput
): Promise<{
	workOrderId: string;
	resolutionId: string;
	createdAt: string;
}> {
	const resolution = await prisma.resolution.findUniqueOrThrow({
		where: { id: input.resolutionId },
		include: {
			association: true
		}
	});

	// Get a property from the association for the work order
	const property = await prisma.property.findFirst({
		where: {
			associationId: resolution.associationId,
			deletedAt: null
		}
	});

	if (!property) {
		throw new Error('No property found for association');
	}

	// Get next work order number
	const lastWorkOrder = await prisma.workOrder.findFirst({
		where: { organizationId: input.organizationId },
		orderBy: { createdAt: 'desc' },
		select: { workOrderNumber: true }
	});

	const nextNumber = lastWorkOrder
		? parseInt(lastWorkOrder.workOrderNumber.replace(/\D/g, '')) + 1
		: 1;

	const workOrder = await prisma.workOrder.create({
		data: {
			organizationId: input.organizationId,
			propertyId: property.id,
			workOrderNumber: `WO-${nextNumber.toString().padStart(6, '0')}`,
			title: `Resolution Implementation: ${resolution.title}`,
			description: resolution.description || `Work for resolution ${resolution.resolutionNumber}`,
			priority: input.priority || 'MEDIUM',
			status: 'APPROVED',
			sourceType: 'RESOLUTION',
			sourceId: resolution.id,
			createdBy: input.userId,
			...(input.assignedTo && { assignedTo: input.assignedTo })
		}
	});

	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'WORK_ORDER',
		entityId: workOrder.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Work order created from resolution ${resolution.resolutionNumber}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'crossDomainIntegrationWorkflow_v1',
		workflowStep: 'CREATE_WORK_ORDER_FROM_RESOLUTION',
		workflowVersion: 'v1',
		newState: { resolutionId: resolution.id, workOrderId: workOrder.id }
	});

	return {
		workOrderId: workOrder.id,
		resolutionId: resolution.id,
		createdAt: workOrder.createdAt.toISOString()
	};
}

// Main workflow function

async function crossDomainIntegrationWorkflow(
	input: CrossDomainIntegrationWorkflowInput
): Promise<CrossDomainIntegrationWorkflowResult> {
	const workflowName = 'crossDomainIntegrationWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(
		log,
		input.action,
		{
			organizationId: input.organizationId,
			userId: input.userId
		},
		workflowName,
		DBOS.workflowID
	);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE_JOB_FROM_WORK_ORDER': {
				if (!input.workOrderId) {
					const error = new Error('Missing required field: workOrderId for CREATE_JOB_FROM_WORK_ORDER');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createJobFromWorkOrder starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(() => createJobFromWorkOrderStep(input), {
					name: 'createJobFromWorkOrder'
				});
				log.info('Step: createJobFromWorkOrder completed', { jobId: result.jobId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'job_created', jobId: result.jobId });
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.jobId,
					jobId: result.jobId,
					workOrderId: result.workOrderId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SYNC_JOB_STATUS_TO_WORK_ORDER': {
				if (!input.jobId || !input.jobStatus) {
					const error = new Error('Missing required fields: jobId, jobStatus for SYNC_JOB_STATUS_TO_WORK_ORDER');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: syncJobStatusToWorkOrder starting', { jobId: input.jobId });
				const result = await DBOS.runStep(() => syncJobStatusToWorkOrderStep(input), {
					name: 'syncJobStatusToWorkOrder'
				});
				log.info('Step: syncJobStatusToWorkOrder completed', { workOrderId: result.workOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
					step: 'status_synced',
					workOrderId: result.workOrderId
				});
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.workOrderId,
					jobId: result.jobId,
					workOrderId: result.workOrderId,
					previousStatus: result.previousStatus,
					newStatus: result.newStatus,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SYNC_WORK_ORDER_STATUS_TO_JOB': {
				if (!input.workOrderId || !input.workOrderStatus) {
					const error = new Error(
						'Missing required fields: workOrderId, workOrderStatus for SYNC_WORK_ORDER_STATUS_TO_JOB'
					);
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: syncWorkOrderStatusToJob starting', { workOrderId: input.workOrderId });
				const result = await DBOS.runStep(() => syncWorkOrderStatusToJobStep(input), {
					name: 'syncWorkOrderStatusToJob'
				});
				log.info('Step: syncWorkOrderStatusToJob completed', { jobId: result.jobId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'status_synced', jobId: result.jobId });
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.jobId,
					jobId: result.jobId,
					workOrderId: result.workOrderId,
					previousStatus: result.previousStatus,
					newStatus: result.newStatus,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_JOB_FROM_VIOLATION': {
				if (!input.violationId) {
					const error = new Error('Missing required field: violationId for CREATE_JOB_FROM_VIOLATION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createJobFromViolation starting', { violationId: input.violationId });
				const result = await DBOS.runStep(() => createJobFromViolationStep(input), {
					name: 'createJobFromViolation'
				});
				log.info('Step: createJobFromViolation completed', { jobId: result.jobId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'job_created', jobId: result.jobId });
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.jobId,
					jobId: result.jobId,
					violationId: result.violationId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_JOB_FROM_ARC_REQUEST': {
				if (!input.arcRequestId) {
					const error = new Error('Missing required field: arcRequestId for CREATE_JOB_FROM_ARC_REQUEST');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createJobFromARCRequest starting', { arcRequestId: input.arcRequestId });
				const result = await DBOS.runStep(() => createJobFromARCRequestStep(input), {
					name: 'createJobFromARCRequest'
				});
				log.info('Step: createJobFromARCRequest completed', { jobId: result.jobId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'job_created', jobId: result.jobId });
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.jobId,
					jobId: result.jobId,
					arcRequestId: result.arcRequestId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SYNC_VENDOR_COMPLIANCE_NOTES': {
				if (!input.vendorId) {
					const error = new Error('Missing required field: vendorId for SYNC_VENDOR_COMPLIANCE_NOTES');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: syncVendorComplianceNotes starting', { vendorId: input.vendorId });
				const result = await DBOS.runStep(() => syncVendorComplianceNotesStep(input), {
					name: 'syncVendorComplianceNotes'
				});
				log.info('Step: syncVendorComplianceNotes completed', { vendorId: result.vendorId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'notes_synced', vendorId: result.vendorId });
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.vendorId,
					vendorId: result.vendorId,
					updatedAt: result.updatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_WORK_ORDER_FROM_VIOLATION': {
				if (!input.violationId) {
					const error = new Error('Missing required field: violationId for CREATE_WORK_ORDER_FROM_VIOLATION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createWorkOrderFromViolation starting', { violationId: input.violationId });
				const result = await DBOS.runStep(() => createWorkOrderFromViolationStep(input), {
					name: 'createWorkOrderFromViolation'
				});
				log.info('Step: createWorkOrderFromViolation completed', { workOrderId: result.workOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
					step: 'work_order_created',
					workOrderId: result.workOrderId
				});
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.workOrderId,
					workOrderId: result.workOrderId,
					violationId: result.violationId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_WORK_ORDER_FROM_ARC': {
				if (!input.arcRequestId) {
					const error = new Error('Missing required field: arcRequestId for CREATE_WORK_ORDER_FROM_ARC');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createWorkOrderFromARC starting', { arcRequestId: input.arcRequestId });
				const result = await DBOS.runStep(() => createWorkOrderFromARCStep(input), {
					name: 'createWorkOrderFromARC'
				});
				log.info('Step: createWorkOrderFromARC completed', { workOrderId: result.workOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
					step: 'work_order_created',
					workOrderId: result.workOrderId
				});
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.workOrderId,
					workOrderId: result.workOrderId,
					arcRequestId: result.arcRequestId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'CREATE_WORK_ORDER_FROM_RESOLUTION': {
				if (!input.resolutionId) {
					const error = new Error('Missing required field: resolutionId for CREATE_WORK_ORDER_FROM_RESOLUTION');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: createWorkOrderFromResolution starting', { resolutionId: input.resolutionId });
				const result = await DBOS.runStep(() => createWorkOrderFromResolutionStep(input), {
					name: 'createWorkOrderFromResolution'
				});
				log.info('Step: createWorkOrderFromResolution completed', { workOrderId: result.workOrderId });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
					step: 'work_order_created',
					workOrderId: result.workOrderId
				});
				const successResult: CrossDomainIntegrationWorkflowResult = {
					success: true,
					entityId: result.workOrderId,
					workOrderId: result.workOrderId,
					resolutionId: result.resolutionId,
					createdAt: result.createdAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: CrossDomainIntegrationWorkflowResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CROSS_DOMAIN_INTEGRATION_WORKFLOW_ERROR'
		});
		const errorResult: CrossDomainIntegrationWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const crossDomainIntegrationWorkflow_v1 = DBOS.registerWorkflow(crossDomainIntegrationWorkflow);

export async function startCrossDomainIntegrationWorkflow(
	input: CrossDomainIntegrationWorkflowInput,
	idempotencyKey: string
): Promise<CrossDomainIntegrationWorkflowResult> {
	const handle = await DBOS.startWorkflow(crossDomainIntegrationWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
