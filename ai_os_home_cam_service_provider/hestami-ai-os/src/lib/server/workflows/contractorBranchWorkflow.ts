/**
 * Contractor Branch Workflow (v1)
 *
 * DBOS durable workflow for managing contractor branch operations.
 * Handles: createOrUpdate, archive.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ContractorBranchWorkflow');

// Action types for the unified workflow
export const ContractorBranchAction = {
	CREATE_OR_UPDATE_BRANCH: 'CREATE_OR_UPDATE_BRANCH',
	ARCHIVE_BRANCH: 'ARCHIVE_BRANCH'
} as const;

export type ContractorBranchAction = (typeof ContractorBranchAction)[keyof typeof ContractorBranchAction];

export interface ContractorBranchWorkflowInput {
	action: ContractorBranchAction;
	organizationId: string;
	userId: string;
	branchId?: string;
	data: Record<string, unknown>;
}

export interface ContractorBranchWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function createOrUpdateBranch(
	organizationId: string,
	userId: string,
	branchId: string | undefined,
	data: Record<string, unknown>
): Promise<string> {
	if (branchId) {
		const existing = await prisma.contractorBranch.findFirst({
			where: { id: branchId, organizationId }
		});
		if (!existing) throw new Error('ContractorBranch not found');

		if (data.isPrimary) {
			await prisma.contractorBranch.updateMany({
				where: { organizationId, isPrimary: true, NOT: { id: branchId } },
				data: { isPrimary: false }
			});
		}

		const branch = await prisma.contractorBranch.update({
			where: { id: branchId },
			data: {
				name: data.name as string | undefined,
				code: data.code as string | undefined,
				contactName: data.contactName as string | undefined,
				contactEmail: data.contactEmail as string | undefined,
				contactPhone: data.contactPhone as string | undefined,
				addressLine1: data.addressLine1 as string | undefined,
				addressLine2: data.addressLine2 as string | undefined,
				city: data.city as string | undefined,
				state: data.state as string | undefined,
				postalCode: data.postalCode as string | undefined,
				country: data.country as string | undefined,
				operatingHoursJson: data.operatingHoursJson as string | undefined,
				timezone: data.timezone as string | undefined,
				serviceRadiusMiles: data.serviceRadiusMiles as number | undefined,
				isPrimary: data.isPrimary as boolean | undefined
			}
		});

		console.log(`[ContractorBranchWorkflow] UPDATE_BRANCH branch:${branch.id} by user ${userId}`);
		return branch.id;
	}

	if (data.isPrimary) {
		await prisma.contractorBranch.updateMany({
			where: { organizationId, isPrimary: true },
			data: { isPrimary: false }
		});
	}

	const branch = await prisma.contractorBranch.create({
		data: {
			organizationId,
			name: data.name as string,
			code: data.code as string | undefined,
			contactName: data.contactName as string | undefined,
			contactEmail: data.contactEmail as string | undefined,
			contactPhone: data.contactPhone as string | undefined,
			addressLine1: data.addressLine1 as string,
			addressLine2: data.addressLine2 as string | undefined,
			city: data.city as string,
			state: data.state as string,
			postalCode: data.postalCode as string,
			country: (data.country as string) || 'US',
			operatingHoursJson: data.operatingHoursJson as string | undefined,
			timezone: data.timezone as string | undefined,
			serviceRadiusMiles: data.serviceRadiusMiles as number | undefined,
			isPrimary: data.isPrimary as boolean | undefined
		}
	});

	console.log(`[ContractorBranchWorkflow] CREATE_BRANCH branch:${branch.id} by user ${userId}`);
	return branch.id;
}

async function archiveBranch(
	organizationId: string,
	userId: string,
	branchId: string
): Promise<string> {
	const existing = await prisma.contractorBranch.findFirst({
		where: { id: branchId, organizationId }
	});
	if (!existing) throw new Error('ContractorBranch not found');

	await prisma.contractorBranch.update({
		where: { id: branchId },
		data: {
			isActive: false,
			code: existing.code ? `${existing.code}-archived` : existing.code
		}
	});

	console.log(`[ContractorBranchWorkflow] ARCHIVE_BRANCH branch:${branchId} by user ${userId}`);
	return branchId;
}

// Main workflow function
async function contractorBranchWorkflow(input: ContractorBranchWorkflowInput): Promise<ContractorBranchWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_OR_UPDATE_BRANCH':
				entityId = await DBOS.runStep(
					() => createOrUpdateBranch(input.organizationId, input.userId, input.branchId, input.data),
					{ name: 'createOrUpdateBranch' }
				);
				break;

			case 'ARCHIVE_BRANCH':
				entityId = await DBOS.runStep(
					() => archiveBranch(input.organizationId, input.userId, input.branchId!),
					{ name: 'archiveBranch' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ContractorBranchWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const contractorBranchWorkflow_v1 = DBOS.registerWorkflow(contractorBranchWorkflow);

export async function startContractorBranchWorkflow(
	input: ContractorBranchWorkflowInput,
	idempotencyKey?: string
): Promise<ContractorBranchWorkflowResult> {
	const workflowId = idempotencyKey || `contractor-branch-${input.action}-${input.branchId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(contractorBranchWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
