import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import {
	ResponseMetaSchema,
	successResponseSchema,
	ARCRequestDetailSchema,
	ARCRequestSummarySchema,
	ARCCategorySchema,
	ARCRequestStatusSchema,
	ARCDocumentTypeSchema,
	ARCReviewActionSchema
} from '$lib/schemas/index.js';
import { startARCRequestWorkflow, ARCRequestAction } from '../../../workflows/arcRequestWorkflow.js';
import {
	Prisma,
	type ARCCategory
} from '../../../../../../generated/prisma/client.js';
import { ARCRequestStatus, ActivityEntityType, ActivityActionType } from '../../../../../../generated/prisma/enums.js';
import { recordIntent, recordExecution, recordDecision } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ARCRequestRoute');

// Use shared enum schemas from schemas.ts
const arcCategoryEnum = ARCCategorySchema;
const arcRequestStatusEnum = ARCRequestStatusSchema;
const arcDocumentTypeEnum = ARCDocumentTypeSchema;
const terminalStatuses: ARCRequestStatus[] = [ARCRequestStatus.APPROVED, ARCRequestStatus.DENIED, ARCRequestStatus.WITHDRAWN, ARCRequestStatus.CANCELLED, ARCRequestStatus.EXPIRED];

const getAssociationOrThrow = async (organizationId: string, associationId: string | null, errors: any) => {
	const association = await prisma.association.findFirst({
		where: {
			id: associationId ?? undefined,
			organizationId,
			deletedAt: undefined // Use undefined instead of null for RLS compatibility
		}
	});
	if (!association) throw errors.NOT_FOUND({ message: 'Association' });
	return association;
};

const ensureUnitBelongs = async (unitId: string, organizationId: string, associationId: string, errors: any) => {
	const unit = await prisma.unit.findFirst({
		where: { id: unitId, organizationId, deletedAt: null },
		include: { property: true }
	});
	if (!unit || unit.property.associationId !== associationId) {
		throw errors.NOT_FOUND({ message: 'Unit' });
	}
};

const ensureCommitteeBelongs = async (committeeId: string, organizationId: string, associationId: string, errors: any) => {
	const committee = await prisma.aRCCommittee.findFirst({
		where: { id: committeeId, organizationId, associationId, isActive: true }
	});
	if (!committee) throw errors.NOT_FOUND({ message: 'ARC Committee' });
};

const ensurePartyBelongs = async (partyId: string, organizationId: string, errors: any) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw errors.NOT_FOUND({ message: 'Party' });
};

