/**
 * Activity Event Router (Phase 4)
 *
 * Query APIs for activity events with role-based visibility controls.
 * Activity events are immutable - no create/update/delete endpoints.
 */

import { z } from 'zod';
import {
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../router.js';
import { prisma } from '../../db.js';
import type {
	ActivityEntityType,
	ActivityActionType,
	ActivityActorType,
	ActivityEventCategory,
	Prisma
} from '../../../../../generated/prisma/client.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const activityEntityTypeEnum = z.enum([
	'ASSOCIATION', 'UNIT', 'OWNER', 'VIOLATION', 'ARC_REQUEST', 'ASSESSMENT',
	'GOVERNING_DOCUMENT', 'BOARD_ACTION', 'JOB', 'WORK_ORDER', 'ESTIMATE',
	'INVOICE', 'TECHNICIAN', 'CONTRACTOR', 'INVENTORY', 'CONCIERGE_CASE',
	'OWNER_INTENT', 'INDIVIDUAL_PROPERTY', 'PROPERTY_DOCUMENT', 'MATERIAL_DECISION',
	'EXTERNAL_HOA', 'EXTERNAL_VENDOR', 'CONCIERGE_ACTION', 'USER', 'USER_ROLE',
	'ORGANIZATION', 'DOCUMENT', 'OTHER'
]);

const activityActionTypeEnum = z.enum([
	'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'STATUS_CHANGE',
	'ASSIGN', 'UNASSIGN', 'APPROVE', 'DENY', 'SUBMIT', 'CANCEL', 'COMPLETE',
	'CLOSE', 'REOPEN', 'ESCALATE', 'COMMENT', 'ATTACH', 'DETACH', 'TRANSFER',
	'SCHEDULE', 'DISPATCH', 'START', 'PAUSE', 'RESUME', 'INVOICE', 'PAY',
	'REFUND', 'ADJUST', 'VERIFY', 'REJECT', 'EXPIRE', 'RENEW', 'LOGIN',
	'LOGOUT', 'PASSWORD_CHANGE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'OTHER'
]);

const activityActorTypeEnum = z.enum(['HUMAN', 'AI', 'SYSTEM']);

const activityEventCategoryEnum = z.enum(['INTENT', 'DECISION', 'EXECUTION', 'SYSTEM']);

const activityEventOutput = z.object({
	id: z.string(),
	entityType: activityEntityTypeEnum,
	entityId: z.string(),
	action: activityActionTypeEnum,
	eventCategory: activityEventCategoryEnum,
	summary: z.string(),
	performedById: z.string().nullable(),
	performedByType: activityActorTypeEnum,
	performedAt: z.string(),
	previousState: z.any().nullable(),
	newState: z.any().nullable(),
	metadata: z.any().nullable(),
	// Context fields
	caseId: z.string().nullable(),
	intentId: z.string().nullable(),
	propertyId: z.string().nullable(),
	decisionId: z.string().nullable(),
	jobId: z.string().nullable(),
	workOrderId: z.string().nullable(),
	technicianId: z.string().nullable(),
	associationId: z.string().nullable(),
	unitId: z.string().nullable(),
	violationId: z.string().nullable(),
	arcRequestId: z.string().nullable()
});

const serializeEvent = (e: any) => ({
	id: e.id,
	entityType: e.entityType,
	entityId: e.entityId,
	action: e.action,
	eventCategory: e.eventCategory,
	summary: e.summary,
	performedById: e.performedById,
	performedByType: e.performedByType,
	performedAt: e.performedAt.toISOString(),
	previousState: e.previousState,
	newState: e.newState,
	metadata: e.metadata,
	caseId: e.caseId,
	intentId: e.intentId,
	propertyId: e.propertyId,
	decisionId: e.decisionId,
	jobId: e.jobId,
	workOrderId: e.workOrderId,
	technicianId: e.technicianId,
	associationId: e.associationId,
	unitId: e.unitId,
	violationId: e.violationId,
	arcRequestId: e.arcRequestId
});

// =============================================================================
// ROUTER
// =============================================================================

