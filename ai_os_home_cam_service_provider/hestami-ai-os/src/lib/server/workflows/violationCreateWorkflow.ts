/**
 * Violation Create Workflow (v1)
 *
 * DBOS durable workflow for creating violations.
 * Provides idempotency, durability, and trace correlation for violation creation.
 *
 * This is separate from violationLifecycle_v1 which handles status transitions.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ViolationStatus, ViolationSeverity } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

const WORKFLOW_STATUS_EVENT = 'violation_create_status';
const WORKFLOW_ERROR_EVENT = 'violation_create_error';

interface ViolationCreateInput {
	organizationId: string;
	userId: string;
	associationId: string;
	violationTypeId: string;
	title: string;
	description: string;
	severity: ViolationSeverity;
	unitId?: string;
	commonAreaName?: string;
	locationDetails?: string;
	observedDate: string;
	responsiblePartyId?: string;
	reporterType: 'STAFF' | 'RESIDENT' | 'ANONYMOUS';
}

interface ViolationCreateResult {
	success: boolean;
	violationId?: string;
	violationNumber?: string;
	status?: ViolationStatus;
	severity?: ViolationSeverity;
	timestamp: string;
	error?: string;
}

async function generateViolationNumber(associationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `VIO-${year}-`;
	const lastViolation = await prisma.violation.findFirst({
		where: {
			associationId,
			violationNumber: { startsWith: prefix }
		},
		orderBy: { createdAt: 'desc' }
	});

	const sequence = lastViolation
		? parseInt(lastViolation.violationNumber.split('-')[2] || '0') + 1
		: 1;
	return `${prefix}${String(sequence).padStart(6, '0')}`;
}

async function createViolation(input: ViolationCreateInput): Promise<{
	id: string;
	violationNumber: string;
	status: ViolationStatus;
	severity: ViolationSeverity;
	title: string;
}> {
	const violationNumber = await generateViolationNumber(input.associationId);

	const violation = await prisma.$transaction(async (tx) => {
		const v = await tx.violation.create({
			data: {
				organizationId: input.organizationId,
				associationId: input.associationId,
				violationNumber,
				violationTypeId: input.violationTypeId,
				title: input.title,
				description: input.description,
				severity: input.severity,
				status: 'DRAFT',
				unitId: input.unitId,
				commonAreaName: input.commonAreaName,
				locationDetails: input.locationDetails,
				observedDate: new Date(input.observedDate),
				responsiblePartyId: input.responsiblePartyId,
				reportedBy: input.userId,
				reporterType: input.reporterType
			}
		});

		// Record initial status history
		await tx.violationStatusHistory.create({
			data: {
				violationId: v.id,
				fromStatus: null,
				toStatus: 'DRAFT',
				changedBy: input.userId,
				notes: 'Violation created'
			}
		});

		return v;
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'VIOLATION',
		entityId: violation.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Violation created: ${violation.title}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'violationCreateWorkflow_v1',
		workflowStep: 'CREATE_VIOLATION',
		workflowVersion: 'v1',
		violationId: violation.id,
		unitId: input.unitId,
		newState: {
			violationNumber: violation.violationNumber,
			title: violation.title,
			status: violation.status,
			severity: violation.severity
		}
	});

	return {
		id: violation.id,
		violationNumber: violation.violationNumber,
		status: violation.status as ViolationStatus,
		severity: violation.severity as ViolationSeverity,
		title: violation.title
	};
}

async function violationCreateWorkflow(input: ViolationCreateInput): Promise<ViolationCreateResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started' });

		const result = await DBOS.runStep(() => createViolation(input), { name: 'createViolation' });

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, {
			step: 'completed',
			violationId: result.id,
			violationNumber: result.violationNumber
		});

		return {
			success: true,
			violationId: result.id,
			violationNumber: result.violationNumber,
			status: result.status,
			severity: result.severity,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'VIOLATION_CREATE_WORKFLOW_ERROR'
		});

		return {
			success: false,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const violationCreateWorkflow_v1 = DBOS.registerWorkflow(violationCreateWorkflow);

export async function startViolationCreateWorkflow(
	input: ViolationCreateInput,
	workflowId: string, idempotencyKey: string
): Promise<ViolationCreateResult> {
	const handle = await DBOS.startWorkflow(violationCreateWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export async function getViolationCreateWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export type { ViolationCreateInput, ViolationCreateResult };
