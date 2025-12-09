import { z } from 'zod';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { Prisma, ARCReviewAction, ARCRequestStatus } from '../../../../../../generated/prisma/client.js';
import type { RequestContext } from '../../context.js';

const arcReviewActionEnum = z.enum(['APPROVE', 'DENY', 'REQUEST_CHANGES', 'TABLE']);
const terminalStatuses: ARCRequestStatus[] = ['APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED'];
const reviewableStatuses: ARCRequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

const requireIdempotency = async <T>(key: string | undefined, ctx: RequestContext, fn: () => Promise<T>) => {
	if (!key) throw ApiException.badRequest('Idempotency key is required');
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

const ensureCommitteeBelongs = async (committeeId: string, associationId: string) => {
	const committee = await prisma.aRCCommittee.findFirst({ where: { id: committeeId, associationId, isActive: true } });
	if (!committee) throw ApiException.notFound('ARC Committee');
	return committee;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw ApiException.notFound('Party');
};

const ensureCommitteeMember = async (committeeId: string, userId: string) => {
	const membership = await prisma.aRCCommitteeMember.findFirst({
		where: { committeeId, leftAt: null, party: { userId } }
	});
	if (!membership) throw ApiException.forbidden('User is not a committee member');
};

const getReviewStats = async (requestId: string) => {
	const reviews = await prisma.aRCReview.findMany({ where: { requestId }, select: { action: true } });
	const counts = reviews.reduce(
		(acc, r) => {
			acc.total += 1;
			if (r.action === 'APPROVE') acc.approvals += 1;
			return acc;
		},
		{ total: 0, approvals: 0 }
	);
	return counts;
};

export const arcReviewRouter = {
	// Committee membership management
	addMember: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					committeeId: z.string(),
					partyId: z.string(),
					role: z.string().optional(),
					isChair: z.boolean().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ member: z.object({ id: z.string(), committeeId: z.string(), partyId: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.committeeId);
			const { idempotencyKey, ...rest } = input;

			const member = await requireIdempotency(idempotencyKey, context, async () => {
				const committee = await prisma.aRCCommittee.findFirst({
					where: { id: rest.committeeId },
					include: { association: true }
				});
				if (!committee || committee.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Committee');
				}
				await ensurePartyBelongs(rest.partyId, committee.association.organizationId);

				const existing = await prisma.aRCCommitteeMember.findFirst({
					where: { committeeId: rest.committeeId, partyId: rest.partyId, leftAt: null }
				});
				if (existing) return existing;

				return prisma.aRCCommitteeMember.create({
					data: {
						committeeId: rest.committeeId,
						partyId: rest.partyId,
						role: rest.role,
						isChair: rest.isChair ?? false
					}
				});
			});

			return successResponse(
				{ member: { id: member.id, committeeId: member.committeeId, partyId: member.partyId } },
				context
			);
		}),

	removeMember: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					committeeId: z.string(),
					partyId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ member: z.object({ committeeId: z.string(), partyId: z.string(), leftAt: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.committeeId);
			const { idempotencyKey, ...rest } = input;

			const leftAtIso = await requireIdempotency(idempotencyKey, context, async () => {
				const committee = await prisma.aRCCommittee.findFirst({
					where: { id: rest.committeeId },
					include: { association: true }
				});
				if (!committee || committee.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Committee');
				}

				const leftAt = new Date();
				await prisma.aRCCommitteeMember.updateMany({
					where: { committeeId: rest.committeeId, partyId: rest.partyId, leftAt: null },
					data: { leftAt }
				});
				return leftAt.toISOString();
			});

			return successResponse(
				{ member: { committeeId: input.committeeId, partyId: input.partyId, leftAt: leftAtIso } },
				context
			);
		}),

	listMembers: orgProcedure
		.input(z.object({ committeeId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					members: z.array(
						z.object({
							id: z.string(),
							partyId: z.string(),
							role: z.string().nullable(),
							isChair: z.boolean(),
							leftAt: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const committee = await prisma.aRCCommittee.findFirst({
				where: { id: input.committeeId },
				include: { association: true }
			});
			if (!committee || committee.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ARC Committee');
			}

			const members = await prisma.aRCCommitteeMember.findMany({
				where: { committeeId: input.committeeId },
				orderBy: { joinedAt: 'asc' }
			});

			return successResponse(
				{
					members: members.map((m) => ({
						id: m.id,
						partyId: m.partyId,
						role: m.role ?? null,
						isChair: m.isChair,
						leftAt: m.leftAt ? m.leftAt.toISOString() : null
					}))
				},
				context
			);
		}),

	// Committee assignment to request
	assignCommittee: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					committeeId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ request: z.object({ id: z.string(), status: z.string(), committeeId: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const updated = await requireIdempotency(idempotencyKey, context, async () => {
				const request = await prisma.aRCRequest.findFirst({
					where: { id: rest.requestId },
					include: { association: true }
				});
				if (!request || request.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Cannot assign committee after final decision or closure');
				}

				await ensureCommitteeBelongs(rest.committeeId, request.associationId);

				return prisma.aRCRequest.update({
					where: { id: rest.requestId },
					data: { committeeId: rest.committeeId, status: 'UNDER_REVIEW', reviewedAt: null, decisionDate: null }
				});
			});

			return successResponse(
				{ request: { id: updated.id, status: updated.status, committeeId: updated.committeeId! } },
				context
			);
		}),

	// Member review submission
	submitReview: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					action: arcReviewActionEnum,
					notes: z.string().max(5000).optional(),
					conditions: z.string().max(5000).optional(),
					expiresAt: z.string().datetime().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ review: z.object({ id: z.string(), requestId: z.string(), action: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const review = await requireIdempotency(idempotencyKey, context, async () => {
				const request = await prisma.aRCRequest.findFirst({
					where: { id: rest.requestId },
					include: { association: true }
				});
				if (!request || request.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}
				if (!request.committeeId) {
					throw ApiException.badRequest('Request is not assigned to a committee');
				}

				if (!reviewableStatuses.includes(request.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Request is not in a reviewable state');
				}

				await ensureCommitteeMember(request.committeeId, context.user!.id);

				if (request.status === 'SUBMITTED') {
					await prisma.aRCRequest.update({ where: { id: request.id }, data: { status: 'UNDER_REVIEW' } });
				}

				const existing = await prisma.aRCReview.findFirst({
					where: { requestId: rest.requestId, reviewerId: context.user!.id }
				});
				if (existing) return existing;

				const created = await prisma.aRCReview.create({
					data: {
						requestId: rest.requestId,
						reviewerId: context.user!.id,
						action: rest.action as ARCReviewAction,
						notes: rest.notes,
						conditions: rest.conditions,
						expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : undefined
					}
				});

				return created;
			});

			return successResponse(
				{ review: { id: review.id, requestId: review.requestId, action: review.action } },
				context
			);
		}),

	// Final decision with quorum/threshold validation
	recordDecision: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					action: arcReviewActionEnum,
					notes: z.string().max(5000).optional(),
					conditions: z.string().max(5000).optional(),
					expiresAt: z.string().datetime().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ request: z.object({ id: z.string(), status: z.string() }) }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				const request = await prisma.aRCRequest.findFirst({
					where: { id: rest.requestId },
					include: { association: true }
				});
				if (!request || request.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Request already has a final decision');
				}

				const actionToStatus: Record<ARCReviewAction, ARCRequestStatus> = {
					APPROVE: 'APPROVED',
					DENY: 'DENIED',
					REQUEST_CHANGES: 'CHANGES_REQUESTED',
					TABLE: 'TABLED'
				};

				const status = actionToStatus[rest.action as ARCReviewAction];
				const decisionDate = new Date();

				if (request.committeeId) {
					const committee = await ensureCommitteeBelongs(request.committeeId, request.associationId);
					const activeMembers = await prisma.aRCCommitteeMember.count({
						where: { committeeId: committee.id, leftAt: null }
					});
					const { total, approvals } = await getReviewStats(request.id);

					if (committee.quorum && total < committee.quorum) {
						throw ApiException.badRequest('Quorum not met for committee decision');
					}

					if (rest.action === 'APPROVE' && committee.approvalThreshold !== null) {
						const threshold = Number(committee.approvalThreshold);
						const approvalPct = activeMembers > 0 ? (approvals / activeMembers) * 100 : 0;
						if (approvalPct < threshold) {
							throw ApiException.badRequest('Approval threshold not met');
						}
					}
				}

				const res = await prisma.$transaction(async (tx) => {
					await tx.aRCReview.create({
						data: {
							requestId: rest.requestId,
							reviewerId: context.user!.id,
							action: rest.action as ARCReviewAction,
							notes: rest.notes,
							conditions: rest.conditions,
							expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : undefined
						}
					});

					const updated = await tx.aRCRequest.update({
						where: { id: rest.requestId },
						data: { status, reviewedAt: decisionDate, decisionDate, conditions: rest.conditions, expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : request.expiresAt }
					});

					return updated;
				});

				return res;
			});

			return successResponse({ request: { id: result.id, status: result.status } }, context);
		})
};
