import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { OwnerIntentCategorySchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentCategorySchema.js';
import { OwnerIntentPrioritySchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentPrioritySchema.js';
import { OwnerIntentStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/OwnerIntentStatusSchema.js';
import { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { startOwnerIntentWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('OwnerIntentRoute');

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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'owner_intent', 'new');

			// Verify property belongs to this organization
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty' });
			}

			// Verify submitter party if provided
			if (input.submittedByPartyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.submittedByPartyId, organizationId: context.organization.id }
				});
				if (!party) {
					throw errors.NOT_FOUND({ message: 'Party' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					title: input.title,
					description: input.description,
					category: input.category,
					priority: input.priority,
					constraints: input.constraints as Record<string, unknown> | undefined,
					attachments: input.attachments,
					submittedByPartyId: input.submittedByPartyId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to create intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						propertyId: workflowResult.propertyId!,
						title: workflowResult.title!,
						category: workflowResult.category!,
						priority: workflowResult.priority!,
						status: workflowResult.status!,
						createdAt: workflowResult.createdAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
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
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			// Can only update while in DRAFT status
			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only update intents in DRAFT status' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					title: input.title,
					description: input.description,
					category: input.category,
					priority: input.priority,
					constraints: input.constraints as Record<string, unknown> | undefined,
					attachments: input.attachments ?? undefined
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to update intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						title: workflowResult.title!,
						category: workflowResult.category!,
						priority: workflowResult.priority!,
						updatedAt: workflowResult.updatedAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only submit intents in DRAFT status' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('submit', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'SUBMIT',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					propertyId: existing.propertyId,
					title: existing.title
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to submit intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						status: workflowResult.status!,
						submittedAt: workflowResult.submittedAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			if (existing.status !== 'SUBMITTED') {
				throw errors.BAD_REQUEST({ message: 'Can only acknowledge intents in SUBMITTED status' });
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('acknowledge', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'ACKNOWLEDGE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					propertyId: existing.propertyId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to acknowledge intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						status: workflowResult.status!,
						acknowledgedAt: workflowResult.acknowledgedAt!,
						acknowledgedBy: workflowResult.acknowledgedBy!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			if (!['SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({
					message: 'Can only convert intents in SUBMITTED or ACKNOWLEDGED status'
				});
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('convert', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'CONVERT_TO_CASE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					caseId: input.caseId,
					propertyId: existing.propertyId,
					priority: existing.status
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to convert intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						status: workflowResult.status!,
						convertedCaseId: workflowResult.convertedCaseId!,
						convertedAt: workflowResult.convertedAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			if (!['SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({
					message: 'Can only decline intents in SUBMITTED or ACKNOWLEDGED status'
				});
			}

			// Cerbos authorization - requires concierge/admin role
			await context.cerbos.authorize('decline', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'DECLINE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					reason: input.reason,
					propertyId: existing.propertyId,
					priority: existing.status
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to decline intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						status: workflowResult.status!,
						declinedAt: workflowResult.declinedAt!,
						declinedBy: workflowResult.declinedBy!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			if (!['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot withdraw intent in current status' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('withdraw', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'WITHDRAW',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id,
					reason: input.reason,
					propertyId: existing.propertyId,
					priority: existing.status
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to withdraw intent' });
			}

			return successResponse(
				{
					intent: {
						id: workflowResult.intentId!,
						status: workflowResult.status!,
						withdrawnAt: workflowResult.withdrawnAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const intent = await prisma.ownerIntent.findFirst({
				where: {
					id: input.intentId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!intent) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('add_note', 'owner_intent', intent.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'ADD_NOTE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.intentId,
					content: input.content,
					isInternal: input.isInternal
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to add note' });
			}

			return successResponse(
				{
					note: {
						id: workflowResult.noteId!,
						intentId: workflowResult.intentId!,
						content: workflowResult.noteContent!,
						isInternal: workflowResult.noteIsInternal!,
						createdBy: workflowResult.noteCreatedBy!,
						createdAt: workflowResult.noteCreatedAt!
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const intent = await prisma.ownerIntent.findFirst({
				where: {
					id: input.intentId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!intent) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownerIntent.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'OwnerIntent' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'owner_intent', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startOwnerIntentWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization.id,
					userId: context.user.id,
					intentId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.NOT_FOUND({ message: workflowResult.error || 'Failed to delete intent' });
			}

			return successResponse(
				{
					success: true,
					deletedAt: workflowResult.deletedAt!
				},
				context
			);
		})
};
