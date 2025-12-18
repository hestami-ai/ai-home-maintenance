import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { postPaymentToGL, reversePaymentGL } from '../../../accounting/index.js';

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
				unitId: z.string(),
				paymentDate: z.string().datetime(),
				amount: z.number().positive(),
				paymentMethod: z.enum(['CHECK', 'ACH', 'CREDIT_CARD', 'CASH', 'WIRE', 'OTHER']),
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'payment', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate unit
			const unit = await prisma.unit.findFirst({
				where: { id: input.unitId },
				include: { property: { include: { association: true } } }
			});

			if (!unit || unit.property.association.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Unit');
			}

			// Validate bank account if provided
			if (input.bankAccountId) {
				const bankAccount = await prisma.bankAccount.findFirst({
					where: { id: input.bankAccountId, associationId: association.id }
				});
				if (!bankAccount) {
					throw ApiException.notFound('Bank Account');
				}
			}

			// Create payment in transaction
			const result = await prisma.$transaction(async (tx) => {
				const payment = await tx.payment.create({
					data: {
						associationId: association.id,
						unitId: input.unitId,
						paymentDate: new Date(input.paymentDate),
						amount: input.amount,
						paymentMethod: input.paymentMethod,
						referenceNumber: input.referenceNumber,
						bankAccountId: input.bankAccountId,
						payerName: input.payerName,
						payerPartyId: input.payerPartyId,
						memo: input.memo,
						unappliedAmount: input.amount,
						status: 'PENDING'
					}
				});

				let appliedAmount = 0;

				// Auto-apply to oldest unpaid charges
				if (input.autoApply) {
					const unpaidCharges = await tx.assessmentCharge.findMany({
						where: {
							unitId: input.unitId,
							balanceDue: { gt: 0 },
							status: { in: ['BILLED', 'PARTIALLY_PAID'] }
						},
						orderBy: { dueDate: 'asc' }
					});

					let remainingAmount = input.amount;

					for (const charge of unpaidCharges) {
						if (remainingAmount <= 0) break;

						const balanceDue = Number(charge.balanceDue);
						const applyAmount = Math.min(remainingAmount, balanceDue);

						// Create payment application
						await tx.paymentApplication.create({
							data: {
								paymentId: payment.id,
								chargeId: charge.id,
								amount: applyAmount
							}
						});

						// Update charge
						const newPaidAmount = Number(charge.paidAmount) + applyAmount;
						const newBalanceDue = Number(charge.totalAmount) - newPaidAmount;
						const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

						await tx.assessmentCharge.update({
							where: { id: charge.id },
							data: {
								paidAmount: newPaidAmount,
								balanceDue: newBalanceDue,
								status: newStatus
							}
						});

						appliedAmount += applyAmount;
						remainingAmount -= applyAmount;
					}

					// Update payment with applied amounts
					await tx.payment.update({
						where: { id: payment.id },
						data: {
							appliedAmount,
							unappliedAmount: input.amount - appliedAmount
						}
					});
				}

				return {
					...payment,
					appliedAmount,
					unappliedAmount: input.amount - appliedAmount
				};
			});

			// Post to GL if requested
			if (input.postToGL) {
				try {
					await postPaymentToGL(result.id, context.user!.id);
				} catch (error) {
					// Log but don't fail - GL posting can be done later
					console.warn(`Failed to post payment ${result.id} to GL:`, error);
				}
			}

			return successResponse(
				{
					payment: {
						id: result.id,
						amount: result.amount.toString(),
						appliedAmount: result.appliedAmount.toString(),
						unappliedAmount: result.unappliedAmount.toString(),
						status: result.status
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
				status: z.enum(['PENDING', 'CLEARED', 'BOUNCED', 'REFUNDED', 'VOIDED']).optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
			}).optional()
		)
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'payment', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'payment', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const payment = await prisma.payment.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { applications: true }
			});

			if (!payment) {
				throw ApiException.notFound('Payment');
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
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'payment', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const payment = await prisma.payment.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { applications: true }
			});

			if (!payment) {
				throw ApiException.notFound('Payment');
			}

			if (payment.status === 'VOIDED') {
				throw ApiException.conflict('Payment already voided');
			}

			// Reverse all applications
			await prisma.$transaction(async (tx) => {
				for (const app of payment.applications) {
					const charge = await tx.assessmentCharge.findUnique({
						where: { id: app.chargeId }
					});

					if (charge) {
						const newPaidAmount = Math.max(0, Number(charge.paidAmount) - Number(app.amount));
						const newBalanceDue = Number(charge.totalAmount) - newPaidAmount;
						const newStatus = newPaidAmount === 0 ? 'BILLED' : 'PARTIALLY_PAID';

						await tx.assessmentCharge.update({
							where: { id: app.chargeId },
							data: {
								paidAmount: newPaidAmount,
								balanceDue: newBalanceDue,
								status: newStatus
							}
						});
					}
				}

				// Delete applications and void payment
				await tx.paymentApplication.deleteMany({
					where: { paymentId: input.id }
				});

				await tx.payment.update({
					where: { id: input.id },
					data: {
						status: 'VOIDED',
						appliedAmount: 0,
						unappliedAmount: payment.amount
					}
				});
			});

			// Reverse GL entry if it exists
			try {
				await reversePaymentGL(input.id, context.user!.id);
			} catch (error) {
				console.warn(`Failed to reverse GL for payment ${input.id}:`, error);
			}

			return successResponse({ success: true }, context);
		})
};
