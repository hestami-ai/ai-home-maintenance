import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import {
	successResponseSchema,
	ResponseMetaSchema,
	ViolationStatusSchema,
	ViolationSeveritySchema,
	NoticeTypeSchema,
	NoticeDeliveryMethodSchema,
	HearingOutcomeSchema
} from '$lib/schemas/index.js';
import { Prisma, type ViolationStatus } from '../../../../../../generated/prisma/client.js';
import { recordExecution, recordStatusChange } from '../../middleware/activityEvent.js';
import { startViolationCreateWorkflow } from '../../../workflows/violationCreateWorkflow.js';
import { startViolationFineWorkflow } from '../../../workflows/violationFineWorkflow.js';
import { startViolationWorkflow } from '../../../workflows/violationWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ViolationRoute');

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

const assertStatusChangeAllowed = (current: ViolationStatus, next: ViolationStatus, errors: any) => {
	if (current === next) return;
	if (FINAL_STATUSES.includes(current)) {
		throw errors.BAD_REQUEST({ message: `Cannot change status from final state ${current}` });
	}
	if (!allowedTransitions[current]?.includes(next)) {
		throw errors.BAD_REQUEST({ message: `Status change from ${current} to ${next} is not allowed` });
	}
};

const getAssociationOrThrow = async (organizationId: string, contextAssocId: string | null, errors: any) => {
	// Prioritize association from context (Phase 30)
	if (contextAssocId) {
		const assoc = await prisma.association.findFirst({
			where: { id: contextAssocId, organizationId, deletedAt: null }
		});
		if (assoc) return assoc;
	}

	const association = await prisma.association.findFirst({
		where: { organizationId, deletedAt: null }
	});

	if (!association) {
		throw errors.NOT_FOUND({ message: 'Association' });
	}

	return association;
};

const getViolationOrThrow = async (id: string, associationId: string, errors: any) => {
	const violation = await prisma.violation.findFirst({
		where: { id, associationId, deletedAt: null },
		include: { violationType: true }
	});

	if (!violation) {
		throw errors.NOT_FOUND({ message: 'Violation' });
	}

	return violation;
};

