/**
 * Signature Workflow (v1)
 *
 * DBOS durable workflow for managing field tech signature operations.
 * Handles: capture, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
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
	const signature = await prisma.jobSignature.create({
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

	console.log(`[SignatureWorkflow] CAPTURE_SIGNATURE signature:${signature.id} by user ${userId}`);
	return signature.id;
}

async function deleteSignature(
	organizationId: string,
	userId: string,
	signatureId: string
): Promise<string> {
	await prisma.jobSignature.delete({ where: { id: signatureId } });

	console.log(`[SignatureWorkflow] DELETE_SIGNATURE signature:${signatureId} by user ${userId}`);
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
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[SignatureWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const signatureWorkflow_v1 = DBOS.registerWorkflow(signatureWorkflow);

export async function startSignatureWorkflow(
	input: SignatureWorkflowInput,
	idempotencyKey?: string
): Promise<SignatureWorkflowResult> {
	const workflowId = idempotencyKey || `signature-${input.action}-${input.signatureId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(signatureWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
