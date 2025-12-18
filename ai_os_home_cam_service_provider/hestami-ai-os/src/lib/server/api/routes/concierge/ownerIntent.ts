import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { OwnerIntentCategorySchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentCategorySchema.js';
import { OwnerIntentPrioritySchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentPrioritySchema.js';
import { OwnerIntentStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentStatusSchema.js';
import { Prisma } from '../../../../../../generated/prisma/client.js';
import { recordIntent, recordExecution, recordDecision } from '../../middleware/activityEvent.js';

/**
 * Owner Intent management procedures for Phase 3 Concierge Platform
 */
export const ownerIntentRouter = {
	/**
	 * Create a new owner intent (draft)
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				title: z.string().min(1).max(255),
				description: z.string().min(1),
				category: OwnerIntentCategorySchema,
				priority: OwnerIntentPrioritySchema.optional(),
				constraints: z.record(z.string(), z.unknown()).optional(),
				attachments: z.array(z.string()).optional(),
				submittedByPartyId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						propertyId: z.string(),
						title: z.string(),
						category: z.string(),
						priority: z.string(),
						status: z.string(),
						createdAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'owner_intent', 'new');

			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw ApiException.notFound('IndividualProperty');
			}

			// Verify submitter party if provided
			if (input.submittedByPartyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.submittedByPartyId, organizationId: context.organization.id }
				});
				if (!party) {
					throw ApiException.notFound('Party');
				}
			}

			const intent = await prisma.ownerIntent.create({
				data: {
					organizationId: context.organization.id,
					propertyId: input.propertyId,
					title: input.title,
					description: input.description,
					category: input.category,
					priority: input.priority ?? 'NORMAL',
					status: 'DRAFT',
					constraints: (input.constraints ?? undefined) as Prisma.InputJsonValue | undefined,
					attachments: input.attachments,
					submittedByPartyId: input.submittedByPartyId
				}
			});

			// Record activity event
			await recordIntent(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'CREATE',
				summary: `Owner intent created: ${intent.title}`,
				intentId: intent.id,
				propertyId: input.propertyId,
				newState: {
					title: intent.title,
					category: intent.category,
					priority: intent.priority,
					status: intent.status
				}
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						propertyId: intent.propertyId,
						title: intent.title,
						category: intent.category,
						priority: intent.priority,
						status: intent.status,
						createdAt: intent.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get intent by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						propertyId: z.string(),
						title: z.string(),
						description: z.string(),
						category: z.string(),
						priority: z.string(),
						status: z.string(),
						constraints: z.record(z.string(), z.unknown()).nullable(),
						attachments: z.array(z.string()).nullable(),
						submittedByPartyId: z.string().nullable(),
						submittedAt: z.string().nullable(),
						acknowledgedAt: z.string().nullable(),
						acknowledgedBy: z.string().nullable(),
						convertedCaseId: z.string().nullable(),
						convertedAt: z.string().nullable(),
						declinedAt: z.string().nullable(),
						declineReason: z.string().nullable(),
						withdrawnAt: z.string().nullable(),
						withdrawReason: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					property: z.object({
						id: z.string(),
						name: z.string(),
						addressLine1: z.string()
					}),
					submittedByParty: z
						.object({
							id: z.string(),
							displayName: z.string()
						})
						.nullable()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const intent = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				},
				include: {
					property: true,
					submittedByParty: true
				}
			});

			if (!intent) {
				throw ApiException.notFound('OwnerIntent');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'owner_intent', intent.id, {
				partyUserId: intent.submittedByParty?.userId ?? undefined
			});

			const submitterDisplayName = intent.submittedByParty
				? intent.submittedByParty.partyType === 'INDIVIDUAL'
					? `${intent.submittedByParty.firstName ?? ''} ${intent.submittedByParty.lastName ?? ''}`.trim()
					: intent.submittedByParty.entityName ?? ''
				: null;

			return successResponse(
				{
					intent: {
						id: intent.id,
						propertyId: intent.propertyId,
						title: intent.title,
						description: intent.description,
						category: intent.category,
						priority: intent.priority,
						status: intent.status,
						constraints: intent.constraints as Record<string, unknown> | null,
						attachments: intent.attachments as string[] | null,
						submittedByPartyId: intent.submittedByPartyId,
						submittedAt: intent.submittedAt?.toISOString() ?? null,
						acknowledgedAt: intent.acknowledgedAt?.toISOString() ?? null,
						acknowledgedBy: intent.acknowledgedBy,
						convertedCaseId: intent.convertedCaseId,
						convertedAt: intent.convertedAt?.toISOString() ?? null,
						declinedAt: intent.declinedAt?.toISOString() ?? null,
						declineReason: intent.declineReason,
						withdrawnAt: intent.withdrawnAt?.toISOString() ?? null,
						withdrawReason: intent.withdrawReason,
						createdAt: intent.createdAt.toISOString(),
						updatedAt: intent.updatedAt.toISOString()
					},
					property: {
						id: intent.property.id,
						name: intent.property.name,
						addressLine1: intent.property.addressLine1
					},
					submittedByParty: intent.submittedByParty
						? {
								id: intent.submittedByParty.id,
								displayName: submitterDisplayName!
							}
						: null
				},
				context
			);
		}),

	/**
	 * List intents with filtering
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string().optional(),
				status: OwnerIntentStatusSchema.optional(),
				category: OwnerIntentCategorySchema.optional(),
				priority: OwnerIntentPrioritySchema.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intents: z.array(
						z.object({
							id: z.string(),
							propertyId: z.string(),
							propertyName: z.string(),
							title: z.string(),
							category: z.string(),
							priority: z.string(),
							status: z.string(),
							submittedAt: z.string().nullable(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization for listing
			await context.cerbos.authorize('view', 'owner_intent', 'list');

			const whereClause = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(input.propertyId && { propertyId: input.propertyId }),
				...(input.status && { status: input.status }),
				...(input.category && { category: input.category }),
				...(input.priority && { priority: input.priority })
			};

			const intents = await prisma.ownerIntent.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
				include: { property: true }
			});

			const hasMore = intents.length > input.limit;
			const items = hasMore ? intents.slice(0, -1) : intents;

			return successResponse(
				{
					intents: items.map((i) => ({
						id: i.id,
						propertyId: i.propertyId,
						propertyName: i.property.name,
						title: i.title,
						category: i.category,
						priority: i.priority,
						status: i.status,
						submittedAt: i.submittedAt?.toISOString() ?? null,
						createdAt: i.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	/**
	 * Update intent (only while in DRAFT status)
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				title: z.string().min(1).max(255).optional(),
				description: z.string().min(1).optional(),
				category: OwnerIntentCategorySchema.optional(),
				priority: OwnerIntentPrioritySchema.optional(),
				constraints: z.record(z.string(), z.unknown()).optional().nullable(),
				attachments: z.array(z.string()).optional().nullable()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						title: z.string(),
						category: z.string(),
						priority: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			// Can only update while in DRAFT status
			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only update intents in DRAFT status');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'owner_intent', existing.id);

			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					...(input.title !== undefined && { title: input.title }),
					...(input.description !== undefined && { description: input.description }),
					...(input.category !== undefined && { category: input.category }),
					...(input.priority !== undefined && { priority: input.priority }),
					...(input.constraints !== undefined && { 
					constraints: input.constraints === null 
						? Prisma.DbNull 
						: (input.constraints as Prisma.InputJsonValue) 
				}),
					...(input.attachments !== undefined && { 
					attachments: input.attachments === null 
						? Prisma.DbNull 
						: (input.attachments as Prisma.InputJsonValue) 
				})
				}
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						title: intent.title,
						category: intent.category,
						priority: intent.priority,
						updatedAt: intent.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Submit intent (transition from DRAFT to SUBMITTED)
	 */
	submit: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						status: z.string(),
						submittedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only submit intents in DRAFT status');
			}

			// Cerbos authorization
			await context.cerbos.authorize('submit', 'owner_intent', existing.id);

			const now = new Date();
			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					status: 'SUBMITTED',
					submittedAt: now
				}
			});

			// Record activity event
			await recordIntent(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'SUBMIT',
				summary: `Intent submitted for review: ${existing.title}`,
				intentId: intent.id,
				propertyId: existing.propertyId,
				previousState: { status: 'DRAFT' },
				newState: { status: 'SUBMITTED' }
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						status: intent.status,
						submittedAt: intent.submittedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Acknowledge intent (concierge acknowledges receipt)
	 */
	acknowledge: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						status: z.string(),
						acknowledgedAt: z.string(),
						acknowledgedBy: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			if (existing.status !== 'SUBMITTED') {
				throw ApiException.badRequest('Can only acknowledge intents in SUBMITTED status');
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('acknowledge', 'owner_intent', existing.id);

			const now = new Date();
			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					status: 'ACKNOWLEDGED',
					acknowledgedAt: now,
					acknowledgedBy: context.user.id
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'STATUS_CHANGE',
				summary: `Intent acknowledged by concierge`,
				intentId: intent.id,
				propertyId: existing.propertyId,
				previousState: { status: 'SUBMITTED' },
				newState: { status: 'ACKNOWLEDGED' }
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						status: intent.status,
						acknowledgedAt: intent.acknowledgedAt!.toISOString(),
						acknowledgedBy: intent.acknowledgedBy!
					}
				},
				context
			);
		}),

	/**
	 * Convert intent to case (creates a concierge case from this intent)
	 * Note: Actual case creation will be in P3.4; this just marks intent as converted
	 */
	convertToCase: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				caseId: z.string() // The ID of the created case
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						status: z.string(),
						convertedCaseId: z.string(),
						convertedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			if (!['SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw ApiException.badRequest(
					'Can only convert intents in SUBMITTED or ACKNOWLEDGED status'
				);
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('convert', 'owner_intent', existing.id);

			const now = new Date();
			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					status: 'CONVERTED_TO_CASE',
					convertedCaseId: input.caseId,
					convertedAt: now
				}
			});

			// Record activity event
			await recordDecision(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'STATUS_CHANGE',
				summary: `Intent converted to case`,
				intentId: intent.id,
				propertyId: existing.propertyId,
				caseId: input.caseId,
				previousState: { status: existing.status },
				newState: { status: 'CONVERTED_TO_CASE', convertedCaseId: input.caseId }
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						status: intent.status,
						convertedCaseId: intent.convertedCaseId!,
						convertedAt: intent.convertedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Decline intent
	 */
	decline: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().min(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						status: z.string(),
						declinedAt: z.string(),
						declinedBy: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			if (!['SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw ApiException.badRequest(
					'Can only decline intents in SUBMITTED or ACKNOWLEDGED status'
				);
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('decline', 'owner_intent', existing.id);

			const now = new Date();
			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					status: 'DECLINED',
					declinedAt: now,
					declinedBy: context.user.id,
					declineReason: input.reason
				}
			});

			// Record activity event
			await recordDecision(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'DENY',
				summary: `Intent declined: ${input.reason}`,
				intentId: intent.id,
				propertyId: existing.propertyId,
				previousState: { status: existing.status },
				newState: { status: 'DECLINED', declineReason: input.reason }
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						status: intent.status,
						declinedAt: intent.declinedAt!.toISOString(),
						declinedBy: intent.declinedBy!
					}
				},
				context
			);
		}),

	/**
	 * Withdraw intent (owner withdraws their own intent)
	 */
	withdraw: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					intent: z.object({
						id: z.string(),
						status: z.string(),
						withdrawnAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			if (!['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw ApiException.badRequest('Cannot withdraw intent in current status');
			}

			// Cerbos authorization
			await context.cerbos.authorize('withdraw', 'owner_intent', existing.id);

			const now = new Date();
			const intent = await prisma.ownerIntent.update({
				where: { id: input.id },
				data: {
					status: 'WITHDRAWN',
					withdrawnAt: now,
					withdrawReason: input.reason
				}
			});

			// Record activity event
			await recordIntent(context, {
				entityType: 'OWNER_INTENT',
				entityId: intent.id,
				action: 'CANCEL',
				summary: `Owner withdrew intent${input.reason ? `: ${input.reason}` : ''}`,
				intentId: intent.id,
				propertyId: existing.propertyId,
				previousState: { status: existing.status },
				newState: { status: 'WITHDRAWN', withdrawReason: input.reason }
			});

			return successResponse(
				{
					intent: {
						id: intent.id,
						status: intent.status,
						withdrawnAt: intent.withdrawnAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Add note to intent
	 */
	addNote: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				intentId: z.string(),
				content: z.string().min(1),
				isInternal: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					note: z.object({
						id: z.string(),
						intentId: z.string(),
						content: z.string(),
						isInternal: z.boolean(),
						createdBy: z.string(),
						createdAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const intent = await prisma.ownerIntent.findFirst({
				where: {
					id: input.intentId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!intent) {
				throw ApiException.notFound('OwnerIntent');
			}

			// Cerbos authorization
			await context.cerbos.authorize('add_note', 'owner_intent', intent.id);

			const note = await prisma.intentNote.create({
				data: {
					intentId: input.intentId,
					content: input.content,
					isInternal: input.isInternal,
					createdBy: context.user.id
				}
			});

			return successResponse(
				{
					note: {
						id: note.id,
						intentId: note.intentId,
						content: note.content,
						isInternal: note.isInternal,
						createdBy: note.createdBy,
						createdAt: note.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List notes for an intent
	 */
	listNotes: orgProcedure
		.input(
			z.object({
				intentId: z.string(),
				includeInternal: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notes: z.array(
						z.object({
							id: z.string(),
							content: z.string(),
							isInternal: z.boolean(),
							createdBy: z.string(),
							createdAt: z.string()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const intent = await prisma.ownerIntent.findFirst({
				where: {
					id: input.intentId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!intent) {
				throw ApiException.notFound('OwnerIntent');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'owner_intent', intent.id);

			const notes = await prisma.intentNote.findMany({
				where: {
					intentId: input.intentId,
					...(input.includeInternal ? {} : { isInternal: false })
				},
				orderBy: { createdAt: 'desc' }
			});

			return successResponse(
				{
					notes: notes.map((n) => ({
						id: n.id,
						content: n.content,
						isInternal: n.isInternal,
						createdBy: n.createdBy,
						createdAt: n.createdAt.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Soft delete intent
	 */
	delete: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					deletedAt: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('OwnerIntent');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'owner_intent', existing.id);

			const now = new Date();
			await prisma.ownerIntent.update({
				where: { id: input.id },
				data: { deletedAt: now }
			});

			return successResponse(
				{
					success: true,
					deletedAt: now.toISOString()
				},
				context
			);
		})
};
