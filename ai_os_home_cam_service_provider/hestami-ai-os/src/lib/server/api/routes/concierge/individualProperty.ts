import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { PropertyTypeSchema } from '../../../../../../generated/zod/inputTypeSchemas/PropertyTypeSchema.js';
import { createModuleLogger } from '../../../logger.js';
import { startIndividualPropertyWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('IndividualPropertyRoute');

/**
 * Individual Property Schema for responses
 */
const IndividualPropertySchema = z.object({
	id: z.string(),
	ownerOrgId: z.string(),
	name: z.string(),
	propertyType: z.string(),
	addressLine1: z.string(),
	addressLine2: z.string().nullable(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	yearBuilt: z.number().nullable(),
	squareFeet: z.number().nullable(),
	lotSquareFeet: z.number().nullable(),
	bedrooms: z.number().nullable(),
	bathrooms: z.number().nullable(),
	isActive: z.boolean(),
	linkedUnitId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

/**
 * External HOA Context Schema
 */
const ExternalHOAContextSchema = z.object({
	id: z.string(),
	hoaName: z.string(),
	hoaContactName: z.string().nullable(),
	hoaContactEmail: z.string().nullable(),
	hoaContactPhone: z.string().nullable(),
	hoaAddress: z.string().nullable(),
	notes: z.string().nullable()
});

/**
 * Individual Property management procedures for Phase 17 Concierge Platform
 */
export const individualPropertyRouter = {
	/**
	 * Create a new individual property
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				name: z.string().min(1).max(255),
				propertyType: PropertyTypeSchema,
				addressLine1: z.string().min(1).max(255),
				addressLine2: z.string().max(255).optional(),
				city: z.string().min(1).max(100),
				state: z.string().min(2).max(50),
				postalCode: z.string().min(1).max(20),
				country: z.string().max(2).optional().default('US'),
				yearBuilt: z.number().int().min(1800).max(2100).optional(),
				squareFeet: z.number().int().positive().optional(),
				lotSquareFeet: z.number().int().positive().optional(),
				bedrooms: z.number().int().min(0).optional(),
				bathrooms: z.number().min(0).optional(),
				// Optional portfolio to add to
				portfolioId: z.string().optional(),
				// Optional external HOA info
				externalHoa: z
					.object({
						hoaName: z.string().max(255),
						hoaContactName: z.string().max(255).optional(),
						hoaContactEmail: z.string().email().optional(),
						hoaContactPhone: z.string().max(50).optional(),
						hoaAddress: z.string().max(500).optional(),
						notes: z.string().max(1000).optional()
					})
					.optional()
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
					property: IndividualPropertySchema,
					externalHoa: ExternalHOAContextSchema.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization
			await context.cerbos.authorize('create', 'individual_property', 'new');

			// If portfolioId provided, verify it belongs to this org
			if (input.portfolioId) {
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
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					name: input.name,
					propertyType: input.propertyType,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2,
					city: input.city,
					state: input.state,
					postalCode: input.postalCode,
					country: input.country,
					yearBuilt: input.yearBuilt,
					squareFeet: input.squareFeet,
					lotSquareFeet: input.lotSquareFeet,
					bedrooms: input.bedrooms,
					bathrooms: input.bathrooms,
					portfolioId: input.portfolioId,
					externalHoa: input.externalHoa
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create property' });
			}

			return successResponse(
				{
					property: workflowResult.property!,
					externalHoa: workflowResult.externalHoa ?? null
				},
				context
			);
		}),

	/**
	 * Get an individual property by ID
	 */
	get: orgProcedure
		.input(
			z.object({
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
					property: IndividualPropertySchema.extend({
						externalHoa: ExternalHOAContextSchema.nullable(),
						portfolios: z.array(
							z.object({
								id: z.string(),
								name: z.string()
							})
						),
						activeCaseCount: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const property = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				},
				include: {
					externalHoaContexts: {
						take: 1
					},
					portfolioMemberships: {
						include: {
							portfolio: {
								select: { id: true, name: true }
							}
						}
					},
					conciergeCases: {
						where: {
							status: {
								notIn: ['CLOSED', 'CANCELLED', 'RESOLVED']
							}
						},
						select: { id: true }
					}
				}
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('view', 'individual_property', property.id);

			const externalHoa = property.externalHoaContexts[0] ?? null;

			return successResponse(
				{
					property: {
						id: property.id,
						ownerOrgId: property.ownerOrgId,
						name: property.name,
						propertyType: property.propertyType,
						addressLine1: property.addressLine1,
						addressLine2: property.addressLine2,
						city: property.city,
						state: property.state,
						postalCode: property.postalCode,
						country: property.country,
						yearBuilt: property.yearBuilt,
						squareFeet: property.squareFeet,
						lotSquareFeet: property.lotSquareFeet,
						bedrooms: property.bedrooms,
						bathrooms: property.bathrooms,
						isActive: property.isActive,
						linkedUnitId: property.linkedUnitId,
						createdAt: property.createdAt.toISOString(),
						updatedAt: property.updatedAt.toISOString(),
						externalHoa: externalHoa
							? {
								id: externalHoa.id,
								hoaName: externalHoa.hoaName,
								hoaContactName: externalHoa.hoaContactName,
								hoaContactEmail: externalHoa.hoaContactEmail,
								hoaContactPhone: externalHoa.hoaContactPhone,
								hoaAddress: externalHoa.hoaAddress,
								notes: externalHoa.notes
							}
							: null,
						portfolios: property.portfolioMemberships
							.filter((pm) => pm.portfolio !== null)
							.map((pm) => ({
								id: pm.portfolio.id,
								name: pm.portfolio.name
							})),
						activeCaseCount: property.conciergeCases.length
					}
				},
				context
			);
		}),

	/**
	 * List individual properties for the organization
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				portfolioId: z.string().optional(),
				propertyType: PropertyTypeSchema.optional(),
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
					properties: z.array(
						IndividualPropertySchema.extend({
							hasExternalHoa: z.boolean(),
							activeCaseCount: z.number()
						})
					),
					total: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'individual_property', 'list');

			// Build where clause
			const where: any = {
				ownerOrgId: context.organization.id,
				...(input.includeInactive ? {} : { isActive: true }),
				...(input.propertyType ? { propertyType: input.propertyType } : {})
			};

			// If filtering by portfolio, add join condition
			if (input.portfolioId) {
				where.portfolioMemberships = {
					some: {
						portfolioId: input.portfolioId,
						removedAt: null
					}
				};
			}

			const [properties, total] = await Promise.all([
				prisma.individualProperty.findMany({
					where,
					include: {
						externalHoaContexts: {
							take: 1,
							select: { id: true }
						},
						conciergeCases: {
							where: {
								status: {
									notIn: ['CLOSED', 'CANCELLED', 'RESOLVED']
								}
							},
							select: { id: true }
						}
					},
					orderBy: { createdAt: 'desc' },
					take: input.limit,
					skip: input.cursor ? 1 : 0,
					cursor: input.cursor ? { id: input.cursor } : undefined
				}),
				prisma.individualProperty.count({ where })
			]);

			return successResponse(
				{
					properties: properties.map((p) => ({
						id: p.id,
						ownerOrgId: p.ownerOrgId,
						name: p.name,
						propertyType: p.propertyType,
						addressLine1: p.addressLine1,
						addressLine2: p.addressLine2,
						city: p.city,
						state: p.state,
						postalCode: p.postalCode,
						country: p.country,
						yearBuilt: p.yearBuilt,
						squareFeet: p.squareFeet,
						lotSquareFeet: p.lotSquareFeet,
						bedrooms: p.bedrooms,
						bathrooms: p.bathrooms,
						isActive: p.isActive,
						linkedUnitId: p.linkedUnitId,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt.toISOString(),
						hasExternalHoa: p.externalHoaContexts.length > 0,
						activeCaseCount: p.conciergeCases.length
					})),
					total
				},
				context
			);
		}),

	/**
	 * Update an individual property
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				name: z.string().min(1).max(255).optional(),
				propertyType: PropertyTypeSchema.optional(),
				addressLine1: z.string().min(1).max(255).optional(),
				addressLine2: z.string().max(255).nullable().optional(),
				city: z.string().min(1).max(100).optional(),
				state: z.string().min(2).max(50).optional(),
				postalCode: z.string().min(1).max(20).optional(),
				yearBuilt: z.number().int().min(1800).max(2100).nullable().optional(),
				squareFeet: z.number().int().positive().nullable().optional(),
				lotSquareFeet: z.number().int().positive().nullable().optional(),
				bedrooms: z.number().int().min(0).nullable().optional(),
				bathrooms: z.number().min(0).nullable().optional(),
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
					property: IndividualPropertySchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('edit', 'individual_property', existing.id);

			const { propertyId, idempotencyKey, ...updateData } = input;

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId,
					name: updateData.name,
					propertyType: updateData.propertyType,
					addressLine1: updateData.addressLine1,
					addressLine2: updateData.addressLine2,
					city: updateData.city,
					state: updateData.state,
					postalCode: updateData.postalCode,
					yearBuilt: updateData.yearBuilt,
					squareFeet: updateData.squareFeet,
					lotSquareFeet: updateData.lotSquareFeet,
					bedrooms: updateData.bedrooms,
					bathrooms: updateData.bathrooms,
					isActive: updateData.isActive
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update property' });
			}

			return successResponse(
				{
					property: workflowResult.property!
				},
				context
			);
		}),

	/**
	 * Delete an individual property (soft delete via isActive)
	 */
	delete: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' }
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
			const existing = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				}
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Cerbos authorization
			await context.cerbos.authorize('delete', 'individual_property', existing.id);

			// Check for active cases
			const activeCases = await prisma.conciergeCase.count({
				where: {
					propertyId: input.propertyId,
					status: {
						notIn: ['CLOSED', 'CANCELLED', 'RESOLVED']
					}
				}
			});

			if (activeCases > 0) {
				throw errors.BAD_REQUEST({
					message: 'Cannot delete property with active service calls. Please resolve or cancel them first.'
				});
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete property' });
			}

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Add property to a portfolio
	 */
	addToPortfolio: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
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
					added: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'individual_property', input.propertyId);

			// Verify property belongs to org
			const property = await prisma.individualProperty.findFirst({
				where: {
					id: input.propertyId,
					ownerOrgId: context.organization.id
				}
			});

			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			// Verify portfolio belongs to org
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

			// Check if already in portfolio
			const existing = await prisma.portfolioProperty.findFirst({
				where: {
					propertyId: input.propertyId,
					portfolioId: input.portfolioId,
					removedAt: null
				}
			});

			if (existing) {
				return successResponse({ added: false }, context);
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'ADD_TO_PORTFOLIO',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					portfolioId: input.portfolioId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to add property to portfolio' });
			}

			return successResponse({ added: true }, context);
		}),

	/**
	 * Remove property from a portfolio
	 */
	removeFromPortfolio: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				portfolioId: z.string()
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					removed: z.boolean()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'individual_property', input.propertyId);

			const membership = await prisma.portfolioProperty.findFirst({
				where: {
					propertyId: input.propertyId,
					portfolioId: input.portfolioId,
					removedAt: null,
					portfolio: {
						organizationId: context.organization.id
					}
				}
			});

			if (!membership) {
				return successResponse({ removed: false }, context);
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'REMOVE_FROM_PORTFOLIO',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					portfolioId: input.portfolioId,
					portfolioPropertyId: membership.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to remove property from portfolio' });
			}

			return successResponse({ removed: true }, context);
		}),

	/**
	 * Update external HOA context for a property
	 */
	updateExternalHoa: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				hoaName: z.string().max(255),
				hoaContactName: z.string().max(255).nullable().optional(),
				hoaContactEmail: z.string().email().nullable().optional(),
				hoaContactPhone: z.string().max(50).nullable().optional(),
				hoaAddress: z.string().max(500).nullable().optional(),
				notes: z.string().max(1000).nullable().optional()
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
					externalHoa: ExternalHOAContextSchema.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify property belongs to org
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
			await context.cerbos.authorize('edit', 'individual_property', property.id);

			// Check for existing HOA context
			const existing = await prisma.externalHOAContext.findFirst({
				where: { propertyId: input.propertyId }
			});

			// Use DBOS workflow for durable execution
			const workflowResult = await startIndividualPropertyWorkflow(
				{
					action: 'UPDATE_EXTERNAL_HOA',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					externalHoaContextId: existing?.id,
					hoaName: input.hoaName,
					hoaContactName: input.hoaContactName,
					hoaContactEmail: input.hoaContactEmail,
					hoaContactPhone: input.hoaContactPhone,
					hoaAddress: input.hoaAddress,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update external HOA' });
			}

			return successResponse(
				{
					externalHoa: workflowResult.externalHoa ?? null
				},
				context
			);
		})
};
