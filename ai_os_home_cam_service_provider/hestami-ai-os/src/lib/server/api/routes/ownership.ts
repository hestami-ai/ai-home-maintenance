import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';

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
				unitId: z.string(),
				partyId: z.string(),
				ownershipType: z.enum([
					'FEE_SIMPLE',
					'JOINT_TENANCY',
					'TENANCY_IN_COMMON',
					'COMMUNITY_PROPERTY',
					'TRUST'
				]),
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
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'ownership', 'new');

			// Verify unit belongs to this organization
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Unit');
			}

			// Verify party belongs to this organization
			const party = await prisma.party.findFirst({
				where: { id: input.partyId, organizationId: context.organization.id }
			});

			if (!party) {
				throw ApiException.notFound('Party');
			}

			// If setting as primary, unset other primaries for this unit
			if (input.isPrimary) {
				await prisma.ownership.updateMany({
					where: { unitId: input.unitId, isPrimary: true },
					data: { isPrimary: false }
				});
			}

			const { mailingAddress, ...restInput } = input;
			const ownership = await prisma.ownership.create({
				data: {
					...restInput,
					...(mailingAddress !== undefined && { mailingAddress: mailingAddress as Prisma.InputJsonValue })
				}
			});

			return successResponse(
				{
					ownership: {
						id: ownership.id,
						unitId: ownership.unitId,
						partyId: ownership.partyId,
						percentage: ownership.percentage
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
		.handler(async ({ input, context }) => {
			const ownership = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					unit: { include: { property: { include: { association: true } } } },
					party: true
				}
			});

			if (!ownership || ownership.unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Ownership');
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
		.handler(async ({ input, context }) => {
			// Verify unit belongs to this organization
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Unit');
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
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { unit: { include: { property: { include: { association: true } } } } }
			});

			if (!existing || existing.unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Ownership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('end', 'ownership', existing.id);

			const ownership = await prisma.ownership.update({
				where: { id: input.id },
				data: { endDate: input.endDate, isPrimary: false }
			});

			return successResponse(
				{
					ownership: {
						id: ownership.id,
						endDate: ownership.endDate!.toISOString()
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
		.handler(async ({ input, context }) => {
			const existing = await prisma.ownership.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { unit: { include: { property: { include: { association: true } } } } }
			});

			if (!existing || existing.unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Ownership');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'ownership', existing.id);

			const now = new Date();
			await prisma.ownership.update({
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
