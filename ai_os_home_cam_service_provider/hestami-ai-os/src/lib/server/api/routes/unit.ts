import { z } from 'zod';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';

/**
 * Unit management procedures
 */
export const unitRouter = {
	/**
	 * Create a new unit
	 */
	create: orgProcedure
		.input(
			z.object({
				propertyId: z.string(),
				unitNumber: z.string().min(1).max(50),
				unitType: z.enum(['SINGLE_FAMILY_HOME', 'CONDO_UNIT', 'TOWNHOUSE', 'LOT', 'COMMERCIAL_UNIT']),
				addressLine1: z.string().max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().max(100).optional(),
				state: z.string().max(50).optional(),
				postalCode: z.string().max(20).optional(),
				bedrooms: z.number().int().min(0).optional(),
				bathrooms: z.number().min(0).optional(),
				squareFeet: z.number().int().min(0).optional(),
				lotSquareFeet: z.number().int().min(0).optional(),
				parkingSpaces: z.number().int().min(0).default(0),
				assessmentClass: z.string().max(50).optional(),
				votingWeight: z.number().positive().default(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unit: z.object({
						id: z.string(),
						unitNumber: z.string(),
						unitType: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'unit', 'new');

			// Verify property belongs to this organization
			const property = await prisma.property.findFirst({
				where: { id: input.propertyId, deletedAt: null },
				include: { association: true }
			});

			if (!property || property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Property');
			}

			const unit = await prisma.unit.create({
				data: input
			});

			return successResponse(
				{
					unit: {
						id: unit.id,
						unitNumber: unit.unitNumber,
						unitType: unit.unitType
					}
				},
				context
			);
		}),

	/**
	 * Get unit by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unit: z.object({
						id: z.string(),
						propertyId: z.string(),
						unitNumber: z.string(),
						unitType: z.string(),
						addressLine1: z.string().nullable(),
						addressLine2: z.string().nullable(),
						city: z.string().nullable(),
						state: z.string().nullable(),
						postalCode: z.string().nullable(),
						bedrooms: z.number().nullable(),
						bathrooms: z.number().nullable(),
						squareFeet: z.number().nullable(),
						lotSquareFeet: z.number().nullable(),
						parkingSpaces: z.number(),
						assessmentClass: z.string().nullable(),
						votingWeight: z.number(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const unit = await prisma.unit.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Unit');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'unit', unit.id);

			return successResponse(
				{
					unit: {
						id: unit.id,
						propertyId: unit.propertyId,
						unitNumber: unit.unitNumber,
						unitType: unit.unitType,
						addressLine1: unit.addressLine1,
						addressLine2: unit.addressLine2,
						city: unit.city,
						state: unit.state,
						postalCode: unit.postalCode,
						bedrooms: unit.bedrooms,
						bathrooms: unit.bathrooms,
						squareFeet: unit.squareFeet,
						lotSquareFeet: unit.lotSquareFeet,
						parkingSpaces: unit.parkingSpaces,
						assessmentClass: unit.assessmentClass,
						votingWeight: unit.votingWeight,
						createdAt: unit.createdAt.toISOString(),
						updatedAt: unit.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List units
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string().optional(),
				unitType: z.enum(['SINGLE_FAMILY_HOME', 'CONDO_UNIT', 'TOWNHOUSE', 'LOT', 'COMMERCIAL_UNIT']).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					units: z.array(
						z.object({
							id: z.string(),
							unitNumber: z.string(),
							unitType: z.string(),
							propertyId: z.string(),
							propertyName: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos query plan
			const queryPlan = await context.cerbos.queryFilter('view', 'unit');

			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						units: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			const cerbosFilter = queryPlan.kind === 'conditional' ? queryPlan.filter : {};
			const units = await prisma.unit.findMany({
				where: {
					property: { association: { organizationId: context.organization.id } },
					deletedAt: null,
					...(input.propertyId && { propertyId: input.propertyId }),
					...(input.unitType && { unitType: input.unitType }),
					...cerbosFilter
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { unitNumber: 'asc' },
				include: { property: { select: { name: true } } }
			});

			const hasMore = units.length > input.limit;
			const items = hasMore ? units.slice(0, -1) : units;

			return successResponse(
				{
					units: items.map((u) => ({
						id: u.id,
						unitNumber: u.unitNumber,
						unitType: u.unitType,
						propertyId: u.propertyId,
						propertyName: u.property.name
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
	 * Update unit
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				unitNumber: z.string().min(1).max(50).optional(),
				unitType: z.enum(['SINGLE_FAMILY_HOME', 'CONDO_UNIT', 'TOWNHOUSE', 'LOT', 'COMMERCIAL_UNIT']).optional(),
				addressLine1: z.string().max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().max(100).optional(),
				state: z.string().max(50).optional(),
				postalCode: z.string().max(20).optional(),
				bedrooms: z.number().int().min(0).optional(),
				bathrooms: z.number().min(0).optional(),
				squareFeet: z.number().int().min(0).optional(),
				lotSquareFeet: z.number().int().min(0).optional(),
				parkingSpaces: z.number().int().min(0).optional(),
				assessmentClass: z.string().max(50).optional(),
				votingWeight: z.number().positive().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unit: z.object({
						id: z.string(),
						unitNumber: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.unit.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!existing || existing.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Unit');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'unit', existing.id);

			const { id, ...updateData } = input;
			const unit = await prisma.unit.update({
				where: { id },
				data: updateData
			});

			return successResponse(
				{
					unit: {
						id: unit.id,
						unitNumber: unit.unitNumber,
						updatedAt: unit.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a unit
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const unit = await prisma.unit.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Unit');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'unit', unit.id);

			const now = new Date();
			await prisma.unit.update({
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
