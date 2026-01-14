import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { ReportCategorySchema, ReportFormatSchema } from '../../schemas.js';
import { prisma } from '../../../db.js';
import { startReportDefinitionWorkflow } from '../../../workflows/reportDefinitionWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ReportDefinitionRoute');

const reportCategoryEnum = ReportCategorySchema;
const reportFormatEnum = ReportFormatSchema;

const getAssociationOrThrow = async (organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

export const reportDefinitionRouter = {
	/**
	 * Create a custom report definition
	 */
	create: orgProcedure
		.input(z.object({
			code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/),
			name: z.string().min(1).max(100),
			description: z.string().max(500).optional(),
			category: reportCategoryEnum,
			queryTemplate: z.string().min(1),
			parametersJson: z.string().optional(),
			columnsJson: z.string().optional(),
			defaultFormat: reportFormatEnum.optional(),
			allowedFormats: z.array(reportFormatEnum).optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				report: z.object({
					id: z.string(),
					code: z.string(),
					name: z.string(),
					category: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'report_definition', 'new');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startReportDefinitionWorkflow(
				{
					action: 'CREATE_REPORT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: {
						code: input.code,
						name: input.name,
						description: input.description,
						category: input.category,
						queryTemplate: input.queryTemplate,
						parametersJson: input.parametersJson,
						columnsJson: input.columnsJson,
						defaultFormat: input.defaultFormat,
						allowedFormats: input.allowedFormats
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create report' });
			}

			const report = await prisma.reportDefinition.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				report: {
					id: report.id,
					code: report.code,
					name: report.name,
					category: report.category
				}
			}, context);
		}),

	/**
	 * List available reports (system + custom)
	 */
	list: orgProcedure
		.input(z.object({
			category: reportCategoryEnum.optional(),
			isActive: z.boolean().optional(),
			pagination: PaginationInputSchema.optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				reports: z.array(z.object({
					id: z.string(),
					code: z.string(),
					name: z.string(),
					description: z.string().nullable(),
					category: z.string(),
					defaultFormat: z.string(),
					isSystemReport: z.boolean(),
					isActive: z.boolean()
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
			await context.cerbos.authorize('view', 'report_definition', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			const where: Record<string, unknown> = {
				OR: [
					{ associationId: association.id },
					{ isSystemReport: true, associationId: null }
				]
			};
			if (input?.category) where.category = input.category;
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const limit = input?.pagination?.limit ?? 50;
			const cursor = input?.pagination?.cursor;

			const reports = await prisma.reportDefinition.findMany({
				where,
				orderBy: [{ category: 'asc' }, { name: 'asc' }],
				take: limit + 1,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});

			const hasMore = reports.length > limit;
			const results = hasMore ? reports.slice(0, limit) : reports;

			return successResponse({
				reports: results.map(r => ({
					id: r.id,
					code: r.code,
					name: r.name,
					description: r.description,
					category: r.category,
					defaultFormat: r.defaultFormat,
					isSystemReport: r.isSystemReport,
					isActive: r.isActive
				})),
				pagination: {
					hasMore,
					nextCursor: hasMore ? results[results.length - 1].id : null
				}
			}, context);
		}),

	/**
	 * Get report definition details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				report: z.object({
					id: z.string(),
					code: z.string(),
					name: z.string(),
					description: z.string().nullable(),
					category: z.string(),
					queryTemplate: z.string(),
					parametersJson: z.string().nullable(),
					columnsJson: z.string().nullable(),
					defaultFormat: z.string(),
					allowedFormats: z.array(z.string()),
					isSystemReport: z.boolean(),
					isActive: z.boolean()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association or Report definition not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			const report = await prisma.reportDefinition.findFirst({
				where: {
					id: input.id,
					OR: [
						{ associationId: association.id },
						{ isSystemReport: true, associationId: null }
					]
				}
			});

			if (!report) throw errors.NOT_FOUND({ message: 'Report definition' });

			return successResponse({
				report: {
					id: report.id,
					code: report.code,
					name: report.name,
					description: report.description,
					category: report.category,
					queryTemplate: report.queryTemplate,
					parametersJson: report.parametersJson,
					columnsJson: report.columnsJson,
					defaultFormat: report.defaultFormat,
					allowedFormats: report.allowedFormats,
					isSystemReport: report.isSystemReport,
					isActive: report.isActive
				}
			}, context);
		}),

	/**
	 * Update a custom report definition
	 */
	update: orgProcedure
		.input(z.object({
			id: z.string(),
			name: z.string().min(1).max(100).optional(),
			description: z.string().max(500).nullable().optional(),
			queryTemplate: z.string().min(1).optional(),
			parametersJson: z.string().nullable().optional(),
			columnsJson: z.string().nullable().optional(),
			defaultFormat: reportFormatEnum.optional(),
			allowedFormats: z.array(reportFormatEnum).optional(),
			isActive: z.boolean().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				report: z.object({
					id: z.string(),
					name: z.string(),
					isActive: z.boolean()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startReportDefinitionWorkflow(
				{
					action: 'UPDATE_REPORT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					reportId: input.id,
					data: {
						name: input.name,
						description: input.description,
						queryTemplate: input.queryTemplate,
						parametersJson: input.parametersJson,
						columnsJson: input.columnsJson,
						defaultFormat: input.defaultFormat,
						allowedFormats: input.allowedFormats,
						isActive: input.isActive
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update report' });
			}

			const report = await prisma.reportDefinition.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				report: {
					id: report.id,
					name: report.name,
					isActive: report.isActive
				}
			}, context);
		}),

	/**
	 * Delete a custom report definition
	 */
	delete: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startReportDefinitionWorkflow(
				{
					action: 'DELETE_REPORT',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					reportId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete report' });
			}

			return successResponse({ deleted: true }, context);
		})
};
