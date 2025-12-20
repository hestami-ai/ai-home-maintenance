/**
 * Reserve Workflow (v1)
 *
 * DBOS durable workflow for managing reserve fund operations.
 * Handles: createComponent, updateComponent, createStudy, addStudyComponent, generateFundingSchedule.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

// Action types for the unified workflow
export type ReserveAction = 
	| 'CREATE_COMPONENT'
	| 'UPDATE_COMPONENT'
	| 'CREATE_STUDY'
	| 'ADD_STUDY_COMPONENT'
	| 'GENERATE_FUNDING_SCHEDULE';

export interface ReserveWorkflowInput {
	action: ReserveAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	data: Record<string, unknown>;
}

export interface ReserveWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function createComponent(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const component = await prisma.reserveComponent.create({
		data: {
			associationId: data.associationId as string,
			name: data.name as string,
			description: data.description as string | undefined,
			category: data.category as any,
			location: data.location as string | undefined,
			quantity: (data.quantity as number) ?? 1,
			unitOfMeasure: data.unitOfMeasure as string | undefined,
			conditionRating: data.conditionRating as number | undefined,
			placedInServiceDate: data.placedInServiceDate ? new Date(data.placedInServiceDate as string) : undefined,
			usefulLife: data.usefulLife as number,
			remainingLife: data.remainingLife as number,
			currentReplacementCost: data.currentReplacementCost as number,
			inflationRate: (data.inflationRate as number) ?? 3.0,
			notes: data.notes as string | undefined
		}
	});

	console.log(`[ReserveWorkflow] CREATE_COMPONENT component:${component.id} by user ${userId}`);
	return component.id;
}

async function updateComponent(
	organizationId: string,
	userId: string,
	componentId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.reserveComponent.update({
		where: { id: componentId },
		data: {
			name: data.name as string | undefined,
			description: data.description as string | undefined,
			category: data.category as any,
			location: data.location as string | undefined,
			quantity: data.quantity as number | undefined,
			unitOfMeasure: data.unitOfMeasure as string | undefined,
			conditionRating: data.conditionRating as number | undefined,
			placedInServiceDate: data.placedInServiceDate ? new Date(data.placedInServiceDate as string) : undefined,
			usefulLife: data.usefulLife as number | undefined,
			remainingLife: data.remainingLife as number | undefined,
			currentReplacementCost: data.currentReplacementCost as number | undefined,
			inflationRate: data.inflationRate as number | undefined,
			notes: data.notes as string | undefined
		}
	});

	console.log(`[ReserveWorkflow] UPDATE_COMPONENT component:${componentId} by user ${userId}`);
	return componentId;
}

async function createStudy(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const study = await prisma.reserveStudy.create({
		data: {
			associationId: data.associationId as string,
			studyDate: new Date(data.studyDate as string),
			effectiveDate: new Date(data.effectiveDate as string || data.studyDate as string),
			studyType: data.studyType as any,
			preparerName: data.preparerName as string,
			preparerCompany: data.preparerCompany as string | undefined,
			preparerCredentials: data.preparerCredentials as string | undefined,
			reserveBalance: data.reserveBalance as number,
			percentFunded: data.percentFunded as number,
			fullyFundedBalance: data.fullyFundedBalance as number,
			recommendedContribution: data.recommendedContribution as number,
			fundingPlanType: data.fundingPlanType as any,
			notes: data.notes as string | undefined
		}
	});

	console.log(`[ReserveWorkflow] CREATE_STUDY study:${study.id} by user ${userId}`);
	return study.id;
}

async function addStudyComponent(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const studyId = data.studyId as string;
	const componentId = data.componentId as string;

	const component = await prisma.reserveComponent.findUnique({ where: { id: componentId } });
	if (!component) throw new Error('ReserveComponent not found');

	const snapshot = await prisma.reserveStudyComponent.create({
		data: {
			studyId,
			componentId,
			usefulLife: component.usefulLife,
			remainingLife: component.remainingLife,
			currentCost: component.currentReplacementCost,
			futureCost: data.futureCost as number || component.currentReplacementCost,
			conditionRating: component.conditionRating,
			fundedAmount: data.fundedAmount as number || 0,
			percentFunded: data.percentFunded as number || 0
		}
	});

	console.log(`[ReserveWorkflow] ADD_STUDY_COMPONENT snapshot:${snapshot.id} by user ${userId}`);
	return snapshot.id;
}

async function generateFundingSchedule(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const studyId = data.studyId as string;
	const planType = data.planType as string;
	const yearlyContributions = data.yearlyContributions as Array<{ 
		fiscalYear: number; 
		projectedBalance: number;
		recommendedContribution: number;
		projectedExpenditures: number;
		percentFunded: number;
	}>;

	// Delete existing schedule
	await prisma.reserveFundingSchedule.deleteMany({
		where: { studyId }
	});

	// Create new schedule entries
	for (const entry of yearlyContributions) {
		await prisma.reserveFundingSchedule.create({
			data: {
				studyId,
				fiscalYear: entry.fiscalYear,
				projectedBalance: entry.projectedBalance,
				recommendedContribution: entry.recommendedContribution,
				projectedExpenditures: entry.projectedExpenditures,
				percentFunded: entry.percentFunded
			}
		});
	}

	// Update study with funding plan type
	await prisma.reserveStudy.update({
		where: { id: studyId },
		data: { fundingPlanType: planType as any }
	});

	console.log(`[ReserveWorkflow] GENERATE_FUNDING_SCHEDULE study:${studyId} entries:${yearlyContributions.length} by user ${userId}`);
	return studyId;
}

// Main workflow function
async function reserveWorkflow(input: ReserveWorkflowInput): Promise<ReserveWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_COMPONENT':
				entityId = await DBOS.runStep(
					() => createComponent(input.organizationId, input.userId, input.data),
					{ name: 'createComponent' }
				);
				break;

			case 'UPDATE_COMPONENT':
				entityId = await DBOS.runStep(
					() => updateComponent(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateComponent' }
				);
				break;

			case 'CREATE_STUDY':
				entityId = await DBOS.runStep(
					() => createStudy(input.organizationId, input.userId, input.data),
					{ name: 'createStudy' }
				);
				break;

			case 'ADD_STUDY_COMPONENT':
				entityId = await DBOS.runStep(
					() => addStudyComponent(input.organizationId, input.userId, input.data),
					{ name: 'addStudyComponent' }
				);
				break;

			case 'GENERATE_FUNDING_SCHEDULE':
				entityId = await DBOS.runStep(
					() => generateFundingSchedule(input.organizationId, input.userId, input.data),
					{ name: 'generateFundingSchedule' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ReserveWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const reserveWorkflow_v1 = DBOS.registerWorkflow(reserveWorkflow);

export async function startReserveWorkflow(
	input: ReserveWorkflowInput,
	idempotencyKey?: string
): Promise<ReserveWorkflowResult> {
	const workflowId = idempotencyKey || `reserve-${input.action}-${input.entityId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(reserveWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
