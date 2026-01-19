import { z } from 'zod';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { PartyTypeSchema } from '../schemas.js';
import { prisma } from '../../db.js';
import { PartyType } from '../../../../../generated/prisma/enums.js';
import { createModuleLogger } from '../../logger.js';
import { partyWorkflow_v1, PartyWorkflowAction } from '../../workflows/partyWorkflow.js';

const log = createModuleLogger('PartyRoute');

/**
 * Party (owner/tenant) management procedures
 */
export const partyRouter = {
	/**
	 * Create a new party
	 */
	create: orgProcedure
		.input(
			z.object({
                idempotencyKey: z.string().uuid(),
                partyType: PartyTypeSchema,
				firstName: z.string().max(100).optional(),
				lastName: z.string().max(100).optional(),
				entityName: z.string().max(255).optional(),
				email: z.string().email().optional(),
				phone: z.string().max(20).optional(),
				addressLine1: z.string().max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().max(100).optional(),
				state: z.string().max(50).optional(),
				postalCode: z.string().max(20).optional(),
				country: z.string().default('US'),
				userId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					party: z.object({
						id: z.string(),
						partyType: z.string(),
						displayName: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid party data' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create party' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'party', 'new');

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(partyWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: PartyWorkflowAction.CREATE,
				organizationId: context.organization.id,
				userId: context.user.id,
				partyType: input.partyType,
				firstName: input.firstName,
				lastName: input.lastName,
				entityName: input.entityName,
				email: input.email,
				phone: input.phone,
				addressLine1: input.addressLine1,
				addressLine2: input.addressLine2,
				city: input.city,
				state: input.state,
				postalCode: input.postalCode,
				country: input.country,
				linkedUserId: input.userId
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create party' });
			}

			return successResponse(
				{
					party: {
						id: result.partyId!,
						partyType: result.partyType!,
						displayName: result.displayName!
					}
				},
				context
			);
		}),

	/**
	 * Get party by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					party: z.object({
						id: z.string(),
						partyType: z.string(),
						firstName: z.string().nullable(),
						lastName: z.string().nullable(),
						entityName: z.string().nullable(),
						email: z.string().nullable(),
						phone: z.string().nullable(),
						addressLine1: z.string().nullable(),
						addressLine2: z.string().nullable(),
						city: z.string().nullable(),
						state: z.string().nullable(),
						postalCode: z.string().nullable(),
						country: z.string().nullable(),
						userId: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Party not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const party = await prisma.party.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!party) {
				throw errors.NOT_FOUND({ message: 'Party' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'party', party.id, { userId: party.userId ?? undefined });

			return successResponse(
				{
					party: {
						id: party.id,
						partyType: party.partyType,
						firstName: party.firstName,
						lastName: party.lastName,
						entityName: party.entityName,
						email: party.email,
						phone: party.phone,
						addressLine1: party.addressLine1,
						addressLine2: party.addressLine2,
						city: party.city,
						state: party.state,
						postalCode: party.postalCode,
						country: party.country,
						userId: party.userId,
						createdAt: party.createdAt.toISOString(),
						updatedAt: party.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List parties
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				partyType: PartyTypeSchema.optional(),
				search: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					parties: z.array(
						z.object({
							id: z.string(),
							partyType: z.string(),
							displayName: z.string(),
							email: z.string().nullable()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve parties' }
		})
		.handler(async ({ input, context }) => {
			// Cerbos query plan
			const queryPlan = await context.cerbos.queryFilter('view', 'party');

			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						parties: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			const cerbosFilter = queryPlan.kind === 'conditional' ? queryPlan.filter : {};
			const parties = await prisma.party.findMany({
				where: {
					organizationId: context.organization.id,
					deletedAt: null,
					...(input.partyType && { partyType: input.partyType }),
					...(input.search && {
						OR: [
							{ firstName: { contains: input.search, mode: 'insensitive' } },
							{ lastName: { contains: input.search, mode: 'insensitive' } },
							{ entityName: { contains: input.search, mode: 'insensitive' } },
							{ email: { contains: input.search, mode: 'insensitive' } }
						]
					}),
					...cerbosFilter
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { entityName: 'asc' }]
			});

			const hasMore = parties.length > input.limit;
			const items = hasMore ? parties.slice(0, -1) : parties;

			return successResponse(
				{
					parties: items.map((p) => ({
						id: p.id,
						partyType: p.partyType,
						displayName:
							p.partyType === PartyType.INDIVIDUAL
								? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
								: p.entityName ?? '',
						email: p.email
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
	 * Update party
	 */
	update: orgProcedure
		.input(
			z.object({
                idempotencyKey: z.string().uuid(),
                id: z.string(),
				partyType: PartyTypeSchema.optional(),
				firstName: z.string().max(100).optional(),
				lastName: z.string().max(100).optional(),
				entityName: z.string().max(255).optional(),
				email: z.string().email().optional(),
				phone: z.string().max(20).optional(),
				addressLine1: z.string().max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().max(100).optional(),
				state: z.string().max(50).optional(),
				postalCode: z.string().max(20).optional(),
				country: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					party: z.object({
						id: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Party not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to update party' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.party.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Party' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'party', existing.id, { userId: existing.userId ?? undefined });

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(partyWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: PartyWorkflowAction.UPDATE,
				organizationId: context.organization.id,
				userId: context.user.id,
				partyId: input.id,
				partyType: input.partyType,
				firstName: input.firstName,
				lastName: input.lastName,
				entityName: input.entityName,
				email: input.email,
				phone: input.phone,
				addressLine1: input.addressLine1,
				addressLine2: input.addressLine2,
				city: input.city,
				state: input.state,
				postalCode: input.postalCode,
				country: input.country
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update party' });
			}

			return successResponse(
				{
					party: {
						id: result.partyId!,
						updatedAt: result.updatedAt!
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a party
	 */
	delete: orgProcedure
		.input(
			z.object({
                idempotencyKey: z.string().uuid(),
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
			NOT_FOUND: { message: 'Party not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to delete party' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.party.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Party' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'party', existing.id);

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(partyWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: PartyWorkflowAction.DELETE,
				organizationId: context.organization.id,
				userId: context.user.id,
				partyId: input.id
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete party' });
			}

			return successResponse(
				{
					success: true,
					deletedAt: result.deletedAt!
				},
				context
			);
		})
};
