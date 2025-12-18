import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type {
	MeetingType,
	MeetingStatus,
	MeetingAttendanceStatus,
	VoteMethod,
	VoteChoice
} from '../../../../../../generated/prisma/client.js';
import type { RequestContext } from '../../context.js';

const meetingTypeEnum = z.enum(['BOARD', 'ANNUAL', 'SPECIAL']);
const meetingStatusEnum = z.enum(['SCHEDULED', 'IN_SESSION', 'ADJOURNED', 'MINUTES_DRAFT', 'MINUTES_APPROVED', 'ARCHIVED', 'CANCELLED']);
const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'EXCUSED']);
const voteMethodEnum = z.enum(['IN_PERSON', 'PROXY', 'ELECTRONIC']);
const voteChoiceEnum = z.enum(['YES', 'NO', 'ABSTAIN']);

const requireIdempotency = async <T>(key: string | undefined, ctx: RequestContext, fn: () => Promise<T>) => {
	if (!key) throw ApiException.badRequest('Idempotency key is required');
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

const getAssociationOrThrow = async (associationId: string, organizationId: string) => {
	const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
	if (!association) throw ApiException.notFound('Association');
	return association;
};

const ensureBoardBelongs = async (boardId: string | null | undefined, associationId: string) => {
	if (!boardId) return;
	const board = await prisma.board.findFirst({ where: { id: boardId, associationId } });
	if (!board) throw ApiException.notFound('Board');
};

const ensurePartyBelongs = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw ApiException.notFound('Party');
};

const getVoteResults = async (voteId: string) => {
	const vote = await prisma.vote.findFirst({
		where: { id: voteId },
		include: {
			ballots: {
				select: { choice: true }
			},
			meeting: {
				select: {
					attendance: { select: { status: true } }
				}
			}
		}
	});
	if (!vote) return null;

	const attendance = vote.meeting.attendance as { status: MeetingAttendanceStatus }[];
	const presentCount = attendance.filter((a) => a.status !== 'ABSENT').length;
	const quorumRequired = vote.quorumRequired ?? null;
	const counts = vote.ballots.reduce<{ yes: number; no: number; abstain: number }>(
		(acc, b) => {
			if (b.choice === 'YES') acc.yes += 1;
			if (b.choice === 'NO') acc.no += 1;
			if (b.choice === 'ABSTAIN') acc.abstain += 1;
			return acc;
		},
		{ yes: 0, no: 0, abstain: 0 }
	);
	const totalBallots = vote.ballots.length;
	const turnoutPct = presentCount > 0 ? (totalBallots / presentCount) * 100 : 0;
	const quorumMet = quorumRequired !== null ? presentCount >= quorumRequired : true;

	return {
		yes: counts.yes,
		no: counts.no,
		abstain: counts.abstain,
		totalBallots,
		attendanceCount: presentCount,
		turnoutPct,
		quorumRequired,
		quorumMet
	};
};

