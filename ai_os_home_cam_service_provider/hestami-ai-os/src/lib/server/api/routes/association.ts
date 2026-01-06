import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../router.js';
import { prisma } from '../../db.js';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { createManagedAssociation_v1_wf } from '../../workflows/associationWorkflow.js';
import { COATemplateId } from '../../accounting/defaultChartOfAccounts.js';

const log = createModuleLogger('AssociationRoute');

/**
 * Association management procedures
 */
export const associationRouter = {
	/**
	 * Create a new association
	 */
	create: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				name: z.string().min(1).max(255),
				legalName: z.string().max(255).optional().nullable(),
				taxId: z.string().max(50).optional().nullable(),
				incorporationDate: z.coerce.date().optional().nullable(),
				fiscalYearEnd: z.number().int().min(1).max(12).default(12),
				settings: z.record(z.string(), z.unknown()).optional(),
				coaTemplateId: z.nativeEnum(COATemplateId).default(COATemplateId.STANDARD_HOA),
				contractData: z
					.object({
						contractNumber: z.string().max(100).optional().nullable(),
						startDate: z.coerce.date()
					})
					.optional()
					.nullable()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					association: z.object({
						id: z.string(),
						name: z.string(),
						legalName: z.string().nullable(),
						status: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - check if user can create associations
			await context.cerbos.authorize('create', 'association', 'new');

			// Start DBOS workflow
			const handle = await DBOS.startWorkflow(createManagedAssociation_v1_wf, {
				workflowID: input.idempotencyKey
			})({
				action: 'CREATE_MANAGED_ASSOCIATION',
				organizationId: context.organization.id,
				userId: context.user.id,
				associationData: {
					name: input.name,
					legalName: input.legalName,
					taxId: input.taxId,
					incorporationDate: input.incorporationDate,
					fiscalYearEnd: input.fiscalYearEnd,
					settings: (input.settings ?? {}) as Prisma.InputJsonValue
				},
				coaTemplateId: input.coaTemplateId,
				contractData: input.contractData
			});

			const result = await handle.getResult();

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create association' });
			}

			// Fetch the created association to return its data
			const association = await prisma.association.findUnique({
				where: { id: result.associationId }
			});

			if (!association) {
				throw errors.INTERNAL_SERVER_ERROR({ message: 'Association created but not found' });
			}

			return successResponse(
				{
					association: {
						id: association.id,
						name: association.name,
						legalName: association.legalName,
						status: association.status,
						createdAt: association.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get association by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					association: z.object({
						id: z.string(),
						name: z.string(),
						legalName: z.string().nullable(),
						taxId: z.string().nullable(),
						status: z.string(),
						incorporationDate: z.string().nullable(),
						fiscalYearEnd: z.number(),
						settings: z.record(z.string(), z.unknown()),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const association = await prisma.association.findFirst({
				where: {
					id: input.id,
					organizationId: context.organization.id
				}
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			// Cerbos authorization - check if user can view this specific association
			await context.cerbos.authorize('view', 'association', association.id);

			return successResponse(
				{
					association: {
						id: association.id,
						name: association.name,
						legalName: association.legalName,
						taxId: association.taxId,
						status: association.status,
						incorporationDate: association.incorporationDate?.toISOString() ?? null,
						fiscalYearEnd: association.fiscalYearEnd,
						settings: association.settings as Record<string, unknown>,
						createdAt: association.createdAt.toISOString(),
						updatedAt: association.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List associations
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				status: z.enum(['ACTIVE', 'ONBOARDING', 'SUSPENDED', 'TERMINATED']).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					associations: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							status: z.string(),
							propertyCount: z.number()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos query plan - get filter for what associations user can view
			const queryPlan = await context.cerbos.queryFilter('view', 'association');

			// Handle authorization result
			if (queryPlan.kind === 'always_denied') {
				// User has no access to any associations
				return successResponse(
					{
						associations: [],
						pagination: { nextCursor: null, hasMore: false }
					},
					context
				);
			}

			// Build where clause with Cerbos filter
			const cerbosFilter = queryPlan.kind === 'conditional' ? queryPlan.filter : {};
			const where = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(input.status && { status: input.status }),
				...cerbosFilter
			};

			const associations = await prisma.association.findMany({
				where,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { name: 'asc' },
				include: {
					_count: { select: { properties: true } }
				}
			});

			const hasMore = associations.length > input.limit;
			const items = hasMore ? associations.slice(0, -1) : associations;

			return successResponse(
				{
					associations: items.map((a) => ({
						id: a.id,
						name: a.name,
						status: a.status,
						propertyCount: a._count.properties
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
	 * Update association
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				legalName: z.string().max(255).optional(),
				taxId: z.string().max(50).optional(),
				status: z.enum(['ACTIVE', 'ONBOARDING', 'SUSPENDED', 'TERMINATED']).optional(),
				fiscalYearEnd: z.number().int().min(1).max(12).optional(),
				settings: z.record(z.string(), z.unknown()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					association: z.object({
						id: z.string(),
						name: z.string(),
						status: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.association.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			// Cerbos authorization - check if user can edit this association
			await context.cerbos.authorize('edit', 'association', existing.id);

			const { id, settings, ...updateData } = input;
			const association = await prisma.association.update({
				where: { id },
				data: {
					...updateData,
					...(settings !== undefined && { settings: settings as Prisma.InputJsonValue })
				}
			});

			return successResponse(
				{
					association: {
						id: association.id,
						name: association.name,
						status: association.status,
						updatedAt: association.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete an association
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
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.association.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			// Cerbos authorization - check if user can delete this association
			await context.cerbos.authorize('delete', 'association', existing.id);

			const now = new Date();
			await prisma.association.update({
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
