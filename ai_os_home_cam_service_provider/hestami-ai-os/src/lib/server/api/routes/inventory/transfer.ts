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

const transferLineOutput = z.object({
	id: z.string(),
	transferId: z.string(),
	itemId: z.string(),
	quantityRequested: z.number(),
	quantityShipped: z.number(),
	quantityReceived: z.number(),
	lotNumber: z.string().nullable(),
	serialNumber: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const transferOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	transferNumber: z.string(),
	fromLocationId: z.string(),
	toLocationId: z.string(),
	status: z.string(),
	requestedAt: z.string(),
	shippedAt: z.string().nullable(),
	receivedAt: z.string().nullable(),
	notes: z.string().nullable(),
	requestedBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lines: z.array(transferLineOutput).optional()
});

const formatTransferLine = (l: any) => ({
	id: l.id,
	transferId: l.transferId,
	itemId: l.itemId,
	quantityRequested: l.quantityRequested,
	quantityShipped: l.quantityShipped,
	quantityReceived: l.quantityReceived,
	lotNumber: l.lotNumber,
	serialNumber: l.serialNumber,
	createdAt: l.createdAt.toISOString(),
	updatedAt: l.updatedAt.toISOString()
});

const formatTransfer = (t: any, includeLines = false) => ({
	id: t.id,
	organizationId: t.organizationId,
	transferNumber: t.transferNumber,
	fromLocationId: t.fromLocationId,
	toLocationId: t.toLocationId,
	status: t.status,
	requestedAt: t.requestedAt.toISOString(),
	shippedAt: t.shippedAt?.toISOString() ?? null,
	receivedAt: t.receivedAt?.toISOString() ?? null,
	notes: t.notes,
	requestedBy: t.requestedBy,
	createdAt: t.createdAt.toISOString(),
	updatedAt: t.updatedAt.toISOString(),
	...(includeLines && t.lines && { lines: t.lines.map(formatTransferLine) })
});

async function generateTransferNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.inventoryTransfer.count({
		where: {
			organizationId,
			transferNumber: { startsWith: `TRF-${year}-` }
		}
	});
	return `TRF-${year}-${String(count + 1).padStart(6, '0')}`;
}