// Use shared enum schemas from schemas.ts
const violationStatusEnum = ViolationStatusSchema;
const violationSeverityEnum = ViolationSeveritySchema;
const noticeTypeEnum = NoticeTypeSchema;
const deliveryMethodEnum = NoticeDeliveryMethodSchema;
const hearingOutcomeEnum = HearingOutcomeSchema;

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			successResponseSchema(
				z.object({
					violation: z.object({
						id: z.string(),
						violationNumber: z.string(),
						title: z.string(),
						status: ViolationStatusSchema,
						severity: ViolationSeveritySchema
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'violation', 'new');

			// Get association context (prioritizing X-Assoc-Id header via context.associationId)
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);

			// Validate violation type before starting workflow
			const violationType = await prisma.violationType.findFirst({
				where: { id: input.violationTypeId, associationId: association.id, isActive: true }
			});

			if (!violationType) {
				throw errors.NOT_FOUND({ message: 'Violation Type' });
			}

			// Validate unit if provided
			if (input.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: input.unitId },
					include: { property: { include: { association: true } } }
				});
				if (!unit || unit.property.association.organizationId !== context.organization!.id) {
					throw errors.NOT_FOUND({ message: 'Unit' });
				}
			}

			// Validate responsible party if provided
			if (input.responsiblePartyId) {
				const party = await prisma.party.findFirst({
					where: { id: input.responsiblePartyId, organizationId: context.organization!.id }
				});
				if (!party) {
					throw errors.NOT_FOUND({ message: 'Responsible Party' });
				}
			}

			// Use DBOS workflow for durable execution with idempotencyKey as workflowID
			// This ensures:
			// 1. Idempotency - same key returns same result
			// 2. Durability - workflow survives crashes
			// 3. Trace correlation - all DB operations are in same trace
			const severity = input.severity || violationType.defaultSeverity;

			const result = await startViolationCreateWorkflow(
				{
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					violationTypeId: input.violationTypeId,
					title: input.title,
					description: input.description,
					severity,
					unitId: input.unitId,
					commonAreaName: input.commonAreaName,
					locationDetails: input.locationDetails,
					observedDate: input.observedDate,
					responsiblePartyId: input.responsiblePartyId,
					reporterType: input.reporterType
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create violation' });
			}

			return successResponse(
				{
					violation: {
						id: result.violationId!,
						violationNumber: result.violationNumber!,
						title: input.title,
						status: result.status!,
						severity: result.severity!
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					id: z.string(),
					deletedAt: z.string()
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'violation', input.id);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.id, association.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					violations: z.array(
						z.object({
							id: z.string(),
							violationNumber: z.string(),
							title: z.string(),
							status: ViolationStatusSchema,
							severity: ViolationSeveritySchema,
							observedDate: z.string(),
							unitId: z.string().nullable(),
							noticeCount: z.number(),
							totalFinesAssessed: z.string()
						})
					)
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', '*');

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					violation: z.object({
						id: z.string(),
						violationNumber: z.string(),
						violationTypeId: z.string(),
						title: z.string(),
						description: z.string().nullable(),
						severity: ViolationSeveritySchema,
						status: ViolationStatusSchema,
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
						lastNoticeType: NoticeTypeSchema.nullable(),
						resolutionNotes: z.string().nullable()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const v = await getViolationOrThrow(input.id, association.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			successResponseSchema(
				z.object({
					violation: z.object({
						id: z.string(),
						title: z.string(),
						severity: ViolationSeveritySchema,
						observedDate: z.string().nullable()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const { idempotencyKey, ...rest } = input;

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(rest.id, association.id, errors);

			// Validate unit if provided
			if (rest.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: rest.unitId },
					include: { property: { include: { association: true } } }
				});
				if (!unit || unit.property.association.organizationId !== context.organization!.id) {
					throw errors.NOT_FOUND({ message: 'Unit' });
				}
			}

			// Validate responsible party if provided
			if (rest.responsiblePartyId) {
				const party = await prisma.party.findFirst({
					where: { id: rest.responsiblePartyId, organizationId: context.organization!.id }
				});
				if (!party) {
					throw errors.NOT_FOUND({ message: 'Responsible Party' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'UPDATE_VIOLATION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: rest.id,
					data: rest
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update violation' });
			}

			const result = await prisma.violation.findUniqueOrThrow({ where: { id: rest.id } });

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const { idempotencyKey, ...rest } = input;

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const v = await getViolationOrThrow(rest.id, association.id, errors);

			assertStatusChangeAllowed(v.status, rest.status, errors);
			const previousStatus = v.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: rest.id,
					data: { status: rest.status, notes: rest.notes }
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to update violation status' });
			}

			const updated = await prisma.violation.findUniqueOrThrow({ where: { id: rest.id } });

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						previousStatus
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' }
		})
		.output(
			successResponseSchema(
				z.object({
					violation: z.object({
						id: z.string(),
						status: ViolationStatusSchema,
						curedDate: z.string().nullable()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const v = await getViolationOrThrow(input.id, association.id, errors);

			assertStatusChangeAllowed(v.status, 'CURED', errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' }
		})
		.output(
			successResponseSchema(
				z.object({
					violation: z.object({
						id: z.string(),
						status: ViolationStatusSchema,
						closedDate: z.string().nullable()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const v = await getViolationOrThrow(input.id, association.id, errors);

			assertStatusChangeAllowed(v.status, 'CLOSED', errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					evidence: z.object({
						id: z.string(),
						evidenceType: z.string(),
						fileName: z.string()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null }
			});

			if (!violation) {
				throw errors.NOT_FOUND({ message: 'Violation' });
			}

			const evidence = await prisma.document.create({
				data: {
					organizationId: context.organization!.id,
					associationId: association.id,
					title: input.fileName,
					fileName: input.fileName,
					fileUrl: input.fileUrl,
					storagePath: input.fileUrl, // Fallback to fileUrl for now
					fileSize: input.fileSize || 0,
					mimeType: input.mimeType || 'application/octet-stream',
					description: input.description,
					category: 'VIOLATION_EVIDENCE',
					visibility: 'PRIVATE',
					status: 'ACTIVE',
					uploadedBy: context.user!.id,
					latitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
					longitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
					capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
					metadata: {
						evidenceType: input.evidenceType
					},
					contextBindings: {
						create: {
							contextType: 'VIOLATION',
							contextId: input.violationId,
							isPrimary: true,
							createdBy: context.user!.id
						}
					}
				}
			});

			return successResponse(
				{
					evidence: {
						id: evidence.id,
						evidenceType: input.evidenceType,
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					evidence: z.array(
						z.object({
							id: z.string(),
							evidenceType: z.string(),
							fileName: z.string(),
							fileUrl: z.string(),
							capturedAt: z.string().nullable()
						})
					)
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			await getViolationOrThrow(input.violationId, association.id, errors);

			const evidence = await prisma.document.findMany({
				where: {
					contextBindings: {
						some: {
							contextType: 'VIOLATION',
							contextId: input.violationId
						}
					}
				},
				orderBy: { createdAt: 'asc' }
			});

			return successResponse(
				{
					evidence: evidence.map((e) => ({
						id: e.id,
						evidenceType: (e.metadata as any)?.evidenceType || 'DOCUMENT',
						fileName: e.fileName,
						fileUrl: e.fileUrl,
						capturedAt: e.capturedAt?.toISOString() || e.createdAt.toISOString()
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' }
		})
		.output(
			successResponseSchema(
				z.object({
					notice: z.object({
						id: z.string(),
						noticeType: NoticeTypeSchema,
						noticeNumber: z.number(),
						sentDate: z.string()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null },
				include: { violationType: true }
			});

			if (!violation) {
				throw errors.NOT_FOUND({ message: 'Violation' });
			}

			const targetStatus: ViolationStatus =
				(input.curePeriodDays ?? violation.violationType.defaultCurePeriodDays) > 0
					? 'CURE_PERIOD'
					: 'NOTICE_SENT';
			assertStatusChangeAllowed(violation.status, targetStatus, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			successResponseSchema(
				z.object({
					notices: z.array(
						z.object({
							id: z.string(),
							noticeType: NoticeTypeSchema,
							noticeNumber: z.number(),
							sentDate: z.string(),
							curePeriodEnds: z.string().nullable()
						})
					)
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			await getViolationOrThrow(input.violationId, association.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' }
		})
		.output(
			successResponseSchema(
				z.object({
					hearing: z.object({
						id: z.string(),
						hearingDate: z.string(),
						location: z.string().nullable()
					})
				})
			)
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.violationId, association.id, errors);

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
				assertStatusChangeAllowed(previousStatus, 'HEARING_SCHEDULED', errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			await getViolationOrThrow(input.violationId, association.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const hearing = await prisma.violationHearing.findFirst({
				where: { id: input.hearingId },
				include: { violation: { include: { association: true } } }
			});

			if (!hearing || hearing.violation.association.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Hearing' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id, deletedAt: null },
				include: { fines: true }
			});

			if (!violation) {
				throw errors.NOT_FOUND({ message: 'Violation' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid waived amount' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const fine = await prisma.violationFine.findFirst({
				where: { id: input.fineId },
				include: { violation: { include: { association: true } } }
			});

			if (!fine || fine.violation.association.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Fine' });
			}

			await context.cerbos.authorize('edit', 'violation', fine.violationId);

			if (input.waivedAmount > Number(fine.balanceDue)) {
				throw errors.BAD_REQUEST({ message: 'Waived amount cannot exceed balance due' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			await getViolationOrThrow(input.violationId, association.id, errors);

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const violation = await prisma.violation.findFirst({
				where: { id: input.violationId, associationId: association.id }
			});

			if (!violation) {
				throw errors.NOT_FOUND({ message: 'Violation' });
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
	 * Get prior violations for same unit or same violation type
	 */
	getPriorViolations: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				unitId: z.string().optional(),
				violationTypeId: z.string().optional(),
				limit: z.number().int().min(1).max(20).default(5)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					unitViolations: z.array(
						z.object({
							id: z.string(),
							violationNumber: z.string(),
							title: z.string(),
							status: z.string(),
							severity: z.string(),
							observedDate: z.string()
						})
					),
					typeViolations: z.array(
						z.object({
							id: z.string(),
							violationNumber: z.string(),
							title: z.string(),
							status: z.string(),
							severity: z.string(),
							observedDate: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);

			const unitViolations = input.unitId
				? await prisma.violation.findMany({
					where: {
						associationId: association.id,
						unitId: input.unitId,
						id: { not: input.violationId },
						deletedAt: null
					},
					orderBy: { observedDate: 'desc' },
					take: input.limit
				})
				: [];

			const typeViolations = input.violationTypeId
				? await prisma.violation.findMany({
					where: {
						associationId: association.id,
						violationTypeId: input.violationTypeId,
						id: { not: input.violationId },
						deletedAt: null
					},
					orderBy: { observedDate: 'desc' },
					take: input.limit
				})
				: [];

			return successResponse(
				{
					unitViolations: unitViolations.map((v) => ({
						id: v.id,
						violationNumber: v.violationNumber,
						title: v.title,
						status: v.status,
						severity: v.severity,
						observedDate: v.observedDate.toISOString()
					})),
					typeViolations: typeViolations.map((v) => ({
						id: v.id,
						violationNumber: v.violationNumber,
						title: v.title,
						status: v.status,
						severity: v.severity,
						observedDate: v.observedDate.toISOString()
					}))
				},
				context
			);
		}),

	/**
	 * Escalate violation
	 */
	escalate: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.id, association.id, errors);

			assertStatusChangeAllowed(violation.status, 'ESCALATED', errors);
			const previousStatus = violation.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: input.id,
					data: { status: 'ESCALATED', notes: input.reason }
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to escalate violation' });
			}

			const updated = await prisma.violation.findUniqueOrThrow({ where: { id: input.id } });

			// Record activity event
			await recordStatusChange(
				context,
				'VIOLATION',
				input.id,
				previousStatus,
				updated.status,
				`Violation escalated: ${input.reason}`
			);

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						previousStatus
					}
				},
				context
			);
		}),

	/**
	 * Mark violation as invalid/false positive
	 */
	markInvalid: orgProcedure
		.input(
			z.object({
				id: z.string(),
				reason: z.string().min(1).max(1000),
				idempotencyKey: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.id, association.id, errors);
			const previousStatus = violation.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: input.id,
					data: { status: 'DISMISSED', notes: `Marked as invalid: ${input.reason}` }
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to mark violation as invalid' });
			}

			const updated = await prisma.violation.findUniqueOrThrow({ where: { id: input.id } });

			// Record activity event
			await recordStatusChange(
				context,
				'VIOLATION',
				input.id,
				previousStatus,
				updated.status,
				`Violation marked as invalid: ${input.reason}`
			);

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						previousStatus
					}
				},
				context
			);
		}),

	/**
	 * Resolve violation
	 */
	resolve: orgProcedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string().min(1).max(1000),
				idempotencyKey: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid status change' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					violation: z.object({
						id: z.string(),
						status: z.string(),
						previousStatus: z.string(),
						closedDate: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.id, association.id, errors);

			assertStatusChangeAllowed(violation.status, 'CLOSED', errors);
			const previousStatus = violation.status;

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'UPDATE_STATUS',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: input.id,
					data: { status: 'CLOSED', notes: input.notes }
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to resolve violation' });
			}

			const updated = await prisma.violation.findUniqueOrThrow({ where: { id: input.id } });

			// Record activity event
			await recordStatusChange(
				context,
				'VIOLATION',
				input.id,
				previousStatus,
				updated.status,
				`Violation resolved: ${input.notes}`
			);

			return successResponse(
				{
					violation: {
						id: updated.id,
						status: updated.status,
						previousStatus,
						closedDate: updated.closedDate!.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * File an appeal for a violation
	 */
	fileAppeal: orgProcedure
		.input(
			z.object({
				violationId: z.string(),
				reason: z.string().min(1).max(5000),
				requestBoardReview: z.boolean().default(false),
				supportingInfo: z.string().max(2000).optional(),
				idempotencyKey: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			CONFLICT: { message: 'Resource conflict' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					appeal: z.object({
						id: z.string(),
						status: z.string(),
						filedDate: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'violation', input.violationId);

			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			const violation = await getViolationOrThrow(input.violationId, association.id, errors);

			// Check if there's already a pending appeal
			const existingAppeal = await prisma.violationAppeal.findFirst({
				where: {
					hearing: { violationId: input.violationId },
					status: 'PENDING'
				}
			});

			if (existingAppeal) {
				throw errors.CONFLICT({ message: 'An appeal is already pending for this violation' });
			}

			// Get or create a hearing to attach the appeal to
			let hearing = await prisma.violationHearing.findFirst({
				where: { violationId: input.violationId },
				orderBy: { hearingDate: 'desc' }
			});

			if (!hearing) {
				// Create a placeholder hearing for the appeal
				hearing = await prisma.violationHearing.create({
					data: {
						violationId: input.violationId,
						hearingDate: new Date(),
						outcome: 'PENDING',
						outcomeNotes: 'Appeal filed - hearing pending'
					}
				});
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'RECORD_APPEAL',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: input.violationId,
					data: {
						hearingId: hearing.id,
						reason: input.reason,
						filedBy: context.user!.id,
						documentsJson: input.supportingInfo ? JSON.stringify({ supportingInfo: input.supportingInfo, requestBoardReview: input.requestBoardReview }) : null
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to file appeal' });
			}

			const result = await prisma.violationAppeal.findUniqueOrThrow({ where: { id: workflowResult.entityId } });

			// Record activity event
			await recordExecution(context, {
				entityType: 'VIOLATION',
				entityId: input.violationId,
				action: 'SUBMIT',
				summary: `Appeal filed for violation`,
				violationId: input.violationId,
				newState: { appealId: result.id, status: 'APPEALED' }
			});

			return successResponse(
				{
					appeal: {
						id: result.id,
						status: result.status,
						filedDate: result.filedDate.toISOString()
					}
				},
				context
			);
		}),

	/**
	 * Get appeal details for a violation
	 */
	getAppeal: orgProcedure
		.input(z.object({ violationId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					appeal: z
						.object({
							id: z.string(),
							status: z.string(),
							filedDate: z.string(),
							filedBy: z.string(),
							reason: z.string(),
							requestBoardReview: z.boolean(),
							supportingInfo: z.string().nullable(),
							decisionDate: z.string().nullable(),
							decisionBy: z.string().nullable(),
							decisionNotes: z.string().nullable()
						})
						.nullable()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'violation', input.violationId);
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);
			await getViolationOrThrow(input.violationId, association.id, errors);

			const appeal = await prisma.violationAppeal.findFirst({
				where: {
					hearing: { violationId: input.violationId }
				},
				orderBy: { filedDate: 'desc' }
			});

			if (!appeal) {
				return successResponse({ appeal: null }, context);
			}

			let requestBoardReview = false;
			let supportingInfo: string | null = null;
			if (appeal.documentsJson) {
				try {
					const parsed = JSON.parse(appeal.documentsJson);
					requestBoardReview = parsed.requestBoardReview || false;
					supportingInfo = parsed.supportingInfo || null;
				} catch {
					// Ignore parse errors
				}
			}

			return successResponse(
				{
					appeal: {
						id: appeal.id,
						status: appeal.status,
						filedDate: appeal.filedDate.toISOString(),
						filedBy: appeal.filedBy,
						reason: appeal.reason,
						requestBoardReview,
						supportingInfo,
						decisionDate: appeal.decisionDate?.toISOString() ?? null,
						decisionBy: appeal.decisionBy,
						decisionNotes: appeal.decisionNotes
					}
				},
				context
			);
		}),

	/**
	 * Record appeal decision
	 */
	recordAppealDecision: orgProcedure
		.input(
			z.object({
				appealId: z.string(),
				decision: z.enum(['UPHELD', 'OVERTURNED', 'MODIFIED']),
				notes: z.string().min(1).max(2000),
				revisedFineAmount: z.number().min(0).optional(),
				idempotencyKey: z.string().min(1)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					appeal: z.object({
						id: z.string(),
						status: z.string(),
						decisionDate: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const appeal = await prisma.violationAppeal.findFirst({
				where: { id: input.appealId },
				include: { hearing: { include: { violation: { include: { association: true } } } } }
			});

			if (!appeal || appeal.hearing.violation.association.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Appeal' });
			}

			await context.cerbos.authorize('edit', 'violation', appeal.hearing.violationId);

			// Use DBOS workflow for durable execution
			const workflowResult = await startViolationWorkflow(
				{
					action: 'RECORD_APPEAL_DECISION',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					violationId: appeal.hearing.violationId,
					data: {
						appealId: input.appealId,
						decision: input.decision,
						notes: input.notes,
						revisedFineAmount: input.revisedFineAmount
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to record appeal decision' });
			}

			const result = await prisma.violationAppeal.findUniqueOrThrow({ where: { id: input.appealId } });

			// Record activity event
			await recordExecution(context, {
				entityType: 'VIOLATION',
				entityId: appeal.hearing.violationId,
				action: 'CLOSE',
				summary: `Appeal decision: ${input.decision}`,
				violationId: appeal.hearing.violationId,
				newState: { appealId: result.id, decision: input.decision }
			});

			return successResponse(
				{
					appeal: {
						id: result.id,
						status: result.status,
						decisionDate: result.decisionDate!.toISOString()
					}
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const association = await getAssociationOrThrow(context.organization!.id, context.associationId, errors);

			// Use DBOS workflow for durable execution
			const result = await startViolationFineWorkflow(
				{
					action: 'FINE_TO_CHARGE',
					organizationId: context.organization!.id,
					userId: context.user!.id,
					associationId: association.id,
					fineId: input.fineId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to convert fine to charge' });
			}

			const charge = await prisma.assessmentCharge.findUniqueOrThrow({
				where: { id: result.chargeId }
			});

			return successResponse(
				{
					charge: {
						id: charge.id,
						amount: charge.amount.toString(),
						dueDate: charge.dueDate.toISOString()
					},
					fine: {
						id: input.fineId,
						assessmentChargeId: charge.id
					}
				},
				context
			);
		})
};
