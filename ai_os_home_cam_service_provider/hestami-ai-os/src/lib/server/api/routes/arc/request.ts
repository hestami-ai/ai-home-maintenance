import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema,
	IdempotencyKeySchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type {
	Prisma,
	ARCRequestStatus,
	ARCReviewAction,
	ARCCategory,
	ARCDocumentType
} from '../../../../../../generated/prisma/client.js';
import type { RequestContext } from '../../context.js';

const arcCategoryEnum = z.enum([
	'FENCE',
	'ROOF',
	'PAINT',
	'ADDITION',
	'LANDSCAPING',
	'WINDOWS',
	'DOORS',
	'DRIVEWAY',
	'GARAGE',
	'SOLAR',
	'HVAC',
	'OTHER'
]);

const arcRequestStatusEnum = z.enum([
	'DRAFT',
	'SUBMITTED',
	'UNDER_REVIEW',
	'APPROVED',
	'DENIED',
	'CHANGES_REQUESTED',
	'TABLED',
	'WITHDRAWN',
	'CANCELLED',
	'EXPIRED'
]);

const arcDocumentTypeEnum = z.enum(['PLANS', 'SPECS', 'PHOTO', 'PERMIT', 'RENDERING', 'SURVEY', 'OTHER']);

const arcReviewActionEnum = z.enum(['APPROVE', 'DENY', 'REQUEST_CHANGES', 'TABLE']);
const terminalStatuses: ARCRequestStatus[] = ['APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED'];
const reviewableStatuses: ARCRequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

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

const ensureUnitBelongs = async (unitId: string, associationId: string) => {
	const unit = await prisma.unit.findFirst({
		where: { id: unitId, deletedAt: null },
		include: { property: true }
	});
	if (!unit || unit.property.associationId !== associationId) {
		throw ApiException.notFound('Unit');
	}
};

const ensureCommitteeBelongs = async (committeeId: string, associationId: string) => {
	const committee = await prisma.aRCCommittee.findFirst({
		where: { id: committeeId, associationId, isActive: true }
	});
	if (!committee) throw ApiException.notFound('ARC Committee');
};

const ensurePartyBelongs = async (partyId: string, organizationId: string) => {
	const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
	if (!party) throw ApiException.notFound('Party');
};

