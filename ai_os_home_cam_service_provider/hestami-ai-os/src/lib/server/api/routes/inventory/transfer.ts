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
import { startTransferWorkflow } from '../../../workflows/transferWorkflow.js';

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
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
			if (!fromLoc) throw errors.NOT_FOUND({ message: 'From location not found' });
			if (!toLoc) throw errors.NOT_FOUND({ message: 'To location not found' });

			if (input.fromLocationId === input.toLocationId) {
				throw errors.BAD_REQUEST({ message: 'Cannot transfer to same location' });
			}

			// Use DBOS workflow for durable execution
			const result = await startTransferWorkflow(
				{
					action: 'CREATE_TRANSFER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						fromLocationId: input.fromLocationId,
						toLocationId: input.toLocationId,
						notes: input.notes,
						lines: input.lines
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create transfer' });
			}

			const transfer = await prisma.inventoryTransfer.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { lines: true }
			});

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
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
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'inventory_transfer', input.id);

			const transfer = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});

			if (!transfer) throw errors.NOT_FOUND({ message: 'Transfer not found' });

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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('ship', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Transfer not found' });

			if (existing.status !== 'PENDING') {
				throw errors.BAD_REQUEST({ message: 'Transfer is not pending' });
			}

			// Use DBOS workflow for durable execution
			const result = await startTransferWorkflow(
				{
					action: 'SHIP_TRANSFER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					transferId: input.id,
					data: {
						fromLocationId: existing.fromLocationId,
						existingLines: existing.lines.map((l) => ({
							id: l.id,
							itemId: l.itemId,
							quantityRequested: l.quantityRequested,
							lotNumber: l.lotNumber,
							serialNumber: l.serialNumber
						})),
						lines: input.lines
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to ship transfer' });
			}

			const transfer = await prisma.inventoryTransfer.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { lines: true }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('receive', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id },
				include: { lines: true }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Transfer not found' });

			if (existing.status !== 'IN_TRANSIT') {
				throw errors.BAD_REQUEST({ message: 'Transfer is not in transit' });
			}

			// Use DBOS workflow for durable execution
			const result = await startTransferWorkflow(
				{
					action: 'RECEIVE_TRANSFER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					transferId: input.id,
					data: {
						toLocationId: existing.toLocationId,
						existingLines: existing.lines.map((l) => ({
							id: l.id,
							itemId: l.itemId,
							quantityShipped: l.quantityShipped,
							lotNumber: l.lotNumber,
							serialNumber: l.serialNumber
						})),
						lines: input.lines
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to receive transfer' });
			}

			const transfer = await prisma.inventoryTransfer.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { lines: true }
			});

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ transfer: transferOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('cancel', 'inventory_transfer', input.id);

			const existing = await prisma.inventoryTransfer.findFirst({
				where: { id: input.id, organizationId: context.organization!.id }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Transfer not found' });

			if (!['PENDING', 'IN_TRANSIT'].includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot cancel completed or already cancelled transfer' });
			}

			// Get lines if in transit (needed for stock return)
			const lines = existing.status === 'IN_TRANSIT'
				? await prisma.inventoryTransferLine.findMany({ where: { transferId: input.id } })
				: [];

			// Use DBOS workflow for durable execution
			const result = await startTransferWorkflow(
				{
					action: 'CANCEL_TRANSFER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					transferId: input.id,
					data: {
						existingStatus: existing.status,
						fromLocationId: existing.fromLocationId,
						existingLines: lines.map((l) => ({
							id: l.id,
							itemId: l.itemId,
							quantityShipped: l.quantityShipped,
							lotNumber: l.lotNumber,
							serialNumber: l.serialNumber
						})),
						reason: input.reason,
						existingNotes: existing.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel transfer' });
			}

			const transfer = await prisma.inventoryTransfer.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { lines: true }
			});

			return successResponse({ transfer: formatTransfer(transfer, true) }, context);
		})
};
