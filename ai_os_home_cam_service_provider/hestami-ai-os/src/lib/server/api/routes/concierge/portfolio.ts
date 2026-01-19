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
import { createModuleLogger } from '../../../logger.js';
import { startPortfolioWorkflow, PortfolioWorkflowAction } from '../../../workflows/index.js';

const log = createModuleLogger('PortfolioRoute');

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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property_portfolio', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startPortfolioWorkflow(
				{
					action: PortfolioWorkflowAction.CREATE,
					organizationId: context.organization.id,
					userId: context.user.id,
					name: input.name,
					description: input.description,
					settings: input.settings
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create portfolio' });
			}

			return successResponse(
				{
					portfolio: {
						id: workflowResult.portfolioId!,
						name: workflowResult.name!,
						description: workflowResult.description ?? null,
						isActive: workflowResult.isActive!,
						createdAt: workflowResult.createdAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
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
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization for listing
			await context.cerbos.authorize('view', 'property_portfolio', 'list');

			const portfolios = await prisma.propertyPortfolio.findMany({
				where: {
					organizationId: context.organization.id,
					deletedAt: null,
					...(!input.includeInactive && { isActive: true })
				},
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startPortfolioWorkflow(
				{
					action: PortfolioWorkflowAction.UPDATE,
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioId: input.id,
					name: input.name,
					description: input.description,
					settings: input.settings,
					isActive: input.isActive
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update portfolio' });
			}

			return successResponse(
				{
					portfolio: {
						id: workflowResult.portfolioId!,
						name: workflowResult.name!,
						description: workflowResult.description ?? null,
						isActive: workflowResult.isActive!,
						updatedAt: workflowResult.updatedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'property_portfolio', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startPortfolioWorkflow(
				{
					action: PortfolioWorkflowAction.DELETE,
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete portfolio' });
			}

			return successResponse(
				{
					success: true,
					deletedAt: workflowResult.deletedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Resource already exists' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Verify property exists and belongs to org
			const property = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				}
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', portfolio.id);

			// Check if already in portfolio
			const existingPortfolioProperty = await prisma.portfolioProperty.findFirst({
				where: {
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					removedAt: null,
					portfolio: { organizationId: context.organization.id }
				}
			});

			if (existingPortfolioProperty) {
				throw errors.CONFLICT({ message: 'Property is already in this portfolio' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPortfolioWorkflow(
				{
					action: PortfolioWorkflowAction.ADD_PROPERTY,
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					displayOrder: input.displayOrder,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to add property to portfolio' });
			}

			return successResponse(
				{
					portfolioProperty: {
						id: workflowResult.portfolioPropertyId!,
						portfolioId: workflowResult.portfolioId!,
						propertyId: workflowResult.propertyId as string,
						displayOrder: workflowResult.displayOrder ?? null,
						addedAt: workflowResult.addedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					success: z.boolean(),
					removedAt: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'property_portfolio', portfolio.id);

			const existingPortfolioProperty = await prisma.portfolioProperty.findFirst({
				where: {
					portfolioId: input.portfolioId,
					propertyId: input.propertyId,
					removedAt: null,
					portfolio: { organizationId: context.organization.id }
				}
			});

			if (!existingPortfolioProperty) {
				throw errors.NOT_FOUND({ message: 'PortfolioProperty not found' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPortfolioWorkflow(
				{
					action: PortfolioWorkflowAction.REMOVE_PROPERTY,
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioPropertyId: existingPortfolioProperty.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to remove property from portfolio' });
			}

			return successResponse(
				{
					success: true,
					removedAt: workflowResult.removedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify portfolio exists and belongs to org
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_portfolio', portfolio.id);

			const portfolioProperties = await prisma.portfolioProperty.findMany({
				where: {
					portfolioId: input.portfolioId,
					removedAt: null,
					portfolio: { organizationId: context.organization.id }
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const portfolio = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!portfolio) {
				throw errors.NOT_FOUND({ message: 'PropertyPortfolio not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'property_portfolio', portfolio.id);

			// Get properties in portfolio
			const portfolioProperties = await prisma.portfolioProperty.findMany({
				where: {
					portfolioId: input.id,
					removedAt: null,
					portfolio: { organizationId: context.organization.id }
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
