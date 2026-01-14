/**
 * Vendor Candidate Workflow (v1)
 *
 * DBOS durable workflow for vendor candidate management operations.
 * Handles: create, update, updateStatus, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import type { VendorCandidateStatus } from '../../../../generated/prisma/client.js';

const log = createWorkflowLogger('VendorCandidateWorkflow');

// Action types for the unified workflow
export const VendorCandidateWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	UPDATE_STATUS: 'UPDATE_STATUS',
	DELETE: 'DELETE'
} as const;

export type VendorCandidateWorkflowAction = (typeof VendorCandidateWorkflowAction)[keyof typeof VendorCandidateWorkflowAction];

export interface VendorCandidateWorkflowInput {
	action: VendorCandidateWorkflowAction;
	organizationId: string;
	userId: string;
	vendorCandidateId?: string;
	data: {
		// CREATE fields
		caseId?: string;
		vendorName?: string;
		vendorContactName?: string | null;
		vendorContactEmail?: string | null;
		vendorContactPhone?: string | null;
		vendorAddress?: string | null;
		vendorWebsite?: string | null;
		serviceCategories?: string[];
		coverageArea?: string | null;
		licensesAndCerts?: string[];
		notes?: string | null;
		riskFlags?: string[];
		// Provenance fields (for extracted vendors)
		sourceUrl?: string | null;
		sourceHtml?: string | null;
		sourcePlainText?: string | null;
		extractionConfidence?: number | null;
		extractionMetadata?: Record<string, unknown>;
		// UPDATE_STATUS fields
		status?: string;
	};
}

export interface VendorCandidateWorkflowResult extends EntityWorkflowResult {
	vendorCandidateId?: string;
}

// Step functions

async function createVendorCandidate(
	organizationId: string,
	data: VendorCandidateWorkflowInput['data']
): Promise<{ vendorCandidateId: string }> {
	const now = new Date();
	const vendorCandidate = await prisma.vendorCandidate.create({
		data: {
			organizationId,
			caseId: data.caseId!,
			vendorName: data.vendorName!,
			vendorContactName: data.vendorContactName,
			vendorContactEmail: data.vendorContactEmail,
			vendorContactPhone: data.vendorContactPhone,
			vendorAddress: data.vendorAddress,
			vendorWebsite: data.vendorWebsite,
			serviceCategories: data.serviceCategories ?? [],
			coverageArea: data.coverageArea,
			licensesAndCerts: data.licensesAndCerts ?? [],
			notes: data.notes,
			status: 'IDENTIFIED',
			sourceUrl: data.sourceUrl,
			sourceHtml: data.sourceHtml,
			sourcePlainText: data.sourcePlainText,
			extractedAt: data.sourceUrl ? now : null,
			extractionConfidence: data.extractionConfidence,
			extractionMetadata: data.extractionMetadata as object | undefined
		}
	});

	log.info('CREATE completed', { vendorCandidateId: vendorCandidate.id, caseId: data.caseId });
	return { vendorCandidateId: vendorCandidate.id };
}

async function updateVendorCandidate(
	vendorCandidateId: string,
	data: VendorCandidateWorkflowInput['data']
): Promise<{ vendorCandidateId: string }> {
	await prisma.vendorCandidate.update({
		where: { id: vendorCandidateId },
		data: {
			...(data.vendorName !== undefined && { vendorName: data.vendorName }),
			...(data.vendorContactName !== undefined && { vendorContactName: data.vendorContactName }),
			...(data.vendorContactEmail !== undefined && { vendorContactEmail: data.vendorContactEmail }),
			...(data.vendorContactPhone !== undefined && { vendorContactPhone: data.vendorContactPhone }),
			...(data.vendorAddress !== undefined && { vendorAddress: data.vendorAddress }),
			...(data.vendorWebsite !== undefined && { vendorWebsite: data.vendorWebsite }),
			...(data.serviceCategories !== undefined && { serviceCategories: data.serviceCategories }),
			...(data.coverageArea !== undefined && { coverageArea: data.coverageArea }),
			...(data.licensesAndCerts !== undefined && { licensesAndCerts: data.licensesAndCerts }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.riskFlags !== undefined && { riskFlags: data.riskFlags })
		}
	});

	log.info('UPDATE completed', { vendorCandidateId });
	return { vendorCandidateId };
}

async function updateVendorCandidateStatus(
	vendorCandidateId: string,
	status: string
): Promise<{ vendorCandidateId: string }> {
	await prisma.vendorCandidate.update({
		where: { id: vendorCandidateId },
		data: {
			status: status as VendorCandidateStatus,
			statusChangedAt: new Date()
		}
	});

	log.info('UPDATE_STATUS completed', { vendorCandidateId, status });
	return { vendorCandidateId };
}

async function deleteVendorCandidate(
	vendorCandidateId: string
): Promise<{ vendorCandidateId: string }> {
	await prisma.vendorCandidate.update({
		where: { id: vendorCandidateId },
		data: { deletedAt: new Date() }
	});

	log.info('DELETE completed', { vendorCandidateId });
	return { vendorCandidateId };
}

// Main workflow function
async function vendorCandidateWorkflow(input: VendorCandidateWorkflowInput): Promise<VendorCandidateWorkflowResult> {
	try {
		switch (input.action) {
			case 'CREATE': {
				const result = await DBOS.runStep(
					() => createVendorCandidate(input.organizationId, input.data),
					{ name: 'createVendorCandidate' }
				);
				return {
					success: true,
					entityId: result.vendorCandidateId,
					vendorCandidateId: result.vendorCandidateId
				};
			}

			case 'UPDATE': {
				const result = await DBOS.runStep(
					() => updateVendorCandidate(input.vendorCandidateId!, input.data),
					{ name: 'updateVendorCandidate' }
				);
				return { success: true, entityId: result.vendorCandidateId, vendorCandidateId: result.vendorCandidateId };
			}

			case 'UPDATE_STATUS': {
				const result = await DBOS.runStep(
					() => updateVendorCandidateStatus(input.vendorCandidateId!, input.data.status!),
					{ name: 'updateVendorCandidateStatus' }
				);
				return { success: true, entityId: result.vendorCandidateId, vendorCandidateId: result.vendorCandidateId };
			}

			case 'DELETE': {
				const result = await DBOS.runStep(
					() => deleteVendorCandidate(input.vendorCandidateId!),
					{ name: 'deleteVendorCandidate' }
				);
				return { success: true, entityId: result.vendorCandidateId, vendorCandidateId: result.vendorCandidateId };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[VendorCandidateWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'VENDOR_CANDIDATE_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const vendorCandidateWorkflow_v1 = DBOS.registerWorkflow(vendorCandidateWorkflow);

export async function startVendorCandidateWorkflow(
	input: VendorCandidateWorkflowInput,
	idempotencyKey: string
): Promise<VendorCandidateWorkflowResult> {
	const handle = await DBOS.startWorkflow(vendorCandidateWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
