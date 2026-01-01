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
import { PurchaseOrderStatus } from '../../../../../../generated/prisma/client.js';
import { startPurchaseOrderWorkflow } from '../../../workflows/purchaseOrderWorkflow.js';

const poLineOutput = z.object({
	id: z.string(),
	purchaseOrderId: z.string(),
	lineNumber: z.number(),
	itemId: z.string(),
	description: z.string().nullable(),
	quantity: z.number(),
	unitCost: z.string(),
	lineTotal: z.string(),
	quantityReceived: z.number(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const poOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	poNumber: z.string(),
	supplierId: z.string(),
	status: z.nativeEnum(PurchaseOrderStatus),
	orderDate: z.string(),
	expectedDate: z.string().nullable(),
	submittedAt: z.string().nullable(),
	confirmedAt: z.string().nullable(),
	receivedAt: z.string().nullable(),
	deliveryLocationId: z.string().nullable(),
	subtotal: z.string(),
	taxAmount: z.string(),
	shippingCost: z.string(),
	totalAmount: z.string(),
	notes: z.string().nullable(),
	supplierNotes: z.string().nullable(),
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lines: z.array(poLineOutput).optional()
});

const formatPOLine = (l: any) => ({
	id: l.id,
	purchaseOrderId: l.purchaseOrderId,
	lineNumber: l.lineNumber,
	itemId: l.itemId,
	description: l.description,
	quantity: l.quantity,
	unitCost: l.unitCost.toString(),
	lineTotal: l.lineTotal.toString(),
	quantityReceived: l.quantityReceived,
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

const formatPO = (po: any, includeLines = false) => ({
	id: po.id,
	organizationId: po.organizationId,
	poNumber: po.poNumber,
	supplierId: po.supplierId,
	status: po.status,
	orderDate: po.orderDate.toISOString(),
	expectedDate: po.expectedDate?.toISOString() ?? null,
	submittedAt: po.submittedAt?.toISOString() ?? null,
	confirmedAt: po.confirmedAt?.toISOString() ?? null,
	receivedAt: po.receivedAt?.toISOString() ?? null,
	deliveryLocationId: po.deliveryLocationId,
	subtotal: po.subtotal.toString(),
	taxAmount: po.taxAmount.toString(),
	shippingCost: po.shippingCost.toString(),
	totalAmount: po.totalAmount.toString(),
	notes: po.notes,
	supplierNotes: po.supplierNotes,
	createdBy: po.createdBy,
	createdAt: po.createdAt.toISOString(),
	updatedAt: po.updatedAt.toISOString(),
	...(includeLines && po.lines && { lines: po.lines.map(formatPOLine) })
});

async function generatePONumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.purchaseOrder.count({
		where: {
			organizationId,
			poNumber: { startsWith: `PO-${year}-` }
		}
	});
	return `PO-${year}-${String(count + 1).padStart(6, '0')}`;
}

function recalculatePOTotals(lines: any[], taxAmount = 0, shippingCost = 0) {
	const subtotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
	const totalAmount = subtotal + taxAmount + shippingCost;
	return { subtotal, totalAmount };
}

export const purchaseOrderRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					supplierId: z.string(),
					expectedDate: z.string().datetime().optional(),
					deliveryLocationId: z.string().optional(),
					taxAmount: z.number().nonnegative().default(0),
					shippingCost: z.number().nonnegative().default(0),
					notes: z.string().optional(),
					lines: z.array(
						z.object({
							itemId: z.string(),
							description: z.string().optional(),
							quantity: z.number().int().positive(),
							unitCost: z.number().nonnegative()
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'purchase_order', 'new');

			// Validate supplier
			const supplier = await prisma.supplier.findFirst({
				where: { id: input.supplierId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!supplier) throw errors.NOT_FOUND({ message: 'Supplier' });

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'CREATE_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						supplierId: input.supplierId,
						expectedDate: input.expectedDate,
						deliveryLocationId: input.deliveryLocationId,
						taxAmount: input.taxAmount,
						shippingCost: input.shippingCost,
						notes: input.notes,
						lines: input.lines
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'purchase_order', input.id);

			const po = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			if (!po) throw errors.NOT_FOUND({ message: 'Purchase order' });

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					supplierId: z.string().optional(),
					status: z.nativeEnum(PurchaseOrderStatus).optional()
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
					purchaseOrders: z.array(poOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'purchase_order', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.supplierId && { supplierId: input.supplierId }),
				...(input?.status && { status: input.status })
			};

			const pos = await prisma.purchaseOrder.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = pos.length > limit;
			if (hasMore) pos.pop();

			const nextCursor = hasMore ? pos[pos.length - 1]?.id ?? null : null;

			return successResponse(
				{
					purchaseOrders: pos.map((po) => formatPO(po)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					expectedDate: z.string().datetime().nullable().optional(),
					deliveryLocationId: z.string().nullable().optional(),
					taxAmount: z.number().nonnegative().optional(),
					shippingCost: z.number().nonnegative().optional(),
					notes: z.string().nullable().optional(),
					supplierNotes: z.string().nullable().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only edit DRAFT or SUBMITTED purchase orders' });
			}

			const taxAmount = input.taxAmount ?? Number(existing.taxAmount);
			const shippingCost = input.shippingCost ?? Number(existing.shippingCost);
			const { subtotal, totalAmount } = recalculatePOTotals(existing.lines, taxAmount, shippingCost);

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'UPDATE_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {
						expectedDate: input.expectedDate === null ? null : input.expectedDate ? new Date(input.expectedDate) : existing.expectedDate,
						deliveryLocationId: input.deliveryLocationId === null ? null : input.deliveryLocationId ?? existing.deliveryLocationId,
						taxAmount,
						shippingCost,
						subtotal,
						totalAmount,
						notes: input.notes ?? existing.notes,
						supplierNotes: input.supplierNotes ?? existing.supplierNotes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	addLine: orgProcedure
		.input(
			z
				.object({
					purchaseOrderId: z.string(),
					itemId: z.string(),
					description: z.string().optional(),
					quantity: z.number().int().positive(),
					unitCost: z.number().nonnegative()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'purchase_order', input.purchaseOrderId);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.purchaseOrderId, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only add lines to DRAFT purchase orders' });
			}

			const lineNumber = existing.lines.length + 1;
			const lineTotal = input.quantity * input.unitCost;

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'ADD_LINE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.purchaseOrderId,
					data: {
						lineNumber,
						itemId: input.itemId,
						description: input.description,
						quantity: input.quantity,
						unitCost: input.unitCost,
						lineTotal
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add line' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	removeLine: orgProcedure
		.input(z.object({ lineId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			const line = await prisma.purchaseOrderLine.findUnique({
				where: { id: input.lineId },
				include: { purchaseOrder: true }
			});
			if (!line || line.purchaseOrder.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Purchase order line' });
			}

			await context.cerbos.authorize('edit', 'purchase_order', line.purchaseOrderId);

			if (line.purchaseOrder.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only remove lines from DRAFT purchase orders' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'REMOVE_LINE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: line.purchaseOrderId,
					lineId: input.lineId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to remove line' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	submit: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('submit', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only submit DRAFT purchase orders' });
			}

			if (existing.lines.length === 0) {
				throw errors.BAD_REQUEST({ message: 'Cannot submit purchase order with no lines' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'SUBMIT_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to submit purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	confirm: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('confirm', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (existing.status !== 'SUBMITTED') {
				throw errors.BAD_REQUEST({ message: 'Can only confirm SUBMITTED purchase orders' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'CONFIRM_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to confirm purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	receive: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					locationId: z.string(),
					lines: z.array(
						z.object({
							lineId: z.string(),
							quantityReceived: z.number().int().nonnegative(),
							lotNumber: z.string().optional(),
							serialNumber: z.string().optional(),
							expirationDate: z.string().datetime().optional()
						})
					),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('receive', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only receive CONFIRMED or PARTIALLY_RECEIVED purchase orders' });
			}

			// Validate location
			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.locationId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!location) throw errors.NOT_FOUND({ message: 'Location' });

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'RECEIVE_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {
						poNumber: existing.poNumber,
						locationId: input.locationId,
						notes: input.notes,
						existingLines: existing.lines.map((l) => ({
							id: l.id,
							itemId: l.itemId,
							quantity: l.quantity,
							quantityReceived: l.quantityReceived
						})),
						lines: input.lines
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to receive purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('cancel', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (['RECEIVED', 'CANCELLED'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot cancel received or already cancelled purchase order' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'CANCEL_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel purchase order' });
			}

			const po = await prisma.purchaseOrder.findUniqueOrThrow({
				where: { id: result.entityId },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Purchase order' });

			if (existing.status !== 'DRAFT') {
				throw errors.BAD_REQUEST({ message: 'Can only delete DRAFT purchase orders' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPurchaseOrderWorkflow(
				{
					action: 'DELETE_PO',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					purchaseOrderId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete purchase order' });
			}

			return successResponse({ deleted: true }, context);
		})
};
