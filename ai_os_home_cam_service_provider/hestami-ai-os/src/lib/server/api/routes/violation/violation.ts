import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma, ViolationStatus } from '../../../../../../generated/prisma/client.js';
import { withIdempotency } from '../../middleware/idempotency.js';

const FINAL_STATUSES: ViolationStatus[] = ['CLOSED', 'DISMISSED'];

const allowedTransitions: Record<ViolationStatus, ViolationStatus[]> = {
	DRAFT: ['OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD', 'FINE_ASSESSED', 'CLOSED', 'DISMISSED'],
	OPEN: ['NOTICE_SENT', 'CURE_PERIOD', 'ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD', 'FINE_ASSESSED', 'CLOSED', 'DISMISSED'],
	NOTICE_SENT: ['CURE_PERIOD', 'ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD', 'FINE_ASSESSED', 'CLOSED', 'DISMISSED'],
	CURE_PERIOD: ['CURED', 'ESCALATED', 'HEARING_SCHEDULED', 'FINE_ASSESSED', 'CLOSED', 'DISMISSED'],
	CURED: ['CLOSED', 'DISMISSED'],
	ESCALATED: ['HEARING_SCHEDULED', 'FINE_ASSESSED', 'CLOSED', 'DISMISSED'],
	HEARING_SCHEDULED: ['HEARING_HELD', 'DISMISSED', 'ESCALATED', 'CLOSED'],
	HEARING_HELD: ['FINE_ASSESSED', 'APPEALED', 'CLOSED', 'DISMISSED'],
	FINE_ASSESSED: ['CLOSED', 'DISMISSED', 'APPEALED'],
	APPEALED: ['CLOSED', 'DISMISSED'],
	CLOSED: [],
	DISMISSED: []
};

const assertStatusChangeAllowed = (current: ViolationStatus, next: ViolationStatus) => {
	if (current === next) return;
	if (FINAL_STATUSES.includes(current)) {
		throw ApiException.badRequest(`Cannot change status from final state ${current}`);
	}
	if (!allowedTransitions[current]?.includes(next)) {
		throw ApiException.badRequest(`Status change from ${current} to ${next} is not allowed`);
	}
};

const withRequiredIdempotency = async <T>(
	idempotencyKey: string | undefined,
	context: Parameters<typeof withIdempotency>[1],
	operation: () => Promise<T>
) => {
	if (!idempotencyKey) {
		throw ApiException.badRequest('Idempotency key is required for mutating operations');
	}
	const { result } = await withIdempotency(idempotencyKey, context, operation);
	return result;
};

const getAssociationOrThrow = async (organizationId: string) => {
	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});

	if (!association) {
		throw ApiException.notFound('Association');
	}

	return association;
};

const getViolationOrThrow = async (id: string, associationId: string) => {
	const violation = await prisma.violation.findFirst({
		where: { id, associationId, deletedAt: null },
		include: { violationType: true }
	});

	if (!violation) {
		throw ApiException.notFound('Violation');
	}

	return violation;
};

const violationStatusEnum = z.enum([
	'DRAFT', 'OPEN', 'NOTICE_SENT', 'CURE_PERIOD', 'CURED',
	'ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD', 'FINE_ASSESSED',
	'APPEALED', 'CLOSED', 'DISMISSED'
]);

const violationSeverityEnum = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']);

const noticeTypeEnum = z.enum([
	'WARNING', 'FIRST_NOTICE', 'SECOND_NOTICE', 'FINAL_NOTICE',
	'FINE_NOTICE', 'HEARING_NOTICE', 'CURE_CONFIRMATION'
]);

const deliveryMethodEnum = z.enum([
	'EMAIL', 'MAIL', 'CERTIFIED_MAIL', 'POSTED', 'HAND_DELIVERED', 'PORTAL'
]);

const hearingOutcomeEnum = z.enum([
	'PENDING', 'UPHELD', 'MODIFIED', 'DISMISSED', 'CONTINUED'
]);

/**
 * Violation management procedures
 */