export const activityEventRouter = {
	/**
	 * Get activity events for a specific entity
	 */
	getByEntity: orgProcedure
		.input(
			z.object({
				entityType: activityEntityTypeEnum,
				entityId: z.string()
			}).merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', input.entityId);

			const limit = input.limit ?? 50;
			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization.id,
					entityType: input.entityType as ActivityEntityType,
					entityId: input.entityId
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get activity events for the organization (paginated)
	 */
	getByOrganization: orgProcedure
		.input(
			PaginationInputSchema.extend({
				entityType: activityEntityTypeEnum.optional(),
				action: activityActionTypeEnum.optional(),
				eventCategory: activityEventCategoryEnum.optional(),
				performedByType: activityActorTypeEnum.optional(),
				startDate: z.string().datetime().optional(),
				endDate: z.string().datetime().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', 'list');

			const limit = input.limit ?? 50;
			const where: Prisma.ActivityEventWhereInput = {
				organizationId: context.organization.id,
				...(input.entityType && { entityType: input.entityType as ActivityEntityType }),
				...(input.action && { action: input.action as ActivityActionType }),
				...(input.eventCategory && { eventCategory: input.eventCategory as ActivityEventCategory }),
				...(input.performedByType && { performedByType: input.performedByType as ActivityActorType }),
				...(input.startDate || input.endDate
					? {
							performedAt: {
								...(input.startDate && { gte: new Date(input.startDate) }),
								...(input.endDate && { lte: new Date(input.endDate) })
							}
						}
					: {})
			};

			const events = await prisma.activityEvent.findMany({
				where,
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get all activity events related to a concierge case
	 */
	getByCase: orgProcedure
		.input(
			z.object({
				caseId: z.string()
			}).merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', input.caseId);

			const limit = input.limit ?? 100;
			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization.id,
					caseId: input.caseId
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get all activity events related to a job
	 */
	getByJob: orgProcedure
		.input(
			z.object({
				jobId: z.string()
			}).merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', input.jobId);

			const limit = input.limit ?? 100;
			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization.id,
					jobId: input.jobId
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get activity events performed by a specific actor
	 */
	getByActor: orgProcedure
		.input(
			z.object({
				actorId: z.string(),
				actorType: activityActorTypeEnum.optional()
			}).merge(PaginationInputSchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', 'list');

			const limit = input.limit ?? 50;
			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization.id,
					performedById: input.actorId,
					...(input.actorType && { performedByType: input.actorType as ActivityActorType })
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Search activity events with filters
	 */
	search: orgProcedure
		.input(
			PaginationInputSchema.extend({
				entityType: activityEntityTypeEnum.optional(),
				entityId: z.string().optional(),
				action: activityActionTypeEnum.optional(),
				eventCategory: activityEventCategoryEnum.optional(),
				performedById: z.string().optional(),
				performedByType: activityActorTypeEnum.optional(),
				startDate: z.string().datetime().optional(),
				endDate: z.string().datetime().optional(),
				// Context filters
				caseId: z.string().optional(),
				jobId: z.string().optional(),
				workOrderId: z.string().optional(),
				propertyId: z.string().optional(),
				associationId: z.string().optional(),
				unitId: z.string().optional(),
				violationId: z.string().optional(),
				arcRequestId: z.string().optional(),
				// Text search
				summaryContains: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					pagination: PaginationOutputSchema,
					totalCount: z.number().optional()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'activity_event', 'search');

			const limit = input.limit ?? 50;
			const where: Prisma.ActivityEventWhereInput = {
				organizationId: context.organization.id,
				...(input.entityType && { entityType: input.entityType as ActivityEntityType }),
				...(input.entityId && { entityId: input.entityId }),
				...(input.action && { action: input.action as ActivityActionType }),
				...(input.eventCategory && { eventCategory: input.eventCategory as ActivityEventCategory }),
				...(input.performedById && { performedById: input.performedById }),
				...(input.performedByType && { performedByType: input.performedByType as ActivityActorType }),
				...(input.caseId && { caseId: input.caseId }),
				...(input.jobId && { jobId: input.jobId }),
				...(input.workOrderId && { workOrderId: input.workOrderId }),
				...(input.propertyId && { propertyId: input.propertyId }),
				...(input.associationId && { associationId: input.associationId }),
				...(input.unitId && { unitId: input.unitId }),
				...(input.violationId && { violationId: input.violationId }),
				...(input.arcRequestId && { arcRequestId: input.arcRequestId }),
				...(input.summaryContains && {
					summary: { contains: input.summaryContains, mode: 'insensitive' as const }
				}),
				...(input.startDate || input.endDate
					? {
							performedAt: {
								...(input.startDate && { gte: new Date(input.startDate) }),
								...(input.endDate && { lte: new Date(input.endDate) })
							}
						}
					: {})
			};

			const events = await prisma.activityEvent.findMany({
				where,
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(serializeEvent),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Export activity events as JSON
	 */
	exportJson: orgProcedure
		.input(
			z.object({
				entityType: activityEntityTypeEnum.optional(),
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
				caseId: z.string().optional(),
				jobId: z.string().optional(),
				maxRecords: z.number().int().min(1).max(10000).default(1000)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput),
					exportedAt: z.string(),
					recordCount: z.number()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('export', 'activity_event', 'export');

			const where: Prisma.ActivityEventWhereInput = {
				organizationId: context.organization.id,
				performedAt: {
					gte: new Date(input.startDate),
					lte: new Date(input.endDate)
				},
				...(input.entityType && { entityType: input.entityType as ActivityEntityType }),
				...(input.caseId && { caseId: input.caseId }),
				...(input.jobId && { jobId: input.jobId })
			};

			const events = await prisma.activityEvent.findMany({
				where,
				orderBy: { performedAt: 'asc' },
				take: input.maxRecords
			});

			return successResponse(
				{
					events: events.map(serializeEvent),
					exportedAt: new Date().toISOString(),
					recordCount: events.length
				},
				context
			);
		})
};
