/**
 * Checklist Workflow (v1)
 *
 * DBOS durable workflow for managing field tech checklist operations.
 * Handles: create, apply, updateStep, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { ChecklistItemStatus, type EntityWorkflowResult } from './schemas.js';
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

	const checklist = await prisma.jobChecklist.create({
		data: {
			organizationId,
			name,
			description,
			isTemplate: true
		}
	});

	if (steps.length > 0) {
		await prisma.jobStep.createMany({
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

	console.log(`[ChecklistWorkflow] CREATE_CHECKLIST checklist:${checklist.id} by user ${userId}`);
	return checklist.id;
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

	// Create job checklist from template
	const checklist = await prisma.jobChecklist.create({
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
		await prisma.jobStep.createMany({
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

	console.log(`[ChecklistWorkflow] APPLY_CHECKLIST checklist:${checklist.id} from template:${templateId} by user ${userId}`);
	return checklist.id;
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

	// Update the step
	await prisma.jobStep.update({
		where: { id: stepId },
		data: {
			status,
			completedAt: isComplete ? new Date() : null,
			completedBy: isComplete ? userId : null,
			notes
		}
	});

	// Check if all required steps are complete
	const allSteps = await prisma.jobStep.findMany({
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
		await prisma.jobChecklist.update({
			where: { id: checklistId },
			data: {
				isCompleted: true,
				completedAt: new Date(),
				completedBy: userId
			}
		});
	}

	console.log(`[ChecklistWorkflow] UPDATE_STEP step:${stepId} by user ${userId}`);
	return stepId;
}

async function deleteChecklist(
	organizationId: string,
	userId: string,
	checklistId: string
): Promise<string> {
	await prisma.jobChecklist.delete({ where: { id: checklistId } });

	console.log(`[ChecklistWorkflow] DELETE_CHECKLIST checklist:${checklistId} by user ${userId}`);
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ChecklistWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const checklistWorkflow_v1 = DBOS.registerWorkflow(checklistWorkflow);

export async function startChecklistWorkflow(
	input: ChecklistWorkflowInput,
	idempotencyKey?: string
): Promise<ChecklistWorkflowResult> {
	const workflowId = idempotencyKey || `checklist-${input.action}-${input.checklistId || input.stepId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(checklistWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
