import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { AppealStatus } from '../../../../../../generated/prisma/client.js';
import { startAppealWorkflow } from '../../../workflows/appealWorkflow.js';

const appealStatusEnum = z.enum([
	'PENDING', 'SCHEDULED', 'UPHELD', 'MODIFIED', 'REVERSED', 'WITHDRAWN'
]);

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});
	if (!association) throw ApiException.notFound('Association');
	return association;
};

export const appealRouter = {
	/**
	 * File an appeal against a hearing decision
	 */
	file: orgProcedure
		.input(z.object({
			hearingId: z.string(),
			reason: z.string().min(10).max(5000),
			documentsJson: z.string().optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeal: z.object({
					id: z.string(),
					hearingId: z.string(),
					status: z.string(),
					filedDate: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'violation_appeal', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			// Use DBOS workflow for durable execution
			const result = await startAppealWorkflow(
				{
					action: 'FILE_APPEAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					data: {
						hearingId: input.hearingId,
						reason: input.reason,
						documentsJson: input.documentsJson
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to file appeal');
			}

			const appeal = await prisma.violationAppeal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				appeal: {
					id: appeal.id,
					hearingId: appeal.hearingId,
					status: appeal.status,
					filedDate: appeal.filedDate.toISOString()
				}
			}, context);
		}),

	/**
	 * Get appeal details
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeal: z.object({
					id: z.string(),
					hearingId: z.string(),
					filedDate: z.string(),
					filedBy: z.string(),
					reason: z.string(),
					status: z.string(),
					appealHearingDate: z.string().nullable(),
					appealHearingLocation: z.string().nullable(),
					decisionDate: z.string().nullable(),
					decisionNotes: z.string().nullable(),
					originalFineAmount: z.string().nullable(),
					revisedFineAmount: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const appeal = await prisma.violationAppeal.findFirst({
				where: { id: input.id },
				include: { hearing: { include: { violation: true } } }
			});

			if (!appeal || appeal.hearing.violation.associationId !== association.id) {
				throw ApiException.notFound('Appeal');
			}

			return successResponse({
				appeal: {
					id: appeal.id,
					hearingId: appeal.hearingId,
					filedDate: appeal.filedDate.toISOString(),
					filedBy: appeal.filedBy,
					reason: appeal.reason,
					status: appeal.status,
					appealHearingDate: appeal.appealHearingDate?.toISOString() ?? null,
					appealHearingLocation: appeal.appealHearingLocation,
					decisionDate: appeal.decisionDate?.toISOString() ?? null,
					decisionNotes: appeal.decisionNotes,
					originalFineAmount: appeal.originalFineAmount?.toString() ?? null,
					revisedFineAmount: appeal.revisedFineAmount?.toString() ?? null
				}
			}, context);
		}),

	/**
	 * List appeals for a violation or hearing
	 */
	list: orgProcedure
		.input(z.object({
			violationId: z.string().optional(),
			hearingId: z.string().optional(),
			status: appealStatusEnum.optional()
		}).optional())
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeals: z.array(z.object({
					id: z.string(),
					hearingId: z.string(),
					filedDate: z.string(),
					status: z.string(),
					decisionDate: z.string().nullable()
				}))
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation_appeal', '*');
			const association = await getAssociationOrThrow(context.organization!.id);

			const where: Record<string, unknown> = {};
			if (input?.hearingId) where.hearingId = input.hearingId;
			if (input?.status) where.status = input.status;

			// Filter by violation if provided
			if (input?.violationId) {
				where.hearing = { violationId: input.violationId };
			}

			const appeals = await prisma.violationAppeal.findMany({
				where,
				include: { hearing: { include: { violation: true } } },
				orderBy: { filedDate: 'desc' }
			});

			// Filter to only this association's appeals
			const filteredAppeals = appeals.filter(
				a => a.hearing.violation.associationId === association.id
			);

			return successResponse({
				appeals: filteredAppeals.map(a => ({
					id: a.id,
					hearingId: a.hearingId,
					filedDate: a.filedDate.toISOString(),
					status: a.status,
					decisionDate: a.decisionDate?.toISOString() ?? null
				}))
			}, context);
		}),

	/**
	 * Schedule an appeal hearing
	 */
	scheduleHearing: orgProcedure
		.input(z.object({
			id: z.string(),
			appealHearingDate: z.string().datetime(),
			appealHearingLocation: z.string().max(500).optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeal: z.object({
					id: z.string(),
					status: z.string(),
					appealHearingDate: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			// Use DBOS workflow for durable execution
			const result = await startAppealWorkflow(
				{
					action: 'SCHEDULE_HEARING',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					appealId: input.id,
					data: {
						appealHearingDate: input.appealHearingDate,
						appealHearingLocation: input.appealHearingLocation
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to schedule hearing');
			}

			const appeal = await prisma.violationAppeal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				appeal: {
					id: appeal.id,
					status: appeal.status,
					appealHearingDate: appeal.appealHearingDate!.toISOString()
				}
			}, context);
		}),

	/**
	 * Record appeal decision
	 */
	recordDecision: orgProcedure
		.input(z.object({
			id: z.string(),
			status: z.enum(['UPHELD', 'MODIFIED', 'REVERSED']),
			decisionNotes: z.string().max(5000).optional(),
			revisedFineAmount: z.number().min(0).optional(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeal: z.object({
					id: z.string(),
					status: z.string(),
					decisionDate: z.string(),
					revisedFineAmount: z.string().nullable()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			// Use DBOS workflow for durable execution
			const result = await startAppealWorkflow(
				{
					action: 'RECORD_DECISION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					appealId: input.id,
					data: {
						status: input.status,
						decisionNotes: input.decisionNotes,
						revisedFineAmount: input.revisedFineAmount
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to record decision');
			}

			const appeal = await prisma.violationAppeal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				appeal: {
					id: appeal.id,
					status: appeal.status,
					decisionDate: appeal.decisionDate!.toISOString(),
					revisedFineAmount: appeal.revisedFineAmount?.toString() ?? null
				}
			}, context);
		}),

	/**
	 * Withdraw an appeal
	 */
	withdraw: orgProcedure
		.input(z.object({
			id: z.string(),
			idempotencyKey: z.string().optional()
		}))
		.output(z.object({
			ok: z.literal(true),
			data: z.object({
				appeal: z.object({
					id: z.string(),
					status: z.string()
				})
			}),
			meta: ResponseMetaSchema
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			// Use DBOS workflow for durable execution
			const result = await startAppealWorkflow(
				{
					action: 'WITHDRAW_APPEAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					appealId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw ApiException.internal(result.error || 'Failed to withdraw appeal');
			}

			const appeal = await prisma.violationAppeal.findUniqueOrThrow({
				where: { id: result.entityId }
			});

			return successResponse({
				appeal: {
					id: appeal.id,
					status: appeal.status
				}
			}, context);
		})
};
