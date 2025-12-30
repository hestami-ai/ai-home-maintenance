import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, IdempotencyKeySchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startARCReviewWorkflow } from '../../../workflows/arcReviewWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ARCReviewRoute');

const arcReviewActionEnum = z.enum(['APPROVE', 'DENY', 'REQUEST_CHANGES', 'TABLE']);

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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.committeeId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCReviewWorkflow(
				{
					action: 'ADD_MEMBER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					committeeId: rest.committeeId,
					data: { partyId: rest.partyId, role: rest.role, isChair: rest.isChair }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add member' });
			}

			const member = await prisma.aRCCommitteeMember.findUniqueOrThrow({ where: { id: result.entityId } });

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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.committeeId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCReviewWorkflow(
				{
					action: 'REMOVE_MEMBER',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					committeeId: rest.committeeId,
					data: { partyId: rest.partyId }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to remove member' });
			}

			return successResponse(
				{ member: { committeeId: input.committeeId, partyId: input.partyId, leftAt: result.leftAt! } },
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ARC Committee not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const committee = await prisma.aRCCommittee.findFirst({
				where: { id: input.committeeId },
				include: { association: true }
			});
			if (!committee || committee.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Committee' });
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCReviewWorkflow(
				{
					action: 'ASSIGN_COMMITTEE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					requestId: rest.requestId,
					data: { committeeId: rest.committeeId }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to assign committee' });
			}

			return successResponse(
				{ request: { id: result.entityId!, status: result.status!, committeeId: rest.committeeId } },
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCReviewWorkflow(
				{
					action: 'SUBMIT_REVIEW',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					requestId: rest.requestId,
					data: {
						action: rest.action,
						notes: rest.notes,
						conditions: rest.conditions,
						expiresAt: rest.expiresAt
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to submit review' });
			}

			const review = await prisma.aRCReview.findUniqueOrThrow({ where: { id: result.entityId } });

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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCReviewWorkflow(
				{
					action: 'RECORD_DECISION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					requestId: rest.requestId,
					data: {
						action: rest.action,
						notes: rest.notes,
						conditions: rest.conditions,
						expiresAt: rest.expiresAt
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to record decision' });
			}

			return successResponse({ request: { id: result.entityId!, status: result.status! } }, context);
		}),

	/**
	 * Get all votes/reviews for a request
	 */
	getVotes: orgProcedure
		.input(z.object({ requestId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					votes: z.array(
						z.object({
							id: z.string(),
							reviewerId: z.string(),
							reviewerName: z.string().nullable(),
							action: z.string(),
							notes: z.string().nullable(),
							conditions: z.string().nullable(),
							createdAt: z.string()
						})
					),
					summary: z.object({
						total: z.number(),
						approve: z.number(),
						deny: z.number(),
						requestChanges: z.number(),
						table: z.number()
					}),
					quorum: z.object({
						required: z.number().nullable(),
						met: z.boolean(),
						activeMembers: z.number()
					}),
					threshold: z.object({
						required: z.number().nullable(),
						current: z.number(),
						met: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.aRCRequest.findFirst({
				where: { id: input.requestId },
				include: { association: true, committee: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			await context.cerbos.authorize('view', 'arc_request', input.requestId);

			const reviews = await prisma.aRCReview.findMany({
				where: { requestId: input.requestId },
				orderBy: { createdAt: 'asc' }
			});

			// Calculate vote summary
			const summary = {
				total: reviews.length,
				approve: reviews.filter((r) => r.action === 'APPROVE').length,
				deny: reviews.filter((r) => r.action === 'DENY').length,
				requestChanges: reviews.filter((r) => r.action === 'REQUEST_CHANGES').length,
				table: reviews.filter((r) => r.action === 'TABLE').length
			};

			// Get committee info for quorum/threshold
			let activeMembers = 0;
			let quorumRequired: number | null = null;
			let thresholdRequired: number | null = null;

			if (request.committeeId && request.committee) {
				activeMembers = await prisma.aRCCommitteeMember.count({
					where: { committeeId: request.committeeId, leftAt: null }
				});
				quorumRequired = request.committee.quorum;
				thresholdRequired = request.committee.approvalThreshold ? Number(request.committee.approvalThreshold) : null;
			}

			const quorumMet = quorumRequired === null || summary.total >= quorumRequired;
			const currentApprovalPct = activeMembers > 0 ? (summary.approve / activeMembers) * 100 : 0;
			const thresholdMet = thresholdRequired === null || currentApprovalPct >= thresholdRequired;

			return successResponse(
				{
					votes: reviews.map((r) => ({
						id: r.id,
						reviewerId: r.reviewerId,
						reviewerName: null,
						action: r.action,
						notes: r.notes,
						conditions: r.conditions,
						createdAt: r.createdAt.toISOString()
					})),
					summary,
					quorum: {
						required: quorumRequired,
						met: quorumMet,
						activeMembers
					},
					threshold: {
						required: thresholdRequired,
						current: Math.round(currentApprovalPct),
						met: thresholdMet
					}
				},
				context
			);
		}),

	/**
	 * Get committee details with members for voting panel
	 */
	getCommitteeForRequest: orgProcedure
		.input(z.object({ requestId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					committee: z
						.object({
							id: z.string(),
							name: z.string(),
							quorum: z.number().nullable(),
							approvalThreshold: z.number().nullable(),
							members: z.array(
								z.object({
									id: z.string(),
									partyId: z.string(),
									name: z.string().nullable(),
									role: z.string().nullable(),
									isChair: z.boolean(),
									hasVoted: z.boolean(),
									vote: z.string().nullable()
								})
							)
						})
						.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.aRCRequest.findFirst({
				where: { id: input.requestId },
				include: { association: true, committee: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			await context.cerbos.authorize('view', 'arc_request', input.requestId);

			if (!request.committeeId || !request.committee) {
				return successResponse({ committee: null }, context);
			}

			const members = await prisma.aRCCommitteeMember.findMany({
				where: { committeeId: request.committeeId, leftAt: null }
			});

			// Get votes for this request
			const votes = await prisma.aRCReview.findMany({
				where: { requestId: input.requestId },
				select: { reviewerId: true, action: true }
			});

			const voteMap = new Map(votes.map((v) => [v.reviewerId, v.action]));

			return successResponse(
				{
					committee: {
						id: request.committee.id,
						name: request.committee.name,
						quorum: request.committee.quorum,
						approvalThreshold: request.committee.approvalThreshold ? Number(request.committee.approvalThreshold) : null,
						members: members.map((m) => ({
							id: m.id,
							partyId: m.partyId,
							name: null,
							role: m.role,
							isChair: m.isChair,
							hasVoted: voteMap.has(m.partyId),
							vote: voteMap.get(m.partyId) ?? null
						}))
					}
				},
				context
			);
		})
};
