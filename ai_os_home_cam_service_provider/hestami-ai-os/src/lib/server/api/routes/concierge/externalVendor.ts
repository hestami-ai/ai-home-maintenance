import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
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
import { recordExecution } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ExternalVendorRoute');

/**
 * External Vendor Context management for Phase 3.8
 */
export const externalVendorRouter = {
	/**
	 * Create an external vendor context
	 */
	createContext: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string().optional(),
				vendorName: z.string().min(1).max(255),
				vendorContactName: z.string().optional(),
				vendorContactEmail: z.string().email().optional(),
				vendorContactPhone: z.string().optional(),
				vendorAddress: z.string().optional(),
				tradeCategories: z.array(z.string()).optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						vendorName: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// If propertyId provided, verify it belongs to org
			if (input.propertyId) {
				const property = await prisma.individualProperty.findFirst({
					where: { id: input.propertyId, ownerOrgId: context.organization.id }
				});
				if (!property) {
					throw ApiException.notFound('IndividualProperty');
				}
			}

			await context.cerbos.authorize('create', 'external_vendor_context', 'new');

			const vendorContext = await prisma.externalVendorContext.create({
				data: {
					organizationId: context.organization.id,
					propertyId: input.propertyId,
					vendorName: input.vendorName,
					vendorContactName: input.vendorContactName,
					vendorContactEmail: input.vendorContactEmail,
					vendorContactPhone: input.vendorContactPhone,
					vendorAddress: input.vendorAddress,
					tradeCategories: input.tradeCategories ?? [],
					notes: input.notes
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'EXTERNAL_VENDOR',
				entityId: vendorContext.id,
				action: 'CREATE',
				summary: `External vendor added: ${input.vendorName}`,
				propertyId: input.propertyId,
				newState: { vendorName: input.vendorName, tradeCategories: input.tradeCategories }
			});

			return successResponse(
				{
					context: {
						id: vendorContext.id,
						vendorName: vendorContext.vendorName,
						createdAt: vendorContext.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get an external vendor context by ID
	 */
	getContext: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						propertyId: z.string().nullable(),
						vendorName: z.string(),
						vendorContactName: z.string().nullable(),
						vendorContactEmail: z.string().nullable(),
						vendorContactPhone: z.string().nullable(),
						vendorAddress: z.string().nullable(),
						tradeCategories: z.array(z.string()),
						notes: z.string().nullable(),
						linkedServiceProviderOrgId: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					interactions: z.array(
						z.object({
							id: z.string(),
							interactionType: z.string(),
							interactionDate: z.string(),
							description: z.string(),
							amount: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: {
					interactions: { orderBy: { interactionDate: 'desc' }, take: 20 }
				}
			});

			if (!vendorContext) {
				throw ApiException.notFound('ExternalVendorContext');
			}

			await context.cerbos.authorize('view', 'external_vendor_context', vendorContext.id);

			return successResponse(
				{
					context: {
						id: vendorContext.id,
						propertyId: vendorContext.propertyId,
						vendorName: vendorContext.vendorName,
						vendorContactName: vendorContext.vendorContactName,
						vendorContactEmail: vendorContext.vendorContactEmail,
						vendorContactPhone: vendorContext.vendorContactPhone,
						vendorAddress: vendorContext.vendorAddress,
						tradeCategories: (vendorContext.tradeCategories as string[]) ?? [],
						notes: vendorContext.notes,
						linkedServiceProviderOrgId: vendorContext.linkedServiceProviderOrgId,
						createdAt: vendorContext.createdAt.toISOString(),
						updatedAt: vendorContext.updatedAt.toISOString()
					},
					interactions: vendorContext.interactions.map((i) => ({
						id: i.id,
						interactionType: i.interactionType,
						interactionDate: i.interactionDate.toISOString(),
						description: i.description,
						amount: i.amount?.toString() ?? null
					}))
				},
				context
			);
		}),

	/**
	 * List external vendor contexts
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string().optional(),
				tradeCategory: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					contexts: z.array(
						z.object({
							id: z.string(),
							vendorName: z.string(),
							vendorContactName: z.string().nullable(),
							tradeCategories: z.array(z.string()),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'external_vendor_context', 'list');

			const where: Prisma.ExternalVendorContextWhereInput = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(input.propertyId && { propertyId: input.propertyId })
			};

			const contexts = await prisma.externalVendorContext.findMany({
				where,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = contexts.length > input.limit;
			const items = hasMore ? contexts.slice(0, -1) : contexts;

			return successResponse(
				{
					contexts: items.map((c) => ({
						id: c.id,
						vendorName: c.vendorName,
						vendorContactName: c.vendorContactName,
						tradeCategories: (c.tradeCategories as string[]) ?? [],
						createdAt: c.createdAt.toISOString()
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
	 * Update an external vendor context
	 */
	updateContext: orgProcedure
		.input(
			z.object({
				id: z.string(),
				vendorName: z.string().min(1).max(255).optional(),
				vendorContactName: z.string().nullable().optional(),
				vendorContactEmail: z.string().email().nullable().optional(),
				vendorContactPhone: z.string().nullable().optional(),
				vendorAddress: z.string().nullable().optional(),
				tradeCategories: z.array(z.string()).optional(),
				notes: z.string().nullable().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						vendorName: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw ApiException.notFound('ExternalVendorContext');
			}

			await context.cerbos.authorize('update', 'external_vendor_context', existing.id);

			const updated = await prisma.externalVendorContext.update({
				where: { id: input.id },
				data: {
					...(input.vendorName !== undefined && { vendorName: input.vendorName }),
					...(input.vendorContactName !== undefined && { vendorContactName: input.vendorContactName }),
					...(input.vendorContactEmail !== undefined && { vendorContactEmail: input.vendorContactEmail }),
					...(input.vendorContactPhone !== undefined && { vendorContactPhone: input.vendorContactPhone }),
					...(input.vendorAddress !== undefined && { vendorAddress: input.vendorAddress }),
					...(input.tradeCategories !== undefined && { tradeCategories: input.tradeCategories }),
					...(input.notes !== undefined && { notes: input.notes })
				}
			});

			return successResponse(
				{
					context: {
						id: updated.id,
						vendorName: updated.vendorName,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Link an external vendor to a platform service provider
	 */
	linkToServiceProvider: orgProcedure
		.input(
			z.object({
				id: z.string(),
				serviceProviderOrgId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						linkedServiceProviderOrgId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw ApiException.notFound('ExternalVendorContext');
			}

			// Verify service provider org exists
			const serviceProviderOrg = await prisma.organization.findFirst({
				where: { id: input.serviceProviderOrgId, type: 'SERVICE_PROVIDER', deletedAt: null }
			});

			if (!serviceProviderOrg) {
				throw ApiException.notFound('ServiceProviderOrganization');
			}

			await context.cerbos.authorize('update', 'external_vendor_context', existing.id);

			const updated = await prisma.externalVendorContext.update({
				where: { id: input.id },
				data: { linkedServiceProviderOrgId: input.serviceProviderOrgId }
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'EXTERNAL_VENDOR',
				entityId: existing.id,
				action: 'UPDATE',
				summary: `Vendor linked to platform provider: ${serviceProviderOrg.name}`,
				propertyId: existing.propertyId ?? undefined,
				newState: { linkedServiceProviderOrgId: input.serviceProviderOrgId }
			});

			return successResponse(
				{
					context: {
						id: updated.id,
						linkedServiceProviderOrgId: updated.linkedServiceProviderOrgId!
					}
				},
				context
			);
		}),

	/**
	 * Log an interaction with an external vendor
	 */
	logInteraction: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				externalVendorContextId: z.string(),
				caseId: z.string().optional(),
				interactionType: z.enum(['QUOTE', 'SCHEDULE', 'WORK', 'INVOICE', 'OTHER']),
				interactionDate: z.string().datetime(),
				description: z.string().min(1),
				amount: z.string().optional(), // Decimal as string
				notes: z.string().optional(),
				relatedDocumentIds: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					interaction: z.object({
						id: z.string(),
						interactionType: z.string(),
						interactionDate: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.externalVendorContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!vendorContext) {
				throw ApiException.notFound('ExternalVendorContext');
			}

			await context.cerbos.authorize('create', 'external_vendor_interaction', 'new');

			const interaction = await prisma.externalVendorInteraction.create({
				data: {
					externalVendorContextId: input.externalVendorContextId,
					caseId: input.caseId,
					interactionType: input.interactionType,
					interactionDate: new Date(input.interactionDate),
					description: input.description,
					amount: input.amount ? parseFloat(input.amount) : null,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds ?? []
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'EXTERNAL_VENDOR',
				entityId: interaction.id,
				action: 'CREATE',
				summary: `Vendor interaction: ${input.interactionType} - ${input.description.substring(0, 50)}`,
				propertyId: vendorContext.propertyId ?? undefined,
				caseId: input.caseId,
				newState: { interactionType: input.interactionType, description: input.description }
			});

			return successResponse(
				{
					interaction: {
						id: interaction.id,
						interactionType: interaction.interactionType,
						interactionDate: interaction.interactionDate.toISOString(),
						createdAt: interaction.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List interactions for a vendor
	 */
	listInteractions: orgProcedure
		.input(
			PaginationInputSchema.extend({
				externalVendorContextId: z.string(),
				interactionType: z.enum(['QUOTE', 'SCHEDULE', 'WORK', 'INVOICE', 'OTHER']).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					interactions: z.array(
						z.object({
							id: z.string(),
							interactionType: z.string(),
							interactionDate: z.string(),
							description: z.string(),
							amount: z.string().nullable(),
							caseId: z.string().nullable(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.externalVendorContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!vendorContext) {
				throw ApiException.notFound('ExternalVendorContext');
			}

			await context.cerbos.authorize('view', 'external_vendor_interaction', 'list');

			const where: Prisma.ExternalVendorInteractionWhereInput = {
				externalVendorContextId: input.externalVendorContextId,
				...(input.interactionType && { interactionType: input.interactionType })
			};

			const interactions = await prisma.externalVendorInteraction.findMany({
				where,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { interactionDate: 'desc' }
			});

			const hasMore = interactions.length > input.limit;
			const items = hasMore ? interactions.slice(0, -1) : interactions;

			return successResponse(
				{
					interactions: items.map((i) => ({
						id: i.id,
						interactionType: i.interactionType,
						interactionDate: i.interactionDate.toISOString(),
						description: i.description,
						amount: i.amount?.toString() ?? null,
						caseId: i.caseId,
						createdAt: i.createdAt.toISOString()
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		})
};
