/**
 * Appeal Workflow (v1)
 *
 * DBOS durable workflow for managing violation appeal operations.
 * Handles: file, scheduleHearing, recordDecision, withdraw.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { AppealStatus } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type AppealAction =
	| 'FILE_APPEAL'
	| 'SCHEDULE_HEARING'
	| 'RECORD_DECISION'
	| 'WITHDRAW_APPEAL';

export interface AppealWorkflowInput {
	action: AppealAction;
	organizationId: string;
	userId: string;
	associationId: string;
	appealId?: string;
	data: Record<string, unknown>;
}

export interface AppealWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function fileAppeal(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const hearingId = data.hearingId as string;
	const reason = data.reason as string;
	const documentsJson = data.documentsJson as string | undefined;

	// Verify hearing exists and belongs to this association
	const hearing = await prisma.violationHearing.findFirst({
		where: { id: hearingId },
		include: { violation: true }
	});

	if (!hearing || hearing.violation.associationId !== associationId) {
		throw new Error('Hearing not found');
	}

	// Check if hearing has a decision
	if (hearing.outcome === 'PENDING') {
		throw new Error('Cannot appeal a hearing that has not been held');
	}

	// Check appeal deadline
	if (hearing.appealDeadline && new Date() > hearing.appealDeadline) {
		throw new Error('Appeal deadline has passed');
	}

	// Check if appeal already filed
	const existingAppeal = await prisma.violationAppeal.findFirst({
		where: { hearingId, status: { notIn: ['WITHDRAWN'] } }
	});
	if (existingAppeal) {
		throw new Error('An appeal has already been filed for this hearing');
	}

	// Create appeal and update hearing
	const [appeal] = await prisma.$transaction([
		prisma.violationAppeal.create({
			data: {
				hearingId,
				filedDate: new Date(),
				filedBy: userId,
				reason,
				documentsJson,
				originalFineAmount: hearing.fineAssessed
			}
		}),
		prisma.violationHearing.update({
			where: { id: hearingId },
			data: {
				appealFiled: true,
				appealDate: new Date()
			}
		}),
		prisma.violation.update({
			where: { id: hearing.violationId },
			data: { status: 'APPEALED' }
		})
	]);

	console.log(`[AppealWorkflow] FILE_APPEAL appeal:${appeal.id} by user ${userId}`);
	return appeal.id;
}

async function scheduleHearing(
	organizationId: string,
	userId: string,
	associationId: string,
	appealId: string,
	data: Record<string, unknown>
): Promise<string> {
	const appealHearingDate = data.appealHearingDate as string;
	const appealHearingLocation = data.appealHearingLocation as string | undefined;

	const appeal = await prisma.violationAppeal.findFirst({
		where: { id: appealId },
		include: { hearing: { include: { violation: true } } }
	});

	if (!appeal || appeal.hearing.violation.associationId !== associationId) {
		throw new Error('Appeal not found');
	}

	if (appeal.status !== 'PENDING') {
		throw new Error('Can only schedule hearing for pending appeals');
	}

	await prisma.violationAppeal.update({
		where: { id: appealId },
		data: {
			status: 'SCHEDULED',
			appealHearingDate: new Date(appealHearingDate),
			appealHearingLocation
		}
	});

	console.log(`[AppealWorkflow] SCHEDULE_HEARING appeal:${appealId} by user ${userId}`);
	return appealId;
}

async function recordDecision(
	organizationId: string,
	userId: string,
	associationId: string,
	appealId: string,
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as AppealStatus;
	const decisionNotes = data.decisionNotes as string | undefined;
	const revisedFineAmount = data.revisedFineAmount as number | undefined;

	const appeal = await prisma.violationAppeal.findFirst({
		where: { id: appealId },
		include: { hearing: { include: { violation: true } } }
	});

	if (!appeal || appeal.hearing.violation.associationId !== associationId) {
		throw new Error('Appeal not found');
	}

	if (!['PENDING', 'SCHEDULED'].includes(appeal.status)) {
		throw new Error('Appeal decision has already been recorded');
	}

	// Update appeal and violation status
	await prisma.$transaction([
		prisma.violationAppeal.update({
			where: { id: appealId },
			data: {
				status,
				decisionDate: new Date(),
				decisionBy: userId,
				decisionNotes,
				revisedFineAmount
			}
		}),
		// Update violation status based on appeal outcome
		prisma.violation.update({
			where: { id: appeal.hearing.violationId },
			data: {
				status: status === 'REVERSED' ? 'DISMISSED' : 'CLOSED'
			}
		})
	]);

	console.log(`[AppealWorkflow] RECORD_DECISION appeal:${appealId} status:${status} by user ${userId}`);
	return appealId;
}

async function withdrawAppeal(
	organizationId: string,
	userId: string,
	associationId: string,
	appealId: string
): Promise<string> {
	const appeal = await prisma.violationAppeal.findFirst({
		where: { id: appealId },
		include: { hearing: { include: { violation: true } } }
	});

	if (!appeal || appeal.hearing.violation.associationId !== associationId) {
		throw new Error('Appeal not found');
	}

	if (!['PENDING', 'SCHEDULED'].includes(appeal.status)) {
		throw new Error('Cannot withdraw appeal after decision');
	}

	// Update appeal and revert violation status
	await prisma.$transaction([
		prisma.violationAppeal.update({
			where: { id: appealId },
			data: { status: 'WITHDRAWN' }
		}),
		prisma.violation.update({
			where: { id: appeal.hearing.violationId },
			data: { status: 'FINE_ASSESSED' }
		})
	]);

	console.log(`[AppealWorkflow] WITHDRAW_APPEAL appeal:${appealId} by user ${userId}`);
	return appealId;
}

// Main workflow function
async function appealWorkflow(input: AppealWorkflowInput): Promise<AppealWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'FILE_APPEAL':
				entityId = await DBOS.runStep(
					() => fileAppeal(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'fileAppeal' }
				);
				break;

			case 'SCHEDULE_HEARING':
				entityId = await DBOS.runStep(
					() => scheduleHearing(input.organizationId, input.userId, input.associationId, input.appealId!, input.data),
					{ name: 'scheduleHearing' }
				);
				break;

			case 'RECORD_DECISION':
				entityId = await DBOS.runStep(
					() => recordDecision(input.organizationId, input.userId, input.associationId, input.appealId!, input.data),
					{ name: 'recordDecision' }
				);
				break;

			case 'WITHDRAW_APPEAL':
				entityId = await DBOS.runStep(
					() => withdrawAppeal(input.organizationId, input.userId, input.associationId, input.appealId!),
					{ name: 'withdrawAppeal' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[AppealWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const appealWorkflow_v1 = DBOS.registerWorkflow(appealWorkflow);

export async function startAppealWorkflow(
	input: AppealWorkflowInput,
	idempotencyKey?: string
): Promise<AppealWorkflowResult> {
	const workflowId = idempotencyKey || `appeal-${input.action}-${input.appealId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(appealWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
