/**
 * Case Communication Workflow (v1)
 *
 * DBOS durable workflow for case communication operations.
 * Handles: CREATE, UPDATE_STATUS.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import type { CommunicationChannel, CommunicationDirection } from '../../../../generated/prisma/client.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	CASE_COMMUNICATION_WORKFLOW_ERROR: 'CASE_COMMUNICATION_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('CaseCommunicationWorkflow');

// Action types for the unified workflow
export const CaseCommunicationAction = {
	CREATE: 'CREATE',
	UPDATE_STATUS: 'UPDATE_STATUS'
} as const;

export type CaseCommunicationAction = (typeof CaseCommunicationAction)[keyof typeof CaseCommunicationAction];

export interface CaseCommunicationWorkflowInput {
	action: CaseCommunicationAction;
	organizationId: string;
	userId: string;
	communicationId?: string;
	data: {
		caseId?: string;
		channel?: CommunicationChannel;
		direction?: CommunicationDirection;
		subject?: string;
		content?: string;
		toRecipient?: string;
		ccRecipients?: string[];
		threadId?: string;
		sentAt?: string;
		deliveredAt?: string | null;
		readAt?: string | null;
		failedAt?: string | null;
		failureReason?: string | null;
	};
}

export interface CaseCommunicationWorkflowResult extends EntityWorkflowResult {
	communicationId?: string;
}

// Step functions
async function createCaseCommunication(
	organizationId: string,
	userId: string,
	data: CaseCommunicationWorkflowInput['data']
): Promise<{ communicationId: string }> {
	const communication = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.caseCommunication.create({
				data: {
					caseId: data.caseId!,
					channel: data.channel!,
					direction: data.direction!,
					subject: data.subject ?? '',
					content: data.content ?? '',
					fromUserId: userId,
					toRecipient: data.toRecipient ?? null,
					ccRecipients: (data.ccRecipients ?? null) as any,
					threadId: data.threadId,
					sentAt: data.sentAt ? new Date(data.sentAt) : new Date()
				}
			});
		},
		{ userId, reason: 'Create case communication' }
	);

	log.info('CREATE completed', { communicationId: communication.id, caseId: data.caseId });
	return { communicationId: communication.id };
}

async function updateCommunicationStatus(
	organizationId: string,
	userId: string,
	communicationId: string,
	data: CaseCommunicationWorkflowInput['data']
): Promise<{ communicationId: string }> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.caseCommunication.update({
				where: { id: communicationId },
				data: {
					...(data.deliveredAt !== undefined && {
						deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null
					}),
					...(data.readAt !== undefined && {
						readAt: data.readAt ? new Date(data.readAt) : null
					}),
					...(data.failedAt !== undefined && {
						failedAt: data.failedAt ? new Date(data.failedAt) : null
					}),
					...(data.failureReason !== undefined && { failureReason: data.failureReason })
				}
			});
		},
		{ userId, reason: 'Update case communication status' }
	);

	log.info('UPDATE_STATUS completed', { communicationId });
	return { communicationId };
}

// Main workflow function
async function caseCommunicationWorkflow(input: CaseCommunicationWorkflowInput): Promise<CaseCommunicationWorkflowResult> {
	try {
		switch (input.action) {
			case CaseCommunicationAction.CREATE: {
				const result = await DBOS.runStep(
					() => createCaseCommunication(input.organizationId, input.userId, input.data),
					{ name: 'createCaseCommunication' }
				);
				return {
					success: true,
					entityId: result.communicationId,
					communicationId: result.communicationId
				};
			}

			case 'UPDATE_STATUS': {
				const result = await DBOS.runStep(
					() => updateCommunicationStatus(input.organizationId, input.userId, input.communicationId!, input.data),
					{ name: 'updateCommunicationStatus' }
				);
				return { success: true, entityId: result.communicationId, communicationId: result.communicationId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}`, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.CASE_COMMUNICATION_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const caseCommunicationWorkflow_v1 = DBOS.registerWorkflow(caseCommunicationWorkflow);

export async function startCaseCommunicationWorkflow(
	input: CaseCommunicationWorkflowInput,
	idempotencyKey: string
): Promise<CaseCommunicationWorkflowResult> {
	const handle = await DBOS.startWorkflow(caseCommunicationWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
