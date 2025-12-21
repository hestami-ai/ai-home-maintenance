import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('APInvoiceRoute');

const invoiceLineSchema = z.object({
	description: z.string().min(1).max(500),
	quantity: z.number().positive().default(1),
	unitPrice: z.number(),
	glAccountId: z.string()
});

/**
 * AP Invoice management procedures
 */
export const apInvoiceRouter = {
	/**
	 * Create an AP invoice
	 */
	create: orgProcedure
		.input(
			z.object({
				vendorId: z.string(),
				invoiceNumber: z.string().min(1).max(50),
				invoiceDate: z.string().datetime(),
				dueDate: z.string().datetime(),
				description: z.string().max(500).optional(),
				memo: z.string().max(1000).optional(),
				lines: z.array(invoiceLineSchema).min(1),
				workOrderId: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invoice: z.object({
						id: z.string(),
						invoiceNumber: z.string(),
						vendorName: z.string(),
						totalAmount: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'ap_invoice', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate vendor
			const vendor = await prisma.vendor.findFirst({
				where: { id: input.vendorId, associationId: association.id, deletedAt: null }
			});

			if (!vendor) {
				throw ApiException.notFound('Vendor');
			}

			// Check for duplicate invoice number for this vendor
			const existing = await prisma.aPInvoice.findUnique({
				where: {
					associationId_vendorId_invoiceNumber: {
						associationId: association.id,
						vendorId: input.vendorId,
						invoiceNumber: input.invoiceNumber
					}
				}
			});

			if (existing) {
				throw ApiException.conflict('Invoice number already exists for this vendor');
			}

			// Validate GL accounts
			const glAccountIds = input.lines.map((l) => l.glAccountId);
			const accounts = await prisma.gLAccount.findMany({
				where: { id: { in: glAccountIds }, associationId: association.id }
			});

			if (accounts.length !== new Set(glAccountIds).size) {
				throw ApiException.notFound('One or more GL Accounts');
			}

			// Calculate totals
			const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
			const totalAmount = subtotal; // No tax for now

			const invoice = await prisma.aPInvoice.create({
				data: {
					associationId: association.id,
					vendorId: input.vendorId,
					invoiceNumber: input.invoiceNumber,
					invoiceDate: new Date(input.invoiceDate),
					dueDate: new Date(input.dueDate),
					description: input.description,
					memo: input.memo,
					subtotal,
					totalAmount,
					balanceDue: totalAmount,
					workOrderId: input.workOrderId,
					status: 'DRAFT',
					lineItems: {
						create: input.lines.map((line, index) => ({
							description: line.description,
							quantity: line.quantity,
							unitPrice: line.unitPrice,
							amount: line.quantity * line.unitPrice,
							glAccountId: line.glAccountId,
							lineNumber: index + 1
						}))
					}
				},
				include: { vendor: true }
			});

			return successResponse(
				{
					invoice: {
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						vendorName: invoice.vendor.name,
						totalAmount: invoice.totalAmount.toString(),
						status: invoice.status
					}
				},
				context
			);
		}),

	/**
	 * List AP invoices
	 */
	list: orgProcedure
		.input(
			z.object({
				vendorId: z.string().optional(),
				status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'VOIDED']).optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invoices: z.array(
						z.object({
							id: z.string(),
							invoiceNumber: z.string(),
							vendorId: z.string(),
							vendorName: z.string(),
							invoiceDate: z.string(),
							dueDate: z.string(),
							totalAmount: z.string(),
							balanceDue: z.string(),
							status: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'ap_invoice', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.APInvoiceWhereInput = {
				associationId: association.id
			};

			if (input?.vendorId) where.vendorId = input.vendorId;
			if (input?.status) where.status = input.status;
			if (input?.fromDate || input?.toDate) {
				where.dueDate = {};
				if (input.fromDate) where.dueDate.gte = new Date(input.fromDate);
				if (input.toDate) where.dueDate.lte = new Date(input.toDate);
			}

			const invoices = await prisma.aPInvoice.findMany({
				where,
				include: { vendor: true },
				orderBy: { dueDate: 'asc' }
			});

			return successResponse(
				{
					invoices: invoices.map((i) => ({
						id: i.id,
						invoiceNumber: i.invoiceNumber,
						vendorId: i.vendorId,
						vendorName: i.vendor.name,
						invoiceDate: i.invoiceDate.toISOString(),
						dueDate: i.dueDate.toISOString(),
						totalAmount: i.totalAmount.toString(),
						balanceDue: i.balanceDue.toString(),
						status: i.status
					}))
				},
				context
			);
		}),

	/**
	 * Get invoice details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invoice: z.object({
						id: z.string(),
						invoiceNumber: z.string(),
						vendorId: z.string(),
						vendorName: z.string(),
						invoiceDate: z.string(),
						dueDate: z.string(),
						description: z.string().nullable(),
						memo: z.string().nullable(),
						subtotal: z.string(),
						taxAmount: z.string(),
						totalAmount: z.string(),
						paidAmount: z.string(),
						balanceDue: z.string(),
						status: z.string(),
						approvedBy: z.string().nullable(),
						approvedAt: z.string().nullable(),
						lineItems: z.array(
							z.object({
								id: z.string(),
								description: z.string(),
								quantity: z.string(),
								unitPrice: z.string(),
								amount: z.string(),
								glAccountId: z.string()
							})
						)
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'ap_invoice', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const invoice = await prisma.aPInvoice.findFirst({
				where: { id: input.id, associationId: association.id },
				include: {
					vendor: true,
					lineItems: { orderBy: { lineNumber: 'asc' } }
				}
			});

			if (!invoice) {
				throw ApiException.notFound('Invoice');
			}

			return successResponse(
				{
					invoice: {
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						vendorId: invoice.vendorId,
						vendorName: invoice.vendor.name,
						invoiceDate: invoice.invoiceDate.toISOString(),
						dueDate: invoice.dueDate.toISOString(),
						description: invoice.description,
						memo: invoice.memo,
						subtotal: invoice.subtotal.toString(),
						taxAmount: invoice.taxAmount.toString(),
						totalAmount: invoice.totalAmount.toString(),
						paidAmount: invoice.paidAmount.toString(),
						balanceDue: invoice.balanceDue.toString(),
						status: invoice.status,
						approvedBy: invoice.approvedBy,
						approvedAt: invoice.approvedAt?.toISOString() ?? null,
						lineItems: invoice.lineItems.map((l) => ({
							id: l.id,
							description: l.description,
							quantity: l.quantity.toString(),
							unitPrice: l.unitPrice.toString(),
							amount: l.amount.toString(),
							glAccountId: l.glAccountId
						}))
					}
				},
				context
			);
		}),

	/**
	 * Approve an invoice
	 */
	approve: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					invoice: z.object({
						id: z.string(),
						status: z.string(),
						approvedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('approve', 'ap_invoice', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const invoice = await prisma.aPInvoice.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!invoice) {
				throw ApiException.notFound('Invoice');
			}

			if (invoice.status !== 'DRAFT' && invoice.status !== 'PENDING_APPROVAL') {
				throw ApiException.conflict(`Cannot approve invoice with status: ${invoice.status}`);
			}

			const now = new Date();

			await prisma.aPInvoice.update({
				where: { id: input.id },
				data: {
					status: 'APPROVED',
					approvedBy: context.user!.id,
					approvedAt: now
				}
			});

			return successResponse(
				{
					invoice: {
						id: invoice.id,
						status: 'APPROVED',
						approvedAt: now.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Void an invoice
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
			await context.cerbos.authorize('delete', 'ap_invoice', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const invoice = await prisma.aPInvoice.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!invoice) {
				throw ApiException.notFound('Invoice');
			}

			if (invoice.status === 'PAID') {
				throw ApiException.conflict('Cannot void a paid invoice');
			}

			if (invoice.status === 'VOIDED') {
				throw ApiException.conflict('Invoice already voided');
			}

			await prisma.aPInvoice.update({
				where: { id: input.id },
				data: { status: 'VOIDED' }
			});

			return successResponse({ success: true }, context);
		})
};
