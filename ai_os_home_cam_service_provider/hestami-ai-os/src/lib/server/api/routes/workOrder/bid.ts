import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';

const bidStatusEnum = z.enum([
	'REQUESTED', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW',
	'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
]);

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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});

			if (!workOrder) {
				throw ApiException.notFound('Work Order');
			}

			// Work order must be in TRIAGED status to request bids
			if (workOrder.status !== 'TRIAGED') {
				throw ApiException.badRequest('Work order must be triaged before requesting bids');
			}

			// Validate all vendors exist and belong to this association
			const vendors = await prisma.vendor.findMany({
				where: {
					id: { in: input.vendorIds },
					associationId: association.id,
					isActive: true
				}
			});

			if (vendors.length !== input.vendorIds.length) {
				throw ApiException.badRequest('One or more vendors not found or inactive');
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
				throw ApiException.conflict('Bids already requested from all specified vendors');
			}

			// Create bid requests
			const bids = await prisma.$transaction(
				newVendorIds.map(vendorId =>
					prisma.workOrderBid.create({
						data: {
							workOrderId: input.workOrderId,
							vendorId,
							status: 'REQUESTED',
							validUntil: new Date(input.dueDate),
							notes: input.notes
						}
					})
				)
			);

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
		.handler(async ({ input, context }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const bid = await prisma.workOrderBid.findFirst({
				where: { id: input.bidId },
				include: { workOrder: true, vendor: true }
			});

			if (!bid || bid.workOrder.associationId !== association.id) {
				throw ApiException.notFound('Bid');
			}

			// Check authorization - must be the vendor or an admin/manager
			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Bid must be in REQUESTED or PENDING status
			if (!['REQUESTED', 'PENDING'].includes(bid.status)) {
				throw ApiException.badRequest('Bid cannot be submitted in current status');
			}

			// Check if bid has expired
			if (bid.validUntil && new Date() > bid.validUntil) {
				await prisma.workOrderBid.update({
					where: { id: input.bidId },
					data: { status: 'EXPIRED' }
				});
				throw ApiException.badRequest('Bid has expired');
			}

			const totalAmount = input.laborCost + input.materialsCost;

			const updated = await prisma.workOrderBid.update({
				where: { id: input.bidId },
				data: {
					laborCost: input.laborCost,
					materialsCost: input.materialsCost,
					totalAmount,
					estimatedHours: input.estimatedHours,
					proposedStartDate: input.proposedStartDate ? new Date(input.proposedStartDate) : null,
					proposedEndDate: input.proposedEndDate ? new Date(input.proposedEndDate) : null,
					notes: input.notes,
					status: 'SUBMITTED',
					submittedAt: new Date()
				}
			});

			return successResponse(
				{
					bid: {
						id: updated.id,
						totalAmount: updated.totalAmount!.toString(),
						status: updated.status
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'work_order', input.workOrderId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const workOrder = await prisma.workOrder.findFirst({
				where: { id: input.workOrderId, associationId: association.id }
			});

			if (!workOrder) {
				throw ApiException.notFound('Work Order');
			}

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
		.handler(async ({ input, context }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const bid = await prisma.workOrderBid.findFirst({
				where: { id: input.bidId },
				include: { workOrder: true, vendor: true }
			});

			if (!bid || bid.workOrder.associationId !== association.id) {
				throw ApiException.notFound('Bid');
			}

			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Bid must be SUBMITTED or UNDER_REVIEW
			if (!['SUBMITTED', 'UNDER_REVIEW'].includes(bid.status)) {
				throw ApiException.badRequest('Bid must be submitted to accept');
			}

			const result = await prisma.$transaction(async (tx) => {
				// Accept this bid
				const acceptedBid = await tx.workOrderBid.update({
					where: { id: input.bidId },
					data: {
						status: 'ACCEPTED',
						respondedAt: new Date(),
						respondedBy: context.user!.id
					}
				});

				// Reject all other bids for this work order
				await tx.workOrderBid.updateMany({
					where: {
						workOrderId: bid.workOrderId,
						id: { not: input.bidId },
						status: { in: ['REQUESTED', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW'] }
					},
					data: {
						status: 'REJECTED',
						respondedAt: new Date(),
						respondedBy: context.user!.id
					}
				});

				// Assign vendor to work order
				const workOrder = await tx.workOrder.update({
					where: { id: bid.workOrderId },
					data: {
						assignedVendorId: bid.vendorId,
						assignedAt: new Date(),
						assignedBy: context.user!.id,
						status: 'ASSIGNED',
						estimatedCost: bid.totalAmount,
						estimatedHours: bid.estimatedHours
					}
				});

				// Record status change
				await tx.workOrderStatusHistory.create({
					data: {
						workOrderId: bid.workOrderId,
						fromStatus: bid.workOrder.status,
						toStatus: 'ASSIGNED',
						changedBy: context.user!.id,
						notes: input.notes || `Bid accepted from ${bid.vendor.name}`
					}
				});

				return { acceptedBid, workOrder };
			});

			return successResponse(
				{
					bid: {
						id: result.acceptedBid.id,
						status: result.acceptedBid.status
					},
					workOrder: {
						id: result.workOrder.id,
						status: result.workOrder.status,
						assignedVendorId: result.workOrder.assignedVendorId!
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
		.handler(async ({ input, context }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const bid = await prisma.workOrderBid.findFirst({
				where: { id: input.bidId },
				include: { workOrder: true }
			});

			if (!bid || bid.workOrder.associationId !== association.id) {
				throw ApiException.notFound('Bid');
			}

			await context.cerbos.authorize('edit', 'work_order', bid.workOrderId);

			// Can only reject submitted bids
			if (!['SUBMITTED', 'UNDER_REVIEW'].includes(bid.status)) {
				throw ApiException.badRequest('Bid must be submitted to reject');
			}

			const updated = await prisma.workOrderBid.update({
				where: { id: input.bidId },
				data: {
					status: 'REJECTED',
					respondedAt: new Date(),
					respondedBy: context.user!.id,
					notes: input.reason ? `Rejected: ${input.reason}` : bid.notes
				}
			});

			return successResponse(
				{
					bid: {
						id: updated.id,
						status: updated.status
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
		.handler(async ({ input, context }) => {
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const bid = await prisma.workOrderBid.findFirst({
				where: { id: input.bidId },
				include: { workOrder: true }
			});

			if (!bid || bid.workOrder.associationId !== association.id) {
				throw ApiException.notFound('Bid');
			}

			// Can only withdraw pending or submitted bids
			if (!['REQUESTED', 'PENDING', 'SUBMITTED'].includes(bid.status)) {
				throw ApiException.badRequest('Bid cannot be withdrawn in current status');
			}

			const updated = await prisma.workOrderBid.update({
				where: { id: input.bidId },
				data: {
					status: 'WITHDRAWN',
					notes: input.reason ? `Withdrawn: ${input.reason}` : bid.notes
				}
			});

			return successResponse(
				{
					bid: {
						id: updated.id,
						status: updated.status
					}
				},
				context
			);
		})
};
