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
import { ExternalApprovalStatusSchema } from '../../../../../../generated/zod/inputTypeSchemas/ExternalApprovalStatusSchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { startExternalHoaWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('ExternalHoaRoute');

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
						propertyId: z.string(),
						hoaName: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Verify property belongs to org
			const property = await prisma.individualProperty.findFirst({
				where: { id: input.propertyId, ownerOrgId: context.organization.id }
			});
			if (!property) {
				throw errors.NOT_FOUND({ message: 'IndividualProperty not found' });
			}

			await context.cerbos.authorize('create', 'external_hoa_context', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'CREATE_CONTEXT',
					organizationId: context.organization.id,
					userId: context.user.id,
					propertyId: input.propertyId,
					hoaName: input.hoaName,
					hoaContactName: input.hoaContactName,
					hoaContactEmail: input.hoaContactEmail,
					hoaContactPhone: input.hoaContactPhone,
					hoaAddress: input.hoaAddress,
					notes: input.notes,
					documentsJson: input.documentsJson
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create HOA context' });
			}

			return successResponse(
				{
					context: {
						id: workflowResult.contextId!,
						propertyId: input.propertyId,
						hoaName: workflowResult.hoaName!,
						createdAt: workflowResult.createdAt!
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
		.handler(async ({ input, context, errors }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null },
				include: {
					approvals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
					rules: { where: { deletedAt: null }, orderBy: { ruleCategory: 'asc' } }
				}
			});

			if (!hoaContext) {
				throw errors.NOT_FOUND({ message: 'ExternalHOAContext not found' });
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
				idempotencyKey: z.string().uuid(),
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
						hoaName: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const existing = await prisma.externalHOAContext.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ExternalHOAContext not found' });
			}

			await context.cerbos.authorize('update', 'external_hoa_context', existing.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'UPDATE_CONTEXT',
					organizationId: context.organization.id,
					userId: context.user.id,
					contextId: input.id,
					hoaName: input.hoaName,
					hoaContactName: input.hoaContactName,
					hoaContactEmail: input.hoaContactEmail,
					hoaContactPhone: input.hoaContactPhone,
					hoaAddress: input.hoaAddress,
					notes: input.notes,
					documentsJson: input.documentsJson
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update HOA context' });
			}

			return successResponse(
				{
					context: {
						id: workflowResult.contextId!,
						hoaName: workflowResult.hoaName!,
						updatedAt: workflowResult.updatedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.externalHoaContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!hoaContext) {
				throw errors.NOT_FOUND({ message: 'ExternalHOAContext not found' });
			}

			await context.cerbos.authorize('create', 'external_hoa_approval', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'CREATE_APPROVAL',
					organizationId: context.organization.id,
					userId: context.user.id,
					externalHoaContextId: input.externalHoaContextId,
					propertyId: hoaContext.propertyId,
					caseId: input.caseId,
					approvalType: input.approvalType,
					notes: input.notes,
					relatedDocumentIds: input.relatedDocumentIds
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create approval' });
			}

			return successResponse(
				{
					approval: {
						id: workflowResult.approvalId!,
						approvalType: workflowResult.approvalType!,
						status: workflowResult.status!,
						createdAt: workflowResult.createdAt!
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				status: ExternalApprovalStatusSchema,
				submittedAt: z.string().datetime().optional(),
				responseAt: z.string().datetime().optional(),
				expiresAt: z.string().datetime().optional(),
				approvalReference: z.string().optional(),
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
					approval: z.object({
						id: z.string(),
						status: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via context relationship for connection pool safety
			const approval = await prisma.externalHOAApproval.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					externalHoaContext: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { externalHoaContext: true }
			});

			if (!approval) {
				throw errors.NOT_FOUND({ message: 'ExternalHOAApproval not found' });
			}

			await context.cerbos.authorize('update', 'external_hoa_approval', approval.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'UPDATE_APPROVAL_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					approvalId: input.id,
					propertyId: approval.externalHoaContext.propertyId,
					status: input.status,
					submittedAt: input.submittedAt ? new Date(input.submittedAt) : undefined,
					responseAt: input.responseAt ? new Date(input.responseAt) : undefined,
					expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
					approvalReference: input.approvalReference,
					notes: input.notes,
					// Pass previous status for activity logging
					...(({ previousStatus: approval.status }) as { previousStatus: string })
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update approval status' });
			}

			return successResponse(
				{
					approval: {
						id: workflowResult.approvalId!,
						status: workflowResult.status!,
						updatedAt: workflowResult.updatedAt!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			const hoaContext = await prisma.externalHOAContext.findFirst({
				where: { id: input.externalHoaContextId, organizationId: context.organization.id, deletedAt: null }
			});

			if (!hoaContext) {
				throw errors.NOT_FOUND({ message: 'ExternalHOAContext not found' });
			}

			await context.cerbos.authorize('create', 'external_hoa_rule', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'ADD_RULE',
					organizationId: context.organization.id,
					userId: context.user.id,
					externalHoaContextId: input.externalHoaContextId,
					ruleCategory: input.ruleCategory,
					ruleDescription: input.ruleDescription,
					sourceDocumentId: input.sourceDocumentId,
					notes: input.notes
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to add rule' });
			}

			return successResponse(
				{
					rule: {
						id: workflowResult.ruleId!,
						ruleCategory: workflowResult.ruleCategory!,
						ruleDescription: workflowResult.ruleDescription!,
						createdAt: workflowResult.createdAt!
					}
				},
				context
			);
		}),

	/**
	 * Delete a rule
	 */
	deleteRule: orgProcedure
		.input(z.object({
			idempotencyKey: z.string().uuid(),
			id: z.string()
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Defense in depth: explicit org filter via context relationship for connection pool safety
			const rule = await prisma.externalHOARule.findFirst({
				where: {
					id: input.id,
					deletedAt: null,
					externalHoaContext: { organizationId: context.organization.id, deletedAt: null }
				},
				include: { externalHoaContext: true }
			});

			if (!rule) {
				throw errors.NOT_FOUND({ message: 'ExternalHOARule not found' });
			}

			await context.cerbos.authorize('delete', 'external_hoa_rule', rule.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startExternalHoaWorkflow(
				{
					action: 'DELETE_RULE',
					organizationId: context.organization.id,
					userId: context.user.id,
					ruleId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete rule' });
			}

			return successResponse({ deleted: true }, context);
		})
};
