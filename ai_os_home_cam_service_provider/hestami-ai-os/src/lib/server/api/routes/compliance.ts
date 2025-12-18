import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import { withIdempotency } from '../middleware/idempotency.js';
import type { RequestContext } from '../context.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';

const RequirementTypeEnum = z.enum([
	'STATUTORY_DEADLINE',
	'NOTICE_REQUIREMENT',
	'VOTING_RULE',
	'FINANCIAL_AUDIT',
	'RESALE_PACKET',
	'INSURANCE',
	'MEETING',
	'FILING',
	'RECORD_RETENTION',
	'OTHER'
]);

const ComplianceStatusEnum = z.enum([
	'NOT_STARTED',
	'IN_PROGRESS',
	'COMPLETED',
	'OVERDUE',
	'WAIVED',
	'NOT_APPLICABLE'
]);

const RecurrencePatternEnum = z.enum([
	'NONE',
	'DAILY',
	'WEEKLY',
	'MONTHLY',
	'QUARTERLY',
	'SEMI_ANNUAL',
	'ANNUAL'
]);

const requireIdempotency = async <T>(
	key: string,
	ctx: RequestContext,
	fn: () => Promise<T>
) => {
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

export const complianceRouter = {
	// =========================================================================
	// Compliance Requirement APIs (Templates)
	// =========================================================================

	createRequirement: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				name: z.string().max(255),
				description: z.string().optional(),
				type: RequirementTypeEnum,
				jurisdiction: z.string().optional(),
				recurrence: RecurrencePatternEnum.optional(),
				defaultDueDayOfYear: z.number().int().min(1).max(365).optional(),
				defaultLeadDays: z.number().int().min(0).optional(),
				requiresEvidence: z.boolean().optional(),
				evidenceTypes: z.array(z.string()).optional(),
				statutoryReference: z.string().optional(),
				penaltyDescription: z.string().optional(),
				checklistTemplate: z.array(z.object({
					title: z.string(),
					description: z.string().optional()
				})).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requirement: z.object({
						id: z.string(),
						name: z.string(),
						type: RequirementTypeEnum,
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'complianceRequirement', 'new');

			return requireIdempotency(input.idempotencyKey, context, async () => {
				const requirement = await prisma.complianceRequirement.create({
					data: {
						organizationId: context.organization.id,
						name: input.name,
						description: input.description,
						type: input.type,
						jurisdiction: input.jurisdiction,
						recurrence: input.recurrence ?? 'ANNUAL',
						defaultDueDayOfYear: input.defaultDueDayOfYear,
						defaultLeadDays: input.defaultLeadDays ?? 30,
						requiresEvidence: input.requiresEvidence ?? false,
						evidenceTypes: input.evidenceTypes ?? [],
						statutoryReference: input.statutoryReference,
						penaltyDescription: input.penaltyDescription,
						checklistTemplate: input.checklistTemplate as Prisma.InputJsonValue
					}
				});

				return successResponse(
					{
						requirement: {
							id: requirement.id,
							name: requirement.name,
							type: requirement.type,
							createdAt: requirement.createdAt.toISOString()
						}
					},
					context
				);
			});
		}),

	getRequirement: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requirement: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						type: RequirementTypeEnum,
						jurisdiction: z.string().nullable(),
						recurrence: RecurrencePatternEnum,
						defaultDueDayOfYear: z.number().nullable(),
						defaultLeadDays: z.number(),
						requiresEvidence: z.boolean(),
						evidenceTypes: z.array(z.string()),
						statutoryReference: z.string().nullable(),
						penaltyDescription: z.string().nullable(),
						checklistTemplate: z.any().nullable(),
						isActive: z.boolean(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!requirement) throw ApiException.notFound('ComplianceRequirement');

			await context.cerbos.authorize('view', 'complianceRequirement', requirement.id);

			return successResponse(
				{
					requirement: {
						id: requirement.id,
						name: requirement.name,
						description: requirement.description ?? null,
						type: requirement.type,
						jurisdiction: requirement.jurisdiction ?? null,
						recurrence: requirement.recurrence,
						defaultDueDayOfYear: requirement.defaultDueDayOfYear ?? null,
						defaultLeadDays: requirement.defaultLeadDays,
						requiresEvidence: requirement.requiresEvidence,
						evidenceTypes: requirement.evidenceTypes,
						statutoryReference: requirement.statutoryReference ?? null,
						penaltyDescription: requirement.penaltyDescription ?? null,
						checklistTemplate: requirement.checklistTemplate ?? null,
						isActive: requirement.isActive,
						createdAt: requirement.createdAt.toISOString()
					}
				},
				context
			);
		}),

	listRequirements: orgProcedure
		.input(
			PaginationInputSchema.extend({
				type: RequirementTypeEnum.optional(),
				jurisdiction: z.string().optional(),
				activeOnly: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requirements: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							type: RequirementTypeEnum,
							jurisdiction: z.string().nullable(),
							recurrence: RecurrencePatternEnum,
							isActive: z.boolean()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'complianceRequirement', 'list');

			const requirements = await prisma.complianceRequirement.findMany({
				where: {
					organizationId: context.organization.id,
					deletedAt: null,
					...(input.type && { type: input.type }),
					...(input.jurisdiction && { jurisdiction: input.jurisdiction }),
					...(input.activeOnly && { isActive: true })
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = requirements.length > input.limit;
			const items = hasMore ? requirements.slice(0, -1) : requirements;

			return successResponse(
				{
					requirements: items.map((r) => ({
						id: r.id,
						name: r.name,
						type: r.type,
						jurisdiction: r.jurisdiction ?? null,
						recurrence: r.recurrence,
						isActive: r.isActive
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	updateRequirement: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				name: z.string().max(255).optional(),
				description: z.string().optional(),
				type: RequirementTypeEnum.optional(),
				jurisdiction: z.string().optional(),
				recurrence: RecurrencePatternEnum.optional(),
				defaultDueDayOfYear: z.number().int().min(1).max(365).optional(),
				defaultLeadDays: z.number().int().min(0).optional(),
				requiresEvidence: z.boolean().optional(),
				evidenceTypes: z.array(z.string()).optional(),
				statutoryReference: z.string().optional(),
				penaltyDescription: z.string().optional(),
				isActive: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requirement: z.object({
						id: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!requirement) throw ApiException.notFound('ComplianceRequirement');

			await context.cerbos.authorize('update', 'complianceRequirement', requirement.id);

			return requireIdempotency(input.idempotencyKey, context, async () => {
				const updated = await prisma.complianceRequirement.update({
					where: { id: input.id },
					data: {
						...(input.name && { name: input.name }),
						...(input.description !== undefined && { description: input.description }),
						...(input.type && { type: input.type }),
						...(input.jurisdiction !== undefined && { jurisdiction: input.jurisdiction }),
						...(input.recurrence && { recurrence: input.recurrence }),
						...(input.defaultDueDayOfYear !== undefined && { defaultDueDayOfYear: input.defaultDueDayOfYear }),
						...(input.defaultLeadDays !== undefined && { defaultLeadDays: input.defaultLeadDays }),
						...(input.requiresEvidence !== undefined && { requiresEvidence: input.requiresEvidence }),
						...(input.evidenceTypes && { evidenceTypes: input.evidenceTypes }),
						...(input.statutoryReference !== undefined && { statutoryReference: input.statutoryReference }),
						...(input.penaltyDescription !== undefined && { penaltyDescription: input.penaltyDescription }),
						...(input.isActive !== undefined && { isActive: input.isActive })
					}
				});

				return successResponse(
					{
						requirement: {
							id: updated.id,
							updatedAt: updated.updatedAt.toISOString()
						}
					},
					context
				);
			});
		}),

	// =========================================================================
	// Compliance Deadline APIs
	// =========================================================================

	createDeadline: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				associationId: z.string(),
				requirementId: z.string(),
				title: z.string().max(255),
				description: z.string().optional(),
				dueDate: z.string().datetime(),
				reminderDate: z.string().datetime().optional(),
				fiscalYear: z.number().int().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					deadline: z.object({
						id: z.string(),
						title: z.string(),
						dueDate: z.string(),
						status: ComplianceStatusEnum,
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'complianceDeadline', 'new');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.requirementId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!requirement) throw ApiException.notFound('ComplianceRequirement');

			return requireIdempotency(input.idempotencyKey, context, async () => {
				const deadline = await prisma.complianceDeadline.create({
					data: {
						associationId: input.associationId,
						requirementId: input.requirementId,
						title: input.title,
						description: input.description,
						dueDate: new Date(input.dueDate),
						reminderDate: input.reminderDate ? new Date(input.reminderDate) : undefined,
						fiscalYear: input.fiscalYear,
						notes: input.notes
					}
				});

				// Create checklist items from template if available
				if (requirement.checklistTemplate && Array.isArray(requirement.checklistTemplate)) {
					const template = requirement.checklistTemplate as Array<{ title: string; description?: string }>;
					await prisma.complianceChecklistItem.createMany({
						data: template.map((item, index) => ({
							deadlineId: deadline.id,
							title: item.title,
							description: item.description,
							sortOrder: index
						}))
					});
				}

				return successResponse(
					{
						deadline: {
							id: deadline.id,
							title: deadline.title,
							dueDate: deadline.dueDate.toISOString(),
							status: deadline.status,
							createdAt: deadline.createdAt.toISOString()
						}
					},
					context
				);
			});
		}),

	getDeadline: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					deadline: z.object({
						id: z.string(),
						title: z.string(),
						description: z.string().nullable(),
						dueDate: z.string(),
						reminderDate: z.string().nullable(),
						status: ComplianceStatusEnum,
						completedAt: z.string().nullable(),
						completedBy: z.string().nullable(),
						evidenceDocumentIds: z.array(z.string()),
						notes: z.string().nullable(),
						fiscalYear: z.number().nullable(),
						requirementId: z.string(),
						requirementName: z.string(),
						createdAt: z.string()
					}),
					checklistItems: z.array(
						z.object({
							id: z.string(),
							title: z.string(),
							description: z.string().nullable(),
							isCompleted: z.boolean(),
							completedAt: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					requirement: true,
					checklistItems: { orderBy: { sortOrder: 'asc' } }
				}
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ComplianceDeadline');
			}

			await context.cerbos.authorize('view', 'complianceDeadline', deadline.id);

			return successResponse(
				{
					deadline: {
						id: deadline.id,
						title: deadline.title,
						description: deadline.description ?? null,
						dueDate: deadline.dueDate.toISOString(),
						reminderDate: deadline.reminderDate?.toISOString() ?? null,
						status: deadline.status,
						completedAt: deadline.completedAt?.toISOString() ?? null,
						completedBy: deadline.completedBy ?? null,
						evidenceDocumentIds: deadline.evidenceDocumentIds,
						notes: deadline.notes ?? null,
						fiscalYear: deadline.fiscalYear ?? null,
						requirementId: deadline.requirementId,
						requirementName: deadline.requirement.name,
						createdAt: deadline.createdAt.toISOString()
					},
					checklistItems: deadline.checklistItems.map((item) => ({
						id: item.id,
						title: item.title,
						description: item.description ?? null,
						isCompleted: item.isCompleted,
						completedAt: item.completedAt?.toISOString() ?? null
					}))
				},
				context
			);
		}),

	listDeadlines: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string(),
				status: ComplianceStatusEnum.optional(),
				dueBefore: z.string().datetime().optional(),
				dueAfter: z.string().datetime().optional(),
				fiscalYear: z.number().int().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					deadlines: z.array(
						z.object({
							id: z.string(),
							title: z.string(),
							dueDate: z.string(),
							status: ComplianceStatusEnum,
							requirementType: RequirementTypeEnum,
							checklistProgress: z.object({
								completed: z.number(),
								total: z.number()
							})
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'complianceDeadline', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const deadlines = await prisma.complianceDeadline.findMany({
				where: {
					associationId: input.associationId,
					...(input.status && { status: input.status }),
					...(input.fiscalYear && { fiscalYear: input.fiscalYear }),
					...(input.dueBefore && { dueDate: { lte: new Date(input.dueBefore) } }),
					...(input.dueAfter && { dueDate: { gte: new Date(input.dueAfter) } })
				},
				include: {
					requirement: true,
					_count: { select: { checklistItems: true } },
					checklistItems: { where: { isCompleted: true }, select: { id: true } }
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { dueDate: 'asc' }
			});

			const hasMore = deadlines.length > input.limit;
			const items = hasMore ? deadlines.slice(0, -1) : deadlines;

			return successResponse(
				{
					deadlines: items.map((d) => ({
						id: d.id,
						title: d.title,
						dueDate: d.dueDate.toISOString(),
						status: d.status,
						requirementType: d.requirement.type,
						checklistProgress: {
							completed: d.checklistItems.length,
							total: d._count.checklistItems
						}
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	updateDeadlineStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: ComplianceStatusEnum,
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					deadline: z.object({
						id: z.string(),
						status: ComplianceStatusEnum,
						completedAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.id },
				include: { association: true }
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ComplianceDeadline');
			}

			await context.cerbos.authorize('update', 'complianceDeadline', deadline.id);

			const isCompleting = input.status === 'COMPLETED' && deadline.status !== 'COMPLETED';

			const updated = await prisma.complianceDeadline.update({
				where: { id: input.id },
				data: {
					status: input.status,
					...(isCompleting && { completedAt: new Date(), completedBy: context.user.id }),
					...(input.notes !== undefined && { notes: input.notes })
				}
			});

			return successResponse(
				{
					deadline: {
						id: updated.id,
						status: updated.status,
						completedAt: updated.completedAt?.toISOString() ?? null
					}
				},
				context
			);
		}),

	addEvidenceDocument: orgProcedure
		.input(
			z.object({
				deadlineId: z.string(),
				documentId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.deadlineId },
				include: { association: true }
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ComplianceDeadline');
			}

			await context.cerbos.authorize('update', 'complianceDeadline', deadline.id);

			// Verify document exists
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!document) {
				throw ApiException.notFound('Document');
			}

			// Add document ID if not already present
			if (!deadline.evidenceDocumentIds.includes(input.documentId)) {
				await prisma.complianceDeadline.update({
					where: { id: input.deadlineId },
					data: {
						evidenceDocumentIds: [...deadline.evidenceDocumentIds, input.documentId]
					}
				});
			}

			return successResponse({ success: true }, context);
		}),

	// =========================================================================
	// Checklist Item APIs
	// =========================================================================

	updateChecklistItem: orgProcedure
		.input(
			z.object({
				id: z.string(),
				isCompleted: z.boolean().optional(),
				notes: z.string().optional(),
				evidenceDocumentId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					item: z.object({
						id: z.string(),
						isCompleted: z.boolean(),
						completedAt: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const item = await prisma.complianceChecklistItem.findFirst({
				where: { id: input.id },
				include: { deadline: { include: { association: true } } }
			});

			if (!item || item.deadline.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ComplianceChecklistItem');
			}

			await context.cerbos.authorize('update', 'complianceDeadline', item.deadline.id);

			const isCompleting = input.isCompleted === true && !item.isCompleted;
			const isUncompleting = input.isCompleted === false && item.isCompleted;

			const updated = await prisma.complianceChecklistItem.update({
				where: { id: input.id },
				data: {
					...(input.isCompleted !== undefined && { isCompleted: input.isCompleted }),
					...(isCompleting && { completedAt: new Date(), completedBy: context.user.id }),
					...(isUncompleting && { completedAt: null, completedBy: null }),
					...(input.notes !== undefined && { notes: input.notes }),
					...(input.evidenceDocumentId !== undefined && { evidenceDocumentId: input.evidenceDocumentId })
				}
			});

			return successResponse(
				{
					item: {
						id: updated.id,
						isCompleted: updated.isCompleted,
						completedAt: updated.completedAt?.toISOString() ?? null
					}
				},
				context
			);
		}),

	// =========================================================================
	// Dashboard / Summary APIs
	// =========================================================================

	getComplianceSummary: orgProcedure
		.input(z.object({ associationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					summary: z.object({
						total: z.number(),
						notStarted: z.number(),
						inProgress: z.number(),
						completed: z.number(),
						overdue: z.number(),
						upcomingThisMonth: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'complianceDeadline', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw ApiException.notFound('Association');

			const now = new Date();
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

			const [total, notStarted, inProgress, completed, overdue, upcomingThisMonth] = await Promise.all([
				prisma.complianceDeadline.count({ where: { associationId: input.associationId } }),
				prisma.complianceDeadline.count({ where: { associationId: input.associationId, status: 'NOT_STARTED' } }),
				prisma.complianceDeadline.count({ where: { associationId: input.associationId, status: 'IN_PROGRESS' } }),
				prisma.complianceDeadline.count({ where: { associationId: input.associationId, status: 'COMPLETED' } }),
				prisma.complianceDeadline.count({ where: { associationId: input.associationId, status: 'OVERDUE' } }),
				prisma.complianceDeadline.count({
					where: {
						associationId: input.associationId,
						dueDate: { gte: now, lte: endOfMonth },
						status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }
					}
				})
			]);

			return successResponse(
				{
					summary: {
						total,
						notStarted,
						inProgress,
						completed,
						overdue,
						upcomingThisMonth
					}
				},
				context
			);
		})
};
