import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { JobPaymentStatus } from '../../../../../../generated/prisma/client.js';

const paymentIntentOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	invoiceId: z.string(),
	customerId: z.string(),
	amount: z.string(),
	currency: z.string(),
	status: z.nativeEnum(JobPaymentStatus),
	paymentMethod: z.string().nullable(),
	externalId: z.string().nullable(),
	externalProvider: z.string().nullable(),
	initiatedAt: z.string(),
	processedAt: z.string().nullable(),
	failedAt: z.string().nullable(),
	refundedAt: z.string().nullable(),
	errorCode: z.string().nullable(),
	errorMessage: z.string().nullable(),
	metadata: z.any().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const formatPaymentIntent = (p: any) => ({
	id: p.id,
	organizationId: p.organizationId,
	invoiceId: p.invoiceId,
	customerId: p.customerId,
	amount: p.amount.toString(),
	currency: p.currency,
	status: p.status,
	paymentMethod: p.paymentMethod,
	externalId: p.externalId,
	externalProvider: p.externalProvider,
	initiatedAt: p.initiatedAt.toISOString(),
	processedAt: p.processedAt?.toISOString() ?? null,
	failedAt: p.failedAt?.toISOString() ?? null,
	refundedAt: p.refundedAt?.toISOString() ?? null,
	errorCode: p.errorCode,
	errorMessage: p.errorMessage,
	metadata: p.metadata,
	createdAt: p.createdAt.toISOString(),
	updatedAt: p.updatedAt.toISOString()
});

