import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { ResolutionStatusSchema, PolicyStatusSchema } from '../../schemas.js';
import { prisma } from '../../../db.js';
import { startGovernanceWorkflow } from '../../../workflows/governanceWorkflow.js';
import type { ResolutionStatus, PolicyStatus } from '../../../../../../generated/prisma/client.js';

const resolutionStatusEnum = ResolutionStatusSchema;
const policyStatusEnum = PolicyStatusSchema;

const ensureAssociation = async (associationId: string, organizationId: string, errors: any) => {
	const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const ensureBoardBelongs = async (boardId: string | null | undefined, associationId: string, errors: any) => {
	if (!boardId) return;
	const board = await prisma.board.findFirst({ where: { id: boardId, associationId } });
	if (!board) throw errors.NOT_FOUND({ message: 'Board' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'governance_resolution', input.associationId);
			const { idempotencyKey, ...rest } = input;

			await ensureAssociation(rest.associationId, context.organization.id, errors);
			await ensureBoardBelongs(rest.boardId, rest.associationId, errors);

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_RESOLUTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: rest.associationId,
						title: rest.title,
						content: rest.summary,
						effectiveDate: rest.effectiveDate
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create resolution' });
			}

			const resolution = await prisma.resolution.findFirstOrThrow({ where: { id: result.entityId, association: { organizationId: context.organization.id } } });

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
				data: z.object({ resolution: z.object({ id: z.string(), associationId: z.string(), title: z.string(), status: z.string(), boardId: z.string().nullable() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const resolution = await prisma.resolution.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: { association: true, board: true, policyDocuments: true, supersedes: true, supersededBy: true }
			});
			if (!resolution) {
				throw errors.NOT_FOUND({ message: 'Resolution' });
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
					resolutions: z.array(z.object({ id: z.string(), associationId: z.string(), title: z.string(), status: z.string(), createdAt: z.coerce.date() })),
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
			await context.cerbos.authorize('view', 'governance_resolution', 'list');

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_resolution', input.id);
			const { idempotencyKey, ...rest } = input;

			const existing = await prisma.resolution.findFirst({
				where: { id: rest.id, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Resolution' });
			}

			if (rest.supersededById) {
				const sup = await prisma.resolution.findFirst({
					where: { id: rest.supersededById, associationId: existing.associationId, association: { organizationId: context.organization.id } }
				});
				if (!sup) throw errors.NOT_FOUND({ message: 'Superseding resolution' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'UPDATE_RESOLUTION_STATUS',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: rest.id,
					data: { status: rest.status }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update resolution status' });
			}

			const resolution = await prisma.resolution.findFirstOrThrow({ where: { id: rest.id, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'governance_policy', input.associationId);
			const { idempotencyKey, ...rest } = input;

			await ensureAssociation(rest.associationId, context.organization.id, errors);
			if (rest.resolutionId) {
				const res = await prisma.resolution.findFirst({
					where: { id: rest.resolutionId, associationId: rest.associationId, association: { organizationId: context.organization.id } }
				});
				if (!res) throw errors.NOT_FOUND({ message: 'Resolution' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_POLICY',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: rest.associationId,
						resolutionId: rest.resolutionId,
						title: rest.title,
						description: rest.description
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create policy document' });
			}

			const policy = await prisma.policyDocument.findFirstOrThrow({ where: { id: result.entityId, association: { organizationId: context.organization.id } } });

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
				data: z.object({ policy: z.object({ id: z.string(), associationId: z.string(), title: z.string(), status: z.string(), description: z.string().nullable() }).passthrough() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const policy = await prisma.policyDocument.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: { association: true, resolution: true, versions: true }
			});
			if (!policy) {
				throw errors.NOT_FOUND({ message: 'Policy' });
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
					policies: z.array(z.object({ id: z.string(), associationId: z.string(), title: z.string(), status: z.string(), createdAt: z.coerce.date() })),
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
			await context.cerbos.authorize('view', 'governance_policy', 'list');

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_policy', input.policyDocumentId);
			const { idempotencyKey, ...rest } = input;

			const policy = await prisma.policyDocument.findFirst({
				where: { id: rest.policyDocumentId, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!policy) {
				throw errors.NOT_FOUND({ message: 'Policy' });
			}

			// Check if version already exists
			const existing = await prisma.policyVersion.findFirst({
				where: { policyDocumentId: rest.policyDocumentId, version: rest.version, policyDocument: { association: { organizationId: context.organization.id } } }
			});
			if (existing) {
				return successResponse(
					{
						version: {
							id: existing.id,
							policyDocumentId: existing.policyDocumentId,
							version: existing.version,
							status: existing.status
						}
					},
					context
				);
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'CREATE_POLICY_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						policyDocumentId: rest.policyDocumentId,
						content: rest.content
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create policy version' });
			}

			const version = await prisma.policyVersion.findFirstOrThrow({ where: { id: result.entityId, policyDocument: { association: { organizationId: context.organization.id } } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_policy', input.policyDocumentId);
			const { idempotencyKey, ...rest } = input;

			const policy = await prisma.policyDocument.findFirst({
				where: { id: rest.policyDocumentId },
				include: { association: true }
			});
			if (!policy || policy.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Policy' });
			}

			const version = await prisma.policyVersion.findFirst({
				where: { policyDocumentId: rest.policyDocumentId, version: rest.version }
			});
			if (!version) throw errors.NOT_FOUND({ message: 'Policy version' });

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'SET_ACTIVE_POLICY_VERSION',
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						policyDocumentId: rest.policyDocumentId,
						versionId: version.id
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate policy version' });
			}

			const updatedPolicy = await prisma.policyDocument.findFirstOrThrow({ where: { id: rest.policyDocumentId, association: { organizationId: context.organization.id } } });

			return successResponse(
				{
					policy: {
						id: updatedPolicy.id,
						currentVersion: updatedPolicy.currentVersion ?? null,
						status: updatedPolicy.status
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'governance_resolution', input.resolutionId);
			const { idempotencyKey, resolutionId, motionId } = input;

			const existing = await prisma.resolution.findFirst({
				where: { id: resolutionId, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Resolution' });
			}

			const motion = await prisma.boardMotion.findFirst({
				where: { id: motionId, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!motion) {
				throw errors.NOT_FOUND({ message: 'Motion' });
			}

			// Use DBOS workflow for durable execution
			const result = await startGovernanceWorkflow(
				{
					action: 'LINK_RESOLUTION_TO_MOTION',
					organizationId: context.organization.id,
					userId: context.user.id,
					entityId: resolutionId,
					data: { motionId }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to link resolution to motion' });
			}

			const resolution = await prisma.resolution.findFirstOrThrow({ where: { id: resolutionId, association: { organizationId: context.organization.id } } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'governance_resolution', input.resolutionId);

			const resolution = await prisma.resolution.findFirst({
				where: { id: input.resolutionId, association: { organizationId: context.organization.id } },
				include: {
					association: true,
					motion: { select: { id: true, title: true, status: true } },
					workOrders: { select: { id: true, workOrderNumber: true, status: true } },
					policyDocuments: { select: { id: true, title: true, status: true } }
				}
			});

			if (!resolution || resolution.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'Resolution' });
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
