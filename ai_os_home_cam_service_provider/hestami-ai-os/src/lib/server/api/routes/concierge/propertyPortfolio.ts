import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { startPropertyPortfolioWorkflow } from '../../../workflows/index.js';

/**
 * Property Portfolio Schema for responses
 */
const PropertyPortfolioSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	propertyCount: z.number().optional(),
	createdAt: z.string(),
	updatedAt: z.string()
});

/**
 * Property Portfolio management procedures for Phase 17 Concierge Platform
 */
export const propertyPortfolioRouter = {
	/**
	 * Create a new property portfolio
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				name: z.string().min(1).max(255),
				description: z.string().max(1000).optional()
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: PropertyPortfolioSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'property_portfolio', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyPortfolioWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					name: input.name,
					description: input.description
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
						organizationId: context.organization.id,
						name: workflowResult.name!,
						description: workflowResult.description ?? null,
						isActive: workflowResult.isActive!,
						propertyCount: workflowResult.propertyCount!,
						createdAt: workflowResult.createdAt!,
						updatedAt: workflowResult.updatedAt!
					}
				},
				context
			);
		}),

	/**
	 * Get a property portfolio by ID
	 */
	get: orgProcedure
		.input(
			z.object({
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
					portfolio: PropertyPortfolioSchema.extend({
						properties: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
								addressLine1: z.string(),
								city: z.string(),
								state: z.string(),
								postalCode: z.string(),
								propertyType: z.string()
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
					id: input.portfolioId,
					organizationId: context.organization.id,
					deletedAt: null
				},
				include: {
					properties: {
						include: {
							property: true
						}
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
						organizationId: portfolio.organizationId,
						name: portfolio.name,
						description: portfolio.description,
						isActive: portfolio.isActive,
						propertyCount: portfolio.properties.length,
						createdAt: portfolio.createdAt.toISOString(),
						updatedAt: portfolio.updatedAt.toISOString(),
						properties: portfolio.properties.map((pp) => ({
							id: pp.property.id,
							name: pp.property.name,
							addressLine1: pp.property.addressLine1,
							city: pp.property.city,
							state: pp.property.state,
							postalCode: pp.property.postalCode,
							propertyType: pp.property.propertyType
						}))
					}
				},
				context
			);
		}),

	/**
	 * List property portfolios for the organization
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				includeInactive: z.boolean().optional().default(false)
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolios: z.array(PropertyPortfolioSchema),
					total: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'property_portfolio', 'list');

			const where = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(input.includeInactive ? {} : { isActive: true })
			};

			const [portfolios, total] = await Promise.all([
				prisma.propertyPortfolio.findMany({
					where,
					include: {
						_count: {
							select: { properties: true }
						}
					},
					orderBy: { createdAt: 'desc' },
					take: input.limit,
					skip: input.cursor ? 1 : 0,
					cursor: input.cursor ? { id: input.cursor } : undefined
				}),
				prisma.propertyPortfolio.count({ where })
			]);

			return successResponse(
				{
					portfolios: portfolios.map((p) => ({
						id: p.id,
						organizationId: p.organizationId,
						name: p.name,
						description: p.description,
						isActive: p.isActive,
						propertyCount: p._count.properties,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt.toISOString()
					})),
					total
				},
				context
			);
		}),

	/**
	 * Update a property portfolio
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				portfolioId: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().max(1000).optional(),
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
					portfolio: PropertyPortfolioSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
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
			const workflowResult = await startPropertyPortfolioWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioId: input.portfolioId,
					name: input.name,
					description: input.description,
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
						organizationId: context.organization.id,
						name: workflowResult.name!,
						description: workflowResult.description ?? null,
						isActive: workflowResult.isActive!,
						propertyCount: workflowResult.propertyCount!,
						createdAt: workflowResult.createdAt!,
						updatedAt: workflowResult.updatedAt!
					}
				},
				context
			);
		}),

	/**
	 * Delete a property portfolio (soft delete)
	 */
	delete: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
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
					deleted: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.propertyPortfolio.findFirst({
				where: {
					id: input.portfolioId,
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
			const workflowResult = await startPropertyPortfolioWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization.id,
					userId: context.user.id,
					portfolioId: input.portfolioId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete portfolio' });
			}

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Get or create the default portfolio for an organization
	 * Used during onboarding to ensure a portfolio exists
	 */
	getOrCreateDefault: orgProcedure
		.input(IdempotencyKeySchema)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					portfolio: PropertyPortfolioSchema,
					created: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'property_portfolio', 'list');

			// Use DBOS workflow for durable execution
			const workflowResult = await startPropertyPortfolioWorkflow(
				{
					action: 'GET_OR_CREATE_DEFAULT',
					organizationId: context.organization.id,
					userId: context.user.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to get or create default portfolio' });
			}

			return successResponse(
				{
					portfolio: {
						id: workflowResult.portfolioId!,
						organizationId: context.organization.id,
						name: workflowResult.name!,
						description: workflowResult.description ?? null,
						isActive: workflowResult.isActive!,
						propertyCount: workflowResult.propertyCount!,
						createdAt: workflowResult.createdAt!,
						updatedAt: workflowResult.updatedAt!
					},
					created: workflowResult.created!
				},
				context
			);
		})
};
