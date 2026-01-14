import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { VendorInteractionTypeSchema } from '../../schemas.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { startExternalVendorWorkflow } from '../../../workflows/index.js';

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			// If propertyId provided, verify it belongs to org
			if (input.propertyId) {
				const property = await prisma.individualProperty.findFirst({
					where: { id: input.propertyId, ownerOrgId: context.organization.id }
				});
				if (!property) {
					throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
				}
			}

			await context.cerbos.authorize('create', 'external_vendor_context', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalVendorWorkflow(
				{
					action: 'CREATE_CONTEXT',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					vendorName: input.vendorName,
					vendorContactName: input.vendorContactName,
					vendorContactEmail: input.vendorContactEmail,
					vendorContactPhone: input.vendorContactPhone,
					vendorAddress: input.vendorAddress,
					tradeCategories: input.tradeCategories,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create vendor context' });
			}

			return successResponse(
				{
					context: {
						id: workflowResult.contextId!,
						vendorName: workflowResult.vendorName!,
						createdAt: workflowResult.createdAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: {
					interactions: { orderBy: { interactionDate: 'desc' }, take: 20 }
				}
			});

			if (!vendorContext) {
				throw errors.NOT_FOUND({ message: 'ExternalVendorContext not found' });
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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
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
                idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ExternalVendorContext not found' });
			}

			await context.cerbos.authorize('update', 'external_vendor_context', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalVendorWorkflow(
				{
					action: 'UPDATE_CONTEXT',
					organizationId: context.organization.id,
					userId: context.user.id,
					contextId: input.id,
					vendorName: input.vendorName,
					vendorContactName: input.vendorContactName,
					vendorContactEmail: input.vendorContactEmail,
					vendorContactPhone: input.vendorContactPhone,
					vendorAddress: input.vendorAddress,
					tradeCategories: input.tradeCategories,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update vendor context' });
			}

			return successResponse(
				{
					context: {
						id: workflowResult.contextId!,
						vendorName: workflowResult.vendorName!,
						updatedAt: workflowResult.updatedAt!
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
			IdempotencyKeySchema.extend({
				id: z.string(),
				serviceProviderOrgId: z.string()
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
					context: z.object({
						id: z.string(),
						linkedServiceProviderOrgId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.externalVendorContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ExternalVendorContext not found' });
			}

			// Verify service provider org exists
			const serviceProviderOrg = await prisma.organization.findFirst({
				where: { id: input.serviceProviderOrgId, type: 'SERVICE_PROVIDER', deletedAt: null }
			});

			if (!serviceProviderOrg) {
				throw errors.NOT_FOUND({ message: 'ServiceProviderOrganization not found' });
			}

			await context.cerbos.authorize('update', 'external_vendor_context', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalVendorWorkflow(
				{
					action: 'LINK_TO_SERVICE_PROVIDER',
					organizationId: context.organization.id,
					userId: context.user.id,
					contextId: input.id,
					propertyId: existing.propertyId ?? undefined,
					serviceProviderOrgId: input.serviceProviderOrgId,
					serviceProviderName: serviceProviderOrg.name
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to link service provider' });
			}

			return successResponse(
				{
					context: {
						id: workflowResult.contextId!,
						linkedServiceProviderOrgId: workflowResult.linkedServiceProviderOrgId!
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
				interactionType: VendorInteractionTypeSchema,
				interactionDate: z.string().datetime(),
				description: z.string().min(1),
				amount: z.string().optional(), // Decimal as string
				notes: z.string().optional(),
				relatedDocumentIds: z.array(z.string()).optional()
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
		.handler(async ({ input, context, errors }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.externalVendorContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!vendorContext) {
				throw errors.NOT_FOUND({ message: 'ExternalVendorContext not found' });
			}

			await context.cerbos.authorize('create', 'external_vendor_interaction', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalVendorWorkflow(
				{
					action: 'LOG_INTERACTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					externalVendorContextId: input.externalVendorContextId,
					propertyId: vendorContext.propertyId ?? undefined,
					caseId: input.caseId,
					interactionType: input.interactionType,
					interactionDate: new Date(input.interactionDate),
					description: input.description,
					amount: input.amount ? parseFloat(input.amount) : undefined,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to log interaction' });
			}

			return successResponse(
				{
					interaction: {
						id: workflowResult.interactionId!,
						interactionType: workflowResult.interactionType!,
						interactionDate: workflowResult.interactionDate!,
						createdAt: workflowResult.createdAt!
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
				interactionType: VendorInteractionTypeSchema.optional()
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
		.handler(async ({ input, context, errors }) => {
			const vendorContext = await prisma.externalVendorContext.findFirst({
				where: { id: input.externalVendorContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!vendorContext) {
				throw errors.NOT_FOUND({ message: 'ExternalVendorContext not found' });
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
