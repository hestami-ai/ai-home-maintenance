import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { ChecklistItemStatus } from '../../../../../../generated/prisma/client.js';
import { startChecklistWorkflow } from '../../../workflows/checklistWorkflow.js';

const jobStepOutput = z.object({
	id: z.string(),
	checklistId: z.string(),
	stepNumber: z.number(),
	title: z.string(),
	description: z.string().nullable(),
	isRequired: z.boolean(),
	status: z.nativeEnum(ChecklistItemStatus),
	completedAt: z.string().nullable(),
	completedBy: z.string().nullable(),
	notes: z.string().nullable(),
	requiresPhoto: z.boolean(),
	requiresSignature: z.boolean(),
	requiresNotes: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobChecklistOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isTemplate: z.boolean(),
	templateId: z.string().nullable(),
	jobId: z.string().nullable(),
	isCompleted: z.boolean(),
	completedAt: z.string().nullable(),
	completedBy: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	steps: z.array(jobStepOutput).optional()
});

const formatJobStep = (s: any) => ({
	id: s.id,
	checklistId: s.checklistId,
	stepNumber: s.stepNumber,
	title: s.title,
	description: s.description,
	isRequired: s.isRequired,
	status: s.status,
	completedAt: s.completedAt?.toISOString() ?? null,
	completedBy: s.completedBy,
	notes: s.notes,
	requiresPhoto: s.requiresPhoto,
	requiresSignature: s.requiresSignature,
	requiresNotes: s.requiresNotes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

const formatJobChecklist = (c: any, includeSteps = false) => ({
	id: c.id,
	organizationId: c.organizationId,
	name: c.name,
	description: c.description,
	isTemplate: c.isTemplate,
	templateId: c.templateId,
	jobId: c.jobId,
	isCompleted: c.isCompleted,
	completedAt: c.completedAt?.toISOString() ?? null,
	completedBy: c.completedBy,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString(),
	...(includeSteps && c.steps && { steps: c.steps.map(formatJobStep) })
});

export const checklistRouter = {
	/**
	 * Create a checklist template
	 */
	createTemplate: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1).max(255),
					description: z.string().optional(),
					steps: z.array(
						z.object({
							title: z.string().min(1).max(255),
							description: z.string().optional(),
							isRequired: z.boolean().default(true),
							requiresPhoto: z.boolean().default(false),
							requiresSignature: z.boolean().default(false),
							requiresNotes: z.boolean().default(false)
						})
					)
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checklist: jobChecklistOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_checklist', 'new');

			// Use DBOS workflow for durable execution
			const result = await startChecklistWorkflow(
				{
					action: 'CREATE_CHECKLIST',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						name: input.name,
						description: input.description,
						steps: input.steps
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create checklist' });
			}

			const checklist = await prisma.jobChecklist.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { steps: { orderBy: { stepNumber: 'asc' } } }
			});

			return successResponse({ checklist: formatJobChecklist(checklist, true) }, context);
		}),

	/**
	 * List checklist templates
	 */
	listTemplates: orgProcedure
		.input(PaginationInputSchema.optional())
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					checklists: z.array(jobChecklistOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_checklist', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const checklists = await prisma.jobChecklist.findMany({
				where: {
					organizationId: context.organization!.id,
					isTemplate: true
				},
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { name: 'asc' },
				include: { steps: { orderBy: { stepNumber: 'asc' } } }
			});

			const hasMore = checklists.length > limit;
			if (hasMore) checklists.pop();

			const nextCursor = hasMore ? checklists[checklists.length - 1]?.id ?? null : null;

			return successResponse(
				{
					checklists: checklists.map((c) => formatJobChecklist(c, true)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Apply a checklist template to a job
	 */
	applyToJob: orgProcedure
		.input(
			z
				.object({
					templateId: z.string(),
					jobId: z.string()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checklist: jobChecklistOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_checklist', 'new');

			// Validate template exists
			const template = await prisma.jobChecklist.findFirst({
				where: {
					id: input.templateId,
					organizationId: context.organization!.id,
					isTemplate: true
				},
				include: { steps: { orderBy: { stepNumber: 'asc' } } }
			});
			if (!template) throw errors.NOT_FOUND({ message: 'Checklist template not found' });

			// Validate job exists
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Use DBOS workflow for durable execution
			const result = await startChecklistWorkflow(
				{
					action: 'APPLY_CHECKLIST',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						templateId: template.id,
						templateName: template.name,
						templateDescription: template.description,
						templateSteps: template.steps.map((step) => ({
							stepNumber: step.stepNumber,
							title: step.title,
							description: step.description,
							isRequired: step.isRequired,
							requiresPhoto: step.requiresPhoto,
							requiresSignature: step.requiresSignature,
							requiresNotes: step.requiresNotes
						}))
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to apply checklist' });
			}

			const checklist = await prisma.jobChecklist.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { steps: { orderBy: { stepNumber: 'asc' } } }
			});

			return successResponse({ checklist: formatJobChecklist(checklist, true) }, context);
		}),

	/**
	 * Get checklist for a job
	 */
	getJobChecklist: orgProcedure
		.input(z.object({ jobId: z.string(), checklistId: z.string().optional() }))
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checklists: z.array(jobChecklistOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_checklist', input.jobId);

			const where: any = {
				organizationId: context.organization!.id,
				jobId: input.jobId,
				isTemplate: false
			};

			if (input.checklistId) {
				where.id = input.checklistId;
			}

			const checklists = await prisma.jobChecklist.findMany({
				where,
				include: { steps: { orderBy: { stepNumber: 'asc' } } },
				orderBy: { createdAt: 'asc' }
			});

			return successResponse(
				{ checklists: checklists.map((c) => formatJobChecklist(c, true)) },
				context
			);
		}),

	/**
	 * Update a step status (complete, skip, fail)
	 */
	updateStepStatus: orgProcedure
		.input(
			z
				.object({
					stepId: z.string(),
					status: z.nativeEnum(ChecklistItemStatus),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ step: jobStepOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			// Get step and verify access
			const step = await prisma.jobStep.findUnique({
				where: { id: input.stepId },
				include: { checklist: true }
			});
			if (!step) throw errors.NOT_FOUND({ message: 'Step not found' });
			if (step.checklist.organizationId !== context.organization!.id) {
				throw errors.FORBIDDEN({ message: 'Access denied' });
			}

			await context.cerbos.authorize(
				input.status === 'SKIPPED' ? 'skip' : 'complete',
				'job_step',
				input.stepId
			);

			// Validate requirements if completing
			if (input.status === 'COMPLETED') {
				if (step.requiresNotes && !input.notes && !step.notes) {
					throw errors.BAD_REQUEST({ message: 'This step requires notes' });
				}
			}

			// Use DBOS workflow for durable execution
			const result = await startChecklistWorkflow(
				{
					action: 'UPDATE_STEP',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					stepId: input.stepId,
					data: {
						status: input.status,
						notes: input.notes ?? step.notes,
						checklistId: step.checklistId
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update step' });
			}

			const updatedStep = await prisma.jobStep.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ step: formatJobStep(updatedStep) }, context);
		}),

	/**
	 * Delete a checklist template
	 */
	deleteTemplate: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'job_checklist', input.id);

			const existing = await prisma.jobChecklist.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, isTemplate: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Checklist template not found' });

			// Use DBOS workflow for durable execution
			const result = await startChecklistWorkflow(
				{
					action: 'DELETE_CHECKLIST',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					checklistId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete checklist' });
			}

			return successResponse({ deleted: true }, context);
		})
};