const generateRequestNumber = async (associationId: string) => {
	const year = new Date().getFullYear();
	const last = await prisma.aRCRequest.findFirst({
		where: { associationId, requestNumber: { startsWith: `ARC-${year}-` } },
		orderBy: { createdAt: 'desc' }
	});
	const seq = last ? parseInt((last.requestNumber.split('-')[2] ?? '0'), 10) + 1 : 1;
	return `ARC-${year}-${String(seq).padStart(6, '0')}`;
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
			z.object({
				ok: z.literal(true),
				data: z.object({
					request: z.object({
						id: z.string(),
						requestNumber: z.string(),
						title: z.string(),
						status: z.string(),
						category: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'arc_request', 'new');
			const { idempotencyKey, ...rest } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				await getAssociationOrThrow(rest.associationId, context.organization.id);
				if (rest.unitId) await ensureUnitBelongs(rest.unitId, rest.associationId);
				if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, rest.associationId);
				await ensurePartyBelongs(rest.requesterPartyId, context.organization.id);

				const requestNumber = await generateRequestNumber(rest.associationId);

				const created = await prisma.aRCRequest.create({
					data: {
						associationId: rest.associationId,
						committeeId: rest.committeeId,
						unitId: rest.unitId,
						requesterPartyId: rest.requesterPartyId,
						title: rest.title,
						description: rest.description,
						category: rest.category as ARCCategory,
						estimatedCost: rest.estimatedCost,
						proposedStartDate: rest.proposedStartDate ? new Date(rest.proposedStartDate) : undefined,
						proposedEndDate: rest.proposedEndDate ? new Date(rest.proposedEndDate) : undefined,
						requestNumber,
						status: 'DRAFT'
					}
				});

				return created;
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
			z.object({
				ok: z.literal(true),
				data: z.object({ request: z.any() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const request = await prisma.aRCRequest.findFirst({
				where: { id: input.id },
				include: {
					association: true,
					unit: true,
					committee: true,
					requesterParty: true,
					documents: true,
					reviews: true
				}
			});

			if (!request || request.association.organizationId !== context.organization.id) {
				throw ApiException.notFound('ARC Request');
			}

			await context.cerbos.authorize('view', 'arc_request', request.id);

			return successResponse({ request }, context);
		}),

	list: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string().optional(),
				status: arcRequestStatusEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					requests: z.array(z.any()),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const take = input.limit ?? 20;
			const where: Prisma.ARCRequestWhereInput = {
				association: { organizationId: context.organization.id },
				status: input.status as ARCRequestStatus | undefined,
				associationId: input.associationId
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
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const { idempotencyKey, ...rest } = input;

			const updated = await requireIdempotency(idempotencyKey, context, async () => {
				const existing = await prisma.aRCRequest.findFirst({
					where: { id: rest.id },
					include: { association: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Cannot update a finalized ARC request');
				}

				if (rest.unitId) await ensureUnitBelongs(rest.unitId, existing.associationId);
				if (rest.committeeId) await ensureCommitteeBelongs(rest.committeeId, existing.associationId);

				const data: Prisma.ARCRequestUncheckedUpdateInput = {};
				if (rest.title !== undefined) data.title = rest.title;
				if (rest.description !== undefined) data.description = rest.description;
				if (rest.category !== undefined) data.category = rest.category as ARCCategory;
				if (rest.estimatedCost !== undefined) data.estimatedCost = rest.estimatedCost;
				if (rest.proposedStartDate !== undefined) data.proposedStartDate = new Date(rest.proposedStartDate);
				if (rest.proposedEndDate !== undefined) data.proposedEndDate = new Date(rest.proposedEndDate);
				if (rest.committeeId !== undefined) data.committeeId = rest.committeeId;
				if (rest.unitId !== undefined) data.unitId = rest.unitId;

				return prisma.aRCRequest.update({ where: { id: rest.id }, data });
			});

			return successResponse({ request: { id: updated.id, status: updated.status } }, context);
		}),

	submit: orgProcedure
		.input(IdempotencyKeySchema.merge(z.object({ id: z.string() })))
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string(), submittedAt: z.string().nullable() }) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const updated = await requireIdempotency(input.idempotencyKey, context, async () => {
				const existing = await prisma.aRCRequest.findFirst({
					where: { id: input.id },
					include: { association: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Cannot submit a finalized ARC request');
				}
				if (existing.status === 'SUBMITTED' || existing.status === 'UNDER_REVIEW') {
					return existing;
				}

				const submittedAt = new Date();
				return prisma.aRCRequest.update({
					where: { id: input.id },
					data: { status: 'SUBMITTED', submittedAt }
				});
			});

			return successResponse({ request: { id: updated.id, status: updated.status, submittedAt: updated.submittedAt?.toISOString() ?? null } }, context);
		}),

	withdraw: orgProcedure
		.input(
			IdempotencyKeySchema.merge(
				z.object({ id: z.string(), reason: z.string().max(1000).optional() })
			)
		)
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string(), withdrawnAt: z.string().nullable() }) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.id);
			const updated = await requireIdempotency(input.idempotencyKey, context, async () => {
				const existing = await prisma.aRCRequest.findFirst({
					where: { id: input.id },
					include: { association: true }
				});
				if (!existing || existing.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (existing.status === 'WITHDRAWN') return existing;
				if (terminalStatuses.includes(existing.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Cannot withdraw a finalized ARC request');
				}

				const withdrawnAt = new Date();
				return prisma.aRCRequest.update({
					where: { id: input.id },
					data: { status: 'WITHDRAWN', withdrawnAt, cancellationReason: input.reason }
				});
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
		.output(z.object({ ok: z.literal(true), data: z.object({ document: z.object({ id: z.string(), requestId: z.string() }) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const document = await requireIdempotency(idempotencyKey, context, async () => {
				const request = await prisma.aRCRequest.findFirst({
					where: { id: rest.requestId },
					include: { association: true }
				});
				if (!request || request.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				if (terminalStatuses.includes(request.status as ARCRequestStatus)) {
					throw ApiException.badRequest('Cannot add documents to a finalized ARC request');
				}

				const doc = await prisma.aRCDocument.create({
					data: {
						requestId: rest.requestId,
						documentType: rest.documentType as ARCDocumentType,
						fileName: rest.fileName,
						fileUrl: rest.fileUrl,
						fileSize: rest.fileSize,
						mimeType: rest.mimeType,
						description: rest.description,
						version: rest.version,
						uploadedBy: context.user!.id
					}
				});

				return doc;
			});

			return successResponse({ document: { id: document.id, requestId: document.requestId } }, context);
		}),

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
		.output(z.object({ ok: z.literal(true), data: z.object({ request: z.object({ id: z.string(), status: z.string() }) }), meta: z.any() }))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('review', 'arc_request', input.requestId);
			const { idempotencyKey, ...rest } = input;

			const result = await requireIdempotency(idempotencyKey, context, async () => {
				const request = await prisma.aRCRequest.findFirst({
					where: { id: rest.requestId },
					include: { association: true }
				});
				if (!request || request.association.organizationId !== context.organization.id) {
					throw ApiException.notFound('ARC Request');
				}

				const actionToStatus: Record<ARCReviewAction, ARCRequestStatus> = {
					APPROVE: 'APPROVED',
					DENY: 'DENIED',
					REQUEST_CHANGES: 'CHANGES_REQUESTED',
					TABLE: 'TABLED'
				};

				const status = actionToStatus[rest.action as ARCReviewAction];
				const decisionDate = new Date();

				const res = await prisma.$transaction(async (tx) => {
					await tx.aRCReview.create({
						data: {
							requestId: rest.requestId,
							reviewerId: context.user!.id,
							action: rest.action as ARCReviewAction,
							notes: rest.notes,
							conditions: rest.conditions,
							expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : undefined
						}
					});

					const updated = await tx.aRCRequest.update({
						where: { id: rest.requestId },
						data: { status, reviewedAt: decisionDate, decisionDate, conditions: rest.conditions, expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : request.expiresAt }
					});

					return updated;
				});

				return res;
			});

			return successResponse({ request: { id: result.id, status: result.status } }, context);
		})
};
