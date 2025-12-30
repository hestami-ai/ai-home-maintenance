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
import { assertContractorOrg } from '../contractor/utils.js';
import { SLAPriority } from '../../../../../../generated/prisma/client.js';
import { startSLAWorkflow } from '../../../workflows/slaWorkflow.js';

const slaWindowOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	priority: z.nativeEnum(SLAPriority),
	responseTimeMinutes: z.number(),
	resolutionTimeMinutes: z.number(),
	businessHoursOnly: z.boolean(),
	jobCategory: z.string().nullable(),
	isDefault: z.boolean(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const slaRecordOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	slaWindowId: z.string(),
	responseDue: z.string(),
	resolutionDue: z.string(),
	respondedAt: z.string().nullable(),
	resolvedAt: z.string().nullable(),
	responseBreached: z.boolean(),
	resolutionBreached: z.boolean(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatSLAWindow = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	name: s.name,
	description: s.description,
	priority: s.priority,
	responseTimeMinutes: s.responseTimeMinutes,
	resolutionTimeMinutes: s.resolutionTimeMinutes,
	businessHoursOnly: s.businessHoursOnly,
	jobCategory: s.jobCategory,
	isDefault: s.isDefault,
	isActive: s.isActive,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

const formatSLARecord = (s: any) => ({
	id: s.id,
	organizationId: s.organizationId,
	jobId: s.jobId,
	slaWindowId: s.slaWindowId,
	responseDue: s.responseDue.toISOString(),
	resolutionDue: s.resolutionDue.toISOString(),
	respondedAt: s.respondedAt?.toISOString() ?? null,
	resolvedAt: s.resolvedAt?.toISOString() ?? null,
	responseBreached: s.responseBreached,
	resolutionBreached: s.resolutionBreached,
	notes: s.notes,
	createdAt: s.createdAt.toISOString(),
	updatedAt: s.updatedAt.toISOString()
});

export const slaRouter = {
	/**
	 * Create an SLA window configuration
	 */
	createWindow: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1).max(255),
					description: z.string().optional(),
					priority: z.nativeEnum(SLAPriority),
					responseTimeMinutes: z.number().int().positive(),
					resolutionTimeMinutes: z.number().int().positive(),
					businessHoursOnly: z.boolean().default(true),
					jobCategory: z.string().max(100).optional(),
					isDefault: z.boolean().default(false)
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
				data: z.object({ slaWindow: slaWindowOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'sla_window', 'new');

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'CREATE_WINDOW',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						name: input.name,
						description: input.description,
						priority: input.priority,
						responseMinutes: input.responseTimeMinutes,
						resolutionMinutes: input.resolutionTimeMinutes,
						businessHoursOnly: input.businessHoursOnly,
						jobCategory: input.jobCategory,
						isDefault: input.isDefault
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create SLA window' });
			}

			const slaWindow = await prisma.sLAWindow.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ slaWindow: formatSLAWindow(slaWindow) }, context);
		}),

	/**
	 * List SLA windows
	 */
	listWindows: orgProcedure
		.input(
			z
				.object({
					priority: z.nativeEnum(SLAPriority).optional(),
					isActive: z.boolean().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					slaWindows: z.array(slaWindowOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'sla_window', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.priority && { priority: input.priority }),
				...(input?.isActive !== undefined && { isActive: input.isActive })
			};

			const windows = await prisma.sLAWindow.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { priority: 'asc' }
			});

			const hasMore = windows.length > limit;
			if (hasMore) windows.pop();

			const nextCursor = hasMore ? windows[windows.length - 1]?.id ?? null : null;

			return successResponse(
				{
					slaWindows: windows.map(formatSLAWindow),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Get an SLA window by ID
	 */
	getWindow: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaWindow: slaWindowOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'sla_window', input.id);

			const slaWindow = await prisma.sLAWindow.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!slaWindow) throw errors.NOT_FOUND({ message: 'SLA Window not found' });

			return successResponse({ slaWindow: formatSLAWindow(slaWindow) }, context);
		}),

	/**
	 * Update an SLA window
	 */
	updateWindow: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).max(255).optional(),
					description: z.string().nullable().optional(),
					responseTimeMinutes: z.number().int().positive().optional(),
					resolutionTimeMinutes: z.number().int().positive().optional(),
					businessHoursOnly: z.boolean().optional(),
					jobCategory: z.string().max(100).nullable().optional(),
					isDefault: z.boolean().optional(),
					isActive: z.boolean().optional()
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
				data: z.object({ slaWindow: slaWindowOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'sla_window', input.id);

			const existing = await prisma.sLAWindow.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'SLA Window not found' });

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'UPDATE_WINDOW',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					windowId: id,
					data
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update SLA window' });
			}

			const slaWindow = await prisma.sLAWindow.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ slaWindow: formatSLAWindow(slaWindow) }, context);
		}),

	/**
	 * Delete an SLA window
	 */
	deleteWindow: orgProcedure
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
			await context.cerbos.authorize('delete', 'sla_window', input.id);

			const existing = await prisma.sLAWindow.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'SLA Window not found' });

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'DELETE_WINDOW',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					windowId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete SLA window' });
			}

			return successResponse({ deleted: true }, context);
		}),

	/**
	 * Apply SLA to a job
	 */
	applyToJob: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					slaWindowId: z.string().optional(), // If not provided, uses default for job priority
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
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'sla_record', 'new');

			// Get job
			const job = await prisma.job.findFirst({
				where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });

			// Check if SLA already exists
			const existingSLA = await prisma.sLARecord.findUnique({
				where: { jobId: input.jobId }
			});
			if (existingSLA) {
				throw errors.BAD_REQUEST({ message: 'Job already has an SLA record' });
			}

			// Get SLA window
			let slaWindow;
			if (input.slaWindowId) {
				slaWindow = await prisma.sLAWindow.findFirst({
					where: { id: input.slaWindowId, organizationId: context.organization!.id, isActive: true }
				});
			} else {
				// Find default for job priority
				const priorityMap: Record<string, SLAPriority> = {
					EMERGENCY: 'EMERGENCY',
					HIGH: 'HIGH',
					MEDIUM: 'STANDARD',
					LOW: 'LOW'
				};
				const priority = priorityMap[job.priority] ?? 'STANDARD';

				slaWindow = await prisma.sLAWindow.findFirst({
					where: {
						organizationId: context.organization!.id,
						priority,
						isDefault: true,
						isActive: true
					}
				});
			}

			if (!slaWindow) throw errors.NOT_FOUND({ message: 'SLA Window not found' });

			const now = new Date();
			const responseDue = new Date(now.getTime() + slaWindow.responseTimeMinutes * 60000);
			const resolutionDue = new Date(now.getTime() + slaWindow.resolutionTimeMinutes * 60000);

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'CREATE_RECORD',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						jobId: input.jobId,
						slaWindowId: slaWindow!.id,
						responseDue: responseDue.toISOString(),
						resolutionDue: resolutionDue.toISOString(),
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create SLA record' });
			}

			const slaRecord = await prisma.sLARecord.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	/**
	 * Get SLA record for a job
	 */
	getJobSLA: orgProcedure
		.input(z.object({ jobId: z.string() }))
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput.nullable() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'sla_record', input.jobId);

			const slaRecord = await prisma.sLARecord.findFirst({
				where: { jobId: input.jobId, organizationId: context.organization!.id }
			});

			return successResponse(
				{ slaRecord: slaRecord ? formatSLARecord(slaRecord) : null },
				context
			);
		}),

	/**
	 * Mark SLA response (job was acknowledged/responded to)
	 */
	markResponse: orgProcedure
		.input(z.object({ jobId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'sla_record', input.jobId);

			const existing = await prisma.sLARecord.findFirst({
				where: { jobId: input.jobId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'SLA Record not found' });

			if (existing.respondedAt) {
				throw errors.BAD_REQUEST({ message: 'SLA response already recorded' });
			}

			const now = new Date();
			const responseBreached = now > existing.responseDue;

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'MARK_RESPONSE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					recordId: existing.id,
					data: { responseBreached }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark SLA response' });
			}

			const slaRecord = await prisma.sLARecord.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	/**
	 * Mark SLA resolution (job was completed)
	 */
	markResolution: orgProcedure
		.input(z.object({ jobId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ slaRecord: slaRecordOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'sla_record', input.jobId);

			const existing = await prisma.sLARecord.findFirst({
				where: { jobId: input.jobId, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'SLA Record not found' });

			if (existing.resolvedAt) {
				throw errors.BAD_REQUEST({ message: 'SLA resolution already recorded' });
			}

			const now = new Date();
			const resolutionBreached = now > existing.resolutionDue;

			// Use DBOS workflow for durable execution
			const result = await startSLAWorkflow(
				{
					action: 'MARK_RESOLUTION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					recordId: existing.id,
					data: {
						resolutionBreached,
						alsoMarkResponse: !existing.respondedAt,
						responseBreached: now > existing.responseDue
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark SLA resolution' });
			}

			const slaRecord = await prisma.sLARecord.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ slaRecord: formatSLARecord(slaRecord) }, context);
		}),

	/**
	 * List SLA records with breach status
	 */
	listRecords: orgProcedure
		.input(
			z
				.object({
					breachedOnly: z.boolean().optional(),
					pendingOnly: z.boolean().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					slaRecords: z.array(slaRecordOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'sla_record', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id
			};

			if (input?.breachedOnly) {
				where.OR = [{ responseBreached: true }, { resolutionBreached: true }];
			}

			if (input?.pendingOnly) {
				where.resolvedAt = null;
			}

			const records = await prisma.sLARecord.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { resolutionDue: 'asc' }
			});

			const hasMore = records.length > limit;
			if (hasMore) records.pop();

			const nextCursor = hasMore ? records[records.length - 1]?.id ?? null : null;

			return successResponse(
				{
					slaRecords: records.map(formatSLARecord),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		})
};
