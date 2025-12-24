import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('PropertyRoute');

/**
 * Property management procedures
 */
export const propertyRouter = {
	/**
	 * Create a new property
	 */
	create: orgProcedure
		.input(
			z.object({
				associationId: z.string(),
				name: z.string().min(1).max(255),
				propertyType: z.enum([
					'SINGLE_FAMILY',
					'CONDOMINIUM',
					'TOWNHOUSE',
					'COOPERATIVE',
					'MIXED_USE',
					'COMMERCIAL'
				]),
				addressLine1: z.string().min(1).max(255),
				addressLine2: z.string().max(255).optional(),
				city: z.string().min(1).max(100),
				state: z.string().min(2).max(50),
				postalCode: z.string().min(1).max(20),
				country: z.string().default('US'),
				latitude: z.number().optional(),
				longitude: z.number().optional(),
				yearBuilt: z.number().int().min(1800).max(2100).optional(),
				totalUnits: z.number().int().min(0).default(0),
				totalAcres: z.number().positive().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					property: z.object({
						id: z.string(),
						name: z.string(),
						propertyType: z.string(),
						city: z.string(),
						state: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property', 'new');

			// Verify association belongs to this organization
			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const property = await prisma.property.create({
				data: input
			});

			return successResponse(
				{
					property: {
						id: property.id,
						name: property.name,
						propertyType: property.propertyType,
						city: property.city,
						state: property.state
					}
				},
				context
			);
		}),

	/**
	 * Get property by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					property: z.object({
						id: z.string(),
						associationId: z.string(),
						name: z.string(),
						propertyType: z.string(),
						addressLine1: z.string(),
						addressLine2: z.string().nullable(),
						city: z.string(),
						state: z.string(),
						postalCode: z.string(),
						country: z.string(),
						latitude: z.number().nullable(),
						longitude: z.number().nullable(),
						yearBuilt: z.number().nullable(),
						totalUnits: z.number(),
						totalAcres: z.number().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const property = await prisma.property.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!property || property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Property');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property', property.id);

			return successResponse(
				{
					property: {
						id: property.id,
						associationId: property.associationId,
						name: property.name,
						propertyType: property.propertyType,
						addressLine1: property.addressLine1,
						addressLine2: property.addressLine2,
						city: property.city,
						state: property.state,
						postalCode: property.postalCode,
						country: property.country,
						latitude: property.latitude,
						longitude: property.longitude,
						yearBuilt: property.yearBuilt,
						totalUnits: property.totalUnits,
						totalAcres: property.totalAcres,
						createdAt: property.createdAt.toISOString(),
						updatedAt: property.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List properties
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					properties: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							propertyType: z.string(),
							city: z.string(),
							state: z.string(),
							totalUnits: z.number(),
							unitCount: z.number()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos query plan
			const queryPlan = await context.cerbos.queryFilter('view', 'property');

			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{
						properties: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			const cerbosFilter = queryPlan.kind === 'conditional' ? queryPlan.filter : {};
			const properties = await prisma.property.findMany({
				where: {
					association: { organizationId: context.organization.id },
					deletedAt: null,
					...(input.associationId && { associationId: input.associationId }),
					...cerbosFilter
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { name: 'asc' },
				include: {
					_count: { select: { units: true } }
				}
			});

			const hasMore = properties.length > input.limit;
			const items = hasMore ? properties.slice(0, -1) : properties;

			return successResponse(
				{
					properties: items.map((p) => ({
						id: p.id,
						name: p.name,
						propertyType: p.propertyType,
						city: p.city,
						state: p.state,
						totalUnits: p.totalUnits,
						unitCount: p._count.units
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
	 * Update property
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				propertyType: z
					.enum(['SINGLE_FAMILY', 'CONDOMINIUM', 'TOWNHOUSE', 'COOPERATIVE', 'MIXED_USE', 'COMMERCIAL'])
					.optional(),
				addressLine1: z.string().min(1).max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().min(1).max(100).optional(),
				state: z.string().min(2).max(50).optional(),
				postalCode: z.string().min(1).max(20).optional(),
				latitude: z.number().optional(),
				longitude: z.number().optional(),
				yearBuilt: z.number().int().min(1800).max(2100).optional(),
				totalUnits: z.number().int().min(0).optional(),
				totalAcres: z.number().positive().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					property: z.object({
						id: z.string(),
						name: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.property.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Property');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property', existing.id);

			const { id, ...updateData } = input;
			const property = await prisma.property.update({
				where: { id },
				data: updateData
			});

			return successResponse(
				{
					property: {
						id: property.id,
						name: property.name,
						updatedAt: property.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a property
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
			const property = await prisma.property.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!property || property.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Property');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'property', property.id);

			const now = new Date();
			await prisma.property.update({
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
