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
import { JobInvoiceStatus } from '../../../../../../generated/prisma/client.js';

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_invoice', 'new');

			const estimate = await prisma.estimate.findFirst({
				where: { id: input.estimateId, organizationId: context.organization!.id },
				include: { lines: true, options: { where: { isSelected: true }, include: { lines: true } } }
			});
			if (!estimate) throw ApiException.notFound('Estimate');

			if (estimate.status !== 'ACCEPTED') {
				throw ApiException.badRequest('Can only create invoice from ACCEPTED estimate');
			}

			const createInvoice = async () => {
				const invoiceNumber = await generateInvoiceNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					// Use selected option lines if available, otherwise use main lines
					const sourceLines = estimate.options.length > 0 && estimate.options[0].lines.length > 0
						? estimate.options[0].lines
						: estimate.lines;

					const invoice = await tx.jobInvoice.create({
						data: {
							organizationId: context.organization!.id,
							jobId: estimate.jobId,
							customerId: estimate.customerId,
							invoiceNumber,
							dueDate: input.dueDate ? new Date(input.dueDate) : null,
							subtotal: estimate.subtotal,
							taxAmount: estimate.taxAmount,
							discount: estimate.discount,
							totalAmount: estimate.totalAmount,
							balanceDue: estimate.totalAmount,
							notes: input.notes ?? estimate.notes,
							terms: input.terms ?? estimate.terms,
							estimateId: estimate.id,
							createdBy: context.user!.id
						}
					});

					// Copy lines
					if (sourceLines.length > 0) {
						await tx.invoiceLine.createMany({
							data: sourceLines.map((line, idx) => ({
								invoiceId: invoice.id,
								lineNumber: idx + 1,
								description: line.description,
								quantity: line.quantity,
								unitPrice: line.unitPrice,
								lineTotal: line.lineTotal,
								pricebookItemId: line.pricebookItemId,
								isTaxable: line.isTaxable,
								taxRate: line.taxRate
							}))
						});
					}

					return tx.jobInvoice.findUnique({
						where: { id: invoice.id },
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createInvoice)).result
				: await createInvoice();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'job_invoice', 'new');

			// Validate job and customer
			const [job, customer] = await Promise.all([
				prisma.job.findFirst({
					where: { id: input.jobId, organizationId: context.organization!.id, deletedAt: null }
				}),
				prisma.customer.findFirst({
					where: { id: input.customerId, organizationId: context.organization!.id, deletedAt: null }
				})
			]);
			if (!job) throw ApiException.notFound('Job');
			if (!customer) throw ApiException.notFound('Customer');

			const createInvoice = async () => {
				const invoiceNumber = await generateInvoiceNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const linesWithTotals = (input.lines ?? []).map((line, idx) => ({
						...line,
						lineNumber: idx + 1,
						lineTotal: line.quantity * line.unitPrice
					}));

					const { subtotal, taxAmount, totalAmount } = recalculateInvoiceTotals(
						linesWithTotals,
						input.discount
					);

					const invoice = await tx.jobInvoice.create({
						data: {
							organizationId: context.organization!.id,
							jobId: input.jobId,
							customerId: input.customerId,
							invoiceNumber,
							dueDate: input.dueDate ? new Date(input.dueDate) : null,
							subtotal,
							taxAmount,
							discount: input.discount,
							totalAmount,
							balanceDue: totalAmount,
							notes: input.notes,
							terms: input.terms,
							createdBy: context.user!.id
						}
					});

					if (linesWithTotals.length > 0) {
						await tx.invoiceLine.createMany({
							data: linesWithTotals.map((line) => ({
								invoiceId: invoice.id,
								lineNumber: line.lineNumber,
								description: line.description,
								quantity: line.quantity,
								unitPrice: line.unitPrice,
								lineTotal: line.lineTotal,
								pricebookItemId: line.pricebookItemId,
								isTaxable: line.isTaxable,
								taxRate: line.taxRate
							}))
						});
					}

					return tx.jobInvoice.findUnique({
						where: { id: invoice.id },
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createInvoice)).result
				: await createInvoice();

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Get invoice by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_invoice', input.id);

			const invoice = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			if (!invoice) throw ApiException.notFound('Invoice');

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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'job_invoice', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id,
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Invoice');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only edit DRAFT invoices');
			}

			const updateInvoice = async () => {
				const discount = input.discount ?? Number(existing.discount);
				const { subtotal, taxAmount, totalAmount } = recalculateInvoiceTotals(
					existing.lines,
					discount
				);

				return prisma.jobInvoice.update({
					where: { id: input.id },
					data: {
						dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : existing.dueDate,
						notes: input.notes ?? existing.notes,
						terms: input.terms ?? existing.terms,
						discount,
						subtotal,
						taxAmount,
						totalAmount,
						balanceDue: totalAmount - Number(existing.amountPaid)
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateInvoice)).result
				: await updateInvoice();

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Send invoice
	 */
	send: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('send', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Invoice');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only send DRAFT invoices');
			}

			const sendInvoice = async () => {
				return prisma.jobInvoice.update({
					where: { id: input.id },
					data: {
						status: 'SENT',
						sentAt: new Date()
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, sendInvoice)).result
				: await sendInvoice();

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Mark invoice as viewed
	 */
	markViewed: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Invoice');

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Invoice');

			if (!['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'].includes(existing.status)) {
				throw ApiException.badRequest('Cannot record payment on this invoice');
			}

			const recordPayment = async () => {
				const newAmountPaid = Number(existing.amountPaid) + input.amount;
				const newBalanceDue = Number(existing.totalAmount) - newAmountPaid;
				const isPaid = newBalanceDue <= 0;

				return prisma.jobInvoice.update({
					where: { id: input.id },
					data: {
						amountPaid: newAmountPaid,
						balanceDue: Math.max(0, newBalanceDue),
						status: isPaid ? 'PAID' : 'PARTIAL',
						paidAt: isPaid ? new Date() : null,
						notes: input.notes
							? `${existing.notes ?? ''}\nPayment: $${input.amount} via ${input.paymentMethod ?? 'unknown'}`.trim()
							: existing.notes
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, recordPayment)).result
				: await recordPayment();

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Void invoice
	 */
	void: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ invoice: invoiceOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('void', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Invoice');

			if (['VOID', 'REFUNDED'].includes(existing.status)) {
				throw ApiException.badRequest('Invoice is already void or refunded');
			}

			const voidInvoice = async () => {
				return prisma.jobInvoice.update({
					where: { id: input.id },
					data: {
						status: 'VOID',
						notes: input.reason
							? `${existing.notes ?? ''}\nVoided: ${input.reason}`.trim()
							: existing.notes
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const invoice = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, voidInvoice)).result
				: await voidInvoice();

			return successResponse({ invoice: formatInvoice(invoice, true) }, context);
		}),

	/**
	 * Delete invoice (only DRAFT)
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'job_invoice', input.id);

			const existing = await prisma.jobInvoice.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Invoice');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only delete DRAFT invoices');
			}

			const deleteInvoice = async () => {
				await prisma.jobInvoice.delete({ where: { id: input.id } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteInvoice)).result
				: await deleteInvoice();

			return successResponse(result, context);
		})
};
