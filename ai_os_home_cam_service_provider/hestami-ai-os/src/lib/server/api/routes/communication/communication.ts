import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
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
import type { RequestContext } from '../../context.js';

const templateTypeEnum = z.enum(['EMAIL', 'SMS', 'LETTER']);
const channelEnum = z.enum(['EMAIL', 'SMS', 'LETTER']);
const commStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED']);
const announcementStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const eventTypeEnum = z.enum(['MEETING', 'MAINTENANCE', 'AMENITY_CLOSURE', 'OTHER']);
const deliveryStatusEnum = z.enum(['PENDING', 'SENT', 'FAILED']);
const notificationStatusEnum = z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']);

const requireIdempotency = async <T>(key: string | undefined, ctx: RequestContext, fn: () => Promise<T>) => {
	if (!key) throw ApiException.badRequest('Idempotency key is required');
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

const ensureAssociation = async (associationId: string, organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { id: associationId, organizationId }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw ApiException.notFound('Party');
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
					variables: z.record(z.string(), z.any()).optional()
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'communication_template', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const template = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				return prisma.communicationTemplate.create({
					data: {
						associationId: rest.associationId,
						name: rest.name,
						type: rest.type as CommunicationTemplateType,
						channel: rest.channel as CommunicationChannel,
						subject: rest.subject,
						body: rest.body,
						variables: rest.variables as Prisma.InputJsonValue | undefined
					}
				});
			});

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
					templates: z.array(z.any()),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
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
				data: z.object({ template: z.any() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const template = await prisma.communicationTemplate.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					versions: { orderBy: { createdAt: 'desc' } }
				}
			});
			if (!template || template.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Template');
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
					variables: z.record(z.string(), z.any()).optional(),
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'communication_template', input.templateId);
			const { idempotencyKey, ...rest } = input;

			const version = await requireIdempotency(idempotencyKey, context, async () => {
				const template = await prisma.communicationTemplate.findFirst({
					where: { id: rest.templateId },
					include: { association: true }
				});
				if (!template || template.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Template');
				}

				const existing = await prisma.communicationTemplateVersion.findFirst({
					where: { templateId: rest.templateId, version: rest.version }
				});
				if (existing) return existing;

				return prisma.communicationTemplateVersion.create({
					data: {
						templateId: rest.templateId,
						version: rest.version,
						subject: rest.subject,
						body: rest.body,
						variables: rest.variables as Prisma.InputJsonValue | undefined,
						status: rest.status as TemplateVersionStatus,
						createdBy: context.user?.id
					}
				});
			});

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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'communication_template', input.templateId);
			const { idempotencyKey, ...rest } = input;

			const template = await requireIdempotency(idempotencyKey, context, async () => {
				const tpl = await prisma.communicationTemplate.findFirst({
					where: { id: rest.templateId },
					include: { association: true }
				});
				if (!tpl || tpl.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Template');
				}

				const targetVersion = await prisma.communicationTemplateVersion.findFirst({
					where: { templateId: rest.templateId, version: rest.version }
				});
				if (!targetVersion) throw ApiException.notFound('Template version');

				await prisma.communicationTemplateVersion.updateMany({
					where: { templateId: rest.templateId, status: 'ACTIVE' },
					data: { status: 'RETIRED' }
				});

				await prisma.communicationTemplateVersion.update({
					where: { id: targetVersion.id },
					data: { status: 'ACTIVE' }
				});

				const updatedTemplate = await prisma.communicationTemplate.update({
					where: { id: rest.templateId },
					data: { currentVersion: rest.version }
				});

				return updatedTemplate;
			});

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
					targetFilter: z.record(z.string(), z.any()).optional()
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'communication_mass', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const comm = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				if (rest.templateId) {
					const template = await prisma.communicationTemplate.findFirst({
						where: { id: rest.templateId, associationId: rest.associationId }
					});
					if (!template) throw ApiException.notFound('Template');
				}
				return prisma.massCommunication.create({
					data: {
						associationId: rest.associationId,
						templateId: rest.templateId,
						subject: rest.subject,
						body: rest.body,
						channel: rest.channel as CommunicationChannel,
						status: rest.status as CommunicationStatus,
						scheduledFor: rest.scheduledFor ? new Date(rest.scheduledFor) : undefined,
						targetFilter: rest.targetFilter as Prisma.InputJsonValue | undefined,
						createdBy: context.user?.id
					}
				});
			});

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
					communications: z.array(z.any()),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
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
				data: z.object({ communication: z.any() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const comm = await prisma.massCommunication.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					deliveries: true,
					template: true
				}
			});
			if (!comm || comm.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Mass communication');
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'communication_mass', input.massCommunicationId);
			const { idempotencyKey, ...rest } = input;

			const delivery = await requireIdempotency(idempotencyKey, context, async () => {
				const comm = await prisma.massCommunication.findFirst({
					where: { id: rest.massCommunicationId },
					include: { association: true }
				});
				if (!comm || comm.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Mass communication');
				}

				return prisma.massCommunicationDelivery.create({
					data: {
						massCommunicationId: rest.massCommunicationId,
						recipient: rest.recipient,
						channel: rest.channel as CommunicationChannel,
						status: rest.status as DeliveryStatus,
						sentAt: rest.sentAt ? new Date(rest.sentAt) : undefined,
						errorMessage: rest.errorMessage
					}
				});
			});

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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const { idempotencyKey, ...rest } = input;

			const delivery = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.massCommunicationDelivery.findFirst({
					where: { id: rest.deliveryId },
					include: { massCommunication: { include: { association: true } } }
				});
				if (
					!existing ||
					existing.massCommunication.association.organizationId !== context.organization.id
				) {
					throw ApiException.notFound('Delivery');
				}

				await context.cerbos.authorize('edit', 'communication_mass', existing.massCommunication.id);

				const updated = await prisma.massCommunicationDelivery.update({
					where: { id: rest.deliveryId },
					data: {
						status: rest.status as DeliveryStatus,
						sentAt: rest.sentAt ? new Date(rest.sentAt) : existing.sentAt,
						errorMessage: rest.errorMessage ?? existing.errorMessage
					}
				});

				return updated;
			});

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
					audience: z.record(z.string(), z.any()).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ announcement: z.object({ id: z.string(), associationId: z.string(), status: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'communication_announcement', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const ann = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				return prisma.announcement.create({
					data: {
						associationId: rest.associationId,
						title: rest.title,
						content: rest.content,
						status: rest.status as AnnouncementStatus,
						publishedAt: rest.publishedAt ? new Date(rest.publishedAt) : undefined,
						expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : undefined,
						audience: rest.audience as Prisma.InputJsonValue | undefined,
						createdBy: context.user?.id
					}
				});
			});

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
				data: z.object({ announcements: z.array(z.any()), pagination: PaginationOutputSchema }),
				meta: z.any()
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
				data: z.object({ announcement: z.any() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const ann = await prisma.announcement.findFirst({
				where: { id: input.id },
				include: { association: true, reads: true }
			});
			if (!ann || ann.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Announcement');
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const { idempotencyKey, ...rest } = input;
			await context.cerbos.authorize('view', 'communication_announcement', rest.announcementId);

			const read = await requireIdempotency(idempotencyKey, context, async () => {
				const ann = await prisma.announcement.findFirst({
					where: { id: rest.announcementId },
					include: { association: true }
				});
				if (!ann || ann.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Announcement');
				}
				await ensurePartyBelongs(rest.partyId, ann.association.organizationId);

				const existing = await prisma.announcementRead.findFirst({
					where: { announcementId: rest.announcementId, partyId: rest.partyId }
				});
				if (existing) return existing;

				return prisma.announcementRead.create({
					data: {
						announcementId: rest.announcementId,
						partyId: rest.partyId
					}
				});
			});

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
					metadata: z.record(z.string(), z.any()).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ event: z.object({ id: z.string(), associationId: z.string(), type: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'communication_event', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const ev = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				return prisma.calendarEvent.create({
					data: {
						associationId: rest.associationId,
						type: rest.type as CalendarEventType,
						title: rest.title,
						description: rest.description,
						startsAt: new Date(rest.startsAt),
						endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
						location: rest.location,
						recurrenceRule: rest.recurrenceRule,
						notifyAt: rest.notifyAt ? new Date(rest.notifyAt) : undefined,
						metadata: rest.metadata as Prisma.InputJsonValue | undefined,
						createdBy: context.user?.id
					}
				});
			});

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
				data: z.object({ events: z.array(z.any()), pagination: PaginationOutputSchema }),
				meta: z.any()
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
				data: z.object({ event: z.any() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const ev = await prisma.calendarEvent.findFirst({
				where: { id: input.id },
				include: { association: true }
			});
			if (!ev || ev.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Event');
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
					payload: z.record(z.string(), z.any()).optional()
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const { idempotencyKey, ...rest } = input;
			await context.cerbos.authorize('edit', 'communication_event', rest.eventId);

			const notification = await requireIdempotency(idempotencyKey, context, async () => {
				const event = await prisma.calendarEvent.findFirst({
					where: { id: rest.eventId },
					include: { association: true }
				});
				if (!event || event.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Event');
				}

				return prisma.calendarEventNotification.create({
					data: {
						associationId: event.associationId,
						eventId: rest.eventId,
						notifyAt: rest.notifyAt ? new Date(rest.notifyAt) : event.notifyAt ?? new Date(),
						status: 'PENDING',
						channel: rest.channel as CommunicationChannel | undefined,
						payload: rest.payload as Prisma.InputJsonValue | undefined
					}
				});
			});

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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const { idempotencyKey, ...rest } = input;

			const notif = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.calendarEventNotification.findFirst({
					where: { id: rest.notificationId },
					include: { association: true, event: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Notification');
				}
				await context.cerbos.authorize('edit', 'communication_event', existing.eventId);

				return prisma.calendarEventNotification.update({
					where: { id: rest.notificationId },
					data: {
						status: rest.status as NotificationStatus,
						sentAt: rest.sentAt ? new Date(rest.sentAt) : existing.sentAt,
						errorMessage: rest.errorMessage ?? existing.errorMessage
					}
				});
			});

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
				data: z.object({ notifications: z.array(z.any()), pagination: PaginationOutputSchema }),
				meta: z.any()
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
