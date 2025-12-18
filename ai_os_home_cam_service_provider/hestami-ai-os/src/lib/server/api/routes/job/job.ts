import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { JobStatus, JobSourceType, CheckpointType } from '../../../../../../generated/prisma/client.js';
import { recordExecution, recordStatusChange, recordAssignment } from '../../middleware/activityEvent.js';

// Valid state transitions for jobs
const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
	LEAD: ['TICKET', 'CANCELLED'],
	TICKET: ['ESTIMATE_REQUIRED', 'JOB_CREATED', 'CANCELLED'],
	ESTIMATE_REQUIRED: ['JOB_CREATED', 'CANCELLED'],
	JOB_CREATED: ['SCHEDULED', 'CANCELLED'],
	SCHEDULED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
	IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
	ON_HOLD: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
	COMPLETED: ['WARRANTY', 'CLOSED'],
	WARRANTY: ['CLOSED', 'IN_PROGRESS'],
	CLOSED: [],
	CANCELLED: []
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
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	closedAt: z.string().nullable(),
	closedBy: z.string().nullable(),
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
	startedAt: j.startedAt?.toISOString() ?? null,
	completedAt: j.completedAt?.toISOString() ?? null,
	closedAt: j.closedAt?.toISOString() ?? null,
	closedBy: j.closedBy,
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

