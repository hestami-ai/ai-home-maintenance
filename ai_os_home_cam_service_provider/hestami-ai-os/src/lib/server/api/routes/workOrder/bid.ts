import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { BidStatusSchema } from '../../schemas.js';
import { prisma } from '../../../db.js';
import { createModuleLogger } from '../../../logger.js';
import { startBidWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('BidRoute');

const bidStatusEnum = BidStatusSchema;

/**
 * Work Order Bidding procedures
 */
export const bidRouter = {
	/**
	 * Request bids from vendors for a work order
	 */
	requestBids: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				workOrderId: z.string(),
				vendorIds: z.array(z.string()).min(1).max(10),
				dueDate: z.string().datetime(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bids: z.array(
						z.object({
							id: z.string(),
							vendorId: z.string(),
							status: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			CONFLICT: { message: 'Conflict' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!workOrder) throw errors.NOT_FOUND({ message: 'Work Order' });

			// Work order must be in TRIAGED status to request bids
			if (workOrder.status !== 'TRIAGED') {
				throw errors.BAD_REQUEST({ message: 'Work order must be triaged before requesting bids' });
			}

			// Validate all vendors exist and belong to this association
			const vendors = await prisma.vendor.findMany({
				where: {
					id: { in: input.vendorIds },
					organizationId: context.organization.id,
					associationId: association.id,
					isActive: true
				}
			});

			if (vendors.length !== input.vendorIds.length) {
				throw errors.BAD_REQUEST({ message: 'One or more vendors not found or inactive' });
			}

			// Check for existing bids
			const existingBids = await prisma.workOrderBid.findMany({
				where: {
					workOrderId: input.workOrderId,
					vendorId: { in: input.vendorIds }
				}
			});

			const existingVendorIds = new Set(existingBids.map(b => b.vendorId));
			const newVendorIds = input.vendorIds.filter(id => !existingVendorIds.has(id));

			if (newVendorIds.length === 0) {
				throw errors.CONFLICT({ message: 'Bids already requested from all specified vendors' });
			}

			// Create bid requests via workflow
			const result = await startBidWorkflow(
				{
					action: 'REQUEST_BIDS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					workOrderId: input.workOrderId,
					data: {
						vendorIds: newVendorIds,
						dueDate: input.dueDate,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success || !result.bidIds) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to request bids' });
			}

			// Return the created bids
			const bids = await prisma.workOrderBid.findMany({
				where: { id: { in: result.bidIds } }
			});

			return successResponse(
				{
					bids: bids.map(b => ({
						id: b.id,
						vendorId: b.vendorId,
						status: b.status
					}))
				},
				context
			);
		}),

	/**
	 * Submit a bid (vendor perspective)
	 */
	submitBid: orgProcedure
		.input(
			z.object({
                idempotencyKey: z.string().uuid(),
                bidId: z.string(),
				laborCost: z.number().min(0),
				materialsCost: z.number().min(0),
				estimatedHours: z.number().min(0).optional(),
				proposedStartDate: z.string().datetime().optional(),
				proposedEndDate: z.string().datetime().optional(),
				notes: z.string().max(2000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: z.object({
						id: z.string(),
						totalAmount: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const bid = await prisma.workOrderBid.findFirstOrThrow({
				where: {
					id: input.bidId,
					workOrder: { association: { organizationId: context.organization!.id } }
				},
				include: { workOrder: true, vendor: true }
			}).catch(() => {
				throw errors.NOT_FOUND({ message: 'Bid' });
			});

			// Check authorization - must be the vendor or an admin/manager
			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Bid must be in REQUESTED or PENDING status
			if (!['REQUESTED', 'PENDING'].includes(bid.status)) {
				throw errors.BAD_REQUEST({ message: 'Bid cannot be submitted in current status' });
			}

			// Check if bid has expired
			if (bid.validUntil && new Date() > bid.validUntil) {
				// Expire via workflow
				await startBidWorkflow(
					{
						action: 'EXPIRE_BID',
						organizationId: context.organization!.id,
						userId: context.user!.id,
						bidId: input.bidId,
						data: {}
					},
					`${input.idempotencyKey}-expire`
				);
				throw errors.BAD_REQUEST({ message: 'Bid has expired' });
			}

			// Submit bid via workflow
			const result = await startBidWorkflow(
				{
					action: 'SUBMIT_BID',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					bidId: input.bidId,
					data: {
						laborCost: input.laborCost,
						materialsCost: input.materialsCost,
						estimatedHours: input.estimatedHours,
						proposedStartDate: input.proposedStartDate,
						proposedEndDate: input.proposedEndDate,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to submit bid' });
			}

			const totalAmount = input.laborCost + input.materialsCost;

			return successResponse(
				{
					bid: {
						id: input.bidId,
						totalAmount: totalAmount.toString(),
						status: 'SUBMITTED'
					}
				},
				context
			);
		}),

	/**
	 * List bids for a work order
	 */
	listBids: orgProcedure
		.input(z.object({ workOrderId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bids: z.array(
						z.object({
							id: z.string(),
							vendorId: z.string(),
							vendorName: z.string(),
							status: z.string(),
							laborCost: z.string().nullable(),
							materialsCost: z.string().nullable(),
							totalAmount: z.string().nullable(),
							estimatedHours: z.string().nullable(),
							proposedStartDate: z.string().nullable(),
							proposedEndDate: z.string().nullable(),
							submittedAt: z.string().nullable(),
							validUntil: z.string().nullable(),
							notes: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, organizationId: context.organization.id, associationId: association.id }
			});

			if (!workOrder) throw errors.NOT_FOUND({ message: 'Work Order' });

			const bids = await prisma.workOrderBid.findMany({
				where: { workOrderId: input.workOrderId },
				include: { vendor: true },
				orderBy: [{ status: 'asc' }, { totalAmount: 'asc' }]
			});

			return successResponse(
				{
					bids: bids.map(b => ({
						id: b.id,
						vendorId: b.vendorId,
						vendorName: b.vendor.name,
						status: b.status,
						laborCost: b.laborCost?.toString() ?? null,
						materialsCost: b.materialsCost?.toString() ?? null,
						totalAmount: b.totalAmount?.toString() ?? null,
						estimatedHours: b.estimatedHours?.toString() ?? null,
						proposedStartDate: b.proposedStartDate?.toISOString() ?? null,
						proposedEndDate: b.proposedEndDate?.toISOString() ?? null,
						submittedAt: b.submittedAt?.toISOString() ?? null,
						validUntil: b.validUntil?.toISOString() ?? null,
						notes: b.notes
					}))
				},
				context
			);
		}),

	/**
	 * Accept a bid and assign vendor to work order
	 */
	acceptBid: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				bidId: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: z.object({
						id: z.string(),
						status: z.string()
					}),
					workOrder: z.object({
						id: z.string(),
						status: z.string(),
						assignedVendorId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const bid = await prisma.workOrderBid.findFirstOrThrow({
				where: {
					id: input.bidId,
					workOrder: { association: { organizationId: context.organization!.id } }
				},
				include: { workOrder: true, vendor: true }
			}).catch(() => {
				throw errors.NOT_FOUND({ message: 'Bid' });
			});

			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Bid must be SUBMITTED or UNDER_REVIEW
			if (!['SUBMITTED', 'UNDER_REVIEW'].includes(bid.status)) {
				throw errors.BAD_REQUEST({ message: 'Bid must be submitted to accept' });
			}

			// Accept bid via workflow
			const result = await startBidWorkflow(
				{
					action: 'ACCEPT_BID',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					bidId: input.bidId,
					data: {
						workOrderId: bid.workOrderId,
						vendorId: bid.vendorId,
						vendorName: bid.vendor.name,
						workOrderStatus: bid.workOrder.status,
						totalAmount: bid.totalAmount ? parseFloat(bid.totalAmount.toString()) : undefined,
						estimatedHours: bid.estimatedHours ? parseFloat(bid.estimatedHours.toString()) : undefined,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to accept bid' });
			}

			return successResponse(
				{
					bid: {
						id: input.bidId,
						status: 'ACCEPTED'
					},
					workOrder: {
						id: bid.workOrderId,
						status: 'ASSIGNED',
						assignedVendorId: bid.vendorId
					}
				},
				context
			);
		}),

	/**
	 * Reject a bid
	 */
	rejectBid: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				bidId: z.string(),
				reason: z.string().max(500).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const bid = await prisma.workOrderBid.findFirstOrThrow({
				where: {
					id: input.bidId,
					workOrder: { association: { organizationId: context.organization!.id } }
				},
				include: { workOrder: true }
			}).catch(() => {
				throw errors.NOT_FOUND({ message: 'Bid' });
			});

			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Can only reject submitted bids
			if (!['SUBMITTED', 'UNDER_REVIEW'].includes(bid.status)) {
				throw errors.BAD_REQUEST({ message: 'Bid must be submitted to reject' });
			}

			// Reject bid via workflow
			const result = await startBidWorkflow(
				{
					action: 'REJECT_BID',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					bidId: input.bidId,
					data: {
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to reject bid' });
			}

			return successResponse(
				{
					bid: {
						id: input.bidId,
						status: 'REJECTED'
					}
				},
				context
			);
		}),

	/**
	 * Withdraw a bid (vendor perspective)
	 */
	withdrawBid: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				bidId: z.string(),
				reason: z.string().max(500).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: z.object({
						id: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'work_order_bid', input.bidId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const bid = await prisma.workOrderBid.findFirstOrThrow({
				where: {
					id: input.bidId,
					workOrder: { association: { organizationId: context.organization!.id } }
				},
				include: { workOrder: true }
			}).catch(() => {
				throw errors.NOT_FOUND({ message: 'Bid' });
			});

			// Can only withdraw pending or submitted bids
			if (!['REQUESTED', 'PENDING', 'SUBMITTED'].includes(bid.status)) {
				throw errors.BAD_REQUEST({ message: 'Bid cannot be withdrawn in current status' });
			}

			// Withdraw bid via workflow
			const result = await startBidWorkflow(
				{
					action: 'WITHDRAW_BID',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					bidId: input.bidId,
					data: {
						reason: input.reason
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.BAD_REQUEST({ message: result.error || 'Failed to withdraw bid' });
			}

			return successResponse(
				{
					bid: {
						id: input.bidId,
						status: 'WITHDRAWN'
					}
				},
				context
			);
		})
};
