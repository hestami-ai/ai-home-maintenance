import { z } from 'zod';
import { ResponseMetaSchema, NoticeTypeSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { startNoticeTemplateWorkflow } from '../../../workflows/noticeTemplateWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('NoticeTemplateRoute');

const noticeTypeEnum = NoticeTypeSchema;

const getAssociationOrThrow = async (organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

export const noticeTemplateRouter = {
	/**
	 * Create a notice template
	 */
	create: orgProcedure
		.input(z.object({
			name: z.string().min(1).max(100),
			noticeType: noticeTypeEnum,
			subject: z.string().min(1).max(255),
			bodyTemplate: z.string().min(1),
			defaultCurePeriodDays: z.number().int().min(1).max(365).optional(),
			idempotencyKey: z.string().min(1)
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				template: z.object({
					id: z.string(),
					name: z.string(),
					noticeType: z.string(),
					subject: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'notice_template', 'new');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startNoticeTemplateWorkflow(
				{
					action: 'CREATE_TEMPLATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: {
						name: input.name,
						noticeType: input.noticeType,
						subject: input.subject,
						bodyTemplate: input.bodyTemplate,
						defaultCurePeriodDays: input.defaultCurePeriodDays
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create notice template' });
			}

			const template = await prisma.noticeTemplate.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({
				template: {
					id: template.id,
					name: template.name,
					noticeType: template.noticeType,
					subject: template.subject
				}
			}, context);
		}),

	/**
	 * List notice templates
	 */
	list: orgProcedure
		.input(z.object({
			noticeType: noticeTypeEnum.optional(),
			isActive: z.boolean().optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				templates: z.array(z.object({
					id: z.string(),
					name: z.string(),
					noticeType: z.string(),
					subject: z.string(),
					defaultCurePeriodDays: z.number().nullable(),
					isActive: z.boolean()
				}))
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'notice_template', '*');
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			const where: Record<string, unknown> = { associationId: association.id };
			if (input?.noticeType) where.noticeType = input.noticeType;
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const templates = await prisma.noticeTemplate.findMany({
				where,
				orderBy: { name: 'asc' }
			});

			return successResponse({
				templates: templates.map(t => ({
					id: t.id,
					name: t.name,
					noticeType: t.noticeType,
					subject: t.subject,
					defaultCurePeriodDays: t.defaultCurePeriodDays,
					isActive: t.isActive
				}))
			}, context);
		}),

	/**
	 * Get a notice template by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				template: z.object({
					id: z.string(),
					name: z.string(),
					noticeType: z.string(),
					subject: z.string(),
					bodyTemplate: z.string(),
					defaultCurePeriodDays: z.number().nullable(),
					isActive: z.boolean(),
					createdAt: z.string(),
					updatedAt: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			const template = await prisma.noticeTemplate.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!template) throw errors.NOT_FOUND({ message: 'Notice template' });

			return successResponse({
				template: {
					id: template.id,
					name: template.name,
					noticeType: template.noticeType,
					subject: template.subject,
					bodyTemplate: template.bodyTemplate,
					defaultCurePeriodDays: template.defaultCurePeriodDays,
					isActive: template.isActive,
					createdAt: template.createdAt.toISOString(),
					updatedAt: template.updatedAt.toISOString()
				}
			}, context);
		}),

	/**
	 * Update a notice template
	 */
	update: orgProcedure
		.input(z.object({
			id: z.string(),
			name: z.string().min(1).max(100).optional(),
			subject: z.string().min(1).max(255).optional(),
			bodyTemplate: z.string().min(1).optional(),
			defaultCurePeriodDays: z.number().int().min(1).max(365).nullable().optional(),
			isActive: z.boolean().optional(),
			idempotencyKey: z.string().min(1)
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				template: z.object({
					id: z.string(),
					name: z.string(),
					isActive: z.boolean()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startNoticeTemplateWorkflow(
				{
					action: 'UPDATE_TEMPLATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					templateId: input.id,
					data: {
						name: input.name,
						subject: input.subject,
						bodyTemplate: input.bodyTemplate,
						defaultCurePeriodDays: input.defaultCurePeriodDays,
						isActive: input.isActive
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update notice template' });
			}

			const template = await prisma.noticeTemplate.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse({
				template: {
					id: template.id,
					name: template.name,
					isActive: template.isActive
				}
			}, context);
		}),

	/**
	 * Delete a notice template (soft delete by deactivating)
	 */
	delete: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().min(1)
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: ResponseMetaSchema
		}))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startNoticeTemplateWorkflow(
				{
					action: 'DELETE_TEMPLATE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					templateId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete notice template' });
			}

			return successResponse({ deleted: true }, context);
		})
};