export const governanceMeetingRouter = {
	create: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					boardId: z.string().optional(),
					type: meetingTypeEnum,
					title: z.string().min(1).max(255),
					description: z.string().max(5000).optional(),
					scheduledFor: z.string().datetime(),
					location: z.string().max(500).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), associationId: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'governance_meeting', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const meeting = await requireIdempotency(idempotencyKey, context, async () => {
				await getAssociationOrThrow(rest.associationId, context.organization.id);
				await ensureBoardBelongs(rest.boardId, rest.associationId);

				return prisma.meeting.create({
					data: {
						associationId: rest.associationId,
						boardId: rest.boardId,
						type: rest.type as MeetingType,
						status: 'SCHEDULED',
						title: rest.title,
						description: rest.description,
						scheduledFor: new Date(rest.scheduledFor),
						location: rest.location,
						createdBy: context.user!.id
					}
				});
			});

			return successResponse(
				{ meeting: { id: meeting.id, associationId: meeting.associationId, status: meeting.status } },
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.any() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const meeting = await prisma.meeting.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					board: true,
					agendaItems: true,
					minutes: true,
					attendance: true,
					votes: { include: { ballots: true } }
				}
			});
			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Meeting');
			}
			await context.cerbos.authorize('view', 'governance_meeting', meeting.id);
			return successResponse({ meeting }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: meetingStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meetings: z.array(z.any()), pagination: PaginationOutputSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				status: input.status as MeetingStatus | undefined
			};
			const items = await prisma.meeting.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { scheduledFor: 'desc' },
				include: {
					votes: {
						select: {
							id: true,
							question: true,
							quorumRequired: true,
							closedAt: true
						}
					}
				}
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					meetings: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	addAgendaItem: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					meetingId: z.string(),
					title: z.string().min(1).max(255),
					description: z.string().max(3000).optional(),
					order: z.number().int().nonnegative().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ agendaItem: z.object({ id: z.string(), meetingId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const agendaItem = await requireIdempotency(idempotencyKey, context, async () => {
				const meeting = await prisma.meeting.findFirst({
					where: { id: rest.meetingId },
					include: { association: true }
				});
				if (!meeting || meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				return prisma.meetingAgendaItem.create({
					data: {
						meetingId: rest.meetingId,
						title: rest.title,
						description: rest.description,
						order: rest.order ?? 0
					}
				});
			});

			return successResponse({ agendaItem: { id: agendaItem.id, meetingId: agendaItem.meetingId } }, context);
		}),

	recordMinutes: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					meetingId: z.string(),
					content: z.string().min(1)
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ minutes: z.object({ id: z.string(), meetingId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const minutes = await requireIdempotency(idempotencyKey, context, async () => {
				const meeting = await prisma.meeting.findFirst({
					where: { id: rest.meetingId },
					include: { association: true }
				});
				if (!meeting || meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				const existing = await prisma.meetingMinutes.findFirst({ where: { meetingId: rest.meetingId } });
				if (existing) return existing;

				return prisma.meetingMinutes.create({
					data: {
						meetingId: rest.meetingId,
						recordedBy: context.user!.id,
						content: rest.content
					}
				});
			});

			return successResponse({ minutes: { id: minutes.id, meetingId: minutes.meetingId } }, context);
		}),

	recordAttendance: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					meetingId: z.string(),
					partyId: z.string(),
					status: attendanceStatusEnum.default('PRESENT'),
					proxyForPartyId: z.string().optional(),
					checkedInAt: z.string().datetime().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ attendance: z.object({ id: z.string(), meetingId: z.string(), partyId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const attendance = await requireIdempotency(idempotencyKey, context, async () => {
				const meeting = await prisma.meeting.findFirst({
					where: { id: rest.meetingId },
					include: { association: true }
				});
				if (!meeting || meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}
				await ensurePartyBelongs(rest.partyId, meeting.association.organizationId);
				if (rest.proxyForPartyId) {
					await ensurePartyBelongs(rest.proxyForPartyId, meeting.association.organizationId);
				}

				const existing = await prisma.meetingAttendance.findFirst({
					where: { meetingId: rest.meetingId, partyId: rest.partyId }
				});
				if (existing) {
					return prisma.meetingAttendance.update({
						where: { id: existing.id },
						data: {
							status: rest.status as MeetingAttendanceStatus,
							proxyForPartyId: rest.proxyForPartyId,
							checkedInAt: rest.checkedInAt ? new Date(rest.checkedInAt) : existing.checkedInAt
						}
					});
				}

				return prisma.meetingAttendance.create({
					data: {
						meetingId: rest.meetingId,
						partyId: rest.partyId,
						status: rest.status as MeetingAttendanceStatus,
						proxyForPartyId: rest.proxyForPartyId,
						checkedInAt: rest.checkedInAt ? new Date(rest.checkedInAt) : null
					}
				});
			});

			return successResponse(
				{ attendance: { id: attendance.id, meetingId: attendance.meetingId, partyId: attendance.partyId } },
				context
			);
		}),

	openVote: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					meetingId: z.string(),
					agendaItemId: z.string().optional(),
					question: z.string().min(1).max(2000),
					method: voteMethodEnum.default('IN_PERSON'),
					quorumRequired: z.number().int().nonnegative().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vote: z.object({
						id: z.string(),
						meetingId: z.string(),
						question: z.string(),
						quorumRequired: z.number().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const vote = await requireIdempotency(idempotencyKey, context, async () => {
				const meeting = await prisma.meeting.findFirst({
					where: { id: rest.meetingId },
					include: { association: true }
				});
				if (!meeting || meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}
				if (rest.agendaItemId) {
					const agendaItem = await prisma.meetingAgendaItem.findFirst({
						where: { id: rest.agendaItemId, meetingId: rest.meetingId }
					});
					if (!agendaItem) throw ApiException.notFound('Agenda item');
				}

				return prisma.vote.create({
					data: {
						meetingId: rest.meetingId,
						agendaItemId: rest.agendaItemId,
						question: rest.question,
						method: rest.method as VoteMethod,
						quorumRequired: rest.quorumRequired,
						createdBy: context.user!.id
					}
				});
			});

			return successResponse(
				{
					vote: {
						id: vote.id,
						meetingId: vote.meetingId,
						question: vote.question,
						quorumRequired: vote.quorumRequired ?? null
					}
				},
				context
			);
		}),

	castBallot: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					voteId: z.string(),
					voterPartyId: z.string(),
					choice: voteChoiceEnum,
					hasConflictOfInterest: z.boolean().optional(),
					conflictNotes: z.string().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					ballot: z.object({
						id: z.string(),
						voteId: z.string(),
						voterPartyId: z.string(),
						choice: z.string(),
						hasConflictOfInterest: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('vote', 'governance_vote', input.voteId);
			const { idempotencyKey, ...rest } = input;

			const ballot = await requireIdempotency(idempotencyKey, context, async () => {
				const vote = await prisma.vote.findFirst({
					where: { id: rest.voteId },
					include: { meeting: { include: { association: true } } }
				});
				if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Vote');
				}
				if (vote.closedAt) {
					throw ApiException.badRequest('Vote is closed');
				}

				await ensurePartyBelongs(rest.voterPartyId, vote.meeting.association.organizationId);

				// Enforce vote immutability - once cast, cannot be changed
				const existing = await prisma.voteBallot.findFirst({
					where: { voteId: rest.voteId, voterPartyId: rest.voterPartyId }
				});
				if (existing) {
					throw ApiException.badRequest('Ballot already cast and cannot be changed');
				}

				return prisma.voteBallot.create({
					data: {
						voteId: rest.voteId,
						voterPartyId: rest.voterPartyId,
						choice: rest.choice as VoteChoice,
						hasConflictOfInterest: rest.hasConflictOfInterest ?? false,
						conflictNotes: rest.conflictNotes
					}
				});
			});

			return successResponse(
				{
					ballot: {
						id: ballot.id,
						voteId: ballot.voteId,
						voterPartyId: ballot.voterPartyId,
						choice: ballot.choice,
						hasConflictOfInterest: ballot.hasConflictOfInterest
					}
				},
				context
			);
		}),

	getEligibleVoters: orgProcedure
		.input(z.object({ voteId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					eligibleVoters: z.array(z.object({
						partyId: z.string(),
						name: z.string().nullable(),
						hasVoted: z.boolean(),
						attendanceStatus: z.string()
					})),
					totalEligible: z.number(),
					totalVoted: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'governance_vote', input.voteId);

			const vote = await prisma.vote.findFirst({
				where: { id: input.voteId },
				include: {
					meeting: {
						include: {
							association: true,
							attendance: {
								where: { status: { not: 'ABSENT' } },
								include: { party: { select: { id: true, firstName: true, lastName: true, entityName: true } } }
							}
						}
					},
					ballots: { select: { voterPartyId: true } }
				}
			});

			if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Vote');
			}

			const votedPartyIds = new Set(vote.ballots.map((b: { voterPartyId: string }) => b.voterPartyId));
			const eligibleVoters = vote.meeting.attendance.map((a: { party: { id: string; firstName: string | null; lastName: string | null; entityName: string | null }; status: string }) => ({
				partyId: a.party.id,
				name: a.party.entityName || [a.party.firstName, a.party.lastName].filter(Boolean).join(' ') || null,
				hasVoted: votedPartyIds.has(a.party.id),
				attendanceStatus: a.status
			}));

			return successResponse(
				{
					eligibleVoters,
					totalEligible: eligibleVoters.length,
					totalVoted: votedPartyIds.size
				},
				context
			);
		}),

	tallyVote: orgProcedure
		.input(z.object({ voteId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					results: z.object({
						yes: z.number(),
						no: z.number(),
						abstain: z.number(),
						totalBallots: z.number(),
						attendanceCount: z.number(),
						turnoutPct: z.number(),
						quorumRequired: z.number().nullable(),
						quorumMet: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'governance_vote', input.voteId);

			const vote = await prisma.vote.findFirst({
				where: { id: input.voteId },
				include: { meeting: { include: { association: true } } }
			});
			if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Vote');
			}

			const results = await getVoteResults(input.voteId);
			if (!results) throw ApiException.notFound('Vote');

			return successResponse({ results }, context);
		}),

	closeVote: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					voteId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vote: z.object({
						id: z.string(),
						closedAt: z.string(),
						results: z.object({
							yes: z.number(),
							no: z.number(),
							abstain: z.number(),
							totalBallots: z.number(),
							attendanceCount: z.number(),
							turnoutPct: z.number(),
							quorumRequired: z.number().nullable(),
							quorumMet: z.boolean()
						})
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_vote', input.voteId);
			const { idempotencyKey, voteId } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				const vote = await prisma.vote.findFirst({
					where: { id: voteId },
					include: { meeting: { include: { association: true } } }
				});
				if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Vote');
				}
				if (vote.closedAt) {
					const results = await getVoteResults(vote.id);
					return { vote, results };
				}

				const results = await getVoteResults(vote.id);
				if (!results) throw ApiException.notFound('Vote');
				if (results.quorumRequired !== null && !results.quorumMet) {
					throw ApiException.badRequest('Quorum not met');
				}

				const closedAt = new Date();
				const updated = await prisma.vote.update({
					where: { id: voteId },
					data: { closedAt }
				});

				return { vote: updated, results };
			});

			return successResponse(
				{
					vote: {
						id: result.vote.id,
						closedAt: result.vote.closedAt!.toISOString(),
						results: result.results!
					}
				},
				context
			);
		}),

	// Phase 11: Meeting State Transition Endpoints

	startSession: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					meeting: z.object({ id: z.string(), status: z.string() }),
					quorumStatus: z.object({ required: z.number().nullable(), present: z.number(), met: z.boolean() })
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('start_session', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				const meeting = await prisma.meeting.findFirst({
					where: { id: meetingId },
					include: {
						association: true,
						agendaItems: true,
						attendance: { where: { status: { not: 'ABSENT' } } }
					}
				});

				if (!meeting || meeting.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				if (meeting.status !== 'SCHEDULED') {
					throw ApiException.badRequest(`Cannot start session from status ${meeting.status}`);
				}

				if (meeting.agendaItems.length === 0) {
					throw ApiException.badRequest('Meeting must have at least one agenda item before starting session');
				}

				const presentCount = meeting.attendance.length;
				const quorumRequired = meeting.quorumRequired;
				const quorumMet = quorumRequired === null || presentCount >= quorumRequired;

				if (!quorumMet) {
					throw ApiException.badRequest(`Quorum not met: ${presentCount} present, ${quorumRequired} required`);
				}

				const updated = await prisma.meeting.update({
					where: { id: meetingId },
					data: { status: 'IN_SESSION' }
				});

				return {
					meeting: updated,
					quorumStatus: { required: quorumRequired, present: presentCount, met: quorumMet }
				};
			});

			return successResponse(
				{
					meeting: { id: result.meeting.id, status: result.meeting.status },
					quorumStatus: result.quorumStatus
				},
				context
			);
		}),

	adjourn: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string(), notes: z.string().optional() })))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('adjourn', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const meeting = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.meeting.findFirst({
					where: { id: meetingId },
					include: { association: true }
				});

				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				if (existing.status !== 'IN_SESSION') {
					throw ApiException.badRequest(`Cannot adjourn from status ${existing.status}`);
				}

				const updated = await prisma.meeting.update({
					where: { id: meetingId },
					data: { status: 'ADJOURNED' }
				});

				// Create minutes placeholder if not exists
				const existingMinutes = await prisma.meetingMinutes.findUnique({ where: { meetingId } });
				if (!existingMinutes) {
					await prisma.meetingMinutes.create({
						data: { meetingId, recordedBy: context.user!.id, content: '' }
					});
				}

				return updated;
			});

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	submitMinutesDraft: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					meetingId: z.string(),
					content: z.string().min(1)
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId, content } = input;

			const meeting = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.meeting.findFirst({
					where: { id: meetingId },
					include: { association: true, minutes: true }
				});

				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				if (existing.status !== 'ADJOURNED') {
					throw ApiException.badRequest(`Cannot submit minutes draft from status ${existing.status}`);
				}

				// Update or create minutes
				if (existing.minutes) {
					await prisma.meetingMinutes.update({
						where: { meetingId },
						data: { content, recordedBy: context.user!.id }
					});
				} else {
					await prisma.meetingMinutes.create({
						data: { meetingId, recordedBy: context.user!.id, content }
					});
				}

				return prisma.meeting.update({
					where: { id: meetingId },
					data: { status: 'MINUTES_DRAFT' }
				});
			});

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	approveMinutes: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('approve_minutes', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const meeting = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.meeting.findFirst({
					where: { id: meetingId },
					include: { association: true, minutes: true }
				});

				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				if (existing.status !== 'MINUTES_DRAFT') {
					throw ApiException.badRequest(`Cannot approve minutes from status ${existing.status}`);
				}

				if (!existing.minutes || !existing.minutes.content) {
					throw ApiException.badRequest('Minutes content is required before approval');
				}

				return prisma.meeting.update({
					where: { id: meetingId },
					data: { status: 'MINUTES_APPROVED' }
				});
			});

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	archive: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('archive', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const meeting = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.meeting.findFirst({
					where: { id: meetingId },
					include: { association: true }
				});

				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Meeting');
				}

				if (existing.status !== 'MINUTES_APPROVED') {
					throw ApiException.badRequest(`Cannot archive from status ${existing.status}`);
				}

				return prisma.meeting.update({
					where: { id: meetingId },
					data: { status: 'ARCHIVED' }
				});
			});

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	getQuorumStatus: orgProcedure
		.input(z.object({ meetingId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					quorumRequired: z.number().nullable(),
					presentCount: z.number(),
					quorumMet: z.boolean(),
					attendees: z.array(z.object({ partyId: z.string(), status: z.string() }))
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'governance_meeting', input.meetingId);

			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId },
				include: {
					association: true,
					attendance: { select: { partyId: true, status: true } }
				}
			});

			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Meeting');
			}

			const presentCount = meeting.attendance.filter(a => a.status !== 'ABSENT').length;
			const quorumRequired = meeting.quorumRequired;
			const quorumMet = quorumRequired === null || presentCount >= quorumRequired;

			return successResponse(
				{
					quorumRequired,
					presentCount,
					quorumMet,
					attendees: meeting.attendance
				},
				context
			);
		}),

	// Phase 11.9: Generate minutes draft from meeting data
	generateMinutesDraft: orgProcedure
		.input(
			z.object({
				meetingId: z.string(),
				includeAttendance: z.boolean().optional().default(true),
				includeMotions: z.boolean().optional().default(true),
				includeVotes: z.boolean().optional().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					meetingId: z.string(),
					fullText: z.string(),
					sections: z.array(z.object({
						title: z.string(),
						content: z.string(),
						order: z.number()
					})),
					generatedAt: z.string(),
					method: z.enum(['template', 'ai'])
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);

			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId },
				include: { association: true }
			});

			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Meeting');
			}

			// Import and use the minutes generation service
			const { generateMinutesDraft } = await import('../../../services/minutesGenerationService.js');
			
			const result = await generateMinutesDraft({
				meetingId: input.meetingId,
				includeAttendance: input.includeAttendance,
				includeMotions: input.includeMotions,
				includeVotes: input.includeVotes
			});

			return successResponse(result, context);
		})
};
