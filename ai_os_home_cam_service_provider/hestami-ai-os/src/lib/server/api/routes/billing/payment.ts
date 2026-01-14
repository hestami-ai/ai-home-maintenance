import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { JobPaymentStatus } from '../../../../../../generated/prisma/client.js';
import { startBillingWorkflow } from '../../../workflows/billingWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('BillingPaymentRoute');

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
	metadata: JsonSchema.nullable(),
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
					metadata: JsonSchema.optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('create', 'payment_intent', 'new');

			// Validate invoice
			const invoice = await prisma.jobInvoice.findFirst({
				where: { id: input.invoiceId, organizationId: context.organization.id }
			});
			if (!invoice) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (['PAID', 'VOID', 'REFUNDED'].includes(invoice.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot create payment for this invoice' });
			}

			// Validate amount doesn't exceed balance
			if (input.amount > Number(invoice.balanceDue)) {
				throw errors.BAD_REQUEST({ message: 'Payment amount exceeds balance due' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'CREATE_PAYMENT_INTENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						invoiceId: input.invoiceId,
						customerId: invoice.customerId,
						amount: input.amount,
						paymentMethod: input.paymentMethod
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create payment intent' });
			}

			const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Get payment intent by ID
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
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('view', 'payment_intent', input.id);

			const paymentIntent = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});

			if (!paymentIntent) throw errors.NOT_FOUND({ message: 'Payment intent not found' });

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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('view', 'payment_intent', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization.id,
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('process', 'payment_intent', input.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Payment intent not found' });

			if (existing.status !== 'PENDING') {
				throw errors.BAD_REQUEST({ message: 'Payment intent is not pending' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'PROCESS_PAYMENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to process payment' });
			}

			const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'payment_intent', input.id);
			await assertContractorOrg(context.organization.id, errors);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Payment intent not found' });

			if (!['PENDING', 'PROCESSING'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Payment intent cannot be marked as failed' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'MARK_PAYMENT_FAILED',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: { reason: input.errorMessage }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to mark payment as failed' });
			}

			const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
				where: { id: result.entityId }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('refund', 'payment_intent', input.id);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Payment intent not found' });

			if (existing.status !== 'SUCCEEDED') {
				throw errors.BAD_REQUEST({ message: 'Can only refund succeeded payments' });
			}

			const refundAmount = input.amount ?? Number(existing.amount);
			if (refundAmount > Number(existing.amount)) {
				throw errors.BAD_REQUEST({ message: 'Refund amount exceeds payment amount' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'REFUND_PAYMENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: { refundAmount }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to refund payment' });
			}

			const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		}),

	/**
	 * Cancel pending payment
	 */
	cancel: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ paymentIntent: paymentIntentOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'payment_intent', input.id);
			await assertContractorOrg(context.organization.id, errors);

			const existing = await prisma.paymentIntent.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Payment intent not found' });

			if (existing.status !== 'PENDING') {
				throw errors.BAD_REQUEST({ message: 'Can only cancel pending payments' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'CANCEL_PAYMENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel payment' });
			}

			const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({ paymentIntent: formatPaymentIntent(paymentIntent) }, context);
		})
};
