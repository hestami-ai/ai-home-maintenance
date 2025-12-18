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
import { DecisionCategorySchema } from '../../../../../../generated/zod/inputTypeSchemas/DecisionCategorySchema.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { recordDecision, recordExecution } from '../../middleware/activityEvent.js';

/**
 * Material Decision management for Phase 3.9
 */
export const materialDecisionRouter = {
	/**
	 * Record a material decision
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				caseId: z.string().optional(),
				category: DecisionCategorySchema,
				title: z.string().min(1).max(255),
				description: z.string().min(1),
				rationale: z.string().min(1),
				optionsConsidered: z
					.array(
						z.object({
							option: z.string(),
							pros: z.array(z.string()).optional(),
							cons: z.array(z.string()).optional(),
							selected: z.boolean().optional()
						})
					)
					.optional(),
				estimatedImpact: z.string().optional(),
				relatedDocumentIds: z.array(z.string()).optional(),
				relatedActionIds: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					decision: z.object({
						id: z.string(),
						category: z.string(),
						title: z.string(),
						decidedAt: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// If caseId provided, verify it belongs to org
			if (input.caseId) {
				const caseRecord = await prisma.conciergeCase.findFirst({
					where: { id: input.caseId, organizationId: context.organization.id, deletedAt: null }
				});
				if (!caseRecord) {
					throw ApiException.notFound('ConciergeCase');
				}
			}

			await context.cerbos.authorize('create', 'material_decision', 'new');

			const now = new Date();
			const decision = await prisma.materialDecision.create({
				data: {
					organizationId: context.organization.id,
					caseId: input.caseId,
					category: input.category,
					title: input.title,
					description: input.description,
					rationale: input.rationale,
					decidedByUserId: context.user.id,
					decidedAt: now,
					optionsConsidered: input.optionsConsidered ?? [],
					estimatedImpact: input.estimatedImpact,
					relatedDocumentIds: input.relatedDocumentIds ?? [],
					relatedActionIds: input.relatedActionIds ?? []
				}
			});

			// Record activity event
			await recordDecision(context, {
				entityType: 'MATERIAL_DECISION',
				entityId: decision.id,
				action: 'CREATE',
				summary: `Decision recorded: ${decision.title}`,
				caseId: input.caseId,
				decisionId: decision.id,
				newState: {
					category: decision.category,
					title: decision.title,
					rationale: decision.rationale
				}
			});

			return successResponse(
				{
					decision: {
						id: decision.id,
						category: decision.category,
						title: decision.title,
						decidedAt: decision.decidedAt.toISOString(),
						createdAt: decision.createdAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get a material decision by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					decision: z.object({
						id: z.string(),
						caseId: z.string().nullable(),
						category: z.string(),
						title: z.string(),
						description: z.string(),
						rationale: z.string(),
						decidedByUserId: z.string(),
						decidedAt: z.string(),
						optionsConsidered: z.array(z.any()),
						estimatedImpact: z.string().nullable(),
						actualOutcome: z.string().nullable(),
						outcomeRecordedAt: z.string().nullable(),
						relatedDocumentIds: z.array(z.string()),
						relatedActionIds: z.array(z.string()),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const decision = await prisma.materialDecision.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!decision) {
				throw ApiException.notFound('MaterialDecision');
			}

			await context.cerbos.authorize('view', 'material_decision', decision.id);

			return successResponse(
				{
					decision: {
						id: decision.id,
						caseId: decision.caseId,
						category: decision.category,
						title: decision.title,
						description: decision.description,
						rationale: decision.rationale,
						decidedByUserId: decision.decidedByUserId,
						decidedAt: decision.decidedAt.toISOString(),
						optionsConsidered: (decision.optionsConsidered as any[]) ?? [],
						estimatedImpact: decision.estimatedImpact,
						actualOutcome: decision.actualOutcome,
						outcomeRecordedAt: decision.outcomeRecordedAt?.toISOString() ?? null,
						relatedDocumentIds: (decision.relatedDocumentIds as string[]) ?? [],
						relatedActionIds: (decision.relatedActionIds as string[]) ?? [],
						createdAt: decision.createdAt.toISOString(),
						updatedAt: decision.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List material decisions
	 */
	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				caseId: z.string().optional(),
				category: DecisionCategorySchema.optional(),
				decidedByUserId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					decisions: z.array(
						z.object({
							id: z.string(),
							caseId: z.string().nullable(),
							category: z.string(),
							title: z.string(),
							decidedByUserId: z.string(),
							decidedAt: z.string(),
							hasOutcome: z.boolean()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'material_decision', 'list');

			const where: Prisma.MaterialDecisionWhereInput = {
				organizationId: context.organization.id,
				deletedAt: null,
				...(input.caseId && { caseId: input.caseId }),
				...(input.category && { category: input.category }),
				...(input.decidedByUserId && { decidedByUserId: input.decidedByUserId })
			};

			const decisions = await prisma.materialDecision.findMany({
				where,
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { decidedAt: 'desc' }
			});

			const hasMore = decisions.length > input.limit;
			const items = hasMore ? decisions.slice(0, -1) : decisions;

			return successResponse(
				{
					decisions: items.map((d) => ({
						id: d.id,
						caseId: d.caseId,
						category: d.category,
						title: d.title,
						decidedByUserId: d.decidedByUserId,
						decidedAt: d.decidedAt.toISOString(),
						hasOutcome: d.actualOutcome !== null
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
	 * Record the actual outcome of a decision
	 */
	recordOutcome: orgProcedure
		.input(
			z.object({
				id: z.string(),
				actualOutcome: z.string().min(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					decision: z.object({
						id: z.string(),
						actualOutcome: z.string(),
						outcomeRecordedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const decision = await prisma.materialDecision.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!decision) {
				throw ApiException.notFound('MaterialDecision');
			}

			await context.cerbos.authorize('update', 'material_decision', decision.id);

			const now = new Date();
			const updated = await prisma.materialDecision.update({
				where: { id: input.id },
				data: {
					actualOutcome: input.actualOutcome,
					outcomeRecordedAt: now
				}
			});

			// Record activity event
			await recordExecution(context, {
				entityType: 'MATERIAL_DECISION',
				entityId: decision.id,
				action: 'UPDATE',
				summary: `Decision outcome recorded: ${input.actualOutcome.substring(0, 100)}`,
				caseId: decision.caseId ?? undefined,
				decisionId: decision.id,
				newState: { actualOutcome: input.actualOutcome }
			});

			return successResponse(
				{
					decision: {
						id: updated.id,
						actualOutcome: updated.actualOutcome!,
						outcomeRecordedAt: updated.outcomeRecordedAt!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Update a decision (before outcome is recorded)
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).max(255).optional(),
				description: z.string().optional(),
				rationale: z.string().optional(),
				estimatedImpact: z.string().nullable().optional(),
				relatedDocumentIds: z.array(z.string()).optional(),
				relatedActionIds: z.array(z.string()).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					decision: z.object({
						id: z.string(),
						title: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const decision = await prisma.materialDecision.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!decision) {
				throw ApiException.notFound('MaterialDecision');
			}

			// Cannot update after outcome is recorded
			if (decision.actualOutcome) {
				throw ApiException.badRequest('Cannot update decision after outcome is recorded');
			}

			await context.cerbos.authorize('update', 'material_decision', decision.id);

			const updated = await prisma.materialDecision.update({
				where: { id: input.id },
				data: {
					...(input.title !== undefined && { title: input.title }),
					...(input.description !== undefined && { description: input.description }),
					...(input.rationale !== undefined && { rationale: input.rationale }),
					...(input.estimatedImpact !== undefined && { estimatedImpact: input.estimatedImpact }),
					...(input.relatedDocumentIds !== undefined && { relatedDocumentIds: input.relatedDocumentIds }),
					...(input.relatedActionIds !== undefined && { relatedActionIds: input.relatedActionIds })
				}
			});

			return successResponse(
				{
					decision: {
						id: updated.id,
						title: updated.title,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a decision
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const decision = await prisma.materialDecision.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!decision) {
				throw ApiException.notFound('MaterialDecision');
			}

			await context.cerbos.authorize('delete', 'material_decision', decision.id);

			await prisma.materialDecision.update({
				where: { id: input.id },
				data: { deletedAt: new Date() }
			});

			return successResponse({ deleted: true }, context);
		})
};
