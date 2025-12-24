/**
 * Owner Portal Workflow (v1)
 *
 * DBOS durable workflow for owner portal operations.
 * Handles: owner requests, payment methods, auto-pay settings, document access grants.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('OwnerPortalWorkflow');

export const OwnerPortalAction = {
	CREATE_OWNER_REQUEST: 'CREATE_OWNER_REQUEST',
	SUBMIT_OWNER_REQUEST: 'SUBMIT_OWNER_REQUEST',
	UPDATE_REQUEST_STATUS: 'UPDATE_REQUEST_STATUS',
	LINK_WORK_ORDER: 'LINK_WORK_ORDER',
	ADD_PAYMENT_METHOD: 'ADD_PAYMENT_METHOD',
	SET_DEFAULT_PAYMENT: 'SET_DEFAULT_PAYMENT',
	CONFIGURE_AUTO_PAY: 'CONFIGURE_AUTO_PAY',
	GRANT_DOCUMENT_ACCESS: 'GRANT_DOCUMENT_ACCESS'
} as const;

export type OwnerPortalAction = (typeof OwnerPortalAction)[keyof typeof OwnerPortalAction];

export interface OwnerPortalWorkflowInput {
	action: OwnerPortalAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	data: Record<string, unknown>;
}

export interface OwnerPortalWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

async function createOwnerRequest(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const associationId = data.associationId as string;
	const year = new Date().getFullYear();
	
	const count = await prisma.ownerRequest.count({
		where: {
			associationId,
			requestNumber: { startsWith: `REQ-${year}-` }
		}
	});
	const requestNumber = `REQ-${year}-${String(count + 1).padStart(5, '0')}`;

	const request = await prisma.ownerRequest.create({
		data: {
			associationId,
			unitId: data.unitId as string | undefined,
			partyId: data.requesterPartyId as string,
			requestNumber,
			category: data.category as any,
			subject: data.subject as string,
			description: data.description as string,
			status: 'DRAFT',
			attachments: data.metadata as any
		}
	});

	console.log(`[OwnerPortalWorkflow] CREATE_OWNER_REQUEST request:${request.id} by user ${userId}`);
	return request.id;
}

async function submitOwnerRequest(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<string> {
	const now = new Date();
	const updated = await prisma.ownerRequest.update({
		where: { id: requestId },
		data: {
			status: 'SUBMITTED',
			submittedAt: now
		}
	});

	console.log(`[OwnerPortalWorkflow] SUBMIT_OWNER_REQUEST request:${requestId} by user ${userId}`);
	return updated.id;
}

async function updateRequestStatus(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<string> {
	const now = new Date();
	const status = data.status as string;
	const updateData: Record<string, unknown> = { status };

	if (status === 'IN_PROGRESS' && data.assignedTo) {
		updateData.assignedTo = data.assignedTo as string;
		updateData.assignedAt = now;
	}
	if (status === 'RESOLVED') {
		updateData.resolvedAt = now;
		updateData.resolution = data.resolution as string;
	}
	if (status === 'CLOSED') {
		updateData.closedAt = now;
	}

	const updated = await prisma.ownerRequest.update({
		where: { id: requestId },
		data: updateData as any
	});

	console.log(`[OwnerPortalWorkflow] UPDATE_REQUEST_STATUS request:${requestId} status:${status} by user ${userId}`);
	return updated.id;
}

async function linkWorkOrder(
	organizationId: string,
	userId: string,
	requestId: string,
	data: Record<string, unknown>
): Promise<string> {
	const updated = await prisma.ownerRequest.update({
		where: { id: requestId },
		data: { workOrderId: data.workOrderId as string }
	});

	console.log(`[OwnerPortalWorkflow] LINK_WORK_ORDER request:${requestId} workOrder:${data.workOrderId} by user ${userId}`);
	return updated.id;
}

async function addPaymentMethod(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const isDefault = data.isDefault as boolean || false;

	// If setting as default, unset other defaults
	if (isDefault) {
		await prisma.storedPaymentMethod.updateMany({
			where: { partyId, isDefault: true, deletedAt: null },
			data: { isDefault: false }
		});
	}

	const method = await prisma.storedPaymentMethod.create({
		data: {
			partyId,
			methodType: data.methodType as any,
			lastFour: data.last4 as string,
			expirationMonth: data.expirationMonth as number | undefined,
			expirationYear: data.expirationYear as number | undefined,
			bankName: data.bankName as string | undefined,
			isDefault,
			processorToken: (data.providerToken as string) || 'pending',
			processorType: 'STRIPE'
		}
	});

	console.log(`[OwnerPortalWorkflow] ADD_PAYMENT_METHOD method:${method.id} party:${partyId} by user ${userId}`);
	return method.id;
}

async function setDefaultPayment(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const methodId = data.methodId as string;

	await prisma.$transaction([
		prisma.storedPaymentMethod.updateMany({
			where: { partyId, isDefault: true, deletedAt: null },
			data: { isDefault: false }
		}),
		prisma.storedPaymentMethod.update({
			where: { id: methodId },
			data: { isDefault: true }
		})
	]);

	console.log(`[OwnerPortalWorkflow] SET_DEFAULT_PAYMENT method:${methodId} party:${partyId} by user ${userId}`);
	return methodId;
}

async function configureAutoPay(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const methodId = data.methodId as string;
	const associationId = data.associationId as string;
	const unitId = data.unitId as string | undefined;

	// Find existing auto-pay setting
	const existing = await prisma.autoPaySetting.findFirst({
		where: {
			partyId,
			associationId,
			...(unitId ? { unitId } : {})
		}
	});

	let setting;
	if (existing) {
		setting = await prisma.autoPaySetting.update({
			where: { id: existing.id },
			data: {
				paymentMethodId: methodId,
				isEnabled: data.isEnabled as boolean ?? true,
				maxAmount: data.maxAmount as number | undefined,
				dayOfMonth: data.paymentDayOfMonth as number | undefined
			}
		});
	} else {
		setting = await prisma.autoPaySetting.create({
			data: {
				partyId,
				associationId,
				paymentMethodId: methodId,
				isEnabled: data.isEnabled as boolean ?? true,
				frequency: 'MONTHLY',
				maxAmount: data.maxAmount as number | undefined,
				dayOfMonth: data.paymentDayOfMonth as number | undefined
			}
		});
	}

	console.log(`[OwnerPortalWorkflow] CONFIGURE_AUTO_PAY setting:${setting.id} party:${partyId} by user ${userId}`);
	return setting.id;
}

async function grantDocumentAccess(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const documentId = data.documentId as string;
	const partyId = data.partyId as string;

	const grant = await prisma.documentAccessGrant.upsert({
		where: {
			documentId_partyId: {
				documentId,
				partyId
			}
		},
		update: {
			revokedAt: null,
			expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
			grantedBy: userId
		},
		create: {
			documentId,
			partyId,
			expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
			grantedBy: userId
		}
	});

	console.log(`[OwnerPortalWorkflow] GRANT_DOCUMENT_ACCESS grant:${grant.id} document:${documentId} party:${partyId} by user ${userId}`);
	return grant.id;
}

async function ownerPortalWorkflow(input: OwnerPortalWorkflowInput): Promise<OwnerPortalWorkflowResult> {
	try {
		let entityId: string;

		switch (input.action) {
			case 'CREATE_OWNER_REQUEST':
				entityId = await DBOS.runStep(
					() => createOwnerRequest(input.organizationId, input.userId, input.data),
					{ name: 'createOwnerRequest' }
				);
				break;

			case 'SUBMIT_OWNER_REQUEST':
				entityId = await DBOS.runStep(
					() => submitOwnerRequest(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'submitOwnerRequest' }
				);
				break;

			case 'UPDATE_REQUEST_STATUS':
				entityId = await DBOS.runStep(
					() => updateRequestStatus(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateRequestStatus' }
				);
				break;

			case 'LINK_WORK_ORDER':
				entityId = await DBOS.runStep(
					() => linkWorkOrder(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'linkWorkOrder' }
				);
				break;

			case 'ADD_PAYMENT_METHOD':
				entityId = await DBOS.runStep(
					() => addPaymentMethod(input.organizationId, input.userId, input.data),
					{ name: 'addPaymentMethod' }
				);
				break;

			case 'SET_DEFAULT_PAYMENT':
				entityId = await DBOS.runStep(
					() => setDefaultPayment(input.organizationId, input.userId, input.data),
					{ name: 'setDefaultPayment' }
				);
				break;

			case 'CONFIGURE_AUTO_PAY':
				entityId = await DBOS.runStep(
					() => configureAutoPay(input.organizationId, input.userId, input.data),
					{ name: 'configureAutoPay' }
				);
				break;

			case 'GRANT_DOCUMENT_ACCESS':
				entityId = await DBOS.runStep(
					() => grantDocumentAccess(input.organizationId, input.userId, input.data),
					{ name: 'grantDocumentAccess' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[OwnerPortalWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const ownerPortalWorkflow_v1 = DBOS.registerWorkflow(ownerPortalWorkflow);

export async function startOwnerPortalWorkflow(
	input: OwnerPortalWorkflowInput,
	idempotencyKey?: string
): Promise<OwnerPortalWorkflowResult> {
	const workflowId = idempotencyKey || `owner-portal-${input.action}-${input.entityId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(ownerPortalWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
