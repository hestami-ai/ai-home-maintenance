import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { PaymentMethodSchema, PaymentStatusSchema } from '../../schemas.js';
import { startPaymentWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('PaymentRoute');

/**
 * Payment management procedures (Accounts Receivable)
 */
export const paymentRouter = {
	/**
	 * Record a payment
	 */
	create: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				unitId: z.string(),
				paymentDate: z.string().datetime(),
				amount: z.number().positive(),
				paymentMethod: PaymentMethodSchema,
				referenceNumber: z.string().max(50).optional(),
				bankAccountId: z.string().optional(),
				payerName: z.string().max(255).optional(),
				payerPartyId: z.string().optional(),
				memo: z.string().max(500).optional(),
				// Auto-apply to oldest charges
				autoApply: z.boolean().default(true),
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
					payment: z.object({
						id: z.string(),
						amount: z.string(),
						appliedAmount: z.string(),
						unappliedAmount: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'payment', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate unit
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Unit not found' });
			}

			// Validate bank account if provided
			if (input.bankAccountId) {
				const bankAccount = await prisma.bankAccount.findFirst({
					where: { id: input.bankAccountId, associationId: association.id }
				});
				if (!bankAccount) {
					throw errors.NOT_FOUND({ message: 'Bank Account not found' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPaymentWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					unitId: input.unitId,
					paymentDate: input.paymentDate,
					amount: input.amount,
					paymentMethod: input.paymentMethod,
					referenceNumber: input.referenceNumber,
					bankAccountId: input.bankAccountId,
					payerName: input.payerName,
					payerPartyId: input.payerPartyId,
					memo: input.memo,
					autoApply: input.autoApply,
					postToGL: input.postToGL
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create payment' });
			}

			return successResponse(
				{
					payment: {
						id: workflowResult.paymentId!,
						amount: workflowResult.amount!,
						appliedAmount: workflowResult.appliedAmount!,
						unappliedAmount: workflowResult.unappliedAmount!,
						status: workflowResult.status!
					}
				},
				context
			);
		}),

	/**
	 * List payments
	 */
	list: orgProcedure
		.input(
			z.object({
				unitId: z.string().optional(),
				status: PaymentStatusSchema.optional(),
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
					payments: z.array(
						z.object({
							id: z.string(),
							unitId: z.string(),
							paymentDate: z.string(),
							amount: z.string(),
							paymentMethod: z.string(),
							referenceNumber: z.string().nullable(),
							appliedAmount: z.string(),
							unappliedAmount: z.string(),
							status: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'payment', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const where: Prisma.PaymentWhereInput = {
				associationId: association.id
			};

			if (input?.unitId) where.unitId = input.unitId;
			if (input?.status) where.status = input.status;
			if (input?.fromDate || input?.toDate) {
				where.paymentDate = {};
				if (input.fromDate) where.paymentDate.gte = new Date(input.fromDate);
				if (input.toDate) where.paymentDate.lte = new Date(input.toDate);
			}

			const payments = await prisma.payment.findMany({
				where,
				orderBy: { paymentDate: 'desc' }
			});

			return successResponse(
				{
					payments: payments.map((p) => ({
						id: p.id,
						unitId: p.unitId,
						paymentDate: p.paymentDate.toISOString(),
						amount: p.amount.toString(),
						paymentMethod: p.paymentMethod,
						referenceNumber: p.referenceNumber,
						appliedAmount: p.appliedAmount.toString(),
						unappliedAmount: p.unappliedAmount.toString(),
						status: p.status
					}))
				},
				context
			);
		}),

	/**
	 * Get payment details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					payment: z.object({
						id: z.string(),
						unitId: z.string(),
						paymentDate: z.string(),
						amount: z.string(),
						paymentMethod: z.string(),
						referenceNumber: z.string().nullable(),
						payerName: z.string().nullable(),
						memo: z.string().nullable(),
						appliedAmount: z.string(),
						unappliedAmount: z.string(),
						status: z.string(),
						applications: z.array(
							z.object({
								chargeId: z.string(),
								amount: z.string(),
								appliedAt: z.string()
							})
						)
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'payment', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const payment = await prisma.payment.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { applications: true }
			});

			if (!payment) {
				throw errors.NOT_FOUND({ message: 'Payment not found' });
			}

			return successResponse(
				{
					payment: {
						id: payment.id,
						unitId: payment.unitId,
						paymentDate: payment.paymentDate.toISOString(),
						amount: payment.amount.toString(),
						paymentMethod: payment.paymentMethod,
						referenceNumber: payment.referenceNumber,
						payerName: payment.payerName,
						memo: payment.memo,
						appliedAmount: payment.appliedAmount.toString(),
						unappliedAmount: payment.unappliedAmount.toString(),
						status: payment.status,
						applications: payment.applications.map((a) => ({
							chargeId: a.chargeId,
							amount: a.amount.toString(),
							appliedAt: a.appliedAt.toISOString()
						}))
					}
				},
				context
			);
		}),

	/**
	 * Void a payment
	 */
	void: orgProcedure
		.input(z.object({ idempotencyKey: z.string().uuid(), id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'payment', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const payment = await prisma.payment.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { applications: true }
			});

			if (!payment) {
				throw errors.NOT_FOUND({ message: 'Payment not found' });
			}

			if (payment.status === 'VOIDED') {
				throw errors.CONFLICT({ message: 'Payment already voided' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startPaymentWorkflow(
				{
					action: 'VOID',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					paymentId: input.id,
					applications: payment.applications.map((app) => ({
						chargeId: app.chargeId,
						amount: Number(app.amount)
					})),
					paymentAmount: Number(payment.amount)
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to void payment' });
			}

			return successResponse({ success: true }, context);
		})
};
