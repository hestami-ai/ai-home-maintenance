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
import { startARCRequestWorkflow } from '../../../workflows/arcRequestWorkflow.js';
import {
	Prisma,
	type ARCRequestStatus,
	type ARCCategory
} from '../../../../../../generated/prisma/client.js';
import { recordIntent, recordExecution, recordDecision } from '../../middleware/activityEvent.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ARCRequestRoute');

// Use shared enum schemas from schemas.ts
const arcCategoryEnum = ARCCategorySchema;
const arcRequestStatusEnum = ARCRequestStatusSchema;
const arcDocumentTypeEnum = ARCDocumentTypeSchema;
const terminalStatuses: ARCRequestStatus[] = ['APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED'];

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

const ensureUnitBelongs = async (unitId: string, associationId: string, errors: any) => {
	const unit = await prisma.unit.findFirst({
		where: { id: unitId, deletedAt: null },
		include: { property: true }
	});
	if (!unit || unit.property.associationId !== associationId) {
		throw errors.NOT_FOUND({ message: 'Unit' });
	}
};

const ensureCommitteeBelongs = async (committeeId: string, associationId: string, errors: any) => {
	const committee = await prisma.aRCCommittee.findFirst({
		where: { id: committeeId, associationId, isActive: true }
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
			if (rest.unitId) await ensureUnitBelongs(rest.unitId, rest.associationId, errors);
			if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, rest.associationId, errors);
			await ensurePartyBelongs(rest.requesterPartyId, context.organization.id, errors);

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'CREATE_REQUEST',
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

			const result = await prisma.aRCRequest.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			// Record activity event
			await recordIntent(context, {
				entityType: 'ARC_REQUEST',
				entityId: result.id,
				action: 'CREATE',
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
				where: { id: input.id },
				include: {
					association: true,
					unit: true,
					committee: true,
					requesterParty: true,
					// documents: true, // DEPRECATED: ARCDocument model is deprecated, use Document + DocumentContextBinding
					reviews: true
				}
			});

			if (!request || request.association.organizationId !== context.organization.id) {
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
				where: { id: rest.id },
				include: { association: true }
			});
			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot update a finalized ARC request' });
			}

			if (rest.unitId) await ensureUnitBelongs(rest.unitId, existing.associationId, errors);
			if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, existing.associationId, errors);

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'UPDATE_REQUEST',
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

			const updated = await prisma.aRCRequest.findUniqueOrThrow({ where: { id: rest.id } });

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
				where: { id: input.id },
				include: { association: true }
			});
			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot submit a finalized ARC request' });
			}
			if (existing.status === 'SUBMITTED' || existing.status === 'UNDER_REVIEW') {
				return successResponse({ request: { id: existing.id, status: existing.status, submittedAt: existing.submittedAt?.toISOString() ?? null } }, context);
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'SUBMIT_REQUEST',
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

			const updated = await prisma.aRCRequest.findUniqueOrThrow({ where: { id: input.id } });

			// Record activity event
			await recordExecution(context, {
				entityType: 'ARC_REQUEST',
				entityId: updated.id,
				action: 'SUBMIT',
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
				where: { id: input.id },
				include: { association: true }
			});
			if (!existing || existing.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (existing.status === 'WITHDRAWN') {
				return successResponse({ request: { id: existing.id, status: existing.status, withdrawnAt: existing.withdrawnAt?.toISOString() ?? null } }, context);
			}
			if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot withdraw a finalized ARC request' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'WITHDRAW_REQUEST',
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

			const updated = await prisma.aRCRequest.findUniqueOrThrow({ where: { id: input.id } });

			// Record activity event
			await recordExecution(context, {
				entityType: 'ARC_REQUEST',
				entityId: updated.id,
				action: 'CANCEL',
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
				where: { id: rest.requestId },
				include: { association: true }
			});
			if (!request || request.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
				throw errors.BAD_REQUEST({ message: 'Cannot add documents to a finalized ARC request' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'ADD_DOCUMENT',
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
				where: { id: rest.requestId },
				include: { association: true }
			});
			if (!request || request.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			const previousStatus = request.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startARCRequestWorkflow(
				{
					action: 'RECORD_DECISION',
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

			const updated = await prisma.aRCRequest.findUniqueOrThrow({ where: { id: rest.requestId } });

			// Record activity event
			const actionToEventAction: Record<string, 'APPROVE' | 'DENY' | 'STATUS_CHANGE'> = {
				APPROVE: 'APPROVE',
				DENY: 'DENY',
				REQUEST_CHANGES: 'STATUS_CHANGE',
				TABLE: 'STATUS_CHANGE'
			};

			await recordDecision(context, {
				entityType: 'ARC_REQUEST',
				entityId: updated.id,
				action: actionToEventAction[rest.action] || 'STATUS_CHANGE',
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
				where: { id: input.requestId },
				include: { association: true }
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ARC Request' });
			}

			// Get precedents for the same unit
			const unitPrecedents = input.unitId
				? await prisma.aRCRequest.findMany({
					where: {
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
					action: 'REQUEST_INFO',
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
				entityType: 'ARC_REQUEST',
				entityId: updated.id,
				action: 'STATUS_CHANGE',
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
					action: 'SUBMIT_INFO',
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
				entityType: 'ARC_REQUEST',
				entityId: updated.id,
				action: 'SUBMIT',
				summary: `Information submitted: ${response.substring(0, 100)}`,
				arcRequestId: updated.id,
				previousState: { status: previousStatus },
				newState: { status: updated.status }
			});

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		})
};
