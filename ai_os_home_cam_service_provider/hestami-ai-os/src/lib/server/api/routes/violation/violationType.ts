import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ViolationTypeRoute');

const violationSeverityEnum = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']);

/**
 * Violation Type configuration procedures
 */
export const violationTypeRouter = {
	/**
	 * Create a new violation type
	 */
	create: orgProcedure
		.input(
			z.object({
				code: z.string().min(1).max(50),
				name: z.string().min(1).max(255),
				description: z.string().max(1000).optional(),
				category: z.string().min(1).max(100),
				ccnrSection: z.string().max(100).optional(),
				ruleReference: z.string().max(255).optional(),
				defaultSeverity: violationSeverityEnum.default('MODERATE'),
				defaultCurePeriodDays: z.number().int().min(1).max(365).default(14),
				firstFineAmount: z.number().min(0).optional(),
				secondFineAmount: z.number().min(0).optional(),
				subsequentFineAmount: z.number().min(0).optional(),
				maxFineAmount: z.number().min(0).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violationType: z.object({
						id: z.string(),
						code: z.string(),
						name: z.string(),
						category: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'violation', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Check for duplicate code
			const existing = await prisma.violationType.findFirst({
				where: { associationId: association.id, code: input.code }
			});

			if (existing) {
				throw ApiException.conflict('Violation type code already exists');
			}

			const violationType = await prisma.violationType.create({
				data: {
					associationId: association.id,
					code: input.code,
					name: input.name,
					description: input.description,
					category: input.category,
					ccnrSection: input.ccnrSection,
					ruleReference: input.ruleReference,
					defaultSeverity: input.defaultSeverity,
					defaultCurePeriodDays: input.defaultCurePeriodDays,
					firstFineAmount: input.firstFineAmount,
					secondFineAmount: input.secondFineAmount,
					subsequentFineAmount: input.subsequentFineAmount,
					maxFineAmount: input.maxFineAmount
				}
			});

			return successResponse(
				{
					violationType: {
						id: violationType.id,
						code: violationType.code,
						name: violationType.name,
						category: violationType.category
					}
				},
				context
			);
		}),

	/**
	 * List violation types
	 */
	list: orgProcedure
		.input(
			z.object({
				category: z.string().optional(),
				isActive: z.boolean().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violationTypes: z.array(
						z.object({
							id: z.string(),
							code: z.string(),
							name: z.string(),
							category: z.string(),
							defaultSeverity: z.string(),
							defaultCurePeriodDays: z.number(),
							firstFineAmount: z.string().nullable(),
							isActive: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const violationTypes = await prisma.violationType.findMany({
				where: {
					associationId: association.id,
					...(input?.category && { category: input.category }),
					...(input?.isActive !== undefined && { isActive: input.isActive })
				},
				orderBy: [{ category: 'asc' }, { code: 'asc' }]
			});

			return successResponse(
				{
					violationTypes: violationTypes.map((vt) => ({
						id: vt.id,
						code: vt.code,
						name: vt.name,
						category: vt.category,
						defaultSeverity: vt.defaultSeverity,
						defaultCurePeriodDays: vt.defaultCurePeriodDays,
						firstFineAmount: vt.firstFineAmount?.toString() ?? null,
						isActive: vt.isActive
					}))
				},
				context
			);
		}),

	/**
	 * Get violation type by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violationType: z.object({
						id: z.string(),
						code: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						category: z.string(),
						ccnrSection: z.string().nullable(),
						ruleReference: z.string().nullable(),
						defaultSeverity: z.string(),
						defaultCurePeriodDays: z.number(),
						firstFineAmount: z.string().nullable(),
						secondFineAmount: z.string().nullable(),
						subsequentFineAmount: z.string().nullable(),
						maxFineAmount: z.string().nullable(),
						isActive: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const vt = await prisma.violationType.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!vt) {
				throw ApiException.notFound('Violation Type');
			}

			return successResponse(
				{
					violationType: {
						id: vt.id,
						code: vt.code,
						name: vt.name,
						description: vt.description,
						category: vt.category,
						ccnrSection: vt.ccnrSection,
						ruleReference: vt.ruleReference,
						defaultSeverity: vt.defaultSeverity,
						defaultCurePeriodDays: vt.defaultCurePeriodDays,
						firstFineAmount: vt.firstFineAmount?.toString() ?? null,
						secondFineAmount: vt.secondFineAmount?.toString() ?? null,
						subsequentFineAmount: vt.subsequentFineAmount?.toString() ?? null,
						maxFineAmount: vt.maxFineAmount?.toString() ?? null,
						isActive: vt.isActive
					}
				},
				context
			);
		}),

	/**
	 * Update violation type
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().max(1000).optional(),
				category: z.string().min(1).max(100).optional(),
				ccnrSection: z.string().max(100).optional(),
				ruleReference: z.string().max(255).optional(),
				defaultSeverity: violationSeverityEnum.optional(),
				defaultCurePeriodDays: z.number().int().min(1).max(365).optional(),
				firstFineAmount: z.number().min(0).optional(),
				secondFineAmount: z.number().min(0).optional(),
				subsequentFineAmount: z.number().min(0).optional(),
				maxFineAmount: z.number().min(0).optional(),
				isActive: z.boolean().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violationType: z.object({
						id: z.string(),
						code: z.string(),
						name: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const existing = await prisma.violationType.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!existing) {
				throw ApiException.notFound('Violation Type');
			}

			const { id, ...updateData } = input;

			const updated = await prisma.violationType.update({
				where: { id },
				data: updateData
			});

			return successResponse(
				{
					violationType: {
						id: updated.id,
						code: updated.code,
						name: updated.name
					}
				},
				context
			);
		})
};
