import { z } from 'zod';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { OwnershipTypeSchema } from '../schemas.js';
import { prisma } from '../../db.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';
import { ownershipWorkflow_v1 } from '../../workflows/ownershipWorkflow.js';

const log = createModuleLogger('OwnershipRoute');

/**
 * Ownership management procedures
 */
export const ownershipRouter = {
	/**
	 * Create a new ownership record
	 */
	create: orgProcedure
		.input(
			z.object({
                idempotencyKey: z.string().uuid(),
                unitId: z.string(),
				partyId: z.string(),
				ownershipType: OwnershipTypeSchema,
				percentage: z.number().min(0).max(100).default(100),
				startDate: z.coerce.date(),
				endDate: z.coerce.date().optional(),
				isPrimary: z.boolean().default(false),
				mailingAddress: z.record(z.string(), z.unknown()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					ownership: z.object({
						id: z.string(),
						unitId: z.string(),
						partyId: z.string(),
						percentage: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to create ownership' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'ownership', 'new');

			// Verify unit belongs to this organization
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Unit' });
			}

			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw errors.NOT_FOUND({ message: 'Party' });
			}

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(ownershipWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'CREATE',
				organizationId: context.organization.id,
				userId: context.user.id,
				unitId: input.unitId,
				partyId: input.partyId,
				ownershipType: input.ownershipType,
				percentage: input.percentage,
				startDate: input.startDate,
				endDate: input.endDate,
				isPrimary: input.isPrimary,
				mailingAddress: input.mailingAddress
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create ownership' });
			}

			return successResponse(
				{
					ownership: {
						id: result.ownershipId!,
						unitId: result.unitId!,
						partyId: result.partyId!,
						percentage: result.percentage!
					}
				},
				context
			);
		}),

	/**
	 * Get ownership by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					ownership: z.object({
						id: z.string(),
						unitId: z.string(),
						partyId: z.string(),
						ownershipType: z.string(),
						percentage: z.number(),
						startDate: z.string(),
						endDate: z.string().nullable(),
						isPrimary: z.boolean(),
						mailingAddress: z.record(z.string(), z.unknown()).nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					unit: z.object({
						id: z.string(),
						unitNumber: z.string(),
						propertyName: z.string()
					}),
					party: z.object({
						id: z.string(),
						displayName: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Ownership not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const ownership = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					unit: { include: { property: { include: { association: true } } } },
					party: true
				}
			});

			if (!ownership || ownership.unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Ownership' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'ownership', ownership.id, {
				partyUserId: ownership.party.userId ?? undefined
			});

			const displayName =
				ownership.party.partyType === 'INDIVIDUAL'
					? `${ownership.party.firstName ?? ''} ${ownership.party.lastName ?? ''}`.trim()
					: ownership.party.entityName ?? '';

			return successResponse(
				{
					ownership: {
						id: ownership.id,
						unitId: ownership.unitId,
						partyId: ownership.partyId,
						ownershipType: ownership.ownershipType,
						percentage: ownership.percentage,
						startDate: ownership.startDate.toISOString(),
						endDate: ownership.endDate?.toISOString() ?? null,
						isPrimary: ownership.isPrimary,
						mailingAddress: ownership.mailingAddress as Record<string, unknown> | null,
						createdAt: ownership.createdAt.toISOString(),
						updatedAt: ownership.updatedAt.toISOString()
					},
					unit: {
						id: ownership.unit.id,
						unitNumber: ownership.unit.unitNumber,
						propertyName: ownership.unit.property.name
					},
					party: {
						id: ownership.party.id,
						displayName
					}
				},
				context
			);
		}),

	/**
	 * List ownerships by unit
	 */
	listByUnit: orgProcedure
		.input(
			PaginationInputSchema.extend({
				unitId: z.string(),
				includeEnded: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					ownerships: z.array(
						z.object({
							id: z.string(),
							partyId: z.string(),
							partyName: z.string(),
							ownershipType: z.string(),
							percentage: z.number(),
							isPrimary: z.boolean(),
							startDate: z.string(),
							endDate: z.string().nullable()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Unit not found' }
		})
		.handler(async ({ input, context, errors }) => {
			// Verify unit belongs to this organization
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Unit' });
			}

			// Cerbos authorization for viewing unit's ownerships
			await context.cerbos.authorize('view', 'unit', unit.id);

			const ownerships = await prisma.ownership.findMany({
				where: {
					unitId: input.unitId,
					...(!input.includeEnded && { endDate: null })
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
				include: { party: true }
			});

			const hasMore = ownerships.length > input.limit;
			const items = hasMore ? ownerships.slice(0, -1) : ownerships;

			return successResponse(
				{
					ownerships: items.map((o) => ({
						id: o.id,
						partyId: o.partyId,
						partyName:
							o.party.partyType === 'INDIVIDUAL'
								? `${o.party.firstName ?? ''} ${o.party.lastName ?? ''}`.trim()
								: o.party.entityName ?? '',
						ownershipType: o.ownershipType,
						percentage: o.percentage,
						isPrimary: o.isPrimary,
						startDate: o.startDate.toISOString(),
						endDate: o.endDate?.toISOString() ?? null
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
	 * End ownership (set end date)
	 */
	end: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				endDate: z.coerce.date()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					ownership: z.object({
						id: z.string(),
						endDate: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Ownership not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to end ownership' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { unit: { include: { property: { include: { association: true } } } } }
			});

			if (!existing || existing.unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Ownership' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('end', 'ownership', existing.id);

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(ownershipWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'END',
				organizationId: context.organization.id,
				userId: context.user.id,
				ownershipId: input.id,
				endDate: input.endDate
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to end ownership' });
			}

			return successResponse(
				{
					ownership: {
						id: result.ownershipId!,
						endDate: result.endDate!
					}
				},
				context
			);
		}),

	/**
	 * Soft delete an ownership record
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
			NOT_FOUND: { message: 'Ownership not found' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to delete ownership' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { unit: { include: { property: { include: { association: true } } } } }
			});

			if (!existing || existing.unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Ownership' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'ownership', existing.id);

			// Start DBOS workflow with idempotency key
			const handle = await DBOS.startWorkflow(ownershipWorkflow_v1, {
				workflowID: input.idempotencyKey
			})({
				action: 'DELETE',
				organizationId: context.organization.id,
				userId: context.user.id,
				ownershipId: input.id
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete ownership' });
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
