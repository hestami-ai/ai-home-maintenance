import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { RequestContext } from '../../context.js';

const boardMotionCategoryEnum = z.enum([
	'POLICY',
	'BUDGET',
	'ASSESSMENT',
	'ENFORCEMENT',
	'CONTRACT',
	'CAPITAL_PROJECT',
	'RULE_CHANGE',
	'ELECTION',
	'OTHER'
]);

const boardMotionStatusEnum = z.enum([
	'PROPOSED',
	'SECONDED',
	'UNDER_DISCUSSION',
	'UNDER_VOTE',
	'TABLED',
	'APPROVED',
	'DENIED',
	'WITHDRAWN'
]);

const boardMotionOutcomeEnum = z.enum([
	'PASSED',
	'FAILED',
	'TABLED',
	'WITHDRAWN',
	'AMENDED'
]);

const requireIdempotency = async <T>(
	key: string | undefined,
	ctx: RequestContext,
	fn: () => Promise<T>
) => {
	if (!key) throw ApiException.badRequest('Idempotency key is required');
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

const getAssociationOrThrow = async (associationId: string, organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { id: associationId, organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

const generateMotionNumber = async (associationId: string): Promise<string> => {
	const year = new Date().getFullYear();
	const count = await prisma.boardMotion.count({
		where: {
			associationId,
			motionNumber: { startsWith: `MOT-${year}-` }
		}
	});
	return `MOT-${year}-${String(count + 1).padStart(4, '0')}`;
};

export const boardMotionRouter = {
	list: orgProcedure
		.input(
			z.object({
				associationId: z.string(),
				meetingId: z.string().optional(),
				status: boardMotionStatusEnum.optional(),
				category: boardMotionCategoryEnum.optional(),
				outcome: boardMotionOutcomeEnum.optional(),
				search: z.string().optional(),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(20)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motions: z.array(z.any()),
					pagination: z.object({
						page: z.number(),
						pageSize: z.number(),
						total: z.number(),
						totalPages: z.number()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { associationId, meetingId, status, category, outcome, search, page, pageSize } = input;

			await getAssociationOrThrow(associationId, context.organization.id);

			const where = {
				associationId,
				...(meetingId && { meetingId }),
				...(status && { status }),
				...(category && { category }),
				...(outcome && { outcome }),
				...(search && {
					OR: [
						{ title: { contains: search, mode: 'insensitive' as const } },
						{ motionNumber: { contains: search, mode: 'insensitive' as const } },
						{ description: { contains: search, mode: 'insensitive' as const } }
					]
				})
			};

			const [motions, total] = await Promise.all([
				prisma.boardMotion.findMany({
					where,
					include: {
						meeting: { select: { id: true, title: true, scheduledFor: true } }
					},
					orderBy: { createdAt: 'desc' },
					skip: (page - 1) * pageSize,
					take: pageSize
				}),
				prisma.boardMotion.count({ where })
			]);

			return successResponse({
				motions,
				pagination: {
					page,
					pageSize,
					total,
					totalPages: Math.ceil(total / pageSize)
				}
			}, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ motion: z.any() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const motion = await prisma.boardMotion.findFirst({
				where: { id: input.id },
				include: {
					association: { select: { id: true, name: true, organizationId: true } },
					meeting: { select: { id: true, title: true, scheduledFor: true, status: true } }
				}
			});

			if (!motion) throw ApiException.notFound('Board motion');
			if (motion.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			return successResponse({ motion }, context);
		}),

	create: orgProcedure
		.input(
			z.object({
				associationId: z.string(),
				meetingId: z.string().optional(),
				title: z.string().min(1).max(255),
				description: z.string().optional(),
				category: boardMotionCategoryEnum,
				movedById: z.string().optional(),
				secondedById: z.string().optional(),
				rationale: z.string().optional(),
				effectiveDate: z.string().datetime().optional(),
				expiresAt: z.string().datetime().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						title: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { associationId, idempotencyKey, ...data } = input;

			await getAssociationOrThrow(associationId, context.organization.id);

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				const motionNumber = await generateMotionNumber(associationId);

				return prisma.boardMotion.create({
					data: {
						associationId,
						motionNumber,
						title: data.title,
						description: data.description,
						category: data.category,
						status: data.secondedById ? 'SECONDED' : 'PROPOSED',
						meetingId: data.meetingId,
						movedById: data.movedById,
						secondedById: data.secondedById,
						rationale: data.rationale,
						effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
						expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
						createdBy: context.user.id
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					title: motion.title,
					status: motion.status
				}
			}, context);
		}),

	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).max(255).optional(),
				description: z.string().optional(),
				category: boardMotionCategoryEnum.optional(),
				rationale: z.string().optional(),
				effectiveDate: z.string().datetime().optional().nullable(),
				expiresAt: z.string().datetime().optional().nullable()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ motion: z.any() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, ...data } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status === 'APPROVED' || existing.status === 'DENIED') {
				throw ApiException.badRequest('Cannot update a decided motion');
			}

			const motion = await prisma.boardMotion.update({
				where: { id },
				data: {
					...(data.title && { title: data.title }),
					...(data.description !== undefined && { description: data.description }),
					...(data.category && { category: data.category }),
					...(data.rationale !== undefined && { rationale: data.rationale }),
					...(data.effectiveDate !== undefined && {
						effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null
					}),
					...(data.expiresAt !== undefined && {
						expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
					})
				}
			});

			return successResponse({ motion }, context);
		}),

	second: orgProcedure
		.input(
			z.object({
				id: z.string(),
				secondedById: z.string()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, secondedById, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status !== 'PROPOSED') {
				throw ApiException.badRequest('Motion must be in PROPOSED status to be seconded');
			}

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.boardMotion.update({
					where: { id },
					data: {
						secondedById,
						status: 'SECONDED'
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status
				}
			}, context);
		}),

	changeStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: boardMotionStatusEnum,
				notes: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, status, notes, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status === 'APPROVED' || existing.status === 'DENIED') {
				throw ApiException.badRequest('Cannot change status of a decided motion');
			}

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.boardMotion.update({
					where: { id },
					data: {
						status,
						...(notes && { outcomeNotes: notes })
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status
				}
			}, context);
		}),

	recordOutcome: orgProcedure
		.input(
			z.object({
				id: z.string(),
				outcome: boardMotionOutcomeEnum,
				outcomeNotes: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string(),
						outcome: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, outcome, outcomeNotes, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status === 'APPROVED' || existing.status === 'DENIED') {
				throw ApiException.badRequest('Motion outcome already recorded');
			}

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.boardMotion.update({
					where: { id },
					data: {
						status: outcome === 'PASSED' ? 'APPROVED' : outcome === 'FAILED' ? 'DENIED' : 'WITHDRAWN',
						outcome,
						outcomeNotes,
						decidedAt: new Date()
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status,
					outcome: motion.outcome
				}
			}, context);
		}),

	withdraw: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string(),
						outcome: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, reason, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status === 'APPROVED' || existing.status === 'DENIED') {
				throw ApiException.badRequest('Cannot withdraw a decided motion');
			}

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.boardMotion.update({
					where: { id },
					data: {
						status: 'WITHDRAWN',
						outcome: 'WITHDRAWN',
						outcomeNotes: reason,
						decidedAt: new Date()
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status,
					outcome: motion.outcome
				}
			}, context);
		}),

	// Phase 11: Motion Voting Lifecycle Endpoints

	openVoting: orgProcedure
		.input(
			z.object({
				id: z.string(),
				meetingId: z.string(),
				voteQuestion: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string()
					}),
					vote: z.object({
						id: z.string(),
						question: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, meetingId, voteQuestion, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status !== 'SECONDED' && existing.status !== 'UNDER_DISCUSSION') {
				throw ApiException.badRequest('Motion must be SECONDED or UNDER_DISCUSSION to open voting');
			}

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				// Create a vote for this motion
				const vote = await prisma.vote.create({
					data: {
						meetingId,
						motionId: id,
						question: voteQuestion || `Vote on motion: ${existing.title}`,
						method: 'IN_PERSON',
						createdBy: context.user!.id
					}
				});

				const motion = await prisma.boardMotion.update({
					where: { id },
					data: { status: 'UNDER_VOTE', voteId: vote.id }
				});

				return { motion, vote };
			});

			return successResponse({
				motion: {
					id: result.motion.id,
					motionNumber: result.motion.motionNumber,
					status: result.motion.status
				},
				vote: {
					id: result.vote.id,
					question: result.vote.question
				}
			}, context);
		}),

	closeVoting: orgProcedure
		.input(
			z.object({
				id: z.string()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string(),
						outcome: z.string().nullable()
					}),
					voteResults: z.object({
						yes: z.number(),
						no: z.number(),
						abstain: z.number(),
						passed: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: {
					association: { select: { organizationId: true } },
					votes: { include: { ballots: true } }
				}
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (existing.status !== 'UNDER_VOTE') {
				throw ApiException.badRequest('Motion must be UNDER_VOTE to close voting');
			}

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				// Tally votes from all votes linked to this motion
				const allBallots = existing.votes.flatMap(v => v.ballots);
				const yes = allBallots.filter(b => b.choice === 'YES').length;
				const no = allBallots.filter(b => b.choice === 'NO').length;
				const abstain = allBallots.filter(b => b.choice === 'ABSTAIN').length;
				const passed = yes > no;

				// Close all votes
				await prisma.vote.updateMany({
					where: { motionId: id, closedAt: null },
					data: { closedAt: new Date() }
				});

				// Update motion status based on vote outcome
				const motion = await prisma.boardMotion.update({
					where: { id },
					data: {
						status: passed ? 'APPROVED' : 'DENIED',
						outcome: passed ? 'PASSED' : 'FAILED',
						decidedAt: new Date()
					}
				});

				return { motion, voteResults: { yes, no, abstain, passed } };
			});

			return successResponse({
				motion: {
					id: result.motion.id,
					motionNumber: result.motion.motionNumber,
					status: result.motion.status,
					outcome: result.motion.outcome
				},
				voteResults: result.voteResults
			}, context);
		}),

	table: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motion: z.object({
						id: z.string(),
						motionNumber: z.string(),
						status: z.string(),
						outcome: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { id, reason, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw ApiException.notFound('Board motion');
			if (existing.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			// Can table from any pre-decided state
			if (existing.status === 'APPROVED' || existing.status === 'DENIED' || existing.status === 'WITHDRAWN') {
				throw ApiException.badRequest('Cannot table a motion that has already been decided');
			}

			const motion = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.boardMotion.update({
					where: { id },
					data: {
						status: 'TABLED',
						outcome: 'TABLED',
						outcomeNotes: reason
					}
				});
			});

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status,
					outcome: motion.outcome
				}
			}, context);
		}),

	// Phase 11.8.7: Apply motion decision to linked ARC request
	applyToArc: orgProcedure
		.input(
			z.object({
				motionId: z.string(),
				arcRequestId: z.string(),
				idempotencyKey: z.string()
			})
		)
		.output(
			z.object({
				data: z.object({
					arcRequest: z.object({
						id: z.string(),
						status: z.string(),
						previousStatus: z.string()
					}),
					motion: z.object({
						id: z.string(),
						outcome: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const { motionId, arcRequestId, idempotencyKey } = input;

			// Verify motion exists and is decided
			const motion = await prisma.boardMotion.findFirst({
				where: { id: motionId },
				include: { association: { select: { organizationId: true } } }
			});

			if (!motion) throw ApiException.notFound('Board motion');
			if (motion.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied');
			}

			if (motion.status !== 'APPROVED' && motion.status !== 'DENIED') {
				throw ApiException.badRequest('Motion must be approved or denied to apply to ARC request');
			}

			// Verify ARC request exists
			const arcRequest = await prisma.aRCRequest.findFirst({
				where: { id: arcRequestId },
				include: { association: { select: { organizationId: true } } }
			});

			if (!arcRequest) throw ApiException.notFound('ARC request');
			if (arcRequest.association.organizationId !== context.organization.id) {
				throw ApiException.forbidden('Access denied to ARC request');
			}

			const previousStatus = arcRequest.status;

			// Map motion outcome to ARC status
			const newArcStatus = motion.status === 'APPROVED' ? 'APPROVED' : 'DENIED';

			const updatedArc = await requireIdempotency(idempotencyKey, context, async () => {
				return prisma.aRCRequest.update({
					where: { id: arcRequestId },
					data: {
						status: newArcStatus,
						reviewedAt: new Date(),
						conditions: `Decision applied from board motion ${motion.motionNumber}`
					}
				});
			});

			return successResponse({
				arcRequest: {
					id: updatedArc.id,
					status: updatedArc.status,
					previousStatus
				},
				motion: {
					id: motion.id,
					outcome: motion.outcome
				}
			}, context);
		})
};
