import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { postAssessmentChargeToGL } from '../../../accounting/index.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('AssessmentRoute');

/**
 * Assessment management procedures
 */
export const assessmentRouter = {
	// =========================================================================
	// Assessment Types
	// =========================================================================

	/**
	 * Create assessment type
	 */
	createType: orgProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255),
				description: z.string().max(500).optional(),
				code: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
				frequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'ONE_TIME']),
				defaultAmount: z.number().positive(),
				revenueAccountId: z.string(),
				lateFeeAccountId: z.string().optional(),
				lateFeeAmount: z.number().min(0).optional(),
				lateFeePercent: z.number().min(0).max(100).optional(),
				gracePeriodDays: z.number().int().min(0).max(90).default(15),
				prorateOnTransfer: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					assessmentType: z.object({
						id: z.string(),
						name: z.string(),
						code: z.string(),
						frequency: z.string(),
						defaultAmount: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'assessment_type', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate revenue account
			const revenueAccount = await prisma.gLAccount.findFirst({
				where: { id: input.revenueAccountId, associationId: association.id, accountType: 'REVENUE' }
			});
			if (!revenueAccount) {
				throw ApiException.notFound('Revenue GL Account');
			}

			// Validate late fee account if provided
			if (input.lateFeeAccountId) {
				const lateFeeAccount = await prisma.gLAccount.findFirst({
					where: { id: input.lateFeeAccountId, associationId: association.id, accountType: 'REVENUE' }
				});
				if (!lateFeeAccount) {
					throw ApiException.notFound('Late Fee GL Account');
				}
			}

			// Check for duplicate code
			const existing = await prisma.assessmentType.findUnique({
				where: {
					associationId_code: {
						associationId: association.id,
						code: input.code
					}
				}
			});

			if (existing) {
				throw ApiException.conflict('Assessment type code already exists');
			}

			const assessmentType = await prisma.assessmentType.create({
				data: {
					associationId: association.id,
					name: input.name,
					description: input.description,
					code: input.code,
					frequency: input.frequency,
					defaultAmount: input.defaultAmount,
					revenueAccountId: input.revenueAccountId,
					lateFeeAccountId: input.lateFeeAccountId,
					lateFeeAmount: input.lateFeeAmount,
					lateFeePercent: input.lateFeePercent,
					gracePeriodDays: input.gracePeriodDays,
					prorateOnTransfer: input.prorateOnTransfer
				}
			});

			return successResponse(
				{
					assessmentType: {
						id: assessmentType.id,
						name: assessmentType.name,
						code: assessmentType.code,
						frequency: assessmentType.frequency,
						defaultAmount: assessmentType.defaultAmount.toString()
					}
				},
				context
			);
		}),

	/**
	 * List assessment types
	 */
	listTypes: orgProcedure
		.input(
			z.object({
				isActive: z.boolean().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					assessmentTypes: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							code: z.string(),
							frequency: z.string(),
							defaultAmount: z.string(),
							gracePeriodDays: z.number(),
							isActive: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'assessment_type', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.AssessmentTypeWhereInput = {
				associationId: association.id
			};

			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const types = await prisma.assessmentType.findMany({
				where,
				orderBy: { name: 'asc' }
			});

			return successResponse(
				{
					assessmentTypes: types.map((t) => ({
						id: t.id,
						name: t.name,
						code: t.code,
						frequency: t.frequency,
						defaultAmount: t.defaultAmount.toString(),
						gracePeriodDays: t.gracePeriodDays,
						isActive: t.isActive
					}))
				},
				context
			);
		}),

	// =========================================================================
	// Assessment Charges
	// =========================================================================

	/**
	 * Create assessment charge
	 */
	createCharge: orgProcedure
		.input(
			z.object({
				unitId: z.string(),
				assessmentTypeId: z.string(),
				chargeDate: z.string().datetime(),
				dueDate: z.string().datetime(),
				periodStart: z.string().datetime().optional(),
				periodEnd: z.string().datetime().optional(),
				amount: z.number().positive(),
				description: z.string().max(500).optional(),
				postToGL: z.boolean().default(true) // Auto-post to GL
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					charge: z.object({
						id: z.string(),
						amount: z.string(),
						dueDate: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'assessment_charge', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate unit belongs to this association
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Unit');
			}

			// Validate assessment type
			const assessmentType = await prisma.assessmentType.findFirst({
				where: { id: input.assessmentTypeId, associationId: association.id }
			});

			if (!assessmentType) {
				throw ApiException.notFound('Assessment Type');
			}

			const charge = await prisma.assessmentCharge.create({
				data: {
					associationId: association.id,
					unitId: input.unitId,
					assessmentTypeId: input.assessmentTypeId,
					chargeDate: new Date(input.chargeDate),
					dueDate: new Date(input.dueDate),
					periodStart: input.periodStart ? new Date(input.periodStart) : null,
					periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
					amount: input.amount,
					totalAmount: input.amount,
					balanceDue: input.amount,
					description: input.description,
					status: 'BILLED'
				}
			});

			// Post to GL if requested
			if (input.postToGL) {
				try {
					await postAssessmentChargeToGL(charge.id, context.user!.id);
				} catch (error) {
					// Log but don't fail - GL posting can be done later
					console.warn(`Failed to post charge ${charge.id} to GL:`, error);
				}
			}

			return successResponse(
				{
					charge: {
						id: charge.id,
						amount: charge.amount.toString(),
						dueDate: charge.dueDate.toISOString(),
						status: charge.status
					}
				},
				context
			);
		}),

	/**
	 * List charges for a unit
	 */
	listCharges: orgProcedure
		.input(
			z.object({
				unitId: z.string().optional(),
				status: z.enum(['PENDING', 'BILLED', 'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF', 'CREDITED']).optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					charges: z.array(
						z.object({
							id: z.string(),
							unitId: z.string(),
							assessmentTypeName: z.string(),
							chargeDate: z.string(),
							dueDate: z.string(),
							amount: z.string(),
							paidAmount: z.string(),
							balanceDue: z.string(),
							status: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'assessment_charge', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.AssessmentChargeWhereInput = {
				associationId: association.id
			};

			if (input?.unitId) where.unitId = input.unitId;
			if (input?.status) where.status = input.status;
			if (input?.fromDate || input?.toDate) {
				where.dueDate = {};
				if (input.fromDate) where.dueDate.gte = new Date(input.fromDate);
				if (input.toDate) where.dueDate.lte = new Date(input.toDate);
			}

			const charges = await prisma.assessmentCharge.findMany({
				where,
				include: { assessmentType: true },
				orderBy: { dueDate: 'desc' }
			});

			return successResponse(
				{
					charges: charges.map((c) => ({
						id: c.id,
						unitId: c.unitId,
						assessmentTypeName: c.assessmentType.name,
						chargeDate: c.chargeDate.toISOString(),
						dueDate: c.dueDate.toISOString(),
						amount: c.amount.toString(),
						paidAmount: c.paidAmount.toString(),
						balanceDue: c.balanceDue.toString(),
						status: c.status
					}))
				},
				context
			);
		}),

	/**
	 * Get unit's account balance
	 */
	getUnitBalance: orgProcedure
		.input(z.object({ unitId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unitId: z.string(),
					totalCharges: z.string(),
					totalPayments: z.string(),
					balance: z.string(),
					pastDueAmount: z.string()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'assessment_charge', input.unitId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Get all charges for the unit
			const charges = await prisma.assessmentCharge.findMany({
				where: {
					associationId: association.id,
					unitId: input.unitId,
					status: { notIn: ['WRITTEN_OFF', 'CREDITED'] }
				}
			});

			// Get all payments for the unit
			const payments = await prisma.payment.findMany({
				where: {
					associationId: association.id,
					unitId: input.unitId,
					status: { notIn: ['BOUNCED', 'VOIDED'] }
				}
			});

			const totalCharges = charges.reduce((sum, c) => sum + Number(c.totalAmount), 0);
			const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
			const balance = totalCharges - totalPayments;

			// Calculate past due
			const now = new Date();
			const pastDueAmount = charges
				.filter((c) => c.dueDate < now && Number(c.balanceDue) > 0)
				.reduce((sum, c) => sum + Number(c.balanceDue), 0);

			return successResponse(
				{
					unitId: input.unitId,
					totalCharges: totalCharges.toFixed(2),
					totalPayments: totalPayments.toFixed(2),
					balance: balance.toFixed(2),
					pastDueAmount: pastDueAmount.toFixed(2)
				},
				context
			);
		})
};
