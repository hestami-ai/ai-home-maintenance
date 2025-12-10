import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const noticeTypeEnum = z.enum([
	'WARNING', 'FIRST_NOTICE', 'SECOND_NOTICE', 'FINAL_NOTICE',
	'FINE_NOTICE', 'HEARING_NOTICE', 'CURE_CONFIRMATION'
]);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
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
			idempotencyKey: z.string().optional()
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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'notice_template', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const createTemplate = async () => {
				// Check for duplicate name
				const existing = await prisma.noticeTemplate.findFirst({
					where: { associationId: association.id, name: input.name }
				});
				if (existing) {
					throw ApiException.conflict('Notice template with this name already exists');
				}

				return prisma.noticeTemplate.create({
					data: {
						associationId: association.id,
						name: input.name,
						noticeType: input.noticeType,
						subject: input.subject,
						bodyTemplate: input.bodyTemplate,
						defaultCurePeriodDays: input.defaultCurePeriodDays
					}
				});
			};

			const template = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createTemplate)).result
				: await createTemplate();

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'notice_template', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const template = await prisma.noticeTemplate.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!template) throw ApiException.notFound('Notice template');

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
			idempotencyKey: z.string().optional()
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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const updateTemplate = async () => {
				const existing = await prisma.noticeTemplate.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Notice template');

				// Check for duplicate name if changing
				if (input.name && input.name !== existing.name) {
					const duplicate = await prisma.noticeTemplate.findFirst({
						where: { associationId: association.id, name: input.name, id: { not: input.id } }
					});
					if (duplicate) {
						throw ApiException.conflict('Notice template with this name already exists');
					}
				}

				return prisma.noticeTemplate.update({
					where: { id: input.id },
					data: {
						name: input.name,
						subject: input.subject,
						bodyTemplate: input.bodyTemplate,
						defaultCurePeriodDays: input.defaultCurePeriodDays,
						isActive: input.isActive
					}
				});
			};

			const template = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateTemplate)).result
				: await updateTemplate();

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
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({ deleted: z.boolean() }),
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'notice_template', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const deleteTemplate = async () => {
				const existing = await prisma.noticeTemplate.findFirst({
					where: { id: input.id, associationId: association.id }
				});
				if (!existing) throw ApiException.notFound('Notice template');

				// Check if template is used in any sequence
				const usedInSequence = await prisma.noticeSequenceStep.findFirst({
					where: { templateId: input.id }
				});
				if (usedInSequence) {
					// Soft delete by deactivating
					await prisma.noticeTemplate.update({
						where: { id: input.id },
						data: { isActive: false }
					});
					return { softDeleted: true };
				}

				// Hard delete if not used
				await prisma.noticeTemplate.delete({ where: { id: input.id } });
				return { softDeleted: false };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteTemplate)).result
				: await deleteTemplate();

			return successResponse({ deleted: true }, context);
		})
};
