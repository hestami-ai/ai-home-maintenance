import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { startCommunicationWorkflow } from '../../../workflows/communicationWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('CommunicationRoute');
import type {
	CommunicationTemplateType,
	CommunicationChannel,
	CommunicationStatus,
	AnnouncementStatus,
	CalendarEventType,
	TemplateVersionStatus,
	NotificationStatus,
	DeliveryStatus,
	Prisma
} from '../../../../../../generated/prisma/client.js';

const templateTypeEnum = z.enum(['EMAIL', 'SMS', 'LETTER']);
const channelEnum = z.enum(['EMAIL', 'SMS', 'LETTER']);
const commStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED']);
const announcementStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const eventTypeEnum = z.enum(['MEETING', 'MAINTENANCE', 'AMENITY_CLOSURE', 'OTHER']);
const deliveryStatusEnum = z.enum(['PENDING', 'SENT', 'FAILED']);
const notificationStatusEnum = z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']);

const ensureAssociation = async (associationId: string, organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { id: associationId, organizationId }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string, errors: any) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw errors.NOT_FOUND({ message: 'Party' });
};

export const communicationRouter = {
	// Templates
	createTemplate: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					name: z.string().min(1).max(255),
					type: templateTypeEnum,
					channel: channelEnum,
					subject: z.string().max(500).optional(),
					body: z.string().min(1),
					variables: z.record(z.string(), JsonSchema).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					template: z.object({
						id: z.string(),
						associationId: z.string(),
						name: z.string(),
						type: z.string(),
						channel: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'communication_template', input.associationId);
			await ensureAssociation(input.associationId, context.organization.id, errors);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_TEMPLATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						name: input.name,
						type: input.type,
						channel: input.channel,
						subject: input.subject,
						body: input.body,
						variables: input.variables
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create template' });
			}

			const template = await prisma.communicationTemplate.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					template: {
						id: template.id,
						associationId: template.associationId,
						name: template.name,
						type: template.type,
						channel: template.channel
					}
				},
				context
			);
		}),

	listTemplates: orgProcedure
		.input(PaginationInputSchema.extend({ associationId: z.string().optional() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					templates: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), channel: z.string(), createdAt: z.coerce.date() })),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = { association: { organizationId: context.organization.id }, associationId: input.associationId };
			const items = await prisma.communicationTemplate.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					templates: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	getTemplate: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ template: z.object({ id: z.string(), name: z.string(), type: z.string(), channel: z.string(), body: z.string(), subject: z.string().nullable(), currentVersion: z.string().nullable() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const template = await prisma.communicationTemplate.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					versions: { orderBy: { createdAt: 'desc' } }
				}
			});
			if (!template || template.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Template' });
			}
			await context.cerbos.authorize('view', 'communication_template', template.id);
			return successResponse({ template }, context);
		}),

	// Template Versions
	createTemplateVersion: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					templateId: z.string(),
					version: z.string().min(1),
					subject: z.string().max(500).optional(),
					body: z.string().min(1),
					variables: z.record(z.string(), JsonSchema).optional(),
					status: z.enum(['DRAFT', 'ACTIVE', 'RETIRED']).default('DRAFT')
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					version: z.object({
						id: z.string(),
						templateId: z.string(),
						version: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'communication_template', input.templateId);

			const template = await prisma.communicationTemplate.findFirst({
				where: { id: input.templateId },
				include: { association: true }
			});
			if (!template || template.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Template' });
			}

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_TEMPLATE_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						templateId: input.templateId,
						version: input.version,
						subject: input.subject,
						body: input.body,
						variables: input.variables,
						status: input.status
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create template version' });
			}

			const version = await prisma.communicationTemplateVersion.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					version: {
						id: version.id,
						templateId: version.templateId,
						version: version.version,
						status: version.status
					}
				},
				context
			);
		}),

	activateTemplateVersion: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					templateId: z.string(),
					version: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					template: z.object({
						id: z.string(),
						currentVersion: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'communication_template', input.templateId);

			const tpl = await prisma.communicationTemplate.findFirst({
				where: { id: input.templateId },
				include: { association: true }
			});
			if (!tpl || tpl.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Template' });
			}

			const targetVersion = await prisma.communicationTemplateVersion.findFirst({
				where: { templateId: input.templateId, version: input.version }
			});
			if (!targetVersion) throw errors.NOT_FOUND({ message: 'Template version' });

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'ACTIVATE_TEMPLATE_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						templateId: input.templateId,
						version: input.version
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to activate template version' });
			}

			const template = await prisma.communicationTemplate.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					template: {
						id: template.id,
						currentVersion: template.currentVersion ?? null
					}
				},
				context
			);
		}),

	// Mass Communications
	createMassCommunication: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					templateId: z.string().optional(),
					subject: z.string().max(500).optional(),
					body: z.string().min(1),
					channel: channelEnum,
					status: commStatusEnum.default('DRAFT'),
					scheduledFor: z.string().datetime().optional(),
					targetFilter: z.record(z.string(), JsonSchema).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communication: z.object({
						id: z.string(),
						associationId: z.string(),
						status: z.string(),
						channel: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'communication_mass', input.associationId);
			await ensureAssociation(input.associationId, context.organization.id, errors);

			if (input.templateId) {
				const template = await prisma.communicationTemplate.findFirst({
					where: { id: input.templateId, associationId: input.associationId }
				});
				if (!template) throw errors.NOT_FOUND({ message: 'Template' });
			}

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_MASS_COMMUNICATION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						templateId: input.templateId,
						subject: input.subject,
						body: input.body,
						channel: input.channel,
						status: input.status,
						scheduledFor: input.scheduledFor,
						targetFilter: input.targetFilter
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create mass communication' });
			}

			const comm = await prisma.massCommunication.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					communication: {
						id: comm.id,
						associationId: comm.associationId,
						status: comm.status,
						channel: comm.channel
					}
				},
				context
			);
		}),

	listMassCommunications: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: commStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communications: z.array(z.object({ id: z.string(), associationId: z.string(), status: z.string(), channel: z.string(), createdAt: z.coerce.date() })),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				status: input.status as CommunicationStatus | undefined
			};
			const items = await prisma.massCommunication.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					communications: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	getMassCommunication: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ communication: z.object({ id: z.string(), associationId: z.string(), status: z.string(), channel: z.string(), body: z.string(), subject: z.string().nullable() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const comm = await prisma.massCommunication.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					deliveries: true,
					template: true
				}
			});
			if (!comm || comm.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Mass communication' });
			}
			await context.cerbos.authorize('view', 'communication_mass', comm.id);
			return successResponse({ communication: comm }, context);
		}),

	// Mass Communication Deliveries (tracking)
	createDeliveryLog: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					massCommunicationId: z.string(),
					recipient: z.string().min(1),
					channel: channelEnum,
					status: deliveryStatusEnum.default('PENDING'),
					sentAt: z.string().datetime().optional(),
					errorMessage: z.string().max(2000).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delivery: z.object({
						id: z.string(),
						massCommunicationId: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'communication_mass', input.massCommunicationId);

			const comm = await prisma.massCommunication.findFirst({
				where: { id: input.massCommunicationId },
				include: { association: true }
			});
			if (!comm || comm.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Mass communication' });
			}

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_DELIVERY_LOG',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						massCommunicationId: input.massCommunicationId,
						recipient: input.recipient,
						channel: input.channel,
						status: input.status,
						sentAt: input.sentAt,
						errorMessage: input.errorMessage
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create delivery log' });
			}

			const delivery = await prisma.massCommunicationDelivery.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					delivery: {
						id: delivery.id,
						massCommunicationId: delivery.massCommunicationId,
						status: delivery.status
					}
				},
				context
			);
		}),

	updateDeliveryStatus: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					deliveryId: z.string(),
					status: deliveryStatusEnum,
					sentAt: z.string().datetime().optional(),
					errorMessage: z.string().max(2000).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					delivery: z.object({
						id: z.string(),
						status: z.string(),
						sentAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.massCommunicationDelivery.findFirst({
				where: { id: input.deliveryId },
				include: { massCommunication: { include: { association: true } } }
			});
			if (
				!existing ||
				existing.massCommunication.association.organizationId !== context.organization.id
			) {
				throw errors.NOT_FOUND({ message: 'Delivery' });
			}

			await context.cerbos.authorize('edit', 'communication_mass', existing.massCommunication.id);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'UPDATE_DELIVERY_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.deliveryId,
					data: {
						status: input.status,
						sentAt: input.sentAt,
						errorMessage: input.errorMessage
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update delivery status' });
			}

			const delivery = await prisma.massCommunicationDelivery.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					delivery: {
						id: delivery.id,
						status: delivery.status,
						sentAt: delivery.sentAt ? delivery.sentAt.toISOString() : null
					}
				},
				context
			);
		}),

	// Announcements
	createAnnouncement: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					title: z.string().min(1).max(255),
					content: z.string().min(1),
					status: announcementStatusEnum.default('DRAFT'),
					publishedAt: z.string().datetime().optional(),
					expiresAt: z.string().datetime().optional(),
					audience: z.record(z.string(), JsonSchema).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ announcement: z.object({ id: z.string(), associationId: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'communication_announcement', input.associationId);
			await ensureAssociation(input.associationId, context.organization.id, errors);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_ANNOUNCEMENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						title: input.title,
						content: input.content,
						status: input.status,
						publishedAt: input.publishedAt,
						expiresAt: input.expiresAt,
						audience: input.audience
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create announcement' });
			}

			const ann = await prisma.announcement.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{ announcement: { id: ann.id, associationId: ann.associationId, status: ann.status } },
				context
			);
		}),

	listAnnouncements: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: announcementStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ announcements: z.array(z.object({ id: z.string(), associationId: z.string(), title: z.string(), status: z.string(), createdAt: z.coerce.date() })), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				status: input.status as AnnouncementStatus | undefined
			};
			const items = await prisma.announcement.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					announcements: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	getAnnouncement: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ announcement: z.object({ id: z.string(), associationId: z.string(), title: z.string(), content: z.string(), status: z.string() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const ann = await prisma.announcement.findFirst({
				where: { id: input.id },
				include: { association: true, reads: true }
			});
			if (!ann || ann.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Announcement' });
			}
			await context.cerbos.authorize('view', 'communication_announcement', ann.id);
			return successResponse({ announcement: ann }, context);
		}),

	markAnnouncementRead: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					announcementId: z.string(),
					partyId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					read: z.object({
						id: z.string(),
						announcementId: z.string(),
						partyId: z.string(),
						readAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'communication_announcement', input.announcementId);

			const ann = await prisma.announcement.findFirst({
				where: { id: input.announcementId },
				include: { association: true }
			});
			if (!ann || ann.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Announcement' });
			}
			await ensurePartyBelongs(input.partyId, ann.association.organizationId, errors);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'MARK_ANNOUNCEMENT_READ',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						announcementId: input.announcementId,
						partyId: input.partyId
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to mark announcement read' });
			}

			const read = await prisma.announcementRead.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					read: {
						id: read.id,
						announcementId: read.announcementId,
						partyId: read.partyId,
						readAt: read.readAt.toISOString()
					}
				},
				context
			);
		}),

	// Calendar Events
	createEvent: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					type: eventTypeEnum,
					title: z.string().min(1).max(255),
					description: z.string().max(5000).optional(),
					startsAt: z.string().datetime(),
					endsAt: z.string().datetime().optional(),
					location: z.string().max(500).optional(),
					recurrenceRule: z.string().max(2000).optional(),
					notifyAt: z.string().datetime().optional(),
					metadata: z.record(z.string(), JsonSchema).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ event: z.object({ id: z.string(), associationId: z.string(), type: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'communication_event', input.associationId);
			await ensureAssociation(input.associationId, context.organization.id, errors);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_EVENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						type: input.type,
						title: input.title,
						description: input.description,
						startsAt: input.startsAt,
						endsAt: input.endsAt,
						location: input.location,
						recurrenceRule: input.recurrenceRule,
						notifyAt: input.notifyAt,
						metadata: input.metadata
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create event' });
			}

			const ev = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{ event: { id: ev.id, associationId: ev.associationId, type: ev.type } },
				context
			);
		}),

	listEvents: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				type: eventTypeEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ events: z.array(z.object({ id: z.string(), associationId: z.string(), type: z.string(), title: z.string(), startsAt: z.coerce.date() })), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				type: input.type as CalendarEventType | undefined
			};
			const items = await prisma.calendarEvent.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { startsAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					events: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	getEvent: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ event: z.object({ id: z.string(), associationId: z.string(), type: z.string(), title: z.string(), description: z.string().nullable(), startsAt: z.coerce.date() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const ev = await prisma.calendarEvent.findFirst({
				where: { id: input.id },
				include: { association: true }
			});
			if (!ev || ev.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Event' });
			}
			await context.cerbos.authorize('view', 'communication_event', ev.id);
			return successResponse({ event: ev }, context);
		}),

	// Event notifications (stubs)
	createEventNotification: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					eventId: z.string(),
					notifyAt: z.string().datetime().optional(),
					channel: channelEnum.optional(),
					payload: z.record(z.string(), JsonSchema).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notification: z.object({
						id: z.string(),
						eventId: z.string(),
						status: z.string(),
						notifyAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'communication_event', input.eventId);

			const event = await prisma.calendarEvent.findFirst({
				where: { id: input.eventId },
				include: { association: true }
			});
			if (!event || event.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Event' });
			}

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'CREATE_EVENT_NOTIFICATION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: event.associationId,
						eventId: input.eventId,
						notifyAt: input.notifyAt || event.notifyAt?.toISOString() || new Date().toISOString(),
						channel: input.channel,
						payload: input.payload
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create event notification' });
			}

			const notification = await prisma.calendarEventNotification.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					notification: {
						id: notification.id,
						eventId: notification.eventId,
						status: notification.status,
						notifyAt: notification.notifyAt.toISOString()
					}
				},
				context
			);
		}),

	updateEventNotificationStatus: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					notificationId: z.string(),
					status: notificationStatusEnum,
					sentAt: z.string().datetime().optional(),
					errorMessage: z.string().max(2000).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notification: z.object({
						id: z.string(),
						status: z.string(),
						sentAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.calendarEventNotification.findFirst({
				where: { id: input.notificationId },
				include: { association: true, event: true }
			});
			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Notification' });
			}
			await context.cerbos.authorize('edit', 'communication_event', existing.eventId);

			const workflowResult = await startCommunicationWorkflow(
				{
					action: 'UPDATE_EVENT_NOTIFICATION_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.notificationId,
					data: {
						status: input.status,
						sentAt: input.sentAt,
						errorMessage: input.errorMessage
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update notification status' });
			}

			const notif = await prisma.calendarEventNotification.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{
					notification: {
						id: notif.id,
						status: notif.status,
						sentAt: notif.sentAt ? notif.sentAt.toISOString() : null
					}
				},
				context
			);
		}),

	listEventNotifications: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				eventId: z.string().optional(),
				status: notificationStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ notifications: z.array(z.object({ id: z.string(), eventId: z.string(), status: z.string(), notifyAt: z.coerce.date() })), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				eventId: input.eventId,
				status: input.status as NotificationStatus | undefined
			};
			const items = await prisma.calendarEventNotification.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { notifyAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					notifications: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		})
};
