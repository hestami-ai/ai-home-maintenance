import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { startGovernanceWorkflow, GovernanceAction } from '../../../workflows/governanceWorkflow.js';
import {
	BoardMotionCategorySchema,
	BoardMotionStatusSchema,
	BoardMotionOutcomeSchema
} from '../../schemas.js';
import { BoardMotionStatus, BoardMotionOutcome, ARCRequestStatus, VoteChoice } from '../../../../../../generated/prisma/enums.js';

const boardMotionCategoryEnum = BoardMotionCategorySchema;
const boardMotionStatusEnum = BoardMotionStatusSchema;
const boardMotionOutcomeEnum = BoardMotionOutcomeSchema;

const getAssociationOrThrow = async (associationId: string, organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({
		where: { id: associationId, organizationId, deletedAt: null }
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const generateMotionNumber = async (associationId: string, organizationId: string): Promise<string> => {
	const year = new Date().getFullYear();
	const count = await prisma.boardMotion.count({
		where: {
			associationId,
			association: { organizationId },
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					motions: z.array(JsonSchema),
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_motion', 'list');

			const { associationId, meetingId, status, category, outcome, search, page, pageSize } = input;

			await getAssociationOrThrow(associationId, context.organization.id, errors);

			const where = {
				associationId,
				association: { organizationId: context.organization.id },
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ motion: JsonSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_motion', input.id);

			const motion = await prisma.boardMotion.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: {
					association: { select: { id: true, name: true, organizationId: true } },
					meeting: { select: { id: true, title: true, scheduledFor: true, status: true } }
				}
			});

			if (!motion) throw errors.NOT_FOUND({ message: 'Board motion' });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'governance_motion', input.associationId);

			const { associationId, idempotencyKey, ...data } = input;

			await getAssociationOrThrow(associationId, context.organization.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.CREATE_MOTION,
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId,
						...data
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create motion' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id: result.entityId, association: { organizationId: context.organization.id } } });

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
                idempotencyKey: z.string().uuid(),
                id: z.string(),
				title: z.string().min(1).max(255).optional(),
				description: z.string().optional(),
				category: boardMotionCategoryEnum.optional(),
				rationale: z.string().optional(),
				effectiveDate: z.string().datetime().optional().nullable(),
				expiresAt: z.string().datetime().optional().nullable()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ motion: JsonSchema }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);

			const { id, idempotencyKey, ...data } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id, association: { organizationId: context.organization.id } },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });

			if (existing.status === BoardMotionStatus.APPROVED || existing.status === BoardMotionStatus.DENIED) {
				throw errors.BAD_REQUEST({ message: 'Cannot update a decided motion' });
			}

			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.UPDATE_MOTION,
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: id,
					data: {
						title: data.title,
						description: data.description,
						category: data.category,
						rationale: data.rationale,
						effectiveDate: data.effectiveDate,
						expiresAt: data.expiresAt
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.NOT_FOUND({ message: result.error || 'Failed to update motion' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id: result.entityId, association: { organizationId: context.organization.id } } });

			return successResponse({ motion }, context);
		}),

	second: orgProcedure
		.input(
			z.object({
				id: z.string(),
				secondedById: z.string()
			}).merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);

			const { id, secondedById, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id, association: { organizationId: context.organization.id } },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });

			if (existing.status !== BoardMotionStatus.PROPOSED) {
				throw errors.BAD_REQUEST({ message: 'Motion must be in PROPOSED status to be seconded' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.SECOND_MOTION,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { secondedById }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to second motion' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);

			const { id, status, notes, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id, association: { organizationId: context.organization.id } },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });

			if (existing.status === BoardMotionStatus.APPROVED || existing.status === BoardMotionStatus.DENIED) {
				throw errors.BAD_REQUEST({ message: 'Cannot change status of a decided motion' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.UPDATE_MOTION_STATUS,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { status, notes }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update motion status' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);
			const { id, outcome, outcomeNotes, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id, association: { organizationId: context.organization.id } },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });

			if (existing.status === BoardMotionStatus.APPROVED || existing.status === BoardMotionStatus.DENIED) {
				throw errors.BAD_REQUEST({ message: 'Motion outcome already recorded' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.RECORD_MOTION_OUTCOME,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { outcome, notes: outcomeNotes }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to record motion outcome' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);
			const { id, reason, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id, association: { organizationId: context.organization.id } },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });

			if (existing.status === BoardMotionStatus.APPROVED || existing.status === BoardMotionStatus.DENIED) {
				throw errors.BAD_REQUEST({ message: 'Cannot withdraw a decided motion' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.WITHDRAW_MOTION,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { reason }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to withdraw motion' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);
			const { id, meetingId, voteQuestion, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });
			if (existing.association.organizationId !== context.organization.id) {
				throw errors.FORBIDDEN({ message: 'Access denied' });
			}

			if (existing.status !== BoardMotionStatus.SECONDED && existing.status !== BoardMotionStatus.UNDER_DISCUSSION) {
				throw errors.BAD_REQUEST({ message: 'Motion must be SECONDED or UNDER_DISCUSSION to open voting' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.OPEN_VOTING,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { meetingId, question: voteQuestion || `Vote on motion: ${existing.title}` }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to open voting' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, meeting: { association: { organizationId: context.organization.id } } } });
			const vote = await prisma.vote.findFirstOrThrow({ where: { id: result.entityId, meeting: { association: { organizationId: context.organization.id } } } });

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status
				},
				vote: {
					id: vote.id,
					question: vote.question
				}
			}, context);
		}),

	closeVoting: orgProcedure
		.input(
			z.object({
				id: z.string()
			}).merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);
			const { id, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: {
					association: { select: { organizationId: true } },
					votes: { include: { ballots: true } }
				}
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });
			if (existing.association.organizationId !== context.organization.id) {
				throw errors.FORBIDDEN({ message: 'Access denied' });
			}

			if (existing.status !== BoardMotionStatus.UNDER_VOTE) {
				throw errors.BAD_REQUEST({ message: 'Motion must be UNDER_VOTE to close voting' });
			}

			// Tally votes from all votes linked to this motion
			const allBallots = existing.votes.flatMap(v => v.ballots);
			const yes = allBallots.filter(b => b.choice === VoteChoice.YES).length;
			const no = allBallots.filter(b => b.choice === VoteChoice.NO).length;
			const abstain = allBallots.filter(b => b.choice === VoteChoice.ABSTAIN).length;
			const passed = yes > no;
			const outcome = passed ? BoardMotionOutcome.PASSED : BoardMotionOutcome.FAILED;

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.CLOSE_VOTING,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { outcome }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to close voting' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, meeting: { association: { organizationId: context.organization.id } } } });

			return successResponse({
				motion: {
					id: motion.id,
					motionNumber: motion.motionNumber,
					status: motion.status,
					outcome: motion.outcome
				},
				voteResults: { yes, no, abstain, passed }
			}, context);
		}),

	table: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().optional()
			}).merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.id);
			const { id, reason, idempotencyKey } = input;

			const existing = await prisma.boardMotion.findFirst({
				where: { id },
				include: { association: { select: { organizationId: true } } }
			});

			if (!existing) throw errors.NOT_FOUND({ message: 'Board motion' });
			if (existing.association.organizationId !== context.organization.id) {
				throw errors.FORBIDDEN({ message: 'Access denied' });
			}

			// Can table from any pre-decided state
			if (existing.status === BoardMotionStatus.APPROVED || existing.status === BoardMotionStatus.DENIED || existing.status === BoardMotionStatus.WITHDRAWN) {
				throw errors.BAD_REQUEST({ message: 'Cannot table a motion that has already been decided' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.TABLE_MOTION,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: id,
					data: { reason }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to table motion' });
			}

			const motion = await prisma.boardMotion.findFirstOrThrow({ where: { id, meeting: { association: { organizationId: context.organization.id } } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_motion', input.motionId);
			const { motionId, arcRequestId, idempotencyKey } = input;

			// Verify motion exists and is decided
			const motion = await prisma.boardMotion.findFirst({
				where: { id: motionId },
				include: { association: { select: { organizationId: true } } }
			});

			if (!motion) throw errors.NOT_FOUND({ message: 'Board motion' });
			if (motion.association.organizationId !== context.organization.id) {
				throw errors.FORBIDDEN({ message: 'Access denied' });
			}

			if (motion.status !== BoardMotionStatus.APPROVED && motion.status !== BoardMotionStatus.DENIED) {
				throw errors.BAD_REQUEST({ message: 'Motion must be approved or denied to apply to ARC request' });
			}

			// Verify ARC request exists
			const arcRequest = await prisma.aRCRequest.findFirst({
				where: { id: arcRequestId },
				include: { association: { select: { organizationId: true } } }
			});

			if (!arcRequest) throw errors.NOT_FOUND({ message: 'ARC request' });
			if (arcRequest.association.organizationId !== context.organization.id) {
				throw errors.FORBIDDEN({ message: 'Access denied to ARC request' });
			}

			const previousStatus = arcRequest.status;

			// Map motion outcome to ARC status
			const newArcStatus = motion.status === BoardMotionStatus.APPROVED ? ARCRequestStatus.APPROVED : ARCRequestStatus.DENIED;

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: GovernanceAction.LINK_ARC_TO_MOTION,
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: motionId,
					data: { arcRequestId, motionStatus: motion.status }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to apply motion to ARC request' });
			}

			const updatedArc = await prisma.aRCRequest.findFirstOrThrow({ where: { id: arcRequestId, organizationId: context.organization.id } });

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
