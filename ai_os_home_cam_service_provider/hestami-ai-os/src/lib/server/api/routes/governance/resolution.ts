import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { ResolutionStatus, PolicyStatus } from '../../../../../../generated/prisma/client.js';
import type { RequestContext } from '../../context.js';

const resolutionStatusEnum = z.enum(['PROPOSED', 'ADOPTED', 'SUPERSEDED', 'ARCHIVED']);
const policyStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'RETIRED']);

const requireIdempotency = async <T>(key: string | undefined, ctx: RequestContext, fn: () => Promise<T>) => {
	if (!key) throw ApiException.badRequest('Idempotency key is required');
	const { result } = await withIdempotency(key, ctx, fn);
	return result;
};

const ensureAssociation = async (associationId: string, organizationId: string) => {
	const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
	if (!association) throw ApiException.notFound('Association');
	return association;
};

const ensureBoardBelongs = async (boardId: string | null | undefined, associationId: string) => {
	if (!boardId) return;
	const board = await prisma.board.findFirst({ where: { id: boardId, associationId } });
	if (!board) throw ApiException.notFound('Board');
};

export const governanceResolutionRouter = {
	// Resolutions
	createResolution: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					boardId: z.string().optional(),
					title: z.string().min(1).max(255),
					summary: z.string().max(5000).optional(),
					effectiveDate: z.string().datetime().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					resolution: z.object({
						id: z.string(),
						associationId: z.string(),
						title: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'governance_resolution', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const resolution = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				await ensureBoardBelongs(rest.boardId, rest.associationId);

				return prisma.resolution.create({
					data: {
						associationId: rest.associationId,
						boardId: rest.boardId,
						title: rest.title,
						summary: rest.summary,
						effectiveDate: rest.effectiveDate ? new Date(rest.effectiveDate) : undefined,
						status: 'PROPOSED'
					}
				});
			});

			return successResponse(
				{
					resolution: {
						id: resolution.id,
						associationId: resolution.associationId,
						title: resolution.title,
						status: resolution.status
					}
				},
				context
			);
		}),

	getResolution: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ resolution: z.any() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const resolution = await prisma.resolution.findFirst({
				where: { id: input.id },
				include: { association: true, board: true, policyDocuments: true, supersedes: true, supersededBy: true }
			});
			if (!resolution || resolution.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Resolution');
			}
			await context.cerbos.authorize('view', 'governance_resolution', resolution.id);
			return successResponse({ resolution }, context);
		}),

	listResolutions: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: resolutionStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					resolutions: z.array(z.any()),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				status: input.status as ResolutionStatus | undefined
			};
			const items = await prisma.resolution.findMany({
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
					resolutions: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	updateResolutionStatus: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					id: z.string(),
					status: resolutionStatusEnum,
					effectiveDate: z.string().datetime().optional(),
					supersededById: z.string().optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ resolution: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_resolution', input.id);
			const { idempotencyKey, ...rest } = input;

			const resolution = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.resolution.findFirst({
					where: { id: rest.id },
					include: { association: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Resolution');
				}

				if (rest.supersededById) {
					const sup = await prisma.resolution.findFirst({
						where: { id: rest.supersededById, associationId: existing.associationId }
					});
					if (!sup) throw ApiException.notFound('Superseding resolution');
				}

				return prisma.resolution.update({
					where: { id: rest.id },
					data: {
						status: rest.status as ResolutionStatus,
						effectiveDate: rest.effectiveDate ? new Date(rest.effectiveDate) : existing.effectiveDate,
						supersededById: rest.supersededById
					}
				});
			});

			return successResponse({ resolution: { id: resolution.id, status: resolution.status } }, context);
		}),

	// Policy documents
	createPolicyDocument: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					associationId: z.string(),
					resolutionId: z.string().optional(),
					title: z.string().min(1).max(255),
					description: z.string().max(5000).optional()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					policy: z.object({
						id: z.string(),
						associationId: z.string(),
						title: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'governance_policy', input.associationId);
			const { idempotencyKey, ...rest } = input;

			const policy = await requireIdempotency(idempotencyKey, context, async () => {
				await ensureAssociation(rest.associationId, context.organization.id);
				if (rest.resolutionId) {
					const res = await prisma.resolution.findFirst({
						where: { id: rest.resolutionId, associationId: rest.associationId }
					});
					if (!res) throw ApiException.notFound('Resolution');
				}

				return prisma.policyDocument.create({
					data: {
						associationId: rest.associationId,
						resolutionId: rest.resolutionId,
						title: rest.title,
						description: rest.description,
						status: 'DRAFT'
					}
				});
			});

			return successResponse(
				{
					policy: {
						id: policy.id,
						associationId: policy.associationId,
						title: policy.title,
						status: policy.status
					}
				},
				context
			);
		}),

	getPolicyDocument: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ policy: z.any() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const policy = await prisma.policyDocument.findFirst({
				where: { id: input.id },
				include: { association: true, resolution: true, versions: true }
			});
			if (!policy || policy.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Policy');
			}
			await context.cerbos.authorize('view', 'governance_policy', policy.id);
			return successResponse({ policy }, context);
		}),

	listPolicyDocuments: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: policyStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					policies: z.array(z.any()),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where = {
				association: { organizationId: context.organization.id },
				associationId: input.associationId,
				status: input.status as PolicyStatus | undefined
			};
			const items = await prisma.policyDocument.findMany({
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
					policies: data,
					pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
				},
				context
			);
		}),

	createPolicyVersion: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					policyDocumentId: z.string(),
					version: z.string().min(1),
					content: z.string().min(1),
					status: policyStatusEnum.default('DRAFT')
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					version: z.object({ id: z.string(), policyDocumentId: z.string(), version: z.string(), status: z.string() })
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_policy', input.policyDocumentId);
			const { idempotencyKey, ...rest } = input;

			const version = await requireIdempotency(idempotencyKey, context, async () => {
				const policy = await prisma.policyDocument.findFirst({
					where: { id: rest.policyDocumentId },
					include: { association: true }
				});
				if (!policy || policy.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Policy');
				}

				const existing = await prisma.policyVersion.findFirst({
					where: { policyDocumentId: rest.policyDocumentId, version: rest.version }
				});
				if (existing) return existing;

				return prisma.policyVersion.create({
					data: {
						policyDocumentId: rest.policyDocumentId,
						version: rest.version,
						content: rest.content,
						status: rest.status as PolicyStatus
					}
				});
			});

			return successResponse(
				{
					version: {
						id: version.id,
						policyDocumentId: version.policyDocumentId,
						version: version.version,
						status: version.status
					}
				},
				context
			);
		}),

	activatePolicyVersion: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					policyDocumentId: z.string(),
					version: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					policy: z.object({ id: z.string(), currentVersion: z.string().nullable(), status: z.string() })
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_policy', input.policyDocumentId);
			const { idempotencyKey, ...rest } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				const policy = await prisma.policyDocument.findFirst({
					where: { id: rest.policyDocumentId },
					include: { association: true }
				});
				if (!policy || policy.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Policy');
				}

				const version = await prisma.policyVersion.findFirst({
					where: { policyDocumentId: rest.policyDocumentId, version: rest.version }
				});
				if (!version) throw ApiException.notFound('Policy version');

				await prisma.policyVersion.updateMany({
					where: { policyDocumentId: rest.policyDocumentId, status: 'ACTIVE' },
					data: { status: 'RETIRED' }
				});

				await prisma.policyVersion.update({
					where: { id: version.id },
					data: { status: 'ACTIVE', approvedAt: new Date(), approvedBy: context.user?.id }
				});

				const updatedPolicy = await prisma.policyDocument.update({
					where: { id: rest.policyDocumentId },
					data: { currentVersion: rest.version, status: 'ACTIVE' }
				});

				return updatedPolicy;
			});

			return successResponse(
				{
					policy: {
						id: result.id,
						currentVersion: result.currentVersion ?? null,
						status: result.status
					}
				},
				context
			);
		}),

	// Phase 11: Resolution Linking Endpoints

	linkToMotion: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					resolutionId: z.string(),
					motionId: z.string()
				})
			)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					resolution: z.object({
						id: z.string(),
						title: z.string(),
						motionId: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'governance_resolution', input.resolutionId);
			const { idempotencyKey, resolutionId, motionId } = input;

			const resolution = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.resolution.findFirst({
					where: { id: resolutionId },
					include: { association: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Resolution');
				}

				const motion = await prisma.boardMotion.findFirst({
					where: { id: motionId },
					include: { association: true }
				});
				if (!motion || motion.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('Motion');
				}

				return prisma.resolution.update({
					where: { id: resolutionId },
					data: { motionId }
				});
			});

			return successResponse(
				{
					resolution: {
						id: resolution.id,
						title: resolution.title,
						motionId: resolution.motionId!
					}
				},
				context
			);
		}),

	getLinkedActions: orgProcedure
		.input(z.object({ resolutionId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					resolution: z.object({ id: z.string(), title: z.string() }),
					linkedMotion: z.object({ id: z.string(), title: z.string(), status: z.string() }).nullable(),
					linkedWorkOrders: z.array(z.object({ id: z.string(), workOrderNumber: z.string(), status: z.string() })),
					linkedPolicies: z.array(z.object({ id: z.string(), title: z.string(), status: z.string() }))
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'governance_resolution', input.resolutionId);

			const resolution = await prisma.resolution.findFirst({
				where: { id: input.resolutionId },
				include: {
					association: true,
					motion: { select: { id: true, title: true, status: true } },
					workOrders: { select: { id: true, workOrderNumber: true, status: true } },
					policyDocuments: { select: { id: true, title: true, status: true } }
				}
			});

			if (!resolution || resolution.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('Resolution');
			}

			return successResponse(
				{
					resolution: { id: resolution.id, title: resolution.title },
					linkedMotion: resolution.motion ? {
						id: resolution.motion.id,
						title: resolution.motion.title,
						status: resolution.motion.status
					} : null,
					linkedWorkOrders: resolution.workOrders.map(wo => ({
						id: wo.id,
						workOrderNumber: wo.workOrderNumber,
						status: wo.status
					})),
					linkedPolicies: resolution.policyDocuments.map(p => ({
						id: p.id,
						title: p.title,
						status: p.status
					}))
				},
				context
			);
		})
};
