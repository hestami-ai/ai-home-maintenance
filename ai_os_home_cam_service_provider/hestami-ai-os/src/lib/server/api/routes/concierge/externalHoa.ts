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
import { ExternalApprovalStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/ExternalApprovalStatusSchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { recordExecution, recordIntent } from '../../middleware/activityEvent.js';

/**
 * External HOA Context management for Phase 3.7
 */
export const externalHoaRouter = {
	/**
	 * Create an external HOA context for a property
	 */
	createContext: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				propertyId: z.string(),
				hoaName: z.string().min(1).max(255),
				hoaContactName: z.string().optional(),
				hoaContactEmail: z.string().email().optional(),
				hoaContactPhone: z.string().optional(),
				hoaAddress: z.string().optional(),
				notes: z.string().optional(),
				documentsJson: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						propertyId: z.string(),
						hoaName: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify property belongs to org
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});
			if (!property) {
				throw ApiException.notFound('IndividualProperty');
			}

			await context.cerbos.authorize('create', 'external_hoa_context', 'new');

			const hoaContext = await prisma.externalHOAContext.create({
				data: {
					organizationId: context.organization.id,
					propertyId: input.propertyId,
					hoaName: input.hoaName,
					hoaContactName: input.hoaContactName,
					hoaContactEmail: input.hoaContactEmail,
					hoaContactPhone: input.hoaContactPhone,
					hoaAddress: input.hoaAddress,
					notes: input.notes,
					documentsJson: input.documentsJson ?? []
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'EXTERNAL_HOA',
				entityId: hoaContext.id,
				action: 'CREATE',
				summary: `External HOA context created: ${input.hoaName}`,
				propertyId: input.propertyId,
				newState: { hoaName: input.hoaName }
			});

			return successResponse(
				{
					context: {
						id: hoaContext.id,
						propertyId: hoaContext.propertyId,
						hoaName: hoaContext.hoaName,
						createdAt: hoaContext.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get an external HOA context by ID
	 */
	getContext: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						propertyId: z.string(),
						hoaName: z.string(),
						hoaContactName: z.string().nullable(),
						hoaContactEmail: z.string().nullable(),
						hoaContactPhone: z.string().nullable(),
						hoaAddress: z.string().nullable(),
						notes: z.string().nullable(),
						documentsJson: z.array(z.string()),
						createdAt: z.string(),
						updatedAt: z.string()
					}),
					approvals: z.array(
						z.object({
							id: z.string(),
							approvalType: z.string(),
							status: z.string(),
							submittedAt: z.string().nullable(),
							responseAt: z.string().nullable(),
							expiresAt: z.string().nullable()
						})
					),
					rules: z.array(
						z.object({
							id: z.string(),
							ruleCategory: z.string(),
							ruleDescription: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: {
					approvals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
					rules: { where: { deletedAt: null }, orderBy: { ruleCategory: 'asc' } }
				}
			});

			if (!hoaContext) {
				throw ApiException.notFound('ExternalHOAContext');
			}

			await context.cerbos.authorize('view', 'external_hoa_context', hoaContext.id);

			return successResponse(
				{
					context: {
						id: hoaContext.id,
						propertyId: hoaContext.propertyId,
						hoaName: hoaContext.hoaName,
						hoaContactName: hoaContext.hoaContactName,
						hoaContactEmail: hoaContext.hoaContactEmail,
						hoaContactPhone: hoaContext.hoaContactPhone,
						hoaAddress: hoaContext.hoaAddress,
						notes: hoaContext.notes,
						documentsJson: (hoaContext.documentsJson as string[]) ?? [],
						createdAt: hoaContext.createdAt.toISOString(),
						updatedAt: hoaContext.updatedAt.toISOString()
					},
					approvals: hoaContext.approvals.map((a) => ({
						id: a.id,
						approvalType: a.approvalType,
						status: a.status,
						submittedAt: a.submittedAt?.toISOString() ?? null,
						responseAt: a.responseAt?.toISOString() ?? null,
						expiresAt: a.expiresAt?.toISOString() ?? null
					})),
					rules: hoaContext.rules.map((r) => ({
						id: r.id,
						ruleCategory: r.ruleCategory,
						ruleDescription: r.ruleDescription
					}))
				},
				context
			);
		}),

	/**
	 * List external HOA contexts for a property
	 */
	listByProperty: orgProcedure
		.input(
			PaginationInputSchema.extend({
				propertyId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					contexts: z.array(
						z.object({
							id: z.string(),
							hoaName: z.string(),
							hoaContactName: z.string().nullable(),
							createdAt: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'external_hoa_context', 'list');

			const contexts = await prisma.externalHOAContext.findMany({
				where: {
					organizationId: context.organization.id,
					propertyId: input.propertyId,
					deletedAt: null
				},
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
						hoaName: c.hoaName,
						hoaContactName: c.hoaContactName,
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
	 * Update an external HOA context
	 */
	updateContext: orgProcedure
		.input(
			z.object({
				id: z.string(),
				hoaName: z.string().min(1).max(255).optional(),
				hoaContactName: z.string().nullable().optional(),
				hoaContactEmail: z.string().email().nullable().optional(),
				hoaContactPhone: z.string().nullable().optional(),
				hoaAddress: z.string().nullable().optional(),
				notes: z.string().nullable().optional(),
				documentsJson: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					context: z.object({
						id: z.string(),
						hoaName: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.externalHOAContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw ApiException.notFound('ExternalHOAContext');
			}

			await context.cerbos.authorize('update', 'external_hoa_context', existing.id);

			const updated = await prisma.externalHOAContext.update({
				where: { id: input.id },
				data: {
					...(input.hoaName !== undefined && { hoaName: input.hoaName }),
					...(input.hoaContactName !== undefined && { hoaContactName: input.hoaContactName }),
					...(input.hoaContactEmail !== undefined && { hoaContactEmail: input.hoaContactEmail }),
					...(input.hoaContactPhone !== undefined && { hoaContactPhone: input.hoaContactPhone }),
					...(input.hoaAddress !== undefined && { hoaAddress: input.hoaAddress }),
					...(input.notes !== undefined && { notes: input.notes }),
					...(input.documentsJson !== undefined && { documentsJson: input.documentsJson })
				}
			});

			return successResponse(
				{
					context: {
						id: updated.id,
						hoaName: updated.hoaName,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Create an approval request for an external HOA
	 */
	createApproval: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				externalHoaContextId: z.string(),
				caseId: z.string().optional(),
				approvalType: z.string().min(1),
				notes: z.string().optional(),
				relatedDocumentIds: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					approval: z.object({
						id: z.string(),
						approvalType: z.string(),
						status: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.externalHoaContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!hoaContext) {
				throw ApiException.notFound('ExternalHOAContext');
			}

			await context.cerbos.authorize('create', 'external_hoa_approval', 'new');

			const approval = await prisma.externalHOAApproval.create({
				data: {
					externalHoaContextId: input.externalHoaContextId,
					caseId: input.caseId,
					approvalType: input.approvalType,
					status: 'PENDING',
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds ?? []
				}
			});

			// Record activity event
			await recordIntent(context, {
				entityType: 'EXTERNAL_HOA',
				entityId: approval.id,
				action: 'CREATE',
				summary: `HOA approval requested: ${input.approvalType}`,
				propertyId: hoaContext.propertyId,
				caseId: input.caseId,
				newState: { approvalType: input.approvalType, status: 'PENDING' }
			});

			return successResponse(
				{
					approval: {
						id: approval.id,
						approvalType: approval.approvalType,
						status: approval.status,
						createdAt: approval.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Update approval status
	 */
	updateApprovalStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: ExternalApprovalStatusSchema,
				submittedAt: z.string().datetime().optional(),
				responseAt: z.string().datetime().optional(),
				expiresAt: z.string().datetime().optional(),
				approvalReference: z.string().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					approval: z.object({
						id: z.string(),
						status: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const approval = await prisma.externalHOAApproval.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { externalHoaContext: true }
			});

			if (!approval || approval.externalHoaContext.organizationId !== context.organization.id) {
				throw ApiException.notFound('ExternalHOAApproval');
			}

			await context.cerbos.authorize('update', 'external_hoa_approval', approval.id);

			const updated = await prisma.externalHOAApproval.update({
				where: { id: input.id },
				data: {
					status: input.status,
					...(input.submittedAt && { submittedAt: new Date(input.submittedAt) }),
					...(input.responseAt && { responseAt: new Date(input.responseAt) }),
					...(input.expiresAt && { expiresAt: new Date(input.expiresAt) }),
					...(input.approvalReference && { approvalReference: input.approvalReference }),
					...(input.notes && { notes: input.notes })
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'EXTERNAL_HOA',
				entityId: approval.id,
				action: 'STATUS_CHANGE',
				summary: `HOA approval status: ${input.status}`,
				propertyId: approval.externalHoaContext.propertyId,
				caseId: approval.caseId ?? undefined,
				previousState: { status: approval.status },
				newState: { status: input.status }
			});

			return successResponse(
				{
					approval: {
						id: updated.id,
						status: updated.status,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Add a rule reference to an external HOA context
	 */
	addRule: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				externalHoaContextId: z.string(),
				ruleCategory: z.string().min(1),
				ruleDescription: z.string().min(1),
				sourceDocumentId: z.string().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					rule: z.object({
						id: z.string(),
						ruleCategory: z.string(),
						ruleDescription: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.externalHoaContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!hoaContext) {
				throw ApiException.notFound('ExternalHOAContext');
			}

			await context.cerbos.authorize('create', 'external_hoa_rule', 'new');

			const rule = await prisma.externalHOARule.create({
				data: {
					externalHoaContextId: input.externalHoaContextId,
					ruleCategory: input.ruleCategory,
					ruleDescription: input.ruleDescription,
					sourceDocumentId: input.sourceDocumentId,
					notes: input.notes
				}
			});

			return successResponse(
				{
					rule: {
						id: rule.id,
						ruleCategory: rule.ruleCategory,
						ruleDescription: rule.ruleDescription,
						createdAt: rule.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Delete a rule
	 */
	deleteRule: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const rule = await prisma.externalHOARule.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { externalHoaContext: true }
			});

			if (!rule || rule.externalHoaContext.organizationId !== context.organization.id) {
				throw ApiException.notFound('ExternalHOARule');
			}

			await context.cerbos.authorize('delete', 'external_hoa_rule', rule.id);

			await prisma.externalHOARule.update({
				where: { id: input.id },
				data: { deletedAt: new Date() }
			});

			return successResponse({ deleted: true }, context);
		})
};