async function generateJobNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.job.count({
		where: {
			organizationId,
			jobNumber: { startsWith: `JOB-${year}-` }
		}
	});
	return `JOB-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function getJobOrThrow(jobId: string, organizationId: string) {
	const job = await prisma.job.findFirst({
		where: { id: jobId, organizationId, deletedAt: null }
	});
	if (!job) throw ApiException.notFound('Job');
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
					priority: z.enum(['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
					estimatedHours: z.number().positive().optional(),
					estimatedCost: z.number().nonnegative().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job', 'new');

			const createJob = async () => {
				const jobNumber = await generateJobNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const job = await tx.job.create({
						data: {
							organizationId: context.organization!.id,
							jobNumber,
							status: input.sourceType === 'LEAD' ? 'LEAD' : 'TICKET',
							sourceType: input.sourceType,
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
							title: input.title,
							description: input.description,
							category: input.category,
							priority: input.priority,
							estimatedHours: input.estimatedHours,
							estimatedCost: input.estimatedCost
						}
					});

					// Record initial status
					await tx.jobStatusHistory.create({
						data: {
							jobId: job.id,
							toStatus: job.status,
							changedBy: context.user!.id
						}
					});

					return job;
				});
			};

			const job = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createJob)).result
				: await createJob();

			// Record activity event
			await recordExecution(context, {
				entityType: 'JOB',
				entityId: job.id,
				action: 'CREATE',
				summary: `Job created: ${job.title}`,
				jobId: job.id,
				newState: {
					jobNumber: job.jobNumber,
					title: job.title,
					status: job.status,
					sourceType: job.sourceType,
					priority: job.priority
				}
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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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

			return successResponse(
				{
					jobs: jobs.map(formatJob),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get a job by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id);
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
					priority: z.enum(['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW']).optional(),
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job', input.id);

			await getJobOrThrow(input.id, context.organization!.id);

			const updateJob = async () => {
				const { id, idempotencyKey, ...data } = input;
				return prisma.job.update({
					where: { id },
					data
				});
			};

			const job = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateJob)).result
				: await updateJob();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('transition_status', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id);

			// Validate transition
			const allowedTransitions = JOB_TRANSITIONS[job.status];
			if (!allowedTransitions.includes(input.toStatus)) {
				throw ApiException.badRequest(
					`Cannot transition from ${job.status} to ${input.toStatus}`
				);
			}

			const transitionJob = async () => {
				return prisma.$transaction(async (tx) => {
					const updateData: any = { status: input.toStatus };

					// Set timestamps based on status
					if (input.toStatus === 'IN_PROGRESS' && !job.startedAt) {
						updateData.startedAt = new Date();
					} else if (input.toStatus === 'COMPLETED') {
						updateData.completedAt = new Date();
					} else if (input.toStatus === 'CLOSED') {
						updateData.closedAt = new Date();
						updateData.closedBy = context.user!.id;
					}

					const updated = await tx.job.update({
						where: { id: input.id },
						data: updateData
					});

					await tx.jobStatusHistory.create({
						data: {
							jobId: input.id,
							fromStatus: job.status,
							toStatus: input.toStatus,
							changedBy: context.user!.id,
							notes: input.notes
						}
					});

					return updated;
				});
			};

			const updatedJob = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, transitionJob)).result
				: await transitionJob();

			// Record activity event
			await recordStatusChange(context, 'JOB', updatedJob.id, job.status, input.toStatus, 
				`Job status changed from ${job.status} to ${input.toStatus}${input.notes ? `: ${input.notes}` : ''}`,
				{ jobId: updatedJob.id }
			);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('assign', 'job', input.id);

			await getJobOrThrow(input.id, context.organization!.id);

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id,
						isActive: true
					}
				});
				if (!tech) throw ApiException.notFound('Technician');
			}

			const assignJob = async () => {
				return prisma.job.update({
					where: { id: input.id },
					data: {
						assignedTechnicianId: input.technicianId,
						assignedBranchId: input.branchId ?? null,
						assignedAt: input.technicianId ? new Date() : null,
						assignedBy: input.technicianId ? context.user!.id : null
					}
				});
			};

			const updatedJob = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, assignJob)).result
				: await assignJob();

			// Record activity event
			if (input.technicianId) {
				await recordAssignment(context, 'JOB', updatedJob.id, input.technicianId, 'Technician',
					`Technician assigned to job`,
					{ jobId: updatedJob.id, technicianId: input.technicianId }
				);
			} else {
				await recordExecution(context, {
					entityType: 'JOB',
					entityId: updatedJob.id,
					action: 'UNASSIGN',
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ job: jobOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('schedule', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id);

			// Validate job is in a schedulable state
			if (!['JOB_CREATED', 'SCHEDULED', 'ON_HOLD'].includes(job.status)) {
				throw ApiException.badRequest(`Cannot schedule job in ${job.status} status`);
			}

			const scheduleJob = async () => {
				return prisma.$transaction(async (tx) => {
					const updated = await tx.job.update({
						where: { id: input.id },
						data: {
							scheduledStart: new Date(input.scheduledStart),
							scheduledEnd: new Date(input.scheduledEnd),
							status: 'SCHEDULED'
						}
					});

					if (job.status !== 'SCHEDULED') {
						await tx.jobStatusHistory.create({
							data: {
								jobId: input.id,
								fromStatus: job.status,
								toStatus: 'SCHEDULED',
								changedBy: context.user!.id,
								notes: 'Job scheduled'
							}
						});
					}

					return updated;
				});
			};

			const updatedJob = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, scheduleJob)).result
				: await scheduleJob();

			return successResponse({ job: formatJob(updatedJob) }, context);
		}),

	/**
	 * Get job status history
	 */
	getStatusHistory: orgProcedure
		.input(z.object({ jobId: z.string() }))
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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ note: jobNoteOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_note', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id);

			const createNote = async () => {
				return prisma.jobNote.create({
					data: {
						jobId: input.jobId,
						authorId: context.user!.id,
						content: input.content,
						isInternal: input.isInternal
					}
				});
			};

			const note = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createNote)).result
				: await createNote();

			return successResponse({ note: formatNote(note) }, context);
		}),

	/**
	 * List notes for a job
	 */
	listNotes: orgProcedure
		.input(z.object({ jobId: z.string(), includeInternal: z.boolean().default(true) }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ notes: z.array(jobNoteOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_note', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ attachment: jobAttachmentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_attachment', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id);

			const createAttachment = async () => {
				return prisma.jobAttachment.create({
					data: {
						jobId: input.jobId,
						fileName: input.fileName,
						fileUrl: input.fileUrl,
						fileSize: input.fileSize,
						mimeType: input.mimeType,
						description: input.description,
						uploadedBy: context.user!.id
					}
				});
			};

			const attachment = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createAttachment)).result
				: await createAttachment();

			return successResponse({ attachment: formatAttachment(attachment) }, context);
		}),

	/**
	 * List attachments for a job
	 */
	listAttachments: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ attachments: z.array(jobAttachmentOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_attachment', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'job_attachment', input.attachmentId);

			await getJobOrThrow(input.jobId, context.organization!.id);

			const attachment = await prisma.jobAttachment.findFirst({
				where: { id: input.attachmentId, jobId: input.jobId }
			});
			if (!attachment) throw ApiException.notFound('Attachment');

			const deleteAttachment = async () => {
				await prisma.jobAttachment.delete({ where: { id: input.attachmentId } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteAttachment)).result
				: await deleteAttachment();

			return successResponse(result, context);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checkpoint: jobCheckpointOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_checkpoint', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id);

			const createCheckpoint = async () => {
				return prisma.jobCheckpoint.create({
					data: {
						jobId: input.jobId,
						type: input.type,
						name: input.name,
						description: input.description,
						isRequired: input.isRequired
					}
				});
			};

			const checkpoint = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createCheckpoint)).result
				: await createCheckpoint();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checkpoint: jobCheckpointOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('complete', 'job_checkpoint', input.checkpointId);

			await getJobOrThrow(input.jobId, context.organization!.id);

			const checkpoint = await prisma.jobCheckpoint.findFirst({
				where: { id: input.checkpointId, jobId: input.jobId }
			});
			if (!checkpoint) throw ApiException.notFound('Checkpoint');

			const completeCheckpoint = async () => {
				return prisma.jobCheckpoint.update({
					where: { id: input.checkpointId },
					data: {
						completedAt: new Date(),
						completedBy: context.user!.id,
						passed: input.passed,
						notes: input.notes
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, completeCheckpoint)).result
				: await completeCheckpoint();

			return successResponse({ checkpoint: formatCheckpoint(updated) }, context);
		}),

	/**
	 * List checkpoints for a job
	 */
	listCheckpoints: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ checkpoints: z.array(jobCheckpointOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_checkpoint', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: jobVisitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_visit', 'new');

			await getJobOrThrow(input.jobId, context.organization!.id);

			// Validate technician if provided
			if (input.technicianId) {
				const tech = await prisma.technician.findFirst({
					where: {
						id: input.technicianId,
						organizationId: context.organization!.id,
						isActive: true
					}
				});
				if (!tech) throw ApiException.notFound('Technician');
			}

			const createVisit = async () => {
				// Get next visit number
				const lastVisit = await prisma.jobVisit.findFirst({
					where: { jobId: input.jobId },
					orderBy: { visitNumber: 'desc' }
				});
				const visitNumber = (lastVisit?.visitNumber ?? 0) + 1;

				return prisma.jobVisit.create({
					data: {
						jobId: input.jobId,
						visitNumber,
						scheduledStart: new Date(input.scheduledStart),
						scheduledEnd: new Date(input.scheduledEnd),
						technicianId: input.technicianId,
						notes: input.notes
					}
				});
			};

			const visit = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createVisit)).result
				: await createVisit();

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
					status: z.enum(['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
					actualStart: z.string().datetime().optional(),
					actualEnd: z.string().datetime().optional(),
					workPerformed: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visit: jobVisitOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job_visit', input.visitId);

			await getJobOrThrow(input.jobId, context.organization!.id);

			const visit = await prisma.jobVisit.findFirst({
				where: { id: input.visitId, jobId: input.jobId }
			});
			if (!visit) throw ApiException.notFound('Visit');

			const updateVisit = async () => {
				return prisma.jobVisit.update({
					where: { id: input.visitId },
					data: {
						status: input.status,
						...(input.actualStart && { actualStart: new Date(input.actualStart) }),
						...(input.actualEnd && { actualEnd: new Date(input.actualEnd) }),
						...(input.workPerformed && { workPerformed: input.workPerformed })
					}
				});
			};

			const updated = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateVisit)).result
				: await updateVisit();

			return successResponse({ visit: formatVisit(updated) }, context);
		}),

	/**
	 * List visits for a job
	 */
	listVisits: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ visits: z.array(jobVisitOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_visit', input.jobId);

			await getJobOrThrow(input.jobId, context.organization!.id);

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'job', input.id);

			const job = await getJobOrThrow(input.id, context.organization!.id);

			// Only allow deletion of jobs in certain states
			if (!['LEAD', 'TICKET', 'CANCELLED'].includes(job.status)) {
				throw ApiException.badRequest(`Cannot delete job in ${job.status} status`);
			}

			const deleteJob = async () => {
				await prisma.job.update({
					where: { id: input.id },
					data: { deletedAt: new Date() }
				});
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteJob)).result
				: await deleteJob();

			return successResponse(result, context);
		})
};
