/**
 * Checklist Workflow (v1)
 *
 * DBOS durable workflow for managing field tech checklist operations.
 * Handles: create, apply, updateStep, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { ChecklistItemStatus, type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ChecklistWorkflow');

// Action types for the unified workflow
export const ChecklistAction = {
	CREATE_CHECKLIST: 'CREATE_CHECKLIST',
	APPLY_CHECKLIST: 'APPLY_CHECKLIST',
	UPDATE_STEP: 'UPDATE_STEP',
	DELETE_CHECKLIST: 'DELETE_CHECKLIST'
} as const;

export type ChecklistAction = (typeof ChecklistAction)[keyof typeof ChecklistAction];

interface ChecklistStep {
	title: string;
	description?: string | null;
	isRequired?: boolean;
	requiresPhoto?: boolean;
	requiresSignature?: boolean;
	requiresNotes?: boolean;
}

interface TemplateStep extends ChecklistStep {
	stepNumber: number;
	isRequired: boolean;
	requiresPhoto: boolean;
	requiresSignature: boolean;
	requiresNotes: boolean;
}

export interface ChecklistWorkflowInput {
	action: ChecklistAction;
	organizationId: string;
	userId: string;
	checklistId?: string;
	stepId?: string;
	data: {
		name?: string;
		description?: string | null;
		steps?: ChecklistStep[];
		jobId?: string;
		templateId?: string;
		templateName?: string;
		templateDescription?: string | null;
		templateSteps?: TemplateStep[];
		status?: ChecklistItemStatus;
		notes?: string | null;
		checklistId?: string;
	};
}

export interface ChecklistWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createChecklist(
	organizationId: string,
	userId: string,
	data: ChecklistWorkflowInput['data']
): Promise<string> {
	const name = data.name!;
	const description = data.description;
	const steps = data.steps || [];

	const checklistId = await orgTransaction(organizationId, async (tx) => {
		const checklist = await tx.jobChecklist.create({
			data: {
				organizationId,
				name,
				description,
				isTemplate: true
			}
		});

		if (steps.length > 0) {
			await tx.jobStep.createMany({
				data: steps.map((step, idx) => ({
					checklistId: checklist.id,
					stepNumber: idx + 1,
					title: step.title,
					description: step.description,
					isRequired: step.isRequired ?? true,
					requiresPhoto: step.requiresPhoto ?? false,
					requiresSignature: step.requiresSignature ?? false,
					requiresNotes: step.requiresNotes ?? false
				}))
			});
		}

		return checklist.id;
	}, { userId, reason: 'Creating checklist template' });

	log.info(`CREATE_CHECKLIST checklist:${checklistId} by user ${userId}`);
	return checklistId;
}

async function applyChecklist(
	organizationId: string,
	userId: string,
	data: ChecklistWorkflowInput['data']
): Promise<string> {
	const jobId = data.jobId!;
	const templateId = data.templateId!;
	const templateName = data.templateName!;
	const templateDescription = data.templateDescription;
	const templateSteps = data.templateSteps || [];

	const checklistId = await orgTransaction(organizationId, async (tx) => {
		// Create job checklist from template
		const checklist = await tx.jobChecklist.create({
			data: {
				organizationId,
				name: templateName,
				description: templateDescription,
				isTemplate: false,
				templateId,
				jobId
			}
		});

		// Copy steps
		if (templateSteps.length > 0) {
			await tx.jobStep.createMany({
				data: templateSteps.map((step) => ({
					checklistId: checklist.id,
					stepNumber: step.stepNumber,
					title: step.title,
					description: step.description,
					isRequired: step.isRequired,
					requiresPhoto: step.requiresPhoto,
					requiresSignature: step.requiresSignature,
					requiresNotes: step.requiresNotes
				}))
			});
		}

		return checklist.id;
	}, { userId, reason: 'Applying checklist template to job' });

	log.info(`APPLY_CHECKLIST checklist:${checklistId} from template:${templateId} by user ${userId}`);
	return checklistId;
}

async function updateStep(
	organizationId: string,
	userId: string,
	stepId: string,
	data: ChecklistWorkflowInput['data']
): Promise<string> {
	const status = data.status!;
	const notes = data.notes;
	const checklistId = data.checklistId!;

	const isComplete = status === ChecklistItemStatus.COMPLETED || status === ChecklistItemStatus.SKIPPED;

	await orgTransaction(organizationId, async (tx) => {
		// Update the step
		await tx.jobStep.update({
			where: { id: stepId },
			data: {
				status,
				completedAt: isComplete ? new Date() : null,
				completedBy: isComplete ? userId : null,
				notes
			}
		});

		// Check if all required steps are complete
		const allSteps = await tx.jobStep.findMany({
			where: { checklistId }
		});

		const isStatusComplete = (s: string) => s === ChecklistItemStatus.COMPLETED || s === ChecklistItemStatus.SKIPPED;
		const allRequiredComplete = allSteps
			.filter((s) => s.isRequired)
			.every((s) =>
				s.id === stepId
					? isStatusComplete(status)
					: isStatusComplete(s.status)
			);

		if (allRequiredComplete) {
			await tx.jobChecklist.update({
				where: { id: checklistId },
				data: {
					isCompleted: true,
					completedAt: new Date(),
					completedBy: userId
				}
			});
		}
	}, { userId, reason: 'Updating checklist step' });

	log.info(`UPDATE_STEP step:${stepId} by user ${userId}`);
	return stepId;
}

async function deleteChecklist(
	organizationId: string,
	userId: string,
	checklistId: string
): Promise<string> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.jobChecklist.delete({ where: { id: checklistId } });
	}, { userId, reason: 'Deleting checklist' });

	log.info(`DELETE_CHECKLIST checklist:${checklistId} by user ${userId}`);
	return checklistId;
}

// Main workflow function
async function checklistWorkflow(input: ChecklistWorkflowInput): Promise<ChecklistWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_CHECKLIST':
				entityId = await DBOS.runStep(
					() => createChecklist(input.organizationId, input.userId, input.data),
					{ name: 'createChecklist' }
				);
				break;

			case 'APPLY_CHECKLIST':
				entityId = await DBOS.runStep(
					() => applyChecklist(input.organizationId, input.userId, input.data),
					{ name: 'applyChecklist' }
				);
				break;

			case 'UPDATE_STEP':
				entityId = await DBOS.runStep(
					() => updateStep(input.organizationId, input.userId, input.stepId!, input.data),
					{ name: 'updateStep' }
				);
				break;

			case 'DELETE_CHECKLIST':
				entityId = await DBOS.runStep(
					() => deleteChecklist(input.organizationId, input.userId, input.checklistId!),
					{ name: 'deleteChecklist' }
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CHECKLIST_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const checklistWorkflow_v1 = DBOS.registerWorkflow(checklistWorkflow);

export async function startChecklistWorkflow(
	input: ChecklistWorkflowInput,
	idempotencyKey: string
): Promise<ChecklistWorkflowResult> {
	const workflowId = idempotencyKey || `checklist-${input.action}-${input.checklistId || input.stepId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(checklistWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
