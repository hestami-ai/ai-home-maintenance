/**
 * Signature Workflow (v1)
 *
 * DBOS durable workflow for managing field tech signature operations.
 * Handles: capture, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { orgTransaction } from '../db/rls.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('SignatureWorkflow');
import { type EntityWorkflowResult } from './schemas.js';

// Action types for the unified workflow
export const SignatureAction = {
	CAPTURE_SIGNATURE: 'CAPTURE_SIGNATURE',
	DELETE_SIGNATURE: 'DELETE_SIGNATURE'
} as const;

export type SignatureAction = (typeof SignatureAction)[keyof typeof SignatureAction];

export interface SignatureWorkflowInput {
	action: SignatureAction;
	organizationId: string;
	userId: string;
	signatureId?: string;
	data: Record<string, unknown>;
}

export interface SignatureWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function captureSignature(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const signature = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobSignature.create({
				data: {
					organizationId,
					jobId: data.jobId as string,
					jobVisitId: data.jobVisitId as string | undefined,
					signerName: data.signerName as string,
					signerEmail: data.signerEmail as string | undefined,
					signerRole: data.signerRole as string,
					signatureData: data.signatureData as string,
					signedAt: data.signedAt ? new Date(data.signedAt as string) : new Date(),
					latitude: data.latitude as number | undefined,
					longitude: data.longitude as number | undefined,
					documentType: data.documentType as string,
					documentId: data.documentId as string | undefined,
					ipAddress: data.ipAddress as string | undefined,
					deviceInfo: data.deviceInfo as string | undefined,
					capturedBy: userId
				}
			});
		},
		{ userId, reason: 'Capture job signature' }
	);

	log.info('CAPTURE_SIGNATURE completed', { signatureId: signature.id, userId });
	return signature.id;
}

async function deleteSignature(
	organizationId: string,
	userId: string,
	signatureId: string
): Promise<string> {
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.jobSignature.delete({ where: { id: signatureId } });
		},
		{ userId, reason: 'Delete job signature' }
	);

	log.info('DELETE_SIGNATURE completed', { signatureId, userId });
	return signatureId;
}

// Main workflow function
async function signatureWorkflow(input: SignatureWorkflowInput): Promise<SignatureWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CAPTURE_SIGNATURE':
				entityId = await DBOS.runStep(
					() => captureSignature(input.organizationId, input.userId, input.data),
					{ name: 'captureSignature' }
				);
				break;

			case 'DELETE_SIGNATURE':
				entityId = await DBOS.runStep(
					() => deleteSignature(input.organizationId, input.userId, input.signatureId!),
					{ name: 'deleteSignature' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error(`Error in ${input.action}`, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'SIGNATURE_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const signatureWorkflow_v1 = DBOS.registerWorkflow(signatureWorkflow);

export async function startSignatureWorkflow(
	input: SignatureWorkflowInput,
	idempotencyKey: string
): Promise<SignatureWorkflowResult> {
	const workflowId = idempotencyKey || `signature-${input.action}-${input.signatureId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(signatureWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
