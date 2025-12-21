/**
 * Contract SLA Workflow (v1)
 *
 * DBOS durable workflow for managing contract SLA record operations.
 * Handles: create, update, calculateForPeriod.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ContractSLAWorkflow');

// Action types for the unified workflow
export const ContractSLAAction = {
	CREATE_SLA: 'CREATE_SLA',
	UPDATE_SLA: 'UPDATE_SLA',
	CALCULATE_SLA: 'CALCULATE_SLA'
} as const;

export type ContractSLAAction = (typeof ContractSLAAction)[keyof typeof ContractSLAAction];

export interface ContractSLAWorkflowInput {
	action: ContractSLAAction;
	organizationId: string;
	userId: string;
	slaRecordId?: string;
	data: Record<string, unknown>;
}

export interface ContractSLAWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createSLA(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const totalRequests = (data.totalRequests as number) || 0;
	const onTimeResponses = (data.onTimeResponses as number) || 0;
	const onTimeResolutions = (data.onTimeResolutions as number) || 0;
	const scheduledVisits = (data.scheduledVisits as number) || 0;
	const completedVisits = (data.completedVisits as number) || 0;

	// Calculate compliance percentages
	const responseCompliancePercent = totalRequests > 0
		? (onTimeResponses / totalRequests) * 100
		: null;
	const resolutionCompliancePercent = totalRequests > 0
		? (onTimeResolutions / totalRequests) * 100
		: null;
	const visitCompliancePercent = scheduledVisits > 0
		? (completedVisits / scheduledVisits) * 100
		: null;

	const record = await prisma.contractSLARecord.create({
		data: {
			contractId: data.contractId as string,
			periodStart: new Date(data.periodStart as string),
			periodEnd: new Date(data.periodEnd as string),
			totalRequests,
			onTimeResponses,
			onTimeResolutions,
			missedSLAs: (data.missedSLAs as number) || 0,
			responseCompliancePercent,
			resolutionCompliancePercent,
			avgResponseTimeMinutes: data.avgResponseTimeMinutes as number | undefined,
			avgResolutionTimeMinutes: data.avgResolutionTimeMinutes as number | undefined,
			scheduledVisits,
			completedVisits,
			missedVisits: (data.missedVisits as number) || 0,
			visitCompliancePercent,
			notes: data.notes as string | undefined
		}
	});

	console.log(`[ContractSLAWorkflow] CREATE_SLA record:${record.id} by user ${userId}`);
	return record.id;
}

async function updateSLA(
	organizationId: string,
	userId: string,
	slaRecordId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.contractSLARecord.findUnique({
		where: { id: slaRecordId },
		include: { contract: true }
	});
	if (!existing || existing.contract.organizationId !== organizationId) {
		throw new Error('SLA record not found');
	}

	const totalRequests = (data.totalRequests as number | undefined) ?? existing.totalRequests;
	const onTimeResponses = (data.onTimeResponses as number | undefined) ?? existing.onTimeResponses;
	const onTimeResolutions = (data.onTimeResolutions as number | undefined) ?? existing.onTimeResolutions;
	const scheduledVisits = (data.scheduledVisits as number | undefined) ?? existing.scheduledVisits;
	const completedVisits = (data.completedVisits as number | undefined) ?? existing.completedVisits;

	const responseCompliancePercent = totalRequests > 0
		? (onTimeResponses / totalRequests) * 100
		: null;
	const resolutionCompliancePercent = totalRequests > 0
		? (onTimeResolutions / totalRequests) * 100
		: null;
	const visitCompliancePercent = scheduledVisits > 0
		? (completedVisits / scheduledVisits) * 100
		: null;

	await prisma.contractSLARecord.update({
		where: { id: slaRecordId },
		data: {
			totalRequests: data.totalRequests as number | undefined,
			onTimeResponses: data.onTimeResponses as number | undefined,
			onTimeResolutions: data.onTimeResolutions as number | undefined,
			missedSLAs: data.missedSLAs as number | undefined,
			avgResponseTimeMinutes: data.avgResponseTimeMinutes as number | null | undefined,
			avgResolutionTimeMinutes: data.avgResolutionTimeMinutes as number | null | undefined,
			scheduledVisits: data.scheduledVisits as number | undefined,
			completedVisits: data.completedVisits as number | undefined,
			missedVisits: data.missedVisits as number | undefined,
			notes: data.notes as string | null | undefined,
			responseCompliancePercent,
			resolutionCompliancePercent,
			visitCompliancePercent
		}
	});

	console.log(`[ContractSLAWorkflow] UPDATE_SLA record:${slaRecordId} by user ${userId}`);
	return slaRecordId;
}

async function calculateSLA(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const contractId = data.contractId as string;
	const periodStart = new Date(data.periodStart as string);
	const periodEnd = new Date(data.periodEnd as string);

	// Get visits in period
	const visits = await prisma.scheduledVisit.findMany({
		where: {
			contractId,
			scheduledDate: { gte: periodStart, lte: periodEnd }
		}
	});

	const scheduledVisits = visits.length;
	const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;
	const missedVisits = visits.filter(v => v.status === 'MISSED').length;

	const visitCompliancePercent = scheduledVisits > 0
		? (completedVisits / scheduledVisits) * 100
		: null;

	// Upsert the record
	const record = await prisma.contractSLARecord.upsert({
		where: {
			contractId_periodStart_periodEnd: {
				contractId,
				periodStart,
				periodEnd
			}
		},
		create: {
			contractId,
			periodStart,
			periodEnd,
			scheduledVisits,
			completedVisits,
			missedVisits,
			visitCompliancePercent
		},
		update: {
			scheduledVisits,
			completedVisits,
			missedVisits,
			visitCompliancePercent
		}
	});

	console.log(`[ContractSLAWorkflow] CALCULATE_SLA record:${record.id} by user ${userId}`);
	return record.id;
}

// Main workflow function
async function contractSLAWorkflow(input: ContractSLAWorkflowInput): Promise<ContractSLAWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_SLA':
				entityId = await DBOS.runStep(
					() => createSLA(input.organizationId, input.userId, input.data),
					{ name: 'createSLA' }
				);
				break;

			case 'UPDATE_SLA':
				entityId = await DBOS.runStep(
					() => updateSLA(input.organizationId, input.userId, input.slaRecordId!, input.data),
					{ name: 'updateSLA' }
				);
				break;

			case 'CALCULATE_SLA':
				entityId = await DBOS.runStep(
					() => calculateSLA(input.organizationId, input.userId, input.data),
					{ name: 'calculateSLA' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ContractSLAWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const contractSLAWorkflow_v1 = DBOS.registerWorkflow(contractSLAWorkflow);

export async function startContractSLAWorkflow(
	input: ContractSLAWorkflowInput,
	idempotencyKey?: string
): Promise<ContractSLAWorkflowResult> {
	const workflowId = idempotencyKey || `contract-sla-${input.action}-${input.slaRecordId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(contractSLAWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
