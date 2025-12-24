/**
 * Phase 16.6: Vendor Bid Routes
 * 
 * Manages bids/quotes from vendor candidates for cases.
 */

import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../router.js';
import { prisma } from '../../db.js';
import { ApiException } from '../errors.js';
import { recordIntent, recordExecution } from '../middleware/activityEvent.js';

// =============================================================================
// Schemas
// =============================================================================

const BidStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED']);

const VendorBidOutputSchema = z.object({
	id: z.string(),
	vendorCandidateId: z.string(),
	caseId: z.string(),
	vendorName: z.string(),
	scopeVersion: z.string().nullable(),
	amount: z.string().nullable(),
	currency: z.string(),
	validUntil: z.string().nullable(),
	laborCost: z.string().nullable(),
	materialsCost: z.string().nullable(),
	otherCosts: z.string().nullable(),
	estimatedStartDate: z.string().nullable(),
	estimatedDuration: z.number().nullable(),
	estimatedEndDate: z.string().nullable(),
	status: BidStatusSchema,
	receivedAt: z.string(),
	respondedAt: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const VendorBidListItemSchema = z.object({
	id: z.string(),
	vendorCandidateId: z.string(),
	vendorName: z.string(),
	amount: z.string().nullable(),
	currency: z.string(),
	status: BidStatusSchema,
	validUntil: z.string().nullable(),
	estimatedDuration: z.number().nullable(),
	receivedAt: z.string()
});

// =============================================================================
// Helper Functions
// =============================================================================

function serializeDecimal(d: any): string | null {
	return d ? d.toString() : null;
}

function serializeVendorBid(bid: any) {
	return {
		id: bid.id,
		vendorCandidateId: bid.vendorCandidateId,
		caseId: bid.caseId,
		vendorName: bid.vendorCandidate?.vendorName || 'Unknown',
		scopeVersion: bid.scopeVersion,
		amount: serializeDecimal(bid.amount),
		currency: bid.currency,
		validUntil: bid.validUntil?.toISOString() ?? null,
		laborCost: serializeDecimal(bid.laborCost),
		materialsCost: serializeDecimal(bid.materialsCost),
		otherCosts: serializeDecimal(bid.otherCosts),
		estimatedStartDate: bid.estimatedStartDate?.toISOString() ?? null,
		estimatedDuration: bid.estimatedDuration,
		estimatedEndDate: bid.estimatedEndDate?.toISOString() ?? null,
		status: bid.status,
		receivedAt: bid.receivedAt.toISOString(),
		respondedAt: bid.respondedAt?.toISOString() ?? null,
		notes: bid.notes,
		createdAt: bid.createdAt.toISOString(),
		updatedAt: bid.updatedAt.toISOString()
	};
}

function serializeVendorBidListItem(bid: any) {
	return {
		id: bid.id,
		vendorCandidateId: bid.vendorCandidateId,
		vendorName: bid.vendorCandidate?.vendorName || 'Unknown',
		amount: serializeDecimal(bid.amount),
		currency: bid.currency,
		status: bid.status,
		validUntil: bid.validUntil?.toISOString() ?? null,
		estimatedDuration: bid.estimatedDuration,
		receivedAt: bid.receivedAt.toISOString()
	};
}

// =============================================================================
// Router
// =============================================================================

export const vendorBidRouter = {
	/**
	 * Create a new bid for a vendor candidate
	 */
	create: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				vendorCandidateId: z.string(),
				caseId: z.string(),
				scopeVersion: z.string().optional(),
				amount: z.number().positive().optional(),
				currency: z.string().default('USD'),
				validUntil: z.string().datetime().optional(),
				laborCost: z.number().nonnegative().optional(),
				materialsCost: z.number().nonnegative().optional(),
				otherCosts: z.number().nonnegative().optional(),
				estimatedStartDate: z.string().datetime().optional(),
				estimatedDuration: z.number().int().positive().optional(),
				estimatedEndDate: z.string().datetime().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: VendorBidOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify vendor candidate exists and belongs to organization
			const vendorCandidate = await prisma.vendorCandidate.findFirst({
				where: {
					id: input.vendorCandidateId,
					organizationId: context.organization.id,
					deletedAt: null
				}
			});

			if (!vendorCandidate) {
				throw ApiException.notFound('VendorCandidate');
			}

			// Verify case matches
			if (vendorCandidate.caseId !== input.caseId) {
				throw ApiException.badRequest('Vendor candidate does not belong to this case');
			}

			await context.cerbos.authorize('create', 'vendor_bid', 'new');

			const bid = await prisma.vendorBid.create({
				data: {
					vendorCandidateId: input.vendorCandidateId,
					caseId: input.caseId,
					scopeVersion: input.scopeVersion,
					amount: input.amount,
					currency: input.currency,
					validUntil: input.validUntil ? new Date(input.validUntil) : null,
					laborCost: input.laborCost,
					materialsCost: input.materialsCost,
					otherCosts: input.otherCosts,
					estimatedStartDate: input.estimatedStartDate ? new Date(input.estimatedStartDate) : null,
					estimatedDuration: input.estimatedDuration,
					estimatedEndDate: input.estimatedEndDate ? new Date(input.estimatedEndDate) : null,
					notes: input.notes,
					status: 'PENDING',
					receivedAt: new Date()
				},
				include: {
					vendorCandidate: true
				}
			});

			// Update vendor candidate status to QUOTED
			await prisma.vendorCandidate.update({
				where: { id: input.vendorCandidateId },
				data: {
					status: 'QUOTED',
					statusChangedAt: new Date()
				}
			});

			await recordIntent(context, {
				entityType: 'VENDOR_BID',
				entityId: bid.id,
				action: 'CREATE',
				summary: `Bid received from ${vendorCandidate.vendorName}: ${input.amount ? `$${input.amount}` : 'Amount TBD'}`,
				caseId: input.caseId,
				newState: {
					amount: input.amount,
					status: 'PENDING'
				}
			});

			return successResponse({ bid: serializeVendorBid(bid) }, context);
		}),

	/**
	 * Get bid by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: VendorBidOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const bid = await prisma.vendorBid.findFirst({
				where: { id: input.id },
				include: {
					vendorCandidate: true,
					case: true
				}
			});

			if (!bid || bid.case?.organizationId !== context.organization.id) {
				throw ApiException.notFound('VendorBid');
			}

			await context.cerbos.authorize('view', 'vendor_bid', bid.id);

			return successResponse({ bid: serializeVendorBid(bid) }, context);
		}),

	/**
	 * List bids for a case
	 */
	listByCase: orgProcedure
		.input(
			PaginationInputSchema.extend({
				caseId: z.string(),
				status: BidStatusSchema.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bids: z.array(VendorBidListItemSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify case belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id
				}
			});

			if (!caseRecord) {
				throw ApiException.notFound('ConciergeCase');
			}

			await context.cerbos.authorize('view', 'vendor_bid', 'list');

			const limit = input.limit ?? 50;
			const bids = await prisma.vendorBid.findMany({
				where: {
					caseId: input.caseId,
					...(input.status && { status: input.status })
				},
				include: {
					vendorCandidate: true
				},
				orderBy: { receivedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = bids.length > limit;
			const items = hasMore ? bids.slice(0, -1) : bids;

			return successResponse(
				{
					bids: items.map(serializeVendorBidListItem),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Update bid details
	 */
	update: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				scopeVersion: z.string().nullable().optional(),
				amount: z.number().positive().nullable().optional(),
				validUntil: z.string().datetime().nullable().optional(),
				laborCost: z.number().nonnegative().nullable().optional(),
				materialsCost: z.number().nonnegative().nullable().optional(),
				otherCosts: z.number().nonnegative().nullable().optional(),
				estimatedStartDate: z.string().datetime().nullable().optional(),
				estimatedDuration: z.number().int().positive().nullable().optional(),
				estimatedEndDate: z.string().datetime().nullable().optional(),
				notes: z.string().nullable().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: VendorBidOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.vendorBid.findFirst({
				where: { id: input.id },
				include: {
					vendorCandidate: true,
					case: true
				}
			});

			if (!existing || existing.case?.organizationId !== context.organization.id) {
				throw ApiException.notFound('VendorBid');
			}

			await context.cerbos.authorize('update', 'vendor_bid', existing.id);

			const bid = await prisma.vendorBid.update({
				where: { id: input.id },
				data: {
					...(input.scopeVersion !== undefined && { scopeVersion: input.scopeVersion }),
					...(input.amount !== undefined && { amount: input.amount }),
					...(input.validUntil !== undefined && {
						validUntil: input.validUntil ? new Date(input.validUntil) : null
					}),
					...(input.laborCost !== undefined && { laborCost: input.laborCost }),
					...(input.materialsCost !== undefined && { materialsCost: input.materialsCost }),
					...(input.otherCosts !== undefined && { otherCosts: input.otherCosts }),
					...(input.estimatedStartDate !== undefined && {
						estimatedStartDate: input.estimatedStartDate ? new Date(input.estimatedStartDate) : null
					}),
					...(input.estimatedDuration !== undefined && { estimatedDuration: input.estimatedDuration }),
					...(input.estimatedEndDate !== undefined && {
						estimatedEndDate: input.estimatedEndDate ? new Date(input.estimatedEndDate) : null
					}),
					...(input.notes !== undefined && { notes: input.notes })
				},
				include: {
					vendorCandidate: true
				}
			});

			await recordExecution(context, {
				entityType: 'VENDOR_BID',
				entityId: bid.id,
				action: 'UPDATE',
				summary: `Bid updated for ${existing.vendorCandidate?.vendorName}`,
				caseId: existing.caseId
			});

			return successResponse({ bid: serializeVendorBid(bid) }, context);
		}),

	/**
	 * Accept a bid (select this vendor)
	 */
	accept: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: VendorBidOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.vendorBid.findFirst({
				where: { id: input.id },
				include: {
					vendorCandidate: true,
					case: true
				}
			});

			if (!existing || existing.case?.organizationId !== context.organization.id) {
				throw ApiException.notFound('VendorBid');
			}

			if (existing.status !== 'PENDING') {
				throw ApiException.badRequest(`Cannot accept bid with status ${existing.status}`);
			}

			await context.cerbos.authorize('accept', 'vendor_bid', existing.id);

			// Use transaction to update bid and vendor candidate
			const bid = await prisma.$transaction(async (tx) => {
				// Accept this bid
				const updatedBid = await tx.vendorBid.update({
					where: { id: input.id },
					data: {
						status: 'ACCEPTED',
						respondedAt: new Date()
					},
					include: {
						vendorCandidate: true
					}
				});

				// Update vendor candidate to SELECTED
				await tx.vendorCandidate.update({
					where: { id: existing.vendorCandidateId },
					data: {
						status: 'SELECTED',
						statusChangedAt: new Date()
					}
				});

				// Reject other pending bids for this case
				await tx.vendorBid.updateMany({
					where: {
						caseId: existing.caseId,
						id: { not: input.id },
						status: 'PENDING'
					},
					data: {
						status: 'REJECTED',
						respondedAt: new Date()
					}
				});

				return updatedBid;
			});

			await recordExecution(context, {
				entityType: 'VENDOR_BID',
				entityId: bid.id,
				action: 'APPROVE',
				summary: `Bid accepted from ${existing.vendorCandidate?.vendorName}${input.reason ? `: ${input.reason}` : ''}`,
				caseId: existing.caseId,
				previousState: { status: existing.status },
				newState: { status: 'ACCEPTED' }
			});

			return successResponse({ bid: serializeVendorBid(bid) }, context);
		}),

	/**
	 * Reject a bid
	 */
	reject: orgProcedure
		.input(
			IdempotencyKeySchema.extend({
				id: z.string(),
				reason: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bid: VendorBidOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const existing = await prisma.vendorBid.findFirst({
				where: { id: input.id },
				include: {
					vendorCandidate: true,
					case: true
				}
			});

			if (!existing || existing.case?.organizationId !== context.organization.id) {
				throw ApiException.notFound('VendorBid');
			}

			if (existing.status !== 'PENDING') {
				throw ApiException.badRequest(`Cannot reject bid with status ${existing.status}`);
			}

			await context.cerbos.authorize('reject', 'vendor_bid', existing.id);

			const bid = await prisma.$transaction(async (tx) => {
				const updatedBid = await tx.vendorBid.update({
					where: { id: input.id },
					data: {
						status: 'REJECTED',
						respondedAt: new Date(),
						notes: input.reason
							? existing.notes
								? `${existing.notes}\n\nRejection reason: ${input.reason}`
								: `Rejection reason: ${input.reason}`
							: existing.notes
					},
					include: {
						vendorCandidate: true
					}
				});

				// Update vendor candidate to REJECTED
				await tx.vendorCandidate.update({
					where: { id: existing.vendorCandidateId },
					data: {
						status: 'REJECTED',
						statusChangedAt: new Date()
					}
				});

				return updatedBid;
			});

			await recordExecution(context, {
				entityType: 'VENDOR_BID',
				entityId: bid.id,
				action: 'DENY',
				summary: `Bid rejected from ${existing.vendorCandidate?.vendorName}${input.reason ? `: ${input.reason}` : ''}`,
				caseId: existing.caseId,
				previousState: { status: existing.status },
				newState: { status: 'REJECTED' }
			});

			return successResponse({ bid: serializeVendorBid(bid) }, context);
		}),

	/**
	 * Get bid comparison for a case
	 */
	compare: orgProcedure
		.input(z.object({ caseId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					comparison: z.object({
						caseId: z.string(),
						bids: z.array(
							z.object({
								id: z.string(),
								vendorName: z.string(),
								amount: z.string().nullable(),
								laborCost: z.string().nullable(),
								materialsCost: z.string().nullable(),
								otherCosts: z.string().nullable(),
								estimatedDuration: z.number().nullable(),
								status: BidStatusSchema,
								validUntil: z.string().nullable(),
								isLowest: z.boolean(),
								isFastest: z.boolean()
							})
						),
						lowestBidId: z.string().nullable(),
						fastestBidId: z.string().nullable(),
						averageAmount: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			// Verify case belongs to organization
			const caseRecord = await prisma.conciergeCase.findFirst({
				where: {
					id: input.caseId,
					organizationId: context.organization.id
				}
			});

			if (!caseRecord) {
				throw ApiException.notFound('ConciergeCase');
			}

			await context.cerbos.authorize('view', 'vendor_bid', 'list');

			const bids = await prisma.vendorBid.findMany({
				where: { caseId: input.caseId },
				include: { vendorCandidate: true },
				orderBy: { amount: 'asc' }
			});

			// Calculate comparison metrics
			const bidsWithAmounts = bids.filter((b) => b.amount !== null);
			const bidsWithDuration = bids.filter((b) => b.estimatedDuration !== null);

			const lowestBid = bidsWithAmounts[0];
			const fastestBid = bidsWithDuration.sort(
				(a, b) => (a.estimatedDuration || 999) - (b.estimatedDuration || 999)
			)[0];

			const totalAmount = bidsWithAmounts.reduce(
				(sum, b) => sum + (b.amount?.toNumber() || 0),
				0
			);
			const averageAmount =
				bidsWithAmounts.length > 0 ? totalAmount / bidsWithAmounts.length : null;

			const comparison = {
				caseId: input.caseId,
				bids: bids.map((bid) => ({
					id: bid.id,
					vendorName: bid.vendorCandidate?.vendorName || 'Unknown',
					amount: serializeDecimal(bid.amount),
					laborCost: serializeDecimal(bid.laborCost),
					materialsCost: serializeDecimal(bid.materialsCost),
					otherCosts: serializeDecimal(bid.otherCosts),
					estimatedDuration: bid.estimatedDuration,
					status: bid.status as 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED',
					validUntil: bid.validUntil?.toISOString() ?? null,
					isLowest: lowestBid?.id === bid.id,
					isFastest: fastestBid?.id === bid.id
				})),
				lowestBidId: lowestBid?.id ?? null,
				fastestBidId: fastestBid?.id ?? null,
				averageAmount: averageAmount?.toFixed(2) ?? null
			};

			return successResponse({ comparison }, context);
		})
};
