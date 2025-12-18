import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const reportFormatEnum = z.enum(['PDF', 'EXCEL', 'CSV', 'JSON', 'HTML']);
const executionStatusEnum = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

export const reportExecutionRouter = {
	/**
	 * Generate (execute) a report
	 */
	generate: orgProcedure
		.input(z.object({
			reportId: z.string(),
			parametersJson: z.string().optional(),
			format: reportFormatEnum.optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				execution: z.object({
					id: z.string(),
					reportId: z.string(),
					status: z.string(),
					format: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'report_execution', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const generateReport = async () => {
				// Verify report exists and is accessible
				const report = await prisma.reportDefinition.findFirst({
					where: {
						id: input.reportId,
						isActive: true,
						OR: [
							{ associationId: association.id },
							{ isSystemReport: true, associationId: null }
						]
					}
				});

				if (!report) throw ApiException.notFound('Report definition');

				const format = input.format || report.defaultFormat;
				if (!report.allowedFormats.includes(format)) {
					throw ApiException.badRequest(`Format ${format} is not allowed for this report`);
				}

				// Create execution record
				const execution = await prisma.reportExecution.create({
					data: {
						reportId: input.reportId,
						associationId: association.id,
						status: 'PENDING',
						parametersJson: input.parametersJson,
						format,
						executedBy: context.user!.id
					}
				});

				// In a full implementation, this would trigger async report generation
				// For now, we'll simulate immediate completion with stub data
				await prisma.reportExecution.update({
					where: { id: execution.id },
					data: {
						status: 'RUNNING',
						startedAt: new Date()
					}
				});

				// Stub: Mark as completed (real implementation would be async)
				setTimeout(async () => {
					try {
						await prisma.reportExecution.update({
							where: { id: execution.id },
							data: {
								status: 'COMPLETED',
								completedAt: new Date(),
								outputUrl: `/reports/${execution.id}.${format.toLowerCase()}`,
								rowCount: 0
							}
						});
					} catch {
						// Ignore errors in stub
					}
				}, 1000);

				return execution;
			};

			const execution = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, generateReport)).result
				: await generateReport();

			return successResponse({
				execution: {
					id: execution.id,
					reportId: execution.reportId,
					status: execution.status,
					format: execution.format
				}
			}, context);
		}),

	/**
	 * List report executions
	 */
	list: orgProcedure
		.input(z.object({
			reportId: z.string().optional(),
			status: executionStatusEnum.optional(),
			pagination: PaginationInputSchema.optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				executions: z.array(z.object({
					id: z.string(),
					reportId: z.string(),
					reportName: z.string(),
					status: z.string(),
					format: z.string(),
					startedAt: z.string().nullable(),
					completedAt: z.string().nullable(),
					outputUrl: z.string().nullable(),
					createdAt: z.string()
				})),
				pagination: z.object({
					hasMore: z.boolean(),
					nextCursor: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_execution', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			const where: Record<string, unknown> = { associationId: association.id };
			if (input?.reportId) where.reportId = input.reportId;
			if (input?.status) where.status = input.status;

			const limit = input?.pagination?.limit ?? 50;
			const cursor = input?.pagination?.cursor;

			const executions = await prisma.reportExecution.findMany({
				where,
				include: { report: { select: { name: true } } },
				orderBy: { createdAt: 'desc' },
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = executions.length > limit;
			const results = hasMore ? executions.slice(0, limit) : executions;

			return successResponse({
				executions: results.map(e => ({
					id: e.id,
					reportId: e.reportId,
					reportName: e.report.name,
					status: e.status,
					format: e.format,
					startedAt: e.startedAt?.toISOString() ?? null,
					completedAt: e.completedAt?.toISOString() ?? null,
					outputUrl: e.outputUrl,
					createdAt: e.createdAt.toISOString()
				})),
				pagination: {
					hasMore,
					nextCursor: hasMore ? results[results.length - 1].id : null
				}
			}, context);
		}),

	/**
	 * Get execution details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				execution: z.object({
					id: z.string(),
					reportId: z.string(),
					reportName: z.string(),
					status: z.string(),
					parametersJson: z.string().nullable(),
					format: z.string(),
					startedAt: z.string().nullable(),
					completedAt: z.string().nullable(),
					outputUrl: z.string().nullable(),
					outputSize: z.number().nullable(),
					rowCount: z.number().nullable(),
					errorMessage: z.string().nullable(),
					executedBy: z.string().nullable(),
					createdAt: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_execution', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const execution = await prisma.reportExecution.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { report: { select: { name: true } } }
			});

			if (!execution) throw ApiException.notFound('Report execution');

			return successResponse({
				execution: {
					id: execution.id,
					reportId: execution.reportId,
					reportName: execution.report.name,
					status: execution.status,
					parametersJson: execution.parametersJson,
					format: execution.format,
					startedAt: execution.startedAt?.toISOString() ?? null,
					completedAt: execution.completedAt?.toISOString() ?? null,
					outputUrl: execution.outputUrl,
					outputSize: execution.outputSize,
					rowCount: execution.rowCount,
					errorMessage: execution.errorMessage,
					executedBy: execution.executedBy,
					createdAt: execution.createdAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Cancel a pending/running execution
	 */
	cancel: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				execution: z.object({
					id: z.string(),
					status: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'report_execution', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const cancelExecution = async () => {
				const execution = await prisma.reportExecution.findFirst({
					where: { id: input.id, associationId: association.id }
				});

				if (!execution) throw ApiException.notFound('Report execution');
				if (!['PENDING', 'RUNNING'].includes(execution.status)) {
					throw ApiException.badRequest('Can only cancel pending or running executions');
				}

				return prisma.reportExecution.update({
					where: { id: input.id },
					data: { status: 'CANCELLED' }
				});
			};

			const execution = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelExecution)).result
				: await cancelExecution();

			return successResponse({
				execution: {
					id: execution.id,
					status: execution.status
				}
			}, context);
		})
};
