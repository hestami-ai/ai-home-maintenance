/**
 * Owner Portal Workflow (v1)
 *
 * DBOS durable workflow for owner portal operations.
 * Handles: owner requests, payment methods, auto-pay settings, document access grants.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('OwnerPortalWorkflow');

export const OwnerPortalAction = {
	CREATE_OWNER_REQUEST: 'CREATE_OWNER_REQUEST',
	SUBMIT_OWNER_REQUEST: 'SUBMIT_OWNER_REQUEST',
	UPDATE_REQUEST_STATUS: 'UPDATE_REQUEST_STATUS',
	LINK_WORK_ORDER: 'LINK_WORK_ORDER',
	ADD_PAYMENT_METHOD: 'ADD_PAYMENT_METHOD',
	SET_DEFAULT_PAYMENT: 'SET_DEFAULT_PAYMENT',
	DELETE_PAYMENT_METHOD: 'DELETE_PAYMENT_METHOD',
	CONFIGURE_AUTO_PAY: 'CONFIGURE_AUTO_PAY',
	DELETE_AUTO_PAY: 'DELETE_AUTO_PAY',
	GRANT_DOCUMENT_ACCESS: 'GRANT_DOCUMENT_ACCESS',
	REVOKE_DOCUMENT_ACCESS: 'REVOKE_DOCUMENT_ACCESS',
	LOG_DOCUMENT_DOWNLOAD: 'LOG_DOCUMENT_DOWNLOAD',
	UPSERT_USER_PROFILE: 'UPSERT_USER_PROFILE',
	DELETE_USER_PROFILE: 'DELETE_USER_PROFILE',
	UPSERT_CONTACT_PREFERENCE: 'UPSERT_CONTACT_PREFERENCE',
	DELETE_CONTACT_PREFERENCE: 'DELETE_CONTACT_PREFERENCE',
	UPSERT_NOTIFICATION_SETTING: 'UPSERT_NOTIFICATION_SETTING',
	DELETE_NOTIFICATION_SETTING: 'DELETE_NOTIFICATION_SETTING'
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

	// Create history record
	await prisma.ownerRequestHistory.create({
		data: {
			requestId: request.id,
			action: 'CREATED',
			newStatus: 'DRAFT',
			performedBy: userId
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

	// Create history record
	await prisma.ownerRequestHistory.create({
		data: {
			requestId,
			action: 'SUBMITTED',
			previousStatus: 'DRAFT',
			newStatus: 'SUBMITTED',
			performedBy: userId
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
	const previousStatus = data.previousStatus as string | undefined;
	const notes = data.notes as string | undefined;
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

	// Create history record
	await prisma.ownerRequestHistory.create({
		data: {
			requestId,
			action: status,
			previousStatus: previousStatus ?? null,
			newStatus: status,
			notes: notes ?? null,
			performedBy: userId
		}
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
	const workOrderId = data.workOrderId as string;
	const workOrderNumber = data.workOrderNumber as string | undefined;

	const updated = await prisma.ownerRequest.update({
		where: { id: requestId },
		data: { workOrderId }
	});

	// Create history record
	await prisma.ownerRequestHistory.create({
		data: {
			requestId,
			action: 'LINKED_TO_WORK_ORDER',
			notes: workOrderNumber ? `Linked to work order ${workOrderNumber}` : `Linked to work order ${workOrderId}`,
			performedBy: userId
		}
	});

	console.log(`[OwnerPortalWorkflow] LINK_WORK_ORDER request:${requestId} workOrder:${workOrderId} by user ${userId}`);
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

async function revokeDocumentAccess(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const grantId = data.grantId as string;
	const now = new Date();

	await prisma.documentAccessGrant.update({
		where: { id: grantId },
		data: { revokedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] REVOKE_DOCUMENT_ACCESS grant:${grantId} by user ${userId}`);
	return grantId;
}

async function logDocumentDownload(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const downloadLog = await prisma.documentDownloadLog.create({
		data: {
			documentId: data.documentId as string,
			partyId: data.partyId as string | undefined,
			userId,
			ipAddress: data.ipAddress as string | undefined,
			userAgent: data.userAgent as string | undefined
		}
	});

	console.log(`[OwnerPortalWorkflow] LOG_DOCUMENT_DOWNLOAD log:${downloadLog.id} document:${data.documentId} by user ${userId}`);
	return downloadLog.id;
}

async function deletePaymentMethod(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const methodId = data.methodId as string;
	const now = new Date();

	await prisma.storedPaymentMethod.update({
		where: { id: methodId },
		data: { deletedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] DELETE_PAYMENT_METHOD method:${methodId} by user ${userId}`);
	return methodId;
}

async function deleteAutoPay(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const autoPayId = data.autoPayId as string;
	const now = new Date();

	await prisma.autoPaySetting.update({
		where: { id: autoPayId },
		data: { deletedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] DELETE_AUTO_PAY setting:${autoPayId} by user ${userId}`);
	return autoPayId;
}

async function upsertUserProfile(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const profileData = {
		preferredName: data.preferredName as string | undefined,
		profilePhotoUrl: data.profilePhotoUrl as string | undefined,
		language: data.language as string | undefined,
		timezone: data.timezone as string | undefined,
		mailingAddress: data.mailingAddress as any
	};

	const profile = await prisma.userProfile.upsert({
		where: { partyId },
		create: {
			partyId,
			...profileData
		},
		update: profileData
	});

	console.log(`[OwnerPortalWorkflow] UPSERT_USER_PROFILE profile:${profile.id} party:${partyId} by user ${userId}`);
	return profile.id;
}

async function deleteUserProfile(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const now = new Date();

	const result = await prisma.userProfile.updateMany({
		where: { partyId, deletedAt: null },
		data: { deletedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] DELETE_USER_PROFILE party:${partyId} count:${result.count} by user ${userId}`);
	return partyId;
}

async function upsertContactPreference(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const channel = data.channel as any;

	const preference = await prisma.contactPreference.upsert({
		where: { partyId_channel: { partyId, channel } },
		create: {
			partyId,
			channel,
			isEnabled: data.isEnabled as boolean ?? true,
			allowTransactional: data.allowTransactional as boolean ?? true,
			allowMarketing: data.allowMarketing as boolean ?? false,
			allowEmergency: data.allowEmergency as boolean ?? true
		},
		update: {
			isEnabled: data.isEnabled as boolean ?? true,
			allowTransactional: data.allowTransactional as boolean ?? true,
			allowMarketing: data.allowMarketing as boolean ?? false,
			allowEmergency: data.allowEmergency as boolean ?? true
		}
	});

	console.log(`[OwnerPortalWorkflow] UPSERT_CONTACT_PREFERENCE preference:${preference.id} party:${partyId} channel:${channel} by user ${userId}`);
	return preference.id;
}

async function deleteContactPreference(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const channel = data.channel as any;
	const now = new Date();

	const result = await prisma.contactPreference.updateMany({
		where: { partyId, channel, deletedAt: null },
		data: { deletedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] DELETE_CONTACT_PREFERENCE party:${partyId} channel:${channel} count:${result.count} by user ${userId}`);
	return partyId;
}

async function upsertNotificationSetting(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const category = data.category as any;
	const channel = data.channel as any;

	const setting = await prisma.notificationSetting.upsert({
		where: {
			partyId_category_channel: { partyId, category, channel }
		},
		create: {
			partyId,
			category,
			channel,
			isEnabled: data.isEnabled as boolean ?? true
		},
		update: {
			isEnabled: data.isEnabled as boolean ?? true
		}
	});

	console.log(`[OwnerPortalWorkflow] UPSERT_NOTIFICATION_SETTING setting:${setting.id} party:${partyId} category:${category} channel:${channel} by user ${userId}`);
	return setting.id;
}

async function deleteNotificationSetting(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const partyId = data.partyId as string;
	const category = data.category as any;
	const channel = data.channel as any;
	const now = new Date();

	const result = await prisma.notificationSetting.updateMany({
		where: { partyId, category, channel, deletedAt: null },
		data: { deletedAt: now }
	});

	console.log(`[OwnerPortalWorkflow] DELETE_NOTIFICATION_SETTING party:${partyId} category:${category} channel:${channel} count:${result.count} by user ${userId}`);
	return partyId;
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

			case 'REVOKE_DOCUMENT_ACCESS':
				entityId = await DBOS.runStep(
					() => revokeDocumentAccess(input.organizationId, input.userId, input.data),
					{ name: 'revokeDocumentAccess' }
				);
				break;

			case 'LOG_DOCUMENT_DOWNLOAD':
				entityId = await DBOS.runStep(
					() => logDocumentDownload(input.organizationId, input.userId, input.data),
					{ name: 'logDocumentDownload' }
				);
				break;

			case 'DELETE_PAYMENT_METHOD':
				entityId = await DBOS.runStep(
					() => deletePaymentMethod(input.organizationId, input.userId, input.data),
					{ name: 'deletePaymentMethod' }
				);
				break;

			case 'DELETE_AUTO_PAY':
				entityId = await DBOS.runStep(
					() => deleteAutoPay(input.organizationId, input.userId, input.data),
					{ name: 'deleteAutoPay' }
				);
				break;

			case 'UPSERT_USER_PROFILE':
				entityId = await DBOS.runStep(
					() => upsertUserProfile(input.organizationId, input.userId, input.data),
					{ name: 'upsertUserProfile' }
				);
				break;

			case 'DELETE_USER_PROFILE':
				entityId = await DBOS.runStep(
					() => deleteUserProfile(input.organizationId, input.userId, input.data),
					{ name: 'deleteUserProfile' }
				);
				break;

			case 'UPSERT_CONTACT_PREFERENCE':
				entityId = await DBOS.runStep(
					() => upsertContactPreference(input.organizationId, input.userId, input.data),
					{ name: 'upsertContactPreference' }
				);
				break;

			case 'DELETE_CONTACT_PREFERENCE':
				entityId = await DBOS.runStep(
					() => deleteContactPreference(input.organizationId, input.userId, input.data),
					{ name: 'deleteContactPreference' }
				);
				break;

			case 'UPSERT_NOTIFICATION_SETTING':
				entityId = await DBOS.runStep(
					() => upsertNotificationSetting(input.organizationId, input.userId, input.data),
					{ name: 'upsertNotificationSetting' }
				);
				break;

			case 'DELETE_NOTIFICATION_SETTING':
				entityId = await DBOS.runStep(
					() => deleteNotificationSetting(input.organizationId, input.userId, input.data),
					{ name: 'deleteNotificationSetting' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[OwnerPortalWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'OWNER_PORTAL_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const ownerPortalWorkflow_v1 = DBOS.registerWorkflow(ownerPortalWorkflow);

export async function startOwnerPortalWorkflow(
	input: OwnerPortalWorkflowInput,
	idempotencyKey: string
): Promise<OwnerPortalWorkflowResult> {
	const workflowId = idempotencyKey || `owner-portal-${input.action}-${input.entityId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(ownerPortalWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
