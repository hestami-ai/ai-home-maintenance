import { z } from 'zod';
import { orgProcedure, successResponse, PaginationInputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const reportCategoryEnum = z.enum([
	'FINANCIAL', 'RECEIVABLES', 'PAYABLES', 'OPERATIONAL', 'COMPLIANCE', 'GOVERNANCE', 'CUSTOM'
]);

const reportFormatEnum = z.enum(['PDF', 'EXCEL', 'CSV', 'JSON', 'HTML']);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'report_definition', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const createReport = async () => {
				// Check for duplicate code
				const existing = await prisma.reportDefinition.findFirst({
					where: { associationId: association.id, code: input.code }
				});
				if (existing) {
					throw ApiException.conflict('Report with this code already exists');
				}

				return prisma.reportDefinition.create({
					data: {
						associationId: association.id,
						code: input.code,
						name: input.name,
						description: input.description,
						category: input.category,
						queryTemplate: input.queryTemplate,
						parametersJson: input.parametersJson,
						columnsJson: input.columnsJson,
						defaultFormat: input.defaultFormat || 'PDF',
						allowedFormats: input.allowedFormats || ['PDF', 'EXCEL', 'CSV'],
						isSystemReport: false
					}
				});
			};

			const report = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createReport)).result
				: await createReport();

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_definition', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const report = await prisma.reportDefinition.findFirst({
				where: {
					id: input.id,
					OR: [
						{ associationId: association.id },
						{ isSystemReport: true, associationId: null }
					]
				}
			});

			if (!report) throw ApiException.notFound('Report definition');

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const updateReport = async () => {
				const existing = await prisma.reportDefinition.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Report definition');
				if (existing.isSystemReport) {
					throw ApiException.forbidden('Cannot modify system reports');
				}

				return prisma.reportDefinition.update({
					where: { id: input.id },
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
				});
			};

			const report = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateReport)).result
				: await updateReport();

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'report_definition', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const deleteReport = async () => {
				const existing = await prisma.reportDefinition.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Report definition');
				if (existing.isSystemReport) {
					throw ApiException.forbidden('Cannot delete system reports');
				}

				await prisma.reportDefinition.delete({ where: { id: input.id } });
				return true;
			};

			input.idempotencyKey
				? await withIdempotency(input.idempotencyKey, context, deleteReport)
				: await deleteReport();

			return successResponse({ deleted: true }, context);
		})
};