export const violationRouter = {
	/**
	 * Create a new violation
	 */
	create: orgProcedure
		.input(
			z.object({
				violationTypeId: z.string(),
				title: z.string().min(1).max(255),
				description: z.string().min(1).max(5000),
				severity: violationSeverityEnum.optional(),
				unitId: z.string().optional(),
				commonAreaName: z.string().max(255).optional(),
				locationDetails: z.string().max(500).optional(),
				observedDate: z.string().datetime(),
				responsiblePartyId: z.string().optional(),
				reporterType: z.enum(['STAFF', 'RESIDENT', 'ANONYMOUS']).default('STAFF'),
				idempotencyKey: z.string().min(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						violationNumber: z.string(),
						title: z.string(),
						status: z.string(),
						severity: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'violation', 'new');

			const violation = await withRequiredIdempotency(input.idempotencyKey, context, async () => {
				const association = await getAssociationOrThrow(context.organization!.id);

				// Validate violation type
				const violationType = await prisma.violationType.findFirst({
					where: { id: input.violationTypeId, associationId: association.id, isActive: true }
				});

				if (!violationType) {
					throw ApiException.notFound('Violation Type');
				}

				// Validate unit if provided
				if (input.unitId) {
					const unit = await prisma.unit.findFirst({
						where: { id: input.unitId },
						include: { property: { include: { association: true } } }
					});
					if (!unit || unit.property.association.organizationId !== context.organization!.id) {
						throw ApiException.notFound('Unit');
					}
				}

				// Validate responsible party if provided
				if (input.responsiblePartyId) {
					const party = await prisma.party.findFirst({
						where: { id: input.responsiblePartyId, organizationId: context.organization!.id }
					});
					if (!party) {
						throw ApiException.notFound('Responsible Party');
					}
				}

				// Generate violation number
				const year = new Date().getFullYear();
				const lastViolation = await prisma.violation.findFirst({
					where: {
						associationId: association.id,
						violationNumber: { startsWith: `VIO-${year}-` }
					},
					orderBy: { createdAt: 'desc' }
				});

				const sequence = lastViolation
					? parseInt(lastViolation.violationNumber.split('-')[2] || '0') + 1
					: 1;
				const violationNumber = `VIO-${year}-${String(sequence).padStart(6, '0')}`;

				const severity = input.severity || violationType.defaultSeverity;

				const violation = await prisma.$transaction(async (tx) => {
					const v = await tx.violation.create({
						data: {
							associationId: association.id,
							violationNumber,
							violationTypeId: input.violationTypeId,
							title: input.title,
							description: input.description,
							severity,
							status: 'DRAFT',
							unitId: input.unitId,
							commonAreaName: input.commonAreaName,
							locationDetails: input.locationDetails,
							observedDate: new Date(input.observedDate),
							responsiblePartyId: input.responsiblePartyId,
							reportedBy: context.user!.id,
							reporterType: input.reporterType
						}
					});

					// Record initial status
					await tx.violationStatusHistory.create({
						data: {
							violationId: v.id,
							fromStatus: null,
							toStatus: 'DRAFT',
							changedBy: context.user!.id,
							notes: 'Violation created'
						}
					});

					return v;
				});

				return violation;
			});

			return successResponse(
				{
					violation: {
						id: violation.id,
						violationNumber: violation.violationNumber,
						title: violation.title,
						status: violation.status,
						severity: violation.severity
					}
				},
				context
			);
		}),

	/**
	 * Soft delete violation
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().max(1000).optional() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					id: z.string(),
					deletedAt: z.string()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'violation', input.id);
			const association = await getAssociationOrThrow(context.organization!.id);
			const violation = await getViolationOrThrow(input.id, association.id);

			const deletedAt = new Date();

			const result = await prisma.$transaction(async (tx) => {
				const updated = await tx.violation.update({
					where: { id: input.id },
					data: {
						deletedAt,
						status: 'CLOSED',
						closedDate: deletedAt,
						closedBy: context.user!.id,
						resolutionNotes: input.reason ?? violation.resolutionNotes
					}
				});

				await tx.violationStatusHistory.create({
					data: {
						violationId: input.id,
						fromStatus: violation.status,
						toStatus: 'CLOSED',
						changedBy: context.user!.id,
						notes: input.reason ?? 'Violation deleted'
					}
				});

				return updated;
			});

			return successResponse({ id: result.id, deletedAt: deletedAt.toISOString() }, context);
		}),

	/**
	 * List violations
	 */
	list: orgProcedure
		.input(
			z.object({
				status: violationStatusEnum.optional(),
				severity: violationSeverityEnum.optional(),
				unitId: z.string().optional(),
				violationTypeId: z.string().optional(),
				responsiblePartyId: z.string().optional(),
				search: z.string().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violations: z.array(
						z.object({
							id: z.string(),
							violationNumber: z.string(),
							title: z.string(),
							status: z.string(),
							severity: z.string(),
							observedDate: z.string(),
							unitId: z.string().nullable(),
							noticeCount: z.number(),
							totalFinesAssessed: z.string()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.ViolationWhereInput = {
				associationId: association.id,
				deletedAt: null
			};

			if (input?.status) where.status = input.status;
			if (input?.severity) where.severity = input.severity;
			if (input?.unitId) where.unitId = input.unitId;
			if (input?.violationTypeId) where.violationTypeId = input.violationTypeId;
			if (input?.responsiblePartyId) where.responsiblePartyId = input.responsiblePartyId;
			if (input?.search) {
				where.OR = [
					{ title: { contains: input.search, mode: 'insensitive' } },
					{ violationNumber: { contains: input.search, mode: 'insensitive' } },
					{ description: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const violations = await prisma.violation.findMany({
				where,
				orderBy: [{ status: 'asc' }, { observedDate: 'desc' }]
			});

			return successResponse(
				{
					violations: violations.map((v) => ({
						id: v.id,
						violationNumber: v.violationNumber,
						title: v.title,
						status: v.status,
						severity: v.severity,
						observedDate: v.observedDate.toISOString(),
						unitId: v.unitId,
						noticeCount: v.noticeCount,
						totalFinesAssessed: v.totalFinesAssessed.toString()
					}))
				},
				context
			);
		}),

	/**
	 * Get violation by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						violationNumber: z.string(),
						violationTypeId: z.string(),
						title: z.string(),
						description: z.string(),
						severity: z.string(),
						status: z.string(),
						unitId: z.string().nullable(),
						commonAreaName: z.string().nullable(),
						locationDetails: z.string().nullable(),
						observedDate: z.string(),
						reportedDate: z.string(),
						curePeriodEnds: z.string().nullable(),
						curedDate: z.string().nullable(),
						closedDate: z.string().nullable(),
						responsiblePartyId: z.string().nullable(),
						reportedBy: z.string(),
						reporterType: z.string().nullable(),
						totalFinesAssessed: z.string(),
						totalFinesPaid: z.string(),
						totalFinesWaived: z.string(),
						noticeCount: z.number(),
						lastNoticeDate: z.string().nullable(),
						lastNoticeType: z.string().nullable(),
						resolutionNotes: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id);
			const v = await getViolationOrThrow(input.id, association.id);

			return successResponse(
				{
					violation: {
						id: v.id,
						violationNumber: v.violationNumber,
						violationTypeId: v.violationTypeId,
						title: v.title,
						description: v.description,
						severity: v.severity,
						status: v.status,
						unitId: v.unitId,
						commonAreaName: v.commonAreaName,
						locationDetails: v.locationDetails,
						observedDate: v.observedDate.toISOString(),
						reportedDate: v.reportedDate.toISOString(),
						curePeriodEnds: v.curePeriodEnds?.toISOString() ?? null,
						curedDate: v.curedDate?.toISOString() ?? null,
						closedDate: v.closedDate?.toISOString() ?? null,
						responsiblePartyId: v.responsiblePartyId,
						reportedBy: v.reportedBy,
						reporterType: v.reporterType,
						totalFinesAssessed: v.totalFinesAssessed.toString(),
						totalFinesPaid: v.totalFinesPaid.toString(),
						totalFinesWaived: v.totalFinesWaived.toString(),
						noticeCount: v.noticeCount,
						lastNoticeDate: v.lastNoticeDate?.toISOString() ?? null,
						lastNoticeType: v.lastNoticeType,
						resolutionNotes: v.resolutionNotes
					}
				},
				context
			);
		}),

	/**
	 * Update violation details (non-status)
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).max(255).optional(),
				description: z.string().min(1).max(5000).optional(),
				severity: violationSeverityEnum.optional(),
				unitId: z.string().optional(),
				commonAreaName: z.string().max(255).optional(),
				locationDetails: z.string().max(500).optional(),
				observedDate: z.string().datetime().optional(),
				responsiblePartyId: z.string().optional(),
				reporterType: z.enum(['STAFF', 'RESIDENT', 'ANONYMOUS']).optional(),
				idempotencyKey: z.string().min(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						title: z.string(),
						severity: z.string(),
						observedDate: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const { idempotencyKey, ...rest } = input;

			const result = await withRequiredIdempotency(idempotencyKey, context, async () => {
				const association = await getAssociationOrThrow(context.organization!.id);
				const violation = await getViolationOrThrow(rest.id, association.id);

				// Validate unit if provided
				if (rest.unitId) {
					const unit = await prisma.unit.findFirst({
						where: { id: rest.unitId },
						include: { property: { include: { association: true } } }
					});
					if (!unit || unit.property.association.organizationId !== context.organization!.id) {
						throw ApiException.notFound('Unit');
					}
				}

				// Validate responsible party if provided
				if (rest.responsiblePartyId) {
					const party = await prisma.party.findFirst({
						where: { id: rest.responsiblePartyId, organizationId: context.organization!.id }
					});
					if (!party) {
						throw ApiException.notFound('Responsible Party');
					}
				}

				const updateData: Prisma.ViolationUncheckedUpdateInput = {};
				if (rest.title !== undefined) updateData.title = rest.title;
				if (rest.description !== undefined) updateData.description = rest.description;
				if (rest.severity !== undefined) updateData.severity = rest.severity;
				if (rest.unitId !== undefined) updateData.unitId = rest.unitId;
				if (rest.commonAreaName !== undefined) updateData.commonAreaName = rest.commonAreaName;
				if (rest.locationDetails !== undefined) updateData.locationDetails = rest.locationDetails;
				if (rest.observedDate !== undefined) updateData.observedDate = new Date(rest.observedDate);
				if (rest.responsiblePartyId !== undefined)
					updateData.responsiblePartyId = rest.responsiblePartyId;
				if (rest.reporterType !== undefined) updateData.reporterType = rest.reporterType;

				return prisma.violation.update({
					where: { id: rest.id },
					data: updateData
				});
			});

			return successResponse(
				{
					violation: {
						id: result.id,
						title: result.title,
						severity: result.severity,
						observedDate: result.observedDate?.toISOString() ?? null
					}
				},
				context
			);
		}),

	/**
	 * Update violation status
	 */
	updateStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: violationStatusEnum,
				notes: z.string().max(1000).optional(),
				idempotencyKey: z.string().min(1)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						status: z.string(),
						previousStatus: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const { idempotencyKey, ...rest } = input;

			const updated = await withRequiredIdempotency(idempotencyKey, context, async () => {
				const association = await getAssociationOrThrow(context.organization!.id);
				const v = await getViolationOrThrow(rest.id, association.id);

				assertStatusChangeAllowed(v.status, rest.status);

				const previousStatus = v.status;
				const now = new Date();

				const updateData: Prisma.ViolationUpdateInput = {
					status: rest.status
				};

				// Handle status-specific updates
				if (rest.status === 'CURED') {
					updateData.curedDate = now;
				}
				if (rest.status === 'CLOSED' || rest.status === 'DISMISSED') {
					updateData.closedDate = now;
					updateData.closedBy = context.user!.id;
					if (rest.notes) {
						updateData.resolutionNotes = rest.notes;
					}
				}

				const result = await prisma.$transaction(async (tx) => {
					const r = await tx.violation.update({
						where: { id: rest.id },
						data: updateData
					});

					await tx.violationStatusHistory.create({
						data: {
							violationId: rest.id,
							fromStatus: previousStatus,
							toStatus: rest.status,
							changedBy: context.user!.id,
							notes: rest.notes
						}
					});

					return r;
				});

				return { result, previousStatus };
			});

			return successResponse(
				{
					violation: {
						id: updated.result.id,
						status: updated.result.status,
						previousStatus: updated.previousStatus
					}
				},
				context
			);
		}),

	/**
	 * Cure violation (sets status CURED)
	 */
	cure: orgProcedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						status: z.string(),
						curedDate: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id);
			const v = await getViolationOrThrow(input.id, association.id);

			assertStatusChangeAllowed(v.status, 'CURED');

			const now = new Date();

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.violation.update({
					where: { id: input.id },
					data: { status: 'CURED', curedDate: now, resolutionNotes: input.notes ?? v.resolutionNotes }
				});

				await tx.violationStatusHistory.create({
					data: {
						violationId: input.id,
						fromStatus: v.status,
						toStatus: 'CURED',
						changedBy: context.user!.id,
						notes: input.notes ?? 'Violation cured'
					}
				});

				return result;
			});

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						curedDate: updated.curedDate?.toISOString() ?? null
					}
				},
				context
			);
		}),

	/**
	 * Close violation (sets status CLOSED)
	 */
	close: orgProcedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						status: z.string(),
						closedDate: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id);
			const v = await getViolationOrThrow(input.id, association.id);

			assertStatusChangeAllowed(v.status, 'CLOSED');

			const now = new Date();

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.violation.update({
					where: { id: input.id },
					data: {
						status: 'CLOSED',
						closedDate: now,
						closedBy: context.user!.id,
						resolutionNotes: input.notes ?? v.resolutionNotes
					}
				});

				await tx.violationStatusHistory.create({
					data: {
						violationId: input.id,
						fromStatus: v.status,
						toStatus: 'CLOSED',
						changedBy: context.user!.id,
						notes: input.notes ?? 'Violation closed'
					}
				});

				return result;
			});

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						closedDate: updated.closedDate?.toISOString() ?? null
					}
				},
				context
			);
		}),

	/**
	 * Add evidence to violation
	 */
	addEvidence: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				evidenceType: z.enum(['PHOTO', 'VIDEO', 'DOCUMENT', 'AUDIO']),
				fileName: z.string().min(1).max(255),
				fileUrl: z.string().url(),
				fileSize: z.number().int().optional(),
				mimeType: z.string().max(100).optional(),
				description: z.string().max(500).optional(),
				capturedAt: z.string().datetime().optional(),
				gpsLatitude: z.number().min(-90).max(90).optional(),
				gpsLongitude: z.number().min(-180).max(180).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					evidence: z.object({
						id: z.string(),
						evidenceType: z.string(),
						fileName: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null }
			});

			if (!violation) {
				throw ApiException.notFound('Violation');
			}

			const evidence = await prisma.violationEvidence.create({
				data: {
					violationId: input.violationId,
					evidenceType: input.evidenceType,
					fileName: input.fileName,
					fileUrl: input.fileUrl,
					fileSize: input.fileSize,
					mimeType: input.mimeType,
					description: input.description,
					capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
					capturedBy: context.user!.id,
					gpsLatitude: input.gpsLatitude,
					gpsLongitude: input.gpsLongitude,
					uploadedBy: context.user!.id
				}
			});

			return successResponse(
				{
					evidence: {
						id: evidence.id,
						evidenceType: evidence.evidenceType,
						fileName: evidence.fileName
					}
				},
				context
			);
		}),

	/**
	 * List evidence for a violation
	 */
	listEvidence: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					evidence: z.array(
						z.object({
							id: z.string(),
							evidenceType: z.string(),
							fileName: z.string(),
							fileUrl: z.string(),
							capturedAt: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id);
			await getViolationOrThrow(input.violationId, association.id);

			const evidence = await prisma.violationEvidence.findMany({
				where: { violationId: input.violationId },
				orderBy: { createdAt: 'asc' }
			});

			return successResponse(
				{
					evidence: evidence.map((e) => ({
						id: e.id,
						evidenceType: e.evidenceType,
						fileName: e.fileName,
						fileUrl: e.fileUrl,
						capturedAt: e.capturedAt?.toISOString() ?? null
					}))
				},
				context
			);
		}),

	/**
	 * Send notice for violation
	 */
	sendNotice: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				noticeType: noticeTypeEnum,
				subject: z.string().min(1).max(255),
				body: z.string().min(1).max(10000),
				deliveryMethod: deliveryMethodEnum,
				recipientName: z.string().min(1).max(255),
				recipientAddress: z.string().max(500).optional(),
				recipientEmail: z.string().email().optional(),
				curePeriodDays: z.number().int().min(1).max(365).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notice: z.object({
						id: z.string(),
						noticeType: z.string(),
						noticeNumber: z.number(),
						sentDate: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null },
				include: { violationType: true }
			});

			if (!violation) {
				throw ApiException.notFound('Violation');
			}

			const targetStatus: ViolationStatus =
				(input.curePeriodDays ?? violation.violationType.defaultCurePeriodDays) > 0
					? 'CURE_PERIOD'
					: 'NOTICE_SENT';
			assertStatusChangeAllowed(violation.status, targetStatus);

			const now = new Date();
			const curePeriodDays = input.curePeriodDays || violation.violationType.defaultCurePeriodDays;
			const curePeriodEnds = new Date(now.getTime() + curePeriodDays * 24 * 60 * 60 * 1000);

			const result = await prisma.$transaction(async (tx) => {
				const notice = await tx.violationNotice.create({
					data: {
						violationId: input.violationId,
						noticeType: input.noticeType,
						noticeNumber: violation.noticeCount + 1,
						subject: input.subject,
						body: input.body,
						deliveryMethod: input.deliveryMethod,
						recipientName: input.recipientName,
						recipientAddress: input.recipientAddress,
						recipientEmail: input.recipientEmail,
						sentDate: now,
						curePeriodDays,
						curePeriodEnds,
						sentBy: context.user!.id
					}
				});

				// Update violation
				await tx.violation.update({
					where: { id: input.violationId },
					data: {
						noticeCount: { increment: 1 },
						lastNoticeDate: now,
						lastNoticeType: input.noticeType,
						curePeriodEnds,
						status: targetStatus
					}
				});

				// Record status change if needed
				if (violation.status !== targetStatus) {
					await tx.violationStatusHistory.create({
						data: {
							violationId: input.violationId,
							fromStatus: violation.status,
							toStatus: targetStatus,
							changedBy: context.user!.id,
							notes: `${input.noticeType} sent`
						}
					});
				}

				return notice;
			});

			return successResponse(
				{
					notice: {
						id: result.id,
						noticeType: result.noticeType,
						noticeNumber: result.noticeNumber,
						sentDate: result.sentDate.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * List notices for a violation
	 */
	listNotices: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					notices: z.array(
						z.object({
							id: z.string(),
							noticeType: z.string(),
							noticeNumber: z.number(),
							sentDate: z.string(),
							curePeriodEnds: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id);
			await getViolationOrThrow(input.violationId, association.id);

			const notices = await prisma.violationNotice.findMany({
				where: { violationId: input.violationId },
				orderBy: [{ noticeNumber: 'asc' }]
			});

			return successResponse(
				{
					notices: notices.map((n) => ({
						id: n.id,
						noticeType: n.noticeType,
						noticeNumber: n.noticeNumber,
						sentDate: n.sentDate.toISOString(),
						curePeriodEnds: n.curePeriodEnds?.toISOString() ?? null
					}))
				},
				context
			);
		}),

	/**
	 * Schedule hearing for violation
	 */
	scheduleHearing: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				hearingDate: z.string().datetime(),
				hearingTime: z.string().max(20).optional(),
				location: z.string().max(255).optional(),
				hearingOfficer: z.string().max(255).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					hearing: z.object({
						id: z.string(),
						hearingDate: z.string(),
						location: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await getAssociationOrThrow(context.organization!.id);
			const violation = await getViolationOrThrow(input.violationId, association.id);

			const result = await prisma.$transaction(async (tx) => {
				const hearing = await tx.violationHearing.create({
					data: {
						violationId: input.violationId,
						hearingDate: new Date(input.hearingDate),
						hearingTime: input.hearingTime,
						location: input.location,
						hearingOfficer: input.hearingOfficer,
						outcome: 'PENDING'
					}
				});

				const previousStatus = violation.status;
				assertStatusChangeAllowed(previousStatus, 'HEARING_SCHEDULED');

				await tx.violation.update({
					where: { id: input.violationId },
					data: { status: 'HEARING_SCHEDULED' }
				});

				if (previousStatus !== 'HEARING_SCHEDULED') {
					await tx.violationStatusHistory.create({
						data: {
							violationId: input.violationId,
							fromStatus: previousStatus,
							toStatus: 'HEARING_SCHEDULED',
							changedBy: context.user!.id,
							notes: `Hearing scheduled for ${input.hearingDate}`
						}
					});
				}

				return hearing;
			});

			return successResponse(
				{
					hearing: {
						id: result.id,
						hearingDate: result.hearingDate.toISOString(),
						location: result.location
					}
				},
				context
			);
		}),

	/**
	 * List hearings for a violation
	 */
	listHearings: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					hearings: z.array(
						z.object({
							id: z.string(),
							hearingDate: z.string(),
							location: z.string().nullable(),
							outcome: z.string()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id);
			await getViolationOrThrow(input.violationId, association.id);

			const hearings = await prisma.violationHearing.findMany({
				where: { violationId: input.violationId },
				orderBy: { hearingDate: 'asc' }
			});

			return successResponse(
				{
					hearings: hearings.map((h) => ({
						id: h.id,
						hearingDate: h.hearingDate.toISOString(),
						location: h.location,
						outcome: h.outcome
					}))
				},
				context
			);
		}),

	/**
	 * Record hearing outcome
	 */
	recordHearingOutcome: orgProcedure
		.input(
			z.object({
				hearingId: z.string(),
				outcome: hearingOutcomeEnum,
				outcomeNotes: z.string().max(5000).optional(),
				fineAssessed: z.number().min(0).optional(),
				fineWaived: z.number().min(0).optional(),
				appealDeadlineDays: z.number().int().min(1).max(90).default(30)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					hearing: z.object({
						id: z.string(),
						outcome: z.string(),
						fineAssessed: z.string().nullable()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const hearing = await prisma.violationHearing.findFirst({
				where: { id: input.hearingId },
				include: { violation: { include: { association: true } } }
			});

			if (!hearing || hearing.violation.association.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Hearing');
			}

			await context.cerbos.authorize('edit', 'violation', hearing.violationId);

			const now = new Date();
			const appealDeadline = new Date(now.getTime() + input.appealDeadlineDays * 24 * 60 * 60 * 1000);

			const result = await prisma.$transaction(async (tx) => {
				const updatedHearing = await tx.violationHearing.update({
					where: { id: input.hearingId },
					data: {
						outcome: input.outcome,
						outcomeNotes: input.outcomeNotes,
						fineAssessed: input.fineAssessed,
						fineWaived: input.fineWaived,
						appealDeadline,
						recordedBy: context.user!.id,
						recordedAt: now
					}
				});

				// Update violation status
				const newStatus: ViolationStatus = input.outcome === 'DISMISSED' ? 'DISMISSED' : 'HEARING_HELD';
				await tx.violation.update({
					where: { id: hearing.violationId },
					data: { status: newStatus }
				});

				await tx.violationStatusHistory.create({
					data: {
						violationId: hearing.violationId,
						fromStatus: 'HEARING_SCHEDULED',
						toStatus: newStatus,
						changedBy: context.user!.id,
						notes: `Hearing outcome: ${input.outcome}`
					}
				});

				return updatedHearing;
			});

			return successResponse(
				{
					hearing: {
						id: result.id,
						outcome: result.outcome,
						fineAssessed: result.fineAssessed?.toString() ?? null
					}
				},
				context
			);
		}),

	/**
	 * Assess fine for violation
	 */
	assessFine: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				amount: z.number().min(0.01),
				reason: z.string().max(500).optional(),
				dueDays: z.number().int().min(1).max(90).default(30)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					fine: z.object({
						id: z.string(),
						fineNumber: z.number(),
						amount: z.string(),
						dueDate: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null },
				include: { fines: true }
			});

			if (!violation) {
				throw ApiException.notFound('Violation');
			}

			const now = new Date();
			const dueDate = new Date(now.getTime() + input.dueDays * 24 * 60 * 60 * 1000);
			const fineNumber = violation.fines.length + 1;

			const result = await prisma.$transaction(async (tx) => {
				const fine = await tx.violationFine.create({
					data: {
						violationId: input.violationId,
						fineNumber,
						amount: input.amount,
						reason: input.reason,
						assessedDate: now,
						dueDate,
						balanceDue: input.amount,
						assessedBy: context.user!.id
					}
				});

				// Update violation totals
				await tx.violation.update({
					where: { id: input.violationId },
					data: {
						totalFinesAssessed: { increment: input.amount },
						status: 'FINE_ASSESSED'
					}
				});

				if (violation.status !== 'FINE_ASSESSED') {
					await tx.violationStatusHistory.create({
						data: {
							violationId: input.violationId,
							fromStatus: violation.status,
							toStatus: 'FINE_ASSESSED',
							changedBy: context.user!.id,
							notes: `Fine #${fineNumber} assessed: $${input.amount}`
						}
					});
				}

				return fine;
			});

			return successResponse(
				{
					fine: {
						id: result.id,
						fineNumber: result.fineNumber,
						amount: result.amount.toString(),
						dueDate: result.dueDate.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Waive fine (full or partial)
	 */
	waiveFine: orgProcedure
		.input(
			z.object({
				fineId: z.string(),
				waivedAmount: z.number().min(0.01),
				reason: z.string().min(1).max(500)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					fine: z.object({
						id: z.string(),
						waivedAmount: z.string(),
						balanceDue: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const fine = await prisma.violationFine.findFirst({
				where: { id: input.fineId },
				include: { violation: { include: { association: true } } }
			});

			if (!fine || fine.violation.association.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Fine');
			}

			await context.cerbos.authorize('edit', 'violation', fine.violationId);

			if (input.waivedAmount > Number(fine.balanceDue)) {
				throw ApiException.badRequest('Waived amount cannot exceed balance due');
			}

			const newBalanceDue = Number(fine.balanceDue) - input.waivedAmount;
			const totalWaived = Number(fine.waivedAmount) + input.waivedAmount;

			const result = await prisma.$transaction(async (tx) => {
				const updated = await tx.violationFine.update({
					where: { id: input.fineId },
					data: {
						waivedAmount: totalWaived,
						balanceDue: newBalanceDue,
						waivedBy: context.user!.id,
						waivedDate: new Date(),
						waiverReason: input.reason
					}
				});

				// Update violation totals
				await tx.violation.update({
					where: { id: fine.violationId },
					data: {
						totalFinesWaived: { increment: input.waivedAmount }
					}
				});

				return updated;
			});

			return successResponse(
				{
					fine: {
						id: result.id,
						waivedAmount: result.waivedAmount.toString(),
						balanceDue: result.balanceDue.toString()
					}
				},
				context
			);
		}),

	/**
	 * List fines for a violation
	 */
	listFines: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					fines: z.array(
						z.object({
							id: z.string(),
							fineNumber: z.number(),
							amount: z.string(),
							balanceDue: z.string(),
							assessedDate: z.string(),
							dueDate: z.string()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id);
			await getViolationOrThrow(input.violationId, association.id);

			const fines = await prisma.violationFine.findMany({
				where: { violationId: input.violationId },
				orderBy: { fineNumber: 'asc' }
			});

			return successResponse(
				{
					fines: fines.map((f) => ({
						id: f.id,
						fineNumber: f.fineNumber,
						amount: f.amount.toString(),
						balanceDue: f.balanceDue.toString(),
						assessedDate: f.assessedDate.toISOString(),
						dueDate: f.dueDate.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Get violation status history
	 */
	getStatusHistory: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					history: z.array(
						z.object({
							id: z.string(),
							fromStatus: z.string().nullable(),
							toStatus: z.string(),
							changedBy: z.string(),
							changedAt: z.string(),
							notes: z.string().nullable()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id }
			});

			if (!violation) {
				throw ApiException.notFound('Violation');
			}

			const history = await prisma.violationStatusHistory.findMany({
				where: { violationId: input.violationId },
				orderBy: { changedAt: 'asc' }
			});

			return successResponse(
				{
					history: history.map((h) => ({
						id: h.id,
						fromStatus: h.fromStatus,
						toStatus: h.toStatus,
						changedBy: h.changedBy,
						changedAt: h.changedAt.toISOString(),
						notes: h.notes
					}))
				},
				context
			);
		}),

	/**
	 * Convert fine to assessment charge (for billing integration)
	 */
	fineToCharge: orgProcedure
		.input(
			z.object({
				fineId: z.string(),
				idempotencyKey: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					charge: z.object({
						id: z.string(),
						amount: z.string(),
						dueDate: z.string()
					}),
					fine: z.object({
						id: z.string(),
						assessmentChargeId: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			const association = await getAssociationOrThrow(context.organization!.id);

			const createCharge = async () => {
				// Get the fine with violation details
				const fine = await prisma.violationFine.findFirst({
					where: { id: input.fineId },
					include: {
						violation: {
							include: { unit: true }
						}
					}
				});

				if (!fine || fine.violation.associationId !== association.id) {
					throw ApiException.notFound('Fine');
				}

				if (fine.assessmentChargeId) {
					throw ApiException.conflict('Fine has already been converted to an assessment charge');
				}

				if (!fine.violation.unitId) {
					throw ApiException.badRequest('Violation must be associated with a unit to create a charge');
				}

				// Get or create a "Violation Fine" assessment type
				let assessmentType = await prisma.assessmentType.findFirst({
					where: { associationId: association.id, code: 'FINE' }
				});

				if (!assessmentType) {
					// Get a revenue account for fines
					const fineRevenueAccount = await prisma.gLAccount.findFirst({
						where: {
							associationId: association.id,
							accountType: 'REVENUE',
							isActive: true
						}
					});

					if (!fineRevenueAccount) {
						throw ApiException.badRequest('No revenue account found for fine charges');
					}

					assessmentType = await prisma.assessmentType.create({
						data: {
							associationId: association.id,
							name: 'Violation Fine',
							code: 'FINE',
							description: 'Fines assessed for violations',
							frequency: 'ONE_TIME',
							defaultAmount: 0,
							revenueAccountId: fineRevenueAccount.id
						}
					});
				}

				// Create the assessment charge
				const amount = parseFloat(fine.amount.toString());
				const charge = await prisma.assessmentCharge.create({
					data: {
						associationId: association.id,
						unitId: fine.violation.unitId,
						assessmentTypeId: assessmentType.id,
						chargeDate: fine.assessedDate,
						dueDate: fine.dueDate,
						amount,
						lateFeeAmount: 0,
						totalAmount: amount,
						paidAmount: parseFloat(fine.paidAmount.toString()),
						balanceDue: parseFloat(fine.balanceDue.toString()),
						status: fine.balanceDue.equals(0) ? 'PAID' : 'PENDING',
						description: `Violation Fine #${fine.fineNumber} - ${fine.reason || 'Violation fine'}`
					}
				});

				// Update the fine with the charge reference
				await prisma.violationFine.update({
					where: { id: input.fineId },
					data: {
						assessmentChargeId: charge.id,
						glPosted: true
					}
				});

				return { charge, fine };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createCharge)).result
				: await createCharge();

			return successResponse(
				{
					charge: {
						id: result.charge.id,
						amount: result.charge.amount.toString(),
						dueDate: result.charge.dueDate.toISOString()
					},
					fine: {
						id: input.fineId,
						assessmentChargeId: result.charge.id
					}
				},
				context
			);
		})
};