export const arcRequestRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					associationId: z.string(),
					committeeId: z.string().optional(),
					unitId: z.string().optional(),
					requesterPartyId: z.string(),
					title: z.string().min(1).max(255),
					description: z.string().min(1).max(5000),
					category: arcCategoryEnum,
					estimatedCost: z.number().nonnegative().optional(),
					proposedStartDate: z.string().datetime().optional(),
					proposedEndDate: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			successResponseSchema(
				z.object({
					request: z.object({
						id: z.string(),
						requestNumber: z.string(),
						title: z.string(),
						status: ARCRequestStatusSchema,
						category: ARCCategorySchema
					})
				})
			)
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'arc_request', 'new');
			const { idempotencyKey, ...rest } = input;

			await getAssociationOrThrow(context.organization.id, rest.associationId, errors);
			if (rest.unitId) await ensureUnitBelongs(rest.unitId, context.organization.id, rest.associationId, errors);
			if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, context.organization.id, rest.associationId, errors);
			await ensurePartyBelongs(rest.requesterPartyId, context.organization.id, errors);

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.CREATE_REQUEST,
					organizationId: context.organization.id,
					userId: context.user.id,
					data: {
						associationId: rest.associationId,
						committeeId: rest.committeeId,
						unitId: rest.unitId,
						requesterPartyId: rest.requesterPartyId,
						title: rest.title,
						description: rest.description,
						category: rest.category,
						estimatedCost: rest.estimatedCost,
						proposedStartDate: rest.proposedStartDate,
						proposedEndDate: rest.proposedEndDate
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to create ARC request' });
			}

			const result = await prisma.aRCRequest.findFirstOrThrow({ where: { id: workflowResult.entityId, organizationId: context.organization.id } });

			// Record activity event
			await recordIntent(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: result.id,
				action: ActivityActionType.CREATE,
				summary: `ARC request created: ${result.title}`,
				arcRequestId: result.id,
				associationId: rest.associationId,
				unitId: rest.unitId,
				newState: {
					requestNumber: result.requestNumber,
					title: result.title,
					status: result.status,
					category: result.category
				}
			});

			return successResponse(
				{
					request: {
						id: result.id,
						requestNumber: result.requestNumber,
						title: result.title,
						status: result.status,
						category: result.category
					}
				},
				context
			);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			successResponseSchema(
				z.object({ request: ARCRequestDetailSchema })
			)
		)
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const request = await prisma.aRCRequest.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: {
					association: true,
					unit: true,
					committee: true,
					requesterParty: true,
					// documents: true, // DEPRECATED: ARCDocument model is deprecated, use Document + DocumentContextBinding
					reviews: true
				}
			});

			if (!request) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			await context.cerbos.authorize('view', 'arc_request', request.id);

			// Serialize Decimal fields to strings for schema compatibility
			const serializedRequest = {
				...request,
				estimatedCost: request.estimatedCost?.toString() ?? null
			};

			return successResponse({ request: serializedRequest }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: arcRequestStatusEnum.optional()
			})
		)
		.output(
			successResponseSchema(
				z.object({
					requests: z.array(ARCRequestSummarySchema),
					pagination: PaginationOutputSchema
				})
			)
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve ARC requests' }
		})
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'arc_request', 'list');

			const take = input.limit ?? 20;
			const where: Prisma.ARCRequestWhereInput = {
				association: { organizationId: context.organization.id },
				status: input.status as ARCRequestStatus | undefined,
				associationId: input.associationId ?? context.associationId ?? undefined
			};

			const items = await prisma.aRCRequest.findMany({
				where,
				take: take + 1,
				skip: input.cursor ? 1 : 0,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				orderBy: { createdAt: 'desc' }
			});

			const hasNext = items.length > take;
			const data = hasNext ? items.slice(0, -1) : items;

			return successResponse(
				{
					requests: data,
					pagination: {
						hasMore: hasNext,
						nextCursor: hasNext ? data[data.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					title: z.string().min(1).max(255).optional(),
					description: z.string().min(1).max(5000).optional(),
					category: arcCategoryEnum.optional(),
					estimatedCost: z.number().nonnegative().optional(),
					proposedStartDate: z.string().datetime().optional(),
					proposedEndDate: z.string().datetime().optional(),
					committeeId: z.string().optional(),
					unitId: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ request: z.object({ id: z.string(), status: z.string() }) }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const { idempotencyKey, ...rest } = input;

			const existing = await prisma.aRCRequest.findFirst({
				where: { id: rest.id, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot update a finalized ARC request' });
			}

			if (rest.unitId) await ensureUnitBelongs(rest.unitId, context.organization.id, existing.associationId, errors);
			if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, context.organization.id, existing.associationId, errors);

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.UPDATE_REQUEST,
					organizationId: context.organization.id,
					userId: context.user.id,
					requestId: rest.id,
					data: {
						title: rest.title,
						description: rest.description,
						category: rest.category,
						estimatedCost: rest.estimatedCost,
						proposedStartDate: rest.proposedStartDate,
						proposedEndDate: rest.proposedEndDate
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update ARC request' });
			}

			const updated = await prisma.aRCRequest.findFirstOrThrow({ where: { id: rest.id, organizationId: context.organization.id } });

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		}),

	submit: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ id: z.string() })))
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string(), submittedAt: z.string().nullable() }) }), meta: ResponseMetaSchema }))
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const existing = await prisma.aRCRequest.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot submit a finalized ARC request' });
			}
			if (existing.status === ARCRequestStatus.SUBMITTED || existing.status === ARCRequestStatus.UNDER_REVIEW) {
				return successResponse({ request: { id: existing.id, status: existing.status, submittedAt: existing.submittedAt?.toISOString() ?? null } }, context);
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.SUBMIT_REQUEST,
					organizationId: context.organization.id,
					userId: context.user.id,
					requestId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to submit ARC request' });
			}

			const updated = await prisma.aRCRequest.findFirstOrThrow({ where: { id: input.id, organizationId: context.organization.id } });

			// Record activity event
			await recordExecution(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: updated.id,
				action: ActivityActionType.SUBMIT,
				summary: `ARC request submitted for review`,
				arcRequestId: updated.id,
				newState: { status: updated.status }
			});

			return successResponse({ request: { id: updated.id, status: updated.status, submittedAt: updated.submittedAt?.toISOString() ?? null } }, context);
		}),

	withdraw: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({ id: z.string(), reason: z.string().max(1000).optional() })
			)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string(), withdrawnAt: z.string().nullable() }) }), meta: ResponseMetaSchema }))
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const existing = await prisma.aRCRequest.findFirst({
				where: { id: input.id, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!existing) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (existing.status === ARCRequestStatus.WITHDRAWN) {
				return successResponse({ request: { id: existing.id, status: existing.status, withdrawnAt: existing.withdrawnAt?.toISOString() ?? null } }, context);
			}
			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot withdraw a finalized ARC request' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.WITHDRAW_REQUEST,
					organizationId: context.organization.id,
					userId: context.user.id,
					requestId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to withdraw ARC request' });
			}

			const updated = await prisma.aRCRequest.findFirstOrThrow({ where: { id: input.id, organizationId: context.organization.id } });

			// Record activity event
			await recordExecution(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: updated.id,
				action: ActivityActionType.CANCEL,
				summary: `ARC request withdrawn${input.reason ? `: ${input.reason}` : ''}`,
				arcRequestId: updated.id,
				newState: { status: updated.status }
			});

			return successResponse({ request: { id: updated.id, status: updated.status, withdrawnAt: updated.withdrawnAt?.toISOString() ?? null } }, context);
		}),

	addDocument: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					documentType: arcDocumentTypeEnum,
					fileName: z.string().min(1),
					fileUrl: z.string().url(),
					fileSize: z.number().int().nonnegative().optional(),
					mimeType: z.string().optional(),
					description: z.string().max(2000).optional(),
					version: z.string().max(100).optional()
				})
			)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ document: z.object({ id: z.string(), requestId: z.string() }) }), meta: ResponseMetaSchema }))
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const request = await prisma.aRCRequest.findFirst({
				where: { id: rest.requestId, association: { organizationId: context.organization.id } },
				include: { association: true }
			});
			if (!request) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot add documents to a finalized ARC request' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.ADD_DOCUMENT,
					organizationId: context.organization.id,
					userId: context.user.id,
					requestId: rest.requestId,
					data: {
						documentType: rest.documentType,
						fileName: rest.fileName,
						fileUrl: rest.fileUrl,
						fileSize: rest.fileSize,
						mimeType: rest.mimeType,
						description: rest.description
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to add document' });
			}

			return successResponse({ document: { id: workflowResult.entityId!, requestId: rest.requestId } }, context);
		}),

	recordDecision: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					action: ARCReviewActionSchema,
					notes: z.string().max(5000).optional(),
					conditions: z.string().max(5000).optional(),
					expiresAt: z.string().datetime().optional()
				})
			)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string() }) }), meta: ResponseMetaSchema }))
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const request = await prisma.aRCRequest.findFirst({
				where: { id: rest.requestId, organizationId: context.organization.id },
				include: { association: true }
			});
			if (!request) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			const previousStatus = request.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.RECORD_DECISION,
					organizationId: context.organization.id,
					userId: context.user.id,
					requestId: rest.requestId,
					data: {
						action: rest.action,
						reviewerId: context.user.id,
						comments: rest.notes,
						conditions: rest.conditions
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to record decision' });
			}

			const updated = await prisma.aRCRequest.findFirstOrThrow({ where: { id: rest.requestId, organizationId: context.organization.id } });

			// Record activity event
			const actionToEventAction: Record<string, ActivityActionType> = {
				APPROVE: ActivityActionType.APPROVE,
				DENY: ActivityActionType.DENY,
				REQUEST_CHANGES: ActivityActionType.STATUS_CHANGE,
				TABLE: ActivityActionType.STATUS_CHANGE
			};

			await recordDecision(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: updated.id,
				action: actionToEventAction[rest.action] || ActivityActionType.STATUS_CHANGE,
				summary: `ARC request ${rest.action.toLowerCase().replace('_', ' ')}: ${rest.notes?.substring(0, 100) || 'No notes'}`,
				arcRequestId: updated.id,
				previousState: { status: previousStatus },
				newState: { status: updated.status, conditions: rest.conditions }
			});

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		}),

	/**
	 * Get prior precedents - similar past ARC requests for the same category or unit
	 */
	getPriorPrecedents: orgProcedure
		.input(
			z.object({
				requestId: z.string(),
				unitId: z.string().optional(),
				category: arcCategoryEnum.optional(),
				limit: z.number().int().min(1).max(20).default(5)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unitPrecedents: z.array(
						z.object({
							id: z.string(),
							requestNumber: z.string(),
							title: z.string(),
							status: z.string(),
							category: z.string(),
							decisionDate: z.string().nullable()
						})
					),
					categoryPrecedents: z.array(
						z.object({
							id: z.string(),
							requestNumber: z.string(),
							title: z.string(),
							status: z.string(),
							category: z.string(),
							decisionDate: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'ARC Request not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'arc_request', input.requestId);

			const request = await prisma.aRCRequest.findFirst({
				where: { id: input.requestId, organizationId: context.organization.id },
				include: { association: true }
			});

			if (!request) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			// Get precedents for the same unit
			const unitPrecedents = input.unitId
				? await prisma.aRCRequest.findMany({
					where: {
						organizationId: context.organization.id,
						associationId: request.associationId,
						unitId: input.unitId,
						id: { not: input.requestId },
						status: { in: ['APPROVED', 'DENIED', 'CHANGES_REQUESTED'] }
					},
					orderBy: { decisionDate: 'desc' },
					take: input.limit
				})
				: [];

			// Get precedents for the same category
			const categoryPrecedents = input.category
				? await prisma.aRCRequest.findMany({
					where: {
						organizationId: context.organization.id,
						associationId: request.associationId,
						category: input.category as ARCCategory,
						id: { not: input.requestId },
						status: { in: ['APPROVED', 'DENIED', 'CHANGES_REQUESTED'] }
					},
					orderBy: { decisionDate: 'desc' },
					take: input.limit
				})
				: [];

			return successResponse(
				{
					unitPrecedents: unitPrecedents.map((p) => ({
						id: p.id,
						requestNumber: p.requestNumber,
						title: p.title,
						status: p.status,
						category: p.category,
						decisionDate: p.decisionDate?.toISOString() ?? null
					})),
					categoryPrecedents: categoryPrecedents.map((p) => ({
						id: p.id,
						requestNumber: p.requestNumber,
						title: p.title,
						status: p.status,
						category: p.category,
						decisionDate: p.decisionDate?.toISOString() ?? null
					}))
				},
				context
			);
		}),

	/**
	 * Request more information from the applicant
	 */
	requestInfo: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					infoNeeded: z.string().min(1).max(5000),
					dueDate: z.string().datetime().optional()
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
			const result = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.REQUEST_INFO,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					requestId: rest.requestId,
					data: { infoNeeded: rest.infoNeeded, dueDate: rest.dueDate }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to request info' });
			}

			const updated = { id: result.entityId!, status: result.newStatus! };
			const previousStatus = result.previousStatus!;
			const infoNeeded = rest.infoNeeded;

			// Record activity event
			await recordExecution(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: updated.id,
				action: ActivityActionType.STATUS_CHANGE,
				summary: `Additional information requested: ${infoNeeded.substring(0, 100)}`,
				arcRequestId: updated.id,
				previousState: { status: previousStatus },
				newState: { status: updated.status }
			});

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		}),

	/**
	 * Applicant submits requested information
	 */
	submitInfo: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({
					requestId: z.string(),
					response: z.string().min(1).max(10000),
					documentIds: z.array(z.string()).optional()
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
			await context.cerbos.authorize('edit', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			// Use DBOS workflow for durable execution
			const result = await startARCRequestWorkflow(
				{
					action: ARCRequestAction.SUBMIT_INFO,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					requestId: rest.requestId,
					data: { response: rest.response, documentIds: rest.documentIds }
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to submit info' });
			}

			const updated = { id: result.entityId!, status: result.newStatus! };
			const previousStatus = result.previousStatus!;
			const response = rest.response;

			// Record activity event
			await recordExecution(context, {
				entityType: ActivityEntityType.ARC_REQUEST,
				entityId: updated.id,
				action: ActivityActionType.SUBMIT,
				summary: `Information submitted: ${response.substring(0, 100)}`,
				arcRequestId: updated.id,
				previousState: { status: previousStatus },
				newState: { status: updated.status }
			});

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		})
};
