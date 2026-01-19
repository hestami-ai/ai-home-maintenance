/**
 * Notice Template Workflow (v1)
 *
 * DBOS durable workflow for managing notice template operations.
 * Handles: create, update, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { NoticeType } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { ActivityActionType } from '../../../../generated/prisma/enums.js';

const log = createWorkflowLogger('NoticeTemplateWorkflow');

// Workflow error types for tracing
const WorkflowErrorType = {
	NOTICE_TEMPLATE_WORKFLOW_ERROR: 'NOTICE_TEMPLATE_WORKFLOW_ERROR'
} as const;

// Action types for the unified workflow
export const NoticeTemplateAction = {
	CREATE_TEMPLATE: 'CREATE_TEMPLATE',
	UPDATE_TEMPLATE: 'UPDATE_TEMPLATE',
	DELETE_TEMPLATE: 'DELETE_TEMPLATE'
} as const;

export type NoticeTemplateAction = (typeof NoticeTemplateAction)[keyof typeof NoticeTemplateAction];

export interface NoticeTemplateWorkflowInput {
	action: NoticeTemplateAction;
	organizationId: string;
	userId: string;
	associationId: string;
	templateId?: string;
	data: Record<string, unknown>;
}

export interface NoticeTemplateWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createTemplate(
	organizationId: string,
	userId: string,
	associationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const name = data.name as string;

	// Check for duplicate name
	const existing = await prisma.noticeTemplate.findFirst({
		where: { associationId, name }
	});
	if (existing) {
		throw new Error('Notice template with this name already exists');
	}

	const template = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.noticeTemplate.create({
				data: {
					associationId,
					name,
					noticeType: data.noticeType as NoticeType,
					subject: data.subject as string,
					bodyTemplate: data.bodyTemplate as string,
					defaultCurePeriodDays: data.defaultCurePeriodDays as number | undefined
				}
			});
		},
		{ userId, reason: 'Creating notice template' }
	);

	log.info(`CREATE_TEMPLATE template:${template.id} by user ${userId}`);
	return template.id;
}

async function updateTemplate(
	organizationId: string,
	userId: string,
	associationId: string,
	templateId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.noticeTemplate.findFirst({
		where: { id: templateId, associationId }
	});
	if (!existing) throw new Error('Notice template not found');

	// Check for duplicate name if changing
	const name = data.name as string | undefined;
	if (name && name !== existing.name) {
		const duplicate = await prisma.noticeTemplate.findFirst({
			where: { associationId, name, id: { not: templateId } }
		});
		if (duplicate) {
			throw new Error('Notice template with this name already exists');
		}
	}

	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.noticeTemplate.update({
				where: { id: templateId },
				data: {
					name,
					subject: data.subject as string | undefined,
					bodyTemplate: data.bodyTemplate as string | undefined,
					defaultCurePeriodDays: data.defaultCurePeriodDays as number | null | undefined,
					isActive: data.isActive as boolean | undefined
				}
			});
		},
		{ userId, reason: 'Updating notice template' }
	);

	log.info(`UPDATE_TEMPLATE template:${templateId} by user ${userId}`);
	return templateId;
}

async function deleteTemplate(
	organizationId: string,
	userId: string,
	associationId: string,
	templateId: string
): Promise<string> {
	const existing = await prisma.noticeTemplate.findFirst({
		where: { id: templateId, associationId }
	});
	if (!existing) throw new Error('Notice template not found');

	// Check if template is used in any sequence
	const usedInSequence = await prisma.noticeSequenceStep.findFirst({
		where: { templateId }
	});

	await orgTransaction(
		organizationId,
		async (tx) => {
			if (usedInSequence) {
				// Soft delete by deactivating
				await tx.noticeTemplate.update({
					where: { id: templateId },
					data: { isActive: false }
				});
			} else {
				// Hard delete if not used
				await tx.noticeTemplate.delete({ where: { id: templateId } });
			}
		},
		{ userId, reason: 'Deleting notice template' }
	);

	log.info(`DELETE_TEMPLATE template:${templateId} by user ${userId}`);
	return templateId;
}

// Main workflow function
async function noticeTemplateWorkflow(input: NoticeTemplateWorkflowInput): Promise<NoticeTemplateWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case NoticeTemplateAction.CREATE_TEMPLATE:
				entityId = await DBOS.runStep(
					() => createTemplate(input.organizationId, input.userId, input.associationId, input.data),
					{ name: 'createTemplate' }
				);
				break;

			case NoticeTemplateAction.UPDATE_TEMPLATE:
				entityId = await DBOS.runStep(
					() => updateTemplate(input.organizationId, input.userId, input.associationId, input.templateId!, input.data),
					{ name: 'updateTemplate' }
				);
				break;

			case NoticeTemplateAction.DELETE_TEMPLATE:
				entityId = await DBOS.runStep(
					() => deleteTemplate(input.organizationId, input.userId, input.associationId, input.templateId!),
					{ name: 'deleteTemplate' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}: ${errorMessage}`);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.NOTICE_TEMPLATE_WORKFLOW_ERROR
		});

		return { success: false, error: errorMessage };
	}
}

export const noticeTemplateWorkflow_v1 = DBOS.registerWorkflow(noticeTemplateWorkflow);

export async function startNoticeTemplateWorkflow(
	input: NoticeTemplateWorkflowInput,
	idempotencyKey: string
): Promise<NoticeTemplateWorkflowResult> {
	const workflowId = idempotencyKey || `notice-template-${input.action}-${input.templateId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(noticeTemplateWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
