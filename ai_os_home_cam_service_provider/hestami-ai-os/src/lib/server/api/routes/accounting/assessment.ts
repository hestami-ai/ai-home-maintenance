import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { AssessmentFrequencySchema, ChargeStatusSchema } from '../../schemas.js';
import { startAssessmentWorkflow, AssessmentWorkflowAction } from '../../../workflows/index.js';

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
				idempotencyKey: z.string().uuid(),
				name: z.string().min(1).max(255),
				description: z.string().max(500).optional(),
				code: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
				frequency: AssessmentFrequencySchema,
				defaultAmount: z.number().positive(),
				revenueAccountId: z.string(),
				lateFeeAccountId: z.string().optional(),
				lateFeeAmount: z.number().min(0).optional(),
				lateFeePercent: z.number().min(0).max(100).optional(),
				gracePeriodDays: z.number().int().min(0).max(90).default(15),
				prorateOnTransfer: z.boolean().default(true)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'assessment_type', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate revenue account
			const revenueAccount = await prisma.gLAccount.findFirst({
				where: { id: input.revenueAccountId, associationId: association.id, accountType: 'REVENUE' }
			});
			if (!revenueAccount) {
				throw errors.NOT_FOUND({ message: 'Revenue GL Account not found' });
			}

			// Validate late fee account if provided
			if (input.lateFeeAccountId) {
				const lateFeeAccount = await prisma.gLAccount.findFirst({
					where: { id: input.lateFeeAccountId, associationId: association.id, accountType: 'REVENUE' }
				});
				if (!lateFeeAccount) {
					throw errors.NOT_FOUND({ message: 'Late Fee GL Account not found' });
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
				throw errors.CONFLICT({ message: 'Assessment type code already exists' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startAssessmentWorkflow(
				{
					action: AssessmentWorkflowAction.CREATE_TYPE,
					organizationId: context.organization.id,
					userId: context.user!.id,
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
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create assessment type' });
			}

			return successResponse(
				{
					assessmentType: {
						id: workflowResult.assessmentTypeId!,
						name: workflowResult.assessmentTypeName!,
						code: workflowResult.assessmentTypeCode!,
						frequency: input.frequency,
						defaultAmount: input.defaultAmount.toString()
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'assessment_type', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
				idempotencyKey: z.string().uuid(),
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'assessment_charge', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate unit belongs to this association
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId, organizationId: context.organization.id },
				include: { property: { include: { association: true } } }
			});

			if (!unit) {
				throw errors.NOT_FOUND({ message: 'Unit not found' });
			}

			// Validate assessment type
			const assessmentType = await prisma.assessmentType.findFirst({
				where: { id: input.assessmentTypeId, associationId: association.id }
			});

			if (!assessmentType) {
				throw errors.NOT_FOUND({ message: 'Assessment Type not found' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startAssessmentWorkflow(
				{
					action: AssessmentWorkflowAction.CREATE_CHARGE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					unitId: input.unitId,
					assessmentTypeId: input.assessmentTypeId,
					chargeDate: input.chargeDate,
					dueDate: input.dueDate,
					periodStart: input.periodStart,
					periodEnd: input.periodEnd,
					amount: input.amount,
					description: input.description,
					postToGL: input.postToGL
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create assessment charge' });
			}

			return successResponse(
				{
					charge: {
						id: workflowResult.chargeId!,
						amount: workflowResult.chargeAmount!,
						dueDate: workflowResult.chargeDueDate!,
						status: workflowResult.chargeStatus!
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
				status: ChargeStatusSchema.optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
			}).optional()
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'assessment_charge', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'assessment_charge', input.unitId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
					association: { organizationId: context.organization.id },
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
