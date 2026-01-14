import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startGovernanceWorkflow } from '../../../workflows/governanceWorkflow.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { BoardRoleSchema } from '../../schemas.js';

const log = createModuleLogger('BoardRoute');

const boardRoleEnum = BoardRoleSchema;

const getAssociationOrThrow = async (associationId: string, organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string, errors: any) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw errors.NOT_FOUND({ message: 'Party' });
};

export const governanceBoardRouter = {
	create: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					name: z.string().min(1).max(255),
					description: z.string().max(2000).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ board: z.object({ id: z.string(), name: z.string(), associationId: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'governance_board', input.associationId);
			const { idempotencyKey, ...rest } = input;

			await getAssociationOrThrow(rest.associationId, context.organization.id, errors);

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_BOARD',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: rest
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create board' });
			}

			const board = await prisma.board.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{ board: { id: board.id, name: board.name, associationId: board.associationId } },
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ board: JsonSchema }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Board not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const board = await prisma.board.findFirst({
				where: { id: input.id },
				include: { association: true, members: true }
			});
			if (!board || board.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Board' });
			}
			await context.cerbos.authorize('view', 'governance_board', board.id);
			return successResponse({ board }, context);
		}),

	list: orgProcedure
		.input(PaginationInputSchema.extend({ associationId: z.string().optional() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					boards: z.array(JsonSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Operation failed' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'governance_board', 'list');

			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId
			};
			const items = await prisma.board.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;
			return successResponse(
				{
					boards: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	addMember: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					boardId: z.string(),
					partyId: z.string(),
					role: boardRoleEnum,
					termStart: z.string().datetime(),
					termEnd: z.string().datetime().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ member: z.object({ id: z.string(), boardId: z.string(), partyId: z.string(), role: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_board', input.boardId);
			const { idempotencyKey, ...rest } = input;

			const board = await prisma.board.findFirst({
				where: { id: rest.boardId },
				include: { association: true }
			});
			if (!board || board.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Board' });
			}
			await ensurePartyBelongs(rest.partyId, board.association.organizationId, errors);

			// Use DBOS workflow for durable execution
			const workflowResult = await startGovernanceWorkflow(
				{
					action: 'ADD_BOARD_MEMBER',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						boardId: rest.boardId,
						partyId: rest.partyId,
						role: rest.role,
						termStart: rest.termStart,
						termEnd: rest.termEnd
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to add board member' });
			}

			const member = await prisma.boardMember.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			return successResponse(
				{ member: { id: member.id, boardId: member.boardId, partyId: member.partyId, role: member.role } },
				context
			);
		}),

	removeMember: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					boardId: z.string(),
					memberId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ member: z.object({ id: z.string(), boardId: z.string(), isActive: z.boolean() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Board not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_board', input.boardId);
			const { idempotencyKey, ...rest } = input;

			const board = await prisma.board.findFirst({
				where: { id: rest.boardId },
				include: { association: true }
			});
			if (!board || board.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Board' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startGovernanceWorkflow(
				{
					action: 'REMOVE_BOARD_MEMBER',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						boardId: rest.boardId,
						memberId: rest.memberId
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to remove board member' });
			}

			const member = await prisma.boardMember.findUniqueOrThrow({ where: { id: rest.memberId } });

			return successResponse(
				{ member: { id: member.id, boardId: member.boardId, isActive: member.isActive } },
				context
			);
		}),

	listHistory: orgProcedure
		.input(
			PaginationInputSchema.extend({
				boardId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					entries: z.array(JsonSchema),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Board not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_board', input.boardId);

			const take = input.limit ?? 20;
			const board = await prisma.board.findFirst({
				where: { id: input.boardId },
				include: { association: true }
			});
			if (!board || board.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Board' });
			}

			const items = await prisma.boardHistory.findMany({
				where: { boardId: input.boardId },
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = items.length > take;
			const data = hasMore ? items.slice(0, -1) : items;

			return successResponse(
				{
					entries: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		})
};
