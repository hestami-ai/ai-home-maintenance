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
import type { Prisma } from '../../../../../../generated/prisma/client.js';

/**
 * Property Portfolio management procedures for Phase 3 Concierge Platform
 */
export const portfolioRouter = {
	/**
	 * Create a new property portfolio
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				name: z.string().min(1).max(255),
				description: z.string().optional(),
				settings: z.record(z.string(), z.unknown()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						isActive: z.boolean(),
						createdAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property_portfolio', 'new');

			const portfolio = await prisma.propertyPortfolio.create({
				data: {
					organizationId: context.organization.id,
					name: input.name,
					description: input.description,
					settings: (input.settings ?? {}) as Prisma.InputJsonValue
				}
			});

			return successResponse(
				{
					portfolio: {
						id: portfolio.id,
						name: portfolio.name,
						description: portfolio.description,
						isActive: portfolio.isActive,
						createdAt: portfolio.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get portfolio by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						settings: z.record(z.string(), z.unknown()),
						isActive: z.boolean(),
						propertyCount: z.number(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				},
				include: {
					_count: {
						select: { properties: { where: { removedAt: null } } }
					}
				}
			});

			if (!portfolio) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_portfolio', portfolio.id);

			return successResponse(
				{
					portfolio: {
						id: portfolio.id,
						name: portfolio.name,
						description: portfolio.description,
						settings: portfolio.settings as Record<string, unknown>,
						isActive: portfolio.isActive,
						propertyCount: portfolio._count.properties,
						createdAt: portfolio.createdAt.toISOString(),
						updatedAt: portfolio.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List portfolios for the organization
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				includeInactive: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolios: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							description: z.string().nullable(),
							isActive: z.boolean(),
							propertyCount: z.number(),
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
			await context.cerbos.authorize('view', 'property_portfolio', 'list');

			const whereClause = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(!input.includeInactive && { isActive: true })
			};

			const portfolios = await prisma.propertyPortfolio.findMany({
				where: whereClause,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { name: 'asc' },
				include: {
					_count: {
						select: { properties: { where: { removedAt: null } } }
					}
				}
			});

			const hasMore = portfolios.length > input.limit;
			const items = hasMore ? portfolios.slice(0, -1) : portfolios;

			return successResponse(
				{
					portfolios: items.map((p) => ({
						id: p.id,
						name: p.name,
						description: p.description,
						isActive: p.isActive,
						propertyCount: p._count.properties,
						createdAt: p.createdAt.toISOString()
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
	 * Update portfolio
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().optional().nullable(),
				settings: z.record(z.string(), z.unknown()).optional(),
				isActive: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						isActive: z.boolean(),
						updatedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', existing.id);

			const portfolio = await prisma.propertyPortfolio.update({
				where: { id: input.id },
				data: {
					...(input.name !== undefined && { name: input.name }),
					...(input.description !== undefined && { description: input.description }),
					...(input.settings !== undefined && { settings: input.settings as Prisma.InputJsonValue }),
					...(input.isActive !== undefined && { isActive: input.isActive })
				}
			});

			return successResponse(
				{
					portfolio: {
						id: portfolio.id,
						name: portfolio.name,
						description: portfolio.description,
						isActive: portfolio.isActive,
						updatedAt: portfolio.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete portfolio
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
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'property_portfolio', existing.id);

			const now = new Date();
			await prisma.propertyPortfolio.update({
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
		}),

	/**
	 * Add property to portfolio
	 */
	addProperty: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				portfolioId: z.string(),
				propertyId: z.string(),
				displayOrder: z.number().int().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolioProperty: z.object({
						id: z.string(),
						portfolioId: z.string(),
						propertyId: z.string(),
						displayOrder: z.number().nullable(),
						addedAt: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Verify property exists and belongs to org
			const property = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				}
			});

			if (!property) {
				throw ApiException.notFound('IndividualProperty');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', portfolio.id);

			// Check if already in portfolio
			const existing = await prisma.portfolioProperty.findFirst({
				where: {
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					removedAt: null
				}
			});

			if (existing) {
				throw ApiException.conflict('Property is already in this portfolio');
			}

			const portfolioProperty = await prisma.portfolioProperty.create({
				data: {
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					displayOrder: input.displayOrder,
					notes: input.notes,
					addedBy: context.user.id
				}
			});

			return successResponse(
				{
					portfolioProperty: {
						id: portfolioProperty.id,
						portfolioId: portfolioProperty.portfolioId,
						propertyId: portfolioProperty.propertyId,
						displayOrder: portfolioProperty.displayOrder,
						addedAt: portfolioProperty.addedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Remove property from portfolio
	 */
	removeProperty: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				portfolioId: z.string(),
				propertyId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					removedAt: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', portfolio.id);

			const existing = await prisma.portfolioProperty.findFirst({
				where: {
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					removedAt: null
				}
			});

			if (!existing) {
				throw ApiException.notFound('PortfolioProperty');
			}

			const now = new Date();
			await prisma.portfolioProperty.update({
				where: { id: existing.id },
				data: { removedAt: now }
			});

			return successResponse(
				{
					success: true,
					removedAt: now.toISOString()
				},
				context
			);
		}),

	/**
	 * List properties in a portfolio
	 */
	listProperties: orgProcedure
		.input(
			PaginationInputSchema.extend({
				portfolioId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					properties: z.array(
						z.object({
							id: z.string(),
							propertyId: z.string(),
							propertyName: z.string(),
							propertyAddress: z.string(),
							propertyType: z.string(),
							displayOrder: z.number().nullable(),
							notes: z.string().nullable(),
							addedAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_portfolio', portfolio.id);

			const portfolioProperties = await prisma.portfolioProperty.findMany({
				where: {
					portfolioId: input.portfolioId,
					removedAt: null
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: [{ displayOrder: 'asc' }, { addedAt: 'desc' }],
				include: { property: true }
			});

			const hasMore = portfolioProperties.length > input.limit;
			const items = hasMore ? portfolioProperties.slice(0, -1) : portfolioProperties;

			return successResponse(
				{
					properties: items.map((pp) => ({
						id: pp.id,
						propertyId: pp.propertyId,
						propertyName: pp.property.name,
						propertyAddress: `${pp.property.addressLine1}, ${pp.property.city}, ${pp.property.state}`,
						propertyType: pp.property.propertyType,
						displayOrder: pp.displayOrder,
						notes: pp.notes,
						addedAt: pp.addedAt.toISOString()
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
	 * Get portfolio summary with aggregated metrics
	 */
	getSummary: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: z.object({
						id: z.string(),
						name: z.string()
					}),
					summary: z.object({
						totalProperties: z.number(),
						totalSquareFeet: z.number().nullable(),
						propertyTypes: z.array(
							z.object({
								type: z.string(),
								count: z.number()
							})
						)
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw ApiException.notFound('PropertyPortfolio');
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_portfolio', portfolio.id);

			// Get properties in portfolio
			const portfolioProperties = await prisma.portfolioProperty.findMany({
				where: {
					portfolioId: input.id,
					removedAt: null
				},
				include: { property: true }
			});

			const properties = portfolioProperties.map((pp) => pp.property);

			// Calculate aggregates
			const totalSquareFeet = properties.reduce((sum, p) => sum + (p.squareFeet ?? 0), 0);

			// Group by property type
			const typeGroups = properties.reduce(
				(acc, p) => {
					acc[p.propertyType] = (acc[p.propertyType] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			const propertyTypes = Object.entries(typeGroups).map(([type, count]) => ({
				type,
				count
			}));

			return successResponse(
				{
					portfolio: {
						id: portfolio.id,
						name: portfolio.name
					},
					summary: {
						totalProperties: properties.length,
						totalSquareFeet: totalSquareFeet > 0 ? totalSquareFeet : null,
						propertyTypes
					}
				},
				context
			);
		})
};
