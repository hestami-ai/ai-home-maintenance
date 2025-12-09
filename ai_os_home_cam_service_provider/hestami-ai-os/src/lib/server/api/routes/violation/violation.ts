import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma, ViolationStatus } from '../../../../../../generated/prisma/client.js';

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
				reporterType: z.enum(['STAFF', 'RESIDENT', 'ANONYMOUS']).default('STAFF')
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

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

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

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const v = await prisma.violation.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!v) {
				throw ApiException.notFound('Violation');
			}

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
	 * Update violation status
	 */
	updateStatus: orgProcedure
		.input(
			z.object({
				id: z.string(),
				status: violationStatusEnum,
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
						previousStatus: z.string()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'violation', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const v = await prisma.violation.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!v) {
				throw ApiException.notFound('Violation');
			}

			const previousStatus = v.status;
			const now = new Date();

			const updateData: Prisma.ViolationUpdateInput = {
				status: input.status
			};

			// Handle status-specific updates
			if (input.status === 'CURED') {
				updateData.curedDate = now;
			}
			if (input.status === 'CLOSED' || input.status === 'DISMISSED') {
				updateData.closedDate = now;
				updateData.closedBy = context.user!.id;
				if (input.notes) {
					updateData.resolutionNotes = input.notes;
				}
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.violation.update({
					where: { id: input.id },
					data: updateData
				});

				await tx.violationStatusHistory.create({
					data: {
						violationId: input.id,
						fromStatus: previousStatus,
						toStatus: input.status,
						changedBy: context.user!.id,
						notes: input.notes
					}
				});

				return result;
			});

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
						status: 'NOTICE_SENT'
					}
				});

				// Record status change if needed
				if (violation.status !== 'NOTICE_SENT') {
					await tx.violationStatusHistory.create({
						data: {
							violationId: input.violationId,
							fromStatus: violation.status,
							toStatus: 'NOTICE_SENT',
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

				// Update violation status
				const previousStatus = violation.status;
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
		})
};
