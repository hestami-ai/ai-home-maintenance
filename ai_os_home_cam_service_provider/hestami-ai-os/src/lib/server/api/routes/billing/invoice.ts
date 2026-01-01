import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { JobInvoiceStatus } from '../../../../../../generated/prisma/client.js';
import { startInvoiceCreateWorkflow } from '../../../workflows/invoiceCreateWorkflow.js';
import { startBillingWorkflow } from '../../../workflows/billingWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('InvoiceRoute');

const invoiceLineOutput = z.object({
	id: z.string(),
	invoiceId: z.string(),
	lineNumber: z.number(),
	description: z.string(),
	quantity: z.string(),
	unitPrice: z.string(),
	lineTotal: z.string(),
	pricebookItemId: z.string().nullable(),
	isTaxable: z.boolean(),
	taxRate: z.string(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const invoiceOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	jobId: z.string(),
	customerId: z.string(),
	invoiceNumber: z.string(),
	status: z.nativeEnum(JobInvoiceStatus),
	issueDate: z.string(),
	dueDate: z.string().nullable(),
	sentAt: z.string().nullable(),
	viewedAt: z.string().nullable(),
	paidAt: z.string().nullable(),
	subtotal: z.string(),
	taxAmount: z.string(),
	discount: z.string(),
	totalAmount: z.string(),
	amountPaid: z.string(),
	balanceDue: z.string(),
	notes: z.string().nullable(),
	terms: z.string().nullable(),
	estimateId: z.string().nullable(),
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lines: z.array(invoiceLineOutput).optional()
});

const formatInvoiceLine = (l: any) => ({
	id: l.id,
	invoiceId: l.invoiceId,
	lineNumber: l.lineNumber,
	description: l.description,
	quantity: l.quantity.toString(),
	unitPrice: l.unitPrice.toString(),
	lineTotal: l.lineTotal.toString(),
	pricebookItemId: l.pricebookItemId,
	isTaxable: l.isTaxable,
	taxRate: l.taxRate.toString(),
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

const formatInvoice = (i: any, includeLines = false) => ({
	id: i.id,
	organizationId: i.organizationId,
	jobId: i.jobId,
	customerId: i.customerId,
	invoiceNumber: i.invoiceNumber,
	status: i.status,
	issueDate: i.issueDate.toISOString(),
	dueDate: i.dueDate?.toISOString() ?? null,
	sentAt: i.sentAt?.toISOString() ?? null,
	viewedAt: i.viewedAt?.toISOString() ?? null,
	paidAt: i.paidAt?.toISOString() ?? null,
	subtotal: i.subtotal.toString(),
	taxAmount: i.taxAmount.toString(),
	discount: i.discount.toString(),
	totalAmount: i.totalAmount.toString(),
	amountPaid: i.amountPaid.toString(),
	balanceDue: i.balanceDue.toString(),
	notes: i.notes,
	terms: i.terms,
	estimateId: i.estimateId,
	createdBy: i.createdBy,
	createdAt: i.createdAt.toISOString(),
	updatedAt: i.updatedAt.toISOString(),
	...(includeLines && i.lines && { lines: i.lines.map(formatInvoiceLine) })
});

async function generateInvoiceNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.jobInvoice.count({
		where: {
			organizationId,
			invoiceNumber: { startsWith: `INV-${year}-` }
		}
	});
	return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
}

function recalculateInvoiceTotals(lines: any[], discount: number = 0) {
	const subtotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
	const taxAmount = lines
		.filter((l) => l.isTaxable)
		.reduce((sum, l) => sum + Number(l.lineTotal) * Number(l.taxRate), 0);
	const totalAmount = subtotal + taxAmount - discount;
	return { subtotal, taxAmount, totalAmount };
}

export const invoiceRouter = {
	/**
	 * Create invoice from estimate
	 */
	createFromEstimate: orgProcedure
		.input(
			z
				.object({
					estimateId: z.string(),
					dueDate: z.string().datetime().optional(),
					notes: z.string().optional(),
					terms: z.string().optional()
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
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('create', 'job_invoice', 'new');

			const estimate = await prisma.estimate.findFirst({
				where: { id: input.estimateId, organizationId: context.organization.id },
				include: { lines: true, options: { where: { isSelected: true }, include: { lines: true } } }
			});
			if (!estimate) throw errors.NOT_FOUND({ message: 'Estimate not found' });

			if (estimate.status !== 'ACCEPTED') {
				throw errors.BAD_REQUEST({ message: 'Can only create invoice from ACCEPTED estimate' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'CREATE_INVOICE_FROM_ESTIMATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						estimateId: input.estimateId,
						dueDate: input.dueDate,
						notes: input.notes,
						terms: input.terms
					}
				},
				input.idempotencyKey || `create-invoice-from-estimate-${input.estimateId}-${Date.now()}`
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create invoice from estimate' });
			}

			const invoice = await prisma.jobInvoice.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Create invoice directly
	 */
	create: orgProcedure
		.input(
			z
				.object({
					jobId: z.string(),
					customerId: z.string(),
					dueDate: z.string().datetime().optional(),
					notes: z.string().optional(),
					terms: z.string().optional(),
					discount: z.number().nonnegative().default(0),
					lines: z.array(
						z.object({
							description: z.string(),
							quantity: z.number().positive().default(1),
							unitPrice: z.number().nonnegative(),
							pricebookItemId: z.string().optional(),
							isTaxable: z.boolean().default(true),
							taxRate: z.number().nonnegative().default(0)
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('create', 'job_invoice', 'new');

			// Validate job and customer
			const [job, customer] = await Promise.all([
				prisma.job.findFirst({
					where: { id: input.jobId, organizationId: context.organization.id, deletedAt: null }
				}),
				prisma.customer.findFirst({
					where: { id: input.customerId, organizationId: context.organization.id, deletedAt: null }
				})
			]);
			if (!job) throw errors.NOT_FOUND({ message: 'Job not found' });
			if (!customer) throw errors.NOT_FOUND({ message: 'Customer not found' });

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			const result = await startInvoiceCreateWorkflow(
				{
					organizationId: context.organization.id,
					userId: context.user!.id,
					jobId: input.jobId,
					customerId: input.customerId,
					dueDate: input.dueDate,
					notes: input.notes,
					terms: input.terms,
					discount: input.discount,
					lines: input.lines
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create invoice' });
			}

			// Fetch the created invoice with relations for the response
			const invoice = await prisma.jobInvoice.findUnique({
				where: { id: result.invoiceId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Get invoice by ID
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
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('view', 'job_invoice', input.id);

			const invoice = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			if (!invoice) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * List invoices
	 */
	list: orgProcedure
		.input(
			z
				.object({
					jobId: z.string().optional(),
					customerId: z.string().optional(),
					status: z.nativeEnum(JobInvoiceStatus).optional(),
					overdue: z.boolean().optional()
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
					invoices: z.array(invoiceOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('view', 'job_invoice', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization.id,
				...(input?.jobId && { jobId: input.jobId }),
				...(input?.customerId && { customerId: input.customerId }),
				...(input?.status && { status: input.status })
			};

			if (input?.overdue) {
				where.status = { in: ['SENT', 'VIEWED', 'PARTIAL'] };
				where.dueDate = { lt: new Date() };
			}

			const invoices = await prisma.jobInvoice.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = invoices.length > limit;
			if (hasMore) invoices.pop();

			const nextCursor = hasMore ? invoices[invoices.length - 1]?.id ?? null : null;

			return successResponse(
				{
					invoices: invoices.map((i) => formatInvoice(i)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	/**
	 * Update invoice (only DRAFT)
	 */
	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					dueDate: z.string().datetime().nullable().optional(),
					notes: z.string().optional(),
					terms: z.string().optional(),
					discount: z.number().nonnegative().optional()
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
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only edit DRAFT invoices' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'UPDATE_INVOICE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {
						dueDate: input.dueDate,
						notes: input.notes,
						terms: input.terms,
						discount: input.discount
					}
				},
				input.idempotencyKey || `update-invoice-${input.id}-${Date.now()}`
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update invoice' });
			}

			const invoice = await prisma.jobInvoice.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Send invoice
	 */
	send: orgProcedure
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
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('send', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only send DRAFT invoices' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'SEND_INVOICE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to send invoice' });
			}

			const invoice = await prisma.jobInvoice.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Mark invoice as viewed
	 */
	markViewed: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (existing.status !== 'SENT') {
				return successResponse({ invoice: formatInvoice(existing) }, context);
			}

			const invoice = await prisma.jobInvoice.update({
				where: { id: input.id },
				data: {
					status: 'VIEWED',
					viewedAt: new Date()
				},
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Record payment on invoice
	 */
	recordPayment: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					amount: z.number().positive(),
					paymentMethod: z.string().optional(),
					notes: z.string().optional()
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
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (!['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot record payment on this invoice' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'RECORD_INVOICE_PAYMENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: { amount: input.amount, paymentMethod: input.paymentMethod }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to record payment' });
			}

			const invoice = await prisma.jobInvoice.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Void invoice
	 */
	void: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('void', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (['VOID', 'REFUNDED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Invoice is already void or refunded' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'VOID_INVOICE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to void invoice' });
			}

			const invoice = await prisma.jobInvoice.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Delete invoice (only DRAFT)
	 */
	delete: orgProcedure
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
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('delete', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Invoice not found' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only delete DRAFT invoices' });
			}

			// Use DBOS workflow for durable execution
			const result = await startBillingWorkflow(
				{
					action: 'DELETE_INVOICE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete invoice' });
			}

			return successResponse({ deleted: true }, context);
		})
};
