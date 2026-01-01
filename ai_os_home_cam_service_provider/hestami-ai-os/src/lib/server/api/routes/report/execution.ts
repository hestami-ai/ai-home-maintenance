import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startReportExecutionWorkflow } from '../../../workflows/reportExecutionWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ReportExecutionRoute');

const reportFormatEnum = z.enum(['PDF', 'EXCEL', 'CSV', 'JSON', 'HTML']);
const executionStatusEnum = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

const getAssociationOrThrow = async (organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
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
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'report_execution', 'new');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startReportExecutionWorkflow(
				{
					action: 'GENERATE_REPORT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: {
						reportId: input.reportId,
						parametersJson: input.parametersJson,
						format: input.format
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to generate report' });
			}

			const execution = await prisma.reportExecution.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'report_execution', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Association or Report execution not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'report_execution', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			const execution = await prisma.reportExecution.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { report: { select: { name: true } } }
			});

			if (!execution) throw errors.NOT_FOUND({ message: 'Report execution' });

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
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'report_execution', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startReportExecutionWorkflow(
				{
					action: 'CANCEL_EXECUTION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					executionId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel execution' });
			}

			const execution = await prisma.reportExecution.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				execution: {
					id: execution.id,
					status: execution.status
				}
			}, context);
		})
};
