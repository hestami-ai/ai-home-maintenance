/**
 * Phase 16.7: Case Communication Routes
 * 
 * Manages communications (emails, SMS, calls, etc.) tied to cases.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../router.js';
import { prisma } from '../../db.js';
import { recordExecution } from '../middleware/activityEvent.js';
import type { CommunicationChannel, CommunicationDirection } from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('CaseCommunicationRoute');

// =============================================================================
// Schemas
// =============================================================================

const CommunicationChannelSchema = z.enum(['EMAIL', 'SMS', 'LETTER']);
const CommunicationDirectionSchema = z.enum(['INBOUND', 'OUTBOUND', 'INTERNAL']);

const CaseCommunicationOutputSchema = z.object({
	id: z.string(),
	caseId: z.string(),
	channel: CommunicationChannelSchema,
	direction: CommunicationDirectionSchema,
	subject: z.string().nullable(),
	content: z.string(),
	fromUserId: z.string().nullable(),
	fromUserName: z.string().nullable(),
	toRecipient: z.string().nullable(),
	ccRecipients: z.string().nullable(),
	externalMessageId: z.string().nullable(),
	threadId: z.string().nullable(),
	sentAt: z.string().nullable(),
	deliveredAt: z.string().nullable(),
	readAt: z.string().nullable(),
	failedAt: z.string().nullable(),
	failureReason: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const CaseCommunicationListItemSchema = z.object({
	id: z.string(),
	channel: CommunicationChannelSchema,
	direction: CommunicationDirectionSchema,
	subject: z.string().nullable(),
	contentPreview: z.string(),
	fromUserName: z.string().nullable(),
	toRecipient: z.string().nullable(),
	sentAt: z.string().nullable(),
	createdAt: z.string()
});

// =============================================================================
// Helper Functions
// =============================================================================

function serializeCommunication(comm: any) {
	return {
		id: comm.id,
		caseId: comm.caseId,
		channel: comm.channel,
		direction: comm.direction,
		subject: comm.subject,
		content: comm.content,
		fromUserId: comm.fromUserId,
		fromUserName: comm.fromUser?.name || null,
		toRecipient: comm.toRecipient,
		ccRecipients: comm.ccRecipients,
		externalMessageId: comm.externalMessageId,
		threadId: comm.threadId,
		sentAt: comm.sentAt?.toISOString() ?? null,
		deliveredAt: comm.deliveredAt?.toISOString() ?? null,
		readAt: comm.readAt?.toISOString() ?? null,
		failedAt: comm.failedAt?.toISOString() ?? null,
		failureReason: comm.failureReason,
		createdAt: comm.createdAt.toISOString(),
		updatedAt: comm.updatedAt.toISOString()
	};
}

function serializeCommunicationListItem(comm: any) {
	return {
		id: comm.id,
		channel: comm.channel,
		direction: comm.direction,
		subject: comm.subject,
		contentPreview: comm.content.length > 100 ? comm.content.substring(0, 100) + '...' : comm.content,
		fromUserName: comm.fromUser?.name || null,
		toRecipient: comm.toRecipient,
		sentAt: comm.sentAt?.toISOString() ?? null,
		createdAt: comm.createdAt.toISOString()
	};
}

// =============================================================================
// Router
// =============================================================================

export const caseCommunicationRouter = {
	/**
	 * Create a new communication record
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string(),
				channel: CommunicationChannelSchema,
				direction: CommunicationDirectionSchema,
				subject: z.string().max(500).optional(),
				content: z.string().min(1),
				toRecipient: z.string().max(500).optional(),
				ccRecipients: z.string().max(1000).optional(),
				threadId: z.string().optional(),
				sentAt: z.string().datetime().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communication: CaseCommunicationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ConciergeCase not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case exists and belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			await context.cerbos.authorize('create', 'case_communication', 'new');

			const communication = await prisma.caseCommunication.create({
				data: {
					caseId: input.caseId,
					channel: input.channel as CommunicationChannel,
					direction: input.direction as CommunicationDirection,
					subject: input.subject,
					content: input.content,
					fromUserId: context.user.id,
					toRecipient: input.toRecipient,
					ccRecipients: input.ccRecipients,
					threadId: input.threadId,
					sentAt: input.sentAt ? new Date(input.sentAt) : new Date()
				},
				include: {
					fromUser: true
				}
			});

			await recordExecution(context, {
				entityType: 'CONCIERGE_CASE',
				entityId: input.caseId,
				action: 'CREATE',
				summary: `${input.direction} ${input.channel} ${input.subject ? `"${input.subject}"` : 'communication'} logged`,
				caseId: input.caseId,
				newState: {
					channel: input.channel,
					direction: input.direction,
					toRecipient: input.toRecipient
				}
			});

			return successResponse({ communication: serializeCommunication(communication) }, context);
		}),

	/**
	 * Get communication by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communication: CaseCommunicationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'CaseCommunication not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const communication = await prisma.caseCommunication.findFirst({
				where: { id: input.id },
				include: {
					fromUser: true,
					case: true
				}
			});

			if (!communication || communication.case?.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'CaseCommunication' });
			}

			await context.cerbos.authorize('view', 'case_communication', communication.id);

			return successResponse({ communication: serializeCommunication(communication) }, context);
		}),

	/**
	 * List communications for a case
	 */
	listByCase: orgProcedure
		.input(
			PaginationInputSchema.extend({
				caseId: z.string(),
				channel: CommunicationChannelSchema.optional(),
				direction: CommunicationDirectionSchema.optional(),
				threadId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communications: z.array(CaseCommunicationListItemSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ConciergeCase not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			await context.cerbos.authorize('view', 'case_communication', 'list');

			const limit = input.limit ?? 50;
			const communications = await prisma.caseCommunication.findMany({
				where: {
					caseId: input.caseId,
					...(input.channel && { channel: input.channel as CommunicationChannel }),
					...(input.direction && { direction: input.direction as CommunicationDirection }),
					...(input.threadId && { threadId: input.threadId })
				},
				include: {
					fromUser: true
				},
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = communications.length > limit;
			const items = hasMore ? communications.slice(0, -1) : communications;

			return successResponse(
				{
					communications: items.map(serializeCommunicationListItem),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Update communication (for marking as delivered/read or adding failure info)
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				deliveredAt: z.string().datetime().nullable().optional(),
				readAt: z.string().datetime().nullable().optional(),
				failedAt: z.string().datetime().nullable().optional(),
				failureReason: z.string().nullable().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					communication: CaseCommunicationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'CaseCommunication not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.caseCommunication.findFirst({
				where: { id: input.id },
				include: {
					case: true
				}
			});

			if (!existing || existing.case?.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'CaseCommunication' });
			}

			await context.cerbos.authorize('update', 'case_communication', existing.id);

			const communication = await prisma.caseCommunication.update({
				where: { id: input.id },
				data: {
					...(input.deliveredAt !== undefined && {
						deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null
					}),
					...(input.readAt !== undefined && {
						readAt: input.readAt ? new Date(input.readAt) : null
					}),
					...(input.failedAt !== undefined && {
						failedAt: input.failedAt ? new Date(input.failedAt) : null
					}),
					...(input.failureReason !== undefined && { failureReason: input.failureReason })
				},
				include: {
					fromUser: true
				}
			});

			return successResponse({ communication: serializeCommunication(communication) }, context);
		}),

	/**
	 * Get communication threads for a case
	 */
	getThreads: orgProcedure
		.input(z.object({ caseId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					threads: z.array(
						z.object({
							threadId: z.string().nullable(),
							messageCount: z.number(),
							lastMessageAt: z.string(),
							subject: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ConciergeCase not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify case belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id
				}
			});

			if (!caseRecord) {
				throw errors.NOT_FOUND({ message: 'ConciergeCase' });
			}

			await context.cerbos.authorize('view', 'case_communication', 'list');

			// Get thread summaries
			const threads = await prisma.caseCommunication.groupBy({
				by: ['threadId'],
				where: { caseId: input.caseId },
				_count: { id: true },
				_max: { createdAt: true }
			});

			// Get subjects for each thread
			const threadDetails = await Promise.all(
				threads.map(async (thread) => {
					const firstMessage = await prisma.caseCommunication.findFirst({
						where: {
							caseId: input.caseId,
							threadId: thread.threadId
						},
						orderBy: { createdAt: 'asc' },
						select: { subject: true }
					});

					return {
						threadId: thread.threadId,
						messageCount: thread._count.id,
						lastMessageAt: thread._max.createdAt?.toISOString() || new Date().toISOString(),
						subject: firstMessage?.subject || null
					};
				})
			);

			return successResponse({ threads: threadDetails }, context);
		})
};
