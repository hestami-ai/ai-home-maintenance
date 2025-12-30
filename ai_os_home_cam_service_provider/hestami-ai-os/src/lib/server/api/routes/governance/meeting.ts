import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startGovernanceWorkflow } from '../../../workflows/governanceWorkflow.js';
import type {
	MeetingType,
	MeetingStatus,
	MeetingAttendanceStatus,
	VoteMethod,
	VoteChoice
} from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('MeetingRoute');

const meetingTypeEnum = z.enum(['BOARD', 'ANNUAL', 'SPECIAL']);
const meetingStatusEnum = z.enum(['SCHEDULED', 'IN_SESSION', 'ADJOURNED', 'MINUTES_DRAFT', 'MINUTES_APPROVED', 'ARCHIVED', 'CANCELLED']);
const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'EXCUSED']);
const voteMethodEnum = z.enum(['IN_PERSON', 'PROXY', 'ELECTRONIC']);
const voteChoiceEnum = z.enum(['YES', 'NO', 'ABSTAIN']);

const getAssociationOrThrow = async (associationId: string, organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const ensureBoardBelongs = async (boardId: string | null | undefined, associationId: string, errors: any) => {
	if (!boardId) return;
	const board = await prisma.board.findFirst({ where: { id: boardId, associationId } });
	if (!board) throw errors.NOT_FOUND({ message: 'Board' });
};

const ensurePartyBelongs = async (partyId: string, organizationId: string, errors: any) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw errors.NOT_FOUND({ message: 'Party' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), associationId: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'governance_meeting', input.associationId);
			const { idempotencyKey, ...rest } = input;

			await getAssociationOrThrow(rest.associationId, context.organization.id, errors);
			await ensureBoardBelongs(rest.boardId, rest.associationId, errors);

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_MEETING',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						boardId: rest.boardId,
						title: rest.title,
						meetingType: rest.type,
						scheduledAt: rest.scheduledFor,
						location: rest.location,
						description: rest.description
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create meeting' });
			}

			const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{ meeting: { id: meeting.id, associationId: rest.associationId, status: meeting.status } },
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), type: z.string(), title: z.string(), status: z.string(), scheduledFor: z.coerce.date(), description: z.string().nullable() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
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
				throw errors.NOT_FOUND({ message: 'Meeting' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meetings: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), status: z.string(), scheduledFor: z.coerce.date() })), pagination: PaginationOutputSchema }),
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ agendaItem: z.object({ id: z.string(), meetingId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const meeting = await prisma.meeting.findFirst({
				where: { id: rest.meetingId },
				include: { association: true }
			});
			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'ADD_AGENDA_ITEM',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						meetingId: rest.meetingId,
						title: rest.title,
						description: rest.description,
						duration: rest.order
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add agenda item' });
			}

			const agendaItem = await prisma.meetingAgendaItem.findUniqueOrThrow({ where: { id: result.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ minutes: z.object({ id: z.string(), meetingId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const meeting = await prisma.meeting.findFirst({
				where: { id: rest.meetingId },
				include: { association: true }
			});
			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			// Check if minutes already exist
			const existing = await prisma.meetingMinutes.findFirst({ where: { meetingId: rest.meetingId } });
			if (existing) {
				return successResponse({ minutes: { id: existing.id, meetingId: existing.meetingId } }, context);
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'ADD_MEETING_MINUTES',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						meetingId: rest.meetingId,
						content: rest.content
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to record minutes' });
			}

			const minutes = await prisma.meetingMinutes.findUniqueOrThrow({ where: { id: result.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ attendance: z.object({ id: z.string(), meetingId: z.string(), partyId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const meeting = await prisma.meeting.findFirst({
				where: { id: rest.meetingId },
				include: { association: true }
			});
			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}
			await ensurePartyBelongs(rest.partyId, meeting.association.organizationId, errors);
			if (rest.proxyForPartyId) {
				await ensurePartyBelongs(rest.proxyForPartyId, meeting.association.organizationId, errors);
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'RECORD_ATTENDANCE',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						meetingId: rest.meetingId,
						partyId: rest.partyId,
						status: rest.status
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to record attendance' });
			}

			const attendance = await prisma.meetingAttendance.findUniqueOrThrow({ where: { id: result.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, ...rest } = input;

			const meeting = await prisma.meeting.findFirst({
				where: { id: rest.meetingId },
				include: { association: true }
			});
			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}
			if (rest.agendaItemId) {
				const agendaItem = await prisma.meetingAgendaItem.findFirst({
					where: { id: rest.agendaItemId, meetingId: rest.meetingId }
				});
				if (!agendaItem) throw errors.NOT_FOUND({ message: 'Agenda item' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_VOTE',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						meetingId: rest.meetingId,
						agendaItemId: rest.agendaItemId,
						question: rest.question,
						method: rest.method,
						quorumRequired: rest.quorumRequired
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to open vote' });
			}

			const vote = await prisma.vote.findUniqueOrThrow({ where: { id: result.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('vote', 'governance_vote', input.voteId);
			const { idempotencyKey, ...rest } = input;

			const vote = await prisma.vote.findFirst({
				where: { id: rest.voteId },
				include: { meeting: { include: { association: true } } }
			});
			if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Vote' });
			}
			if (vote.closedAt) {
				throw errors.BAD_REQUEST({ message: 'Vote is closed' });
			}

			await ensurePartyBelongs(rest.voterPartyId, vote.meeting.association.organizationId, errors);

			// Enforce vote immutability - once cast, cannot be changed
			const existing = await prisma.voteBallot.findFirst({
				where: { voteId: rest.voteId, voterPartyId: rest.voterPartyId }
			});
			if (existing) {
				throw errors.BAD_REQUEST({ message: 'Ballot already cast and cannot be changed' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CAST_BALLOT',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						voteId: rest.voteId,
						voterPartyId: rest.voterPartyId,
						choice: rest.choice
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cast ballot' });
			}

			const ballot = await prisma.voteBallot.findUniqueOrThrow({ where: { id: result.entityId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					eligibleVoters: z.array(
						z.object({
							partyId: z.string(),
							name: z.string().nullable(),
							hasVoted: z.boolean(),
							attendanceStatus: z.string()
						})
					),
					totalEligible: z.number(),
					totalVoted: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
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
				throw errors.NOT_FOUND({ message: 'Vote' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_vote', input.voteId);

			const vote = await prisma.vote.findFirst({
				where: { id: input.voteId },
				include: { meeting: { include: { association: true } } }
			});
			if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Vote' });
			}

			const results = await getVoteResults(input.voteId);
			if (!results) throw errors.NOT_FOUND({ message: 'Vote' });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_vote', input.voteId);
			const { idempotencyKey, voteId } = input;

			const vote = await prisma.vote.findFirst({
				where: { id: voteId },
				include: { meeting: { include: { association: true } } }
			});
			if (!vote || vote.meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Vote' });
			}
			if (vote.closedAt) {
				const results = await getVoteResults(vote.id);
				return successResponse(
					{
						vote: {
							id: vote.id,
							closedAt: vote.closedAt.toISOString(),
							results: results!
						}
					},
					context
				);
			}

			const results = await getVoteResults(vote.id);
			if (!results) throw errors.NOT_FOUND({ message: 'Vote' });
			if (results.quorumRequired !== null && !results.quorumMet) {
				throw errors.BAD_REQUEST({ message: 'Quorum not met' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startGovernanceWorkflow(
				{
					action: 'CLOSE_VOTE',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: voteId,
					data: {}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to close vote' });
			}

			const updatedVote = await prisma.vote.findUniqueOrThrow({ where: { id: voteId } });

			return successResponse(
				{
					vote: {
						id: updatedVote.id,
						closedAt: updatedVote.closedAt!.toISOString(),
						results: results!
					}
				},
				context
			);
		}),

	// Phase 11: Meeting State Transition Endpoints

	startSession: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('start_session', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const meeting = await prisma.meeting.findFirst({
				where: { id: meetingId },
				include: {
					association: true,
					agendaItems: true,
					attendance: { where: { status: { not: 'ABSENT' } } }
				}
			});

			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			if (meeting.status !== 'SCHEDULED') {
				throw errors.BAD_REQUEST({ message: `Cannot start session from status ${meeting.status}` });
			}

			if (meeting.agendaItems.length === 0) {
				throw errors.BAD_REQUEST({ message: 'Meeting must have at least one agenda item before starting session' });
			}

			const presentCount = meeting.attendance.length;
			const quorumRequired = meeting.quorumRequired;
			const quorumMet = quorumRequired === null || presentCount >= quorumRequired;

			if (!quorumMet) {
				throw errors.BAD_REQUEST({ message: `Quorum not met: ${presentCount} present, ${quorumRequired} required` });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'START_MEETING',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: meetingId,
					data: {}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to start meeting session' });
			}

			const updated = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

			return successResponse(
				{
					meeting: { id: updated.id, status: updated.status },
					quorumStatus: { required: quorumRequired, present: presentCount, met: quorumMet }
				},
				context
			);
		}),

	adjourn: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string(), notes: z.string().optional() })))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('adjourn', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const existing = await prisma.meeting.findFirst({
				where: { id: meetingId },
				include: { association: true }
			});

			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			if (existing.status !== 'IN_SESSION') {
				throw errors.BAD_REQUEST({ message: `Cannot adjourn from status ${existing.status}` });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'ADJOURN_MEETING',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: meetingId,
					data: {}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to adjourn meeting' });
			}

			// Create minutes placeholder if not exists
			const existingMinutes = await prisma.meetingMinutes.findUnique({ where: { meetingId } });
			if (!existingMinutes) {
				await prisma.meetingMinutes.create({
					data: { meetingId, recordedBy: context.user!.id, content: '' }
				});
			}

			const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId, content } = input;

			const existing = await prisma.meeting.findFirst({
				where: { id: meetingId },
				include: { association: true, minutes: true }
			});

			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			if (existing.status !== 'ADJOURNED') {
				throw errors.BAD_REQUEST({ message: `Cannot submit minutes draft from status ${existing.status}` });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'UPDATE_MINUTES',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: meetingId,
					data: { content }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to submit minutes draft' });
			}

			const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	approveMinutes: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('approve_minutes', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const existing = await prisma.meeting.findFirst({
				where: { id: meetingId },
				include: { association: true, minutes: true }
			});

			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			if (existing.status !== 'MINUTES_DRAFT') {
				throw errors.BAD_REQUEST({ message: `Cannot approve minutes from status ${existing.status}` });
			}

			if (!existing.minutes || !existing.minutes.content) {
				throw errors.BAD_REQUEST({ message: 'Minutes content is required before approval' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'APPROVE_MINUTES',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: meetingId,
					data: {}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to approve minutes' });
			}

			const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	archive: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ meetingId: z.string() })))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ meeting: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('archive', 'governance_meeting', input.meetingId);
			const { idempotencyKey, meetingId } = input;

			const existing = await prisma.meeting.findFirst({
				where: { id: meetingId },
				include: { association: true }
			});

			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
			}

			if (existing.status !== 'MINUTES_APPROVED') {
				throw errors.BAD_REQUEST({ message: `Cannot archive from status ${existing.status}` });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'ARCHIVE_MEETING',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: meetingId,
					data: {}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to archive meeting' });
			}

			const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

			return successResponse({ meeting: { id: meeting.id, status: meeting.status } }, context);
		}),

	getQuorumStatus: orgProcedure
		.input(z.object({ meetingId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_meeting', input.meetingId);

			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId },
				include: {
					association: true,
					attendance: { select: { partyId: true, status: true } }
				}
			});

			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_meeting', input.meetingId);

			const meeting = await prisma.meeting.findFirst({
				where: { id: input.meetingId },
				include: { association: true }
			});

			if (!meeting || meeting.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Meeting' });
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
