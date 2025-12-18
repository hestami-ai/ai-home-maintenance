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
import { PurchaseOrderStatus } from '../../../../../../generated/prisma/client.js';

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'purchase_order', 'new');

			// Validate supplier
			const supplier = await prisma.supplier.findFirst({
				where: { id: input.supplierId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!supplier) throw ApiException.notFound('Supplier');

			const createPO = async () => {
				const poNumber = await generatePONumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const linesWithTotals = (input.lines ?? []).map((line, idx) => ({
						...line,
						lineNumber: idx + 1,
						lineTotal: line.quantity * line.unitCost
					}));

					const { subtotal, totalAmount } = recalculatePOTotals(
						linesWithTotals,
						input.taxAmount,
						input.shippingCost
					);

					const po = await tx.purchaseOrder.create({
						data: {
							organizationId: context.organization!.id,
							poNumber,
							supplierId: input.supplierId,
							expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
							deliveryLocationId: input.deliveryLocationId,
							subtotal,
							taxAmount: input.taxAmount,
							shippingCost: input.shippingCost,
							totalAmount,
							notes: input.notes,
							createdBy: context.user!.id
						}
					});

					if (linesWithTotals.length > 0) {
						await tx.purchaseOrderLine.createMany({
							data: linesWithTotals.map((line) => ({
								purchaseOrderId: po.id,
								lineNumber: line.lineNumber,
								itemId: line.itemId,
								description: line.description,
								quantity: line.quantity,
								unitCost: line.unitCost,
								lineTotal: line.lineTotal
							}))
						});
					}

					return tx.purchaseOrder.findUnique({
						where: { id: po.id },
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createPO)).result
				: await createPO();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'purchase_order', input.id);

			const po = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: { orderBy: { lineNumber: 'asc' } } }
			});

			if (!po) throw ApiException.notFound('Purchase order');

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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only edit DRAFT or SUBMITTED purchase orders');
			}

			const updatePO = async () => {
				const taxAmount = input.taxAmount ?? Number(existing.taxAmount);
				const shippingCost = input.shippingCost ?? Number(existing.shippingCost);
				const { subtotal, totalAmount } = recalculatePOTotals(existing.lines, taxAmount, shippingCost);

				return prisma.purchaseOrder.update({
					where: { id: input.id },
					data: {
						expectedDate: input.expectedDate === null ? null : input.expectedDate ? new Date(input.expectedDate) : existing.expectedDate,
						deliveryLocationId: input.deliveryLocationId === null ? null : input.deliveryLocationId ?? existing.deliveryLocationId,
						taxAmount,
						shippingCost,
						subtotal,
						totalAmount,
						notes: input.notes ?? existing.notes,
						supplierNotes: input.supplierNotes ?? existing.supplierNotes
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updatePO)).result
				: await updatePO();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'purchase_order', input.purchaseOrderId);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.purchaseOrderId, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only add lines to DRAFT purchase orders');
			}

			const addLine = async () => {
				return prisma.$transaction(async (tx) => {
					const lineNumber = existing.lines.length + 1;
					const lineTotal = input.quantity * input.unitCost;

					await tx.purchaseOrderLine.create({
						data: {
							purchaseOrderId: input.purchaseOrderId,
							lineNumber,
							itemId: input.itemId,
							description: input.description,
							quantity: input.quantity,
							unitCost: input.unitCost,
							lineTotal
						}
					});

					const newSubtotal = Number(existing.subtotal) + lineTotal;
					const newTotal = newSubtotal + Number(existing.taxAmount) + Number(existing.shippingCost);

					return tx.purchaseOrder.update({
						where: { id: input.purchaseOrderId },
						data: { subtotal: newSubtotal, totalAmount: newTotal },
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, addLine)).result
				: await addLine();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	removeLine: orgProcedure
		.input(z.object({ lineId: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const line = await prisma.purchaseOrderLine.findUnique({
				where: { id: input.lineId },
				include: { purchaseOrder: true }
			});
			if (!line || line.purchaseOrder.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Purchase order line');
			}

			await context.cerbos.authorize('edit', 'purchase_order', line.purchaseOrderId);

			if (line.purchaseOrder.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only remove lines from DRAFT purchase orders');
			}

			const removeLine = async () => {
				return prisma.$transaction(async (tx) => {
					await tx.purchaseOrderLine.delete({ where: { id: input.lineId } });

					const newSubtotal = Number(line.purchaseOrder.subtotal) - Number(line.lineTotal);
					const newTotal = newSubtotal + Number(line.purchaseOrder.taxAmount) + Number(line.purchaseOrder.shippingCost);

					// Renumber remaining lines
					const remainingLines = await tx.purchaseOrderLine.findMany({
						where: { purchaseOrderId: line.purchaseOrderId },
						orderBy: { lineNumber: 'asc' }
					});

					for (let i = 0; i < remainingLines.length; i++) {
						await tx.purchaseOrderLine.update({
							where: { id: remainingLines[i].id },
							data: { lineNumber: i + 1 }
						});
					}

					return tx.purchaseOrder.update({
						where: { id: line.purchaseOrderId },
						data: { subtotal: newSubtotal, totalAmount: newTotal },
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, removeLine)).result
				: await removeLine();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	submit: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('submit', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only submit DRAFT purchase orders');
			}

			if (existing.lines.length === 0) {
				throw ApiException.badRequest('Cannot submit purchase order with no lines');
			}

			const submitPO = async () => {
				return prisma.purchaseOrder.update({
					where: { id: input.id },
					data: {
						status: 'SUBMITTED',
						submittedAt: new Date()
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, submitPO)).result
				: await submitPO();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	confirm: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('confirm', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (existing.status !== 'SUBMITTED') {
				throw ApiException.badRequest('Can only confirm SUBMITTED purchase orders');
			}

			const confirmPO = async () => {
				return prisma.purchaseOrder.update({
					where: { id: input.id },
					data: {
						status: 'CONFIRMED',
						confirmedAt: new Date()
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, confirmPO)).result
				: await confirmPO();

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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('receive', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only receive CONFIRMED or PARTIALLY_RECEIVED purchase orders');
			}

			// Validate location
			const location = await prisma.inventoryLocation.findFirst({
				where: { id: input.locationId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!location) throw ApiException.notFound('Location');

			const receivePO = async () => {
				return prisma.$transaction(async (tx) => {
					// Create receipt
					const receiptCount = await tx.purchaseOrderReceipt.count({
						where: { purchaseOrderId: input.id }
					});
					const receiptNumber = `${existing.poNumber}-R${receiptCount + 1}`;

					const receipt = await tx.purchaseOrderReceipt.create({
						data: {
							purchaseOrderId: input.id,
							receiptNumber,
							receivedBy: context.user!.id,
							locationId: input.locationId,
							notes: input.notes
						}
					});

					// Process each line
					for (const recvLine of input.lines) {
						const poLine = existing.lines.find((l) => l.id === recvLine.lineId);
						if (!poLine) continue;

						if (recvLine.quantityReceived > 0) {
							// Create receipt line
							await tx.purchaseOrderReceiptLine.create({
								data: {
									receiptId: receipt.id,
									itemId: poLine.itemId,
									quantityReceived: recvLine.quantityReceived,
									lotNumber: recvLine.lotNumber,
									serialNumber: recvLine.serialNumber,
									expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : null
								}
							});

							// Update PO line received quantity
							await tx.purchaseOrderLine.update({
								where: { id: recvLine.lineId },
								data: { quantityReceived: poLine.quantityReceived + recvLine.quantityReceived }
							});

							// Add to inventory
							let level = await tx.inventoryLevel.findFirst({
								where: {
									itemId: poLine.itemId,
									locationId: input.locationId,
									lotNumber: recvLine.lotNumber ?? null,
									serialNumber: recvLine.serialNumber ?? null
								}
							});

							if (level) {
								await tx.inventoryLevel.update({
									where: { id: level.id },
									data: {
										quantityOnHand: level.quantityOnHand + recvLine.quantityReceived,
										quantityAvailable: level.quantityAvailable + recvLine.quantityReceived,
										expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : level.expirationDate
									}
								});
							} else {
								await tx.inventoryLevel.create({
									data: {
										itemId: poLine.itemId,
										locationId: input.locationId,
										quantityOnHand: recvLine.quantityReceived,
										quantityAvailable: recvLine.quantityReceived,
										lotNumber: recvLine.lotNumber,
										serialNumber: recvLine.serialNumber,
										expirationDate: recvLine.expirationDate ? new Date(recvLine.expirationDate) : null
									}
								});
							}
						}
					}

					// Check if fully received
					const updatedLines = await tx.purchaseOrderLine.findMany({
						where: { purchaseOrderId: input.id }
					});

					const fullyReceived = updatedLines.every((l) => l.quantityReceived >= l.quantity);
					const partiallyReceived = updatedLines.some((l) => l.quantityReceived > 0);

					let newStatus: PurchaseOrderStatus = existing.status as PurchaseOrderStatus;
					if (fullyReceived) {
						newStatus = 'RECEIVED';
					} else if (partiallyReceived) {
						newStatus = 'PARTIALLY_RECEIVED';
					}

					return tx.purchaseOrder.update({
						where: { id: input.id },
						data: {
							status: newStatus,
							receivedAt: fullyReceived ? new Date() : null
						},
						include: { lines: { orderBy: { lineNumber: 'asc' } } }
					});
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, receivePO)).result
				: await receivePO();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ purchaseOrder: poOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('cancel', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (['RECEIVED', 'CANCELLED'].includes(existing.status)) {
				throw ApiException.badRequest('Cannot cancel received or already cancelled purchase order');
			}

			const cancelPO = async () => {
				return prisma.purchaseOrder.update({
					where: { id: input.id },
					data: {
						status: 'CANCELLED',
						notes: input.reason
							? `${existing.notes ?? ''}\nCancelled: ${input.reason}`.trim()
							: existing.notes
					},
					include: { lines: { orderBy: { lineNumber: 'asc' } } }
				});
			};

			const po = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelPO)).result
				: await cancelPO();

			return successResponse({ purchaseOrder: formatPO(po, true) }, context);
		}),

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
			await context.cerbos.authorize('delete', 'purchase_order', input.id);

			const existing = await prisma.purchaseOrder.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Purchase order');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only delete DRAFT purchase orders');
			}

			const deletePO = async () => {
				await prisma.purchaseOrder.delete({ where: { id: input.id } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deletePO)).result
				: await deletePO();

			return successResponse(result, context);
		})
};