export const transferRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					fromLocationId: z.string(),
					toLocationId: z.string(),
					notes: z.string().optional(),
					lines: z.array(
						z.object({
							itemId: z.string(),
							quantity: z.number().int().positive(),
							lotNumber: z.string().optional(),
							serialNumber: z.string().optional()
						})
					).min(1)
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'inventory_transfer', 'new');

			// Validate locations
			const [fromLoc, toLoc] = await Promise.all([
				prisma.inventoryLocation.findFirst({
					where: { id: input.fromLocationId, organizationId: context.organization!.id, deletedAt: null }
				}),
				prisma.inventoryLocation.findFirst({
					where: { id: input.toLocationId, organizationId: context.organization!.id, deletedAt: null }
				})
			]);
			if (!fromLoc) throw ApiException.notFound('From location');
			if (!toLoc) throw ApiException.notFound('To location');

			if (input.fromLocationId === input.toLocationId) {
				throw ApiException.badRequest('Cannot transfer to same location');
			}

			const createTransfer = async () => {
				const transferNumber = await generateTransferNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const transfer = await tx.inventoryTransfer.create({
						data: {
							organizationId: context.organization!.id,
							transferNumber,
							fromLocationId: input.fromLocationId,
							toLocationId: input.toLocationId,
							notes: input.notes,
							requestedBy: context.user!.id
						}
					});

					await tx.inventoryTransferLine.createMany({
						data: input.lines.map((line) => ({
							transferId: transfer.id,
							itemId: line.itemId,
							quantityRequested: line.quantity,
							lotNumber: line.lotNumber,
							serialNumber: line.serialNumber
						}))
					});

					return tx.inventoryTransfer.findUnique({
						where: { id: transfer.id },
						include: { lines: true }
					});
				});
			};

			const transfer = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createTransfer)).result
				: await createTransfer();

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_transfer', input.id);

			const transfer = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});

			if (!transfer) throw ApiException.notFound('Transfer');

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					fromLocationId: z.string().optional(),
					toLocationId: z.string().optional(),
					status: z.string().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					transfers: z.array(transferOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'inventory_transfer', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where = {
				organizationId: context.organization!.id,
				...(input?.fromLocationId && { fromLocationId: input.fromLocationId }),
				...(input?.toLocationId && { toLocationId: input.toLocationId }),
				...(input?.status && { status: input.status })
			};

			const transfers = await prisma.inventoryTransfer.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = transfers.length > limit;
			if (hasMore) transfers.pop();

			const nextCursor = hasMore ? transfers[transfers.length - 1]?.id ?? null : null;

			return successResponse(
				{
					transfers: transfers.map((t) => formatTransfer(t)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	ship: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					lines: z.array(
						z.object({
							lineId: z.string(),
							quantityShipped: z.number().int().nonnegative()
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('ship', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Transfer');

			if (existing.status !== 'PENDING') {
				throw ApiException.badRequest('Transfer is not pending');
			}

			const shipTransfer = async () => {
				return prisma.$transaction(async (tx) => {
					// Update line quantities if provided, otherwise ship all requested
					for (const line of existing.lines) {
						const shipLine = input.lines?.find((l) => l.lineId === line.id);
						const qtyToShip = shipLine?.quantityShipped ?? line.quantityRequested;

						// Deduct from source location
						const level = await tx.inventoryLevel.findFirst({
							where: {
								itemId: line.itemId,
								locationId: existing.fromLocationId,
								lotNumber: line.lotNumber ?? null,
								serialNumber: line.serialNumber ?? null
							}
						});

						if (!level || level.quantityAvailable < qtyToShip) {
							throw ApiException.badRequest(`Insufficient stock for item ${line.itemId}`);
						}

						await tx.inventoryLevel.update({
							where: { id: level.id },
							data: {
								quantityOnHand: level.quantityOnHand - qtyToShip,
								quantityAvailable: level.quantityAvailable - qtyToShip
							}
						});

						await tx.inventoryTransferLine.update({
							where: { id: line.id },
							data: { quantityShipped: qtyToShip }
						});
					}

					return tx.inventoryTransfer.update({
						where: { id: input.id },
						data: {
							status: 'IN_TRANSIT',
							shippedAt: new Date()
						},
						include: { lines: true }
					});
				});
			};

			const transfer = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, shipTransfer)).result
				: await shipTransfer();

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		}),

	receive: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					lines: z.array(
						z.object({
							lineId: z.string(),
							quantityReceived: z.number().int().nonnegative()
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('receive', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw ApiException.notFound('Transfer');

			if (existing.status !== 'IN_TRANSIT') {
				throw ApiException.badRequest('Transfer is not in transit');
			}

			const receiveTransfer = async () => {
				return prisma.$transaction(async (tx) => {
					for (const line of existing.lines) {
						const recvLine = input.lines?.find((l) => l.lineId === line.id);
						const qtyToReceive = recvLine?.quantityReceived ?? line.quantityShipped;

						// Add to destination location
						let level = await tx.inventoryLevel.findFirst({
							where: {
								itemId: line.itemId,
								locationId: existing.toLocationId,
								lotNumber: line.lotNumber ?? null,
								serialNumber: line.serialNumber ?? null
							}
						});

						if (level) {
							await tx.inventoryLevel.update({
								where: { id: level.id },
								data: {
									quantityOnHand: level.quantityOnHand + qtyToReceive,
									quantityAvailable: level.quantityAvailable + qtyToReceive
								}
							});
						} else {
							await tx.inventoryLevel.create({
								data: {
									itemId: line.itemId,
									locationId: existing.toLocationId,
									quantityOnHand: qtyToReceive,
									quantityAvailable: qtyToReceive,
									lotNumber: line.lotNumber,
									serialNumber: line.serialNumber
								}
							});
						}

						await tx.inventoryTransferLine.update({
							where: { id: line.id },
							data: { quantityReceived: qtyToReceive }
						});
					}

					return tx.inventoryTransfer.update({
						where: { id: input.id },
						data: {
							status: 'COMPLETED',
							receivedAt: new Date()
						},
						include: { lines: true }
					});
				});
			};

			const transfer = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, receiveTransfer)).result
				: await receiveTransfer();

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('cancel', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw ApiException.notFound('Transfer');

			if (!['PENDING', 'IN_TRANSIT'].includes(existing.status)) {
				throw ApiException.badRequest('Cannot cancel completed or already cancelled transfer');
			}

			const cancelTransfer = async () => {
				return prisma.$transaction(async (tx) => {
					// If in transit, return stock to source
					if (existing.status === 'IN_TRANSIT') {
						const lines = await tx.inventoryTransferLine.findMany({
							where: { transferId: input.id }
						});

						for (const line of lines) {
							if (line.quantityShipped > 0) {
								let level = await tx.inventoryLevel.findFirst({
									where: {
										itemId: line.itemId,
										locationId: existing.fromLocationId,
										lotNumber: line.lotNumber ?? null,
										serialNumber: line.serialNumber ?? null
									}
								});

								if (level) {
									await tx.inventoryLevel.update({
										where: { id: level.id },
										data: {
											quantityOnHand: level.quantityOnHand + line.quantityShipped,
											quantityAvailable: level.quantityAvailable + line.quantityShipped
										}
									});
								} else {
									await tx.inventoryLevel.create({
										data: {
											itemId: line.itemId,
											locationId: existing.fromLocationId,
											quantityOnHand: line.quantityShipped,
											quantityAvailable: line.quantityShipped,
											lotNumber: line.lotNumber,
											serialNumber: line.serialNumber
										}
									});
								}
							}
						}
					}

					return tx.inventoryTransfer.update({
						where: { id: input.id },
						data: {
							status: 'CANCELLED',
							notes: input.reason
								? `${existing.notes ?? ''}\nCancelled: ${input.reason}`.trim()
								: existing.notes
						},
						include: { lines: true }
					});
				});
			};

			const transfer = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelTransfer)).result
				: await cancelTransfer();

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		})
};
