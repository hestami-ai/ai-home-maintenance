import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import type { AppealStatus } from '../../../../../../generated/prisma/client.js';

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'violation_appeal', 'new');
			const association = await getAssociationOrThrow(context.organization!.id);

			const fileAppeal = async () => {
				// Verify hearing exists and belongs to this association
				const hearing = await prisma.violationHearing.findFirst({
					where: { id: input.hearingId },
					include: { violation: true }
				});

				if (!hearing || hearing.violation.associationId !== association.id) {
					throw ApiException.notFound('Hearing');
				}

				// Check if hearing has a decision
				if (hearing.outcome === 'PENDING') {
					throw ApiException.badRequest('Cannot appeal a hearing that has not been held');
				}

				// Check appeal deadline
				if (hearing.appealDeadline && new Date() > hearing.appealDeadline) {
					throw ApiException.badRequest('Appeal deadline has passed');
				}

				// Check if appeal already filed
				const existingAppeal = await prisma.violationAppeal.findFirst({
					where: { hearingId: input.hearingId, status: { notIn: ['WITHDRAWN'] } }
				});
				if (existingAppeal) {
					throw ApiException.conflict('An appeal has already been filed for this hearing');
				}

				// Create appeal and update hearing
				const [appeal] = await prisma.$transaction([
					prisma.violationAppeal.create({
						data: {
							hearingId: input.hearingId,
							filedDate: new Date(),
							filedBy: context.user!.id,
							reason: input.reason,
							documentsJson: input.documentsJson,
							originalFineAmount: hearing.fineAssessed
						}
					}),
					prisma.violationHearing.update({
						where: { id: input.hearingId },
						data: {
							appealFiled: true,
							appealDate: new Date()
						}
					}),
					prisma.violation.update({
						where: { id: hearing.violationId },
						data: { status: 'APPEALED' }
					})
				]);

				return appeal;
			};

			const appeal = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, fileAppeal)).result
				: await fileAppeal();

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
			meta: z.any()
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
			meta: z.any()
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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const scheduleHearing = async () => {
				const appeal = await prisma.violationAppeal.findFirst({
					where: { id: input.id },
					include: { hearing: { include: { violation: true } } }
				});

				if (!appeal || appeal.hearing.violation.associationId !== association.id) {
					throw ApiException.notFound('Appeal');
				}

				if (appeal.status !== 'PENDING') {
					throw ApiException.badRequest('Can only schedule hearing for pending appeals');
				}

				return prisma.violationAppeal.update({
					where: { id: input.id },
					data: {
						status: 'SCHEDULED',
						appealHearingDate: new Date(input.appealHearingDate),
						appealHearingLocation: input.appealHearingLocation
					}
				});
			};

			const appeal = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, scheduleHearing)).result
				: await scheduleHearing();

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const recordDecision = async () => {
				const appeal = await prisma.violationAppeal.findFirst({
					where: { id: input.id },
					include: { hearing: { include: { violation: true } } }
				});

				if (!appeal || appeal.hearing.violation.associationId !== association.id) {
					throw ApiException.notFound('Appeal');
				}

				if (!['PENDING', 'SCHEDULED'].includes(appeal.status)) {
					throw ApiException.badRequest('Appeal decision has already been recorded');
				}

				// Update appeal and violation status
				const [updatedAppeal] = await prisma.$transaction([
					prisma.violationAppeal.update({
						where: { id: input.id },
						data: {
							status: input.status,
							decisionDate: new Date(),
							decisionBy: context.user!.id,
							decisionNotes: input.decisionNotes,
							revisedFineAmount: input.revisedFineAmount
						}
					}),
					// Update violation status based on appeal outcome
					prisma.violation.update({
						where: { id: appeal.hearing.violationId },
						data: {
							status: input.status === 'REVERSED' ? 'DISMISSED' : 'CLOSED'
						}
					})
				]);

				return updatedAppeal;
			};

			const appeal = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, recordDecision)).result
				: await recordDecision();

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
			meta: z.any()
		}))
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation_appeal', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);

			const withdrawAppeal = async () => {
				const appeal = await prisma.violationAppeal.findFirst({
					where: { id: input.id },
					include: { hearing: { include: { violation: true } } }
				});

				if (!appeal || appeal.hearing.violation.associationId !== association.id) {
					throw ApiException.notFound('Appeal');
				}

				if (!['PENDING', 'SCHEDULED'].includes(appeal.status)) {
					throw ApiException.badRequest('Cannot withdraw appeal after decision');
				}

				// Update appeal and revert violation status
				const [updatedAppeal] = await prisma.$transaction([
					prisma.violationAppeal.update({
						where: { id: input.id },
						data: { status: 'WITHDRAWN' }
					}),
					prisma.violation.update({
						where: { id: appeal.hearing.violationId },
						data: { status: 'FINE_ASSESSED' }
					})
				]);

				return updatedAppeal;
			};

			const appeal = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, withdrawAppeal)).result
				: await withdrawAppeal();

			return successResponse({
				appeal: {
					id: appeal.id,
					status: appeal.status
				}
			}, context);
		})
};
