/**
 * Activity Event Router (Phase 4)
 *
 * Query APIs for activity events with role-based visibility controls.
 * Activity events are immutable - no create/update/delete endpoints.
 */

import { z } from 'zod';
import {
	ResponseMetaSchema,
	JsonSchema,
	ActivityEntityTypeSchema,
	ActivityActionTypeSchema,
	ActivityActorTypeSchema,
	ActivityEventCategorySchema
} from '$lib/schemas/index.js';
import {
	authedProcedure,
	orgProcedure,
	successResponse,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../router.js';
import { prisma } from '../../db.js';
import { buildPrincipal, requireAuthorization, createResource } from '../../cerbos/index.js';
import type {
	ActivityEntityType,
	ActivityActionType,
	ActivityActorType,
	ActivityEventCategory,
	Prisma
} from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('ActivityEventRoute');

// =============================================================================
// SCHEMAS
// =============================================================================

// Use generated enum schemas from schemas.ts (sourced from Prisma/Zod generation)
const activityEntityTypeEnum = ActivityEntityTypeSchema;
const activityActionTypeEnum = ActivityActionTypeSchema;
const activityActorTypeEnum = ActivityActorTypeSchema;
const activityEventCategoryEnum = ActivityEventCategorySchema;

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
	previousState: JsonSchema.nullable(),
	newState: JsonSchema.nullable(),
	metadata: JsonSchema.nullable(),
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve organization activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve case activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve job activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to retrieve actor activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid search parameters' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to search activity events' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Invalid date range' },
			INTERNAL_SERVER_ERROR: { message: 'Failed to export activity events' }
		})
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
		}),

	// =========================================================================
	// STAFF CROSS-ORG ENDPOINTS
	// These use authedProcedure (not orgProcedure) for cross-org staff access
	// =========================================================================

	/**
	 * Get all activity events across all organizations (staff only)
	 * Uses authedProcedure for cross-org access without requiring org context
	 */
	staffList: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
		.input(
			PaginationInputSchema.extend({
				entityType: activityEntityTypeEnum.optional(),
				action: activityActionTypeEnum.optional(),
				eventCategory: activityEventCategoryEnum.optional(),
				performedById: z.string().optional(),
				performedByType: activityActorTypeEnum.optional(),
				organizationId: z.string().uuid().optional(),
				startDate: z.string().datetime().optional(),
				endDate: z.string().datetime().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					events: z.array(activityEventOutput.extend({
						organizationName: z.string().nullable()
					})),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify user is staff with activity log access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined, // no current org
				undefined, // no vendorId
				undefined, // no currentOrgId
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('activity_event', 'staff-list', 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required for activity log'
				});
			}

			const limit = input.limit ?? 50;
			const where: Prisma.ActivityEventWhereInput = {
				...(input.organizationId && { organizationId: input.organizationId }),
				...(input.entityType && { entityType: input.entityType as ActivityEntityType }),
				...(input.action && { action: input.action as ActivityActionType }),
				...(input.eventCategory && { eventCategory: input.eventCategory as ActivityEventCategory }),
				...(input.performedById && { performedById: input.performedById }),
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

			// Fetch events with organization name
			const events = await prisma.activityEvent.findMany({
				where,
				include: {
					organization: {
						select: { name: true }
					}
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(e => ({
						...serializeEvent(e),
						organizationName: e.organization?.name ?? null
					})),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Get activity events for a specific entity (staff cross-org access)
	 */
	staffGetByEntity: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			INTERNAL_SERVER_ERROR: { message: 'Database error' }
		})
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
					events: z.array(activityEventOutput.extend({
						organizationName: z.string().nullable()
					})),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify user is staff
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('activity_event', input.entityId, 'global');
			try {
				await requireAuthorization(principal, resource, 'view');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff access required'
				});
			}

			const limit = input.limit ?? 50;
			const events = await prisma.activityEvent.findMany({
				where: {
					organizationId: context.organization!.id,
					entityType: input.entityType as ActivityEntityType,
					entityId: input.entityId
				},
				include: {
					organization: {
						select: { name: true }
					}
				},
				orderBy: { performedAt: 'desc' },
				take: limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 })
			});

			const hasMore = events.length > limit;
			const items = hasMore ? events.slice(0, -1) : events;

			return successResponse(
				{
					events: items.map(e => ({
						...serializeEvent(e),
						organizationName: e.organization?.name ?? null
					})),
					pagination: {
						hasMore,
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
					}
				},
				context
			);
		}),

	/**
	 * Export activity events for staff (cross-org access)
	 * Supports JSON and CSV formats with comprehensive filtering
	 */
	staffExport: authedProcedure
		.errors({
			FORBIDDEN: { message: 'Staff access required' },
			BAD_REQUEST: { message: 'Invalid parameters' },
			INTERNAL_SERVER_ERROR: { message: 'Export failed' }
		})
		.input(
			z.object({
				format: z.enum(['json', 'csv']).default('json'),
				entityType: activityEntityTypeEnum.optional(),
				entityId: z.string().optional(),
				action: activityActionTypeEnum.optional(),
				eventCategory: activityEventCategoryEnum.optional(),
				performedByType: activityActorTypeEnum.optional(),
				organizationId: z.string().uuid().optional(),
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
				maxRecords: z.number().int().min(1).max(10000).default(1000),
				includeMetadata: z.boolean().default(false),
				includeStateChanges: z.boolean().default(false)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					content: z.string(), // JSON string or CSV string
					format: z.string(),
					filename: z.string(),
					recordCount: z.number(),
					exportedAt: z.string(),
					filters: z.object({
						startDate: z.string(),
						endDate: z.string(),
						entityType: z.string().nullable(),
						entityId: z.string().nullable(),
						organizationId: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - verify user is staff with export access
			const principal = buildPrincipal(
				context.user!,
				context.orgRoles ?? {},
				undefined,
				undefined,
				undefined,
				context.staffRoles,
				context.pillarAccess
			);
			const resource = createResource('activity_event', 'staff-export', 'global');
			try {
				await requireAuthorization(principal, resource, 'export');
			} catch (error) {
				throw errors.FORBIDDEN({
					message: error instanceof Error ? error.message : 'Staff export access required'
				});
			}

			const where: Prisma.ActivityEventWhereInput = {
				performedAt: {
					gte: new Date(input.startDate),
					lte: new Date(input.endDate)
				},
				...(input.organizationId && { organizationId: input.organizationId }),
				...(input.entityType && { entityType: input.entityType as ActivityEntityType }),
				...(input.entityId && { entityId: input.entityId }),
				...(input.action && { action: input.action as ActivityActionType }),
				...(input.eventCategory && { eventCategory: input.eventCategory as ActivityEventCategory }),
				...(input.performedByType && { performedByType: input.performedByType as ActivityActorType })
			};

			const events = await prisma.activityEvent.findMany({
				where,
				include: {
					organization: {
						select: { name: true }
					}
				},
				orderBy: { performedAt: 'asc' },
				take: input.maxRecords
			});

			// Fetch performer names for events that have performedById
			const performerIds = [...new Set(events.filter(e => e.performedById).map(e => e.performedById!))];
			const performers = performerIds.length > 0
				? await prisma.user.findMany({
						where: { id: { in: performerIds } },
						select: { id: true, name: true, email: true }
					})
				: [];
			const performerMap = new Map(performers.map(p => [p.id, p]));

			const exportedAt = new Date().toISOString();
			const dateRange = `${input.startDate.split('T')[0]}_${input.endDate.split('T')[0]}`;
			let content: string;
			let filename: string;

			if (input.format === 'csv') {
				// Generate CSV content
				const headers = [
					'id',
					'performedAt',
					'entityType',
					'entityId',
					'action',
					'eventCategory',
					'summary',
					'performedById',
					'performedByName',
					'performedByType',
					'organizationId',
					'organizationName',
					'caseId',
					'propertyId',
					'associationId'
				];
				if (input.includeMetadata) {
					headers.push('metadata');
				}
				if (input.includeStateChanges) {
					headers.push('previousState', 'newState');
				}

				const rows = events.map(e => {
					const performer = e.performedById ? performerMap.get(e.performedById) : null;
					const row: string[] = [
						e.id,
						e.performedAt.toISOString(),
						e.entityType,
						e.entityId,
						e.action,
						e.eventCategory,
						`"${(e.summary || '').replace(/"/g, '""')}"`,
						e.performedById || '',
						performer?.name || performer?.email || '',
						e.performedByType,
						e.organizationId || '',
						e.organization?.name || '',
						e.caseId || '',
						e.propertyId || '',
						e.associationId || ''
					];
					if (input.includeMetadata) {
						row.push(`"${JSON.stringify(e.metadata || {}).replace(/"/g, '""')}"`);
					}
					if (input.includeStateChanges) {
						row.push(
							`"${JSON.stringify(e.previousState || {}).replace(/"/g, '""')}"`,
							`"${JSON.stringify(e.newState || {}).replace(/"/g, '""')}"`
						);
					}
					return row.join(',');
				});

				content = [headers.join(','), ...rows].join('\n');
				filename = `audit_export_${dateRange}.csv`;
			} else {
				// Generate JSON content
				const exportData = {
					exportedAt,
					exportedBy: context.user?.email,
					filters: {
						startDate: input.startDate,
						endDate: input.endDate,
						entityType: input.entityType || null,
						entityId: input.entityId || null,
						organizationId: input.organizationId || null
					},
					recordCount: events.length,
					events: events.map(e => {
						const performer = e.performedById ? performerMap.get(e.performedById) : null;
						return {
							id: e.id,
							performedAt: e.performedAt.toISOString(),
							entityType: e.entityType,
							entityId: e.entityId,
							action: e.action,
							eventCategory: e.eventCategory,
							summary: e.summary,
							performedById: e.performedById,
							performedByName: performer?.name || performer?.email || null,
							performedByType: e.performedByType,
							organizationId: e.organizationId,
							organizationName: e.organization?.name || null,
							caseId: e.caseId,
							propertyId: e.propertyId,
							associationId: e.associationId,
							...(input.includeMetadata && { metadata: e.metadata }),
							...(input.includeStateChanges && {
								previousState: e.previousState,
								newState: e.newState
							})
						};
					})
				};
				content = JSON.stringify(exportData, null, 2);
				filename = `audit_export_${dateRange}.json`;
			}

			return successResponse(
				{
					content,
					format: input.format,
					filename,
					recordCount: events.length,
					exportedAt,
					filters: {
						startDate: input.startDate,
						endDate: input.endDate,
						entityType: input.entityType || null,
						entityId: input.entityId || null,
						organizationId: input.organizationId || null
					}
				},
				context
			);
		})
};
