import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { startComplianceWorkflow } from '../../workflows/complianceWorkflow.js';
import { createModuleLogger } from '../../logger.js';
import {
	ComplianceRequirementTypeSchema,
	ComplianceStatusSchema,
	RecurrencePatternSchema
} from '../schemas.js';

const log = createModuleLogger('ComplianceRoute');

const RequirementTypeEnum = ComplianceRequirementTypeSchema;
const ComplianceStatusEnum = ComplianceStatusSchema;
const RecurrencePatternEnum = RecurrencePatternSchema;


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
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'complianceRequirement', 'new');

			// Use DBOS workflow for durable execution
			const workflowResult = await startComplianceWorkflow(
				{
					action: 'CREATE_REQUIREMENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						name: input.name,
						description: input.description,
						type: input.type,
						jurisdiction: input.jurisdiction,
						recurrence: input.recurrence,
						defaultDueDayOfYear: input.defaultDueDayOfYear,
						defaultLeadDays: input.defaultLeadDays,
						requiresEvidence: input.requiresEvidence,
						evidenceTypes: input.evidenceTypes,
						statutoryReference: input.statutoryReference,
						penaltyDescription: input.penaltyDescription,
						checklistTemplate: input.checklistTemplate
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create requirement' });
			}

			const requirement = await prisma.complianceRequirement.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

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
						checklistTemplate: z.array(z.object({ title: z.string(), description: z.string().optional() })).nullable(),
						isActive: z.boolean(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Compliance Requirement not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!requirement) throw errors.NOT_FOUND({ message: 'ComplianceRequirement' });

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
						checklistTemplate: (requirement.checklistTemplate as { title: string; description?: string }[] | null) ?? null,
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
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve compliance requirements' }
		})
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
		.errors({
			NOT_FOUND: { message: 'Compliance Requirement not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.id, organizationId: context.organization.id, deletedAt: null }
			});

			if (!requirement) throw errors.NOT_FOUND({ message: 'ComplianceRequirement' });

			await context.cerbos.authorize('update', 'complianceRequirement', requirement.id);

			// Use DBOS workflow for durable execution
			const workflowResult = await startComplianceWorkflow(
				{
					action: 'UPDATE_REQUIREMENT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						id: input.id,
						name: input.name,
						description: input.description,
						type: input.type,
						jurisdiction: input.jurisdiction,
						recurrence: input.recurrence,
						defaultDueDayOfYear: input.defaultDueDayOfYear,
						defaultLeadDays: input.defaultLeadDays,
						requiresEvidence: input.requiresEvidence,
						evidenceTypes: input.evidenceTypes,
						statutoryReference: input.statutoryReference,
						penaltyDescription: input.penaltyDescription,
						isActive: input.isActive
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update requirement' });
			}

			const updated = await prisma.complianceRequirement.findUniqueOrThrow({ where: { id: input.id } });

			return successResponse(
				{
					requirement: {
						id: updated.id,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
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
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'complianceDeadline', 'new');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const requirement = await prisma.complianceRequirement.findFirst({
				where: { id: input.requirementId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!requirement) throw errors.NOT_FOUND({ message: 'ComplianceRequirement' });

			// Use DBOS workflow for durable execution
			const workflowResult = await startComplianceWorkflow(
				{
					action: 'CREATE_DEADLINE',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: input.associationId,
						requirementId: input.requirementId,
						title: input.title,
						description: input.description,
						dueDate: input.dueDate,
						reminderDate: input.reminderDate,
						fiscalYear: input.fiscalYear,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create deadline' });
			}

			const deadline = await prisma.complianceDeadline.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Compliance Deadline not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					requirement: true,
					checklistItems: { orderBy: { sortOrder: 'asc' } }
				}
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ComplianceDeadline' });
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
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'complianceDeadline', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

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
				idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Compliance Deadline not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.id },
				include: { association: true }
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ComplianceDeadline' });
			}

			await context.cerbos.authorize('update', 'complianceDeadline', deadline.id);

			const { idempotencyKey, ...updateData } = input;

			// Update deadline status via workflow
			const result = await startComplianceWorkflow(
				{
					action: 'UPDATE_DEADLINE_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: input.id,
					data: {
						status: updateData.status,
						notes: updateData.notes
					}
				} as any,
				idempotencyKey
			);

			if (!result.success) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to update deadline status' });
			}

			// Fetch updated deadline
			const updated = await prisma.complianceDeadline.findUnique({
				where: { id: input.id }
			});

			return successResponse(
				{
					deadline: {
						id: updated!.id,
						status: updated!.status,
						completedAt: updated!.completedAt?.toISOString() ?? null
					}
				},
				context
			);
		}),

	addEvidenceDocument: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Entity not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const deadline = await prisma.complianceDeadline.findFirst({
				where: { id: input.deadlineId },
				include: { association: true }
			});

			if (!deadline || deadline.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ComplianceDeadline' });
			}

			await context.cerbos.authorize('update', 'complianceDeadline', deadline.id);

			// Verify document exists
			const document = await prisma.document.findFirst({
				where: { id: input.documentId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!document) {
				throw errors.NOT_FOUND({ message: 'Document' });
			}

			// Add document ID via workflow if not already present
			if (!deadline.evidenceDocumentIds.includes(input.documentId)) {
				const result = await startComplianceWorkflow(
					{
						action: 'ADD_EVIDENCE_DOCUMENT',
						organizationId: context.organization.id,
						userId: context.user.id,
						entityId: input.deadlineId,
						data: {
							documentId: input.documentId
						}
					} as any,
					input.idempotencyKey
				);

				if (!result.success) {
					throw errors.NOT_FOUND({ message: result.error || 'Failed to add evidence document' });
				}
			}

			return successResponse({ success: true }, context);
		}),

	// =========================================================================
	// Checklist Item APIs
	// =========================================================================

	updateChecklistItem: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Checklist Item not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const item = await prisma.complianceChecklistItem.findFirst({
				where: { id: input.id },
				include: { deadline: { include: { association: true } } }
			});

			if (!item || item.deadline.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ComplianceChecklistItem' });
			}

			await context.cerbos.authorize('update', 'complianceDeadline', item.deadline.id);

			const { idempotencyKey, id, ...updateData } = input;

			// Update checklist item via workflow
			const result = await startComplianceWorkflow(
				{
					action: 'UPDATE_CHECKLIST_ITEM',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: {
						isCompleted: updateData.isCompleted,
						notes: updateData.notes,
						evidenceDocumentId: updateData.evidenceDocumentId
					}
				} as any,
				idempotencyKey
			);

			if (!result.success) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to update checklist item' });
			}

			// Fetch updated item
			const updated = await prisma.complianceChecklistItem.findUnique({
				where: { id }
			});

			return successResponse(
				{
					item: {
						id: updated!.id,
						isCompleted: updated!.isCompleted,
						completedAt: updated!.completedAt?.toISOString() ?? null
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
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'complianceDeadline', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

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
