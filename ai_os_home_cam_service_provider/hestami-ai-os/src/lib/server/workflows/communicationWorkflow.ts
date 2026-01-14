import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
	CommunicationChannel,
	CommunicationTemplateType,
	DeliveryStatus,
	AnnouncementStatus,
	NotificationStatus,
	type EntityWorkflowResult
} from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { recordSpanError } from '../api/middleware/tracing.js';

const log = createWorkflowLogger('CommunicationWorkflow');

// Action types for communication operations
export const CommunicationAction = {
	CREATE_TEMPLATE: 'CREATE_TEMPLATE',
	CREATE_TEMPLATE_VERSION: 'CREATE_TEMPLATE_VERSION',
	ACTIVATE_TEMPLATE_VERSION: 'ACTIVATE_TEMPLATE_VERSION',
	CREATE_MASS_COMMUNICATION: 'CREATE_MASS_COMMUNICATION',
	CREATE_DELIVERY_LOG: 'CREATE_DELIVERY_LOG',
	UPDATE_DELIVERY_STATUS: 'UPDATE_DELIVERY_STATUS',
	CREATE_ANNOUNCEMENT: 'CREATE_ANNOUNCEMENT',
	MARK_ANNOUNCEMENT_READ: 'MARK_ANNOUNCEMENT_READ',
	CREATE_EVENT: 'CREATE_EVENT',
	CREATE_EVENT_NOTIFICATION: 'CREATE_EVENT_NOTIFICATION',
	UPDATE_EVENT_NOTIFICATION_STATUS: 'UPDATE_EVENT_NOTIFICATION_STATUS'
} as const;

export type CommunicationAction = (typeof CommunicationAction)[keyof typeof CommunicationAction];

export interface CommunicationWorkflowInput {
	action: CommunicationAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	data: {
		associationId?: string;
		name?: string;
		type?: CommunicationTemplateType | string;
		channel?: CommunicationChannel;
		subject?: string;
		body?: string;
		variables?: Prisma.InputJsonValue;
		templateId?: string;
		version?: string;
		status?: DeliveryStatus | AnnouncementStatus | NotificationStatus | string;
		scheduledAt?: string;
		scheduledFor?: string;
		recipientType?: string;
		recipientFilter?: Prisma.InputJsonValue;
		targetFilter?: Prisma.InputJsonValue;
		recipientCount?: number;
		recipientId?: string;
		recipient?: string;
		deliveryMethod?: string;
		deliveryAddress?: string;
		sentAt?: string;
		deliveredAt?: string;
		failedAt?: string;
		errorMessage?: string;
		title?: string;
		content?: string;
		priority?: string;
		expiresAt?: string;
		publishedAt?: string;
		targetAudience?: string;
		audienceFilter?: Prisma.InputJsonValue;
		audience?: Prisma.InputJsonValue;
		announcementId?: string;
		partyId?: string;
		eventType?: string;
		eventId?: string;
		userId?: string;
		notificationId?: string;
		notifyAt?: string;
		readAt?: string;
		dismissedAt?: string;
		massCommunicationId?: string;
		description?: string;
		location?: string;
		startTime?: string;
		endTime?: string;
		startsAt?: string;
		endsAt?: string;
		isAllDay?: boolean;
		payload?: Prisma.InputJsonValue;
		recurrenceRule?: string;
		metadata?: Prisma.InputJsonValue;
	};
}

export interface CommunicationWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each action

