/**
 * Checklist Workflow (v1)
 *
 * DBOS durable workflow for managing field tech checklist operations.
 * Handles: create, apply, updateStep, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ChecklistItemStatus } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type ChecklistAction =
	| 'CREATE_CHECKLIST'
	| 'APPLY_CHECKLIST'
	| 'UPDATE_STEP'
	| 'DELETE_CHECKLIST';

export interface ChecklistWorkflowInput {
	action: ChecklistAction;
	organizationId: string;
	userId: string;
	checklistId?: string;
	stepId?: string;
	data: Record<string, unknown>;
}

export interface ChecklistWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function createChecklist(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const name = data.name as string;
	const description = data.description as string | undefined;
	const steps = data.steps as Array<{
		title: string;
		description?: string;
		isRequired?: boolean;
		requiresPhoto?: boolean;
		requiresSignature?: boolean;
		requiresNotes?: boolean;
	}>;

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
	data: Record<string, unknown>
): Promise<string> {
	const jobId = data.jobId as string;
	const templateId = data.templateId as string;
	const templateName = data.templateName as string;
	const templateDescription = data.templateDescription as string | undefined;
	const templateSteps = data.templateSteps as Array<{
		stepNumber: number;
		title: string;
		description?: string;
		isRequired: boolean;
		requiresPhoto: boolean;
		requiresSignature: boolean;
		requiresNotes: boolean;
	}>;

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
	data: Record<string, unknown>
): Promise<string> {
	const status = data.status as ChecklistItemStatus;
	const notes = data.notes as string | undefined;
	const checklistId = data.checklistId as string;

	// Update the step
	await prisma.jobStep.update({
		where: { id: stepId },
		data: {
			status,
			completedAt: status === 'COMPLETED' || status === 'SKIPPED' ? new Date() : null,
			completedBy: status === 'COMPLETED' || status === 'SKIPPED' ? userId : null,
			notes
		}
	});

	// Check if all required steps are complete
	const allSteps = await prisma.jobStep.findMany({
		where: { checklistId }
	});

	const allRequiredComplete = allSteps
		.filter((s) => s.isRequired)
		.every((s) =>
			s.id === stepId
				? ['COMPLETED', 'SKIPPED'].includes(status)
				: ['COMPLETED', 'SKIPPED'].includes(s.status)
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
