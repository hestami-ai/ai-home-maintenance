import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { JobPrioritySchema, JobVisitStatusSchema } from '../../schemas.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { JobStatus, JobSourceType, CheckpointType, ActivityEntityType, ActivityActionType } from '../../../../../../generated/prisma/enums.js';
import { recordExecution, recordStatusChange, recordAssignment } from '../../middleware/activityEvent.js';
import { recordSpanError } from '../../middleware/tracing.js';
import { startJobCreateWorkflow } from '../../../workflows/jobCreateWorkflow.js';
import { startJobWorkflow, JobAction } from '../../../workflows/jobWorkflow.js';

// Valid state transitions for jobs (Phase 15 - Contractor Job Lifecycle)
// Note: Linked entity propagation (work orders, concierge cases) is now handled
// inside the jobWorkflow transitionJobStatus step function
const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
	// Initial states
	[JobStatus.LEAD]: [JobStatus.TICKET, JobStatus.CANCELLED],
	[JobStatus.TICKET]: [JobStatus.ESTIMATE_REQUIRED, JobStatus.JOB_CREATED, JobStatus.CANCELLED],

	// Estimate workflow
	[JobStatus.ESTIMATE_REQUIRED]: [JobStatus.ESTIMATE_SENT, JobStatus.JOB_CREATED, JobStatus.CANCELLED],
	[JobStatus.ESTIMATE_SENT]: [JobStatus.ESTIMATE_APPROVED, JobStatus.ESTIMATE_REQUIRED, JobStatus.CANCELLED],
	[JobStatus.ESTIMATE_APPROVED]: [JobStatus.JOB_CREATED, JobStatus.CANCELLED],

	// Job execution
	[JobStatus.JOB_CREATED]: [JobStatus.SCHEDULED, JobStatus.CANCELLED],
	[JobStatus.SCHEDULED]: [JobStatus.DISPATCHED, JobStatus.ON_HOLD, JobStatus.CANCELLED],
	[JobStatus.DISPATCHED]: [JobStatus.IN_PROGRESS, JobStatus.SCHEDULED, JobStatus.ON_HOLD, JobStatus.CANCELLED],
	[JobStatus.IN_PROGRESS]: [JobStatus.ON_HOLD, JobStatus.COMPLETED, JobStatus.CANCELLED],
	[JobStatus.ON_HOLD]: [JobStatus.SCHEDULED, JobStatus.DISPATCHED, JobStatus.IN_PROGRESS, JobStatus.CANCELLED],

	// Completion & payment
	[JobStatus.COMPLETED]: [JobStatus.INVOICED, JobStatus.WARRANTY, JobStatus.CLOSED, JobStatus.CANCELLED],
	[JobStatus.INVOICED]: [JobStatus.PAID, JobStatus.CANCELLED],
	[JobStatus.PAID]: [JobStatus.WARRANTY, JobStatus.CLOSED],
	[JobStatus.WARRANTY]: [JobStatus.CLOSED, JobStatus.IN_PROGRESS],

	// Terminal states
	[JobStatus.CLOSED]: [],
	[JobStatus.CANCELLED]: []
};

const jobOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobNumber: z.string(),
	status: z.nativeEnum(JobStatus),
	sourceType: z.nativeEnum(JobSourceType),
	workOrderId: z.string().nullable(),
	violationId: z.string().nullable(),
	arcRequestId: z.string().nullable(),
	customerId: z.string().nullable(),
	unitId: z.string().nullable(),
	propertyId: z.string().nullable(),
	associationId: z.string().nullable(),
	addressLine1: z.string().nullable(),
	addressLine2: z.string().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	postalCode: z.string().nullable(),
	locationNotes: z.string().nullable(),
	title: z.string(),
	description: z.string().nullable(),
	category: z.string().nullable(),
	priority: z.string(),
	assignedTechnicianId: z.string().nullable(),
	assignedBranchId: z.string().nullable(),
	assignedAt: z.string().nullable(),
	assignedBy: z.string().nullable(),
	scheduledStart: z.string().nullable(),
	scheduledEnd: z.string().nullable(),
	estimatedHours: z.string().nullable(),
	dispatchedAt: z.string().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	invoicedAt: z.string().nullable(),
	paidAt: z.string().nullable(),
	closedAt: z.string().nullable(),
	closedBy: z.string().nullable(),
	cancelledAt: z.string().nullable(),
	estimatedCost: z.string().nullable(),
	actualCost: z.string().nullable(),
	actualHours: z.string().nullable(),
	warrantyEnds: z.string().nullable(),
	warrantyNotes: z.string().nullable(),
	resolutionNotes: z.string().nullable(),
	customerRating: z.number().nullable(),
	customerFeedback: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobNoteOutput = z.object({
	id: z.string(),
	jobId: z.string(),
	authorId: z.string(),
	content: z.string(),
	isInternal: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobAttachmentOutput = z.object({
	id: z.string(),
	jobId: z.string(),
	fileName: z.string(),
	fileUrl: z.string(),
	fileSize: z.number().nullable(),
	mimeType: z.string().nullable(),
	description: z.string().nullable(),
	uploadedBy: z.string(),
	uploadedAt: z.string()
});

const jobCheckpointOutput = z.object({
	id: z.string(),
	jobId: z.string(),
	type: z.nativeEnum(CheckpointType),
	name: z.string(),
	description: z.string().nullable(),
	isRequired: z.boolean(),
	completedAt: z.string().nullable(),
	completedBy: z.string().nullable(),
	passed: z.boolean().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobVisitOutput = z.object({
	id: z.string(),
	jobId: z.string(),
	visitNumber: z.number(),
	scheduledStart: z.string(),
	scheduledEnd: z.string(),
	actualStart: z.string().nullable(),
	actualEnd: z.string().nullable(),
	technicianId: z.string().nullable(),
	status: z.string(),
	notes: z.string().nullable(),
	workPerformed: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatJob = (j: any) => ({
	id: j.id,
	organizationId: j.organizationId,
	jobNumber: j.jobNumber,
	status: j.status,
	sourceType: j.sourceType,
	workOrderId: j.workOrderId,
	violationId: j.violationId,
	arcRequestId: j.arcRequestId,
	customerId: j.customerId,
	unitId: j.unitId,
	propertyId: j.propertyId,
	associationId: j.associationId,
	addressLine1: j.addressLine1,
	addressLine2: j.addressLine2,
	city: j.city,
	state: j.state,
	postalCode: j.postalCode,
	locationNotes: j.locationNotes,
	title: j.title,
	description: j.description,
	category: j.category,
	priority: j.priority,
	assignedTechnicianId: j.assignedTechnicianId,
	assignedBranchId: j.assignedBranchId,
	assignedAt: j.assignedAt?.toISOString() ?? null,
	assignedBy: j.assignedBy,
	scheduledStart: j.scheduledStart?.toISOString() ?? null,
	scheduledEnd: j.scheduledEnd?.toISOString() ?? null,
	estimatedHours: j.estimatedHours?.toString() ?? null,
	dispatchedAt: j.dispatchedAt?.toISOString() ?? null,
	startedAt: j.startedAt?.toISOString() ?? null,
	completedAt: j.completedAt?.toISOString() ?? null,
	invoicedAt: j.invoicedAt?.toISOString() ?? null,
	paidAt: j.paidAt?.toISOString() ?? null,
	closedAt: j.closedAt?.toISOString() ?? null,
	closedBy: j.closedBy,
	cancelledAt: j.cancelledAt?.toISOString() ?? null,
	estimatedCost: j.estimatedCost?.toString() ?? null,
	actualCost: j.actualCost?.toString() ?? null,
	actualHours: j.actualHours?.toString() ?? null,
	warrantyEnds: j.warrantyEnds?.toISOString() ?? null,
	warrantyNotes: j.warrantyNotes,
	resolutionNotes: j.resolutionNotes,
	customerRating: j.customerRating,
	customerFeedback: j.customerFeedback,
	createdAt: j.createdAt.toISOString(),
	updatedAt: j.updatedAt.toISOString()
});

const formatNote = (n: any) => ({
	id: n.id,
	jobId: n.jobId,
	authorId: n.authorId,
	content: n.content,
	isInternal: n.isInternal,
	createdAt: n.createdAt.toISOString(),
	updatedAt: n.updatedAt.toISOString()
});

const formatAttachment = (a: any) => ({
	id: a.id,
	jobId: a.jobId,
	fileName: a.fileName,
	fileUrl: a.fileUrl,
	fileSize: a.fileSize,
	mimeType: a.mimeType,
	description: a.description,
	uploadedBy: a.uploadedBy,
	uploadedAt: a.uploadedAt.toISOString()
});

const formatCheckpoint = (c: any) => ({
	id: c.id,
	jobId: c.jobId,
	type: c.type,
	name: c.name,
	description: c.description,
	isRequired: c.isRequired,
	completedAt: c.completedAt?.toISOString() ?? null,
	completedBy: c.completedBy,
	passed: c.passed,
	notes: c.notes,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString()
});

const formatVisit = (v: any) => ({
	id: v.id,
	jobId: v.jobId,
	visitNumber: v.visitNumber,
	scheduledStart: v.scheduledStart.toISOString(),
	scheduledEnd: v.scheduledEnd.toISOString(),
	actualStart: v.actualStart?.toISOString() ?? null,
	actualEnd: v.actualEnd?.toISOString() ?? null,
	technicianId: v.technicianId,
	status: v.status,
	notes: v.notes,
	workPerformed: v.workPerformed,
	createdAt: v.createdAt.toISOString(),
	updatedAt: v.updatedAt.toISOString()
});

async function getJobOrThrow(jobId: string, organizationId: string, errors: any) {
	const job = await prisma.job.findFirst({
		where: { id: jobId, organizationId, deletedAt: null }
	});
	if (!job) throw errors.NOT_FOUND({ message: 'Job' });
	return job;
}

export const jobRouter = {
	/**
	 * Create a new job
	 */
	create: orgProcedure
		.input(
			z
				.object({
					sourceType: z.nativeEnum(JobSourceType),
					workOrderId: z.string().optional(),
					violationId: z.string().optional(),
					arcRequestId: z.string().optional(),
					customerId: z.string().optional(),
					unitId: z.string().optional(),
					propertyId: z.string().optional(),
					associationId: z.string().optional(),
					addressLine1: z.string().max(255).optional(),
					addressLine2: z.string().max(255).optional(),
					city: z.string().max(100).optional(),
					state: z.string().max(100).optional(),
					postalCode: z.string().max(20).optional(),
					locationNotes: z.string().optional(),
					title: z.string().min(1).max(255),
					description: z.string().optional(),
					category: z.string().max(100).optional(),
					priority: JobPrioritySchema.default('MEDIUM'),
					estimatedHours: z.number().positive().optional(),
					estimatedCost: z.number().nonnegative().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job', 'new');

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			// This ensures:
			// 1. Idempotency - same key returns same result
			// 2. Durability - workflow survives crashes
			// 3. Trace correlation - all DB operations are in same trace
			const result = await startJobCreateWorkflow(
				{
					organizationId: context.organization!.id,
					userId: context.user!.id,
					sourceType: input.sourceType,
					title: input.title,
					description: input.description,
					category: input.category,
					priority: input.priority,
					workOrderId: input.workOrderId,
					violationId: input.violationId,
					arcRequestId: input.arcRequestId,
					customerId: input.customerId,
					unitId: input.unitId,
					propertyId: input.propertyId,
					associationId: input.associationId,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2,
					city: input.city,
					state: input.state,
					postalCode: input.postalCode,
					locationNotes: input.locationNotes,
					estimatedHours: input.estimatedHours,
					estimatedCost: input.estimatedCost
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create job' });
			}

			// Fetch the created job for the response
			const job = await prisma.job.findFirstOrThrow({
				where: { id: result.jobId, organizationId: context.organization.id }
			});

			return successResponse({ job: formatJob(job) }, context);
		}),

	/**
	 * List jobs with pagination and filtering
	 */
	list: orgProcedure
		.input(
			z
				.object({
					status: z.nativeEnum(JobStatus).optional(),
					sourceType: z.nativeEnum(JobSourceType).optional(),
					customerId: z.string().optional(),
					assignedTechnicianId: z.string().optional(),
					search: z.string().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					jobs: z.array(jobOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			try {
				console.log(`[Job.list] Request from user ${context.user?.id} for org ${context.organization?.id}`);

				await assertContractorOrg(context.organization!.id, errors);
				await context.cerbos.authorize('view', 'job', 'list');

				const limit = input?.limit ?? 20;
				const cursor = input?.cursor;

				const where = {
					organizationId: context.organization!.id,
					deletedAt: null,
					...(input?.status && { status: input.status }),
					...(input?.sourceType && { sourceType: input.sourceType }),
					...(input?.customerId && { customerId: input.customerId }),
					...(input?.assignedTechnicianId && { assignedTechnicianId: input.assignedTechnicianId }),
					...(input?.search && {
						OR: [
							{ jobNumber: { contains: input.search, mode: 'insensitive' as const } },
							{ title: { contains: input.search, mode: 'insensitive' as const } }
						]
					})
				};

				const jobs = await prisma.job.findMany({
					where,
					take: limit + 1,
					...(cursor && { cursor: { id: cursor }, skip: 1 }),
					orderBy: { createdAt: 'desc' }
				});

				const hasMore = jobs.length > limit;
				if (hasMore) jobs.pop();

				const nextCursor = hasMore ? jobs[jobs.length - 1]?.id ?? null : null;

				const formattedJobs = jobs.map(formatJob);

				return successResponse(
					{
						jobs: formattedJobs,
						pagination: { nextCursor, hasMore }
					},
					context
				);
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error));
				console.error('[Job.list] Error:', error);

				await recordSpanError(errorObj, {
					errorCode: 'JOB_LIST_FAILED',
					errorType: 'Job_List_Error'
				});

				// If it's already one of our typed errors, just rethrow
				if (typeof error === 'object' && error !== null && 'code' in error && 'status' in error) {
					throw error;
				}
				throw errors.INTERNAL_SERVER_ERROR({ message: error instanceof Error ? error.message : 'Unknown error during job listing' });
			}
		}),

	/**
	 * Get a job by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id, errors);
			return successResponse({ job: formatJob(job) }, context);
		}),

	/**
	 * Update job details
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					title: z.string().min(1).max(255).optional(),
					description: z.string().nullable().optional(),
					category: z.string().max(100).nullable().optional(),
					priority: JobPrioritySchema.optional(),
					addressLine1: z.string().max(255).nullable().optional(),
					addressLine2: z.string().max(255).nullable().optional(),
					city: z.string().max(100).nullable().optional(),
					state: z.string().max(100).nullable().optional(),
					postalCode: z.string().max(20).nullable().optional(),
					locationNotes: z.string().nullable().optional(),
					estimatedHours: z.number().positive().nullable().optional(),
					estimatedCost: z.number().nonnegative().nullable().optional(),
					warrantyNotes: z.string().nullable().optional(),
					resolutionNotes: z.string().nullable().optional()
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
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'job', input.id);

			await getJobOrThrow(input.id, context.organization!.id, errors);

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.UPDATE_JOB,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.id,
					data
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update job' });
			}

			const job = await prisma.job.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			return successResponse({ job: formatJob(job) }, context);
		}),

	/**
	 * Transition job status
	 */
	transitionStatus: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					toStatus: z.nativeEnum(JobStatus),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status transition' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('transition_status', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id, errors);

			// Validate transition
			const allowedTransitions = JOB_TRANSITIONS[job.status];
			if (!allowedTransitions.includes(input.toStatus)) {
				throw errors.BAD_REQUEST({ message: `Cannot transition from ${job.status} to ${input.toStatus}` });
			}

			// Phase 15: Additional validation guards for specific transitions
			if (input.toStatus === JobStatus.ESTIMATE_SENT) {
				// Validate at least one estimate exists for this job
				const estimateCount = await prisma.estimate.count({
					where: { jobId: input.id, organizationId: context.organization.id, status: { in: ['DRAFT', 'SENT', 'VIEWED'] } }
				});
				if (estimateCount === 0) {
					throw errors.BAD_REQUEST({ message: 'Cannot send estimate: no estimate exists for this job' });
				}
			}

			if (input.toStatus === JobStatus.DISPATCHED) {
				// Validate technician is assigned
				if (!job.assignedTechnicianId) {
					throw errors.BAD_REQUEST({ message: 'Cannot dispatch: no technician assigned to this job' });
				}
			}

			if (input.toStatus === JobStatus.INVOICED) {
				// Validate at least one invoice exists for this job
				const invoiceCount = await prisma.jobInvoice.count({
					where: { jobId: input.id, status: { not: 'VOID' } }
				});
				if (invoiceCount === 0) {
					throw errors.BAD_REQUEST({ message: 'Cannot mark as invoiced: no invoice exists for this job' });
				}
			}

			if (input.toStatus === JobStatus.PAID) {
				// Validate all invoices are paid (balance due = 0)
				const unpaidInvoices = await prisma.jobInvoice.findFirst({
					where: {
						jobId: input.id,
						status: { notIn: ['PAID', 'VOID'] },
						balanceDue: { gt: 0 }
					}
				});
				if (unpaidInvoices) {
					throw errors.BAD_REQUEST({ message: 'Cannot mark as paid: outstanding invoice balance exists' });
				}
			}

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.TRANSITION_STATUS,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.id,
					data: { toStatus: input.toStatus, notes: input.notes }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to transition job status' });
			}

			const updatedJob = await prisma.job.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			// Record activity event
			await recordStatusChange(context, ActivityEntityType.JOB, updatedJob.id, job.status, input.toStatus,
				`Job status changed from ${job.status} to ${input.toStatus}${input.notes ? `: ${input.notes}` : ''}`,
				{ jobId: updatedJob.id }
			);

			// Phase 15.7: Linked entity propagation is now handled by the jobWorkflow

			return successResponse({ job: formatJob(updatedJob) }, context);
		}),

	/**
	 * Assign technician to job
	 */
	assignTechnician: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					technicianId: z.string().nullable(),
					branchId: z.string().nullable().optional()
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
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('assign', 'job', input.id);

			await getJobOrThrow(input.id, context.organization!.id, errors);

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id,
						isActive: true
					}
				});
				if (!tech) throw errors.NOT_FOUND({ message: 'Technician' });
			}

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.ASSIGN_TECHNICIAN,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.id,
					data: { technicianId: input.technicianId, branchId: input.branchId }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to assign technician' });
			}

			const updatedJob = await prisma.job.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			// Record activity event
			if (input.technicianId) {
				await recordAssignment(context, ActivityEntityType.JOB, updatedJob.id, input.technicianId, 'Technician',
					`Technician assigned to job`,
					{ jobId: updatedJob.id, technicianId: input.technicianId }
				);
			} else {
				await recordExecution(context, {
					entityType: ActivityEntityType.JOB,
					entityId: updatedJob.id,
					action: ActivityActionType.UNASSIGN,
					summary: `Technician unassigned from job`,
					jobId: updatedJob.id
				});
			}

			return successResponse({ job: formatJob(updatedJob) }, context);
		}),

	/**
	 * Schedule a job
	 */
	schedule: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					scheduledStart: z.string().datetime(),
					scheduledEnd: z.string().datetime()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('schedule', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id, errors);

			// Validate job is in a schedulable state
			const schedulableStatuses: JobStatus[] = [JobStatus.JOB_CREATED, JobStatus.SCHEDULED, JobStatus.ON_HOLD];
			if (!schedulableStatuses.includes(job.status)) {
				throw errors.BAD_REQUEST({ message: `Cannot schedule job in ${job.status} status` });
			}

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.SCHEDULE_JOB,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.id,
					data: { scheduledStart: input.scheduledStart, scheduledEnd: input.scheduledEnd }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to schedule job' });
			}

			const updatedJob = await prisma.job.findFirstOrThrow({ where: { id: result.entityId, organizationId: context.organization.id } });

			return successResponse({ job: formatJob(updatedJob) }, context);
		}),

	/**
	 * Get job status history
	 */
	getStatusHistory: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					history: z.array(
						z.object({
							id: z.string(),
							fromStatus: z.nativeEnum(JobStatus).nullable(),
							toStatus: z.nativeEnum(JobStatus),
							changedBy: z.string(),
							changedAt: z.string(),
							notes: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const history = await prisma.jobStatusHistory.findMany({
				where: { jobId: input.jobId },
				orderBy: { changedAt: 'desc' }
			});

			return successResponse(
				{
					history: history.map((h) => ({
						id: h.id,
						fromStatus: h.fromStatus,
						toStatus: h.toStatus,
						changedBy: h.changedBy,
						changedAt: h.changedAt.toISOString(),
						notes: h.notes
					}))
				},
				context
			);
		}),

	/**
	 * Add a note to a job
	 */
	addNote: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					content: z.string().min(1),
					isInternal: z.boolean().default(false)
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
				data: z.object({ note: jobNoteOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_note', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.ADD_NOTE,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.jobId,
					data: { content: input.content, isInternal: input.isInternal }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add note' });
			}

			const note = await prisma.jobNote.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ note: formatNote(note) }, context);
		}),

	/**
	 * List notes for a job
	 */
	listNotes: orgProcedure
		.input(z.object({ jobId: z.string(), includeInternal: z.boolean().default(true) }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ notes: z.array(jobNoteOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_note', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const notes = await prisma.jobNote.findMany({
				where: {
					jobId: input.jobId,
					...(input.includeInternal ? {} : { isInternal: false })
				},
				orderBy: { createdAt: 'desc' }
			});

			return successResponse({ notes: notes.map(formatNote) }, context);
		}),

	/**
	 * Add an attachment to a job
	 */
	addAttachment: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					fileName: z.string().min(1).max(255),
					fileUrl: z.string().url(),
					fileSize: z.number().int().positive().optional(),
					mimeType: z.string().max(100).optional(),
					description: z.string().max(500).optional()
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
				data: z.object({ attachment: jobAttachmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_attachment', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.ADD_ATTACHMENT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.jobId,
					data: {
						fileName: input.fileName,
						storageUrl: input.fileUrl,
						fileSize: input.fileSize,
						fileType: input.mimeType,
						description: input.description
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add attachment' });
			}

			const attachment = await prisma.jobAttachment.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ attachment: formatAttachment(attachment) }, context);
		}),

	/**
	 * List attachments for a job
	 */
	listAttachments: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ attachments: z.array(jobAttachmentOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_attachment', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const attachments = await prisma.jobAttachment.findMany({
				where: { jobId: input.jobId },
				orderBy: { uploadedAt: 'desc' }
			});

			return successResponse({ attachments: attachments.map(formatAttachment) }, context);
		}),

	/**
	 * Delete an attachment
	 */
	deleteAttachment: orgProcedure
		.input(z.object({ jobId: z.string(), attachmentId: z.string() }).merge(IdempotencyKeySchema))
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
			await context.cerbos.authorize('delete', 'job_attachment', input.attachmentId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const attachment = await prisma.jobAttachment.findFirst({
				where: { id: input.attachmentId, jobId: input.jobId }
			});
			if (!attachment) throw errors.NOT_FOUND({ message: 'Attachment' });

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.DELETE_ATTACHMENT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.attachmentId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete attachment' });
			}

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Add a checkpoint to a job
	 */
	addCheckpoint: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					type: z.nativeEnum(CheckpointType),
					name: z.string().min(1).max(255),
					description: z.string().optional(),
					isRequired: z.boolean().default(true)
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
				data: z.object({ checkpoint: jobCheckpointOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_checkpoint', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.ADD_CHECKPOINT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.jobId,
					data: { type: input.type, description: input.description, isRequired: input.isRequired }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add checkpoint' });
			}

			const checkpoint = await prisma.jobCheckpoint.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ checkpoint: formatCheckpoint(checkpoint) }, context);
		}),

	/**
	 * Complete a checkpoint
	 */
	completeCheckpoint: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					checkpointId: z.string(),
					passed: z.boolean(),
					notes: z.string().optional()
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
				data: z.object({ checkpoint: jobCheckpointOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('complete', 'job_checkpoint', input.checkpointId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const checkpoint = await prisma.jobCheckpoint.findFirst({
				where: { id: input.checkpointId, jobId: input.jobId }
			});
			if (!checkpoint) throw errors.NOT_FOUND({ message: 'Checkpoint' });

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.COMPLETE_CHECKPOINT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.checkpointId,
					data: { notes: input.notes }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to complete checkpoint' });
			}

			const updated = await prisma.jobCheckpoint.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ checkpoint: formatCheckpoint(updated) }, context);
		}),

	/**
	 * List checkpoints for a job
	 */
	listCheckpoints: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checkpoints: z.array(jobCheckpointOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_checkpoint', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const checkpoints = await prisma.jobCheckpoint.findMany({
				where: { jobId: input.jobId },
				orderBy: { createdAt: 'asc' }
			});

			return successResponse({ checkpoints: checkpoints.map(formatCheckpoint) }, context);
		}),

	/**
	 * Add a visit to a job
	 */
	addVisit: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					scheduledStart: z.string().datetime(),
					scheduledEnd: z.string().datetime(),
					technicianId: z.string().optional(),
					notes: z.string().optional()
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
				data: z.object({ visit: jobVisitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'job_visit', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id,
						isActive: true
					}
				});
				if (!tech) throw errors.NOT_FOUND({ message: 'Technician' });
			}

			// Get next visit number
			const lastVisit = await prisma.jobVisit.findFirst({
				where: { jobId: input.jobId },
				orderBy: { visitNumber: 'desc' }
			});
			const visitNumber = (lastVisit?.visitNumber ?? 0) + 1;

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.ADD_VISIT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.jobId,
					data: {
						visitNumber,
						scheduledStart: input.scheduledStart,
						scheduledEnd: input.scheduledEnd,
						technicianId: input.technicianId,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add visit' });
			}

			const visit = await prisma.jobVisit.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ visit: formatVisit(visit) }, context);
		}),

	/**
	 * Update visit status
	 */
	updateVisitStatus: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					visitId: z.string(),
					status: JobVisitStatusSchema,
					actualStart: z.string().datetime().optional(),
					actualEnd: z.string().datetime().optional(),
					workPerformed: z.string().optional()
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
				data: z.object({ visit: jobVisitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'job_visit', input.visitId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const visit = await prisma.jobVisit.findFirst({
				where: { id: input.visitId, jobId: input.jobId }
			});
			if (!visit) throw errors.NOT_FOUND({ message: 'Visit' });

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.UPDATE_VISIT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					entityId: input.visitId,
					data: {
						status: input.status,
						actualStart: input.actualStart,
						actualEnd: input.actualEnd,
						notes: input.workPerformed
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update visit' });
			}

			const updated = await prisma.jobVisit.findFirstOrThrow({
				where: { id: result.entityId, job: { organizationId: context.organization.id } }
			});

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	/**
	 * List visits for a job
	 */
	listVisits: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visits: z.array(jobVisitOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'job_visit', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id, errors);

			const visits = await prisma.jobVisit.findMany({
				where: { jobId: input.jobId },
				orderBy: { visitNumber: 'asc' }
			});

			return successResponse({ visits: visits.map(formatVisit) }, context);
		}),

	/**
	 * Delete (soft) a job
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status for deletion' },
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
			await context.cerbos.authorize('delete', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id, errors);

			// Only allow deletion of jobs in certain states
			const deletableStatuses: JobStatus[] = [JobStatus.LEAD, JobStatus.TICKET, JobStatus.CANCELLED];
			if (!deletableStatuses.includes(job.status)) {
				throw errors.BAD_REQUEST({ message: `Cannot delete job in ${job.status} status` });
			}

			// Use DBOS workflow for durable execution
			const result = await startJobWorkflow(
				{
					action: JobAction.DELETE_JOB,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					jobId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete job' });
			}

			return successResponse({ deleted: true }, context);
		})
};