async function createTemplate(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const template = await prisma.communicationTemplate.create({
		data: {
			associationId: data.associationId as string,
			name: data.name as string,
			type: data.type as any,
			channel: data.channel as any,
			subject: data.subject as string | undefined,
			body: data.body as string,
			variables: data.variables as Prisma.InputJsonValue | undefined,
			createdBy: userId
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_TEMPLATE template:${template.id} by user ${userId}`);
	return template.id;
}

async function createTemplateVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const templateId = data.templateId as string;
	const versionStr = data.version as string;

	// Check for existing version (idempotency)
	const existing = await prisma.communicationTemplateVersion.findFirst({
		where: { templateId, version: versionStr }
	});
	if (existing) return existing.id;

	const version = await prisma.communicationTemplateVersion.create({
		data: {
			templateId,
			version: versionStr,
			subject: data.subject as string | undefined,
			body: data.body as string,
			variables: data.variables as Prisma.InputJsonValue | undefined,
			status: (data.status as any) || 'DRAFT',
			createdBy: userId
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_TEMPLATE_VERSION version:${version.id} template:${templateId} by user ${userId}`);
	return version.id;
}

async function activateTemplateVersion(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const templateId = data.templateId as string;
	const versionStr = data.version as string;

	const targetVersion = await prisma.communicationTemplateVersion.findFirst({
		where: { templateId, version: versionStr }
	});
	if (!targetVersion) throw new Error('Template version not found');

	// Retire all active versions and activate the target
	await prisma.$transaction([
		prisma.communicationTemplateVersion.updateMany({
			where: { templateId, status: 'ACTIVE' },
			data: { status: 'RETIRED' }
		}),
		prisma.communicationTemplateVersion.update({
			where: { id: targetVersion.id },
			data: { status: 'ACTIVE' }
		}),
		prisma.communicationTemplate.update({
			where: { id: templateId },
			data: { currentVersion: versionStr }
		})
	]);

	console.log(`[CommunicationWorkflow] ACTIVATE_TEMPLATE_VERSION template:${templateId} version:${versionStr} by user ${userId}`);
	return templateId;
}

async function createMassCommunication(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const comm = await prisma.massCommunication.create({
		data: {
			associationId: data.associationId as string,
			templateId: data.templateId as string | undefined,
			subject: data.subject as string | undefined,
			body: data.body as string,
			channel: data.channel as any,
			status: (data.status as any) || 'DRAFT',
			scheduledFor: data.scheduledFor ? new Date(data.scheduledFor as string) : undefined,
			targetFilter: data.targetFilter as Prisma.InputJsonValue | undefined,
			createdBy: userId
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_MASS_COMMUNICATION comm:${comm.id} by user ${userId}`);
	return comm.id;
}

async function createDeliveryLog(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const delivery = await prisma.massCommunicationDelivery.create({
		data: {
			massCommunicationId: data.massCommunicationId as string,
			recipient: data.recipient as string,
			channel: data.channel as any,
			status: (data.status as any) || 'PENDING',
			sentAt: data.sentAt ? new Date(data.sentAt as string) : undefined,
			errorMessage: data.errorMessage as string | undefined
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_DELIVERY_LOG delivery:${delivery.id} by user ${userId}`);
	return delivery.id;
}

async function updateDeliveryStatus(
	organizationId: string,
	userId: string,
	deliveryId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.massCommunicationDelivery.findUniqueOrThrow({
		where: { id: deliveryId }
	});

	const updated = await prisma.massCommunicationDelivery.update({
		where: { id: deliveryId },
		data: {
			status: data.status as any,
			sentAt: data.sentAt ? new Date(data.sentAt as string) : existing.sentAt,
			errorMessage: (data.errorMessage as string | undefined) ?? existing.errorMessage
		}
	});

	console.log(`[CommunicationWorkflow] UPDATE_DELIVERY_STATUS delivery:${deliveryId} status:${data.status} by user ${userId}`);
	return updated.id;
}

async function createAnnouncement(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const ann = await prisma.announcement.create({
		data: {
			associationId: data.associationId as string,
			title: data.title as string,
			content: data.content as string,
			status: (data.status as any) || 'DRAFT',
			publishedAt: data.publishedAt ? new Date(data.publishedAt as string) : undefined,
			expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
			audience: data.audience as Prisma.InputJsonValue | undefined,
			createdBy: userId
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_ANNOUNCEMENT announcement:${ann.id} by user ${userId}`);
	return ann.id;
}

async function markAnnouncementRead(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const announcementId = data.announcementId as string;
	const partyId = data.partyId as string;

	// Check for existing read (idempotency)
	const existing = await prisma.announcementRead.findFirst({
		where: { announcementId, partyId }
	});
	if (existing) return existing.id;

	const read = await prisma.announcementRead.create({
		data: {
			announcementId,
			partyId
		}
	});

	console.log(`[CommunicationWorkflow] MARK_ANNOUNCEMENT_READ announcement:${announcementId} party:${partyId} by user ${userId}`);
	return read.id;
}

async function createEvent(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const ev = await prisma.calendarEvent.create({
		data: {
			associationId: data.associationId as string,
			type: data.type as any,
			title: data.title as string,
			description: data.description as string | undefined,
			startsAt: new Date(data.startsAt as string),
			endsAt: data.endsAt ? new Date(data.endsAt as string) : undefined,
			location: data.location as string | undefined,
			recurrenceRule: data.recurrenceRule as string | undefined,
			notifyAt: data.notifyAt ? new Date(data.notifyAt as string) : undefined,
			metadata: data.metadata as Prisma.InputJsonValue | undefined,
			createdBy: userId
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_EVENT event:${ev.id} by user ${userId}`);
	return ev.id;
}

async function createEventNotification(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const notification = await prisma.calendarEventNotification.create({
		data: {
			associationId: data.associationId as string,
			eventId: data.eventId as string,
			notifyAt: new Date(data.notifyAt as string),
			status: 'PENDING',
			channel: data.channel as any | undefined,
			payload: data.payload as Prisma.InputJsonValue | undefined
		}
	});

	console.log(`[CommunicationWorkflow] CREATE_EVENT_NOTIFICATION notification:${notification.id} event:${data.eventId} by user ${userId}`);
	return notification.id;
}

async function updateEventNotificationStatus(
	organizationId: string,
	userId: string,
	notificationId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.calendarEventNotification.findUniqueOrThrow({
		where: { id: notificationId }
	});

	const updated = await prisma.calendarEventNotification.update({
		where: { id: notificationId },
		data: {
			status: data.status as any,
			sentAt: data.sentAt ? new Date(data.sentAt as string) : existing.sentAt,
			errorMessage: (data.errorMessage as string | undefined) ?? existing.errorMessage
		}
	});

	console.log(`[CommunicationWorkflow] UPDATE_EVENT_NOTIFICATION_STATUS notification:${notificationId} status:${data.status} by user ${userId}`);
	return updated.id;
}

// Main workflow function
async function communicationWorkflow(input: CommunicationWorkflowInput): Promise<CommunicationWorkflowResult> {
	try {
		let entityId: string;

		switch (input.action) {
			case 'CREATE_TEMPLATE':
				entityId = await DBOS.runStep(
					() => createTemplate(input.organizationId, input.userId, input.data),
					{ name: 'createTemplate' }
				);
				break;

			case 'CREATE_TEMPLATE_VERSION':
				entityId = await DBOS.runStep(
					() => createTemplateVersion(input.organizationId, input.userId, input.data),
					{ name: 'createTemplateVersion' }
				);
				break;

			case 'ACTIVATE_TEMPLATE_VERSION':
				entityId = await DBOS.runStep(
					() => activateTemplateVersion(input.organizationId, input.userId, input.data),
					{ name: 'activateTemplateVersion' }
				);
				break;

			case 'CREATE_MASS_COMMUNICATION':
				entityId = await DBOS.runStep(
					() => createMassCommunication(input.organizationId, input.userId, input.data),
					{ name: 'createMassCommunication' }
				);
				break;

			case 'CREATE_DELIVERY_LOG':
				entityId = await DBOS.runStep(
					() => createDeliveryLog(input.organizationId, input.userId, input.data),
					{ name: 'createDeliveryLog' }
				);
				break;

			case 'UPDATE_DELIVERY_STATUS':
				entityId = await DBOS.runStep(
					() => updateDeliveryStatus(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateDeliveryStatus' }
				);
				break;

			case 'CREATE_ANNOUNCEMENT':
				entityId = await DBOS.runStep(
					() => createAnnouncement(input.organizationId, input.userId, input.data),
					{ name: 'createAnnouncement' }
				);
				break;

			case 'MARK_ANNOUNCEMENT_READ':
				entityId = await DBOS.runStep(
					() => markAnnouncementRead(input.organizationId, input.userId, input.data),
					{ name: 'markAnnouncementRead' }
				);
				break;

			case 'CREATE_EVENT':
				entityId = await DBOS.runStep(
					() => createEvent(input.organizationId, input.userId, input.data),
					{ name: 'createEvent' }
				);
				break;

			case 'CREATE_EVENT_NOTIFICATION':
				entityId = await DBOS.runStep(
					() => createEventNotification(input.organizationId, input.userId, input.data),
					{ name: 'createEventNotification' }
				);
				break;

			case 'UPDATE_EVENT_NOTIFICATION_STATUS':
				entityId = await DBOS.runStep(
					() => updateEventNotificationStatus(input.organizationId, input.userId, input.entityId!, input.data),
					{ name: 'updateEventNotificationStatus' }
				);
				break;

			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		return { success: true, entityId };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[CommunicationWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'COMMUNICATION_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

// Versioned workflow export
export const communicationWorkflow_v1 = DBOS.registerWorkflow(communicationWorkflow);

// Helper to start the workflow with idempotency key
export async function startCommunicationWorkflow(
	input: CommunicationWorkflowInput,
	idempotencyKey: string
): Promise<CommunicationWorkflowResult> {
	const workflowId = idempotencyKey || `communication-${input.action}-${input.entityId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(communicationWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