export const paymentRouter = {
	/**
	 * Create a payment intent (stub - would integrate with Stripe/Square)
	 */
	createIntent: orgProcedure
		.input(
			z
				.object({
					invoiceId: z.string(),
					amount: z.number().positive(),
					currency: z.string().default('USD'),
					paymentMethod: z.string().optional(),
					metadata: z.any().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'payment_intent', 'new');

			// Validate invoice
			const invoice = await prisma.jobInvoice.findFirst({
				where: { id: input.invoiceId, organizationId: context.organization!.id }
			});
			if (!invoice) throw ApiException.notFound('Invoice');

			if (['PAID', 'VOID', 'REFUNDED'].includes(invoice.status)) {
				throw ApiException.badRequest('Cannot create payment for this invoice');
			}

			// Validate amount doesn't exceed balance
			if (input.amount > Number(invoice.balanceDue)) {
				throw ApiException.badRequest('Payment amount exceeds balance due');
			}

			const createIntent = async () => {
				// In production, this would call Stripe/Square API
				// For now, create a pending payment intent record
				return prisma.paymentIntent.create({
					data: {
						organizationId: context.organization!.id,
						invoiceId: input.invoiceId,
						customerId: invoice.customerId,
						amount: input.amount,
						currency: input.currency,
						paymentMethod: input.paymentMethod,
						metadata: input.metadata
						// externalId would be set after calling payment processor
					}
				});
			};

			const paymentIntent = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createIntent)).result
				: await createIntent();

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Get payment intent by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'payment_intent', input.id);

			const paymentIntent = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});

			if (!paymentIntent) throw ApiException.notFound('Payment intent');

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * List payment intents
	 */
	list: orgProcedure
		.input(
			z
				.object({
					invoiceId: z.string().optional(),
					customerId: z.string().optional(),
					status: z.nativeEnum(JobPaymentStatus).optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					paymentIntents: z.array(paymentIntentOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'payment_intent', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.invoiceId && { invoiceId: input.invoiceId }),
				...(input?.customerId && { customerId: input.customerId }),
				...(input?.status && { status: input.status })
			};

			const paymentIntents = await prisma.paymentIntent.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = paymentIntents.length > limit;
			if (hasMore) paymentIntents.pop();

			const nextCursor = hasMore ? paymentIntents[paymentIntents.length - 1]?.id ?? null : null;

			return successResponse(
				{
					paymentIntents: paymentIntents.map(formatPaymentIntent),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Process payment (stub - simulates successful payment)
	 */
	process: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('process', 'payment_intent', input.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Payment intent');

			if (existing.status !== 'PENDING') {
				throw ApiException.badRequest('Payment intent is not pending');
			}

			const processPayment = async () => {
				return prisma.$transaction(async (tx) => {
					// Update payment intent
					const paymentIntent = await tx.paymentIntent.update({
						where: { id: input.id },
						data: {
							status: 'SUCCEEDED',
							processedAt: new Date(),
							externalId: `sim_${Date.now()}` // Simulated external ID
						}
					});

					// Update invoice
					const invoice = await tx.jobInvoice.findUnique({
						where: { id: existing.invoiceId }
					});

					if (invoice) {
						const newAmountPaid = Number(invoice.amountPaid) + Number(existing.amount);
						const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid;
						const isPaid = newBalanceDue <= 0;

						await tx.jobInvoice.update({
							where: { id: invoice.id },
							data: {
								amountPaid: newAmountPaid,
								balanceDue: Math.max(0, newBalanceDue),
								status: isPaid ? 'PAID' : 'PARTIAL',
								paidAt: isPaid ? new Date() : null
							}
						});
					}

					return paymentIntent;
				});
			};

			const paymentIntent = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, processPayment)).result
				: await processPayment();

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Mark payment as failed
	 */
	markFailed: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					errorCode: z.string().optional(),
					errorMessage: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Payment intent');

			if (!['PENDING', 'PROCESSING'].includes(existing.status)) {
				throw ApiException.badRequest('Payment intent cannot be marked as failed');
			}

			const markFailed = async () => {
				return prisma.paymentIntent.update({
					where: { id: input.id },
					data: {
						status: 'FAILED',
						failedAt: new Date(),
						errorCode: input.errorCode,
						errorMessage: input.errorMessage
					}
				});
			};

			const paymentIntent = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, markFailed)).result
				: await markFailed();

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Refund payment (stub)
	 */
	refund: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					amount: z.number().positive().optional(), // Partial refund amount, or full if not specified
					reason: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('refund', 'payment_intent', input.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Payment intent');

			if (existing.status !== 'SUCCEEDED') {
				throw ApiException.badRequest('Can only refund succeeded payments');
			}

			const refundAmount = input.amount ?? Number(existing.amount);
			if (refundAmount > Number(existing.amount)) {
				throw ApiException.badRequest('Refund amount exceeds payment amount');
			}

			const refundPayment = async () => {
				return prisma.$transaction(async (tx) => {
					// Update payment intent
					const paymentIntent = await tx.paymentIntent.update({
						where: { id: input.id },
						data: {
							status: 'REFUNDED',
							refundedAt: new Date(),
							metadata: {
								...(existing.metadata as object ?? {}),
								refundAmount,
								refundReason: input.reason
							}
						}
					});

					// Update invoice
					const invoice = await tx.jobInvoice.findUnique({
						where: { id: existing.invoiceId }
					});

					if (invoice) {
						const newAmountPaid = Math.max(0, Number(invoice.amountPaid) - refundAmount);
						const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid;

						await tx.jobInvoice.update({
							where: { id: invoice.id },
							data: {
								amountPaid: newAmountPaid,
								balanceDue: newBalanceDue,
								status: newAmountPaid === 0 ? 'REFUNDED' : 'PARTIAL',
								paidAt: null
							}
						});
					}

					return paymentIntent;
				});
			};

			const paymentIntent = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, refundPayment)).result
				: await refundPayment();

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Cancel pending payment
	 */
	cancel: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Payment intent');

			if (existing.status !== 'PENDING') {
				throw ApiException.badRequest('Can only cancel pending payments');
			}

			const cancelPayment = async () => {
				return prisma.paymentIntent.update({
					where: { id: input.id },
					data: { status: 'CANCELLED' }
				});
			};

			const paymentIntent = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelPayment)).result
				: await cancelPayment();

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		})
};
